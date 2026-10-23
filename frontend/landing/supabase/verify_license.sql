-- AegisOne portal — license verification for deployed cores
-- ----------------------------------------------------------
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.  Safe to re-run.
--
-- Every on-prem core (and the vendor Model Hub) calls this with its ORG_ID, LICENSE_KEY and
-- DEPLOYMENT_TOKEN (see api/services/license.py). It returns only what the core needs:
-- validity, plan, seat limit and expiry — never other organizations' data. The three values must
-- all match one row, so knowing an org id alone proves nothing. Status 'approved' = active.
--
-- The core calls it with the project's public (anon) key:
--   AEGIS_REGISTRY_URL=https://<project>.supabase.co   AEGIS_REGISTRY_KEY=<anon key>

alter table public.organizations add column if not exists plan text default 'standard';
alter table public.organizations add column if not exists license_expires_at timestamptz;

create or replace function public.verify_license(
  p_org_id           text,
  p_license_key      text,
  p_deployment_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  o public.organizations;
  v_status text;
begin
  select * into o from public.organizations
   where org_id = p_org_id and license_key = p_license_key
     and coalesce(deployment_token, '') = coalesce(p_deployment_token, '')
   limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'status', 'invalid', 'reason', 'Unknown organization, license key or deployment token.');
  end if;

  v_status := lower(coalesce(o.status, 'pending'));
  if o.license_expires_at is not null and o.license_expires_at < now() then
    return jsonb_build_object('valid', false, 'status', 'expired', 'org_name', o.name,
                              'reason', 'License expired on ' || to_char(o.license_expires_at, 'YYYY-MM-DD') || '.');
  end if;
  if v_status not in ('approved', 'active') then
    return jsonb_build_object('valid', false, 'status', v_status, 'org_name', o.name,
                              'reason', 'Organization status is ' || v_status || '.');
  end if;

  return jsonb_build_object(
    'valid', true, 'status', 'active', 'org_name', o.name,
    'plan', coalesce(o.plan, 'standard'),
    'allowed_users', o.allowed_users,
    'expires_at', o.license_expires_at
  );
end;
$$;

revoke all on function public.verify_license(text, text, text) from public;
grant execute on function public.verify_license(text, text, text) to anon, authenticated;
