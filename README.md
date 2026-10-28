# BioAvalia2

Aplicativo de avaliação física e acompanhamento de clientes, construído como uma SPA React + Vite, com Supabase como banco, autenticação e backend.

## Stack

- **Frontend:** React 18, React Router, TanStack Query, shadcn/Radix, Tailwind CSS.
- **Banco:** Supabase Postgres com Row Level Security.
- **Auth:** Supabase Auth (e-mail/senha, Google OAuth, recuperação de senha).
- **Backend:** Supabase Edge Functions (Deno) para formulários públicos, relatórios, Google Calendar, IA e administração de usuários.
- **Deploy:** Vercel (estático) + Supabase.

O cliente de dados em `src/api/dataClient.js` mantém a API de entidades usada pelas telas (`list`, `filter`, `get`, `create`, `update`, `bulkCreate`, `updateMany` etc.) e traduz as consultas para PostgREST. Isso preserva a interface e as regras de negócio existentes.

## Status da migração

Concluído:

- Schema Postgres, índices, triggers, RPCs e políticas RLS em `supabase/migrations/`.
- Migration inicial e hardening aplicados no projeto Supabase.
- Cliente de dados compatível com as chamadas antigas.
- Supabase Auth no `AuthContext` e nas telas de login, cadastro, recuperação e redefinição de senha.
- Remoção do SDK e do plugin Vite da Base44.
- Contas conhecidas criadas/mapeadas e CSVs importados:
  - 5.319 clientes
  - 10.519 avaliações
  - 6 anamneses
  - 7 agendamentos
  - 2 cálculos de proteína
  - 1 conjunto de anamnese
- As 9 funções da Base44 foram portadas e publicadas como Supabase Edge Functions, além de `admin-users`:
  - `getPublicReport`, `anamnesePublic` e `proteinaPublic` são públicas e validam o token; `verify_jwt = false`.
  - `anamneseAnalise`, `criarEventoGoogle`, `reagendarEventoGoogle`, `sincronizarAgendaGoogle`, `sincronizarFuturosGoogle`, `statusGoogleAgenda` e `admin-users` exigem JWT.
  - Smoke tests remotos passaram para relatório público (sem campos privados), respostas de anamnese/proteína, criação de prospecto, RLS, Google desconectado, IA não configurada e ciclo de vida de usuário/admin.

Pendente:

- Configurar os secrets de Google Calendar e de IA. Até lá, a agenda retorna “não conectada” e a análise por IA retorna 503.
- Configurar SMTP e as URLs de produção do Auth (ver §1.3).
- Publicar na Vercel e atualizar a Site URL/Redirect URLs do Supabase.
- Pedir que os usuários troquem as senhas temporárias e apagar `.import-credentials.local`.
- Decisão de acesso do coach “Jesus Ramaldes”: **não liberar por enquanto** (ver §5).

As páginas públicas (`/relatorio/:token`, `/responder/:token`, `/proteina/:token`) já funcionam com as funções publicadas. Os recursos de agenda/IA dependem somente dos secrets abaixo.

## Pré-requisitos

- Node.js 20.19+ (recomendado 22 LTS ou 24 LTS).
- Uma conta/projeto no [Supabase](https://supabase.com/).
- Opcional: [Supabase CLI](https://supabase.com/docs/guides/cli) para aplicar migrations e publicar funções. Pode ser usada via `npx`, sem instalação global.
- Opcional: conta na [Vercel](https://vercel.com/).

Docker só é necessário para rodar o Supabase local (`supabase start`). Para `link`, `db push` e deploy remoto, não é necessário.

## 1. Configurar o Supabase

Crie um projeto novo e vazio. Não aplique estas migrations em um banco que já tenha tabelas com os mesmos nomes.

### 1.1 Variáveis locais

Copie `.env.example` para `.env.local` e preencha os valores públicos do frontend:

```env
VITE_SUPABASE_URL=https://SEU_REF.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_PUBLISHABLE_OU_ANON_KEY
```

Para aplicar migrations e importar dados, crie `.env.import.local` (ignorado pelo Git):

```env
SUPABASE_PROJECT_REF=SEU_PROJECT_REF
SUPABASE_URL=https://SEU_REF.supabase.co
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_DB_PASSWORD='SUA_SENHA_DO_BANCO'
SUPABASE_SERVICE_ROLE_KEY=SUA_SECRET_OU_SERVICE_ROLE_KEY
```

Use a chave **publishable/anon** no frontend e a chave **secret/service_role** apenas em scripts no servidor. Nunca coloque a chave secreta em variáveis `VITE_*`, no navegador ou no Git.

### 1.2 Aplicar as migrations

Com a CLI:

```bash
set -a; source .env.import.local; set +a

npx supabase@latest link --project-ref "$SUPABASE_PROJECT_REF"
npx supabase@latest db push --dry-run
npx supabase@latest db push
```

As migrations aplicadas são:

- `supabase/migrations/20261028000000_init.sql`
- `supabase/migrations/20261028000100_hardening.sql`

Se preferir, execute os dois arquivos no **SQL Editor** do Supabase. Nesse caso, não rode `db push` depois.

### 1.3 Configurar Auth

Em **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:5173` em desenvolvimento e a URL da Vercel em produção.
- **Redirect URLs:** `http://localhost:5173/**` e `https://SEU_DOMINIO/**`.

Em **Authentication → Email Templates**:

- O cadastro atual espera um código de 6 dígitos. No template **Confirm signup**, inclua `{{ .Token }}`.
- O app também aceita o link padrão de confirmação.
- Configure SMTP próprio antes de convidar usuários reais. Sem SMTP, use as senhas temporárias geradas pelo bootstrap descrito abaixo e peça a troca depois.
- Em projetos Free com o provedor de e-mail padrão, o Supabase bloqueia a edição de templates. Configure SMTP próprio para habilitar o OTP de 6 dígitos; o comprimento do OTP já está configurado como 6.

Em **Authentication → Providers**, habilite Google se desejar login social. Cadastre o cliente OAuth no Google Cloud e cole Client ID/Secret no Supabase.

### 1.4 Criar e mapear os usuários

As contas conhecidas e o mapeamento Base44 → Supabase são:

| Base44 owner ID | E-mail | Coach | Papel |
|---|---|---|---|
| `6adb6fad5703905140c49faa` | `jun@shake4u.com.br` | Jun Takakura | admin |
| `6adcccba140e64ef33f34a64` | `joao.anonimo1969@gmail.com` | Jesus Ramaldes | user |
| `6ae21a5bc68b992627bc3925` | `jun.takakura@yahoo.com.br` | JunT | user |
| `service_d4b6c372-4cb7-4c4c-bb65-440e08045f73` | — | — | sem usuário |

Execute:

```bash
node --env-file=.env.import.local scripts/bootstrap-users.mjs
```

O script:

- cria as contas ausentes com e-mail confirmado;
- corrige `full_name`/`coach_nome` das contas existentes;
- grava as senhas temporárias das contas novas em `.import-credentials.local` (ignorado pelo Git);
- preenche `public.legacy_users` e `profiles.legacy_base44_id`.

Contas existentes **não** têm a senha alterada. Apague `.import-credentials.local` depois que os usuários definirem as próprias senhas.

Crie/mapeie os usuários **antes** de importar os clientes: o trigger de nomes de coach impede que uma conta nova reivindique um nome que já exista nos clientes importados.

### 1.5 Importar os CSVs

Coloque os exports da Base44 na raiz do repositório, com estes nomes:

```text
Cliente_export.csv
Avaliacao_export.csv
Anamnese_export.csv
Agendamento_export.csv
CalculoProteina_export.csv
ConjuntoAnamnese_export.csv
BioAvalia_App-users.csv
```

Esses arquivos contêm dados pessoais e de saúde e estão no `.gitignore`. Não os commit.

Valide primeiro:

```bash
node --env-file=.env.import.local scripts/import-csv.mjs --dry-run
```

Depois importe:

```bash
node --env-file=.env.import.local scripts/import-csv.mjs
```

O importador é idempotente por `legacy_id`: rodar de novo atualiza as mesmas linhas. Decisões aplicadas:

- descarta o cliente “João Ninguém” (`6add22b0475af9fdf6d25200`) e seus registros dependentes;
- mantém “Jun Takakura” com o código `C5135`;
- preenche o coach vazio das avaliações com “Jun Takakura”;
- normaliza `share_token` vazio para `NULL`;
- normaliza datas de nascimento `0000-00-00` para `NULL`;
- importa “Teste Meta” com `cliente_id = NULL` porque o cliente não existe no export;
- não importa `SyncState`; reconecte o Google e faça uma sincronização nova.

Contagens esperadas:

```text
clientes            5319
avaliacoes         10519
anamneses              6
agendamentos           7
calculos_proteina      2
conjuntos_anamnese     1
```

Verificação rápida no SQL Editor:

```sql
select count(*) from public.clientes;             -- 5319
select count(*) from public.avaliacoes;            -- 10519
select coach, count(*) from public.avaliacoes group by coach; -- Jun Takakura: 10519
select count(*) from public.clientes where share_token is not null; -- 0
```

## 2. Rodar localmente

```bash
cp .env.example .env.local
# preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Abra `http://localhost:5173`.

### Comandos

```bash
npm run dev       # servidor de desenvolvimento
npm run build     # build de produção em dist/
npm run preview   # prévia do build
npm run lint      # ESLint
```

## 3. Deploy na Vercel

1. Importe o repositório na Vercel.
2. Framework preset: **Vite**.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em **Settings → Environment Variables**.
6. O `vercel.json` já reescreve rotas da SPA para `index.html`.
7. Atualize a **Site URL** e as **Redirect URLs** do Supabase com o domínio da Vercel.

O deploy de produção ainda não foi executado; é necessário ter acesso ao projeto/equipe na Vercel e configurar as duas variáveis `VITE_*` acima.

A Vercel Hobby é restrita a uso não comercial. Para um app com dados de saúde, avalie um plano compatível e os termos de tratamento de dados.

## 4. Edge Functions

As funções ficam em `supabase/functions/` e podem ser publicadas todas de uma vez:

```bash
set -a; source .env.import.local; set +a
npx supabase@latest functions deploy --project-ref "$SUPABASE_PROJECT_REF"
```

O `supabase/config.toml` marca apenas `getPublicReport`, `anamnesePublic` e `proteinaPublic` com `verify_jwt = false`. As demais exigem um JWT de usuário; `admin-users` confirma que o chamador é administrador antes de alterar papéis ou remover uma conta.

### 4.1 Google Calendar

A integração usa uma única agenda compartilhada. O caminho recomendado é uma conta de serviço:

1. Ative a Google Calendar API no Google Cloud.
2. Crie uma conta de serviço e baixe a chave JSON.
3. Compartilhe a agenda do proprietário (ou uma agenda dedicada “BioAvalia”) com o e-mail da conta de serviço, com permissão para **fazer alterações em eventos**.
4. Configure os secrets no Supabase:

```bash
npx supabase secrets set \
  GOOGLE_SERVICE_ACCOUNT_EMAIL="conta-de-servico@projeto.iam.gserviceaccount.com" \
  GOOGLE_PRIVATE_KEY="$(cat chave.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).private_key))')" \
  GOOGLE_CALENDAR_ID="agenda@grupo.com" \
  --project-ref "$SUPABASE_PROJECT_REF"
```

Também é possível usar OAuth com refresh token: defina `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REFRESH_TOKEN`. Nesse caso, `GOOGLE_CALENDAR_ID` pode ficar como `primary`.

Sem credenciais, `statusGoogleAgenda` retorna `conectado: false`; os agendamentos continuam funcionando apenas no app. Depois de conectar, use o botão de envio dos agendamentos futuros e abra a Agenda para sincronizar. `SyncState` não foi importado: a primeira sincronização começa com uma janela recente.

### 4.2 Análise por IA

Defina uma das chaves e mantenha a função habilitada:

```bash
npx supabase secrets set GEMINI_API_KEY="..." AI_ENABLED=true --project-ref "$SUPABASE_PROJECT_REF"
```

Alternativas: `GROQ_API_KEY` ou `OPENROUTER_API_KEY`. Opcionalmente, force o provedor com `AI_PROVIDER=gemini|groq|openrouter` e escolha o modelo com `GEMINI_MODEL`, `GROQ_MODEL` ou `OPENROUTER_MODEL`. Use `AI_ENABLED=false` para desativar a análise. Sem chave, a função responde 503 com uma mensagem amigável e a tela mostra o erro; o restante do app continua funcionando.

### 4.3 Observações de segurança

As funções públicas usam a service role somente depois de validar o token e os campos de entrada. O relatório público devolve uma lista fechada de campos e nunca inclui `notas_profissional`, IDs de proprietário ou metadados internos. Não há rate limiting distribuído nesta versão; os tokens têm 128 bits de entropia e devem ser tratados como links privados.

## 5. Segurança, acesso e LGPD

O app trata dados de saúde. Antes de usar em produção:

- Revise a base legal, os contratos de operador e a política de privacidade.
- Restrinja quem pode ser administrador.
- Configure backup e retenção no Supabase.
- Verifique a privacidade dos provedores de IA e Google Calendar.
- Não envie a service role/secret key para o navegador.
- Apague `.env.import.local` e `.import-credentials.local` depois da migração.
- O Supabase Free pode pausar por inatividade e tem garantias de backup limitadas; para produção, use um plano pago.

### Decisão atual: acesso do coach “Jesus Ramaldes”

O export tem 5.234 clientes com `coach = "Jesus Ramaldes"`, mas todas as 10.519 avaliações importadas ficaram com `coach = "Jun Takakura"`, conforme a decisão de dados. Em 2026-10-28 foi decidido **não liberar o acesso clínico do Jesus por enquanto**. O teste de RLS mostra que a conta:

- vê os 5.234 clientes;
- vê **0 avaliações** e **0 anamneses**, porque esses registros são filtrados por `coach`/`created_by_id`, não pelo coach do cliente.

Ou seja, o Jesus não consegue abrir prontuários, avaliações ou anamneses desses clientes. Se a decisão mudar, será necessário escolher entre:

1. adicionar políticas RLS que permitam acesso aos registros filhos pelo `coach` do cliente; ou
2. reatribuir avaliações/anamneses/agendamentos/cálculos para a conta do Jesus.

Não altere o campo `coach` das avaliações nem as políticas RLS sem revisar a decisão registrada em `MIGRATION.md`.

## Estrutura relevante

```text
src/api/dataClient.js              # adaptador de dados compatível
src/api/supabaseClient.js          # cliente Supabase
src/lib/AuthContext.jsx            # sessão + perfil
scripts/bootstrap-users.mjs        # criação/mapeamento dos usuários
scripts/import-csv.mjs             # importação idempotente dos CSVs
supabase/migrations/               # schema, RLS, triggers e RPCs
supabase/functions/                # 10 Edge Functions + helpers compartilhados
base44/                            # referência legada; não é mais executado pelo app
MIGRATION.md                       # plano completo, decisões de dados e estado atual
```
