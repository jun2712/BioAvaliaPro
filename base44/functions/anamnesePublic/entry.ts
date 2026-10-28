import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { calcularMetaProteica, extrairDadosMetaProteica, ROTULO_OBJETIVO } from '../../shared/proteina.ts';

// Endpoint público (sem login): o token autoriza ler a anamnese e salvar as respostas.
// Quando o questionário inclui o grupo "Meta Proteica", o cálculo é feito aqui,
// exibido ao respondente e salvo na ficha do cliente (ou em um novo prospecto).

const novoToken = () => crypto.randomUUID().replace(/-/g, '');

const nomeDoCoach = async (base44: any, userId: string | null) => {
  if (!userId) return null;
  const user = await base44.asServiceRole.entities.User.get(userId).catch(() => null);
  return user?.coach_nome || user?.full_name || null;
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = body && body.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{8,64}$/.test(token)) {
      return Response.json({ error: 'Token inválido' }, { status: 400 });
    }

    const lista = await base44.asServiceRole.entities.Anamnese.filter({ token }, '-created_date', 1);
    const anamnese = lista[0];
    if (!anamnese) {
      return Response.json({ error: 'Anamnese não encontrada' }, { status: 404 });
    }

    // Salva as respostas enviadas pelo prospecto.
    if (body.acao === 'responder') {
      const respostas = body.respostas;
      if (!respostas || typeof respostas !== 'object' || Array.isArray(respostas)) {
        return Response.json({ error: 'Respostas inválidas' }, { status: 400 });
      }
      const mapa: Record<string, string> = {};
      Object.keys(respostas).forEach((cod) => {
        const valor = respostas[cod];
        if (typeof valor === 'string' && valor.trim().length > 0 && valor.length <= 500) {
          mapa[cod] = valor.trim();
        }
      });
      if (Object.keys(mapa).length === 0) {
        return Response.json({ error: 'Nenhuma resposta informada' }, { status: 400 });
      }
      const perguntas = (anamnese.perguntas || []).map((p: any) => ({
        ...p,
        resposta: mapa[p.codigo] ?? null,
      }));

      // Cálculo da meta proteica (só acontece quando o grupo foi enviado e respondido)
      const dados = extrairDadosMetaProteica(mapa);
      let metaProteica: Record<string, any> | null = null;
      let clienteVinculado: { id: string; nome: string; prospecto: boolean } | null = null;

      if (dados) {
        const resultado = calcularMetaProteica(dados);
        const coach = await nomeDoCoach(base44, anamnese.created_by_id);

        let clienteId = anamnese.cliente_id || null;
        let prospecto = false;

        // Resultado gravado na ficha do cliente: é o mesmo conteúdo exibido nos relatórios
        const metaCliente = {
          fator: resultado.fator,
          gramas_dia: resultado.gramas_dia,
          refeicao_min: resultado.refeicao_min,
          refeicao_max: resultado.refeicao_max,
          refeicoes: resultado.refeicoes,
          peso: dados.peso,
          idade: dados.idade,
          altura: dados.altura,
          sexo: dados.sexo,
          nivel_atividade: dados.nivelAtividade,
          objetivo: dados.objetivo,
          usa_glp1: dados.usaGLP1,
          origem: 'anamnese',
          calculado_em: new Date().toISOString(),
        };

        if (!clienteId) {
          // Prospecto sem cadastro: cria o cliente já com o status de prospecto
          const cliente = await base44.asServiceRole.entities.Cliente.create({
            nome: String(anamnese.nome || 'Prospecto').trim() || 'Prospecto',
            whatsapp: anamnese.whatsapp || null,
            sexo: dados.sexo,
            altura: dados.altura,
            coach: coach || null,
            status: 'prospecto',
            objetivo: ROTULO_OBJETIVO[dados.objetivo] || null,
            meta_proteica: metaCliente,
          });
          clienteId = cliente.id;
          prospecto = true;
        } else {
          // Cliente existente: atualiza a meta proteica e completa sexo e altura quando faltam
          const cliente = await base44.asServiceRole.entities.Cliente.get(clienteId).catch(() => null);
          if (cliente) {
            const patch: Record<string, any> = { meta_proteica: metaCliente };
            if (!cliente.sexo) patch.sexo = dados.sexo;
            if (!cliente.altura) patch.altura = dados.altura;
            await base44.asServiceRole.entities.Cliente.update(cliente.id, patch).catch(() => null);
          }
        }

        metaProteica = {
          fator: resultado.fator,
          gramas_dia: resultado.gramas_dia,
          refeicao_min: resultado.refeicao_min,
          refeicao_max: resultado.refeicao_max,
          refeicoes: resultado.refeicoes,
          peso: dados.peso,
          idade: dados.idade,
          altura: dados.altura,
          sexo: dados.sexo,
          nivel_atividade: dados.nivelAtividade,
          objetivo: dados.objetivo,
          usa_glp1: dados.usaGLP1,
          cliente_vinculado: clienteId,
          prospecto_criado: prospecto,
        };

        await base44.asServiceRole.entities.CalculoProteina.create({
          cliente_id: clienteId,
          nome: anamnese.nome || null,
          whatsapp: anamnese.whatsapp || null,
          coach: coach || null,
          token: novoToken(),
          status: 'respondida',
          sexo: dados.sexo,
          idade: dados.idade,
          peso: dados.peso,
          altura: dados.altura,
          nivel_atividade: dados.nivelAtividade,
          objetivo: dados.objetivo,
          usa_glp1: dados.usaGLP1,
          fator: resultado.fator,
          gramas_dia: resultado.gramas_dia,
          refeicao_min: resultado.refeicao_min,
          refeicao_max: resultado.refeicao_max,
          refeicoes: resultado.refeicoes,
          respondida_em: new Date().toISOString(),
        });

        clienteVinculado = {
          id: clienteId,
          nome: String(anamnese.nome || 'Prospecto'),
          prospecto,
        };
      }

      await base44.asServiceRole.entities.Anamnese.update(anamnese.id, {
        perguntas,
        status: 'respondida',
        respondida_em: new Date().toISOString(),
        meta_proteica: metaProteica,
        ...(clienteVinculado ? { cliente_id: clienteVinculado.id } : {}),
      });

      return Response.json({ ok: true, meta_proteica: metaProteica, cliente: clienteVinculado });
    }

    // Retorna apenas o necessário para o prospecto preencher o formulário.
    return Response.json({
      nome: anamnese.nome,
      status: anamnese.status,
      meta_proteica: anamnese.meta_proteica || null,
      perguntas: (anamnese.perguntas || []).map((p: any) => ({
        codigo: p.codigo,
        categoria: p.categoria,
        pergunta: p.pergunta,
        tipo: p.tipo,
        opcoes: Array.isArray(p.opcoes) ? p.opcoes : [],
        resposta: p.resposta || '',
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}