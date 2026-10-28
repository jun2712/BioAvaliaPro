import { parseDataLocal } from "@/lib/datas";

// Regras do fluxo de acompanhamento: status do cliente e prazos de retorno.
export const STATUS_CLIENTE = [
  { value: "prospecto", label: "Prospecto" },
  { value: "ativo", label: "Ativo" },
  { value: "pausado", label: "Pausado" },
  { value: "encerrado", label: "Encerrado" },
];

export const TIPOS_AVALIACAO = [
  { value: "inicial", label: "Inicial" },
  { value: "acompanhamento", label: "Acompanhamento" },
  { value: "final", label: "Final" },
];

export const TIPO_AVALIACAO_LABEL = {
  inicial: "Inicial",
  acompanhamento: "Acompanhamento",
  final: "Final",
};

export const TIPOS_AGENDAMENTO = [
  { value: "avaliacao", label: "Avaliação" },
  { value: "retorno", label: "Retorno" },
  { value: "anamnese", label: "Anamnese" },
  { value: "outro", label: "Outro" },
];

export const TIPO_AGENDAMENTO_LABEL = {
  avaliacao: "Avaliação",
  retorno: "Retorno",
  anamnese: "Anamnese",
  outro: "Atendimento",
};

// Dias sem avaliação a partir dos quais o cliente entra na lista de atenção.
export const DIAS_SEM_AVALIACAO = 45;

export const statusDe = (cliente) => cliente?.status || "ativo";

export const somarDiasISO = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const diasDesde = (dataISO) => {
  const d = parseDataLocal(dataISO);
  if (!d || isNaN(d)) return null;
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((hoje - d) / 86400000);
};

// Acompanhamentos que precisam de ação, do mais urgente ao menos urgente.
export function calcularAtencao(clientes, ultimaPorCliente) {
  const itens = [];
  clientes.forEach((c) => {
    if (statusDe(c) === "encerrado") return;
    const ultima = ultimaPorCliente.get(c.id) || null;
    if (!ultima) {
      itens.push({ cliente: c, motivo: "Sem avaliação registrada", tom: "rose", dias: null, ultima: null });
      return;
    }
    if (c.proxima_avaliacao) {
      const dias = diasDesde(c.proxima_avaliacao);
      if (dias != null && dias >= 0) {
        itens.push({
          cliente: c,
          motivo: dias === 0 ? "Retorno previsto para hoje" : "Retorno atrasado",
          tom: "amber",
          dias,
          ultima,
        });
        return;
      }
    }
    const diasSem = diasDesde(ultima.data);
    if (diasSem != null && diasSem >= DIAS_SEM_AVALIACAO) {
      itens.push({ cliente: c, motivo: "Sem avaliação recente", tom: "sky", dias: diasSem, ultima });
    }
  });
  const peso = (item) => (item.motivo === "Retorno previsto para hoje" ? 1000 : item.motivo === "Retorno atrasado" ? 500 + item.dias : item.dias || 0);
  return itens.sort((a, b) => peso(b) - peso(a));
}