-- Manager performance, release 5: appraisal setup (points, targets, rating bands). Admin only — managers never see it.
-- One setup for all managers, held as a single row. The appraisal itself is calculated from the data already entered.

create table appraisal_settings (
  id int primary key default 1 check (id = 1),
  config jsonb not null,
  updated_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger trg_appraisal_settings_updated before update on appraisal_settings for each row execute function set_updated_at();

alter table appraisal_settings enable row level security;
create policy appraisal_settings_admin on appraisal_settings for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update on appraisal_settings to authenticated;

-- Defaults from the RBM workbook: sales 35 + core (KDP) products 35 + activity 16 + new products 10 + ROI 4 = 100 (not capped).
insert into appraisal_settings (config) values ('{
  "points":  { "sales": 35, "kdp": 35, "coverage": 10, "new_customers": 3, "cme": 3, "new_products": 10, "roi": 4 },
  "targets": { "coverage_pct": 100, "new_customers": 3, "cme": 3, "roi_doctors": 3 },
  "sales_basis": "primary",
  "bands": [
    { "min": 100, "label": "Outstanding" },
    { "min": 95,  "label": "Good" },
    { "min": 92,  "label": "Satisfactory" },
    { "min": 0,   "label": "Below par" }
  ]
}'::jsonb);
