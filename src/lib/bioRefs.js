import { parseDataLocal } from "./datas";

// Faixas de referência para índices de bioimpedância e composição corporal.
// Tabela de % de músculo esquelético: Fonte Omron Healthcare (imagem anexa).
// Tabela de % de gordura corporal: diretrizes NIH/OMS — Gallagher et al., Am J Clin Nutr, 2000 (imagem anexa).
// RCQ: classificação por sexo e faixa etária (20-69 anos), conforme tabela de referência anexa.
// Avatar corporal: escala de 8 níveis, definida pelo % de gordura (faixas por sexo) com fallback para IMC.
// Demais índices: padrões biológicos consagrados (OMS / literatura).

const fmt1 = (n) => String(n).replace(".", ",");
const fmt2 = (n) => Number(n).toFixed(2).replace(".", ",");
const round1 = (x) => Math.round(x * 10) / 10;

// Retorna a linha da tabela de % de músculo esquelético conforme sexo e idade.
function getMusculoLinha(sexo, idade) {
  const faixas = {
    Feminino: [
      { min: 18, max: 39, baixo: 24.3, normal: 30.3, alto: 35.3 },
      { min: 40, max: 59, baixo: 24.1, normal: 30.1, alto: 35.1 },
      { min: 60, max: 80, baixo: 23.9, normal: 29.9, alto: 34.9 },
    ],
    Masculino: [
      { min: 18, max: 39, baixo: 33.3, normal: 39.3, alto: 44.0 },
      { min: 40, max: 59, baixo: 33.1, normal: 39.1, alto: 43.8 },
      { min: 60, max: 80, baixo: 32.9, normal: 38.9, alto: 43.6 },
    ],
  };

  const tabela = faixas[sexo] || faixas.Masculino;
  return tabela.find((l) => idade >= l.min && idade <= l.max) || tabela[0];
}

// Retorna a faixa de % de músculo esquelético conforme sexo e idade.
export function getMusculoFaixa(sexo, idade, valor) {
  const linha = getMusculoLinha(sexo, idade);
  let label = "—";
  let faixaTexto = "";
  if (valor == null || isNaN(valor)) {
    faixaTexto = `Normal: ${fmt1(linha.baixo)} – ${fmt1(linha.normal)}%`;
  } else if (valor < linha.baixo) {
    label = "Baixo (-)";
    faixaTexto = `< ${fmt1(linha.baixo)}%`;
  } else if (valor <= linha.normal) {
    label = "Normal (0)";
    faixaTexto = `${fmt1(linha.baixo)} – ${fmt1(linha.normal)}%`;
  } else if (valor <= linha.alto) {
    label = "Alto (+)";
    faixaTexto = `${fmt1(linha.normal + 0.1)} – ${fmt1(linha.alto)}%`;
  } else {
    label = "Muito alto (++)";
    faixaTexto = `≥ ${fmt1(linha.alto + 0.1)}%`;
  }
  return { label, faixaTexto, referencia: `Normal: ${fmt1(linha.baixo)} – ${fmt1(linha.normal)}%` };
}

// Gordura corporal (%) — faixas por sexo e faixa etária (adultos).
const GORDURA_TABELA = {
  Feminino: [
    { min: 18, max: 39, baixo: 21.0, normal: 32.9, alto: 38.9 },
    { min: 40, max: 59, baixo: 23.0, normal: 33.9, alto: 39.9 },
    { min: 60, max: 80, baixo: 24.0, normal: 35.9, alto: 41.9 },
  ],
  Masculino: [
    { min: 18, max: 39, baixo: 8.0, normal: 19.9, alto: 24.9 },
    { min: 40, max: 59, baixo: 11.0, normal: 21.9, alto: 27.9 },
    { min: 60, max: 80, baixo: 13.0, normal: 24.9, alto: 29.9 },
  ],
};

function getGorduraRef(sexo, idade) {
  const tabela = GORDURA_TABELA[sexo] || GORDURA_TABELA.Masculino;
  return (idade != null && tabela.find((l) => idade >= l.min && idade <= l.max)) || tabela[0];
}

export function getGorduraFaixa(sexo, idade, valor) {
  const ref = getGorduraRef(sexo, idade);
  const refTexto = `Normal: ${fmt1(ref.baixo)} – ${fmt1(ref.normal)}%`;
  if (valor == null || isNaN(valor)) return { label: "—", faixaTexto: refTexto, referencia: refTexto };
  let label;
  if (valor < ref.baixo) label = "Baixo (-)";
  else if (valor <= ref.normal) label = "Normal (0)";
  else if (valor <= ref.alto) label = "Alto (+)";
  else label = "Muito alto (++)";
  return { label, faixaTexto: "", referencia: refTexto };
}

// --- Gordura por medidas (U.S. Navy) ---
// Classificação pelas categorias da tabela ACE (American Council on Exercise).
const NAVY_ACE = {
  Feminino: [
    { label: "Gordura Essencial", max: 13, texto: "10% a 13%" },
    { label: "Atletas", max: 20, texto: "14% a 20%" },
    { label: "Boa Forma", max: 24, texto: "21% a 24%" },
    { label: "Média (Saudável)", max: 31, texto: "25% a 31%" },
    { label: "Obesidade", max: Infinity, texto: "32% ou mais" },
  ],
  Masculino: [
    { label: "Gordura Essencial", max: 5, texto: "2% a 5%" },
    { label: "Atletas", max: 13, texto: "6% a 13%" },
    { label: "Boa Forma", max: 17, texto: "14% a 17%" },
    { label: "Média (Saudável)", max: 24, texto: "18% a 24%" },
    { label: "Obesidade", max: Infinity, texto: "25% ou mais" },
  ],
};

// Categoria ACE do percentual de gordura estimado por medidas, por sexo.
export function getNavyFaixa(sexo, valor) {
  const tabela = NAVY_ACE[sexo] || NAVY_ACE.Masculino;
  if (valor == null || isNaN(valor)) return { label: "—", faixaTexto: "", referencia: "Tabela ACE" };
  const linha = tabela.find((l) => valor <= l.max) || tabela[tabela.length - 1];
  return { label: linha.label, faixaTexto: "", referencia: `ACE: ${linha.texto}` };
}

// IMC (OMS): Baixo <18,5 | Normal 18,5–24,9 | Sobrepeso 25–29,9 | Obesidade ≥30
export function getImcFaixa(valor) {
  if (valor == null || isNaN(valor)) return { label: "—", faixaTexto: "Normal: 18,5 – 24,9", referencia: "Normal: 18,5 – 24,9" };
  let label;
  if (valor < 18.5) label = "Baixo (-)";
  else if (valor <= 24.9) label = "Normal (0)";
  else if (valor <= 29.9) label = "Alto (+)";
  else label = "Muito alto (++)";
  return { label, faixaTexto: label === "Normal (0)" ? "18,5 – 24,9" : "", referencia: "Normal: 18,5 – 24,9" };
}

// Gordura visceral (nível 1–59): Normal 1–9 | Alto 10–14 | Muito alto ≥15
export function getVisceralFaixa(valor) {
  if (valor == null || isNaN(valor)) return { label: "—", faixaTexto: "Normal: 1 – 9", referencia: "Normal: 1 – 9" };
  let label;
  if (valor <= 9) label = "Normal (0)";
  else if (valor <= 14) label = "Alto (+)";
  else label = "Muito alto (++)";
  return { label, faixaTexto: "", referencia: "Normal: 1 – 9" };
}

// Metabolismo basal — estimativa pela fórmula de Mifflin-St Jeor (altura em cm).
export function getMetabolismoRef(sexo, idade, peso, alturaCm) {
  if (!peso || !alturaCm) return { label: "—", faixaTexto: "", referencia: "Varia por composição corporal" };
  const s = sexo === "Feminino" ? -161 : 5;
  const estimado = 10 * peso + 6.25 * alturaCm - 5 * (idade || 30) + s;
  return { label: `Ref. ≈ ${Math.round(estimado)} kcal`, faixaTexto: "", referencia: `Estimado: ≈ ${Math.round(estimado)} kcal` };
}

// IMC a partir da altura em centímetros.
export function calcularImc(peso, alturaCm) {
  if (!peso || !alturaCm) return null;
  const m = alturaCm / 100;
  return Math.round((peso / (m * m)) * 100) / 100;
}

export function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const nasc = parseDataLocal(dataNascimento);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

// --- Relação Cintura-Quadril (RCQ) ---
// Tabela de classificação por sexo e faixa etária (imagem de referência anexa).
const RCQ_TABELA = {
  Masculino: [
    { min: 20, max: 29, baixo: 0.83, moderado: 0.88, alto: 0.94 },
    { min: 30, max: 39, baixo: 0.84, moderado: 0.91, alto: 0.96 },
    { min: 40, max: 49, baixo: 0.88, moderado: 0.95, alto: 1.00 },
    { min: 50, max: 59, baixo: 0.90, moderado: 0.96, alto: 1.02 },
    { min: 60, max: 69, baixo: 0.91, moderado: 0.98, alto: 1.03 },
  ],
  Feminino: [
    { min: 20, max: 29, baixo: 0.71, moderado: 0.77, alto: 0.82 },
    { min: 30, max: 39, baixo: 0.72, moderado: 0.78, alto: 0.84 },
    { min: 40, max: 49, baixo: 0.73, moderado: 0.79, alto: 0.87 },
    { min: 50, max: 59, baixo: 0.74, moderado: 0.81, alto: 0.88 },
    { min: 60, max: 69, baixo: 0.76, moderado: 0.83, alto: 0.90 },
  ],
};

export function calcularRcq(cintura, quadril) {
  if (!cintura || !quadril) return null;
  return Math.round((cintura / quadril) * 100) / 100;
}

// Classifica a RCQ em Baixo / Moderado / Alto / Muito Alto conforme sexo e idade.
export function classificarRcq(sexo, idade, rcq) {
  const tabela = RCQ_TABELA[sexo] || RCQ_TABELA.Masculino;
  const i = idade != null ? idade : 30;
  const linha = i < 20 ? tabela[0]
    : i > 69 ? tabela[4]
    : (tabela.find((l) => i >= l.min && i <= l.max) || tabela[0]);
  const ref = `Baixo < ${fmt2(linha.baixo)} · Moderado ≤ ${fmt2(linha.moderado)} · Alto ≤ ${fmt2(linha.alto)} · Muito alto > ${fmt2(linha.alto)}`;
  if (rcq == null || isNaN(rcq)) return { label: "—", faixaTexto: "", referencia: ref };
  let label;
  if (rcq < linha.baixo) label = "Baixo (-)";
  else if (rcq <= linha.moderado) label = "Moderado (+)";
  else if (rcq <= linha.alto) label = "Alto (++)";
  else label = "Muito alto (+++)";
  return { label, faixaTexto: "", referencia: ref };
}

// --- Massa corporal em kg e metas ---
// Calcula músculo e gordura em kg (% x peso) e quantos kg ganhar/reduzir
// para entrar na faixa de referência (músculo: Omron; gordura: OMS/sexo).
export function getMetasComposicao(sexo, idade, avaliacao) {
  const peso = avaliacao?.peso;
  const musculo = avaliacao?.musculo;
  const gordura = avaliacao?.gordura_corporal;
  const musculoKg = musculo != null && peso ? round1((musculo * peso) / 100) : null;
  const gorduraKg = gordura != null && peso ? round1((gordura * peso) / 100) : null;

  const linhaM = getMusculoLinha(sexo, idade);
  const refG = getGorduraRef(sexo, idade);
  const ganharMusculoKg = musculo != null && peso && musculo < linhaM.baixo
    ? round1(((linhaM.baixo - musculo) * peso) / 100) : 0;
  const reduzirGorduraKg = gordura != null && peso && gordura > refG.normal
    ? round1(((gordura - refG.normal) * peso) / 100) : 0;

  return {
    musculoKg,
    gorduraKg,
    ganharMusculoKg,
    reduzirGorduraKg,
    refMusculo: `Normal: ${fmt1(linhaM.baixo)} – ${fmt1(linhaM.normal)}%`,
    refGordura: `Normal: ${fmt1(refG.baixo)} – ${fmt1(refG.normal)}%`,
  };
}

// --- Avatar corporal (escala de 8 níveis) ---
export const AVATAR_LABELS = ["Abaixo", "Normal", "Acima 1", "Acima 2", "Acima 3", "Alto 1", "Alto 2", "Alto 3"];
const AVATAR_LIM_GORDURA = {
  Feminino: [15, 25, 30, 35, 40, 45, 50],
  Masculino: [6, 18, 22, 25, 30, 35, 40],
};
const AVATAR_LIM_IMC = [18.5, 25, 26.7, 28.4, 30, 35, 40];

// Nível do avatar: % de gordura corporal (faixas por sexo); fallback IMC sem bioimpedância.
export function getAvatarNivel(sexo, gordura, imc) {
  if (gordura != null && !isNaN(gordura)) {
    const lim = AVATAR_LIM_GORDURA[sexo] || AVATAR_LIM_GORDURA.Masculino;
    const idx = lim.findIndex((l) => gordura < l);
    const indice = idx === -1 ? 7 : idx;
    return { indice, label: AVATAR_LABELS[indice], metrica: "% de gordura corporal" };
  }
  if (imc != null && !isNaN(imc)) {
    const idx = AVATAR_LIM_IMC.findIndex((l) => imc < l);
    const indice = idx === -1 ? 7 : idx;
    return { indice, label: AVATAR_LABELS[indice], metrica: "IMC" };
  }
  return { indice: null, label: "—", metrica: "" };
}

export const LABEL_COLOR = {
  "Baixo (-)": "text-blue-600 bg-blue-50 border-blue-200",
  "Normal (0)": "text-emerald-600 bg-emerald-50 border-emerald-200",
  "Alto (+)": "text-amber-600 bg-amber-50 border-amber-200",
  "Muito alto (++)": "text-red-600 bg-red-50 border-red-200",
  "Moderado (+)": "text-amber-600 bg-amber-50 border-amber-200",
  "Alto (++)": "text-orange-600 bg-orange-50 border-orange-200",
  "Muito alto (+++)": "text-red-600 bg-red-50 border-red-200",
  "Gordura Essencial": "text-blue-600 bg-blue-50 border-blue-200",
  "Atletas": "text-emerald-600 bg-emerald-50 border-emerald-200",
  "Boa Forma": "text-emerald-600 bg-emerald-50 border-emerald-200",
  "Média (Saudável)": "text-teal-600 bg-teal-50 border-teal-200",
  "Obesidade": "text-red-600 bg-red-50 border-red-200",
};

// Explicação de cada índice da balança (pop-up ao passar o cursor sobre o índice).
export const EXPLICACOES = {
  peso: "Peso corporal total do cliente, resultado da massa de músculos, ossos, água e gordura.",
  gordura_corporal: "Percentual de gordura no corpo em relação ao peso total. A faixa de referência varia por sexo e faixa etária.",
  musculo: "Percentual de massa muscular esquelética em relação ao peso total, com faixa de referência por sexo e idade.",
  gordura_visceral: "Gordura acumulada ao redor dos órgãos internos (região abdominal). Nível 1–9 é saudável; a partir de 10 merece atenção.",
  metabolismo_basal: "Energia (kcal) que o corpo gasta em repouso para manter as funções vitais. Serve de base para o plano alimentar.",
  idade_corporal: "Idade metabólica estimada pela balança a partir da composição corporal. O ideal é estar igual ou menor que a idade real.",
  imc: "Índice de Massa Corporal: peso ÷ altura². Indica se o peso está adequado para a altura.",
  altura: "Estatura medida nesta avaliação; ao salvar, passa a ser a altura de referência do cadastro.",
};