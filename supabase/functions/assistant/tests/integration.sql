-- Run only against a disposable PostgreSQL database after the migration.
-- dblink is used to verify real concurrent transactions, not an in-memory mock.
\set ON_ERROR_STOP on
begin;
do $$
<<test_case>>
declare s jsonb; r jsonb; v_lease uuid; id uuid := '70000000-0000-4000-8000-000000000001'; t uuid := '71000000-0000-4000-8000-000000000001'; b jsonb;
begin
  if has_table_privilege('anon', 'public.assistant_sessions', 'SELECT') or
     has_table_privilege('authenticated', 'public.assistant_turns', 'SELECT') or
     has_function_privilege('anon', 'public.assistant_get_session(uuid,text)', 'EXECUTE') or
     has_function_privilege('authenticated', 'public.assistant_take_quota(jsonb)', 'EXECUTE') then
    raise exception 'Assistant data/functions are accessible to an untrusted role';
  end if;
  if not has_function_privilege('service_role', 'public.assistant_get_session(uuid,text)', 'EXECUTE') then raise exception 'Service RPC grant missing'; end if;
  if (select count(*) from pg_class where relname in ('assistant_sessions','assistant_turns','assistant_usage') and relrowsecurity) <> 3 then raise exception 'RLS missing'; end if;

  s := assistant_create_session(id, 'test-capability-hash', 'chat', 'hashed-ip', '[]');
  if s->>'status' <> 'created' then raise exception 'Session create failed'; end if;
  if (s->>'expiresAt')::timestamptz not between now()+interval '23 hours' and now()+interval '25 hours' then raise exception 'Wrong session expiry'; end if;
  if assistant_get_session(id, 'wrong-hash')->>'status' <> 'not_found' then raise exception 'Wrong capability read allowed'; end if;
  if assistant_delete_session(id, 'wrong-hash')->>'status' <> 'not_found' then raise exception 'Wrong capability delete allowed'; end if;
  if assistant_get_session('70000000-0000-4000-8000-000000000099', 'test-capability-hash')->>'status' <> 'not_found' then raise exception 'Foreign session read allowed'; end if;
  r := assistant_reserve_turn(id, 'test-capability-hash', t, 'transcription', 'hash', null, 'en', 0, 30, '[]');
  if r->>'status' <> 'wrong_scope' then raise exception 'Chat capability acquired transcription privilege'; end if;
  b := jsonb_build_array(jsonb_build_object('key','test:chat','start',date_trunc('day',now()),'end',date_trunc('day',now())+interval '1 day','limit',3,'amount',1));
  r := assistant_reserve_turn(id, 'test-capability-hash', t, 'chat', 'input-hash', 'sanitized user text', 'en', 1200, 0, b);
  if r->>'status' <> 'reserved' then raise exception 'Reserve failed'; end if;
  v_lease := (r->>'leaseId')::uuid;
  if assistant_reserve_turn(id,'test-capability-hash',t,'chat','input-hash','sanitized user text','en',1200,0,b)->>'status' <> 'pending' then raise exception 'In-flight request replayed'; end if;
  if assistant_reserve_turn(id,'test-capability-hash','71000000-0000-4000-8000-000000000002','chat','other','another turn','en',1200,0,b)->>'status' <> 'busy' then raise exception 'Concurrent same-session request allowed'; end if;
  if (assistant_finish_turn(id,t,gen_random_uuid(),'{"answer":"wrong"}',false,10)->>'ok')::boolean then raise exception 'Wrong lease committed'; end if;
  if not (assistant_finish_turn(id,t,v_lease,'{"turnId":"71000000-0000-4000-8000-000000000001","answer":"Reviewed answer","status":"complete"}',false,10)->>'ok')::boolean then raise exception 'Finish failed'; end if;
  if assistant_reserve_turn(id,'test-capability-hash',t,'chat','input-hash','sanitized user text','en',1200,0,b)->>'status' <> 'cached' then raise exception 'Completed request not idempotent'; end if;
  if assistant_reserve_turn(id,'test-capability-hash',t,'chat','changed-input','changed','en',1200,0,b)->>'status' <> 'conflict' then raise exception 'Turn ID reused with changed input'; end if;
  if (select used from assistant_usage where bucket_key='test:chat') <> 1 then raise exception 'Replay consumed quota'; end if;
  if jsonb_array_length(assistant_get_session(id,'test-capability-hash')->'turns') <> 1 then raise exception 'History missing'; end if;
  if assistant_feedback(id,'wrong',t,true)->>'status' <> 'not_found' then raise exception 'Wrong capability feedback allowed'; end if;
  if assistant_feedback(id,'test-capability-hash',t,true)->>'status' <> 'saved' then raise exception 'Feedback failed'; end if;

  t := '71000000-0000-4000-8000-000000000003';
  r := assistant_reserve_turn(id,'test-capability-hash',t,'chat','interrupted','interrupted','en',1200,0,b);
  update assistant_turns set lease_expires_at=now()-interval '1 second' where session_id=id and turn_id=t;
  if assistant_reserve_turn(id,'test-capability-hash',t,'chat','interrupted','interrupted','en',1200,0,b)->>'status' <> 'failed' then raise exception 'Expired lease reissued provider request'; end if;
  if (select used from assistant_usage where bucket_key='test:chat') <> 2 then raise exception 'Interrupted reservation incorrectly refunded'; end if;

  r := assistant_take_quota(jsonb_build_array(
    jsonb_build_object('key','test:atomic:a','start',date_trunc('day',now()),'end',date_trunc('day',now())+interval '1 day','limit',2,'amount',1),
    jsonb_build_object('key','test:atomic:b','start',date_trunc('day',now()),'end',date_trunc('day',now())+interval '1 day','limit',1,'amount',2)));
  if (r->>'ok')::boolean then raise exception 'Exceeded quota accepted'; end if;
  if exists(select 1 from assistant_usage where bucket_key like 'test:atomic:%' and used<>0) then raise exception 'Failed multi-bucket reservation partly charged'; end if;
  update assistant_sessions set expires_at=now()-interval '1 second' where assistant_sessions.id=test_case.id;
  if assistant_get_session(id,'test-capability-hash')->>'status' <> 'not_found' then raise exception 'Expired session readable'; end if;
  perform assistant_cleanup();
  if exists(select 1 from assistant_turns where session_id=id) then raise exception 'Expired session turns not deleted'; end if;
end $$;
rollback;

-- Actual anon role calls must fail; RLS is not just a convention in the handler.
begin;
set local role anon;
do $$ begin
  begin perform * from public.assistant_sessions; raise exception 'Unexpected table read'; exception when insufficient_privilege then null; end;
  begin perform public.assistant_get_session(gen_random_uuid(),'wrong'); raise exception 'Unexpected RPC call'; exception when insufficient_privilege then null; end;
end $$;
rollback;

create extension if not exists dblink;
select assistant_create_session('70000000-0000-4000-8000-000000000010','concurrent-a','chat','test-ip','[]');
select assistant_create_session('70000000-0000-4000-8000-000000000011','concurrent-b','chat','test-ip','[]');
create or replace function public.assistant_test_compete(p_id uuid, p_cap text, p_turn uuid)
returns text language plpgsql as $$
declare r jsonb; b jsonb;
begin
  b := jsonb_build_array(jsonb_build_object('key','test:concurrent:global','start',date_trunc('day',now()),'end',date_trunc('day',now())+interval '1 day','limit',1,'amount',1));
  r := assistant_reserve_turn(p_id,p_cap,p_turn,'chat','input','hello','en',100,0,b);
  perform pg_sleep(0.2);
  return r->>'status';
end $$;
select dblink_connect('a', format('host=127.0.0.1 port=%s dbname=%s user=%s', current_setting('port'), current_database(), current_user));
select dblink_connect('b', format('host=127.0.0.1 port=%s dbname=%s user=%s', current_setting('port'), current_database(), current_user));
select dblink_send_query('a', $$select public.assistant_test_compete('70000000-0000-4000-8000-000000000010','concurrent-a','71000000-0000-4000-8000-000000000010')$$);
select dblink_send_query('b', $$select public.assistant_test_compete('70000000-0000-4000-8000-000000000011','concurrent-b','71000000-0000-4000-8000-000000000011')$$);
create temporary table competing_results(result text);
insert into competing_results select result from dblink_get_result('a') as t(result text);
insert into competing_results select result from dblink_get_result('b') as t(result text);
do $$ begin
  if (select count(*) from competing_results where result='reserved')<>1 or
     (select count(*) from competing_results where result='quota')<>1 or
     (select used from assistant_usage where bucket_key='test:concurrent:global')<>1 then
    raise exception 'Concurrent global quota was not enforced atomically';
  end if;
end $$;
select dblink_disconnect('a');
select dblink_disconnect('b');
drop function public.assistant_test_compete(uuid,text,uuid);
delete from assistant_sessions where id in ('70000000-0000-4000-8000-000000000010','70000000-0000-4000-8000-000000000011');
delete from assistant_usage where bucket_key='test:concurrent:global';
\echo 'Assistant PostgreSQL access, lease, retention, idempotency and concurrent quota tests passed.'
