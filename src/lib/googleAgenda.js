import { db } from "@/api/dataClient";

// A agenda Google é compartilhada: uma única autorização, feita pelo proprietário
// do app, atende todos os Coaches. Não existe vínculo individual por usuário.

// Estado da agenda compartilhada; falha na chamada significa "não conectada"
export async function statusGoogleCalendar() {
  try {
    const res = await db.functions.invoke("statusGoogleAgenda", {});
    return res.data || { conectado: false, futuros_sem_evento: 0 };
  } catch {
    return { conectado: false, futuros_sem_evento: 0 };
  }
}