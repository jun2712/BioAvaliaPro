-- Security hardening found by `supabase db advisors` after the initial schema
-- was applied. This migration does not change the application data model.

-- Trigger functions do not need to be exposed through PostgREST. Trigger
-- execution does not require a runtime EXECUTE check, but the explicit revoke
-- keeps them out of the public RPC surface.
alter function public.set_updated_date() set search_path = pg_catalog, public;

revoke execute on function public.set_updated_date() from public, anon, authenticated;
revoke execute on function public.assert_coach_name_available() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_update() from public, anon, authenticated;

-- The auth admin inserts/updates auth.users and is the role that fires the
-- auth triggers. Grant explicitly instead of relying on PUBLIC.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
    grant execute on function public.handle_user_email_update() to supabase_auth_admin;
  end if;
end;
$$;

-- is_admin()/my_coach_nome() are referenced by RLS policies for signed-in
-- users. Never expose them to anon; admin_set_role already checks is_admin().
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.my_coach_nome() from public, anon;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;

grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.my_coach_nome() to authenticated, service_role;
grant execute on function public.admin_set_role(uuid, text) to authenticated, service_role;

-- coach_name_taken() is intentionally callable before login so the registration
-- screen can reject duplicate coach names. It only returns a boolean and does
-- not expose profile rows.
revoke execute on function public.coach_name_taken(text, uuid) from public;
grant execute on function public.coach_name_taken(text, uuid) to anon, authenticated, service_role;

-- The import mapping table is service-role only; RLS with no policy is
-- intentional defense in depth.
comment on table public.legacy_users is
  'Temporary Base44-to-Supabase owner mapping. Service-role only; RLS denies all normal API roles.';
