-- Assistant data is accessible only through service-role RPCs. Never grant these
-- tables or functions to anon/authenticated; capabilities are checked in the RPCs.
create table if not exists public.assistant_sessions (
  id uuid primary key,
  capability_hash text not null unique,
  scope text not null check (scope in ('chat', 'transcription')),
  ip_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists public.assistant_turns (
  session_id uuid not null references public.assistant_sessions(id) on delete cascade,
  turn_id uuid not null,
  kind text not null check (kind in ('chat', 'transcription')),
  input_hash text not null,
  message text,
  language text not null check (language in ('en', 'ur', 'ur-Latn')),
  state text not null check (state in ('pending', 'complete', 'failed')),
  lease_id uuid not null,
  lease_expires_at timestamptz not null,
  result jsonb,
  helpful boolean,
  reserved_tokens integer not null default 0,
  reserved_audio_seconds integer not null default 0,
  actual_tokens integer,
  created_at timestamptz not null default now(),
  primary key (session_id, turn_id)
);
create index if not exists assistant_sessions_expiry on public.assistant_sessions(expires_at);
create index if not exists assistant_turns_pending on public.assistant_turns(session_id, lease_expires_at) where state = 'pending';
create table if not exists public.assistant_usage (
  bucket_key text not null,
  window_start timestamptz not null,
  expires_at timestamptz not null,
  used bigint not null default 0 check (used >= 0),
  primary key (bucket_key, window_start)
);
create index if not exists assistant_usage_expiry on public.assistant_usage(expires_at);

alter table public.assistant_sessions enable row level security;
alter table public.assistant_turns enable row level security;
alter table public.assistant_usage enable row level security;
revoke all on public.assistant_sessions, public.assistant_turns, public.assistant_usage from anon, authenticated;

-- The caller supplies only server-generated buckets. Stable lock ordering makes
-- reservations atomic across all dimensions, even with multiple Edge instances.
create or replace function public.assistant_take_quota(p_buckets jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b jsonb; v_used bigint; v_retry integer := 0;
begin
  for b in select value from jsonb_array_elements(p_buckets) order by value->>'key', value->>'start' loop
    if (b->>'amount')::bigint < 0 or (b->>'limit')::bigint < 1 then
      raise exception 'Invalid quota configuration';
    end if;
    insert into assistant_usage(bucket_key, window_start, expires_at)
    values (b->>'key', (b->>'start')::timestamptz, (b->>'end')::timestamptz)
    on conflict do nothing;
    select used into v_used from assistant_usage
      where bucket_key = b->>'key' and window_start = (b->>'start')::timestamptz for update;
    if v_used + (b->>'amount')::bigint > (b->>'limit')::bigint then
      v_retry := greatest(v_retry, greatest(1, ceil(extract(epoch from ((b->>'end')::timestamptz - now())))::integer));
    end if;
  end loop;
  if v_retry > 0 then return jsonb_build_object('ok', false, 'retryAfter', v_retry); end if;
  for b in select value from jsonb_array_elements(p_buckets) loop
    update assistant_usage set used = used + (b->>'amount')::bigint
      where bucket_key = b->>'key' and window_start = (b->>'start')::timestamptz;
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.assistant_create_session(
  p_id uuid, p_capability_hash text, p_scope text, p_ip_hash text, p_buckets jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare q jsonb; v_expiry timestamptz;
begin
  if p_scope not in ('chat', 'transcription') then raise exception 'Invalid scope'; end if;
  q := assistant_take_quota(p_buckets);
  if not (q->>'ok')::boolean then return jsonb_build_object('status', 'quota', 'retryAfter', q->'retryAfter'); end if;
  v_expiry := now() + case when p_scope = 'chat' then interval '24 hours' else interval '15 minutes' end;
  insert into assistant_sessions(id, capability_hash, scope, ip_hash, expires_at)
    values (p_id, p_capability_hash, p_scope, p_ip_hash, v_expiry);
  return jsonb_build_object('status', 'created', 'id', p_id, 'expiresAt', v_expiry);
end;
$$;

create or replace function public.assistant_get_session(p_id uuid, p_capability_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s assistant_sessions; v_turns jsonb;
begin
  select * into s from assistant_sessions where id = p_id and capability_hash = p_capability_hash and expires_at > now();
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('turnId', turn_id, 'message', message) || result order by created_at), '[]'::jsonb)
    into v_turns from assistant_turns where session_id = p_id and kind = 'chat' and state = 'complete';
  return jsonb_build_object('status', 'found', 'id', s.id, 'scope', s.scope, 'expiresAt', s.expires_at, 'turns', v_turns);
end;
$$;

create or replace function public.assistant_delete_session(p_id uuid, p_capability_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from assistant_sessions where id = p_id and capability_hash = p_capability_hash and expires_at > now();
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  return jsonb_build_object('status', 'deleted');
end;
$$;

create or replace function public.assistant_reserve_turn(
  p_id uuid, p_capability_hash text, p_turn_id uuid, p_kind text, p_input_hash text,
  p_message text, p_language text, p_tokens integer, p_audio_seconds integer, p_buckets jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare s assistant_sessions; t assistant_turns; q jsonb; v_lease uuid := gen_random_uuid();
begin
  select * into s from assistant_sessions where id = p_id and capability_hash = p_capability_hash and expires_at > now() for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if (p_kind = 'chat' and s.scope <> 'chat') or (p_kind = 'transcription' and s.scope <> 'transcription') then
    return jsonb_build_object('status', 'wrong_scope');
  end if;
  select * into t from assistant_turns where session_id = p_id and turn_id = p_turn_id;
  if found then
    if t.input_hash <> p_input_hash then return jsonb_build_object('status', 'conflict'); end if;
    if t.state = 'complete' then return jsonb_build_object('status', 'cached', 'result', t.result); end if;
    if t.state = 'failed' then return jsonb_build_object('status', 'failed', 'result', t.result); end if;
    if t.lease_expires_at > now() then return jsonb_build_object('status', 'pending', 'retryAfter', 2); end if;
    -- An expired lease may already have reached the provider. Never replay it and
    -- risk a second request. Reservations remain conservatively charged.
    update assistant_turns set state = 'failed', result = '{"error":{"code":"interrupted","message":"This request was interrupted. Send a new message to continue."}}'::jsonb
      where session_id = p_id and turn_id = p_turn_id returning * into t;
    return jsonb_build_object('status', 'failed', 'result', t.result);
  end if;
  if exists (select 1 from assistant_turns where session_id = p_id and state = 'pending' and lease_expires_at > now()) then
    return jsonb_build_object('status', 'busy', 'retryAfter', 2);
  end if;
  q := assistant_take_quota(p_buckets);
  if not (q->>'ok')::boolean then return jsonb_build_object('status', 'quota', 'retryAfter', q->'retryAfter'); end if;
  insert into assistant_turns(session_id, turn_id, kind, input_hash, message, language, state, lease_id, lease_expires_at, reserved_tokens, reserved_audio_seconds)
    values (p_id, p_turn_id, p_kind, p_input_hash, p_message, p_language, 'pending', v_lease, now() + interval '45 seconds', p_tokens, p_audio_seconds);
  return jsonb_build_object('status', 'reserved', 'leaseId', v_lease);
end;
$$;

create or replace function public.assistant_finish_turn(
  p_id uuid, p_turn_id uuid, p_lease_id uuid, p_result jsonb, p_failed boolean, p_actual_tokens integer
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update assistant_turns set state = case when p_failed then 'failed' else 'complete' end,
    result = p_result, actual_tokens = p_actual_tokens
    where session_id = p_id and turn_id = p_turn_id and lease_id = p_lease_id and state = 'pending' and lease_expires_at > now();
  return jsonb_build_object('ok', found);
end;
$$;

create or replace function public.assistant_feedback(p_id uuid, p_capability_hash text, p_turn_id uuid, p_helpful boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from assistant_sessions where id = p_id and capability_hash = p_capability_hash and scope = 'chat' and expires_at > now()) then
    return jsonb_build_object('status', 'not_found');
  end if;
  update assistant_turns set helpful = p_helpful where session_id = p_id and turn_id = p_turn_id and kind = 'chat' and state = 'complete';
  return jsonb_build_object('status', case when found then 'saved' else 'not_found' end);
end;
$$;

create or replace function public.assistant_cleanup()
returns void language sql security definer set search_path = public as $$
  delete from assistant_sessions where expires_at <= now();
  delete from assistant_usage where expires_at < now() - interval '1 day';
$$;

revoke all on function public.assistant_take_quota(jsonb) from public, anon, authenticated;
revoke all on function public.assistant_create_session(uuid,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.assistant_get_session(uuid,text) from public, anon, authenticated;
revoke all on function public.assistant_delete_session(uuid,text) from public, anon, authenticated;
revoke all on function public.assistant_reserve_turn(uuid,text,uuid,text,text,text,text,integer,integer,jsonb) from public, anon, authenticated;
revoke all on function public.assistant_finish_turn(uuid,uuid,uuid,jsonb,boolean,integer) from public, anon, authenticated;
revoke all on function public.assistant_feedback(uuid,text,uuid,boolean) from public, anon, authenticated;
revoke all on function public.assistant_cleanup() from public, anon, authenticated;
grant execute on function public.assistant_create_session(uuid,text,text,text,jsonb), public.assistant_get_session(uuid,text),
  public.assistant_delete_session(uuid,text), public.assistant_reserve_turn(uuid,text,uuid,text,text,text,text,integer,integer,jsonb),
  public.assistant_finish_turn(uuid,uuid,uuid,jsonb,boolean,integer), public.assistant_feedback(uuid,text,uuid,boolean), public.assistant_cleanup() to service_role;

-- Schedule cleanup automatically when pg_cron is already available. Otherwise
-- run assistant_cleanup() daily with the scheduler described in deployment.md.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('aegis-assistant-cleanup', '17 * * * *', 'select public.assistant_cleanup()');
  end if;
end $$;
