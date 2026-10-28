// Shared Google Calendar helpers for the Edge Functions.
//
// The app uses one shared calendar for every coach. Credentials come from Edge
// Function secrets, never from the browser:
//   - GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_CALENDAR_ID
//     (recommended), or
//   - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN.
//
// With a service account, share the calendar with the service-account email
// (permission "Make changes to events") and set GOOGLE_CALENDAR_ID to its ID.

export const TZ_CALENDARIO = "America/Sao_Paulo";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export class GoogleApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
  }
}

export function calendarId() {
  return Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";
}

export function calendarEventsUrl() {
  return `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId())}/events`;
}

export function calendarMetadataUrl() {
  return `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId())}`;
}

export function hojeBrasilia() {
  const parts: Record<string, string> = {};
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_CALENDARIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (const p of fmt.formatToParts(new Date())) parts[p.type] = p.value;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const p2 = (n: number) => String(n).padStart(2, "0");

export function tituloEvento(nome: string) {
  return `${nome} / Avaliação Agendada`;
}

// Event start/end as ISO with the Brasília offset, from YYYY-MM-DD + HH:mm.
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

// Extract YYYY-MM-DD and HH:mm in Brasília from a Google event.
export function dataHoraDoEvento(evento: any) {
  const inicio =
    evento?.start?.dateTime || (evento?.start?.date ? `${evento.start.date}T09:00:00` : null);
  if (!inicio) return null;
  const d = new Date(inicio);
  if (Number.isNaN(d.getTime())) return null;
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

function base64Url(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToBytes(pem: string) {
  const clean = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function serviceAccountAssertion(email: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  return `${header}.${claims}.${base64Url(new Uint8Array(signature))}`;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function requestToken(body: URLSearchParams) {
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    throw new Error(
      data?.error_description || data?.error?.message || "Falha ao autenticar no Google Calendar.",
    );
  }
  const expiresIn = Number(data.expires_in) || 3600;
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  };
  return tokenCache.token;
}

/**
 * Returns an access token, or null when the integration has not been
 * configured yet. Throws when credentials exist but Google rejects them.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;

  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (refreshToken) {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error("Credenciais OAuth do Google incompletas.");
    }
    return await requestToken(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    );
  }

  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY");
  if (!email && !privateKey) return null;
  if (!email || !privateKey) throw new Error("Credenciais da conta de serviço incompletas.");

  const assertion = await serviceAccountAssertion(email, privateKey);
  return await requestToken(
    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  );
}

async function googleFetch(url: string, token: string, init: RequestInit = {}) {
  const resp = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new GoogleApiError(
      data?.error?.message || "Falha ao falar com o Google Calendar.",
      resp.status,
    );
  }
  return data;
}

export async function createCalendarEvent(token: string, body: any) {
  return await googleFetch(calendarEventsUrl(), token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchCalendarEvent(token: string, eventId: string, body: any) {
  return await googleFetch(`${calendarEventsUrl()}/${encodeURIComponent(eventId)}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function getCalendarMetadata(token: string) {
  return await googleFetch(calendarMetadataUrl(), token);
}

export async function listAllCalendarEvents(
  token: string,
  options: { syncToken?: string | null; timeMin?: string } = {},
): Promise<{ items: any[]; nextSyncToken: string | null }> {
  const base = new URL(calendarEventsUrl());
  base.searchParams.set("maxResults", "100");
  base.searchParams.set("singleEvents", "true");
  base.searchParams.set("showDeleted", "true");
  if (options.syncToken) base.searchParams.set("syncToken", options.syncToken);
  else if (options.timeMin) base.searchParams.set("timeMin", options.timeMin);

  const items: any[] = [];
  let nextSyncToken: string | null = null;
  let pageToken: string | null = null;

  for (let i = 0; i < 20; i++) {
    const url = new URL(base);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await googleFetch(url.toString(), token);
    items.push(...(page.items || []));
    if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
    pageToken = page.nextPageToken || null;
    if (!pageToken) break;
  }

  return { items, nextSyncToken };
}
