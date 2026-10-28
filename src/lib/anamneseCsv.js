import { base44 } from "@/api/base44Client";
import { carregarTudo } from "@/lib/carregarTudo";
import { downloadCSV, normalizeKey, parseCSV } from "@/lib/csv";

// Uma linha por pergunta: o token da anamnese e o código da pergunta são as
// chaves estáveis usadas para reimportar as respostas no lugar certo.
export const COLUNAS_RESPOSTAS = [
  "Token da anamnese",
  "Cliente",
  "Data da anamnese",
  "Código da pergunta",
  "Categoria",
  "Texto da pergunta",
  "Resposta",
  "Respondida em",
];

const COLUNAS_IMPORT = {
  tokendaanamnese: "token",
  token: "token",
  anamnesetoken: "token",
  codigodapergunta: "pergunta",
  codigopergunta: "pergunta",
  resposta: "resposta",
};

const dataISO = (v) => String(v ?? "").trim().slice(0, 10);
const codigoNormalizado = (v) => String(v ?? "").trim().toUpperCase();

export async function baixarRespostasCSV() {
  const anamneses = await carregarTudo("Anamnese", "-created_date");
  const linhas = [];
  anamneses.forEach((a) => {
    (a.perguntas || []).forEach((p) => {
      linhas.push({
        "Token da anamnese": a.token || "",
        Cliente: a.nome || "",
        "Data da anamnese": dataISO(a.data),
        "Código da pergunta": p.codigo || "",
        Categoria: p.categoria || "",
        "Texto da pergunta": p.pergunta || "",
        Resposta: p.resposta || "",
        "Respondida em": a.respondida_em ? dataISO(a.respondida_em) : "",
      });
    });
  });
  downloadCSV(`respostas-anamnese-${new Date().toISOString().slice(0, 10)}.csv`, COLUNAS_RESPOSTAS, linhas);
  return { linhas: linhas.length, anamneses: anamneses.length };
}

export async function importarRespostasCSV(texto) {
  const { headers, rows } = parseCSV(texto);
  const mapa = {};
  headers.forEach((h, i) => {
    const chave = COLUNAS_IMPORT[normalizeKey(h)];
    if (chave) mapa[chave] = i;
  });
  if (mapa.token == null || mapa.pergunta == null) {
    throw new Error("O arquivo precisa ter as colunas \"Token da anamnese\" e \"Código da pergunta\".");
  }

  const anamneses = await carregarTudo("Anamnese", "-created_date");
  const porToken = new Map(
    anamneses.filter((a) => a.token).map((a) => [String(a.token).trim(), a])
  );

  const alvos = new Map();
  let respostas = 0;
  let ignoradas = 0;

  rows.forEach((linha) => {
    const token = String(linha[mapa.token] ?? "").trim();
    const codigo = codigoNormalizado(linha[mapa.pergunta]);
    const resposta = String(linha[mapa.resposta] ?? "").trim();
    const anamnese = porToken.get(token);
    const pergunta = anamnese
      ? (anamnese.perguntas || []).find((p) => codigoNormalizado(p.codigo) === codigo)
      : null;
    if (!anamnese || !pergunta || !resposta) {
      ignoradas += 1;
      return;
    }
    const item = alvos.get(anamnese.id) || { anamnese, respostas: new Map() };
    item.respostas.set(codigo, resposta);
    alvos.set(anamnese.id, item);
    respostas += 1;
  });

  let atualizadas = 0;
  for (const { anamnese, respostas: novas } of alvos.values()) {
    const perguntas = (anamnese.perguntas || []).map((p) => {
      const codigo = codigoNormalizado(p.codigo);
      return novas.has(codigo) ? { ...p, resposta: novas.get(codigo) } : p;
    });
    const completa = perguntas.length > 0 && perguntas.every((p) => String(p.resposta || "").trim());
    await base44.entities.Anamnese.update(anamnese.id, {
      perguntas,
      status: completa ? "respondida" : anamnese.status,
      respondida_em: completa ? (anamnese.respondida_em || new Date().toISOString()) : anamnese.respondida_em || null,
    });
    atualizadas += 1;
  }

  return { atualizadas, respostas, ignoradas };
}