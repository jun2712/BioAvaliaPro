import { corsHeaders, json } from "../_shared/cors.ts";
import { isAuthContext, requireAuth } from "../_shared/auth.ts";
import {
  dataHoraDoEvento,
  getGoogleAccessToken,
  GoogleApiError,
  listAllCalendarEvents,
  nomeDoTitulo,
  normalizarNome,
} from "../_shared/googleCalendar.ts";

// Brings changes made in the shared Google Calendar into the app. It only
// touches the logged-in coach's appointments and sync state.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;

  try {
    let token: string | null = null;
    try {
      token = await getGoogleAccessToken();
    } catch (e) {
      console.error("sincronizarAgendaGoogle token", e);
    }
    if (!token) return json({ status: "sem_conexao" });

    const { data: registro } = await auth.admin
      .from("sync_states")
      .select("id,sync_token")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const buscarEventos = (syncToken: string | null) =>
      listAllCalendarEvents(token!, { syncToken, timeMin: desde });

    let eventos: { items: any[]; nextSyncToken: string | null };
    try {
      eventos = await buscarEventos(registro?.sync_token || null);
    } catch (e) {
      if (e instanceof GoogleApiError && e.status === 410) {
        // Expired sync token: start over with the recent window.
        eventos = await buscarEventos(null);
      } else {
        console.error("sincronizarAgendaGoogle list", e);
        return json(
          {
            error: e instanceof Error ? e.message : "Falha ao ler o Google Calendar.",
          },
          502,
        );
      }
    }

    const { data: agendamentos, error: agError } = await auth.caller
      .from("agendamentos")
      .select("id,cliente_id,data,hora,tipo,status,google_event_id,google_link")
      .eq("created_by_id", auth.user.id)
      .limit(500);
    if (agError) throw new Error(agError.message);

    const porEvento = new Map<string, any>();
    for (const a of agendamentos || []) {
      if (a.google_event_id) porEvento.set(a.google_event_id, a);
    }

    let atualizados = 0;
    let cancelados = 0;
    let vinculados = 0;

    for (const ev of eventos.items) {
      const ag = porEvento.get(ev.id);
      if (!ag) continue;

      if (ev.status === "cancelled") {
        if (ag.status !== "cancelado") {
          const { error } = await auth.caller
            .from("agendamentos")
            .update({ status: "cancelado" })
            .eq("id", ag.id);
          if (!error) cancelados++;
        }
        continue;
      }

      const dh = dataHoraDoEvento(ev);
      if (!dh) continue;
      const mudou = dh.data !== ag.data || dh.hora !== ag.hora;
      const link = ev.htmlLink || ag.google_link || null;
      if (!mudou && link === ag.google_link) continue;

      const { error } = await auth.caller
        .from("agendamentos")
        .update({ data: dh.data, hora: dh.hora, google_link: link })
        .eq("id", ag.id);
      if (error) continue;

      if (mudou && (ag.tipo === "avaliacao" || ag.tipo === "retorno") && ag.cliente_id) {
        const { error: clientError } = await auth.caller
          .from("clientes")
          .update({ proxima_avaliacao: dh.data })
          .eq("id", ag.cliente_id);
        if (clientError) console.error("sincronizarAgendaGoogle cliente", clientError.message);
      }
      if (mudou) atualizados++;
    }

    // App events without a link (created before the integration): match by the
    // client name in the event title.
    const semVinculo = (agendamentos || []).filter(
      (a) => !a.google_event_id && a.status !== "cancelado",
    );
    if (eventos.items.length && semVinculo.length) {
      const { data: clientes } = await auth.caller
        .from("clientes")
        .select("id,nome")
        .eq("created_by_id", auth.user.id)
        .limit(500);
      const idPorNome = new Map<string, string>();
      for (const c of clientes || []) idPorNome.set(normalizarNome(c.nome), c.id);

      for (const ev of eventos.items) {
        if (ev.status === "cancelled") continue;
        const dh = dataHoraDoEvento(ev);
        const clienteId = idPorNome.get(normalizarNome(nomeDoTitulo(ev.summary)));
        if (!dh || !clienteId) continue;
        const candidatos = semVinculo.filter((a) => a.cliente_id === clienteId);
        if (candidatos.length !== 1) continue;
        const alvo = candidatos[0];
        const { error } = await auth.caller
          .from("agendamentos")
          .update({
            data: dh.data,
            hora: dh.hora,
            google_event_id: ev.id,
            google_link: ev.htmlLink || null,
          })
          .eq("id", alvo.id);
        if (error) continue;
        alvo.google_event_id = ev.id;
        vinculados++;
      }
    }

    if (eventos.nextSyncToken) {
      const { error } = await auth.admin.from("sync_states").upsert(
        {
          sync_token: eventos.nextSyncToken,
          user_id: auth.user.id,
          created_by_id: auth.user.id,
        },
        { onConflict: "user_id" },
      );
      if (error) console.error("sincronizarAgendaGoogle sync state", error.message);
    }

    return json({
      status: "ok",
      analisados: eventos.items.length,
      atualizados,
      cancelados,
      vinculados,
    });
  } catch (error) {
    console.error("sincronizarAgendaGoogle", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
