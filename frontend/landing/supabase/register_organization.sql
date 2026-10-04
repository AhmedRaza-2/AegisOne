-- AegisOne portal — organization registration without a signed-in session
-- ------------------------------------------------------------------------
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (CREATE OR REPLACE).
--
-- Why this exists
--   With "Confirm email" enabled, auth.signUp() creates the user but returns NO session until
--   the email link is clicked. The browser's follow-up INSERT into public.organizations therefore
--   runs as the `anon` role, and Row Level Security rejects it:
--       new row violates row-level security policy for table "organizations"
--   This function performs that insert on the server instead (SECURITY DEFINER bypasses RLS), but
--   only for an auth user that was just created with the same email, and always as 'pending'.
--
-- To see the policies currently on the table (optional):
--   select policyname, cmd, roles, qual, with_check from pg_policies where tablename = 'organizations';

create or replace function public.register_organization(
  p_auth_user_id     uuid,
  p_org_id           text,
  p_name             text,
  p_industry         text,
  p_employee_count   integer,
  p_country          text,
  p_admin_name       text,
  p_admin_email      text,
  p_phone            text,
  p_license_key      text,
  p_deployment_token text,
  p_allowed_users    integer,
  p_product_version  text
)
returns public.organizations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.organizations;
begin
  -- The caller must be the account's owner: the user id and email must match an existing login, and that
  -- login must either still be unconfirmed (a sign-up that just happened, or a retry of one) or be the
  -- signed-in caller itself (finishing an earlier registration whose email was already confirmed).
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

  insert into public.organizations (
    auth_user_id, org_id, name, industry, employee_count, country,
    admin_name, admin_email, phone, status,
    license_key, deployment_token, allowed_users, product_version
  ) values (
    p_auth_user_id, p_org_id, p_name, p_industry, p_employee_count, p_country,
    p_admin_name, p_admin_email, p_phone, 'pending',          -- never trust a client-supplied status
    p_license_key, p_deployment_token, p_allowed_users, p_product_version
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.register_organization(
  uuid, text, text, text, integer, text, text, text, text, text, text, integer, text
) from public;

grant execute on function public.register_organization(
  uuid, text, text, text, integer, text, text, text, text, text, text, integer, text
) to anon, authenticated;
