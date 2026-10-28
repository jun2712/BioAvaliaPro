// Calculadora avançada de meta proteica (2026).
// Cruza nível de atividade, objetivo de composição corporal e fatores de risco
// clínico (idade avançada e uso de GLP-1) para definir o fator em g/kg.

export const NIVEIS_ATIVIDADE = ['sedentario', 'leve', 'moderado', 'intenso'];
export const OBJETIVOS = ['bem_estar', 'ganho_massa', 'emagrecimento'];
export const SEXOS = ['Feminino', 'Masculino'];

// Códigos das perguntas do grupo "Meta Proteica" na anamnese
export const CODIGOS_META_PROTEICA = {
  sexo: '701',
  idade: '702',
  peso: '703',
  altura: '704',
  atividade: '705',
  objetivo: '706',
  glp1: '707',
};

export const ORIENTACAO_LEUCINA =
  'Alvo de 2,5 g a 3,0 g de leucina por refeição (ativador do ganho e da manutenção muscular).';
export const ORIENTACAO_FONTES =
  'Carnes, ovos, peixes, laticínios, whey protein ou suplementos concentrados como o Protein Complete.';

export const ROTULO_OBJETIVO: Record<string, string> = {
  bem_estar: 'Manutenção / bem-estar',
  ganho_massa: 'Ganho de massa muscular',
  emagrecimento: 'Emagrecimento',
};

const MATRIZ_FATORES: Record<string, Record<string, number>> = {
  ganho_massa: { sedentario: 1.2, leve: 1.5, moderado: 1.8, intenso: 2.2 },
  emagrecimento: { sedentario: 1.4, leve: 1.6, moderado: 2.0, intenso: 2.4 },
  bem_estar: { sedentario: 0.8, leve: 1.2, moderado: 1.6, intenso: 1.8 },
};

export function calcularMetaProteica(dados: any) {
  const peso = Number(dados?.peso);
  const idade = Number(dados?.idade) || 0;
  const nivel = String(dados?.nivelAtividade || '');
  const objetivo = String(dados?.objetivo || 'bem_estar') === 'perda_peso'
    ? 'emagrecimento'
    : String(dados?.objetivo || 'bem_estar');
  const usaGLP1 = dados?.usaGLP1 === true;

  if (!Number.isFinite(peso) || peso <= 0) throw new Error('Peso inválido');

  const matriz = MATRIZ_FATORES[objetivo] || MATRIZ_FATORES.bem_estar;
  let fator = matriz[nivel] ?? matriz.bem_estar;

  // Trava de segurança por idade (PROT-AGE / ESPEN): 65+ nunca abaixo de 1,2 g/kg
  if (idade >= 65 && fator < 1.2) fator = 1.2;

  // Trava de segurança por uso de GLP-1 (risco de sarcopenia)
  if (usaGLP1 && fator < 1.4) fator = 1.4;

  fator = Math.max(0.8, Math.min(parseFloat(fator.toFixed(1)), 2.4));

  const gramas_dia = Math.round(peso * fator);
  const refeicao_min = Math.round(peso * 0.3);
  const refeicao_max = Math.round(peso * 0.4);
  const refeicoes = Math.max(3, Math.ceil(gramas_dia / Math.max(refeicao_max, 1)));

  return { fator, gramas_dia, refeicao_min, refeicao_max, refeicoes };
}

const normalizar = (s: any) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const numero = (v: any) => {
  const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export function mapearAtividade(texto: any) {
  const n = normalizar(texto);
  if (n.startsWith('sedent')) return 'sedentario';
  if (n.startsWith('leve')) return 'leve';
  if (n.startsWith('moder')) return 'moderado';
  if (n.startsWith('intens')) return 'intenso';
  return null;
}

export function mapearObjetivo(texto: any) {
  const n = normalizar(texto);
  if (n.includes('emagrec') || n.includes('perda')) return 'emagrecimento';
  if (n.includes('massa') || n.includes('hipertrof')) return 'ganho_massa';
  if (n.includes('manut') || n.includes('bem') || n.includes('saude')) return 'bem_estar';
  return null;
}

export function mapearGlp1(texto: any) {
  const n = normalizar(texto);
  if (!n) return null;
  if (n.startsWith('sim') || n === 's' || n === 'true' || n === '1') return true;
  if (n.startsWith('nao') || n === 'n' || n === 'false' || n === '0') return false;
  return null;
}

// Lê as respostas do grupo "Meta Proteica" e devolve os dados prontos para o cálculo.
// Retorna null quando falta alguma informação obrigatória.
export function extrairDadosMetaProteica(respostas: Record<string, any>) {
  if (!respostas || typeof respostas !== 'object') return null;
  const c = CODIGOS_META_PROTEICA;
  const peso = numero(respostas[c.peso]);
  const idade = numero(respostas[c.idade]);
  const altura = numero(respostas[c.altura]);
  const sexo = String(respostas[c.sexo] || '').trim();
  const nivelAtividade = mapearAtividade(respostas[c.atividade]);
  const objetivo = mapearObjetivo(respostas[c.objetivo]);
  const usaGLP1 = mapearGlp1(respostas[c.glp1]);

  if (peso == null || peso < 25 || peso > 300) return null;
  if (idade == null || idade < 12 || idade > 110) return null;
  if (altura == null || altura < 100 || altura > 250) return null;
  if (!SEXOS.includes(sexo)) return null;
  if (!nivelAtividade || !objetivo || usaGLP1 === null) return null;

  return { peso, idade, altura, sexo, nivelAtividade, objetivo, usaGLP1 };
}