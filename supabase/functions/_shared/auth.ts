import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.118.0";
import { json } from "./cors.ts";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  coach_nome: string | null;
  role: "admin" | "user";
  medidas_ativas: string[] | null;
  mostrar_navy: boolean;
};

export type AuthContext = {
  user: User;
  profile: Profile;
  caller: SupabaseClient;
  admin: SupabaseClient;
};

export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("server is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function callerClient(req: Request): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new Error("server is not configured");
  const authorization = req.headers.get("Authorization") || "";
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolve the authenticated user and their profile. Returns a Response on
 * failure so callers can simply return it.
 */
export async function requireAuth(req: Request): Promise<AuthContext | Response> {
  const admin = adminClient();
  const caller = callerClient(req);
  const {
    data: { user },
    error: authError,
  } = await caller.auth.getUser();

  if (authError || !user) return json({ error: "unauthorized" }, 401);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,email,full_name,coach_nome,role,medidas_ativas,mostrar_navy")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (profileError) return json({ error: profileError.message }, 500);
  if (!profile) return json({ error: "profile not found" }, 403);

  return { user, profile, caller, admin };
}

export function isAuthContext(value: AuthContext | Response): value is AuthContext {
  return !(value instanceof Response);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
