-- LAIRON EZ — Phase 6: starter-pack flow rules.

-- Allowed status moves (everyone, admin included):
--   submitted -> processing | fulfilled | cancelled ; processing -> fulfilled | cancelled ; fulfilled / cancelled are final.
-- An admin cancelling must give a reason (admin_note); staff may cancel their own submitted request.
create function starter_pack_transition() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if not ((old.status = 'submitted' and new.status in ('processing', 'fulfilled', 'cancelled'))
         or (old.status = 'processing' and new.status in ('fulfilled', 'cancelled'))) then
      raise exception 'A % starter pack cannot become %', old.status, new.status;
    end if;
    if new.status = 'cancelled' and (auth.uid() is null or is_admin()) and coalesce(length(trim(new.admin_note)), 0) = 0 then
      raise exception 'A reason is required to cancel a starter pack';
    end if;
    if new.status = 'fulfilled' then
      new.fulfilled_by := auth.uid();
      new.fulfilled_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger trg_sp_transition before update on starter_pack_requests
  for each row execute function starter_pack_transition();

-- create_starter_pack: header + items in one transaction. staff_name falls back to the profile name.
create or replace function create_starter_pack(payload jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_item jsonb; v_i int := 0; v_staff uuid; v_name text;
begin
  if jsonb_typeof(payload -> 'items') <> 'array' or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'Add at least one product';
  end if;
  v_staff := coalesce(nullif(payload ->> 'staff_id', '')::uuid, auth.uid());
  v_name := coalesce(nullif(trim(payload ->> 'staff_name'), ''), (select full_name from profiles where id = v_staff));
  insert into starter_pack_requests (request_date, doctor_id, doctor_name, qualification, doctor_area,
                                     staff_id, staff_name, staff_area, division)
  values (coalesce((payload ->> 'request_date')::date, current_date), nullif(payload ->> 'doctor_id', '')::uuid,
          payload ->> 'doctor_name', payload ->> 'qualification', payload ->> 'doctor_area',
          v_staff, v_name, payload ->> 'staff_area', payload ->> 'division')
  returning id into v_id;
  for v_item in select * from jsonb_array_elements(payload -> 'items') loop
    insert into starter_pack_items (request_id, product_id, product_name, quantity, sort_order)
    values (v_id, nullif(v_item ->> 'product_id', '')::uuid, v_item ->> 'product_name', v_item ->> 'quantity', v_i);
    v_i := v_i + 1;
  end loop;
  return v_id;
end $$;
