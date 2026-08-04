-- Minimal stand-in for the Supabase-managed pieces, so the real migrations can
-- be applied to a plain Postgres for validation.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- Settable per-session so policies can be exercised as different users.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end;
$$;

grant usage on schema public to authenticated, anon, service_role;

-- Supabase grants these on a real project. SECURITY INVOKER functions such as
-- save_register call auth.uid() as the caller, so without this they fail with
-- "permission denied for schema auth" here but work in production, which is the
-- worst kind of test-environment difference.
grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;
grant select on auth.users to authenticated, anon, service_role;
