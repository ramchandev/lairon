-- Stockist master details (edited by admins under People > Stockists).
alter table stockists
  add column contact_person text,
  add column phone text,
  add column email text,
  add column address text,
  add column gstin text,
  add column drug_licence text,
  add column notes text;
