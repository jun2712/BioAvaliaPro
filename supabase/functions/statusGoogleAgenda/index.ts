import { corsHeaders, json } from "../_shared/cors.ts";
import { isAuthContext, requireAuth } from "../_shared/auth.ts";
import {
  getCalendarMetadata,
  getGoogleAccessToken,
  hojeBrasilia,
} from "../_shared/googleCalendar.ts";

// Shared Google Calendar status and count of future appointments without an
// event. Admins see the whole base; coaches see their own appointments.
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
      console.error("statusGoogleAgenda token", e);
    }
    if (!token) return json({ conectado: false, futuros_sem_evento: 0 });

    let calendario: any = null;
    try {
      calendario = await getCalendarMetadata(token);
    } catch (e) {
      console.error("statusGoogleAgenda metadata", e);
      return json({ conectado: false, futuros_sem_evento: 0 });
    }

    let query = auth.caller
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .neq("status", "cancelado")
      .gte("data", hojeBrasilia())
      .is("google_event_id", null);
    if (auth.profile.role !== "admin") {
      query = query.eq("created_by_id", auth.user.id);
    }
    const { count, error } = await query;
    if (error) throw new Error(error.message);

    return json({
      conectado: true,
      email: calendario?.summary || "",
      futuros_sem_evento: count || 0,
    });
  } catch (error) {
    console.error("statusGoogleAgenda", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
