import { supabase } from "@/api/supabaseClient";

// Compatibility layer for the Base44 entity API. The UI was written against
// db.entities.* and still uses the same call styles; this module translates
// them to PostgREST. It can be replaced with direct supabase-js calls later.
const TABLES = {
  Cliente: "clientes",
  Avaliacao: "avaliacoes",
  Anamnese: "anamneses",
  Agendamento: "agendamentos",
  CalculoProteina: "calculos_proteina",
  ConjuntoAnamnese: "conjuntos_anamnese",
  SyncState: "sync_states",
  User: "profiles",
};

const DEFAULT_LIMIT = 1000;

function dbError(error) {
  if (!error) return null;
  const err = /** @type {any} */ (new Error(error.message || "Database request failed"));
  err.code = error.code;
  err.details = error.details;
  err.hint = error.hint;
  err.status =
    error.code === "PGRST116"
      ? 404
      : error.code === "PGRST301" || error.code === "401"
        ? 401
        : 400;
  return err;
}

function authError(error) {
  if (!error) return null;
  const err = /** @type {any} */ (new Error(error.message || "Authentication failed"));
  err.status = error.status || 400;
  err.code = error.code;
  return err;
}

function cleanObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
}

function parseSort(sort) {
  if (!sort || typeof sort !== "string") {
    return { column: "created_date", ascending: false };
  }
  const ascending = !sort.startsWith("-");
  const column = (ascending ? sort : sort.slice(1)).trim() || "created_date";
  return { column, ascending };
}

function applyFilters(builder, query) {
  if (!query || typeof query !== "object") return builder;

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;

    if (value === null) {
      builder = builder.is(key, null);
      continue;
    }

    if (Array.isArray(value)) {
      builder = builder.in(key, value);
      continue;
    }

    if (typeof value === "object") {
      if ("$in" in value) {
        const list = Array.isArray(value.$in) ? value.$in : [];
        builder = builder.in(key, list);
      } else if ("$nin" in value) {
        const list = Array.isArray(value.$nin) ? value.$nin : [];
        builder = builder.not(key, "in", `(${list.join(",")})`);
      } else if ("$ne" in value) {
        builder = value.$ne === null ? builder.not(key, "is", null) : builder.neq(key, value.$ne);
      } else if ("$lt" in value) {
        builder = builder.lt(key, value.$lt);
      } else if ("$lte" in value) {
        builder = builder.lte(key, value.$lte);
      } else if ("$gt" in value) {
        builder = builder.gt(key, value.$gt);
      } else if ("$gte" in value) {
        builder = builder.gte(key, value.$gte);
      } else if ("$like" in value) {
        builder = builder.like(key, value.$like);
      } else if ("$ilike" in value) {
        builder = builder.ilike(key, value.$ilike);
      } else if ("$is" in value) {
        builder = builder.is(key, value.$is);
      } else {
        // A plain object is treated as JSON equality; currently unused by the UI.
        builder = builder.eq(key, value);
      }
      continue;
    }

    builder = builder.eq(key, value);
  }

  return builder;
}

function normalizeListOptions(args) {
  const [first, second] = args;
  if (typeof first === "string") {
    return { sort: first, limit: second };
  }
  if (first && typeof first === "object" && !Array.isArray(first)) {
    return first;
  }
  return {};
}

function attachPageMetadata(rows, hasMore, offset) {
  rows.items = rows;
  rows.has_more = Boolean(hasMore);
  rows.next_cursor = hasMore ? String(offset + rows.length) : null;
  return rows;
}

async function runList(table, query, args) {
  const options = normalizeListOptions(args);
  const sort = options.sort || "-created_date";
  const limit = Math.max(1, Number(options.limit) || DEFAULT_LIMIT);
  const offset = Math.max(0, Number(options.cursor) || 0);

  if (options.distinct) {
    const rows = await loadAll(table, query, sort);
    const values = [...new Set(rows.map((row) => row[options.distinct]).filter((v) => v != null))];
    return attachPageMetadata(values, false, 0);
  }

  const { column, ascending } = parseSort(sort);
  let builder = supabase.from(table).select("*");
  builder = applyFilters(builder, query);
  builder = builder.order(column, { ascending });
  builder = builder.range(offset, offset + limit - 1);

  const { data, error } = await builder;
  if (error) throw dbError(error);

  const rows = data || [];
  const hasMore = rows.length === limit;
  return attachPageMetadata(rows, hasMore, offset);
}

async function loadAll(table, query, sort = "-created_date") {
  const { column, ascending } = parseSort(sort);
  const pageSize = DEFAULT_LIMIT;
  const all = [];
  let offset = 0;

  while (true) {
    let builder = supabase.from(table).select("*");
    builder = applyFilters(builder, query);
    builder = builder.order(column, { ascending });
    builder = builder.range(offset, offset + pageSize - 1);

    const { data, error } = await builder;
    if (error) throw dbError(error);

    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    offset += rows.length;
  }

  return all;
}

async function getRow(table, id) {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    const err = /** @type {any} */ (new Error("Record not found"));
    err.status = 404;
    throw err;
  }
  return data;
}

async function createRow(table, payload) {
  const { data, error } = await supabase
    .from(table)
    .insert(cleanObject(payload))
    .select("*")
    .single();
  if (error) throw dbError(error);
  return data;
}

async function updateRow(table, id, payload) {
  const { data, error } = await supabase
    .from(table)
    .update(cleanObject(payload))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw dbError(error);
  return data;
}

async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw dbError(error);
  return null;
}

async function bulkCreateRows(table, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const payload = rows.map(cleanObject);
  const { data, error } = await supabase.from(table).insert(payload).select("*");
  if (error) throw dbError(error);
  return data || [];
}

async function bulkUpdateRows(table, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  // The callers always send existing ids. Upsert lets PostgREST update a whole
  // batch in one request while leaving columns not present in the payload
  // untouched on conflict.
  const payload = rows.map(cleanObject);
  const { data, error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: "id" })
    .select("*");
  if (error) throw dbError(error);
  return data || [];
}

async function updateManyRows(table, query, changes = {}) {
  if (changes.$mul) {
    const rows = await loadAll(table, query);
    const updates = rows
      .map((row) => {
        const patch = { id: row.id };
        for (const [field, factor] of Object.entries(changes.$mul)) {
          const current = Number(row[field]);
          const multiplier = Number(factor);
          if (Number.isFinite(current) && Number.isFinite(multiplier)) {
            patch[field] = current * multiplier;
          }
        }
        return patch;
      })
      .filter((patch) => Object.keys(patch).length > 1);

    if (updates.length) await bulkUpdateRows(table, updates);
    return null;
  }

  const patch = changes.$set || changes;
  let builder = supabase.from(table).update(cleanObject(patch));
  builder = applyFilters(builder, query);
  const { error } = await builder;
  if (error) throw dbError(error);
  return null;
}

async function deleteManyRows(table, query) {
  let builder = supabase.from(table).delete();
  builder = applyFilters(builder, query);
  const { error } = await builder;
  if (error) throw dbError(error);
  return null;
}

function entity(name) {
  const table = TABLES[name];
  if (!table) throw new Error(`Unknown entity: ${name}`);

  const api = {
    list: (...args) => runList(table, null, args),
    filter: (query, ...args) => runList(table, query, args),
    get: (id) => getRow(table, id),
    create: (payload) => createRow(table, payload),
    update: (id, payload) => updateRow(table, id, payload),
    delete: (id) => deleteRow(table, id),
    bulkCreate: (rows) => bulkCreateRows(table, rows),
    bulkUpdate: (rows) => bulkUpdateRows(table, rows),
    updateMany: (query, changes) => updateManyRows(table, query, changes),
    deleteMany: (query) => deleteManyRows(table, query),
  };

  if (name === "User") {
    // Role changes use a security-definer RPC; direct updates to profiles.role
    // are intentionally not granted to normal users.
    api.update = async (id, patch) => {
      const rest = { ...patch };
      const nextRole = rest.role;
      delete rest.role;

      if (nextRole) {
        const { error } = await supabase.rpc("admin_set_role", {
          target_id: id,
          p_role: nextRole,
        });
        if (error) throw dbError(error);
      }

      if (Object.keys(rest).length > 0) {
        return updateRow(table, id, rest);
      }
      return getRow(table, id);
    };

    // Deleting an auth user requires the service role. The Edge Function
    // verifies that the caller is an admin before deleting.
    api.delete = async (id) => {
      const response = await invokeEdgeFunction("admin-users", {
        action: "delete",
        user_id: id,
      });
      return response?.data ?? null;
    };
  }

  return api;
}

const entityCache = new Map();

function getEntity(name) {
  if (!entityCache.has(name)) entityCache.set(name, entity(name));
  return entityCache.get(name);
}

function absoluteReturnTo(returnTo) {
  const raw = String(returnTo || "/");
  const path =
    raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/";
  return `${window.location.origin}${path}`;
}

function loginReturnTarget(returnTo) {
  const raw = String(returnTo || window.location.href);
  try {
    const url = new URL(raw, window.location.origin);
    const path = url.pathname + url.search;
    if (
      url.origin === window.location.origin &&
      path.startsWith("/") &&
      !path.startsWith("//") &&
      !path.includes("\\")
    ) {
      return path;
    }
  } catch {
    // fall through
  }
  return "/";
}

const auth = {
  async me() {
    const { data: authData, error } = await supabase.auth.getUser();
    if (error || !authData?.user) {
      const err = /** @type {any} */ (authError(error) || new Error("Not authenticated"));
      err.status = 401;
      throw err;
    }

    const user = authData.user;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw dbError(profileError);

    if (!profile) {
      const { data: created, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        })
        .select("*")
        .single();
      if (createError) throw dbError(createError);
      return created;
    }

    // The auth trigger copies the coach name from signup metadata into the
    // profile. Do not rewrite it here: after an admin renames a coach, metadata
    // may still hold the old value and would silently undo the change.
    return {
      ...profile,
      email: profile.email || user.email,
      full_name:
        profile.full_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        null,
    };
  },

  async updateMe(patch = {}) {
    const me = await auth.me();
    if (!Object.keys(patch).length) return me;

    const { data, error } = await supabase
      .from("profiles")
      .update(cleanObject(patch))
      .eq("id", me.id)
      .select("*")
      .single();
    if (error) throw dbError(error);
    return data;
  },

  async logout(shouldRedirect = true) {
    const { error } = await supabase.auth.signOut();
    if (error) throw authError(error);
    if (shouldRedirect) window.location.assign("/login");
  },

  async loginViaEmailPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw authError(error);
    return data;
  },

  async loginWithProvider(provider = "google", returnTo = "/") {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: /** @type {any} */ (provider),
      options: { redirectTo: absoluteReturnTo(returnTo) },
    });
    if (error) throw authError(error);
    return data;
  },

  async register({ email, password, coachNome = null, fullName = null }) {
    const metadata = {};
    if (coachNome) metadata.coach_nome = coachNome;
    if (fullName) metadata.full_name = fullName;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: metadata,
      },
    });
    if (error) throw authError(error);
    return { ...data, needsVerification: !data.session };
  },

  async verifyOtp({ email, otpCode = null, token = null, type = "signup" }) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode || token,
      type,
    });
    if (error) throw authError(error);
    return { ...data, access_token: data.session?.access_token };
  },

  async resendOtp(email) {
    const { data, error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw authError(error);
    return data;
  },

  async resetPasswordRequest(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw authError(error);
    return data;
  },

  async resetPassword({ newPassword }) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw authError(error);
    return data;
  },

  // Kept for API compatibility. Supabase stores the session automatically
  // after verifyOtp; there is no separate token setter.
  setToken() {},

  redirectToLogin(returnTo = window.location.href) {
    if (window.location.pathname === "/login") return;
    const path = loginReturnTarget(returnTo);
    const target =
      path === "/" ? "/login" : `/login?returnTo=${encodeURIComponent(path)}`;
    window.location.assign(target);
  },

  getSession() {
    return supabase.auth.getSession();
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

async function invokeEdgeFunction(name, payload = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body: payload });

  if (error) {
    let message = error.message || "Function request failed";
    let body = null;
    try {
      body = await error.context?.json();
      if (body?.error) message = body.error;
    } catch {
      // The function may have returned a non-JSON body.
    }
    const err = /** @type {any} */ (new Error(message));
    err.status = error.context?.status;
    err.response = { data: body || { error: message } };
    throw err;
  }

  if (data?.error) {
    const err = /** @type {any} */ (new Error(data.error));
    err.response = { data };
    throw err;
  }

  return { data };
}

/** @type {Record<string, ReturnType<typeof entity>>} */
const entityProxy = new Proxy(
  {},
  {
    get: (_target, name) => {
      if (typeof name !== "string") return undefined;
      return getEntity(name);
    },
  },
);

export const db = {
  entities: entityProxy,
  auth,
  functions: { invoke: invokeEdgeFunction },
  rpc: (fn, args = {}) => supabase.rpc(fn, args),
};
