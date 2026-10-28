import { corsHeaders, json } from "../_shared/cors.ts";
import { isAuthContext, requireAuth } from "../_shared/auth.ts";
import {
  createCalendarEvent,
  getGoogleAccessToken,
  intervaloEvento,
  tituloEvento,
} from "../_shared/googleCalendar.ts";

// Creates the "Avaliação Agendada" event on the shared Google Calendar.
// Without a connected calendar the appointment still exists in the app.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = await requireAuth(req);
  if (!isAuthContext(auth)) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const clienteId = String(body?.cliente_id || "");
    const data = String(body?.data || "");
    const hora = String(body?.hora || "");
    if (
      !clienteId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
    ) {
      return json({ error: "Informe cliente, data (AAAA-MM-DD) e hora (HH:mm)." }, 400);
    }

    const { data: cliente, error } = await auth.caller
      .from("clientes")
      .select("id,nome")
      .eq("id", clienteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cliente) return json({ error: "Cliente não encontrado." }, 404);

    let token: string | null = null;
    let tokenError = "";
    try {
      token = await getGoogleAccessToken();
    } catch (e) {
      tokenError = e instanceof Error ? e.message : String(e);
      console.error("criarEventoGoogle token", tokenError);
    }
    if (!token) {
      return json({
        vinculado: false,
        motivo: "sem_conexao",
        aviso: tokenError || "A agenda Google compartilhada não está conectada.",
      });
    }

    const ev = await createCalendarEvent(token, {
      summary: tituloEvento(cliente.nome || "Cliente"),
      ...intervaloEvento(data, hora),
    });
    return json({ vinculado: true, event_id: ev.id, html_link: ev.htmlLink });
  } catch (error) {
    console.error("criarEventoGoogle", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
