# LAIRON EZ — Build Plan & Claude Code Brief

> **How to use this file**
> 1. Create the repo, put this file at `docs/PLAN.md`.
> 2. Put the approved HTML prototype at `design/lairon-ez-prototype.html`. It is clickable and covers **login, the full admin portal, the driver app and the doctor's manager app**. Open it and use the *Prototype* shortcuts under the sign-in card to switch roles.
> 3. Start Claude Code in the repo and paste the **Kickoff Prompt** (Section 0). Then run one phase at a time.

---

## 0. Kickoff Prompt (paste into Claude Code)

```
You are building LAIRON EZ, a mobile-first web portal for LAIRON (pharma field operations).
Read docs/PLAN.md fully before writing code. It is the source of truth.
Visual + behaviour reference: design/lairon-ez-prototype.html (login, admin, driver, manager).
Match its layout, spacing, colors, copy, validation messages and flows, but implement as
React components with Tailwind + shadcn/ui (do not paste raw HTML). Its sample data is
only for the demo; real data comes from Supabase.

Rules:
- Follow the phases in Section 12, one phase per session. At the end of each phase:
  run typecheck + lint + tests, update docs/PROGRESS.md, and stop for review.
- Database changes ONLY via SQL migrations in supabase/migrations. Enable RLS on every table.
- Every dropdown value is saved as plain TEXT (snapshot) in transactional tables — never as a
  foreign key to the dropdown table (Section 4). Editing/deleting a dropdown item must never
  change historical records.
- Mobile-first: design for 360–414px width first, then tablet/desktop.
- UI rules (see Section 9): add/edit screens are always full pages (never drawers/side sheets);
  every delete/reject asks in a custom modal (never window.confirm/alert); flat lucide icons only, no emoji;
  glassmorphism theme in BLUE (tokens in Section 9.1) with AA contrast.
- Never expose the Supabase service-role key or Resend key to the browser. Server work goes in
  Supabase Edge Functions.
- If something in the plan is ambiguous, pick the simplest option, note it in docs/DECISIONS.md, continue.

Start with Phase 0.
```

---

## 1. Product Summary

LAIRON EZ is a role-based portal used mostly on phones by four kinds of users:

| Role | Login | What they do |
|---|---|---|
| **Admin** | Email + password | Manages everything: users, masters, dropdowns, approves/fulfils requests, views driver duties, reports |
| **Staff** (Medical Reps) | Email + password | Raise **Starter Pack** requests for doctors, view staff directory, own profile |
| **Driver** | Email + password | Daily **Trip Duty** entry, Week Off, Apply Leave, monthly history |
| **Doctor's Manager** | **Phone number only** (Section 3.2) | Manage their **Doctors**, raise **Service Requests** for those doctors |

**Doctors** do not log in — their profiles are managed by their Doctor's Manager (and Admin).

---

## 2. Tech Stack (decided)

**React + Vite SPA, not Next.js.** Reason: this is a logged-in portal with no SEO needs; a Vite SPA is faster to build, faster on phones after first load, deploys as static files, and Supabase handles the backend. Next.js adds server-rendering complexity we don't need.

| Layer | Choice |
|---|---|
| Build | Vite + React 18 + TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui (Radix), lucide-react icons |
| Routing | React Router v6 (data routers, role-guarded layouts) |
| Server state | TanStack Query v5 |
| Forms | React Hook Form + Zod (schemas shared for client validation) |
| Backend | Supabase: Postgres, Auth, Storage (avatars), RLS, Edge Functions (Deno) |
| Email | Resend, called only from Edge Functions; templates with React Email |
| PDF | `@react-pdf/renderer` (client-side) |
| Dates | date-fns (timezone: Asia/Kolkata for display) |
| PWA | `vite-plugin-pwa` — installable, app icon "LAIRON EZ", offline shell |
| Tests | Vitest + React Testing Library; Playwright for 3–4 critical flows |
| Hosting | Vercel or Cloudflare Pages (static) + Supabase cloud |

**Folder structure**
```
src/
  app/            router, providers, role guards
  layouts/        AdminLayout (sidebar), MobileLayout (bottom tabs), AuthLayout
  features/
    auth/ users/ vehicles/ divisions/ products/ lookups/ doctors/
    service-requests/ starter-packs/ trip-duty/ dashboard/ settings/
      (each: api.ts, hooks.ts, schemas.ts, components/, pages/)
  components/ui/  shadcn components
  components/     shared: DataTable, SearchSelect, MonthPicker, StatusBadge, EmptyState, ConfirmDialog
  lib/            supabase.ts, format.ts, pdf/, constants.ts
supabase/
  migrations/  seed.sql  functions/
docs/ PLAN.md PROGRESS.md DECISIONS.md
design/  (HTML references)
```

**Env vars**
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Edge Functions secrets: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `LAIRON EZ <noreply@lairon.in>`), `APP_URL`, `MANAGER_AUTH_MODE` (`phone_only` | `otp`)

---

## 3. Authentication & Roles

### 3.1 Admin / Staff / Driver
- Supabase email + password.
- **No self sign-up.** Admin creates users from the portal → Edge Function `admin-create-user` (service role) creates the auth user + profile, then sends a Resend email with a "Set your password" link (`auth.admin.generateLink({ type: 'invite' })`).
- Forgot password → Supabase recovery link, delivered via Resend (configure Supabase custom SMTP with Resend so all auth emails go through Resend).
- Admin can deactivate a user (`profiles.is_active = false` + ban in auth) — deactivated users are signed out and blocked by RLS.

### 3.2 Doctor's Manager — phone login
Login screen has a **"Doctor's Manager"** tab: one field, phone number (10-digit Indian mobile, `+91` prefixed automatically).

Build behind the env flag `MANAGER_AUTH_MODE`:

- **`phone_only`** (as requested): Edge Function `manager-phone-login`
  1. Normalises the number, checks `profiles` for an **active** manager with that phone (Admin pre-registers managers — unknown numbers are rejected with a generic message).
  2. Rate-limits (max 5 attempts / 15 min per phone and per IP, table `login_attempts`).
  3. Manager has a synthetic auth email `m<phone>@managers.lairon.internal`. Function calls `auth.admin.generateLink({ type: 'magiclink', email })`, returns `hashed_token`.
  4. Client calls `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` → session.
  5. Session stays 90 days on the device so managers rarely log in again. Admin can force-logout a manager.
- **`otp`** (recommended, switchable later with no UI rework): Supabase Phone Auth with a 6-digit SMS OTP using the **Send SMS Hook** → MSG91 (India DLT-compliant). Same screen, plus a code box.

> ⚠️ `phone_only` means anyone who knows a manager's number can sign in as them. Keep the flag so OTP can be switched on without code changes.

### 3.3 Roles in the database
- `profiles.role` enum: `admin | staff | driver | manager`.
- Helper SQL functions: `auth_role()` and `is_admin()` (security definer, stable) used in RLS policies.
- Frontend: `RequireRole` guard per route group; after login redirect: admin → `/admin`, staff → `/staff`, driver → `/driver`, manager → `/m`.

---

## 4. Core Rule: Dropdowns are Managed, Data is Flat

1. **Every dropdown in the system is editable by Admin (CRUD)** through one generic "Dropdown Manager" screen.
2. When a form is saved, the **selected value is copied as plain text** into the record (e.g. `service_requests.speciality = 'Cardiologist'`). No foreign key to the dropdown item.
3. Renaming/deactivating/deleting a dropdown item affects **future forms only**. Old records keep their text.
4. Same snapshot rule for references to people/things: store the ID (nullable, `on delete set null`) **and** a text copy of the name/number (e.g. `vehicle_id` + `vehicle_number`, `staff_id` + `staff_name`). Lists and PDFs always display the snapshot text.
5. Deleting dropdown items = soft delete (`is_active=false`) by default; hard delete allowed for Admin because data is flat.
6. "Others" option: where a list has `allow_other = true`, the form shows an "Others" choice that reveals a text input; the typed text is what gets saved.

---

## 5. Database Schema (Supabase / Postgres)

All tables: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` (trigger), `created_by uuid` where relevant. RLS enabled everywhere.

### 5.1 People
**`profiles`** (1:1 with `auth.users`)
| column | type | notes |
|---|---|---|
| id | uuid pk | = auth.users.id |
| role | user_role | |
| full_name | text **required** | |
| phone | text **required**, unique | E.164 `+91XXXXXXXXXX` |
| email | text | **required** for admin/staff/driver; optional for manager |
| area | text | used by Staff (and Manager) |
| hq | text | snapshot from HQ dropdown (manager/staff, optional) |
| bio | text | Staff, Driver |
| avatar_url | text | Supabase Storage bucket `avatars` (public read, owner/admin write, ≤2 MB, resized client-side to 512px) |
| is_active | bool default true | |

Per-role required fields (enforced in Zod + a check trigger):
- **Staff**: Name*, Phone*, Email*, Area, Bio, Image
- **Driver**: Name*, Phone*, Email*, Bio, Image
- **Doctor's Manager**: Name*, Phone*, Email (optional), Area, HQ

### 5.2 Masters
**`vehicles`**: name **required** (short name drivers recognise, e.g. `CRYSTA`), vehicle_number **required unique** (stored uppercase, no spaces e.g. `TN09AB6435`, displayed formatted), color, make, model, year (int, 1990–current+1), is_active.
- Dropdown label shown to drivers = `name + last 4 digits of number` → `CRYSTA 6435` (matches what drivers use today).
- The driver vehicle dropdown always ends with **Others** (hired / non-fleet vehicle) → reveals a required text box "Vehicle details". See 5.7.
- Seed fleet: Appendix D.

**`divisions`**: name **required unique** (seed: `OL`, `CC`, `CD`), description, sort_order, is_active.
"All Division" is **not** a row — it's a virtual option in forms meaning "no division filter".

**`products`**: name **required unique (case-insensitive)**, description, is_active.
**`product_divisions`**: (product_id, division_id) composite pk — a product can belong to many divisions.

### 5.3 Dropdowns
**`lookup_lists`**: key (text pk), label, icon text, allow_other bool, is_system bool (system lists can't be deleted, only items), sort_order.
Admin can **create new lists** from the Dropdown Manager (key auto-slugged from the label). A new list shows up as a new vertical tab immediately; a developer then binds it to a form field via `useLookup('<key>')`.
**`lookup_items`**: list_key → lookup_lists, value text, sort_order int, is_active bool, unique (list_key, lower(value)).

Seeded lists:
| key | label | allow_other | seed |
|---|---|---|---|
| `hq` | HQ | no | CHN, CBE, CUD, ERD, KUM, MDU, NGL, PDY, SLM, TNJ, TVL, TRY, VLP |
| `qualification` | Qualification | **yes** | Appendix A |
| `speciality` | Speciality | **yes** | Appendix A |
| `offer_type` | Offer / Netrate | no | Offer, Netrate |
| `service_type` | Service Type | **yes** | *(empty — admin fills; until filled, field behaves as free text)* |
| `duty_type` | Duty Type | no | Local, Out Station |
| `leave_type` | Leave Type | no | Casual, Sick, Emergency, Other |

**`division_qual_spec_map`** — the Professional Details mapping:
| column | notes |
|---|---|
| division_id | → divisions |
| qualification_item_id | → lookup_items (list `qualification`) |
| speciality_item_id | → lookup_items (list `speciality`) |
| unique (division_id, qualification_item_id, speciality_item_id) | |

(FKs are fine here — this is configuration, not transactional data.)

### 5.4 Doctors
**`doctors`**: manager_id → profiles (role manager), name **required**, phone, email, qualification (text), speciality (text), division (text), area, hospital_name, pharmacy_name, hq (text), notes, is_active.
- One manager owns many doctors. Admin can reassign a doctor to another manager.

### 5.5 Service Requests (raised by Doctor's Manager)
Mirrors the current Google form: a manager **adds several services** (each "Add service") and then **submits them together** ("Submit Service Request") → one combined email.

**`service_request_batches`**
| column | notes |
|---|---|
| ref_no | `SR-2610-0001` (YYMM + sequence, trigger) |
| manager_id, manager_name | snapshot |
| accountability_staff_id (nullable, set null), accountability_staff_name | picked from Staff directory |
| status | `draft → submitted → approved / rejected → fulfilled` |
| submitted_at, decided_by, decided_at, admin_note | |

**`service_requests`** (line items)
| column | form field |
|---|---|
| batch_id | |
| request_date | Date * |
| doctor_id (nullable) + doctor_name * | Doctor Name — pick from manager's doctors (auto-fills fields below), or type a new one (option "Save as new doctor") |
| area * | Area |
| hospital_name * | Hospital Name |
| pharmacy_name | Pharmacy Name |
| hq * | HQ (dropdown) |
| division * | Division (OL / CC / CD / All Division) |
| qualification * | Qualification (+ Others → text) |
| speciality * | Speciality (+ Others → text) |
| service_amount * numeric(12,2) | Service Amount |
| service_type * | Service Type |
| expected_business_value * numeric | Expected Business Value |
| current_business_value * numeric | Current Business Value |
| offer_type * | Offer / Netrate |
| offer_percent numeric(5,2) | required if Offer (0–100) |
| netrate_amount numeric(12,2) | required if Netrate |

### 5.6 Starter Pack (raised by Staff)
**`starter_pack_requests`**
| column | form field |
|---|---|
| ref_no | `SP-2610-0001` |
| request_date * | Date (default today) |
| doctor_id (nullable) + doctor_name * | Doctor Name (search doctor directory or type) |
| qualification * | Qualification |
| doctor_area * | Doctor Area |
| staff_id + staff_name * | auto from logged-in staff (admin can choose when creating on behalf) |
| staff_area * | auto from staff profile, editable |
| division * | OL / CC / CD / All Division (tabs) |
| status | `submitted → processing → fulfilled` or `cancelled` |
| fulfilled_by, fulfilled_at, admin_note | |

**`starter_pack_items`**: request_id, product_id (nullable, set null), product_name * (snapshot), quantity * text (e.g. "1 box", "10 strips"), sort_order. **At least one item required.**

### 5.7 Trip Duty (Drivers)
**`driver_day_entries`** — one row per duty, or per Week Off / Leave day
| column | notes |
|---|---|
| driver_id, driver_name | snapshot |
| entry_date * | |
| entry_type * | `duty` / `week_off` / `leave` |
| duty_type | Local / Out Station (duty only) |
| vehicle_source | `fleet` / `own` / `other`. **own** = the guest's own car (e.g. a doctor's car the driver drives) |
| vehicle_id (nullable) + vehicle_label | snapshot, e.g. `CRYSTA 6435`. Own: vehicle_id = null, label `Own (guest vehicle)`. Others: vehicle_id = null, label `Others · <typed details>` (e.g. `Others · Audi`) |
| guest_name, guest_area, pickup_point, drop_point | |
| start_km int, start_time time | start_km **required only for fleet vehicles**; start_time required to start a duty |
| end_km int, end_time time | end_km required only for fleet (end_km ≥ start_km) |
| total_km int (nullable) | end_km − start_km, or the Total KM from an import; null when unknown (Own vehicle) |
| total_minutes int | computed on close (handles past-midnight), or "9 hrs 30 mins" from an import |
| fuel_litres numeric(7,2), fuel_amount numeric(10,2) | optional |
| duty_status | `open` / `closed` (imported duties are `closed`) |
| leave_type, leave_reason, leave_status | leave only: `pending / approved / rejected` |
| decided_by, decided_at | |
| entry_source | `app` / `import` |
| import_batch_id (nullable) | → `duty_import_batches`; lets an import be undone as a whole |
| notes | |

Rules (DB trigger + UI):
- A driver may log **multiple duties** on one date.
- A date with `week_off` or (non-rejected) `leave` cannot also have a duty, and vice versa.
- Apply Leave accepts a **date range** → creates one row per day.
- Week Off: one tap for a date (default today).
- Driver can edit their own entries for **7 days** (setting); after that only Admin.
- Warn (not block) if start_km < the previous closed duty's end_km for the same vehicle.
- Driver vehicle dropdown order: active fleet vehicles (`CRYSTA 6435` …) → **Own (guest vehicle)** → **Others** (text box). KM fields hide for Own/Others and become optional.

**`duty_import_batches`**: file_name, driver_id + driver_name, month, rows_read, duties, week_offs, leaves, mode (`replace` / `fill`), replaced_count, issues jsonb, created_by, created_at, undone_at.

### 5.8 Settings & logs
- **`beta_rates`** — chauffeur beta rate history: effective_from date **required unique**, local_rate numeric **required**, outstation_rate numeric **required**, note, created_by. Never updated in place; a rate change = a new row. Seed: `2026-04-01, 250, 300` (confirm the real start date).
- **`beta_statements`** — a finalised month: month (date, 1st of month), driver_id + driver_name, local_days, outstation_days, payable_days, local_amount, outstation_amount, total_amount, rates_used jsonb, finalised_by, finalised_at; unique (month, driver_id). Plus **`beta_months`**: month pk, status `draft | finalised`, finalised_by/at, reopened_by/at, reopen_reason.
- **`app_settings`** (key/value jsonb): `notify_emails` (admins who receive request emails), `company_name`, `logo_url`, `driver_edit_window_days` (7).
- **`login_attempts`**: phone, ip, created_at (manager rate-limiting).
- **`activity_log`**: actor_id, entity, entity_id, action, diff jsonb (written by triggers on requests and duties).

### 5.9 RLS summary
| Table | Admin | Staff | Driver | Manager |
|---|---|---|---|---|
| profiles | all | read active staff (directory), update self (limited cols) | read/update self | read active staff (for accountability), update self |
| vehicles | all | – | read active | – |
| divisions, products, product_divisions, lookup_*, map | all | read active | read active | read active |
| doctors | all | read (for starter-pack search) | – | CRUD own (`manager_id = auth.uid()`) |
| service_request_batches/items | all | read where accountability_staff_id = self | – | CRUD own while `draft`, read own after |
| starter_pack_requests/items | all | CRUD own while `submitted`, read own | – | – |
| driver_day_entries | all | – | CRUD own within edit window | – |
| beta_rates, beta_months, beta_statements | all | – | read own statements | – |
| app_settings | all | – | – | – |

Users can never change their own `role`, `is_active`, or `phone` (column-level check via trigger).

---

## 6. Module Specs

### 6.1 User Management (Admin)
Three tabs: **Staffs · Drivers · Doctor's Managers** (+ Admins in Settings).
- List: avatar, name, phone (tap-to-call), email, area; search; active/inactive filter.
- Create/Edit as a full page with role-specific fields (Section 5.1); image upload with crop.
- Actions: deactivate/reactivate, resend invite, force logout.
- **Staff Directory** (read-only card list, searchable by name/area) available to Staff, Managers and Admin.

### 6.2 Vehicles (Admin)
CRUD table: Name, Vehicle Number*, Color, Make, Model, Year, Active. Duplicate vehicle number blocked. Inactive vehicles hidden from driver dropdown.

### 6.3 Divisions (Admin)
CRUD: Name*, Description, sort order. Deleting a division with mapped products → soft deactivate only.

### 6.4 Products (Admin)
- CRUD: Name*, Description, **Divisions (multi-select chips: OL / CC / CD)**, Active.
- Filter by division. Bulk import via CSV (name, description, divisions "OL|CC").
- Seed from Appendix B.

### 6.5 Dropdown Manager (Admin)
- **Vertical tabs** (so new lists are easy to add): left column lists every dropdown list (icon, label, item count) grouped under *Lists* and *Mappings*, with a **"+ New dropdown list"** button at the bottom → full-page form (List name*, Allow "Others" switch).
  - Desktop (≥900px): sticky 270px left column, items panel on the right.
  - Mobile: the column collapses into one **"Dropdown list: <current> · Change"** button; tapping it expands the full single-column list. Never a 2-column grid (labels get cut off).
- Right panel: list title, "N active of M", note when the list has an "Others" option, **Add item** (full page), and rows with drag handle (reorder), active switch, edit (full page), delete (confirm modal).
- Banner: "Changes apply to new entries only. Existing records keep their saved values."
- **Qualification mapping** (a vertical tab under *Mappings*): pick a Division (chips) → table of Qualification ↔ Speciality pairs; add pair (two SearchSelects), remove pair (confirm modal); "Copy mapping from division" helper.

### 6.6 Doctors (Manager + Admin)
- Manager home = "My Doctors" card list: name, speciality, hospital, area; search.
- Add/Edit doctor: Name*, Phone, Email, Division, Qualification, Speciality (same cascade as 6.7), Area, Hospital, Pharmacy, HQ, Notes.
- Doctor detail shows their service-request history.
- Admin: all doctors, filter by manager, reassign manager, export CSV.

### 6.7 Service Requests
**Manager flow (mobile)**
1. "New Service Request" → opens current **draft batch** (one open draft per manager).
2. Choose **Accountability (Staff)** once per batch (SearchSelect from staff directory).
3. "Add Service" form (Section 5.5 fields), sections: *Basic Information · Professional Details · Service & Business Details*.
4. Each saved service appears as a card in the batch (edit / remove).
5. **Submit Service Request** → batch `submitted` → combined email (Section 7) → confirmation screen with ref no.

**Professional Details cascade**
- Division options: active divisions + "All Division".
- Qualification options: if a division is chosen → distinct qualifications mapped to it; if "All Division" or no mapping exists → all active qualifications. Always ends with **Others**.
- Speciality options: specialities mapped to (division + qualification); fallback to all mapped to the division; then all active. Always ends with **Others**.
- Changing Division clears Qualification and Speciality; changing Qualification clears Speciality.
- All three are searchable dropdowns (SearchSelect component — search box inside the dropdown, like the current form).

**Offer / Netrate**: Offer → show "Offer %" (required); Netrate → show "Netrate Amount" (required).

**Admin view**
- Table: ref no, date submitted, manager, accountability staff, # services, total service amount, status. Filters: status, date range, manager, staff, division, HQ.
- Batch detail: all line items; actions **Approve / Reject (reason) / Mark Fulfilled**; download PDF; export CSV (one row per line item — matches the old Google Sheet).

### 6.8 Starter Pack
**Staff flow (mobile)**
1. "New Starter Pack": Date (today), Doctor Name (search directory or type), Qualification, Doctor Area, Staff Name & Area (prefilled), Division tabs **OL · CC · CD · All Division**.
2. Products table: rows of **Product Name** (SearchSelect filtered by selected division; "All Division" = every active product; free text allowed → saved as typed) + **Quantity** + remove. **Add Product** button adds a row. Switching division asks before clearing rows.
3. Submit → ref no + email to admin. "New Entry" resets form, keeps staff fields.
4. "My Requests" list with status.

**Admin view**
- List with filters (status, date, staff, division), detail view, **Mark Processing / Fulfilled / Cancel**, **Download PDF** (single) and **bulk PDF/CSV** for a date range.
- PDF layout: LAIRON header + logo, ref no, date, doctor block, staff block, division, product table (S.No, Product, Qty), status, signature lines.

### 6.9 Trip Duty
**Driver "Today" screen (main tab)**
- Three big buttons: **Start Duty · Week Off · Apply Leave**.
- If a duty is `open`: card showing it with **Close Duty** button.
- *Start Duty* form: Date (today), Duty Type (Local / Out Station), Vehicle (dropdown of active vehicles as `CRYSTA 6435`, last option **Others** → required "Vehicle details" text), Guest Name, Guest Area, Pickup Point, Drop Point, Starting KM, Starting Time (default now) → saves as `open`.
- *Close Duty*: Ending KM, Closing Time, Fuel in Liters, Fuel Amount → **Submit Duty** (`closed`). Shows total KM and hours.
- A driver can also fill start + end in one go (for back-entry) — same form, all fields visible, "Submit Duty".
- Week Off: confirm date → saved. Apply Leave: from–to date, leave type, reason → `pending`, email to admin.

**Driver "My Duties"**
- Month picker. Calendar grid (colour dots: duty = blue, week off = grey, leave = amber/green/red by status) + list below.
- Month summary: duty days, week offs, leaves, total KM, total fuel litres & amount.

**Admin "Trip Duty"** — tabs: **Driver month · All drivers · Chauffeur beta · Leave requests**
- Pick **Driver** + **Month** → same calendar + full table (all fields), totals row, edit any entry. Calendar shows "Outstation" for a day if any duty that day is Outstation, plus "N duties" when more than one.
- All-drivers month overview: one row per driver with duty days / week offs / leaves / KM / fuel.
- Chauffeur beta: Section 6.11.
- Leave approvals queue (approve / reject with note → email driver).
- Export month to CSV and PDF.

### 6.11 Chauffeur Beta (Monthly Summary)
Replaces the current "Monthly Chauffeur Beta Summary" sheet. Beta = the daily allowance paid to each driver.

**Rates (current)**: Local **₹250**, Outstation **₹300** per payable day. Stored in `beta_rates` with an effective-from date; editable by Admin.

**Calculation rules** (implement once as a Postgres function `beta_summary(month date, driver uuid default null)` and reuse it for the screen, CSV, PDF and finalisation — never re-implement in the frontend):
1. Only `entry_type = 'duty'` with `duty_status = 'closed'` counts. Week offs, leaves and still-open duties pay nothing.
2. **One payable duty per driver per date**: all duties of the same driver on the same `entry_date` collapse into one payable day.
3. **Outstation wins**: if *any* duty that driver logged on that date is `Out Station`, the whole day is Outstation; otherwise it is Local.
4. **Rate per day** = the `beta_rates` row with the latest `effective_from ≤ entry_date`. A rate change mid-month applies from its date only; it is never applied backwards.
5. Per driver: `local_days`, `outstation_days`, `payable_days = local + outstation`, `total_beta = Σ day rate`.

```sql
-- core of beta_summary()
with days as (
  select driver_id, entry_date,
         bool_or(duty_type = 'Out Station') as is_out,
         count(*) as duties
  from driver_day_entries
  where entry_type = 'duty' and duty_status = 'closed'
    and entry_date >= $month and entry_date < ($month + interval '1 month')
  group by driver_id, entry_date
)
select d.driver_id,
       count(*) filter (where not is_out) as local_days,
       count(*) filter (where is_out)     as outstation_days,
       count(*)                           as payable_days,
       sum(case when is_out then r.outstation_rate else r.local_rate end) as total_beta
from days d
cross join lateral (
  select local_rate, outstation_rate from beta_rates
  where effective_from <= d.entry_date order by effective_from desc limit 1) r
group by d.driver_id;
```
All active drivers appear in the summary, including drivers with **0** payable days (left-join from `profiles`).

**Screen** (Trip Duty → *Chauffeur beta* tab):
- Filters: **Month** (default current), **Driver** (All drivers / one driver). Updates live; no "Generate" button needed.
- Rate card: Local and Outstation amounts, the three rules in plain words, "Rates in force since <date>", **Edit rates** → full page.
- Four counters for the selection: **Local days · Outstation days · Total payable duties · Total beta** (highlighted).
- **All drivers**: table Driver | Local days | Outstation days | Total payable duties | Total beta, with a **Day-wise** button per row.
- **One driver**: day-wise table Date | Duties logged ("→ counted once" when >1) | Day counted as (Local/Outstation badge) | Beta. This is how the admin answers "why is my beta X?".
- Export: CSV (one row per driver, matching the old sheet's columns) and PDF.
- **Finalise month**: confirm modal → writes `beta_statements` rows, sets `beta_months.status = finalised`. A finalised month shows a "Finalised" badge and reads from `beta_statements`, so later duty edits don't change paid amounts. **Reopen** requires a reason (logged). A new rate cannot start inside a finalised month.

**Beta rates page** (full page): Local rate ₹*, Outstation rate ₹*, Effective from*, Note; below it, the rate history table (current one marked). Validation: whole rupees > 0, unique effective date, not inside a finalised month.

**Driver side** (My Duties): show "Beta this month: ₹X (L local days · O outstation days)" under the month summary, using the same function.

### 6.10 Admin Dashboard
KPI cards (current month, tap → filtered list): Pending Service Requests, Pending Starter Packs, Drivers on duty today, Pending leave requests, Chauffeur beta this month (with total KM as subtext), Fuel spend this month.
Recent activity feed. Quick actions: Add Staff, Add Driver, Add Manager, Add Product.

---

### 6.12 Trip Duty Import (Excel / CSV)
Lets Admin load past months and drivers' existing sheets. Entry point: **Import duties** button on the Trip Duty page → full page, two steps.

**Step 1 — Upload**
- Drop zone / file picker: `.xlsx`, `.xls`, `.csv`. Parse **in the browser** with SheetJS (`xlsx`), first sheet, header row = row 1. Read dates as Excel serial numbers (`cellDates: false`) and convert in UTC. Reading them as JS Dates shifted every day back by one in testing.
- **Download template** (xlsx): Date · Driver · Entry Type · Duty Type · Vehicle · Guest · Guest Area · Pickup Point · Drop Point · Starting KM · Ending KM · Starting Time · Closing Time · Total Hours · Fuel in Liters · Fuel Amount, with 3 example rows.
- Also accepts **LAIRON's current sheet** as-is: `Date · Vehicle · Guest · Total KM · Total Hours · Month`.
- "Recent imports" table: file, driver, month, rows, duties, **View**, **Undo** (confirm modal → deletes that batch's entries only; hand-entered entries stay).

**Column matching** (case/space/punctuation-insensitive aliases): date; driver; entry type/status; duty type; vehicle; guest/guest name; guest area; pickup/from; drop/to; starting/start/opening km; ending/end/closing km; total km/km; starting/start time; closing/end time; total hours/hours/duration; fuel in liters/litres; fuel amount; month. Unknown columns are listed and ignored.

**Row rules**
| Input | Result |
|---|---|
| Guest, Vehicle or Entry Type says `weekoff` / `week off` | `week_off` entry |
| `leave` / `absent` | `leave` entry (status approved) |
| Vehicle `Own` | vehicle_source `own`, no KM needed |
| Vehicle matching a fleet label (`AMAZE 6960`) | vehicle_source `fleet`, vehicle_id linked |
| Any other vehicle text (`Audi`) | `other`, label `Others · Audi` (note shown) |
| `-` or blank cells | null |
| Total Hours `9 hrs 30 mins`, `9:30`, Excel time, or a number of hours | total_minutes |
| No Duty Type column / blank | **Local**, with one summary note ("all 27 duties counted as Local"); admin fixes Out Station days afterwards |
| Date in dd/mm/yyyy, yyyy-mm-dd or Excel date | entry_date; unreadable date = **error**, row skipped |

**Driver & month detection**: driver from a Driver column (single value) or the file name (`PRAKALATHAN.M — September_2026.xlsx`); month from the Month column (`September_2026`) or the most common date. Both stay editable.

**Step 2 — Review** (nothing is saved yet)
- Counters: rows read, duties, week offs, leaves, errors, days with no entry.
- **Beta preview** using `beta_summary` rules: e.g. "27 duties → 26 payable days → ₹6,500".
- **Checks** list with row numbers: errors (block import: unreadable date, duty and week off on the same date), warnings (date outside the month, fleet vehicle without KM, invalid KM), notes (non-fleet vehicle, missing duty type, several duties on one date), and gaps (dates with no entry, e.g. 23 Sep).
- If the driver already has entries that month: choose **Replace the month** (confirm modal) or **Fill empty days only**.
- Preview table of every row (date, entry, vehicle, guest, KM, hours).
- **Import N rows** (disabled while there are errors or no driver/month) → one Edge Function / RPC call `import_duties(batch jsonb)` that validates again in Postgres and inserts in a single transaction → redirect to that driver's month.
- A finalised beta month can still be imported into, but its beta stays locked until reopened (warned in the modal).

## 7. Email (Resend)

Edge Function **`send-email`** (internal) + **Database Webhooks** on insert/update of request tables → Edge Function **`notify`**, which loads the record with the service role, picks the template and calls Resend. Emails never block the user action; failures are logged in `email_log` (to, template, status, error) and retryable from Admin.

| Event | To | Template |
|---|---|---|
| User created | the user | Welcome + set password link |
| Password reset | the user | Reset link (Supabase SMTP via Resend) |
| Service request batch submitted | `notify_emails` + accountability staff | Combined table of all services in the batch + link |
| Service request approved/rejected/fulfilled | manager (if email) + accountability staff | Status + admin note |
| Starter pack submitted | `notify_emails` | Doctor, staff, product table + link |
| Starter pack fulfilled | staff | Confirmation |
| Leave applied | `notify_emails` | Driver, dates, reason |
| Leave decided | driver | Approved / rejected + note |

Templates: React Email, LAIRON branding, mobile-friendly, plain-text fallback.

---

## 8. Navigation & Screens (use for the HTML design step)

**Mobile (bottom tab bar)**
- **Staff**: Home · New Starter Pack · My Requests · Directory · Profile
- **Driver**: Today · My Duties · Profile
- **Manager**: My Doctors · New Request · My Requests · Profile
- **Admin on mobile**: Dashboard · Requests · Duties · More (menu)

**Desktop/tablet (Admin)** — left sidebar:
Dashboard · Service Requests · Starter Packs · Trip Duty (Driver month · All drivers · Chauffeur beta · Leave requests) · Users (Staffs · Drivers · Doctor's Managers) · Doctors · Vehicles · Divisions · Products · Dropdowns (vertical tabs, incl. Qualification mapping) · Settings · Email Log

**Screen inventory for HTML designs**
1. Login (Email tab / Doctor's Manager phone tab)
2. Admin Dashboard
3. Admin list page pattern (table → mobile cards + filters + full-page form) — reused for all masters
4. Dropdown Manager + Mapping
5. Service Request — manager batch + add-service form
6. Service Request — admin detail
7. Starter Pack — staff form with dynamic product rows
8. Starter Pack — admin detail + PDF preview
9. Driver Today (start/close duty, week off, leave)
10. Driver month calendar
11. Admin driver-month view
12. Profile / Staff directory
13. Chauffeur beta summary + beta rates page
14. Trip duty import (upload → review)

Done in `design/lairon-ez-prototype.html`: 1 (login), 2, 3, 4, 5 (manager), 6, 8, 9 and 10 (driver), 11, 13, 14. Still to design: 7 (staff starter-pack form) and 12 (staff directory).

**Prototype routes** (hash routes; mirror them in React Router):
| Route | Screen |
|---|---|
| `#/login` | Sign in: Email tab (admin/staff/driver) with show/hide password and Forgot password → "check your email"; Doctor's Manager tab (+91 phone; `phone_only` signs in directly, `otp` shows a 6-digit code step). Generic errors, 5-attempt lockout message. |
| `#/d/today` | Driver home: open-duty card (route, guest, vehicle, start time/KM, elapsed, **Close duty**), tiles **Start duty · Week off · Apply leave** (Start is disabled with a reason while a duty is open, or on a week off/leave day), pending leave notices, today's closed duties, month stats incl. beta so far |
| `#/d/duty/new` · `#/d/duty/edit/:id` | Start duty (full page): Date (last 7 days), Duty type segmented Local/Out Station, Vehicle select (fleet `CRYSTA 6435`… / Own (guest's vehicle) / Others + details), Guest name*, area, pickup, drop, Starting KM (fleet only, shows last closing KM and warns if lower), Starting time. "Duty already finished?" switch reveals End: Ending KM, Closing time, Fuel L, Fuel ₹ with a live total ("52 km · 9h 15m · Ends next day") |
| `#/d/duty/close/:id` | Close duty: read-only summary + Ending KM, Closing time (default now), fuel; live totals |
| `#/d/weekoff` · `#/d/leave` | Week off (one date, no approval) · Apply leave (from/to with live day count, type, reason; goes to admin as pending) |
| `#/d/month` | My Duties: month picker, stats (duty days, week offs, leaves, KM, fuel, beta), calendar, entries grouped by day; edit/delete within 7 days |
| `#/d/profile` | Profile, my leave requests (cancel while pending), sign out |
| `#/m/doctors` | My Doctors: search, cards with **Request service** and Edit, FAB add |
| `#/m/doctors/new` · `edit/:id` | Doctor form with Division → Qualification → Speciality cascade |
| `#/m/request` | Draft request: Accountability (staff) picker, service cards (edit/remove), total, **Submit service request** (confirm modal) |
| `#/m/request/add` · `edit/:n` | Add service: Basic information (doctor picker autofills area/hospital/pharmacy/HQ/division/qualification/speciality, or "New doctor" + "Also save to My Doctors"), Professional details cascade, Service & business details, Offer/Netrate segmented → Offer % or Netrate ₹ |
| `#/m/requests` · `view/:id` · `done/:id` | My Requests (draft card + submitted list), read-only request view, submitted confirmation with ref no |
| `#/m/profile` | Profile, sign out |


---

## 9. UX Standards

### 9.1 Theme & design tokens (from `design/lairon-ez-admin.html`)
Glassmorphism on a soft blue background, kept easy on the eyes with AA contrast.
| Token | Value | Use |
|---|---|---|
| `--primary` | `#2b5cc6` (hover `#224cab`) | buttons, active tabs, links, switches |
| `--primary-soft` | `rgba(43,92,198,.11)` | active nav background, icon chips |
| `--bg` | `#ebf0f7` + blurred blobs `#cddcf3`, `#e0dbf2`, `#f1e6dc` | page background |
| `--ink` / `--ink-2` / `--muted` | `#142033` / `#34405a` / `#586579` | text |
| glass | `rgba(255,255,255,.64)`, `backdrop-filter: blur(18px) saturate(140%)`, border `rgba(255,255,255,.78)` | cards, nav bars, modals (opaque fallback if blur unsupported) |
| status | ok `#15803d`, info `#1d4fb5`, warn `#9a4a07`, danger `#b42318`, teal `#0b5f55` | badges (text on tinted bg) |
| radius | 18px cards, 12px controls, 22px modals | |
| font | Plus Jakarta Sans 400–800; inputs 16px (no iOS zoom); tabular numbers for amounts/KM | |

Component rules:
- **Lists**: one DataTable component; ≥768px a table, <768px each row becomes a glass card (label: value rows, primary cell as card header, actions at the bottom). Search, tabs with counts, chips filters, "Show more" paging, empty states.
- **Forms**: always a full page; sections in glass cards; sticky bottom action bar (Cancel / Save) on mobile; "Discard changes?" modal on leaving a dirty form.
- **Confirmations**: `ConfirmDialog` modal for every delete, reject, cancel, finalise and sign out. Focus starts on Cancel; Esc and backdrop close; reject/cancel/reopen require a reason field.
- **Icons**: `lucide-react` only (names in the prototype map 1:1).
- **Responsive helpers**: hide elements per breakpoint with Tailwind (`hidden lg:inline-flex`, `lg:hidden`). Never use `display: revert`; it turned flex buttons back to inline and misaligned their icons in the prototype.
- **Navigation**: Admin: mobile bottom bar (Home · Requests · Starter · Duties · More), desktop left sidebar with pending counts. Driver: Today · My Duties · Profile. Manager: My Doctors · New Request (badge = services in draft) · My Requests · Profile. Driver/manager apps stay a centred ~680px column on desktop with the bottom bar kept.
- **SearchSelect**: a button-styled field that opens a picker: a bottom sheet on phones (<640px), a centred dialog on larger screens. It has a search box when the list has more than 7 items. **Others** is always visible and opens a required text box. A note says when the list is filtered by the division mapping. It is used for Doctor, Division, Qualification, Speciality, Service type and Accountability staff; short lists (HQ, Leave type, Vehicle) use native selects.
- **Segmented control** for two- or three-option choices (Duty type, Offer/Netrate, login tabs).
- **Live calculations never re-render the form.** KM, hours and leave-day totals update in place as the user types. In the prototype, re-rendering when a field lost focus swallowed the next tap on Submit. In React, keep inputs controlled and derive totals with `useMemo`; never remount a form section on blur.
- Mobile-first, tap targets ≥ 44px, sticky bottom action buttons on forms, numeric keyboards (`inputmode="numeric"/"decimal"`) for KM, amounts, phone.
- Every list: search, empty state, skeleton loading, pull-to-refresh on mobile.
- Forms: inline Zod errors, disable submit while saving, toast on success, unsaved-changes guard.
- Currency ₹ with Indian grouping (`en-IN`), dates `dd MMM yyyy`, times 12-hour.
- Statuses as coloured badges, consistent across modules.
- Accessible: labels on all inputs, focus states, WCAG AA contrast.

---

## 10. Reports & Exports
- CSV export on every admin list (respecting current filters).
- PDFs: Starter Pack request, Service Request batch, Driver monthly duty sheet.

## 11. Non-functional
- Indexes on all FKs, `(driver_id, entry_date)`, `(status, created_at)`, `lower(name)` on products/doctors.
- All server mutations validated again in Postgres (check constraints/triggers), not just Zod.
- Timestamps stored UTC, displayed Asia/Kolkata.
- Daily Supabase backups (Pro plan) recommended before go-live.

---

## 12. Build Phases (one Claude Code session each)

| # | Phase | Done when |
|---|---|---|
| 0 | **Setup** — Vite+TS+Tailwind+shadcn, router, Query, Supabase client, lint/prettier, Vitest, PWA, folder structure, `.env.example` | App runs; CI script `npm run check` passes |
| 1 | **DB foundation** — migrations for all tables, enums, triggers (updated_at, ref_no, snapshot checks, duty rules), RLS, helper functions, `seed.sql` from Appendices | `supabase db reset` works; RLS tests pass for each role |
| 2 | **Auth** — email login, manager phone login (both modes), invite/reset, role guards, layouts (sidebar + bottom tabs), profile page with avatar | Each role logs in and lands on its home |
| 3 | **Masters** — Users (3 tabs + directory), Vehicles, Divisions, Products (+ divisions, CSV import), Dropdown Manager, Qualification Mapping | Admin can CRUD all; snapshot rule verified by test |
| 4 | **Doctors** — manager CRUD, admin view/reassign | |
| 5 | **Service Requests** — batch flow, cascade dropdowns, Offer/Netrate, admin review, PDF, CSV | End-to-end Playwright test |
| 6 | **Starter Pack** — dynamic product rows, division filtering, admin fulfil, PDF single/bulk | End-to-end Playwright test |
| 7 | **Trip Duty + Chauffeur Beta + Import** — Today screen, open/close duty (fleet / Own / Others vehicle), week off, leave range, calendar, admin driver-month, approvals, exports; `beta_rates`, `beta_summary()` SQL function, beta tab, rates page, finalise/reopen; duty import (Section 6.12) with template, review, replace/fill, undo | Playwright test + SQL tests for beta rules (two duties same day = 1; local + outstation same day = outstation; mid-month rate change; zero-duty driver listed) + import test with `fixtures/PRAKALATHAN.M — September_2026.xlsx` expecting 30 rows, 27 duties, 3 week offs, 26 payable days, ₹6,500, gap on 23 Sep |
| 8 | **Email** — Resend edge functions, webhooks, templates, email log + retry | All events in Section 7 send |
| 9 | **Dashboard & polish** — KPIs, activity feed, empty/loading states, PWA icons, performance pass | Lighthouse mobile ≥ 90 |
| 10 | **Deploy** — Supabase prod project, env secrets, hosting, custom domain, Resend domain verification (SPF/DKIM), go-live checklist | |

---

## Appendix A — Professional Details seed (from current Service Request form)

Seed `qualification` and `speciality` lookup items as the **union** of the flat lists and every value used in the mapping below, keeping the exact strings. (The old form has naming variants like `MD` vs `M.D`; Admin cleans these up later in the Dropdown Manager — safe because data is flat.)

**Flat qualification list**: MBBS, MBBS DLO, MBBS C.Diab, MBBS D.Diab, MBBS DGO, MBBS D.Ch, MBBS D.Derma, MBBS D.Anesthesia, MBBS D.Ophthal, M.D, M.D D.Diab/ C.Diab, M.D D.N.B, M.D DM, M.S, M.S M.Ch, B.D.S/M.D.S, B.P.T/M.P.T

**Flat speciality list**: Arthroscopy surgeon, Cardiologist, Cardio thoracic surgeon, Consulting physician, Dentist, Dermatologist, Diabetologist, Emergency residents, Endocrinologist, ENT, Gastroentrologist, Geriatrician, Gynecologist/Infertilist, Intensivist/Anesthesiologist, Microbiologist, Nephrologist, Neurologist, Neuro surgeon, Oncologist, Onco surgeon, Orthopaedics, Orthopadedic surgeon, Paediatrician, Paediatric surgeon, Physiotherapist, Podiatrist, Pulmonologist/Chest Physician, Rheumatologist, Spine surgeon, Urologist, Vascular surgeon

("Others" is not seeded as an item — it's added by the UI when `allow_other = true`.)

**Mapping — `[qualification, speciality]` per division**
```json
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
```

## Appendix B — Products seed (from current Starter Pack form)
```json
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
```

## Appendix C — Open decisions (defaults applied; change if needed)
1. **Manager login**: `phone_only` as requested; OTP (MSG91) ready via flag. *Recommended: switch to OTP before go-live.*
2. **Doctor ↔ Manager**: one manager per doctor (admin can reassign).
3. **Service Request accountability**: one staff per batch (old form allowed per line, but combined by staff anyway).
4. **Leave**: requires admin approval; Week Off does not.
5. **Driver edit window**: 7 days, configurable.
6. **Service Type**: dropdown-managed with "Others" free text (was free text in the old form).
7. **Products in Starter Pack**: free-text product names allowed (as in old form), saved as typed.
8. **Beta counts closed duties only**: an open (not yet closed) duty doesn't pay until the driver closes it.
9. **Multi-day outstation trips**: beta is counted on each duty's `entry_date`. A 2-day trip must be logged as two daily duties to pay 2 days. *Confirm with LAIRON*; alternative is an "end date" on Outstation duties that pays every day in the range.
10. **Beta rates effective date**: seeded from 01 Apr 2026. *Confirm the real date.*
11. **"Own" vehicle** is read as the guest's own car (e.g. Dr. Rakshana's), driven by the LAIRON driver. It still earns beta. *Confirm.*
12. **Current sheets have no Local/Outstation column**, so imported duties default to Local. *Ask LAIRON to add a Duty Type column, or mark Outstation days after import.*

## Appendix D — Real drivers & fleet (seed)
**Drivers** (role `driver`; names exactly as LAIRON writes them; phone/email still needed — required for login):
PRAKALATHAN.M · RAVIKUMAR.N · PACHAIYAPPAN.K · VIGNESH.P · THINAKARAN.M · VIJAYA SIVASANKAR.P · ELUMALAI.G

**Vehicles** (only the last 4 digits are known; get full registration numbers before go-live):
| name | number (last 4) | make / model |
|---|---|---|
| CRYSTA | 6435 | Toyota Innova Crysta |
| CRYSTA | 2172 | Toyota Innova Crysta |
| CRYSTA | 7157 | Toyota Innova Crysta |
| CRYSTA | 7186 | Toyota Innova Crysta |
| AMAZE | 6960 | Honda Amaze |
| DZIRE | 0523 | Maruti Suzuki Dzire |
Plus the built-in **Others** option in the driver form (not a vehicle row).

**Real September 2026 sheet — PRAKALATHAN.M** (`Driver-data.xlsx`, seeded and used as the import test fixture): 30 rows → 27 duties + 3 week offs (6, 21, 22 Sep); 14 Sep has 2 duties (Own / Dr. Rakshana and AMAZE 6960 / Dr. Jaswanth, 93 km) → 26 payable days; 24 Sep vehicle "Audi" → Others; 23 Sep has no entry; no duty-type column → all Local → **26 × ₹250 = ₹6,500**.

**Beta check against the October 2026 sheet**: e.g. RAVIKUMAR.N 10 local + 2 outstation = 12 payable → 10×250 + 2×300 = **₹3,100**; ELUMALAI.G 9 + 3 = 12 → **₹3,150**; all drivers 56 + 12 = 68 → **₹17,600**. Use these as the expected results for a seeded test month.
