-- AegisOne portal — lock down the organizations table and generate license credentials on the server
-- ----------------------------------------------------------------------------------------------
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.  Safe to re-run.
-- Run AFTER register_organization.sql is no longer needed (this file replaces that function) and
-- together with verify_license.sql.
--
-- What it fixes
--   1. The organizations table was readable with the public (anon) key: every license key, deployment
--      token, admin e-mail and phone number could be listed from the browser. Row Level Security now
--      limits it to (a) the signed-in owner's own row and (b) platform super-admins.
--   2. License key / deployment token / org id were produced with Math.random() in the browser. They are
--      now produced here with gen_random_uuid() (cryptographically random) and the client values are ignored.
--   3. The super-admin RPCs (list / status / delete) now verify the caller's super_admin role themselves.
--   4. The registration page asked the table "does this name/e-mail exist" as anon; it now calls
--      organization_exists(), which returns only two booleans.
--
-- A super-admin is a Supabase user whose app_metadata.role = 'super_admin'
-- (users cannot edit app_metadata, unlike user_metadata).

-- ── helpers ───────────────────────────────────────────────────────────────────────────────────
create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'super_admin'
$$;

-- Random token helpers (uppercase hex groups).
create or replace function public._rand_hex(n integer)
returns text
language sql
volatile
as $$
  select upper(substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, n))
$$;

-- ── Row Level Security ────────────────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'organizations' loop
    execute format('drop policy %I on public.organizations', p.policyname);
  end loop;
end $$;

-- Owner reads only their own organization (portal + login).
create policy organizations_owner_select on public.organizations
  for select to authenticated
  using (auth.uid() = auth_user_id);

-- Platform super-admins manage everything.
create policy organizations_admin_all on public.organizations
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- anon gets no table access at all; signed-in users get table privileges, but the two policies above
-- decide which rows they may see or change (owners: read their own row only; no insert/update/delete).
revoke all on public.organizations from anon;
grant select, insert, update, delete on public.organizations to authenticated;

-- ── duplicate check for the registration form (no table access needed) ───────────────────────────
create or replace function public.organization_exists(p_name text, p_email text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'name_taken',  exists (select 1 from public.organizations o where lower(o.name) = lower(p_name)),
    'email_taken', exists (select 1 from public.organizations o where lower(o.admin_email) = lower(p_email))
  )
$$;
revoke all on function public.organization_exists(text, text) from public;
grant execute on function public.organization_exists(text, text) to anon, authenticated;

-- ── registration: credentials are generated here, never by the client ───────────────────────────
do $$
declare f record;
begin
  for f in select oid::regprocedure as sig from pg_proc
           where pronamespace = 'public'::regnamespace
             and proname in ('register_organization', 'get_all_organizations', 'list_organizations',
                             'get_organizations', 'get_organizations_admin', 'update_org_status',
                             'delete_organization_and_user', 'rotate_org_credentials') loop
    execute format('drop function %s', f.sig);
  end loop;
end $$;

create or replace function public.register_organization(
  p_auth_user_id     uuid,
  p_name             text,
  p_industry         text,
  p_employee_count   integer,
  p_country          text,
  p_admin_name       text,
  p_admin_email      text,
  p_phone            text,
  p_allowed_users    integer,
  p_product_version  text default '1.0.0',
  -- legacy client parameters: accepted so an older cached page keeps working, always ignored
  p_org_id           text default null,
  p_license_key      text default null,
  p_deployment_token text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.organizations;
  v_org_id text;
  v_letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
begin
  if not exists (
    select 1 from auth.users u
    where u.id = p_auth_user_id
      and lower(u.email) = lower(p_admin_email)
      and (u.email_confirmed_at is null or auth.uid() = p_auth_user_id)
  ) then
    raise exception 'Sign-up could not be verified. Please try again.';
  end if;

  if exists (select 1 from public.organizations o where o.auth_user_id = p_auth_user_id) then
    raise exception 'An organization is already registered for this account.';
  end if;

  -- Organization id: 3 letters + 3 digits (an identifier, not a secret); retry on the rare clash.
  loop
    v_org_id := substr(v_letters, 1 + floor(random() * 24)::int, 1)
             || substr(v_letters, 1 + floor(random() * 24)::int, 1)
             || substr(v_letters, 1 + floor(random() * 24)::int, 1)
             || lpad((100 + floor(random() * 900)::int)::text, 3, '0');
    exit when not exists (select 1 from public.organizations o where o.org_id = v_org_id);
  end loop;

  insert into public.organizations (
    auth_user_id, org_id, name, industry, employee_count, country,
    admin_name, admin_email, phone, status,
    license_key, deployment_token, allowed_users, product_version
  ) values (
    p_auth_user_id, v_org_id, p_name, p_industry, p_employee_count, p_country,
    p_admin_name, p_admin_email, p_phone, 'pending',                 -- never trust a client-supplied status
    public._rand_hex(4) || '-' || public._rand_hex(4) || '-' || public._rand_hex(4) || '-' || public._rand_hex(4),
    public._rand_hex(5) || '-' || public._rand_hex(5) || '-' || public._rand_hex(5),
    p_allowed_users, coalesce(p_product_version, '1.0.0')
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.register_organization(
  uuid, text, text, integer, text, text, text, text, integer, text, text, text, text
) from public;
grant execute on function public.register_organization(
  uuid, text, text, integer, text, text, text, text, integer, text, text, text, text
) to anon, authenticated;

-- ── super-admin functions (each checks the caller itself) ──────────────────────────────────────
create or replace function public.get_all_organizations()
returns setof public.organizations
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_super_admin() then raise exception 'Not authorized.' using errcode = '42501'; end if;
  return query select * from public.organizations order by created_at desc;
end;
$$;

create or replace function public.update_org_status(org_id_param text, status_param text, reason_param text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'Not authorized.' using errcode = '42501'; end if;
  if status_param not in ('active', 'pending', 'suspended') then raise exception 'Invalid status.'; end if;
  update public.organizations
     set status = status_param,
         product_version = case when reason_param is not null then reason_param else product_version end
   where id::text = org_id_param;
end;
$$;

create or replace function public.delete_organization_and_user(org_id_param text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user uuid;
begin
  if not public.is_super_admin() then raise exception 'Not authorized.' using errcode = '42501'; end if;
  select auth_user_id into v_user from public.organizations where id::text = org_id_param;
  delete from public.organizations where id::text = org_id_param;
  if v_user is not null then delete from auth.users where id = v_user; end if;
end;
$$;

-- Issue a fresh license key + deployment token (use after a leak, or to move an organization).
-- The old deployment stops verifying until it is re-installed with the new values.
create or replace function public.rotate_org_credentials(org_id_param text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.organizations;
begin
  if not public.is_super_admin() then raise exception 'Not authorized.' using errcode = '42501'; end if;
  update public.organizations
     set license_key = public._rand_hex(4) || '-' || public._rand_hex(4) || '-' || public._rand_hex(4) || '-' || public._rand_hex(4),
         deployment_token = public._rand_hex(5) || '-' || public._rand_hex(5) || '-' || public._rand_hex(5)
   where id::text = org_id_param or org_id = org_id_param
  returning * into v_row;
  return v_row;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.get_all_organizations()',
    'public.update_org_status(text,text,text)',
    'public.delete_organization_and_user(text)',
    'public.rotate_org_credentials(text)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ── Already-issued credentials were readable by anyone until now ───────────────────────────────
-- Existing organizations should receive new credentials. As a super-admin (or in the SQL editor):
--   select public.rotate_org_credentials(org_id) from public.organizations;   -- SQL editor has no JWT:
-- the functions above require a super_admin session, so in the editor use instead:
--   update public.organizations set
--     license_key = public._rand_hex(4)||'-'||public._rand_hex(4)||'-'||public._rand_hex(4)||'-'||public._rand_hex(4),
--     deployment_token = public._rand_hex(5)||'-'||public._rand_hex(5)||'-'||public._rand_hex(5);
-- Then give each customer their new install command from the portal.
