-- LAIRON EZ — starter packs: the Division is chosen per product line ([Division] [Product] [Qty]); admin report: revenue by doctor.

alter table starter_pack_items add column division text;
update starter_pack_items i set division = p.division from starter_pack_requests p where p.id = i.request_id and i.division is null;

-- The pack's own division becomes a summary of its lines: the distinct divisions, e.g. "OL, CC".
create or replace function create_starter_pack(payload jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_item jsonb; v_i int := 0; v_staff uuid; v_name text; v_div text;
begin
  if jsonb_typeof(payload -> 'items') <> 'array' or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'Add at least one product';
  end if;
  v_staff := coalesce(nullif(payload ->> 'staff_id', '')::uuid, auth.uid());
  v_name := coalesce(nullif(trim(payload ->> 'staff_name'), ''), (select full_name from profiles where id = v_staff));
  select string_agg(d, ', ' order by d) into v_div
    from (select distinct nullif(trim(i ->> 'division'), '') as d from jsonb_array_elements(payload -> 'items') i) x where d is not null;
  v_div := coalesce(v_div, nullif(payload ->> 'division', ''), 'All Division');
  insert into starter_pack_requests (request_date, doctor_id, doctor_name, qualification, doctor_area,
                                     staff_id, staff_name, staff_area, division)
  values (coalesce((payload ->> 'request_date')::date, current_date), nullif(payload ->> 'doctor_id', '')::uuid,
          payload ->> 'doctor_name', payload ->> 'qualification', payload ->> 'doctor_area',
          v_staff, v_name, payload ->> 'staff_area', v_div)
  returning id into v_id;
  for v_item in select * from jsonb_array_elements(payload -> 'items') loop
    insert into starter_pack_items (request_id, product_id, product_name, quantity, sort_order, division)
    values (v_id, nullif(v_item ->> 'product_id', '')::uuid, v_item ->> 'product_name', v_item ->> 'quantity', v_i,
            coalesce(nullif(trim(v_item ->> 'division'), ''), v_div));
    v_i := v_i + 1;
  end loop;
  return v_id;
end $$;

create or replace function import_starter_packs(batch jsonb) returns jsonb
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
      insert into starter_pack_items (request_id, product_id, product_name, quantity, sort_order, division)
      values (v_id, nullif(v_item ->> 'product_id', '')::uuid, v_item ->> 'product_name', v_item ->> 'quantity', v_k,
              coalesce(nullif(v_item ->> 'division', ''), v_pack ->> 'division'));
      v_p := v_p + 1;
    end loop;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('packs', v_n, 'products', v_p);
end $$;

-- ───────────── Report: revenue by doctor ─────────────
-- One row per doctor and month inside the period (admin only): the sum of the monthly figures entered on the doctor's services.
create function revenue_by_doctor(p_from date, p_to date)
returns table (doctor_id uuid, doctor_name text, manager_name text, month date, amount numeric, services int)
language sql stable security definer set search_path = public as $$
  select s.doctor_id,
         coalesce(d.name, max(s.doctor_name)) as doctor_name,
         max(b.manager_name) as manager_name,
         r.month,
         sum(r.amount) as amount,
         count(distinct r.service_id)::int as services
  from service_revenue r
  join service_requests s on s.id = r.service_id
  join service_request_batches b on b.id = s.batch_id
  left join doctors d on d.id = s.doctor_id
  where is_admin()
    and r.month >= date_trunc('month', p_from)::date and r.month <= date_trunc('month', p_to)::date
  group by s.doctor_id, d.name, r.month
  order by 2, r.month
$$;
revoke execute on function revenue_by_doctor(date, date) from public, anon;
grant execute on function revenue_by_doctor(date, date) to authenticated;
