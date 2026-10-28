// Método oficial da Marinha dos EUA (U.S. Navy / Hodgdon-Beckett): composição
// corporal estimada por medidas circunferenciais (fita métrica), sem depender
// da balança de bioimpedância.
//
// A densidade corporal vem das circunferências e da altura:
//   Homens:   d = 1,0324 − 0,19077 · log10(cintura − pescoço) + 0,15456 · log10(altura)
//   Mulheres: d = 1,29579 − 0,35004 · log10(cintura + quadril − pescoço) + 0,22100 · log10(altura)
// O percentual de gordura vem da equação de Siri: %GC = 495 / d − 450.
// (cintura no umbigo para homens; menor circunferência do abdômen para mulheres;
//  o quadril só entra no cálculo feminino. Altura em cm.)

const round1 = (x) => Math.round(x * 10) / 10;

export function camposNavy(sexo) {
  const base = ["altura", "cintura", "pescoco", "peso"];
  return sexo === "Feminino" ? [...base, "quadril"] : base;
}

// Calcula o %GC (equação de Siri) e a divisão de compartimentos quando todos
// os dados necessários existem; caso contrário devolve faltando = [] dos campos.
export function calcularNavy(sexo, altura, peso, cintura, pescoco, quadril) {
  const faltando = camposNavy(sexo).filter((k) => {
    const v = { altura, peso, cintura, pescoco, quadril }[k];
    return v == null || isNaN(Number(v)) || Number(v) <= 0;
  });
  if (faltando.length) return { ok: false, faltando };

  const valores = {
    altura: Number(altura),
    peso: Number(peso),
    cintura: Number(cintura),
    pescoco: Number(pescoco),
    quadril: Number(quadril),
  };
  const log10 = Math.log10;
  const feminino = !/^\s*(masculino|homem|m)\b/i.test(String(sexo || ""));
  const soma = feminino
    ? valores.cintura + valores.quadril - valores.pescoco
    : valores.cintura - valores.pescoco;

  // O argumento do logaritmo precisa ser positivo (ex.: cintura maior que o pescoço)
  if (soma <= 0) return { ok: false, faltando: [], invalido: true };

  const densidade = feminino
    ? 1.29579 - 0.35004 * log10(soma) + 0.221 * log10(valores.altura)
    : 1.0324 - 0.19077 * log10(soma) + 0.15456 * log10(valores.altura);

  // Equação de Siri
  const gordura = round1((495 / densidade) - 450);

  // Dados inconsistentes não geram resultado
  if (!Number.isFinite(gordura) || gordura < 1 || gordura > 70) return { ok: false, faltando: [], invalido: true };

  const massaGorda = round1((valores.peso * gordura) / 100);
  const massaMagra = round1(valores.peso - massaGorda);
  return { ok: true, gordura, massaGorda, massaMagra };
}