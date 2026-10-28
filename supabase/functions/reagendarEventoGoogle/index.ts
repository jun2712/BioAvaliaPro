import { corsHeaders, json } from "../_shared/cors.ts";
import { isAuthContext, requireAuth } from "../_shared/auth.ts";
import {
  createCalendarEvent,
  getGoogleAccessToken,
  GoogleApiError,
  intervaloEvento,
  patchCalendarEvent,
  tituloEvento,
} from "../_shared/googleCalendar.ts";

// Reschedules an appointment in the app and on the shared Google Calendar.
// If the event no longer exists in Google, it is recreated. Without a connected
// calendar, only the app appointment changes.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const agendamentoId = String(body?.agendamento_id || "");
    const data = String(body?.data || "");
    const hora = String(body?.hora || "");
    if (
      !agendamentoId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
    ) {
      return json(
        { error: "Informe o agendamento, a data (AAAA-MM-DD) e a hora (HH:mm)." },
        400,
      );
    }

    const { data: ag, error } = await auth.caller
      .from("agendamentos")
      .select("id,cliente_id,data,hora,tipo,google_event_id,google_link")
      .eq("id", agendamentoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ag) return json({ error: "Agendamento não encontrado." }, 404);

    let cliente: { id: string; nome: string | null } | null = null;
    if (ag.cliente_id) {
      const { data } = await auth.caller
        .from("clientes")
        .select("id,nome")
        .eq("id", ag.cliente_id)
        .maybeSingle();
      cliente = data;
    }

    const resumo = tituloEvento(cliente?.nome || "Cliente");
    const horarios = intervaloEvento(data, hora);
    let eventId = ag.google_event_id || "";
    let link = ag.google_link || "";
    let aviso = "";

    let token: string | null = null;
    try {
      token = await getGoogleAccessToken();
    } catch (e) {
      aviso = e instanceof Error ? e.message : String(e);
      console.error("reagendarEventoGoogle token", aviso);
    }

    if (token) {
      try {
        const criar = async () => {
          const novo = await createCalendarEvent(token, { summary: resumo, ...horarios });
          eventId = novo.id;
          link = novo.htmlLink || "";
        };

        if (eventId) {
          try {
            const ev = await patchCalendarEvent(token, eventId, {
              summary: resumo,
              ...horarios,
            });
            eventId = ev.id || eventId;
            link = ev.htmlLink || link;
          } catch (e) {
            if (e instanceof GoogleApiError && (e.status === 404 || e.status === 410)) {
              await criar();
            } else {
              aviso = e instanceof Error ? e.message : "Falha ao atualizar o evento no Google Calendar.";
            }
          }
        } else {
          await criar();
        }
      } catch (e) {
        aviso = e instanceof Error ? e.message : "Falha ao falar com o Google Calendar.";
      }
    }

    const { error: updateError } = await auth.caller
      .from("agendamentos")
      .update({
        data,
        hora,
        google_event_id: eventId || null,
        google_link: link || null,
      })
      .eq("id", ag.id);
    if (updateError) throw new Error(updateError.message);

    if (cliente && (ag.tipo === "avaliacao" || ag.tipo === "retorno")) {
      const { error: clientError } = await auth.caller
        .from("clientes")
        .update({ proxima_avaliacao: data })
        .eq("id", cliente.id);
      if (clientError) console.error("reagendarEventoGoogle cliente", clientError.message);
    }

    return json({
      ok: true,
      vinculado: !!token,
      google_event_id: eventId || null,
      html_link: link || null,
      aviso: aviso || null,
    });
  } catch (error) {
    console.error("reagendarEventoGoogle", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
