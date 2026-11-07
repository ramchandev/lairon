-- Sale Report, release A: stockists' monthly stock & sales statements uploaded by an admin.
-- Admin only. Import headings (fields), saved column templates, product spellings (aliases), uploads and their lines.
-- Uploads and lines are written only through commit_stockist_upload(); a re-upload replaces the earlier one and keeps it as history.

-- The headings the system understands. 'core' fields feed the reports; 'extra' fields are stored and shown only.
create table import_fields (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (length(trim(label)) > 0),
  role text not null default 'extra' check (role in ('core', 'extra')),
  synonyms text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- A stockist's column layout, remembered so next month's file maps itself.
create table stockist_import_templates (
  stockist_id uuid not null references stockists (id) on delete cascade,
  signature text not null,
  column_map jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (stockist_id, signature)
);

-- How a stockist spells our products. stockist_id null = a spelling that holds for everyone.
create table product_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null check (length(trim(alias)) > 0),
  product_id uuid not null references products (id) on delete cascade,
  stockist_id uuid references stockists (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index product_aliases_unique on product_aliases (alias, coalesce(stockist_id, '00000000-0000-0000-0000-000000000000'));

create table stockist_uploads (
  id uuid primary key default gen_random_uuid(),
  stockist_id uuid not null references stockists (id) on delete restrict,
  division_id uuid references divisions (id) on delete restrict, -- null = a file covering all of Lairon
  month date not null check (month = date_trunc('month', month)::date),
  file_name text not null,
  file_hash text,
  period_from date,
  period_to date,
  mapping jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'replaced')),
  replaced_by uuid references stockist_uploads (id) on delete set null,
  uploaded_by uuid references profiles (id) on delete set null,
  uploaded_at timestamptz not null default now()
);
-- one live upload per stockist + division + month
create unique index stockist_uploads_one_active on stockist_uploads
  (stockist_id, coalesce(division_id, '00000000-0000-0000-0000-000000000000'), month) where status = 'active';
create index stockist_uploads_month on stockist_uploads (month);

create table stockist_sales_lines (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references stockist_uploads (id) on delete cascade,
  product_id uuid references products (id) on delete set null, -- null = a row the admin chose to keep unmatched
  raw_name text not null,
  opening numeric(14,2) not null default 0,
  purchase numeric(14,2) not null default 0,
  sales numeric(14,2) not null default 0,
  free numeric(14,2) not null default 0,
  closing numeric(14,2) not null default 0,
  order_qty numeric(14,2) not null default 0,
  last_month_sales numeric(14,2) not null default 0,
  sale_return numeric(14,2) not null default 0,
  rate numeric(14,2),
  stock_value numeric(14,2),
  sales_value numeric(14,2),
  extra jsonb not null default '{}'::jsonb
);
create index stockist_sales_lines_upload on stockist_sales_lines (upload_id);
create index stockist_sales_lines_product on stockist_sales_lines (product_id);

-- Settings for the reports (release C): reorder cover and what counts as slow.
create table sale_report_settings (
  id int primary key default 1 check (id = 1),
  cover_months numeric(4,1) not null default 1.5 check (cover_months >= 0),
  history_months int not null default 3 check (history_months between 1 and 12),
  slow_cover_months numeric(4,1) not null default 3 check (slow_cover_months >= 0),
  updated_at timestamptz not null default now()
);
create trigger trg_sale_report_settings_updated before update on sale_report_settings for each row execute function set_updated_at();
insert into sale_report_settings default values;

-- Everything here is admin only.
alter table import_fields enable row level security;
alter table stockist_import_templates enable row level security;
alter table product_aliases enable row level security;
alter table stockist_uploads enable row level security;
alter table stockist_sales_lines enable row level security;
alter table sale_report_settings enable row level security;
create policy import_fields_admin on import_fields for all to authenticated using (is_admin()) with check (is_admin());
create policy import_templates_admin on stockist_import_templates for all to authenticated using (is_admin()) with check (is_admin());
create policy product_aliases_admin on product_aliases for all to authenticated using (is_admin()) with check (is_admin());
create policy sale_report_settings_admin on sale_report_settings for all to authenticated using (is_admin()) with check (is_admin());
create policy stockist_uploads_read on stockist_uploads for select to authenticated using (is_admin());
create policy stockist_sales_lines_read on stockist_sales_lines for select to authenticated using (is_admin());
grant select, insert, update, delete on import_fields, stockist_import_templates, product_aliases to authenticated;
grant select, update on sale_report_settings to authenticated;
grant select on stockist_uploads, stockist_sales_lines to authenticated;
-- no write policies on uploads/lines: every write goes through commit_stockist_upload() / delete_stockist_upload()

insert into import_fields (key, label, role, synonyms, sort_order) values
  ('opening', 'Opening', 'core', '{open,op,"op.","op qty","opening","opening qty","op. stock","op stock",opstk,"opening stock","op bal","op.bal",opbal}', 1),
  ('purchase', 'Purchase', 'core', '{pur,purc,"pur.","pur qty","pur. qty","purchase",receipt,"receipt qty",receive,"receive qty",purchases,"purchase qty w o ret and free",purchasequantity}', 2),
  ('sales', 'Sales', 'core', '{sale,sales,"sales qty","sale qty","cm-sales","cm sales",issue,"sp sale","current sales","total sales w o free","sales w o free","sale qty w o ret and free"}', 3),
  ('free', 'Sales free', 'core', '{"s.free","s free","sfree","sales free","sale free",ss,"free qty",freestockissuedonsale,"free stock issued on sale"}', 4),
  ('closing', 'Closing', 'core', '{clo,"clo.",closing,"closing qty","cl.stock","cl stock","cl. stock","closing stock",bal,"bal.",balance,curstk,"cur stk","cl stk","cl. bal","cl bal",clbal,"total stock",totalstock}', 5),
  ('order_qty', 'Order qty', 'core', '{"order qty","orderqty","orderqty.",ordqt,"ord.",ord,order,"order qty."}', 6),
  ('last_month_sales', 'Last-month sales', 'extra', '{lm-sales,"lm sales","last month sales","last month sale","lastsalqty",ilastsa,ilastsales,"blm qty","lm qty"}', 7),
  ('sale_return', 'Sale return', 'extra', '{"sale ret","salesret","sr qty","sale return","salereturn","sale ret qty",sret,br}', 8),
  ('purchase_free', 'Purchase free', 'extra', '{"p.free","p free",pfree,"pur free","purchase free",freestockreceivedonpurchase}', 9),
  ('adjustment', 'Adjustment', 'extra', '{dif,"dif.",adj,"adj.",adjmt,adjustment}', 10),
  ('rate', 'Rate', 'extra', '{rate,pts,"pts rate",price,mrp}', 11),
  ('stock_value', 'Stock value', 'extra', '{"stock value",stockval,stkval,bval,"closing value",value}', 12),
  ('sales_value', 'Sales value', 'extra', '{"sales value",salval,sval,"sale value"}', 13);

-- more spellings met in the stockists' files
update import_fields set synonyms = synonyms || '{"o.qty","oqty","op.qty","opst"}' where key = 'opening';
update import_fields set synonyms = synonyms || '{"p.qty","pqty","purq","rcpt","tot pur qty","totpurqty"}' where key = 'purchase';
update import_fields set synonyms = synonyms || '{"tot sal qty","totsalqty","s.qty","sqty"}' where key = 'sales';
update import_fields set synonyms = synonyms || '{"free"}' where key = 'free';
update import_fields set synonyms = synonyms || '{"close","cls.qty","cls qty","cl.s","cl.st"}' where key = 'closing';
update import_fields set synonyms = synonyms || '{"retu"}' where key = 'sale_return';
update import_fields set synonyms = synonyms || '{"l.sal","lsal"}' where key = 'last_month_sales';
update import_fields set synonyms = synonyms || '{"stkvl","stkvalu","stk val","cls.val","cls val"}' where key = 'stock_value';
update import_fields set synonyms = synonyms || '{"s.val","sal.value","salvalu","sal value"}' where key = 'sales_value';
update import_fields set synonyms = synonyms || '{sp}' where key = 'purchase_free';

-- Admin: save one stockist's statement for a month. p_lines = [{product_id, raw_name, opening, purchase, sales, free, closing,
-- order_qty, last_month_sales, sale_return, rate, stock_value, sales_value, extra}]. An earlier live upload for the same
-- stockist + division + month is kept as history and marked replaced — but only when p_replace is true.
create function commit_stockist_upload(
  p_stockist uuid, p_division uuid, p_month date, p_file_name text, p_file_hash text,
  p_period_from date, p_period_to date, p_mapping jsonb, p_lines jsonb, p_replace boolean default false)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_old uuid;
  v_new uuid;
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  if not exists (select 1 from stockists where id = p_stockist) then raise exception 'Stockist not found'; end if;
  if jsonb_typeof(coalesce(p_lines, 'null'::jsonb)) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'The file has no product rows';
  end if;

  select id into v_old from stockist_uploads
   where stockist_id = p_stockist and division_id is not distinct from p_division and month = v_month and status = 'active';
  if v_old is not null and not p_replace then raise exception 'Already uploaded for this month'; end if;

  insert into stockist_uploads (stockist_id, division_id, month, file_name, file_hash, period_from, period_to, mapping, uploaded_by, status)
  values (p_stockist, p_division, v_month, p_file_name, p_file_hash, p_period_from, p_period_to, coalesce(p_mapping, '{}'::jsonb), auth.uid(), 'replaced')
  returning id into v_new;

  insert into stockist_sales_lines (upload_id, product_id, raw_name, opening, purchase, sales, free, closing, order_qty,
                                    last_month_sales, sale_return, rate, stock_value, sales_value, extra)
  select v_new, nullif(l ->> 'product_id', '')::uuid, coalesce(l ->> 'raw_name', ''),
         coalesce((l ->> 'opening')::numeric, 0), coalesce((l ->> 'purchase')::numeric, 0), coalesce((l ->> 'sales')::numeric, 0),
         coalesce((l ->> 'free')::numeric, 0), coalesce((l ->> 'closing')::numeric, 0), coalesce((l ->> 'order_qty')::numeric, 0),
         coalesce((l ->> 'last_month_sales')::numeric, 0), coalesce((l ->> 'sale_return')::numeric, 0),
         (l ->> 'rate')::numeric, (l ->> 'stock_value')::numeric, (l ->> 'sales_value')::numeric, coalesce(l -> 'extra', '{}'::jsonb)
  from jsonb_array_elements(p_lines) l;

  if v_old is not null then update stockist_uploads set status = 'replaced', replaced_by = v_new where id = v_old; end if;
  update stockist_uploads set status = 'active' where id = v_new;
  return v_new;
end $$;
grant execute on function commit_stockist_upload(uuid, uuid, date, text, text, date, date, jsonb, jsonb, boolean) to authenticated;

-- Admin: remove an upload (and, if it was live, nothing takes its place).
create function delete_stockist_upload(p_upload uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Not allowed'; end if;
  delete from stockist_uploads where id = p_upload;
end $$;
grant execute on function delete_stockist_upload(uuid) to authenticated;
