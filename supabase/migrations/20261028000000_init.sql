-- BioAvalia2 — initial Supabase schema
--
-- Replaces the Base44 entities with Postgres tables that keep the same field
-- names the React UI already uses. The compatibility client in
-- src/api/dataClient.js translates the old Base44 query syntax to PostgREST.
--
-- Apply with:
--   supabase db push
-- or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

-- The RLS rule lets a coach read clients by coach name, so two accounts must
-- never share a name. The unique index only covers profiles; this trigger also
-- protects names that only exist on imported client records. Create/invite all
-- known coach accounts before importing clients: claiming a coach name that
-- already exists on client rows is intentionally blocked.
create or replace function public.assert_coach_name_available()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.coach_nome is null or btrim(new.coach_nome) = '' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and lower(btrim(coalesce(old.coach_nome, ''))) = lower(btrim(new.coach_nome)) then
    return new;
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id <> new.id
      and (
        lower(btrim(coalesce(p.coach_nome, ''))) = lower(btrim(new.coach_nome))
        or lower(btrim(coalesce(p.full_name, ''))) = lower(btrim(new.coach_nome))
        or lower(btrim(coalesce(p.email, ''))) = lower(btrim(new.coach_nome))
      )
  ) then
    raise exception 'coach name already in use' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.clientes c
    where lower(btrim(coalesce(c.coach, ''))) = lower(btrim(new.coach_nome))
      and (c.created_by_id is null or c.created_by_id <> new.id)
  ) then
    raise exception 'coach name already in use' using errcode = '23505';
  end if;

  return new;
end;
$$;

-- Role changes must not be possible through a direct profiles UPDATE, because a
-- user can update their own profile. This RPC is the only client-side path.
create or replace function public.admin_set_role(target_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_role not in ('admin', 'user') then
    raise exception 'invalid role' using errcode = '22023';
  end if;

  update public.profiles
  set role = p_role
  where id = target_id;
end;
$$;

-- Keep public.profiles in sync with Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, coach_nome)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    nullif(btrim(new.raw_user_meta_data->>'coach_nome'), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(profiles.full_name, excluded.full_name),
        updated_date = now();
  return new;
end;
$$;

create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  coach_nome text,
  role text not null default 'user' check (role in ('admin', 'user')),
  medidas_ativas text[],
  mostrar_navy boolean not null default true,
  legacy_base44_id text unique,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  nome text not null,
  codigo text unique,
  email text,
  notas text,
  whatsapp text,
  data_nascimento date,
  sexo text check (sexo in ('Feminino', 'Masculino')),
  altura numeric,
  grupo text,
  coach text,
  share_token text unique,
  status text not null default 'ativo'
    check (status in ('prospecto', 'ativo', 'pausado', 'encerrado')),
  objetivo text,
  data_inicio date,
  proxima_avaliacao date,
  meta_proteica jsonb,
  created_by_id uuid default auth.uid() references public.profiles (id) on delete set null,
  legacy_created_by_id text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  is_sample boolean not null default false
);

create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  coach text,
  data date not null,
  tipo text not null default 'acompanhamento'
    check (tipo in ('inicial', 'acompanhamento', 'final')),
  peso numeric,
  musculo numeric,
  idade_corporal numeric,
  imc numeric,
  gordura_corporal numeric,
  gordura_visceral numeric,
  metabolismo_basal numeric,
  altura numeric,
  pescoco numeric,
  antebraco_direito numeric,
  antebraco_esquerdo numeric,
  femur numeric,
  torax numeric,
  braco_direito numeric,
  braco_esquerdo numeric,
  cintura numeric,
  abdome numeric,
  quadril numeric,
  coxa_direita numeric,
  coxa_esquerda numeric,
  panturrilha_direita numeric,
  panturrilha_esquerda numeric,
  punho numeric,
  navy_gordura numeric,
  navy_massa_gorda numeric,
  navy_massa_magra numeric,
  observacoes_cliente text,
  notas_profissional text,
  created_by_id uuid default auth.uid() references public.profiles (id) on delete set null,
  legacy_created_by_id text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  is_sample boolean not null default false
);

create table if not exists public.anamneses (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  cliente_id uuid references public.clientes (id) on delete set null,
  nome text,
  whatsapp text,
  data date,
  token text not null unique,
  status text not null default 'pendente' check (status in ('pendente', 'respondida')),
  perguntas jsonb not null default '[]'::jsonb,
  meta_proteica jsonb,
  respondida_em timestamptz,
  created_by_id uuid default auth.uid() references public.profiles (id) on delete set null,
  legacy_created_by_id text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  is_sample boolean not null default false
);

create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  data date not null,
  hora text
    check (hora is null or hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  tipo text not null default 'avaliacao'
    check (tipo in ('avaliacao', 'retorno', 'anamnese', 'outro')),
  status text not null default 'agendado' check (status in ('agendado', 'cancelado')),
  google_event_id text,
  google_link text,
  created_by_id uuid default auth.uid() references public.profiles (id) on delete set null,
  legacy_created_by_id text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  is_sample boolean not null default false
);

create table if not exists public.calculos_proteina (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  cliente_id uuid references public.clientes (id) on delete set null,
  nome text,
  whatsapp text,
  coach text,
  token text not null unique,
  status text not null default 'pendente' check (status in ('pendente', 'respondida')),
  sexo text check (sexo in ('Feminino', 'Masculino')),
  idade numeric,
  peso numeric,
  altura numeric,
  nivel_atividade text check (nivel_atividade in ('sedentario', 'leve', 'moderado', 'intenso')),
  -- "perda_peso" is a legacy alias still handled by src/lib/proteina.js.
  objetivo text check (objetivo in ('bem_estar', 'ganho_massa', 'emagrecimento', 'perda_peso')),
  usa_glp1 boolean,
  fator numeric,
  gramas_dia numeric,
  refeicao_min numeric,
  refeicao_max numeric,
  refeicoes numeric,
  respondida_em timestamptz,
  created_by_id uuid default auth.uid() references public.profiles (id) on delete set null,
  legacy_created_by_id text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  is_sample boolean not null default false
);

create table if not exists public.conjuntos_anamnese (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  nome text not null,
  codigos text[] not null default '{}',
  created_by_id uuid default auth.uid() references public.profiles (id) on delete set null,
  legacy_created_by_id text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  is_sample boolean not null default false
);

create table if not exists public.sync_states (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  sync_token text not null,
  user_id uuid references public.profiles (id) on delete cascade,
  created_by_id uuid default auth.uid() references public.profiles (id) on delete set null,
  legacy_created_by_id text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  is_sample boolean not null default false,
  constraint sync_states_user_id_key unique (user_id)
);

-- Temporary import mapping table. It is intentionally inaccessible to anon and
-- authenticated roles; use the service-role key for the CSV import.
create table if not exists public.legacy_users (
  legacy_id text primary key,
  email text,
  coach_nome text,
  role text,
  new_user_id uuid references public.profiles (id) on delete set null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- Security-definer helpers keep policy evaluation independent from the row
-- being checked (prevents recursive RLS checks on profiles). These are created
-- after the tables because LANGUAGE SQL bodies are validated at creation time.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.my_coach_nome()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coach_nome
  from public.profiles
  where id = auth.uid();
$$;

-- Used by src/lib/coach.js. Checks both account names and names already used in
-- client records, without exposing the profiles table to non-admins.
create or replace function public.coach_name_taken(candidate text, except_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when candidate is null or btrim(candidate) = '' then false
      else
        exists (
          select 1
          from public.profiles p
          where (
              lower(btrim(coalesce(p.coach_nome, ''))) = lower(btrim(candidate))
              or lower(btrim(coalesce(p.full_name, ''))) = lower(btrim(candidate))
              or lower(btrim(coalesce(p.email, ''))) = lower(btrim(candidate))
            )
            and (except_id is null or p.id <> except_id)
        )
        or exists (
          select 1
          from public.clientes c
          where lower(btrim(coalesce(c.coach, ''))) = lower(btrim(candidate))
            and (except_id is null or c.created_by_id is distinct from except_id)
        )
    end;
$$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists clientes_created_by_idx on public.clientes (created_by_id);
create index if not exists clientes_coach_idx on public.clientes (coach);
create index if not exists clientes_coach_lower_idx on public.clientes (lower(btrim(coach)));
create index if not exists clientes_status_idx on public.clientes (status);
create index if not exists clientes_nome_idx on public.clientes (lower(nome));

create index if not exists avaliacoes_cliente_data_idx on public.avaliacoes (cliente_id, data desc);
create index if not exists avaliacoes_created_by_idx on public.avaliacoes (created_by_id);
create index if not exists avaliacoes_coach_idx on public.avaliacoes (coach);
create index if not exists avaliacoes_coach_lower_idx on public.avaliacoes (lower(btrim(coach)));

create index if not exists anamneses_cliente_idx on public.anamneses (cliente_id);
create index if not exists anamneses_status_idx on public.anamneses (status);

create index if not exists agendamentos_data_hora_idx on public.agendamentos (data, hora);
create index if not exists agendamentos_created_by_idx on public.agendamentos (created_by_id);
create index if not exists agendamentos_google_event_idx on public.agendamentos (google_event_id);

create index if not exists calculos_proteina_cliente_idx on public.calculos_proteina (cliente_id);
create index if not exists calculos_proteina_created_by_idx on public.calculos_proteina (created_by_id);
create index if not exists calculos_proteina_coach_lower_idx
  on public.calculos_proteina (lower(btrim(coach)));

create unique index if not exists profiles_coach_nome_key
  on public.profiles (lower(btrim(coach_nome)))
  where coach_nome is not null and btrim(coach_nome) <> '';

-- ---------------------------------------------------------------------------
-- updated_date triggers
-- ---------------------------------------------------------------------------

drop trigger if exists set_profiles_updated_date on public.profiles;
create trigger set_profiles_updated_date
  before update on public.profiles
  for each row execute function public.set_updated_date();

drop trigger if exists enforce_profiles_coach_name on public.profiles;
create trigger enforce_profiles_coach_name
  before insert or update of coach_nome on public.profiles
  for each row execute function public.assert_coach_name_available();

drop trigger if exists set_clientes_updated_date on public.clientes;
create trigger set_clientes_updated_date
  before update on public.clientes
  for each row execute function public.set_updated_date();

drop trigger if exists set_avaliacoes_updated_date on public.avaliacoes;
create trigger set_avaliacoes_updated_date
  before update on public.avaliacoes
  for each row execute function public.set_updated_date();

drop trigger if exists set_anamneses_updated_date on public.anamneses;
create trigger set_anamneses_updated_date
  before update on public.anamneses
  for each row execute function public.set_updated_date();

drop trigger if exists set_agendamentos_updated_date on public.agendamentos;
create trigger set_agendamentos_updated_date
  before update on public.agendamentos
  for each row execute function public.set_updated_date();

drop trigger if exists set_calculos_proteina_updated_date on public.calculos_proteina;
create trigger set_calculos_proteina_updated_date
  before update on public.calculos_proteina
  for each row execute function public.set_updated_date();

drop trigger if exists set_conjuntos_anamnese_updated_date on public.conjuntos_anamnese;
create trigger set_conjuntos_anamnese_updated_date
  before update on public.conjuntos_anamnese
  for each row execute function public.set_updated_date();

drop trigger if exists set_sync_states_updated_date on public.sync_states;
create trigger set_sync_states_updated_date
  before update on public.sync_states
  for each row execute function public.set_updated_date();

-- ---------------------------------------------------------------------------
-- Auth triggers
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_update();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.clientes enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.anamneses enable row level security;
alter table public.agendamentos enable row level security;
alter table public.calculos_proteina enable row level security;
alter table public.conjuntos_anamnese enable row level security;
alter table public.sync_states enable row level security;
alter table public.legacy_users enable row level security;

-- profiles: own row, or any row for admins. Users may only insert their own
-- missing profile row; the auth trigger normally does this first.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Clientes: owner, admin, or the coach named on the record.
drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes
  for select to authenticated
  using (
    created_by_id = auth.uid()
    or public.is_admin()
    or (coach is not null and lower(btrim(coach)) = lower(btrim(public.my_coach_nome())))
  );

drop policy if exists clientes_insert on public.clientes;
create policy clientes_insert on public.clientes
  for insert to authenticated
  with check (created_by_id = auth.uid() or public.is_admin());

drop policy if exists clientes_update on public.clientes;
create policy clientes_update on public.clientes
  for update to authenticated
  using (
    created_by_id = auth.uid()
    or public.is_admin()
    or (coach is not null and lower(btrim(coach)) = lower(btrim(public.my_coach_nome())))
  )
  with check (
    created_by_id = auth.uid()
    or public.is_admin()
    or (coach is not null and lower(btrim(coach)) = lower(btrim(public.my_coach_nome())))
  );

drop policy if exists clientes_delete on public.clientes;
create policy clientes_delete on public.clientes
  for delete to authenticated
  using (
    created_by_id = auth.uid()
    or public.is_admin()
    or (coach is not null and lower(btrim(coach)) = lower(btrim(public.my_coach_nome())))
  );

-- Avaliacoes: same as clientes (current Base44 rule).
drop policy if exists avaliacoes_select on public.avaliacoes;
create policy avaliacoes_select on public.avaliacoes
  for select to authenticated
  using (
    created_by_id = auth.uid()
    or public.is_admin()
    or (coach is not null and lower(btrim(coach)) = lower(btrim(public.my_coach_nome())))
  );

drop policy if exists avaliacoes_insert on public.avaliacoes;
create policy avaliacoes_insert on public.avaliacoes
  for insert to authenticated
  with check (created_by_id = auth.uid() or public.is_admin());

drop policy if exists avaliacoes_update on public.avaliacoes;
create policy avaliacoes_update on public.avaliacoes
  for update to authenticated
  using (
    created_by_id = auth.uid()
    or public.is_admin()
    or (coach is not null and lower(btrim(coach)) = lower(btrim(public.my_coach_nome())))
  )
  with check (
    created_by_id = auth.uid()
    or public.is_admin()
    or (coach is not null and lower(btrim(coach)) = lower(btrim(public.my_coach_nome())))
  );

drop policy if exists avaliacoes_delete on public.avaliacoes;
create policy avaliacoes_delete on public.avaliacoes
  for delete to authenticated
  using (
    created_by_id = auth.uid()
    or public.is_admin()
    or (coach is not null and lower(btrim(coach)) = lower(btrim(public.my_coach_nome())))
  );

-- Anamneses: owner or admin only.
drop policy if exists anamneses_select on public.anamneses;
create policy anamneses_select on public.anamneses
  for select to authenticated
  using (created_by_id = auth.uid() or public.is_admin());

drop policy if exists anamneses_insert on public.anamneses;
create policy anamneses_insert on public.anamneses
  for insert to authenticated
  with check (created_by_id = auth.uid() or public.is_admin());

drop policy if exists anamneses_update on public.anamneses;
create policy anamneses_update on public.anamneses
  for update to authenticated
  using (created_by_id = auth.uid() or public.is_admin())
  with check (created_by_id = auth.uid() or public.is_admin());

drop policy if exists anamneses_delete on public.anamneses;
create policy anamneses_delete on public.anamneses
  for delete to authenticated
  using (created_by_id = auth.uid() or public.is_admin());

-- Agendamentos: owner or admin only.
drop policy if exists agendamentos_select on public.agendamentos;
create policy agendamentos_select on public.agendamentos
  for select to authenticated
  using (created_by_id = auth.uid() or public.is_admin());

drop policy if exists agendamentos_insert on public.agendamentos;
create policy agendamentos_insert on public.agendamentos
  for insert to authenticated
  with check (created_by_id = auth.uid() or public.is_admin());

drop policy if exists agendamentos_update on public.agendamentos;
create policy agendamentos_update on public.agendamentos
  for update to authenticated
  using (created_by_id = auth.uid() or public.is_admin())
  with check (created_by_id = auth.uid() or public.is_admin());

drop policy if exists agendamentos_delete on public.agendamentos;
create policy agendamentos_delete on public.agendamentos
  for delete to authenticated
  using (created_by_id = auth.uid() or public.is_admin());

-- Calculos de proteina: owner, admin, or coach named on the record.
drop policy if exists calculos_proteina_select on public.calculos_proteina;
create policy calculos_proteina_select on public.calculos_proteina
  for select to authenticated
  using (
    created_by_id = auth.uid()
    or public.is_admin()
    or (coach is not null and lower(btrim(coach)) = lower(btrim(public.my_coach_nome())))
  );

drop policy if exists calculos_proteina_insert on public.calculos_proteina;
create policy calculos_proteina_insert on public.calculos_proteina
  for insert to authenticated
  with check (created_by_id = auth.uid() or public.is_admin());

drop policy if exists calculos_proteina_update on public.calculos_proteina;
create policy calculos_proteina_update on public.calculos_proteina
  for update to authenticated
  using (
    created_by_id = auth.uid()
    or public.is_admin()
    or (coach is not null and lower(btrim(coach)) = lower(btrim(public.my_coach_nome())))
  )
  with check (
    created_by_id = auth.uid()
    or public.is_admin()
    or (coach is not null and lower(btrim(coach)) = lower(btrim(public.my_coach_nome())))
  );

drop policy if exists calculos_proteina_delete on public.calculos_proteina;
create policy calculos_proteina_delete on public.calculos_proteina
  for delete to authenticated
  using (
    created_by_id = auth.uid()
    or public.is_admin()
    or (coach is not null and lower(btrim(coach)) = lower(btrim(public.my_coach_nome())))
  );

-- Conjuntos de anamnese: owner or admin only.
drop policy if exists conjuntos_anamnese_select on public.conjuntos_anamnese;
create policy conjuntos_anamnese_select on public.conjuntos_anamnese
  for select to authenticated
  using (created_by_id = auth.uid() or public.is_admin());

drop policy if exists conjuntos_anamnese_insert on public.conjuntos_anamnese;
create policy conjuntos_anamnese_insert on public.conjuntos_anamnese
  for insert to authenticated
  with check (created_by_id = auth.uid() or public.is_admin());

drop policy if exists conjuntos_anamnese_update on public.conjuntos_anamnese;
create policy conjuntos_anamnese_update on public.conjuntos_anamnese
  for update to authenticated
  using (created_by_id = auth.uid() or public.is_admin())
  with check (created_by_id = auth.uid() or public.is_admin());

drop policy if exists conjuntos_anamnese_delete on public.conjuntos_anamnese;
create policy conjuntos_anamnese_delete on public.conjuntos_anamnese
  for delete to authenticated
  using (created_by_id = auth.uid() or public.is_admin());

-- Sync state: owner or admin only.
drop policy if exists sync_states_select on public.sync_states;
create policy sync_states_select on public.sync_states
  for select to authenticated
  using (created_by_id = auth.uid() or public.is_admin());

drop policy if exists sync_states_insert on public.sync_states;
create policy sync_states_insert on public.sync_states
  for insert to authenticated
  with check (created_by_id = auth.uid() or public.is_admin());

drop policy if exists sync_states_update on public.sync_states;
create policy sync_states_update on public.sync_states
  for update to authenticated
  using (created_by_id = auth.uid() or public.is_admin())
  with check (created_by_id = auth.uid() or public.is_admin());

drop policy if exists sync_states_delete on public.sync_states;
create policy sync_states_delete on public.sync_states
  for delete to authenticated
  using (created_by_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.clientes, public.avaliacoes,
  public.anamneses, public.agendamentos, public.calculos_proteina,
  public.conjuntos_anamnese, public.sync_states, public.legacy_users
  from anon;

grant select, insert, update, delete on public.clientes to authenticated;
grant select, insert, update, delete on public.avaliacoes to authenticated;
grant select, insert, update, delete on public.anamneses to authenticated;
grant select, insert, update, delete on public.agendamentos to authenticated;
grant select, insert, update, delete on public.calculos_proteina to authenticated;
grant select, insert, update, delete on public.conjuntos_anamnese to authenticated;
grant select, insert, update, delete on public.sync_states to authenticated;

grant select on public.profiles to authenticated;
grant insert (id, email, full_name) on public.profiles to authenticated;
grant update (full_name, coach_nome, medidas_ativas, mostrar_navy)
  on public.profiles to authenticated;

grant all on public.profiles, public.clientes, public.avaliacoes,
  public.anamneses, public.agendamentos, public.calculos_proteina,
  public.conjuntos_anamnese, public.sync_states, public.legacy_users
  to service_role;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_coach_nome() to authenticated;
grant execute on function public.coach_name_taken(text, uuid) to anon, authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- The import table is for service-role use only.
revoke all on public.legacy_users from authenticated;
grant all on public.legacy_users to service_role;
