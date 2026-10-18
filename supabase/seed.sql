-- LAIRON EZ seed — PLAN Appendices A, B, D. Safe to re-run (idempotent).
-- Drivers/staff/managers are NOT seeded: they need auth users, created by Admin via the portal.

-- Divisions
insert into divisions (name, description, sort_order) values
  ('OL', 'OL division', 1), ('CC', 'CC division', 2), ('CD', 'CD division', 3)
on conflict (name) do nothing;

-- Dropdown lists
insert into lookup_lists (key, label, icon, allow_other, is_system, sort_order) values
  ('hq', 'HQ', 'map-pin', false, true, 1),
  ('qualification', 'Qualification', 'graduation-cap', true, true, 2),
  ('speciality', 'Speciality', 'stethoscope', true, true, 3),
  ('offer_type', 'Offer / Netrate', 'percent', false, true, 4),
  ('service_type', 'Service Type', 'briefcase', true, true, 5),
  ('duty_type', 'Duty Type', 'route', false, true, 6),
  ('leave_type', 'Leave Type', 'calendar-off', false, true, 7)
on conflict (key) do nothing;

-- Simple lists
insert into lookup_items (list_key, value, sort_order)
select l.key, v.value, v.ord
from (values
  ('hq','CHN',1),('hq','CBE',2),('hq','CUD',3),('hq','ERD',4),('hq','KUM',5),('hq','MDU',6),('hq','NGL',7),
  ('hq','PDY',8),('hq','SLM',9),('hq','TNJ',10),('hq','TVL',11),('hq','TRY',12),('hq','VLP',13),
  ('offer_type','Offer',1),('offer_type','Netrate',2),
  ('duty_type','Local',1),('duty_type','Out Station',2),
  ('leave_type','Casual',1),('leave_type','Sick',2),('leave_type','Emergency',3),('leave_type','Other',4)
) as v(key, value, ord)
join lookup_lists l on l.key = v.key
on conflict do nothing;

-- Qualification / speciality: union of flat lists and every value used in the mapping (exact strings)
with flat_q(value) as (select unnest(array[
  'MBBS','MBBS DLO','MBBS C.Diab','MBBS D.Diab','MBBS DGO','MBBS D.Ch','MBBS D.Derma','MBBS D.Anesthesia',
  'MBBS D.Ophthal','M.D','M.D D.Diab/ C.Diab','M.D D.N.B','M.D DM','M.S','M.S M.Ch','B.D.S/M.D.S','B.P.T/M.P.T'])),
flat_s(value) as (select unnest(array[
  'Arthroscopy surgeon','Cardiologist','Cardio thoracic surgeon','Consulting physician','Dentist','Dermatologist',
  'Diabetologist','Emergency residents','Endocrinologist','ENT','Gastroentrologist','Geriatrician',
  'Gynecologist/Infertilist','Intensivist/Anesthesiologist','Microbiologist','Nephrologist','Neurologist',
  'Neuro surgeon','Oncologist','Onco surgeon','Orthopaedics','Orthopadedic surgeon','Paediatrician',
  'Paediatric surgeon','Physiotherapist','Podiatrist','Pulmonologist/Chest Physician','Rheumatologist',
  'Spine surgeon','Urologist','Vascular surgeon'])),
mapping(data) as (select $json$
{
  "OL": [
    ["MD","Consultant Physician"],["MBBS DTCD / MD","Chest Physician / Pulmonologist"],
    ["MD DM","Rheumatologist"],["MS DLO","ENT"],["MBBS DLO","ENT"],
    ["MS Ortho","Orthopedics"],["MBBS D.Ortho","Orthopedics"],["MCH Ortho","Orthopedics"],
    ["MD DM","Neurologist"],["MD DNB","Neurologist"],["MS MCH","Neuro Surgeon"],
    ["MD","Obstetrics and Gynaecology"],["MS DGO","Obstetrics and Gynaecology"],
    ["MBBS DGO","Obstetrics and Gynaecology"],["MS","Surgeon (General Practice)"],
    ["MD DM","Gastroenterologist"],["MS MCH","Gastro Surgeon"],["BDS","Dentist"],["MDS","Dental Surgeon"]
  ],
  "CC": [
    ["MS","General Surgeon"],["MS","Laparoscopic Surgeon"],["MS","Endoscopic Surgeon"],
    ["MS MCH","Gastro Surgeon"],["MS MCH","Uro Surgeon"],["MS MCH","Neuro Surgeon"],
    ["MS MCH","Onco Surgeon"],["MS MCH","Cardiothoracic Surgeon"],["MS MCH","Vascular Surgeon"],
    ["MS MCH","Spine Surgeon"],["MBBS D.Ortho","Orthopedic Surgeon"],["MS Ortho","Orthopedic Surgeon"],
    ["MD DM","Cardiologist"],["MD DNB","Cardiologist"],["MD DM","Neurologist"],["MD DNB","Neurologist"],
    ["MD DM","Oncologist"],["MD DNB","Oncologist"],["MD DM","Nephrologist"],["MD DNB","Nephrologist"],
    ["MD DA","Anesthesiologist"],["MD","Intensivist"],["MD","Microbiologist"],["MBBS","ICU Incharge"]
  ],
  "CD": [
    ["MD DM","Cardiologist"],["MD DNB","Cardiologist"],["MD","Diabetologist"],["MD","Geriatrician"],
    ["MD D.Diab","Diabetologist"],["MD C.Diab","Diabetologist"],["MD DM","Neurologist"],
    ["MD DNB","Neurologist"],["MS MCH","Neuro Surgeon"],["MD DM","Nephrologist"],["MD DNB","Nephrologist"],
    ["MD DM","Endocrinologist"],["MD DNB","Endocrinologist"],["MD","Consulting Physician"],
    ["MS","Surgeon (General Practice)"],["MS","Surgeon (Diabetics)"]
  ]
}
$json$::jsonb),
pairs as (
  select d.key as division, p ->> 0 as qual, p ->> 1 as spec
  from mapping, jsonb_each(mapping.data) d, jsonb_array_elements(d.value) p
),
q_all as (select value from flat_q union select qual from pairs),
s_all as (select value from flat_s union select spec from pairs),
ins_q as (
  insert into lookup_items (list_key, value, sort_order)
  select 'qualification', value, row_number() over (order by value) from q_all
  on conflict do nothing returning 1),
ins_s as (
  insert into lookup_items (list_key, value, sort_order)
  select 'speciality', value, row_number() over (order by value) from s_all
  on conflict do nothing returning 1)
select (select count(*) from ins_q) + (select count(*) from ins_s);

-- Division <-> qualification <-> speciality map (case-insensitive match to the stored items)
insert into division_qual_spec_map (division_id, qualification_item_id, speciality_item_id)
select dv.id, qi.id, si.id
from jsonb_each($json$
{
  "OL": [["MD","Consultant Physician"],["MBBS DTCD / MD","Chest Physician / Pulmonologist"],["MD DM","Rheumatologist"],["MS DLO","ENT"],["MBBS DLO","ENT"],["MS Ortho","Orthopedics"],["MBBS D.Ortho","Orthopedics"],["MCH Ortho","Orthopedics"],["MD DM","Neurologist"],["MD DNB","Neurologist"],["MS MCH","Neuro Surgeon"],["MD","Obstetrics and Gynaecology"],["MS DGO","Obstetrics and Gynaecology"],["MBBS DGO","Obstetrics and Gynaecology"],["MS","Surgeon (General Practice)"],["MD DM","Gastroenterologist"],["MS MCH","Gastro Surgeon"],["BDS","Dentist"],["MDS","Dental Surgeon"]],
  "CC": [["MS","General Surgeon"],["MS","Laparoscopic Surgeon"],["MS","Endoscopic Surgeon"],["MS MCH","Gastro Surgeon"],["MS MCH","Uro Surgeon"],["MS MCH","Neuro Surgeon"],["MS MCH","Onco Surgeon"],["MS MCH","Cardiothoracic Surgeon"],["MS MCH","Vascular Surgeon"],["MS MCH","Spine Surgeon"],["MBBS D.Ortho","Orthopedic Surgeon"],["MS Ortho","Orthopedic Surgeon"],["MD DM","Cardiologist"],["MD DNB","Cardiologist"],["MD DM","Neurologist"],["MD DNB","Neurologist"],["MD DM","Oncologist"],["MD DNB","Oncologist"],["MD DM","Nephrologist"],["MD DNB","Nephrologist"],["MD DA","Anesthesiologist"],["MD","Intensivist"],["MD","Microbiologist"],["MBBS","ICU Incharge"]],
  "CD": [["MD DM","Cardiologist"],["MD DNB","Cardiologist"],["MD","Diabetologist"],["MD","Geriatrician"],["MD D.Diab","Diabetologist"],["MD C.Diab","Diabetologist"],["MD DM","Neurologist"],["MD DNB","Neurologist"],["MS MCH","Neuro Surgeon"],["MD DM","Nephrologist"],["MD DNB","Nephrologist"],["MD DM","Endocrinologist"],["MD DNB","Endocrinologist"],["MD","Consulting Physician"],["MS","Surgeon (General Practice)"],["MS","Surgeon (Diabetics)"]]
}
$json$::jsonb) d(key, val)
cross join lateral jsonb_array_elements(d.val) p
join divisions dv on dv.name = d.key
join lookup_items qi on qi.list_key = 'qualification' and lower(qi.value) = lower(p ->> 0)
join lookup_items si on si.list_key = 'speciality' and lower(si.value) = lower(p ->> 1)
on conflict do nothing;

-- Products (Appendix B)
-- One self-contained block: no temp table, so it also works in the Supabase SQL editor (which may run each statement
-- on a different connection, where a temp table would vanish).
do $seed$
declare src jsonb := $json$
{
  "OL": ["Appellar","Dizilart-16","Dizilart-8","Labound","Labound Syrup","Laimlar","Lairobon",
         "Lairobon-D3 60k","Lairobon-D3 2k","Lairocef-O 200","Lairocef-OF","Lairocof","Lairodol-P",
         "Lairomox-625 DUO","Lairoptin-100","Lairoptin-P","Laithral-500","Letorest-60","Letorest-90",
         "Leviomer","Leviomer-M","Medealar","Rbplar","Rbplar-D","Rbplar-I","Sedoxime-200","Triplar"],
  "CC": ["Elvion-S","Elvion-XT","Laimlar-2ml","Laiptum-4.5g","Laiptum-2.25g","Lairocal","Lairocef-1.5g",
         "Lairocef-1g","Lairocef-2g","Lairocef-3g","Lairofol","Lairogest-200","Lairogest-300","Lairomer-1g",
         "Lairomox-1.2g","Laironerv-1ml","Laironerv Plus","Laironox-40","Laironox-60","Lairopan-40 IV",
         "Laizifo","Lotozlar","Xovidrol-125","Xovidrol-1G","Xovidrol-500"],
  "CD": ["Clopilart-75","Gliclart-60","Gliclart-M","Labound Plus","Laiglar-1","Laiglar-2","Laiglar-M1",
         "Laiglar-M2","Lairodap-10","Lairodap-M","Laironerv-G","Laironerv-G MD","Laironerv-NT","Laironerv-P",
         "Lairoten-20","Lairoten-M","Rosvalar-10","Rosvalar-20","Rosvalar-5","Rosvalar-CA","Statelar-40",
         "Statelar-H","Torvalar-10","Torvalar-20","Torvalar-CV","Torvalar-F","Voglilart-M 0.3",
         "Voglilart-MG1","Voglilart-MG2"]
}
$json$::jsonb;
begin
  insert into products (name)
  select distinct p #>> '{}' from jsonb_each(src) d, jsonb_array_elements(d.value) p
  on conflict do nothing;

  insert into product_divisions (product_id, division_id)
  select distinct pr.id, dv.id
  from jsonb_each(src) d
  cross join lateral jsonb_array_elements(d.value) x
  join products pr on lower(pr.name) = lower(x #>> '{}')
  join divisions dv on dv.name = d.key
  on conflict do nothing;
end $seed$;

-- Fleet (Appendix D). Only the last 4 digits are known: PLACEHOLDER numbers, replace before go-live.
insert into vehicles (name, vehicle_number, make, model) values
  ('CRYSTA', 'TN00XX6435', 'Toyota', 'Innova Crysta'),
  ('CRYSTA', 'TN00XX2172', 'Toyota', 'Innova Crysta'),
  ('CRYSTA', 'TN00XX7157', 'Toyota', 'Innova Crysta'),
  ('CRYSTA', 'TN00XX7186', 'Toyota', 'Innova Crysta'),
  ('AMAZE',  'TN00XX6960', 'Honda', 'Amaze'),
  ('DZIRE',  'TN00XX0523', 'Maruti Suzuki', 'Dzire')
on conflict (vehicle_number) do nothing;

-- Settings
insert into beta_rates (effective_from, local_rate, outstation_rate, note)
values ('2026-04-01', 250, 300, 'Initial rates — confirm the real start date')
on conflict (effective_from) do nothing;

insert into app_settings (key, value) values
  ('notify_emails', '[]'::jsonb),
  ('company_name', '"LAIRON"'::jsonb),
  ('logo_url', 'null'::jsonb),
  ('driver_edit_window_days', '7'::jsonb)
on conflict (key) do nothing;
