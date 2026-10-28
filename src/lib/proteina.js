// Opções e rótulos do formulário público de meta proteica.
// Fatores aplicados no backend compartilhado — aqui só a apresentação.

export const NIVEL_ATIVIDADE = [
  { value: "sedentario", label: "Sedentário", detalhe: "Sem treinos ou apenas caminhadas ocasionais" },
  { value: "leve", label: "Leve", detalhe: "1 a 2 vezes por semana — corrida, ciclismo, esportes" },
  { value: "moderado", label: "Moderado", detalhe: "3 a 4 vezes por semana — musculação, força" },
  { value: "intenso", label: "Intenso", detalhe: "5 vezes ou mais por semana / atleta" },
];

export const OBJETIVO = [
  { value: "bem_estar", label: "Manutenção / bem-estar", detalhe: "Manter o peso e a saúde" },
  { value: "ganho_massa", label: "Ganho de massa muscular", detalhe: "Hipertrofia e força" },
  { value: "emagrecimento", label: "Emagrecimento", detalhe: "Reduzir gordura preservando massa magra" },
];

export const SEXO = [
  { value: "Feminino", label: "Feminino", detalhe: "" },
  { value: "Masculino", label: "Masculino", detalhe: "" },
];

export const USA_GLP1 = [
  { value: "nao", label: "Não", detalhe: "Não uso medicação GLP-1" },
  { value: "sim", label: "Sim", detalhe: "Uso Ozempic, Mounjaro e similares" },
];

// Códigos das perguntas do grupo "Meta Proteica" na anamnese
export const CODIGOS_META_PROTEICA = {
  sexo: "701",
  idade: "702",
  peso: "703",
  altura: "704",
  atividade: "705",
  objetivo: "706",
  glp1: "707",
};

export const ORIENTACAO_LEUCINA =
  "Alvo de 2,5 g a 3,0 g de leucina por refeição (ativador do ganho e da manutenção muscular).";
export const ORIENTACAO_FONTES =
  "Carnes, ovos, peixes, laticínios, whey protein ou suplementos concentrados como o Protein Complete.";

// Mantém a leitura de registros antigos salvos como "perda_peso"
const ALIAS = { perda_peso: "emagrecimento" };

export const rotuloOpcao = (opcoes, valor) =>
  opcoes.find((o) => o.value === (ALIAS[valor] || valor))?.label || "—";

// Token do link público (hex), no mesmo formato usado pela anamnese.
export function novoToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const formatarFator = (fator) =>
  fator == null ? "—" : `${String(Number(fator).toFixed(1)).replace(".", ",")} g/kg`;

export const faixaRefeicao = (resultado) =>
  resultado?.refeicao_min != null && resultado?.refeicao_max != null
    ? `${resultado.refeicao_min} g a ${resultado.refeicao_max} g`
    : "—";