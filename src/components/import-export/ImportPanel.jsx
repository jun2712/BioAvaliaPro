import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, CheckCircle2, AlertCircle, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import MappingTable from "./MappingTable";
import ConflictList from "./ConflictList";
import {
  AVALIACAO_FIELDS, CLIENTE_FIELDS, autoMapColumns, parseCSV, lerTextoCSV,
  parseDateCSV, parseNumberBR, normalizeSexo, valoresIguais,
} from "@/lib/csv";
import { formatarCodigo } from "@/lib/clienteCodigo";
import { formatarDataBR } from "@/lib/datas";
import { carregarTudo } from "@/lib/carregarTudo";
import {
  CATALOGO_PERGUNTAS, camposAnamnese, codigoDaChave, codigosDesconhecidos,
} from "@/lib/anamneseCampos";

// Na anamnese, além dos campos fixos, cada código de pergunta do catálogo
// aparece como uma coluna associável — a resposta entra na pergunta certa.
const FIELDS_POR_ENTITY = { cliente: CLIENTE_FIELDS, avaliacao: AVALIACAO_FIELDS, anamnese: camposAnamnese() };

// Comparação por campo para as opções de resolução de conflito.
const CAMPOS_CLIENTE = ["nome", "email", "notas", "whatsapp", "data_nascimento", "sexo", "altura", "grupo"];
const CAMPOS_AVALIACAO = AVALIACAO_FIELDS.filter((f) => !f.key.startsWith("_")).map((f) => f.key);
const CAMPOS_ANAMNESE = ["nome", "whatsapp", "status"];

// Gravações em massa aceitam até 500 registros por requisição, e cada requisição
// conta no limite de requisições da API: lotes maiores exigem menos chamadas.
const TAM_LOTE = 500;
const PAUSA_MS = 1200;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Tempo sugerido pela API quando o limite é atingido (ex.: "Retry after 23s")
function esperaSugerida(err) {
  const m = String(err?.message || "").match(/after\s+(\d+)\s*s/i);
  return m ? (Number(m[1]) + 2) * 1000 : 20000;
}

// Repete o lote apenas quando a falha é limite de requisições, aguardando o tempo indicado.
async function comLimite(fn, tentativas = 4) {
  for (let t = 1; ; t += 1) {
    try {
      return await fn();
    } catch (e) {
      if (t >= tentativas || !/rate limit/i.test(String(e?.message || ""))) throw e;
      await espera(esperaSugerida(e));
    }
  }
}

// Criações e atualizações em lotes sequenciais, com pausa entre eles:
// importações grandes não estouram o limite de requisições.
async function emLotes(itens, criarLote, setFeitas) {
  for (let i = 0; i < itens.length; i += TAM_LOTE) {
    await comLimite(() => criarLote(itens.slice(i, i + TAM_LOTE)));
    setFeitas(Math.min(i + TAM_LOTE, itens.length));
    if (i + TAM_LOTE < itens.length) await espera(PAUSA_MS);
  }
}

function comparar(existente, novo, keys, fields) {
  const difs = [];
  for (const key of keys) {
    if (!(key in novo)) continue;
    if (!valoresIguais(existente[key], novo[key])) {
      difs.push({
        label: fields.find((f) => f.key === key)?.label || key,
        antes: existente[key],
        depois: novo[key],
      });
    }
  }
  return difs;
}

const resumoToast = (res) =>
  `${res.criados} novo(s)` +
  (res.atualizados ? `, ${res.atualizados} substituído(s)` : "") +
  (res.mantidos ? `, ${res.mantidos} mantido(s)` : "") +
  (res.identicos ? `, ${res.identicos} idêntico(s) já no app` : "") +
  (res.duplicados ? `, ${res.duplicados} duplicado(s) descartado(s)` : "") +
  (res.respostas ? `, ${res.respostas} resposta(s) de perguntas` : "") +
  (res.naoEncontrados ? `, ${res.naoEncontrados} com ID não encontrado` : "") +
  (res.invalidos ? `, ${res.invalidos} linha(s) ignorada(s)` : "");

export default function ImportPanel() {
  const { toast } = useToast();
  const [entity, setEntity] = useState("cliente");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [erro, setErro] = useState("");
  const [importando, setImportando] = useState(false);
  const [feitas, setFeitas] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [escolhas, setEscolhas] = useState({});

  const fields = FIELDS_POR_ENTITY[entity];

  const trocarEntity = (v) => {
    setEntity(v);
    setMapping(headers.length ? autoMapColumns(headers, FIELDS_POR_ENTITY[v]) : {});
    setErro("");
    setResultado(null);
    setAnalise(null);
    setEscolhas({});
  };

  // Limpa a importação, mantendo o resumo do resultado na tela
  const limparArquivo = () => {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setErro("");
    setAnalise(null);
    setEscolhas({});
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const { headers: h, rows: r } = parseCSV(await lerTextoCSV(file));
    if (!h.length) { setErro("Arquivo vazio ou inválido."); return; }
    setHeaders(h);
    setRows(r);
    setMapping(autoMapColumns(h, fields));
    setFileName(file.name);
    setErro("");
    setResultado(null);
    setAnalise(null);
  };

  const buildRecord = (linha) => {
    const rec = {};
    const respostas = {};
    for (const [idx, key] of Object.entries(mapping)) {
      if (!key || key === "__ignore") continue;
      const raw = String(linha[Number(idx)] ?? "").trim();
      if (!raw) continue;
      // Colunas de código de pergunta: "q:101" -> respostas["101"]
      const codigo = codigoDaChave(key);
      if (codigo) { respostas[codigo] = raw; continue; }
      const field = fields.find((f) => f.key === key);
      if (!field) continue;
      if (field.type === "number") {
        let n = parseNumberBR(raw);
        // Alturas antigas em metro (ex.: 1,72) são convertidas para centímetros
        if (n != null && key === "altura" && n < 3) n = Math.round(n * 100);
        if (n != null) rec[key] = n;
      } else if (field.type === "date") {
        const d = parseDateCSV(raw);
        if (d) rec[key] = key === "respondida_em" ? `${d}T12:00:00.000Z` : d;
      } else if (field.type === "select") {
        const s = normalizeSexo(raw);
        if (s) rec[key] = s;
      } else if (key === "status") {
        rec[key] = /resp|conclu/i.test(raw) ? "respondida" : /pend|aguard/i.test(raw) ? "pendente" : raw;
      } else {
        rec[key] = raw;
      }
    }
    if (Object.keys(respostas).length) rec._respostas = respostas;
    return rec;
  };

  // --- Clientes: correspondência EXCLUSIVA pelo ID interno ---
  const analisarClientes = async (registros) => {
    const clientes = await carregarTudo("Cliente");
    const porCodigo = new Map();
    clientes.forEach((c) => { const k = (c.codigo || "").trim().toUpperCase(); if (k) porCodigo.set(k, c); });
    const prontos = [], conflitos = [], emArquivo = new Map();
    let identicos = 0;
    for (const r of registros) {
      const k = (r.codigo || "").trim().toUpperCase();
      const existente = (k && (porCodigo.get(k) || emArquivo.get(k))) || null;
      if (!existente) {
        prontos.push(r);
        if (k) emArquivo.set(k, r);
        continue;
      }
      const difs = comparar(existente, r, CAMPOS_CLIENTE, CLIENTE_FIELDS);
      if (!difs.length) identicos++;
      else conflitos.push({ existente, novo: r, difs, ehArquivo: !existente.id });
    }
    return { prontos, conflitos, identicos };
  };

  // --- Avaliações: vinculadas só pelo ID validado; duplicidade por cliente+data ---
  const analisarAvaliacoes = async (registros) => {
    const clientes = await carregarTudo("Cliente");
    const porCodigo = new Map();
    clientes.forEach((c) => { const k = (c.codigo || "").trim().toUpperCase(); if (k) porCodigo.set(k, c); });
    const avaliacoes = await carregarTudo("Avaliacao");
    const porClienteData = new Map();
    avaliacoes.forEach((a) => porClienteData.set(`${a.cliente_id}|${a.data}`, a));
    const prontos = [], conflitos = [], emArquivo = new Map();
    let identicos = 0, naoEncontrados = 0;
    for (const r of registros) {
      const k = (r._cliente_codigo || "").trim().toUpperCase();
      const cliente = (k && porCodigo.get(k)) || null;
      if (!cliente) { naoEncontrados++; continue; }
      const regKey = `${cliente.id}|${r.data}`;
      const registro = { ...r, _cliente: cliente };
      const existente = porClienteData.get(regKey) || emArquivo.get(regKey);
      if (!existente) {
        prontos.push(registro);
        emArquivo.set(regKey, registro);
        continue;
      }
      const difs = comparar(existente, r, CAMPOS_AVALIACAO, AVALIACAO_FIELDS);
      if (!difs.length) identicos++;
      else conflitos.push({ existente, novo: registro, difs, ehArquivo: !existente.id });
    }
    return { prontos, conflitos, identicos, naoEncontrados };
  };

  // --- Anamneses: vinculadas pelo ID; duplicatas (cliente+data) descartadas ---
  const analisarAnamneses = async (registros) => {
    const clientes = await carregarTudo("Cliente");
    const porCodigo = new Map();
    clientes.forEach((c) => { const k = (c.codigo || "").trim().toUpperCase(); if (k) porCodigo.set(k, c); });
    const anamneses = await carregarTudo("Anamnese");
    const porClienteData = new Map();
    anamneses.forEach((a) => { if (a.cliente_id && a.data) porClienteData.set(`${a.cliente_id}|${a.data}`, a); });
    const prontos = [];
    let identicos = 0, naoEncontrados = 0, duplicados = 0, respostas = 0;
    for (const r of registros) {
      const k = (r._cliente_codigo || "").trim().toUpperCase();
      const cliente = (k && porCodigo.get(k)) || null;
      if (!cliente) { naoEncontrados++; continue; }
      const regKey = `${cliente.id}|${r.data}`;
      if (porClienteData.has(regKey)) { duplicados++; continue; }
      porClienteData.set(regKey, true);
      // Respostas por código: o texto e as opções vêm do catálogo do app
      const perguntas = Object.entries(r._respostas || {})
        .filter(([codigo]) => CATALOGO_PERGUNTAS.has(codigo))
        .map(([codigo, resposta]) => {
          const p = CATALOGO_PERGUNTAS.get(codigo);
          return {
            codigo,
            categoria: p.categoria,
            pergunta: p.pergunta,
            tipo: p.tipo,
            opcoes: p.opcoes || [],
            resposta,
          };
        })
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
      respostas += perguntas.length;
      const completas = perguntas.length > 0 && perguntas.every((p) => p.resposta);
      prontos.push({
        cliente_id: cliente.id,
        data: r.data,
        nome: r.nome || cliente.nome,
        whatsapp: r.whatsapp || cliente.whatsapp || null,
        status: r.status === "respondida" || completas ? "respondida" : "pendente",
        respondida_em: r.respondida_em || (completas ? new Date().toISOString() : null),
        perguntas,
      });
    }
    return { prontos, conflitos: [], identicos, naoEncontrados, duplicados, respostas };
  };

  // --- Execução (lotes sequenciais, com pausa) ---
  const executarClientes = async (dados, escolhas, setFeitas) => {
    let atualizados = 0, mantidos = 0, criados = 0;
    // ID é gerenciado pelo app: novos clientes entram na sequência histórica,
    // sem reutilizar IDs de clientes excluídos.
    // Códigos de toda a base: a consulta "distinct" é limitada, então a lista é
    // percorrida por completo para nunca repetir um ID já existente.
    const existentesNaBase = await carregarTudo("Cliente", "codigo");
    const usados = new Set(
      existentesNaBase.map((c) => String(c.codigo ?? "").trim().toUpperCase()).filter(Boolean)
    );
    let maximo = existentesNaBase.reduce(
      (acc, c) => Math.max(acc, Number(String(c.codigo || "").replace(/\D/g, "")) || 0), 0
    );
    dados.prontos.forEach((r) => {
      const cand = String(r.codigo || "").trim().toUpperCase();
      if (cand && !usados.has(cand)) { r.codigo = cand; usados.add(cand); return; }
      let n = maximo + 1;
      while (usados.has(formatarCodigo(n))) n += 1;
      r.codigo = formatarCodigo(n);
      maximo = n;
      usados.add(r.codigo);
    });
    if (dados.prontos.length) {
      // Clientes sem coach na planilha ficam vinculados a quem importa
      const user = await base44.auth.me().catch(() => null);
      const coachAtual = user?.coach_nome || user?.email || null;
      if (coachAtual) dados.prontos.forEach((r) => { if (!r.coach) r.coach = coachAtual; });
      await emLotes(dados.prontos, async (lote) => {
        // Reconciliação antes de gravar: códigos que já estão na base (de uma
        // importação anterior interrompida) não são criados outra vez.
        const existentes = new Set();
        for (let i = 0; i < lote.length; i += 100) {
          const page = await comLimite(() => base44.entities.Cliente.filter(
            { codigo: { $in: lote.slice(i, i + 100).map((r) => r.codigo) } },
            { limit: 200 },
          ));
          page.items.forEach((c) => existentes.add(String(c.codigo || "").trim().toUpperCase()));
        }
        const novos = lote.filter((r) => !existentes.has(r.codigo));
        if (novos.length) await base44.entities.Cliente.bulkCreate(novos);
        criados += novos.length;
      }, setFeitas);
    }
    const substituicoes = dados.conflitos
      .map((c, i) => (escolhas[i] === "substituir" ? c : null))
      .filter(Boolean);
    const updates = substituicoes
      .filter((c) => !c.ehArquivo)
      .map((c) => {
        const campos = { ...c.novo };
        delete campos.codigo; // o ID é a chave de correspondência: nunca é reescrito
        return { id: c.existente.id, ...campos };
      });
    await emLotes(updates, (lote) => base44.entities.Cliente.bulkUpdate(lote), () => {});
    atualizados = updates.length;
    mantidos = dados.conflitos.length - atualizados;
    // Códigos já existentes na base entram como "idênticos já no app"
    return {
      criados,
      atualizados,
      mantidos,
      identicos: dados.identicos + (dados.prontos.length - criados),
    };
  };

  const executarAvaliacoes = async (dados, escolhas, setFeitas) => {
    const prontos = dados.prontos.map((r) => {
      const { _cliente_codigo, _cliente_nome, _cliente, ...resto } = r;
      return { ...resto, cliente_id: _cliente.id };
    });
    await emLotes(prontos, (lote) => base44.entities.Avaliacao.bulkCreate(lote), setFeitas);
    const substituicoes = dados.conflitos
      .map((c, i) => (escolhas[i] === "substituir" ? c : null))
      .filter(Boolean);
    const updates = substituicoes
      .filter((c) => !c.ehArquivo)
      .map((c) => {
        const campos = { ...c.novo };
        delete campos._cliente_codigo;
        delete campos._cliente_nome;
        delete campos._cliente;
        return { id: c.existente.id, ...campos };
      });
    await emLotes(updates, (lote) => base44.entities.Avaliacao.bulkUpdate(lote), () => {});
    const atualizados = updates.length;
    const mantidos = dados.conflitos.length - atualizados;
    return { criados: prontos.length, atualizados, mantidos, identicos: dados.identicos };
  };

  const executarAnamneses = async (dados, setFeitas) => {
    await emLotes(dados.prontos, (lote) => base44.entities.Anamnese.bulkCreate(lote), setFeitas);
    return {
      criados: dados.prontos.length,
      identicos: dados.identicos,
      duplicados: dados.duplicados,
      naoEncontrados: dados.naoEncontrados,
      respostas: dados.respostas,
    };
  };

  const importar = async () => {
    setErro("");
    setResultado(null);
    setAnalise(null);
    const mapeados = new Set(Object.values(mapping).filter((k) => k && k !== "__ignore"));
    const faltando = fields.filter((f) => f.required && !mapeados.has(f.key));
    if (faltando.length) {
      setErro(`Mapeie o(s) campo(s) obrigatório(s): ${faltando.map((f) => f.label).join(", ")}.`);
      return;
    }
    setImportando(true);
    setFeitas(0);
    try {
      const registros = rows.map(buildRecord).filter((r) => Object.keys(r).length > 0);
      if (!registros.length) { setErro("Nenhuma linha com dados válidos."); return; }
      // O ID interno do cliente é obrigatório nos três tipos de importação
      const validos = registros.filter((r) =>
        entity === "cliente" ? (r.codigo && r.nome) : ((r._cliente_codigo || "").trim() && r.data)
      );
      const invalidos = registros.length - validos.length;
      if (!validos.length) {
        setErro("Nenhuma linha com os dados obrigatórios (ID do cliente" + (entity !== "cliente" ? " e data" : " e nome") + ").");
        return;
      }

      const dados = entity === "cliente"
        ? await analisarClientes(validos)
        : entity === "avaliacao"
          ? await analisarAvaliacoes(validos)
          : await analisarAnamneses(validos);
      dados.invalidos = invalidos;

      if (!dados.conflitos.length) {
        const res = await executar(entity, dados, {});
        setResultado(res);
        limparArquivo();
        toast({ title: "Importação concluída com sucesso", description: resumoToast(res) });
      } else {
        setAnalise(dados);
        setEscolhas({});
      }
    } finally {
      setImportando(false);
    }
  };

  const concluir = async () => {
    setImportando(true);
    setFeitas(0);
    try {
      const res = await executar(entity, analise, escolhas);
      setResultado(res);
      limparArquivo();
      toast({ title: "Importação concluída com sucesso", description: resumoToast(res) });
      setAnalise(null);
      setEscolhas({});
    } finally {
      setImportando(false);
    }
  };

  const executar = async (entidade, dados, escolhas) => {
    if (entidade === "cliente") return await executarClientes(dados, escolhas, (n) => setFeitas(n));
    if (entidade === "avaliacao") return await executarAvaliacoes(dados, escolhas, (n) => setFeitas(n));
    return await executarAnamneses(dados, (n) => setFeitas(n));
  };

  const getTitulo = (c) => entity === "cliente"
    ? `Cliente ID ${(c.novo.codigo || "").toUpperCase()} — ${(c.novo.nome || "").trim()}`
    : entity === "avaliacao"
      ? `Avaliação de ${formatarDataBR(c.novo.data)} · ID ${(c.novo._cliente_codigo || "").toUpperCase()}`
      : `Anamnese de ${formatarDataBR(c.novo.data)} · ID ${(c.novo._cliente_codigo || "").toUpperCase()}`;

  const textosAjuda = {
    cliente: "Cada cliente é identificado pelo ID interno (ex.: C0018), obrigatório na planilha. IDs novos entram na sequência, sem reutilizar IDs excluídos. Registros já cadastrados com o mesmo ID: idênticos são ignorados e divergentes geram uma tela de escolha (substituir ou manter) — clientes nunca são fundidos por nome ou WhatsApp.",
    avaliacao: "Cada avaliação é vinculada ao cliente pelo ID interno (obrigatório). IDs não encontrados são ignorados. Avaliações idênticas (mesmo cliente e data) são ignoradas; na mesma data com dados diferentes, você escolhe substituir ou manter.",
    anamnese: "Cada anamnese é vinculada ao cliente pelo ID interno (obrigatório). Anamneses já existentes do mesmo cliente na mesma data são descartadas automaticamente. As respostas entram por código: cada coluna com o código de uma pergunta cadastrada no app é associada àquela pergunta automaticamente.",
  };

  const total = analise ? (analise.prontos?.length || 0) + (analise.conflitos?.length || 0) : rows.length;
  const codigosForaDoApp = entity === "anamnese" && headers.length ? codigosDesconhecidos(headers) : [];

  return (
    <div className="space-y-4">
      <Tabs value={entity} onValueChange={trocarEntity}>
        <TabsList>
          <TabsTrigger value="cliente">Clientes</TabsTrigger>
          <TabsTrigger value="avaliacao">Avaliações</TabsTrigger>
          <TabsTrigger value="anamnese">Anamneses</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Input type="file" accept=".csv,text/csv" onChange={onFile} className="flex-1" />
          {fileName && (
            <Button variant="outline" size="sm" onClick={limparArquivo}>
              <X className="w-4 h-4 mr-1.5" />Remover arquivo
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Arquivo CSV com colunas separadas por ";" e datas em dd/mm/aaaa.
          {fileName && ` Carregado: ${fileName} (${rows.length} linhas).`}
          {` ${textosAjuda[entity]}`}
        </p>
      </Card>

      {headers.length > 0 && (
        <Card className="p-4 space-y-4">
          <div>
            <h3 className="font-medium">Mapeamento das colunas</h3>
            <p className="text-sm text-muted-foreground">
              Confirme qual coluna do arquivo corresponde a cada campo do app (as três primeiras linhas aparecem como prévia). Colunas marcadas como "Ignorar" não são importadas.
              {entity === "anamnese" && " As colunas cujo cabeçalho é o código de uma pergunta do app são associadas sozinhas — o texto e as opções da pergunta vêm do cadastro do app."}
            </p>
            {codigosForaDoApp.length > 0 && (
              <p className="text-sm text-amber-700 flex items-start gap-1 mt-1">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {`Código(s) não cadastrado(s) no app: ${codigosForaDoApp.join(", ")}. Essas colunas ficam como "Ignorar" — use o mesmo código do catálogo de perguntas para importar a resposta.`}
                </span>
              </p>
            )}
          </div>
          <MappingTable
            headers={headers}
            rows={rows}
            fields={fields}
            mapping={mapping}
            onMappingChange={(idx, key) => setMapping((m) => ({ ...m, [idx]: key }))}
          />
          {!analise && (
            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={importar} disabled={importando}>
                {importando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Analisar e importar {rows.length} {entity === "cliente" ? "cliente(s)" : entity === "avaliacao" ? "avaliação(ões)" : "anamnese(s)"}
              </Button>
              {erro && (
                <span className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />{erro}
                </span>
              )}
            </div>
          )}
        </Card>
      )}

      {importando && feitas > 0 && total > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Importando… {Math.min(feitas, total)} de {total}
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.round((feitas / total) * 100))}%` }} />
          </div>
        </Card>
      )}

      {analise && (
        <Card className="p-4 space-y-4 border-amber-200 bg-amber-50/40">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-medium">
                {analise.conflitos.length} registro(s) divergente(s) com o que já existe no app
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {analise.prontos.length} novo(s) e {analise.identicos} idêntico(s) já identificados. Para cada divergência abaixo, escolha substituir os dados do app pelos da planilha ou manter como estão, e depois conclua a importação.
            </p>
          </div>
          <ConflictList
            conflitos={analise.conflitos}
            escolhas={escolhas}
            onEscolha={(i, v) => setEscolhas((e) => ({ ...e, [i]: v }))}
            getTitulo={getTitulo}
          />
          <Button onClick={concluir} disabled={importando}>
            {importando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Concluir importação
          </Button>
        </Card>
      )}

      {resultado && (
        <Card className="p-4 flex items-start gap-2 text-sm">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Importação concluída.</p>
            <p className="text-muted-foreground">
              {resultado.criados} novo(s) criado(s)
              {resultado.respostas > 0 && ` (${resultado.respostas} resposta(s) de perguntas)`}
              {resultado.atualizados > 0 && `, ${resultado.atualizados} substituído(s)`}
              {resultado.mantidos > 0 && `, ${resultado.mantidos} mantido(s) como no app`}
              {resultado.identicos > 0 && `, ${resultado.identicos} idêntico(s) ignorado(s)`}
              {resultado.duplicados > 0 && `, ${resultado.duplicados} duplicado(s) descartado(s)`}
              {resultado.naoEncontrados > 0 && `, ${resultado.naoEncontrados} com ID de cliente não encontrado`}
              {resultado.invalidos > 0 && `, ${resultado.invalidos} linha(s) sem dados obrigatórios`}
              .
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}