import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { corsHeaders, json } from "../_shared/cors.ts";

// Admin-only user management. Deleting an auth user needs the service role,
// which must never be shipped to the browser.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "server is not configured" }, 500);
  }

  const authorization = req.headers.get("Authorization") || "";
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await callerClient.auth.getUser();

  if (authError || !user) {
    return json({ error: "unauthorized" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    return json({ error: "forbidden" }, 403);
  }

  let body: { action?: string; user_id?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  if (body.action === "delete") {
    if (!body.user_id) return json({ error: "user_id is required" }, 400);
    if (body.user_id === user.id) {
      return json({ error: "you cannot delete your own account" }, 400);
    }

    const { error } = await adminClient.auth.admin.deleteUser(body.user_id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (body.action === "set_role") {
    if (!body.user_id) return json({ error: "user_id is required" }, 400);
    if (body.role !== "admin" && body.role !== "user") {
      return json({ error: "invalid role" }, 400);
    }

    const { error } = await adminClient
      .from("profiles")
      .update({ role: body.role })
      .eq("id", body.user_id);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "unknown action" }, 400);
});
