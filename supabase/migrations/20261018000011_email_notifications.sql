-- LAIRON EZ — Phase 8: email notifications (PLAN §7).
-- Flow: DB trigger -> emit_notification() -> pg_net HTTP POST -> Edge Function `notify` -> Resend. Emails never block the user action.

-- Richer email_log so a failed email can be retried from the Admin screen.
alter table email_log
  add column subject text,
  add column attempts int not null default 0,
  add column entity text,
  add column entity_id uuid,
  add column provider_id text,
  add column dedupe_key text,
  add column sent_at timestamptz,
  add column updated_at timestamptz not null default now();
create index on email_log (created_at desc);
create index on email_log (status);
-- A given notification is only ever SENT once per recipient, even if a webhook fires twice.
create unique index email_log_dedupe_sent on email_log (dedupe_key) where status = 'sent' and dedupe_key is not null;
create trigger trg_email_log_updated_at before update on email_log for each row execute function set_updated_at();

-- Private settings the triggers need (webhook URL + shared secret). RLS on, NO policies: only the service role / triggers read it.
create table edge_config (key text primary key, value text not null);
alter table edge_config enable row level security;
comment on table edge_config is 'notify_url and notify_secret for emit_notification(). Set once per environment; see docs/SETUP.md.';

do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net could not be enabled (%). Enable it in Dashboard > Database > Extensions.', sqlerrm;
end $$;

-- Fire-and-forget. Any problem (missing config, missing pg_net, network) is swallowed with a warning so the
-- transaction that caused it always succeeds.
create function emit_notification(p_event text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select value into v_url from edge_config where key = 'notify_url';
  select value into v_secret from edge_config where key = 'notify_secret';
  if v_url is null or v_secret is null then return; end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('event', p_event) || p_payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    timeout_milliseconds := 5000);
exception when others then
  raise warning 'notification % not sent: %', p_event, sqlerrm;
end $$;
revoke execute on function emit_notification(text, jsonb) from public, anon, authenticated;

-- Service requests: submitted, and decided (approved / rejected / fulfilled).
create function notify_batch() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if old.status = 'draft' and new.status = 'submitted' then
      perform emit_notification('service_request.submitted', jsonb_build_object('id', new.id));
    elsif new.status in ('approved', 'rejected', 'fulfilled') then
      perform emit_notification('service_request.decided', jsonb_build_object('id', new.id, 'status', new.status));
    end if;
  end if;
  return null;
end $$;
create trigger trg_notify_batch after update on service_request_batches for each row execute function notify_batch();

-- Starter packs: submitted (insert) and fulfilled. The webhook is sent after commit, so the items inserted by
-- create_starter_pack() right after the header are already there when `notify` loads the record.
create function notify_starter_pack() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform emit_notification('starter_pack.submitted', jsonb_build_object('id', new.id));
  elsif new.status is distinct from old.status and new.status = 'fulfilled' then
    perform emit_notification('starter_pack.fulfilled', jsonb_build_object('id', new.id));
  end if;
  return null;
end $$;
create trigger trg_notify_sp_insert after insert on starter_pack_requests for each row execute function notify_starter_pack();
create trigger trg_notify_sp_update after update on starter_pack_requests for each row execute function notify_starter_pack();

-- Leave: one email per REQUEST, not per day. Statement-level triggers see every row of the statement at once.
create function notify_leave_applied() returns trigger language plpgsql security definer set search_path = public as $$
declare v_ids uuid[];
begin
  select array_agg(id) into v_ids from new_rows where entry_type = 'leave' and leave_status = 'pending';
  if v_ids is not null then perform emit_notification('leave.applied', jsonb_build_object('ids', v_ids)); end if;
  return null;
end $$;
create trigger trg_notify_leave_applied after insert on driver_day_entries
  referencing new table as new_rows for each statement execute function notify_leave_applied();

create function notify_leave_decided() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select n.leave_status as status, array_agg(n.id) as ids
    from new_rows n join old_rows o on o.id = n.id
    where n.entry_type = 'leave' and o.leave_status = 'pending' and n.leave_status in ('approved', 'rejected')
    group by n.leave_status
  loop
    perform emit_notification('leave.decided', jsonb_build_object('ids', r.ids, 'status', r.status));
  end loop;
  return null;
end $$;
create trigger trg_notify_leave_decided after update on driver_day_entries
  referencing old table as old_rows new table as new_rows for each statement execute function notify_leave_decided();
