const DELIMITER = ";";

// Remove acentos, pontuação e espaços para comparar nomes de colunas
export function normalizeKey(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Converte um número no padrão brasileiro ("1.234,56" ou "80,5") para Number
export function parseNumberBR(v) {
  let s = String(v ?? "").trim();
  if (!s) return null;
  // Remove indicador de porcentagem ou unidade no fim do valor (ex.: "34,5%", "80,5 kg")
  s = s.replace(/%\s*$/, "").replace(/\s*(kg|cm|kcal|anos?)\s*$/i, "").trim();
  if (!s) return null;
  let t = s;
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d+$/.test(t)) t = t.replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Aceita "2025-03-14" ou "14/03/2025" e devolve "2025-03-14"
export function parseDateCSV(v) {
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

// Chave de correspondência entre registros: apenas os dígitos do WhatsApp
export function normalizeWhatsapp(v) {
  return String(v ?? "").replace(/\D/g, "");
}

// Compara dois valores considerando nulos/vazios iguais e números equivalentes
export function valoresIguais(a, b) {
  const na = a == null || a === "" ? null : a;
  const nb = b == null || b === "" ? null : b;
  if (na == null && nb == null) return true;
  if (na == null || nb == null) return false;
  if (typeof na === "number" || typeof nb === "number") return Number(na) === Number(nb);
  return String(na).trim() === String(nb).trim();
}

export function normalizeSexo(v) {
  const k = normalizeKey(v);
  if (["m", "masculino", "masc", "homem", "h"].includes(k)) return "Masculino";
  if (["f", "feminino", "fem", "mulher"].includes(k)) return "Feminino";
  return null;
}

// Campos disponíveis para mapeamento na importação
export const CLIENTE_FIELDS = [
  { key: "codigo", label: "ID do cliente", type: "text", required: true, aliases: ["iddocliente", "idcliente", "id", "codigodocliente", "codigo"] },
  { key: "nome", label: "Nome completo", type: "text", required: true, aliases: ["nome", "nomecompleto", "cliente"] },
  { key: "email", label: "E-mail", type: "text", aliases: ["email", "emaildocliente", "correioeletronico", "correio"] },
  { key: "notas", label: "Notas do cliente", type: "text", aliases: ["notasdocliente", "notascliente", "notas", "anotacoes", "observacoesdocliente", "observacoes"] },
  { key: "whatsapp", label: "WhatsApp", type: "text", aliases: ["whatsapp", "telefone", "celular", "fone"] },
  { key: "data_nascimento", label: "Data de nascimento", type: "date", aliases: ["datadenascimento", "nascimento", "dtnascimento", "nasc"] },
  { key: "sexo", label: "Sexo", type: "select", aliases: ["sexo", "genero"] },
  { key: "altura", label: "Altura (cm)", type: "number", aliases: ["alturacm", "altura", "estatura"] },
  { key: "grupo", label: "Grupo", type: "text", aliases: ["grupo"] },
  { key: "coach", label: "Coach", type: "text", aliases: ["coach", "coachresponsavel"] },
];

// Anamneses: vinculadas exclusivamente pelo ID interno do cliente e data.
export const ANAMNESE_FIELDS = [
  { key: "_cliente_codigo", label: "ID do cliente", type: "text", required: true, aliases: ["iddocliente", "idcliente", "id", "codigodocliente", "codigo"] },
  { key: "data", label: "Data da anamnese", type: "date", required: true, aliases: ["datadaanamnese", "dataanamnese", "data"] },
  { key: "nome", label: "Nome do cliente", type: "text", aliases: ["nome", "nomecliente", "nomecompleto", "cliente"] },
  { key: "whatsapp", label: "WhatsApp", type: "text", aliases: ["whatsapp", "telefone", "celular", "fone"] },
  { key: "status", label: "Status", type: "text", aliases: ["status", "situacao"] },
  { key: "respondida_em", label: "Data da resposta", type: "date", aliases: ["datadaresposta", "dataresposta", "respondidaem"] },
];

export const AVALIACAO_FIELDS = [
  { key: "_cliente_codigo", label: "ID do cliente", type: "text", required: true, aliases: ["iddocliente", "idcliente", "id", "codigodocliente", "codigo"] },
  { key: "_cliente_nome", label: "Cliente (nome)", type: "text", aliases: ["cliente", "nomecliente", "nome", "nomecompleto"] },
  { key: "data", label: "Data da avaliação", type: "date", required: true, aliases: ["datadaavaliacao", "dataavaliacao", "data"] },
  { key: "altura", label: "Altura (cm)", type: "number", aliases: ["alturacm", "altura", "estatura"] },
  { key: "pescoco", label: "Pescoço (cm)", type: "number", aliases: ["pescococm", "pescoco", "neck"] },
  { key: "antebraco_direito", label: "Antebraço direito (cm)", type: "number", aliases: ["antebracodireitocm", "antebracodireito", "antebracod"] },
  { key: "antebraco_esquerdo", label: "Antebraço esquerdo (cm)", type: "number", aliases: ["antebracoesquerdocm", "antebracoesquerdo", "antebracoe"] },
  { key: "femur", label: "Fêmur (cm)", type: "number", aliases: ["femurcm", "femur"] },
  { key: "peso", label: "Peso (kg)", type: "number", aliases: ["pesokg", "peso"] },
  { key: "musculo", label: "Músculo (%)", type: "number", aliases: ["musculo", "musculop", "percentualmusculo", "percentualdemusculo", "massamuscular", "musc"] },
  { key: "idade_corporal", label: "Idade corporal (anos)", type: "number", aliases: ["idadecorporal", "idadecorporalanos"] },
  { key: "imc", label: "IMC", type: "number", aliases: ["imc"] },
  { key: "gordura_corporal", label: "Gordura corporal (%)", type: "number", aliases: ["gorduracorporal", "gorduracorporalp", "gordura", "percentualgordura", "percentualdegordura", "taxagordura", "taxadegordura"] },
  { key: "gordura_visceral", label: "Gordura visceral (nível)", type: "number", aliases: ["gorduravisceral", "gorduravisceralnivel"] },
  { key: "metabolismo_basal", label: "Metabolismo basal (kcal)", type: "number", aliases: ["metabolismobasal", "metabolismobasalkcal"] },
  { key: "torax", label: "Tórax (cm)", type: "number", aliases: ["toraxcm", "torax"] },
  { key: "braco_direito", label: "Braço direito (cm)", type: "number", aliases: ["bracodireitocm", "bracodireito"] },
  { key: "braco_esquerdo", label: "Braço esquerdo (cm)", type: "number", aliases: ["bracoesquerdocm", "bracoesquerdo"] },
  { key: "cintura", label: "Cintura (cm)", type: "number", aliases: ["cinturacm", "cintura"] },
  { key: "abdome", label: "Abdome (cm)", type: "number", aliases: ["abdomecm", "abdome", "abdomencm", "abdomen"] },
  { key: "quadril", label: "Quadril (cm)", type: "number", aliases: ["quadrilcm", "quadril"] },
  { key: "coxa_direita", label: "Coxa direita (cm)", type: "number", aliases: ["coxadireitacm", "coxadireita"] },
  { key: "coxa_esquerda", label: "Coxa esquerda (cm)", type: "number", aliases: ["coxaesquerdacm", "coxaesquerda"] },
  { key: "panturrilha_direita", label: "Panturrilha direita (cm)", type: "number", aliases: ["panturrilhadireitacm", "panturrilhadireita"] },
  { key: "panturrilha_esquerda", label: "Panturrilha esquerda (cm)", type: "number", aliases: ["panturrilhaesquerdacm", "panturrilhaesquerda"] },
  { key: "punho", label: "Punho (cm)", type: "number", aliases: ["punhocm", "punho"] },
  { key: "observacoes_cliente", label: "Observações do cliente", type: "text", aliases: ["observacoesdocliente", "observacoescliente", "observacao"] },
  { key: "notas_profissional", label: "Notas do profissional", type: "text", aliases: ["notasdoprofissional", "notasprofissional", "notas"] },
];

// Sugere automaticamente o mapeamento comparando o cabeçalho com os campos do app
export function autoMapColumns(headers, fields) {
  const mapping = {};
  const usados = new Set();
  headers.forEach((h, idx) => {
    const nk = normalizeKey(h);
    const field = fields.find(
      (f) => !usados.has(f.key) && (f.aliases.includes(nk) || normalizeKey(f.label) === nk)
    );
    if (field) {
      mapping[idx] = field.key;
      usados.add(field.key);
    }
  });
  // Segunda passada: correspondência parcial para cabeçalhos com nomes um pouco diferentes
  headers.forEach((h, idx) => {
    if (mapping[idx]) return;
    const nk = normalizeKey(h);
    if (nk.length < 4) return;
    const field = fields.find(
      (f) => !usados.has(f.key) && f.aliases.some((a) => a.length >= 4 && (nk.includes(a) || a.includes(nk)))
    );
    if (field) {
      mapping[idx] = field.key;
      usados.add(field.key);
    }
  });
  return mapping;
}

// Interpreta o conteúdo CSV (";" como separador, aspas duplas para valores com ";")
export function parseCSV(text) {
  const clean = String(text ?? "").replace(/^\uFEFF/, "");
  const registros = [];
  let linha = [];
  let campo = "";
  let emAspas = false;
  const finalizarCampo = () => { linha.push(campo); campo = ""; };
  const finalizarLinha = () => {
    finalizarCampo();
    if (linha.some((v) => v.trim() !== "")) registros.push(linha);
    linha = [];
  };
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (emAspas) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { campo += '"'; i++; } else emAspas = false;
      } else campo += ch;
    } else if (ch === '"') emAspas = true;
    else if (ch === DELIMITER) finalizarCampo();
    else if (ch === "\n") finalizarLinha();
    else if (ch === "\r") { if (clean[i + 1] === "\n") i++; finalizarLinha(); }
    else campo += ch;
  }
  finalizarLinha();
  if (!registros.length) return { headers: [], rows: [] };
  return { headers: registros[0].map((h) => h.trim()), rows: registros.slice(1) };
}

function escapeField(v) {
  if (v == null) return "";
  // Números exportados na notação decimal do Brasil (vírgula)
  const s = (typeof v === "number" ? String(v).replace(".", ",") : String(v)).replace(/\r?\n/g, " ");
  if (s.includes('"') || s.includes(DELIMITER)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// Gera o texto CSV com BOM (compatível com Excel em português)
export function buildCSV(colunas, linhas) {
  const linhasCSV = [colunas.map(escapeField).join(DELIMITER)];
  for (const linha of linhas) {
    linhasCSV.push(colunas.map((c) => escapeField(linha[c])).join(DELIMITER));
  }
  return "\uFEFF" + linhasCSV.join("\r\n");
}

// Dispara o download de um arquivo CSV no navegador
export function downloadCSV(nomeArquivo, colunas, linhas) {
  const blob = new Blob([buildCSV(colunas, linhas)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Lê o arquivo detectando a codificação: UTF-8 (com ou sem BOM) ou
// Windows-1252/Latin-1, evitando que nomes como "Simão" virem "Sim�o"
// quando a planilha vem do Excel em português.
export async function lerTextoCSV(file) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}