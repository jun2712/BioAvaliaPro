import { corsHeaders, json } from "../_shared/cors.ts";
import { isAuthContext, requireAuth } from "../_shared/auth.ts";
import {
  createCalendarEvent,
  getGoogleAccessToken,
  hojeBrasilia,
  intervaloEvento,
  tituloEvento,
} from "../_shared/googleCalendar.ts";

// Creates Google Calendar events for future appointments that still exist only
// in the app. Admins send everyone's; coaches send only their own.
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
      console.error("sincronizarFuturosGoogle token", e);
    }
    if (!token) {
      return json(
        {
          error:
            "A agenda Google compartilhada não está conectada. Peça ao administrador para ativá-la.",
        },
        400,
      );
    }

    const hoje = hojeBrasilia();
    let query = auth.caller
      .from("agendamentos")
      .select("id,cliente_id,data,hora,status,google_event_id")
      .limit(500);
    if (auth.profile.role !== "admin") {
      query = query.eq("created_by_id", auth.user.id);
    }
    const { data: agendamentos, error } = await query;
    if (error) throw new Error(error.message);

    const pendentes = (agendamentos || []).filter(
      (a) => a.status !== "cancelado" && a.data >= hoje && !a.google_event_id,
    );
    if (!pendentes.length) return json({ ok: true, criados: 0, falhas: 0 });

    const ids = [...new Set(pendentes.map((a) => a.cliente_id).filter(Boolean))];
    const nomePorId = new Map<string, string>();
    if (ids.length) {
      const { data: clientes } = await auth.caller
        .from("clientes")
        .select("id,nome")
        .in("id", ids)
        .limit(200);
      for (const c of clientes || []) nomePorId.set(c.id, c.nome);
    }

    let criados = 0;
    let falhas = 0;
    for (let i = 0; i < pendentes.length; i += 6) {
      const lote = pendentes.slice(i, i + 6);
      await Promise.allSettled(
        lote.map(async (a) => {
          try {
            const ev = await createCalendarEvent(token, {
              summary: tituloEvento(nomePorId.get(a.cliente_id) || "Cliente"),
              ...intervaloEvento(a.data, a.hora || "09:00"),
            });
            if (!ev?.id) {
              falhas++;
              return;
            }
            const { error: updateError } = await auth.caller
              .from("agendamentos")
              .update({ google_event_id: ev.id, google_link: ev.htmlLink || null })
              .eq("id", a.id);
            if (updateError) {
              falhas++;
              return;
            }
            criados++;
          } catch (e) {
            console.error("sincronizarFuturosGoogle item", e);
            falhas++;
          }
        }),
      );
    }

    return json({ ok: true, criados, falhas });
  } catch (error) {
    console.error("sincronizarFuturosGoogle", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
