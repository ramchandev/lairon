-- LAIRON EZ — bulk import of Service Requests and Starter Packs (admin only, one transaction each).
-- Imports never send notification emails (history, not new work): emit_notification() honours a transaction-local flag.
create or replace function emit_notification(p_event text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  if coalesce(current_setting('lairon.skip_notify', true), '') = 'on' then return; end if;
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

-- import_service_requests(batch):
--   { file_name, requests: [ { ref_no?, manager_id, staff_id, status, submitted_on?, admin_note?,
--       services: [ { request_date, doctor_id?, doctor_name, area, hospital_name, pharmacy_name?, hq, division, qualification,
--                     speciality, service_amount, service_type, expected_business_value, current_business_value,
--                     offer_type, offer_percent?, netrate_amount? } ] } ] }
-- status: submitted | approved | rejected | fulfilled. A ref_no already in use stops the whole import.
create function import_service_requests(batch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_req jsonb; v_svc jsonb; v_id uuid; v_status text; v_when timestamptz; v_n int := 0; v_s int := 0; v_i int := 0;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  perform set_config('lairon.skip_notify', 'on', true);
  for v_req in select * from jsonb_array_elements(batch -> 'requests') loop
    v_i := v_i + 1;
    v_status := coalesce(v_req ->> 'status', 'submitted');
    if v_status not in ('submitted', 'approved', 'rejected', 'fulfilled') then
      raise exception 'Request %: invalid status "%"', v_i, v_status;
    end if;
    if not exists (select 1 from profiles where id = (v_req ->> 'manager_id')::uuid and role = 'manager') then
      raise exception 'Request %: unknown Doctor''s Manager', v_i;
    end if;
    if not exists (select 1 from profiles where id = (v_req ->> 'staff_id')::uuid and role = 'staff') then
      raise exception 'Request %: unknown accountability staff', v_i;
    end if;
    if jsonb_array_length(coalesce(v_req -> 'services', '[]'::jsonb)) = 0 then
      raise exception 'Request %: no services', v_i;
    end if;
    if v_status = 'rejected' and coalesce(length(trim(v_req ->> 'admin_note')), 0) = 0 then
      raise exception 'Request %: a rejected request needs a note (reason)', v_i;
    end if;
    if nullif(v_req ->> 'ref_no', '') is not null and exists (select 1 from service_request_batches where ref_no = v_req ->> 'ref_no') then
      raise exception 'Request %: reference % already exists', v_i, v_req ->> 'ref_no';
    end if;
    v_when := coalesce(nullif(v_req ->> 'submitted_on', '')::date::timestamptz, now());
    insert into service_request_batches (ref_no, manager_id, accountability_staff_id, status, submitted_at, decided_by, decided_at, admin_note)
    values (nullif(v_req ->> 'ref_no', ''), (v_req ->> 'manager_id')::uuid, (v_req ->> 'staff_id')::uuid, v_status, v_when,
            case when v_status <> 'submitted' then auth.uid() end, case when v_status <> 'submitted' then v_when end,
            nullif(v_req ->> 'admin_note', ''))
    returning id into v_id;
    for v_svc in select * from jsonb_array_elements(v_req -> 'services') loop
      insert into service_requests (batch_id, request_date, doctor_id, doctor_name, area, hospital_name, pharmacy_name, hq, division,
        qualification, speciality, service_amount, service_type, expected_business_value, current_business_value,
        offer_type, offer_percent, netrate_amount)
      values (v_id, (v_svc ->> 'request_date')::date, nullif(v_svc ->> 'doctor_id', '')::uuid, v_svc ->> 'doctor_name', v_svc ->> 'area',
        v_svc ->> 'hospital_name', nullif(v_svc ->> 'pharmacy_name', ''), v_svc ->> 'hq', v_svc ->> 'division',
        v_svc ->> 'qualification', v_svc ->> 'speciality', (v_svc ->> 'service_amount')::numeric, v_svc ->> 'service_type',
        coalesce((v_svc ->> 'expected_business_value')::numeric, 0), coalesce((v_svc ->> 'current_business_value')::numeric, 0),
        v_svc ->> 'offer_type', nullif(v_svc ->> 'offer_percent', '')::numeric, nullif(v_svc ->> 'netrate_amount', '')::numeric);
      v_s := v_s + 1;
    end loop;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('requests', v_n, 'services', v_s);
end $$;
revoke execute on function import_service_requests(jsonb) from public, anon;
grant execute on function import_service_requests(jsonb) to authenticated;

-- import_starter_packs(batch):
--   { file_name, packs: [ { ref_no?, request_date, doctor_id?, doctor_name, qualification, doctor_area, staff_id, staff_area, division,
--       status, admin_note?, items: [ { product_id?, product_name, quantity } ] } ] }
-- status: submitted | processing | fulfilled | cancelled.
create function import_starter_packs(batch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pack jsonb; v_item jsonb; v_id uuid; v_status text; v_n int := 0; v_p int := 0; v_i int := 0; v_k int; v_staff text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  perform set_config('lairon.skip_notify', 'on', true);
  for v_pack in select * from jsonb_array_elements(batch -> 'packs') loop
    v_i := v_i + 1; v_k := 0;
    v_status := coalesce(v_pack ->> 'status', 'submitted');
    if v_status not in ('submitted', 'processing', 'fulfilled', 'cancelled') then
      raise exception 'Pack %: invalid status "%"', v_i, v_status;
    end if;
    select full_name into v_staff from profiles where id = (v_pack ->> 'staff_id')::uuid and role = 'staff';
    if v_staff is null then raise exception 'Pack %: unknown staff', v_i; end if;
    if v_status = 'cancelled' and coalesce(length(trim(v_pack ->> 'admin_note')), 0) = 0 then
      raise exception 'Pack %: a cancelled pack needs a note (reason)', v_i;
    end if;
    if jsonb_array_length(coalesce(v_pack -> 'items', '[]'::jsonb)) = 0 then raise exception 'Pack %: no products', v_i; end if;
    if nullif(v_pack ->> 'ref_no', '') is not null and exists (select 1 from starter_pack_requests where ref_no = v_pack ->> 'ref_no') then
      raise exception 'Pack %: reference % already exists', v_i, v_pack ->> 'ref_no';
    end if;
    insert into starter_pack_requests (ref_no, request_date, doctor_id, doctor_name, qualification, doctor_area, staff_id, staff_name,
      staff_area, division, status, fulfilled_by, fulfilled_at, admin_note)
    values (nullif(v_pack ->> 'ref_no', ''), (v_pack ->> 'request_date')::date, nullif(v_pack ->> 'doctor_id', '')::uuid,
      v_pack ->> 'doctor_name', coalesce(v_pack ->> 'qualification', ''), coalesce(v_pack ->> 'doctor_area', ''),
      (v_pack ->> 'staff_id')::uuid, v_staff, coalesce(v_pack ->> 'staff_area', ''), v_pack ->> 'division', v_status,
      case when v_status = 'fulfilled' then auth.uid() end,
      case when v_status = 'fulfilled' then (v_pack ->> 'request_date')::date::timestamptz end,
      nullif(v_pack ->> 'admin_note', ''))
    returning id into v_id;
    for v_item in select * from jsonb_array_elements(v_pack -> 'items') loop
      v_k := v_k + 1;
      insert into starter_pack_items (request_id, product_id, product_name, quantity, sort_order)
      values (v_id, nullif(v_item ->> 'product_id', '')::uuid, v_item ->> 'product_name', v_item ->> 'quantity', v_k);
      v_p := v_p + 1;
    end loop;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('packs', v_n, 'products', v_p);
end $$;
revoke execute on function import_starter_packs(jsonb) from public, anon;
grant execute on function import_starter_packs(jsonb) to authenticated;
