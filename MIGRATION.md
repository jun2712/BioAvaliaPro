# BioAvalia2 — Migration plan: Base44 → Supabase + Vercel

Status: Phase 1, the data migration and the backend function port are implemented — Supabase schema/RLS is applied to the live project, the compatibility data client and Supabase auth are in place, the Base44 SDK is removed from the client, the app builds, the three known users are created, the CSVs are imported with the counts below, and all 9 Base44 functions plus `admin-users` are deployed as Edge Functions. Google Calendar, AI, SMTP and the Vercel production deploy still need credentials/configuration.

### Live migration state (2026-10-28)

- Schema migrations applied: `20261028000000_init.sql` and `20261028000100_hardening.sql`.
- Users created/mapped: `jun@shake4u.com.br` (admin, coach “Jun Takakura”), `joao.anonimo1969@gmail.com` (user, coach “Jesus Ramaldes”), `jun.takakura@yahoo.com.br` (user, coach “JunT”).
- Imported: 5,319 clients, 10,519 evaluations, 6 anamneses, 7 agendamentos, 2 protein calculations, 1 question set.
- Verification: no discarded João client or dependent records; all 10,519 evaluations have coach “Jun Takakura”; all client `share_token` values are `NULL`; `C5135` resolves to Jun Takakura; the orphan “Teste Meta” protein calculation has `cliente_id = NULL`.
- RLS smoke test: admin sees all rows, the Jesus account sees its 5,234 coach-name clients but no evaluations/anamneses, and anonymous access is denied. See the access decision below before go-live.
- Edge Functions deployed: `getPublicReport`, `anamnesePublic`, `proteinaPublic`, `anamneseAnalise`, `criarEventoGoogle`, `reagendarEventoGoogle`, `sincronizarAgendaGoogle`, `sincronizarFuturosGoogle`, `statusGoogleAgenda`, `admin-users`. The three public functions have `verify_jwt = false`; the rest require a user JWT.
- Remote smoke tests passed: public report whitelist, public protein/anamnese reads and writes, prospect creation, invalid-token rejection, authenticated Google “not connected” responses, AI not-configured 503, unauthenticated 401, and admin set-role/delete lifecycle. Temporary smoke rows/users were removed and the imported counts remain unchanged.
- Access decision (2026-10-28): **do not grant Jesus clinical access for now.** His account keeps client visibility but no evaluations/anamneses. This is an accepted limitation, not a misconfiguration.
- Not configured: Google Calendar secrets, AI provider key, custom SMTP, Vercel production environment/Auth URLs.

### Confirmed data decisions (2026-10-28)

- The new `BioAvalia_App-users.csv` export is the user source (email, `full_name`, `role`, `coach_nome`, `medidas_ativas`).
- Duplicate client code `C5135`: **discard “João Ninguém”** (`6add22b0475af9fdf6d25200`) and all records linked to that client; **keep “Jun Takakura”** (`6adcf2fbd98b4d0fee1ab208`).
- **Set the coach of every evaluation with a blank coach to “Jun Takakura”** (10,517 rows). Do not derive it from the parent client. After discarding João's evaluation, all 10,519 imported evaluations have coach “Jun Takakura”.
- Expected imported counts: 5,319 clients, 10,519 evaluations, 6 anamneses, 7 agendamentos, 2 protein calculations, 1 question set. `SyncState` is not imported.
- The user export has no Base44 IDs. Ownership is mapped from the three Base44 IDs found in the business CSVs:
  - `6adb6fad5703905140c49faa` → `jun@shake4u.com.br` (admin, coach “Jun Takakura”)
  - `6adcccba140e64ef33f34a64` → `joao.anonimo1969@gmail.com` (coach “Jesus Ramaldes”)
  - `6ae21a5bc68b992627bc3925` → `jun.takakura@yahoo.com.br` (coach “JunT”)
  - `service_d4b6c372-4cb7-4c4c-bb65-440e08045f73` → no auth user; service-created protein records keep `created_by_id = NULL` and remain visible to admins.

## 1. Executive summary

This app is a Vite + React SPA whose backend is almost entirely Base44:

- **UI:** React 18, React Router, TanStack Query, shadcn/Radix, Tailwind.
- **Base44 SDK:** `@base44/sdk` is the data layer, auth provider, function invoker and file/app settings API.
- **Base44 Vite plugin:** `@base44/vite-plugin` proxies the backend during development and injects Builder/analytics behavior.
- **Database:** 8 Base44 entities (`Cliente`, `Avaliacao`, `Anamnese`, `Agendamento`, `CalculoProteina`, `ConjuntoAnamnese`, `SyncState`, `User`) with per-entity RLS rules in `base44/entities/*.jsonc`.
- **Backend functions:** 9 Base44 functions in `base44/functions/`.
- **Integrations:** one shared Google Calendar connector + one workflow, and Base44's `Core.InvokeLLM` for the anamnesis AI analysis.
- **Hosting:** Base44's Git sync/Builder, with `base44 dev` for local development.

The recommended target, keeping the existing interface and business logic:

```text
Browser
  │  Vite SPA (static)
  ▼
Vercel (Hobby/Pro)  ── static hosting + SPA rewrites
  │
  │  supabase-js (anon key + user JWT)
  ▼
Supabase
  ├─ Postgres + RLS
  ├─ Auth (email/password, Google OAuth, password recovery)
  ├─ Edge Functions (service role) for public forms/report, AI, Google Calendar, admin user deletion
  ├─ optional Storage (avatars)
  └─ optional pg_cron (calendar sync)
  │
  ├── Google Calendar API (shared calendar)
  └── LLM API (Gemini/Groq/etc.)
```

**The single most important design choice:** introduce a small compatibility data client that exposes the same entity API the UI already uses (`list`, `filter`, `get`, `create`, `update`, `delete`, `bulkCreate`, `bulkUpdate`, `updateMany`, `deleteMany`) but is backed by Supabase. This avoids rewriting every screen at once. The UI and business rules stay, and the Base44-specific query semantics are isolated in one file. The client can be refactored to plain `supabase-js` calls later.

**Estimated effort:** a careful 3–5 day migration for one developer, plus data validation and user cutover. There is no need to rewrite the React UI.

---

## 2. What Base44 does today (inventory)

### 2.1 Frontend coupling

About **40 files** in `src/` contain **~110 `base44.` calls**, plus the SDK import in every one of those files.

| Concern | Current code | Replacement |
|---|---|---|
| SDK client | `src/api/base44Client.js` | `src/api/dataClient.js` backed by `@supabase/supabase-js` |
| Env/app params | `src/lib/app-params.js` (`VITE_BASE44_*`, `getAccessToken`) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Auth context | `src/lib/AuthContext.jsx` (`getPublicSettings`, `me`, `logout`, `redirectToLogin`) | Supabase session listener + `profiles` row |
| Login/register/reset | `Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx` | `supabase.auth` methods |
| Entities | `base44.entities.Cliente/Avaliacao/...` | compatibility client over Postgres tables |
| Functions | `base44.functions.invoke("...")` | `dataClient.functions.invoke` → Supabase Edge Function |
| Data loading | `carregarTudo` cursor pagination | offset/range pagination in the adapter |
| Query operators | `$in`, `$lt`, `$gte`, `$lte`, `$set`, `$mul`, `distinct`, `list({sort,limit,cursor})` | translated in the adapter |
| Build/dev | `@base44/vite-plugin` in `vite.config.js` | plain `@vitejs/plugin-react` |
| Assets | `media.base44.com` avatar URLs; Base44 favicon/logo; Wix/Base44 image transforms | local `public/` assets; simplify/remove image helpers |
| Dead platform code | `src/pages/OAuthConsent.jsx` (not routed; Base44 MCP OAuth consent) | delete unless MCP is actually needed |

### 2.2 Backend entities

From `base44/entities/`:

| Base44 entity | Main fields | Notes |
|---|---|---|
| `Cliente` | `nome`, `codigo`, `email`, `notas`, `whatsapp`, `data_nascimento`, `sexo`, `altura`, `grupo`, `coach`, `share_token`, `status`, `objetivo`, `data_inicio`, `proxima_avaliacao`, `meta_proteica` (JSON) | `codigo` is the human ID; `share_token` authorizes the public report |
| `Avaliacao` | `cliente_id`, `coach`, `data`, `tipo`, ~25 biometric/perimetry fields, `navy_*`, notes | 10,520 rows in the CSV |
| `Anamnese` | `cliente_id`, `nome`, `whatsapp`, `data`, `token`, `status`, `perguntas` (JSON array), `meta_proteica` (JSON), `respondida_em` | public form uses token |
| `Agendamento` | `cliente_id`, `data`, `hora`, `tipo`, `status`, `google_event_id`, `google_link` | Google Calendar link |
| `CalculoProteina` | `cliente_id`, `nome`, `whatsapp`, `coach`, `token`, `status`, inputs and calculated outputs | public calculator |
| `ConjuntoAnamnese` | `nome`, `codigos` (array) | saved question sets |
| `SyncState` | `sync_token`, `user_id` | Google incremental sync token |
| `User` | `role`, `coach_nome`, `medidas_ativas`, `mostrar_navy` | Base44 auth user + profile fields |

All Base44 entities also get `id`, `created_date`, `updated_date`, `created_by_id`, `is_sample`.

Base44 RLS behavior that must be preserved:

- `Cliente`, `Avaliacao`, `CalculoProteina`: owner (`created_by_id`) **or** admin **or** the coach whose `coach_nome` matches the record's `coach`.
- `Anamnese`, `Agendamento`, `ConjuntoAnamnese`, `SyncState`: owner or admin.
- `User`: own profile; admins can list/update/delete.

### 2.3 Backend functions

| Base44 function | Purpose | Auth |
|---|---|---|
| `getPublicReport` | Read a client + evaluations by `share_token`; strip `notas_profissional` | public token |
| `anamnesePublic` | Read/answer a public anamnesis; calculate protein target; create/link prospect; create `CalculoProteina` | public token |
| `proteinaPublic` | Read/answer public protein calculator; update client's latest target | public token |
| `anamneseAnalise` | AI recommendation using anamnesis answers + last evaluation | logged-in owner |
| `statusGoogleAgenda` | Calendar connection status + count of future appointments without events | logged-in |
| `criarEventoGoogle` | Create Google Calendar event | logged-in |
| `reagendarEventoGoogle` | Update/reschedule Google event | logged-in |
| `sincronizarAgendaGoogle` | Pull Google changes using sync token | logged-in |
| `sincronizarFuturosGoogle` | Create events for future appointments without one | logged-in; admin sees all, coach own |

Shared code: `base44/shared/proteina.ts` (calculation matrix) and `base44/shared/googleCalendar.ts` (timezone, event title/interval, sync-token parsing, name normalization). Both are portable.

The `base44/workflows/AgendaGoogleSync.jsonc` workflow reacts to Google Calendar events. Self-hosting does not have Base44's connector trigger; replace it with pull-sync on page load and/or a scheduled sync (see §10).

### 2.4 Deployment and assets

- `base44/config.jsonc` only defines install/build/serve/output commands; Vercel can take over directly.
- `README.md` is entirely Base44 workflow (`base44 login`, `base44 link`, `base44 dev`, dashboard publish).
- `index.html` uses Base44 favicon; `<title>Base44 APP</title>`.
- `AvatarCorporal.jsx` loads two images from `media.base44.com`.
- `src/components/ui/image.jsx`, `image-helpers.js`, `responsive-image.jsx`, `use-responsive-image.jsx` contain Wix/Base44 media transform logic. Check whether they are used; otherwise delete them.
- `.npmrc` contains a `min-release-age-exclude=@base44/*` rule; remove it with the packages.
- `public/manifest.json` is referenced by `index.html` but is missing; add a real manifest or remove the link.

---

## 3. Target data model

Use `uuid` primary keys and keep a `legacy_id` column containing the original Base44 24-character ID. That lets the CSV import remap foreign keys without losing traceability.

Suggested tables (snake_case, matching current fields to minimize UI changes):

### `profiles`

Mirrors `auth.users` plus the Base44 `User` fields.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | same as `auth.users.id` |
| `email` | `text` | copied from auth user |
| `full_name` | `text` | from auth metadata |
| `coach_nome` | `text` | unique case-insensitive where not null |
| `role` | `text` | `'admin'` or `'user'`, default `'user'` |
| `medidas_ativas` | `text[]` | nullable |
| `mostrar_navy` | `boolean` | default `true` |
| `legacy_base44_id` | `text` unique | original Base44 user ID, for ownership remap |
| `created_date`, `updated_date` | `timestamptz` | |

Do **not** put passwords or auth secrets here. Supabase Auth owns credentials.

### Business tables

- `clientes` — all `Cliente` fields; `codigo text unique`; `share_token text unique`; `meta_proteica jsonb`; `created_by_id uuid references profiles(id)`; timestamps.
- `avaliacoes` — all `Avaliacao` fields; `cliente_id uuid not null references clientes(id) on delete cascade`; `data date`; numeric columns; `coach text`; `created_by_id`; timestamps.
- `anamneses` — all `Anamnese` fields; `cliente_id uuid null references clientes(id) on delete set null`; `token text unique not null`; `perguntas jsonb`; `meta_proteica jsonb`; `status`; `respondida_em timestamptz`.
- `agendamentos` — `cliente_id`, `data date`, `hora text` (keep `"HH:mm"` to avoid `time` serialization surprises), `tipo`, `status`, `google_event_id`, `google_link`, owner, timestamps.
- `calculos_proteina` — all `CalculoProteina` fields; `cliente_id uuid null`; `token text unique`; calculated numeric fields; `status`; `respondida_em`.
- `conjuntos_anamnese` — `nome text`, `codigos text[]`, owner, timestamps.
- `sync_states` — `sync_token text`, `user_id uuid references profiles(id)`, unique `user_id`. Do not import the old rows; reset and re-sync.
- `google_credentials` (only if using OAuth refresh token) — single row, `refresh_token`, `account_email`, `updated_date`. RLS enabled with **no** client policies; only service role accesses it. Prefer Supabase Vault for the token.
- `legacy_users` (temporary import table) — `legacy_id`, `email`, `coach_nome`, `role`, `new_user_id`. Drop after cutover.

Indexes to create:

- `clientes (codigo)` unique, `clientes (share_token)` unique, `clientes (created_by_id)`, `clientes (coach)`, `clientes (status)`.
- `avaliacoes (cliente_id, data desc)`, `avaliacoes (created_by_id)`, `avaliacoes (coach)`.
- `anamneses (token)` unique, `anamneses (cliente_id)`, `anamneses (status)`.
- `agendamentos (data, hora)`, `agendamentos (created_by_id)`, `agendamentos (google_event_id)`.
- `calculos_proteina (token)` unique, `calculos_proteina (cliente_id)`.
- `profiles (lower(coach_nome))` unique partial index.

### Timestamps and ownership

Keep the existing column names `created_date` / `updated_date` so UI code (`new Date(a.created_date)`, sorting) does not change.

- `created_date timestamptz not null default now()`
- `updated_date timestamptz not null default now()` with a `BEFORE UPDATE` trigger.
- `created_by_id uuid references profiles(id) on delete set null`.
- `is_sample boolean not null default false` (optional; can be omitted if unused by UI).

### RLS: preserve Base44 access rules

Helper functions (security definer, stable, locked `search_path`):

```sql
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.my_coach_nome()
returns text language sql stable security definer set search_path = public as $$
  select coach_nome from public.profiles where id = auth.uid();
$$;
```

Example `clientes` policies:

```sql
alter table public.clientes enable row level security;

create policy clientes_select on public.clientes
for select to authenticated
using (
  created_by_id = auth.uid()
  or public.is_admin()
  or (coach is not null and coach = public.my_coach_nome())
);

create policy clientes_insert on public.clientes
for insert to authenticated
with check (created_by_id = auth.uid() or public.is_admin());

create policy clientes_update on public.clientes
for update to authenticated
using (
  created_by_id = auth.uid()
  or public.is_admin()
  or (coach is not null and coach = public.my_coach_nome())
)
with check (
  created_by_id = auth.uid()
  or public.is_admin()
  or (coach is not null and coach = public.my_coach_nome())
);

create policy clientes_delete on public.clientes
for delete to authenticated
using (
  created_by_id = auth.uid()
  or public.is_admin()
  or (coach is not null and coach = public.my_coach_nome())
);
```

Apply the same shape to `avaliacoes` and `calculos_proteina`. For `anamneses`, `agendamentos`, `conjuntos_anamnese` and `sync_states`, remove the coach-name clause: owner or admin only, matching current Base44 RLS.

`profiles`:

- select: own row or admin.
- update: own row; admin any row. Use **column-level grants** so a normal user cannot change `role`:
  ```sql
  revoke update on public.profiles from authenticated;
  grant update (coach_nome, medidas_ativas, mostrar_navy, full_name)
    on public.profiles to authenticated;
  ```
  Admin role changes should go through a security-definer RPC such as `admin_set_role(target_id, new_role)`, not a direct table update.
- delete: do not allow from the client. Deleting an auth user requires the service role; implement an admin-only Edge Function `admin-users` (see §8).

`nameCoachEmUso` currently tries to list all `User` rows, then falls back to a `distinct` query on clients. Replace it with an RPC that checks names without exposing emails:

```sql
create or replace function public.coach_name_taken(candidate text, except_id uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where lower(btrim(coach_nome)) = lower(btrim(candidate))
      and (except_id is null or id <> except_id)
  );
$$;
grant execute on function public.coach_name_taken(text, uuid) to authenticated;
```

For `Cliente.list({ distinct: "coach" })`, add `distinct_coach_names()` RPC or run a distinct select in the adapter. Avoid exposing all profiles.

### New user trigger

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

---

## 4. Frontend decoupling: compatibility data client

### 4.1 Why an adapter

There are ~110 call sites. Rewriting them all at once is risky. The adapter keeps this UI code unchanged:

```js
const avs = await db.entities.Avaliacao.filter({ cliente_id: id }, "data", 200);
const clientes = await db.entities.Cliente.list("-updated_date", 500);
await db.entities.Cliente.updateMany({ created_by_id: userId }, { $set: { coach: nome } });
```

Only the import path and the `base44` identifier change. The adapter translates Base44's query language into Supabase/PostgREST calls. Once the app is stable, each entity can be migrated to direct `supabase.from(...)` calls.

### 4.2 Adapter shape

```js
// src/api/dataClient.js
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

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

// entity("Cliente").list/filter/get/create/update/delete/...
export const db = {
  entities: new Proxy({}, { get: (_, name) => entity(name) }),
  auth: supabaseAuthAdapter,
  functions: { invoke: invokeEdgeFunction },
};
```

### 4.3 Query semantics to support

The current code uses several Base44 call styles. The adapter must normalize them:

| Call style | Expected result | Adapter behavior |
|---|---|---|
| `list(sort, limit)` | array | `select`, order, limit |
| `list({ sort, limit, cursor })` | `{ items, has_more, next_cursor }` | range/offset pagination |
| `list({ distinct: "coach" })` | `{ items: [...] }` | RPC or select/dedupe |
| `filter(query, sort, limit)` | array | select with filters/order/limit |
| `filter(query, { sort, limit })` | page object | select with options |
| `get(id)` | row | single row; throw if missing |
| `create(payload)` | row | insert + select |
| `update(id, payload)` | row | update + select |
| `delete(id)` | — | delete |
| `bulkCreate(rows)` | rows | insert array |
| `bulkUpdate([{id, ...}])` | — | upsert/update per row |
| `updateMany(query, { $set, $mul })` | — | update/RPC |
| `deleteMany(query)` | — | delete with filters |

A useful trick for compatibility: return an **array with page metadata**:

```js
const rows = data ?? [];
rows.items = rows;          // makes both `page.items` and `results[0]` work
rows.has_more = hasMore;
rows.next_cursor = nextCursor;
return rows;
```

This handles the inconsistent current usage: `AvaliacaoForm` treats `filter()` as an array, while `ProteinaCard` and `AgendamentoDialog` treat it as `{ items }`.

Filter operators to translate:

- `{ campo: valor }` → `eq`
- `{ campo: { $in: [...] } }` → `in`
- `{ campo: { $lt: n } }` → `lt`
- `{ campo: { $gte: n } }` → `gte`
- `{ campo: { $lte: n } }` → `lte`
- update `{ $set: {...} }` → update payload
- update `{ $mul: { altura: 100 } }` → RPC or select/compute/update (only used by the old one-time height migration in `Home.jsx`; remove that code after import)

Sorting: Base44 uses `"-updated_date"` for descending; parse the leading `-`.

Pagination: PostgREST `range(from, to)` with `limit`. For `carregarTudo` with 10,000+ evaluations, 1000-row pages are fine. Set `has_more` when a page is full; use an integer offset encoded as the cursor.

### 4.4 Auth adapter

Map Base44 auth methods to Supabase:

| Base44 | Supabase |
|---|---|
| `auth.me()` | `getUser()` + select `profiles` row |
| `auth.updateMe(patch)` | update `profiles` for current user |
| `auth.logout()` | `signOut()` |
| `auth.loginViaEmailPassword(email, password)` | `signInWithPassword` |
| `auth.loginWithProvider("google", returnTo)` | `signInWithOAuth({ provider: "google", options: { redirectTo } })` |
| `auth.register({ email, password })` | `signUp` (email confirmation on) |
| `auth.verifyOtp({ email, otpCode })` | `verifyOtp({ email, token, type: "signup" })` |
| `auth.resendOtp(email)` | `resend({ type: "signup", email })` |
| `auth.resetPasswordRequest(email)` | `resetPasswordForEmail(email, { redirectTo: origin + "/reset-password" })` |
| `auth.resetPassword({ newPassword })` | `updateUser({ password: newPassword })` after recovery session |
| `auth.redirectToLogin(returnTo)` | `window.location.href = "/login?returnTo=..."` |
| `app.getPublicSettings()` | remove; no longer needed |

`AuthContext` should:

1. `supabase.auth.getSession()`.
2. Subscribe to `onAuthStateChange`.
3. Load the `profiles` row for the user.
4. Expose `{ user, isAuthenticated, isLoadingAuth, authChecked, authError, logout, navigateToLogin, checkUserAuth }`.
5. Remove `isLoadingPublicSettings` and `appPublicSettings`; update `App.jsx` accordingly.

Keep `ProtectedRoute` and role checks. `user.role` comes from `profiles`, not user metadata.

**Email confirmation / OTP:** the current Register screen expects a 6-digit code. Supabase's default signup email is a confirmation link. Either:

- Customize the Supabase "Confirm signup" email template to include `{{ .Token }}` (6-digit OTP), keep the current UI, and call `verifyOtp`; or
- Change the register screen to "check your email and click the link" and remove the OTP screen.

The OTP path preserves the current UI. Configure custom SMTP (Resend/Brevo) because Supabase's built-in email service is heavily rate-limited and not suitable for production.

**Password reset:** use Supabase's recovery link. The link returns to `/reset-password` with a recovery session; the page calls `updateUser({ password })`. The existing `?token=` logic must be replaced.

**Google login:** configure Google as a Supabase auth provider; add the Supabase callback URL to Google Cloud. The existing `safeReturnTo` helper can stay.

### 4.5 Functions adapter

As built, the Edge Function slugs are identical to the Base44 names, so the existing call sites continue to use `db.functions.invoke("getPublicReport", ...)` etc. The adapter in `src/api/dataClient.js` calls `supabase.functions.invoke(name, { body })`, which adds the current session automatically. There is no function-name map or manual `fetch`.

Public functions (`getPublicReport`, `anamnesePublic`, `proteinaPublic`) are deployed with `verify_jwt = false`; they authorize by token. Private functions verify the JWT and ownership through RLS. The `supabase/config.toml` file records these settings so `supabase functions deploy` applies them.

### 4.6 File-by-file changes

Mechanical rename (all ~40 files):

- `import { base44 } from "@/api/base44Client"` → `import { db } from "@/api/dataClient"`
- `base44.` → `db.`

Specific changes beyond the rename:

| File | Change |
|---|---|
| `src/api/base44Client.js` | replace with `src/api/dataClient.js`; delete old file |
| `src/lib/app-params.js` | delete; use `import.meta.env.VITE_SUPABASE_*` |
| `src/lib/AuthContext.jsx` | rewrite for Supabase sessions/profiles |
| `src/App.jsx` | remove `isLoadingPublicSettings`/`appPublicSettings`; keep route guards |
| `src/pages/Login.jsx` | `db.auth.loginViaEmailPassword`; Google OAuth |
| `src/pages/Register.jsx` | `db.auth.register` + `verifyOtp`/confirmation; update coach profile |
| `src/pages/ForgotPassword.jsx` | `db.auth.resetPasswordRequest` |
| `src/pages/ResetPassword.jsx` | Supabase recovery session + `db.auth.resetPassword` |
| `src/lib/coach.js` | replace `User.list`/`distinct` with `coach_name_taken` RPC and a safe distinct query |
| `src/pages/Administracao.jsx`, `src/components/admin/UsuariosTable.jsx` | `User.delete` → admin Edge Function; role changes → RPC |
| `src/pages/Configuracoes.jsx`, `src/components/CoachPrompt.jsx` | profile updates and `updateMany` work through adapter |
| `src/pages/Home.jsx` | remove one-time `$mul` height migration; clean heights during CSV import |
| `src/components/ui/image.jsx`, `image-helpers.js`, `responsive-image.jsx`, `use-responsive-image.jsx` | remove Wix/Base44 transforms; use plain `<img>` if needed |
| `src/components/AvatarCorporal.jsx` | local `/avatars/...` paths |
| `src/pages/OAuthConsent.jsx` | delete (not routed; Base44 MCP-specific) |
| `src/lib/anamneseCsv.js`, `carregarTudo.js`, `clienteCodigo.js`, `googleAgenda.js` | adapter conversions |
| `index.html` | title/favicon; remove Base44 branding |
| `vite.config.js` | remove `base44` plugin |
| `package.json` | remove `@base44/sdk`, `@base44/vite-plugin`; add `@supabase/supabase-js` |
| `.npmrc` | remove Base44 scope exception |
| `README.md` | replace with Supabase/Vercel instructions |
| `base44/` | delete after porting `shared/proteina.ts` and `shared/googleCalendar.ts` to `supabase/functions/_shared/` |

---

## 5. Supabase backend functions

The 9 Base44 functions were ported to Supabase Edge Functions (Deno). The deployed names match the Base44 invocation names, so `src/api/dataClient.js` did not need per-function routing changes.

As-built layout:

```text
supabase/
  config.toml
  migrations/20261028000000_init.sql
  functions/
    _shared/cors.ts
    _shared/auth.ts              # caller JWT + profile + service-role client
    _shared/proteina.ts          # ported from base44/shared/proteina.ts
    _shared/googleCalendar.ts    # service account / OAuth + Calendar helpers
    getPublicReport/index.ts
    anamnesePublic/index.ts
    proteinaPublic/index.ts
    anamneseAnalise/index.ts
    criarEventoGoogle/index.ts
    reagendarEventoGoogle/index.ts
    sincronizarAgendaGoogle/index.ts
    sincronizarFuturosGoogle/index.ts
    statusGoogleAgenda/index.ts
    admin-users/index.ts
```

### 5.1 Function mapping

| Base44 function | Edge Function | JWT | Notes |
|---|---|---|---|
| `getPublicReport` | `getPublicReport` | no | Query by `share_token` with service role; whitelist public fields; never return `notas_profissional` or `created_by_id` |
| `anamnesePublic` | `anamnesePublic` | no | Token validation, answer save, protein calculation, prospect creation, `created_by_id` inherited from anamnesis owner |
| `proteinaPublic` | `proteinaPublic` | no | Token validation, calculation, update client |
| `anamneseAnalise` | `anamneseAnalise` | yes | Verify owner/admin via RLS, call LLM API (Gemini/Groq/OpenRouter) |
| `statusGoogleAgenda` | `statusGoogleAgenda` | yes | Owner/admin data via RLS |
| `criarEventoGoogle` | `criarEventoGoogle` | yes | Verify client access |
| `reagendarEventoGoogle` | `reagendarEventoGoogle` | yes | Verify appointment access |
| `sincronizarAgendaGoogle` | `sincronizarAgendaGoogle` | yes | Sync token in `sync_states` |
| `sincronizarFuturosGoogle` | `sincronizarFuturosGoogle` | yes | Admin all, coach own |
| — | `admin-users` | yes | `auth.admin.deleteUser`, admin check, role update |

Supabase Edge Functions have `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` available by default. Use:

- **User-scoped client** for normal reads/writes so RLS is enforced:
  ```ts
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization")! } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  ```
- **Service-role client** only for public-token functions, `SyncState`, and admin operations.

Public functions validate inputs exactly as the current code does (token format, answer length, weight/age ranges, enum values). Do not let a public function accept arbitrary table updates. Distributed rate limiting is not implemented yet; tokens are 128-bit random values and must be treated as private links.

CORS: the current shared helper returns `Access-Control-Allow-Origin: *`, allows `POST, OPTIONS`, and handles `OPTIONS`. Tighten this to the Vercel origin if the browser preflight policy should be restricted.

### 5.2 Admin user deletion

Base44's `User.delete` removed the account. In Supabase, the browser cannot delete `auth.users`. Implement `admin-users`:

1. Read caller JWT.
2. Query `profiles` to ensure `role = 'admin'`.
3. Refuse self-deletion.
4. Call `supabaseAdmin.auth.admin.deleteUser(targetId)`.
5. `profiles` cascade deletes; records keep `coach` names and `created_by_id` becomes null (`on delete set null`) so admins still see them.
6. Optionally reassign records to another coach before deletion.

Role changes: `admin_set_role` RPC or the same Edge Function. Do not allow a normal user to update `profiles.role`.

---

## 6. Data migration from the CSV files

### 6.1 Current data volume

| CSV | Rows | Notes |
|---|---:|---|
| `Cliente_export.csv` | 5,320 | all `status=ativo`; `share_token` empty |
| `Avaliacao_export.csv` | 10,520 | 10,517 `acompanhamento`, 3 `inicial`; `coach` blank on 10,517 |
| `Anamnese_export.csv` | 8 | 2 with blank `cliente_id`; 6 answered |
| `Agendamento_export.csv` | 9 | all `agendado` |
| `CalculoProteina_export.csv` | 4 | 1 points to a missing client |
| `ConjuntoAnamnese_export.csv` | 1 | |
| `SyncState_export.csv` | 3 | do not import |

This is well within Supabase Free's 500 MB database.

### 6.2 Data issues found (important)

1. **`User` export received.** `BioAvalia_App-users.csv` now exists, but it contains no Base44 user IDs. Use the three ID→email mappings in “Confirmed data decisions” above. Passwords cannot be exported; every user must receive an invite or reset their password.
2. **Duplicate client code `C5135` — resolved.** Discard “João Ninguém” (`6add22b0475af9fdf6d25200`, coach Jesus Ramaldes) and its dependent evaluation, anamneses, appointments and protein calculations. Keep “Jun Takakura” (`6adcf2fbd98b4d0fee1ab208`) with `C5135`.
3. **`Avaliacao.coach` blank on 10,517 rows — resolved.** Set every blank to `Jun Takakura`. The three non-blank rows are two “Jun Takakura” and one “Jesus Ramaldes”; the latter belongs to the discarded João client, so all remaining evaluations are “Jun Takakura”.
4. **One dangling `CalculoProteina.cliente_id`.** `Teste Meta` (`6ae148aab5f9eb09d2f1b6e7`) is not in `Cliente_export.csv`. Set `cliente_id` to null and keep the record, or create a prospect client from its data.
5. **Two anamneses with null `cliente_id`.** Keep null (prospect anamneses), or create prospects from name/WhatsApp if that matches the intended workflow.
6. **`SyncState` should not be migrated.** Google sync tokens are tied to the connector/account and should be reset. After reconnecting Google, do a full 7-day sync and store a new token.
7. **`share_token` is empty on all clients.** No existing public report links need preserving. New links will be generated by `ClienteDetail`.
8. **Service-created records.** `CalculoProteina` rows and `SyncState` rows have `created_by_id = service_...`. For protein records, set the owner to the linked client's owner (or the anamnesis owner) where possible; otherwise leave them owned by the admin/import account.
9. **Dates/numbers/JSON — handled by the importer.** The export uses ISO dates, JSON strings for `meta_proteica`, `perguntas`, `codigos`, and `"false"` strings for booleans. The importer parses these and normalizes `0000-00-00` birth dates and blank `share_token` values to `NULL`.
10. **Client `coach` names are inconsistent with ownership — open access decision.** 5,234 clients say “Jesus Ramaldes” but were created by the legacy ID mapped to Jun's admin account; 85 say “Jun Takakura”. The confirmed rule only changes evaluations, so clients keep the exported coach and all evaluations are “Jun Takakura”. The live smoke test confirmed that the Jesus account sees its 5,234 clients but **0 evaluations and 0 anamneses**. If Jesus should see those clients' clinical records, either add RLS policies based on the parent client's coach or assign those records to the Jesus account before go-live. Do not change the evaluation `coach` field without revisiting the confirmed data decision.

### 6.3 Import order and remapping

1. Create Supabase project, run schema/RLS migration.
2. Create the first admin account, promote it with SQL.
3. Create Supabase Auth users (invite or admin create) and fill `legacy_users.new_user_id` using the ID→email mapping above. Create/edit profiles with the correct `coach_nome` **before** importing business rows, so the coach-name uniqueness trigger can validate them.
4. Import `clientes`:
   - parse JSON, normalize empty strings to null (especially `share_token`, which is blank on every row);
   - exclude `6add22b0475af9fdf6d25200` (João Ninguém);
   - map `created_by_id` → `profiles.id` via `legacy_users`; fall back to the admin profile;
   - keep `legacy_id` = Base44 client `id`;
   - preserve `created_date`/`updated_date`.
5. Import `avaliacoes`:
   - map `cliente_id` via `legacy_id` map and skip rows linked to the discarded client;
   - set blank `coach` to `Jun Takakura`;
   - map owner; preserve IDs/timestamps.
6. Import `anamneses`:
   - map `cliente_id` (nullable) and skip rows linked to the discarded client;
   - parse `perguntas` and `meta_proteica`;
   - preserve tokens (they are still valid public links).
7. Import `agendamentos` (map client; skip discarded client; preserve Google event IDs only if reusing the same calendar).
8. Import `calculos_proteina` (map client; skip discarded client; null out the dangling `Teste Meta` link; preserve tokens).
9. Import `conjuntos_anamnese`.
10. Drop `legacy_users` after verification.
11. Verify the expected counts: 5,319 clients, 10,519 evaluations, 6 anamneses, 7 agendamentos, 2 protein calculations, 1 question set.

Suggested script: `scripts/import-csv.mjs` using `@supabase/supabase-js` + `csv-parse`, run with the **service role key** locally only:

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/import-csv.mjs --dry-run
```

Make the script idempotent: upsert by `legacy_id`, so a failed import can be re-run. It should print counts and fail loudly on duplicate codes/dangling FKs.

### 6.4 Verification queries

```sql
select count(*) from clientes;                    -- 5319 (João Ninguém discarded)
select count(*) from avaliacoes;                  -- 10519
select count(*) from anamneses;                   -- 6 (two belonged to João)
select count(*) from agendamentos;                -- 7 (two belonged to João)
select count(*) from calculos_proteina;           -- 2 (two belonged to João)
select count(*) from conjuntos_anamnese;          -- 1
select coach, count(*) from avaliacoes group by coach; -- Jun Takakura: 10519
select count(*) from avaliacoes a
  left join clientes c on c.id = a.cliente_id
  where c.id is null;                              -- 0
select codigo, count(*) from clientes
  group by codigo having count(*) > 1;             -- 0 after cleanup
```

---

## 7. Auth and user cutover

### 7.1 What can and cannot be migrated

- **Can:** email, display name, coach name, role, `medidas_ativas`, `mostrar_navy`, and record ownership.
- **Cannot:** Base44 password hashes (not exported) or Base44 OAuth identities.
- **Result:** every user must set a new password or sign in with Google. Plan a password-reset/invite campaign.

### 7.2 Steps

1. Use the provided `BioAvalia_App-users.csv` (3 accounts).
2. Create Supabase Auth users:
   - Dashboard → Authentication → Users → Invite, or
   - Admin API with `auth.admin.createUser({ email, email_confirm: true })`, or
   - let users self-register and map them afterward.
3. Set `profiles.legacy_base44_id` and `coach_nome` for each.
4. Remap `created_by_id` on imported records with SQL:
   ```sql
   update clientes c
   set created_by_id = p.id
   from profiles p
   where p.legacy_base44_id = c.legacy_created_by_id;
   ```
   (Add a `legacy_created_by_id` column to each imported table, or keep it in a temporary mapping table.)
5. Promote the first admin:
   ```sql
   update profiles set role = 'admin' where email = 'owner@example.com';
   ```
6. Configure custom SMTP before inviting users.
7. Keep `coach_nome` consistent with the `coach` field on clients/evaluations; otherwise coach-name RLS won't show imported records.

If the Base44 user export is impossible, fallback: import everything under one admin owner, preserve `coach` names on clients, derive evaluations' `coach` from clients, and create coach accounts later. Admins can see everything; coaches will see records by `coach` name after their profile is set.

---

## 8. Google Calendar integration

Base44's connector and workflow do not exist outside Base44. Reconnect the shared calendar.

### 8.1 Recommended: service account + shared calendar

For a small app with one shared calendar, this is the most reliable free approach:

1. Create a Google Cloud project and enable the Calendar API.
2. Create a service account and download its JSON key.
3. Share the owner's calendar (or a dedicated "BioAvalia" calendar) with the service account email, permission "Make changes to events".
4. Store the service account email/key in Supabase Edge Function secrets:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_CALENDAR_ID` (the shared calendar's ID, often the owner's email)
5. Sign a JWT with the service account key and exchange it for an access token (`https://oauth2.googleapis.com/token`, grant `urn:ietf:params:oauth:grant-type:jwt-bearer`). Use `calendarId` instead of `primary`.
6. Implement the Google functions using the ported `_shared/googleCalendar.ts` helpers (`intervaloEvento`, `dataHoraDoEvento`, `tituloEvento`, token exchange, etc.). As built, the functions keep the Base44 names (`statusGoogleAgenda`, `criarEventoGoogle`, `reagendarEventoGoogle`, `sincronizarAgendaGoogle`, `sincronizarFuturosGoogle`).

Advantages: no user consent screen, no refresh-token expiry, no Google app verification. Disadvantage: the owner must share the calendar once with the service account.

### 8.2 Alternative: OAuth refresh token

If events must go to the owner's primary calendar and the owner prefers a "Connect Google" button:

1. Google Cloud OAuth client (Web), scopes `calendar.events` and `email`.
2. Admin-only `google-oauth-start` redirects to Google with `access_type=offline&prompt=consent`.
3. `google-oauth-callback` exchanges the code and stores the refresh token in a service-role-only table or Supabase Vault.
4. Functions exchange the refresh token for an access token and call the Calendar API.
5. Be aware: an OAuth app in "Testing" mode expires refresh tokens after 7 days; production use requires publishing/verification of sensitive scopes.

### 8.3 Sync strategy

Current behavior: `Agenda.jsx` calls `sincronizarAgendaGoogle` on load; the Base44 workflow also reacts to Google events. Self-hosted options:

- **Minimum:** keep the on-load sync; remove the workflow. Works for users who open the Agenda page.
- **Better:** add a scheduled job:
  - Supabase `pg_cron` + `pg_net` calls a new admin-only `sync-all` action/function every 15–60 minutes; or
  - Vercel Cron (Hobby allows only daily cron jobs; Pro allows more).
- **Real-time:** Google Calendar `watch` channels + public webhook. More setup: verify domain, renew channels, handle notifications. Defer unless required.

`SyncState` rows are not imported. On first sync, the function does a 7-day full sync (`timeMin`) and saves a fresh `syncToken`.

If reusing the same Google account/calendar, existing `google_event_id`/`google_link` values remain valid. If switching calendars, clear both columns on all appointments and use "Enviar ao Google" to recreate future events.

---

## 9. AI analysis function

`base44/functions/anamneseAnalise/entry.ts` used `base44.asServiceRole.integrations.Core.InvokeLLM({ prompt })`. The Edge Function now calls an HTTP LLM provider directly:

- **Google Gemini** free tier: `generativelanguage.googleapis.com` (`GEMINI_API_KEY`).
- **Groq** free tier: fast Llama models (`GROQ_API_KEY`).
- **OpenRouter** free models: easiest provider fallback (`OPENROUTER_API_KEY`).

Provider selection: `AI_PROVIDER` if set, otherwise the first configured key in the order Gemini → Groq → OpenRouter. `AI_ENABLED=false` disables the feature. Optional model overrides: `GEMINI_MODEL`, `GROQ_MODEL`, `OPENROUTER_MODEL`.

Implementation notes (as built):

- Kept the existing prompt and WhatsApp-friendly formatting rules.
- Uses the anamnesis answers and last evaluation context exactly as today.
- Verifies the caller owns the anamnesis or is admin via RLS.
- Returns `{ recomendacao }`; missing configuration returns 503 with a friendly message.
- 45-second timeout; provider errors return 502.
- **Privacy:** anamnesis answers and body-composition data are sensitive health data. Free LLM tiers may use inputs to improve their products. Use a paid/enterprise tier with no-training terms, or keep AI disabled until this is reviewed. Update the privacy policy and obtain consent.

---

## 10. Vercel + Supabase deployment

### 10.1 Environment variables

Local credential templates (all gitignored): `.env.local` (frontend), `.env.import.local` (CLI/import), `.env.integrations.local` (Edge Function secrets), `.env.deploy.local` (Vercel + SMTP) and `.import-credentials.local` (temporary passwords).

Frontend (Vercel, safe to expose):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-anon-key>
```

Server-side (Supabase Edge Function secrets, **never** in Vercel/Vite):

```env
SUPABASE_SERVICE_ROLE_KEY=...       # provided automatically in Edge Functions
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
GOOGLE_CALENDAR_ID=...
GEMINI_API_KEY=...
AI_ENABLED=true
APP_URL=https://bioavalia.vercel.app
# Optional AI alternatives: GROQ_API_KEY / OPENROUTER_API_KEY
# Optional OAuth Calendar alternative:
# GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=...
```

If you choose Vercel API routes instead of Supabase Edge Functions, put server secrets in Vercel and never prefix them with `VITE_`.

### 10.2 Supabase setup

```bash
supabase login
supabase link --project-ref <ref>
supabase db push                 # applies migrations
supabase functions deploy        # deploys all functions; config sets verify_jwt per function
```

`supabase/config.toml` sets `verify_jwt = false` only for `getPublicReport`, `anamnesePublic` and `proteinaPublic`. All other functions require a user JWT.

Configure:

- Authentication → URL Configuration: Site URL and redirect URLs (`https://<app>.vercel.app/**`, `http://localhost:5173/**`).
- Authentication → Providers: Google (client ID/secret) if used.
- Authentication → Emails: custom SMTP (Resend/Brevo) and templates.
- Database → Extensions: `pgcrypto`, `pg_cron`, `pg_net` if using scheduled sync.
- Storage: optional avatars bucket, or just use `public/`.

### 10.3 Vercel setup

`vercel.json`:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Then:

1. Import the Git repo into Vercel.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Production/Preview/Development.
3. Deploy. Vercel serves the SPA; all dynamic work goes to Supabase.
4. Add the custom domain and update Supabase Auth redirect URLs.

Not done yet: the production Vercel deploy and the Auth URL switch. The repository is prepared (`vercel.json` is versioned), but no Vercel project/team credentials were available in this environment.

### 10.4 Local development

```bash
npm install
npm run dev
# optional local Supabase:
supabase start
supabase db reset
supabase functions serve
```

`npm run dev` no longer needs the Base44 plugin or `base44 dev`. If using local Supabase, set `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from `supabase status`.

### 10.5 Free-tier caveats

- **Vercel Hobby is for personal, non-commercial use** under Vercel's fair-use policy. A clinic/professional app likely needs Vercel Pro, or a free commercial-friendly static host (Cloudflare Pages/Netlify) for the SPA.
- **Supabase Free** projects pause after about a week of inactivity, have limited/no backup guarantees, shared CPU, and a 500 MB database cap. Daily use keeps the project active. For health data, review the plan's backup/DPA/region terms; consider Supabase Pro.
- **Supabase Auth built-in email** is rate-limited; use custom SMTP.
- **LGPD:** body-composition and anamnesis data are sensitive health data. Choose a region close to Brazil (São Paulo if available), document the data processor, configure backups, and review the privacy policy/consent. Free tiers may not provide the contractual guarantees a clinic needs.
- **Google Calendar API** quotas are generous for this volume, but OAuth verification and test-mode token expiry are the real constraints.
- **LLM free tiers** may train on data; see §9.

---

## 11. Cutover checklist

### Before touching code

- [x] Export `User` entity from Base44 (received `BioAvalia_App-users.csv`).
- [x] Download/back up all CSVs and the Git repo.
- [ ] Create a migration branch/tag.
- [ ] Decide Vercel plan (Hobby commercial restriction) and Supabase region.
- [ ] Create Google Cloud service account or OAuth client; create LLM key; set up SMTP.

### Backend

- [x] Create Supabase project.
- [x] Write schema, RLS, triggers, indexes, RPCs (`supabase/migrations/20261028000000_init.sql`).
- [x] Apply schema to the project, including `20261028000100_hardening.sql`.
- [ ] Deploy Edge Functions and shared code.
- [ ] Configure secrets, Auth URLs, Google provider, SMTP.
- [x] Create first admin and promote via SQL.
- [x] Create/invite the known users and map `legacy_base44_id` **before importing clients**.
- [x] Run import script in dry-run and apply the confirmed decisions.
- [x] Import data; remap `created_by_id`; run verification queries.
- [x] Test RLS with admin, the Jesus coach account, and anonymous access. JunT and CRUD-by-role tests remain.
- [ ] Resolve the coach-access decision: the Jesus account currently sees its clients but not their evaluations or anamneses.

### Frontend

- [x] Remove Base44 packages/plugin/env.
- [x] Add Supabase client + compatibility adapter.
- [x] Rewrite AuthContext and auth pages.
- [x] Replace imports/`base44.` calls.
- [x] Remove Base44 assets/dead code; localize avatars.
- [x] Update `index.html`, `README.md`, `.npmrc`, `vite.config.js`.
- [x] Add `vercel.json`, `.env.example`.
- [x] `npm run lint` and `npm run build` pass.

### Validation

- [ ] Login, logout, register, email confirmation/OTP, Google login, password reset.
- [ ] CRUD for clients, evaluations, anamneses, appointments, protein calculations, question sets.
- [ ] Import/export CSV still works (including 500-row batches).
- [ ] Public report link: correct data, no `notas_profissional`, no owner IDs.
- [ ] Public anamnesis + protein calculator: save answers, create/link prospect, calculate.
- [ ] Google Calendar: status, create, reschedule, sync, send future.
- [ ] AI analysis (if enabled).
- [ ] Admin: list users, change coach name, change role, remove user.
- [ ] Mobile/desktop UI spot checks; SPA deep links on Vercel.
- [ ] Performance with 10k evaluations; pagination.

### Cutover

- [ ] Freeze writes in Base44; take a final export.
- [ ] Import final delta (or re-run idempotent import).
- [ ] Deploy production frontend; update DNS.
- [ ] Send password-reset/invite emails.
- [ ] Monitor Supabase logs/function errors for 48 hours.
- [ ] Archive Base44 repo/config; remove Base44 credentials.
- [ ] Keep a read-only copy of the old Base44 data for the retention period.

### Rollback

- Keep the old Base44 app and a database dump available until the new app has been stable for at least one billing cycle.
- Keep the migration branch; reverting the frontend is a Git revert plus restoring Base44 env if the old service is still alive.
- If you cut over and then find data issues, fix them in Supabase; do not write back to Base44.

---

## 12. Suggested implementation order

1. **Schema + adapter + auth** — get login and a read-only client list working against Supabase.
2. **Entity CRUD** — clients, evaluations, anamneses, appointments, protein records, question sets.
3. **Public functions** — public report, anamnesis, protein calculator.
4. **Data import + user mapping** — validate counts and RLS.
5. **Google Calendar** — service account/oauth, create/reschedule/sync.
6. **AI** — feature-flagged, after privacy review.
7. **Cleanup** — remove Base44 packages, assets, dead code, README.
8. **Deploy** — Vercel + Supabase, test, cut over.

The first code milestone should be a branch where the app can log in with Supabase and list clients/evaluations. That validates the adapter, RLS and session handling before porting the rest.
