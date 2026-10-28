import { ANAMNESE_FIELDS, normalizeKey } from "@/lib/csv";
import { PERGUNTAS_ANAMNESE } from "@/lib/anamneseBank";

// Cada coluna de resposta recebe a chave "q:<código>", sempre no mesmo formato
// do catálogo do app (101, 003, 419), para a resposta cair na pergunta certa.
export const PREFIXO_PERGUNTA = "q:";

export const codigoPergunta = (v) => {
  const c = String(v ?? "").trim();
  if (/^\d+$/.test(c)) return c.padStart(3, "0");
  return c.toUpperCase();
};

export const CATALOGO_PERGUNTAS = new Map(
  PERGUNTAS_ANAMNESE.map((p) => [codigoPergunta(p.codigo), p])
);

export const codigoDaChave = (key) =>
  key && String(key).startsWith(PREFIXO_PERGUNTA) ? String(key).slice(PREFIXO_PERGUNTA.length) : null;

const resumo = (texto, max = 60) => {
  const s = String(texto ?? "").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

const ordenar = (a, b) => a.localeCompare(b, "pt-BR", { numeric: true });

// Campos fixos da anamnese + uma opção para cada código do catálogo
export function camposAnamnese() {
  const perguntas = [...CATALOGO_PERGUNTAS.entries()]
    .sort((a, b) => ordenar(a[0], b[0]))
    .map(([codigo, p]) => ({
      key: PREFIXO_PERGUNTA + codigo,
      label: `Resposta ${codigo} — ${resumo(p.pergunta)}`,
      aliases: [normalizeKey(codigo)],
      codigo,
    }));
  return [...ANAMNESE_FIELDS, ...perguntas];
}

// Cabeçalhos numéricos que não existem no catálogo do app
export function codigosDesconhecidos(headers) {
  return headers
    .map((h) => String(h ?? "").trim())
    .filter((h) => /^\d{1,4}$/.test(h) && !CATALOGO_PERGUNTAS.has(codigoPergunta(h)));
}