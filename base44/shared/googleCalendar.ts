// Utilitários compartilhados entre as funções que conversam com o Google Calendar.

export const TZ_CALENDARIO = "America/Sao_Paulo";

// Google Calendar compartilhado: uma única conta Google (do proprietário do app)
// atende todos os Coaches. A autorização é feita uma vez, na construção do app.
export const CONECTOR_GOOGLE = "googlecalendar";

export const API_EVENTOS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Data de hoje no fuso de Brasília (AAAA-MM-DD)
export function hojeBrasilia() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Token da conta Google compartilhada do app (autorizada pelo proprietário).
// Lança quando a agenda compartilhada ainda não foi conectada.
export async function tokenCompartilhado(base44: any) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlecalendar");
  if (!accessToken) throw new Error("Agenda Google compartilhada não conectada.");
  return accessToken as string;
}

const p2 = (n: number) => String(n).padStart(2, "0");

// Título padrão dos eventos criados pelo app (usado também para reconhecê-los no sync)
export function tituloEvento(nome: string) {
  return `${nome} / Avaliação Agendada`;
}

// Monta início e fim do evento (ISO com offset de Brasília) a partir de data AAAA-MM-DD e hora HH:mm
export function intervaloEvento(data: string, hora: string, minutos = 60) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  const ini = new Date(Date.UTC(ano, mes - 1, dia, h, m));
  const fim = new Date(ini.getTime() + minutos * 60 * 1000);
  const iso = (dt: Date) =>
    `${dt.getUTCFullYear()}-${p2(dt.getUTCMonth() + 1)}-${p2(dt.getUTCDate())}T${p2(dt.getUTCHours())}:${p2(dt.getUTCMinutes())}:00-03:00`;
  return {
    start: { dateTime: iso(ini), timeZone: TZ_CALENDARIO },
    end: { dateTime: iso(fim), timeZone: TZ_CALENDARIO },
  };
}

// Extrai data (AAAA-MM-DD) e hora (HH:mm) de Brasília a partir de um evento do Google
export function dataHoraDoEvento(evento: any) {
  const inicio =
    evento?.start?.dateTime || (evento?.start?.date ? `${evento.start.date}T09:00:00` : null);
  if (!inicio) return null;
  const d = new Date(inicio);
  if (isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_CALENDARIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const partes: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) partes[p.type] = p.value;
  const hora = partes.hour === "24" ? "00" : partes.hour;
  return { data: `${partes.year}-${partes.month}-${partes.day}`, hora: `${hora}:${partes.minute}` };
}

// Nome do cliente a partir do título "Nome / Avaliação Agendada"
export function nomeDoTitulo(summary: string) {
  return String(summary || "").split("/")[0].trim();
}

export function normalizarNome(s: any) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Aceita tanto array quanto página ({ items })
export function listaDe(res: any) {
  return Array.isArray(res) ? res : res?.items || [];
}