// Conflito de horários na agenda do coach. Cada atendimento ocupa 1 hora.
export const DURACAO_ATENDIMENTO_MIN = 60;
const INICIO_EXPEDIENTE = 8; // 08:00
const FIM_EXPEDIENTE = 19; // 19:00

const paraMinutos = (hora) => {
  const [h, m] = String(hora || "").split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : null;
};

const paraHora = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

const ativosDoDia = (agendamentos, data, ignorarId = null) =>
  (agendamentos || []).filter(
    (a) => a && a.data === data && a.status !== "cancelado" && a.id !== ignorarId
  );

// Atendimentos que se sobrepõem ao horário informado
export function conflitosNoHorario(agendamentos, data, hora, ignorarId = null) {
  const alvo = paraMinutos(hora);
  if (alvo == null) return [];
  const inicioAlvo = alvo;
  const fimAlvo = alvo + DURACAO_ATENDIMENTO_MIN;
  return ativosDoDia(agendamentos, data, ignorarId).filter((a) => {
    const inicio = paraMinutos(a.hora);
    if (inicio == null) return false;
    const fim = inicio + DURACAO_ATENDIMENTO_MIN;
    return inicio < fimAlvo && fim > inicioAlvo;
  });
}

// Horários de 1 hora ainda vagos no dia (entre 08:00 e 19:00)
export function horariosLivres(agendamentos, data, ignorarId = null) {
  const ocupados = ativosDoDia(agendamentos, data, ignorarId)
    .map((a) => paraMinutos(a.hora))
    .filter((v) => v != null);
  const livres = [];
  for (
    let min = INICIO_EXPEDIENTE * 60;
    min + DURACAO_ATENDIMENTO_MIN <= FIM_EXPEDIENTE * 60;
    min += DURACAO_ATENDIMENTO_MIN
  ) {
    const fim = min + DURACAO_ATENDIMENTO_MIN;
    const ocupado = ocupados.some((o) => o < fim && o + DURACAO_ATENDIMENTO_MIN > min);
    if (!ocupado) livres.push(paraHora(min));
  }
  return livres;
}