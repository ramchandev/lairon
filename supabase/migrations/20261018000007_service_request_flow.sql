-- LAIRON EZ — Phase 5: service-request flow rules.

-- One open draft per manager: get it, or create it. Safe to call repeatedly / concurrently.
create function get_or_create_draft_batch() returns uuid language plpgsql security invoker set search_path = public as $$
declare v uuid;
begin
  if auth_role() is distinct from 'manager' then
    raise exception 'Only a Doctor''s Manager can start a service request';
  end if;
  select id into v from service_request_batches where manager_id = auth.uid() and status = 'draft';
  if v is null then
    insert into service_request_batches (manager_id, status) values (auth.uid(), 'draft')
    on conflict (manager_id) where status = 'draft' do nothing returning id into v;
    if v is null then
      select id into v from service_request_batches where manager_id = auth.uid() and status = 'draft';
    end if;
  end if;
  return v;
end $$;
revoke execute on function get_or_create_draft_batch() from public, anon;
grant execute on function get_or_create_draft_batch() to authenticated;

-- Allowed status moves, enforced for everyone (admin included):
--   draft -> submitted (needs a service + accountability staff) -> approved | rejected (reason required) ; approved -> fulfilled
create function batch_transition_check() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if not ((old.status = 'draft' and new.status = 'submitted')
         or (old.status = 'submitted' and new.status in ('approved', 'rejected'))
         or (old.status = 'approved' and new.status = 'fulfilled')) then
      raise exception 'A % request cannot become %', old.status, new.status;
    end if;
    if new.status = 'submitted' then
      if not exists (select 1 from service_requests where batch_id = new.id) then
        raise exception 'Add at least one service before submitting';
      end if;
      if new.accountability_staff_id is null then raise exception 'Choose the accountability staff'; end if;
    end if;
    if new.status = 'rejected' and coalesce(length(trim(new.admin_note)), 0) = 0 then
      raise exception 'A reason is required to reject a request';
    end if;
    if new.status in ('approved', 'rejected') then
      new.decided_by := auth.uid();
      new.decided_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger trg_batch_transition before update on service_request_batches
  for each row execute function batch_transition_check();
