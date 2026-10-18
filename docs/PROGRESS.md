# Progress

## Phase 0 — Setup ✅
- Vite + React 18 + TypeScript (strict), Tailwind v4 with design tokens from `design/lairon-ez-prototype.html`
- React Router v6 with role-guarded route groups (`/admin`, `/staff`, `/driver`, `/m`), TanStack Query, Supabase client
- AuthProvider (session + `profiles` lookup), Login page (email tab live; Doctor's Manager tab stubbed for Phase 2)
- Layouts: AuthLayout, AdminLayout (sidebar / mobile bottom bar), MobileLayout (bottom tabs)
- PWA manifest + service worker (placeholder icons), ESLint, Prettier, Vitest
- `npm run check` passes (typecheck + lint + tests)

## Phase 1 — DB foundation ✅
- `supabase/migrations/` (5 files): tables, triggers/rules, beta + import functions, RLS, avatars bucket
- Ref numbers (`SR-YYMM-0001`, `SP-YYMM-0001`), snapshot columns, duty rules (week-off/leave vs duty, KM, past-midnight minutes), leave approval guard, profile guard (role/phone/is_active)
- Functions: `beta_summary`, `beta_days`, `finalise_beta_month`, `reopen_beta_month`, `import_duties`, `undo_duty_import`, `create_starter_pack`, `submit_service_batch`
- RLS enabled on every public table; policies per PLAN §5.9
- `supabase/seed.sql`: divisions, dropdown lists, 33 qualifications, 49 specialities, 59 mapping pairs, 81 products, 6 fleet vehicles (placeholder numbers), beta rate, settings
- `supabase/tests/phase1.sql`: beta rules, duty rules, snapshot rule, RLS per role, import, RLS-on-all-tables
- Verified on a clean Postgres 16 (with stand-ins for Supabase's `auth`/`storage` schemas). NOT yet run against a real Supabase project.

**Not seeded (need auth users):** the 7 drivers from Appendix D — create them from the portal (Phase 3) with real phone/email.
**Placeholders to replace before go-live:** fleet registration numbers (`TN00XX####`), beta rate start date.

## Phase 2 — Auth ✅ (code complete; not yet exercised against your live Supabase)
- Edge Functions (`supabase/functions`): `admin-create-user` (auth user + profile + invite email, rolls back on failure), `admin-user-action` (deactivate / reactivate / force logout / resend invite), `manager-phone-login` (`phone_only` + `otp` modes, 5 attempts / 15 min per phone, 15 per IP, generic errors). Type-checked with Deno.
- Migration `…000006_force_logout.sql`: `admin_force_logout()` — service role only (verified).
- Frontend: email login (show/hide password, forgot password), Doctor's Manager login (both modes), `/set-password` for invite + reset links, deactivated users signed out with a message, role guards (tested), shared Profile page for all roles (name/area/HQ/bio, avatar upload resized to 512px ≤ 2 MB), `ConfirmDialog` for sign-out.
- `docs/SETUP.md`: step-by-step Supabase setup incl. bootstrapping the first admin.
- `npm run check`: 22 tests pass.

**Needs you:** run docs/SETUP.md steps (push migrations, seed, deploy functions, secrets, create first admin), then try each role.

## Phase 3 — Masters ✅ (code complete; admin screens not yet exercised against live data)
- Shared UI: `DataTable` (table ≥768px / cards below, search, tabs, chips, Show more), `FormPage` (full page, sticky Cancel/Save, "Discard changes?" guard), `SearchSelect` (bottom sheet / dialog, search >7 items, "Others"), `Switch`, `StatusBadge`, `EmptyState`, toasts
- **Vehicles**: CRUD, duplicate-number message, label shown as `CRYSTA 6435`
- **Divisions**: CRUD; a division with products is deactivated, never deleted
- **Products**: CRUD with division chips + filter; CSV import (preview new/existing/skipped, adds divisions, never removes)
- **Dropdown Manager**: vertical tabs (collapses to a "Change" button on mobile), items with active switch, drag **and** up/down reorder, add/edit/delete, new list, list settings, delete non-system lists, **Qualification mapping** (pairs per division, copy from division)
- **Users**: Staffs · Drivers · Doctor's Managers tabs with counts, search/status filter, create (via `admin-create-user`), edit, deactivate/reactivate, resend invite, force logout (all behind confirm modals); **Staff directory** at `/staff/directory`
- Snapshot rule: covered by `supabase/tests/phase1.sql` (renaming/deleting a dropdown item leaves saved text intact)
- `npm run check`: 35 tests pass; production build OK

**Not done / deferred:** avatar upload + crop on the admin user form (users set their own photo on Profile); Admins tab (Settings, Phase 9); manager "staff directory" entry point (Phase 5 accountability picker).

## Phase 4 — Doctors ✅ (code complete; not yet exercised against live data)
- **Manager** (`/m`): My doctors card list (search name/speciality/hospital/area, Active/Inactive/All), floating add button, add/edit full-page form, doctor detail with **service-request history** (ready for Phase 5 data), delete behind a confirm modal
- **Admin** (`/admin/doctors`): all doctors, filter by manager / Unassigned / status, search, **Reassign** modal, edit (with manager select), view, **Export CSV** of exactly the filtered rows (formula-injection safe)
- **Professional Details cascade** (`features/lookups/cascade.ts` + `ProfessionalFields`): Division (active + "All Division") → Qualification → Speciality narrowed by the admin mapping with the plan's fallbacks; changing a parent clears children; "Others" free text; unit-tested. Phase 5 reuses it.
- `supabase/tests/phase4.sql`: manager sees/edits only own doctors, can't hand one to another manager, doctor must belong to a manager-role profile, staff read-only, admin reassigns, doctor survives manager deletion — passes with Phase 1 tests on a clean DB
- `npm run check`: 42 tests; build OK

**Deferred to Phase 5:** "Request service" button on doctor cards (needs the service-request flow).

## Phase 5 — Service Requests ✅ (code complete; not yet exercised against live data)
- **DB** (`…000007_service_request_flow.sql`): `get_or_create_draft_batch()` (one draft per manager), enforced status moves (draft → submitted → approved | rejected → fulfilled; reject needs a reason; submit needs ≥1 service + accountability staff), `decided_by/at` stamped. `supabase/tests/phase5.sql` passes alongside phases 1 and 4.
- **Manager** (`/m`): New Request draft (accountability picker, service cards with edit/remove, running total, Submit with confirm), Add/Edit service (doctor picker autofills + "Also save to My Doctors", Division → Qualification → Speciality cascade, Offer/Netrate segmented → Offer % or Netrate ₹, Service type dropdown with Others or free text until the list is filled), confirmation with ref no, My Requests (draft card + submitted list), read-only request view. "New Request" tab shows a badge with services in the draft.
- **Admin** (`/admin/service-requests`): tabs with counts, search, date range, manager / staff / division / HQ filters, **Export CSV** (one row per line item, filtered), detail with **Approve / Reject (reason) / Mark fulfilled** behind confirm modals, **Download PDF**, **Export CSV**.
- **PDF**: `@react-pdf/renderer` (lazy-loaded chunk), A4 landscape, LAIRON header, services table, total, signature lines. Rendering is unit-tested to a valid PDF.
- `npm run check`: 50 tests; build OK.

**Not done:** the Playwright end-to-end test from the plan (needs a live Supabase project + seeded test users); submit/decision **emails** (Phase 8).
**Heads-up:** main JS bundle is ~780 kB (222 kB gzip); route-level code splitting belongs in Phase 9's performance pass.

## Phase 6 — Starter Pack ✅ (code complete; not yet exercised against live data)
- **DB** (`…000008_starter_pack_flow.sql`): status moves enforced for everyone (submitted → processing | fulfilled | cancelled; processing → fulfilled | cancelled; fulfilled/cancelled final), admin cancel needs a reason, `fulfilled_by/at` stamped, `create_starter_pack` falls back to the profile name. `supabase/tests/phase6.sql` passes with phases 1, 4, 5.
- **Staff** (`/staff`): Home (in-progress / fulfilled counts, recent), New starter pack (date, doctor picker with autofill or typed name, qualification, doctor area, staff name/area prefilled, **Division tabs** OL · CC · CD · All Division, **dynamic product rows** — product picker filtered by division with free text allowed + quantity + remove — "Add product", confirm before clearing rows on division change), confirmation with ref no and **New entry** (keeps staff fields), My requests list, request detail with **Cancel** while Submitted. Staff Directory from Phase 3.
- **Admin** (`/admin/starter-packs`): status tabs with counts; search, date range, staff and division filters; detail with **Mark processing / fulfilled / Cancel (reason)**; **single PDF**, **bulk PDF** and **CSV** of exactly the filtered list; **New** to raise one on behalf of a staff member.
- PDF: LAIRON header, ref/date/status, doctor + staff blocks, S.No/Product/Qty table, signature lines; bulk = one page per request.
- Fixed an accessibility bug found by the form test: `Field` wrapped segmented controls in a `<label>`, so the first button was announced as "Division Division". `Field` now has a `group` mode (used for Division and Offer/Netrate).
- `npm run check`: 58 tests incl. a form test for dynamic rows + division switching; build OK.

**Not done:** editing a submitted pack (staff cancel and re-raise instead), the Playwright end-to-end test (needs live Supabase + test users), submit/fulfil **emails** (Phase 8).

## Phase 7a — Driver app ✅ (code complete; not yet exercised against live data)
- **Today** (`/driver`): open-duty card with live "so far" clock and **Close duty**; tiles **Start duty · Week off · Apply leave** (Start disabled with a reason while a duty is open or on a week-off/leave day); pending-leave notices; today's closed duties; this month's stats incl. **beta so far** (same `beta_summary()` the admin screen will use).
- **Start / edit duty**: date (last N days, N from the admin setting), Local/Out Station, vehicle (fleet `CRYSTA 6435` → Own (guest's vehicle) → Others + details), guest/route, starting KM (fleet only, shows last closing KM and warns — never blocks — if lower), starting time; "Duty already finished?" reveals end KM/time/fuel with live totals ("52 km · 9h 15m · Ends next day"). **Close duty** page with the same live totals.
- **Week off** (no approval) and **Apply leave** (date range, one row per day in a single insert, all-or-nothing; live day count; max 31 days).
- **My Duties** (`/driver/month`): month picker, stats + beta, calendar (duty blue, outstation purple, week off grey, leave amber/green/red), entries by day, edit/delete within the edit window. Profile shows **My leave requests** (grouped) with Cancel while pending.
- **DB** (`…000009_driver_helpers.sql`): `last_vehicle_km()` (returns only a number across drivers) + grants. `supabase/tests/phase7a.sql`: cross-driver last KM, close-duty totals across midnight, leave range atomicity, cancel pending leave, edit window — passes with phases 1, 4, 5, 6.
- Totals are recomputed by Postgres on every save (the app sends `total_km/total_minutes` as null on purpose).
- `npm run check`: 81 tests; build OK.

**Not done:** Playwright end-to-end test; leave-applied / leave-decided emails (Phase 8). Admin side of trip duty is next.

## Phase 7b — Admin Trip Duty + Chauffeur Beta ✅ (code complete; not yet exercised against live data)
- **Trip duty hub** (`/admin/trip-duty`, state in the URL): tabs **Driver month · All drivers · Chauffeur beta · Leave requests** (badge = pending requests).
- **Driver month**: pick driver + month → stats + beta, calendar (shows "Outstation" and "N duties" per day), full table of every field, totals, **Add / Edit duty** (looser admin form — imported rows may lack times/KM), delete behind a confirm modal, **CSV** (every field) and **PDF** (driver monthly duty sheet).
- **All drivers**: one row per driver (duty days, week offs, leaves, KM, fuel L / ₹) → opens that driver's month.
- **Leave requests**: queue grouped by driver + consecutive days; **Approve / Reject (reason)** via `decide_leave()`; drivers see the admin note on their leave list.
- **Chauffeur beta** (all numbers from `beta_summary()` / `beta_days()` — nothing recomputed in the browser): month + driver filters, rate card with the three rules in plain words and "in force since", four counters, all-drivers table with **Day-wise** (Date | duties logged "→ counted once" | Local/Outstation | beta), **Finalise month** (confirm) / **Reopen** (reason required), Finalised badge, **CSV** and **PDF** exports.
- **Beta rates page** (`/admin/trip-duty/beta-rates`): append-only — new rate with effective date, history with the current one marked; duplicate date and finalised-month conflicts show friendly errors.
- **DB** (`…000010_leave_decisions.sql`): `decision_note` column (admin-only via trigger), `decide_leave()`. `supabase/tests/phase7b.sql` reproduces the **Appendix D October check** — RAVIKUMAR.N ₹3,100, ELUMALAI.G ₹3,150, all drivers 56 local + 12 outstation = **₹17,600** — plus finalise freezes amounts, reopen recalculates, and leave-decision rules. All six SQL suites pass.
- `npm run check`: 90 tests (incl. a Beta tab component test); build OK.

**Not done:** leave applied/decided emails (Phase 8); Playwright end-to-end test; live-data verification.

## Phase 7c — Duty import (Excel / CSV) ✅ (code complete; not yet exercised against live data)
- **Import duties** button on Trip duty → `/admin/trip-duty/import`. **Step 1:** drop zone / picker (.xlsx, .xls, .csv, parsed in the browser with SheetJS — first sheet, header row 1), **Download template** (3 example rows), **Recent imports** with View and **Undo** (confirm modal; removes only that batch's entries). **Step 2 (nothing saved yet):** driver + month auto-detected from the sheet / file name and editable; counters (rows read, duties, week offs, leaves, errors, days with no entry); **beta preview** ("27 duties → 26 payable days → ₹6,500"); **checks** with row numbers (errors block; warnings; notes; gaps); Fill-empty-days vs Replace-the-month when entries already exist (Replace asks to confirm, finalised-month warning); preview of every row; **Import N rows** → one `import_duties()` transaction.
- Parser: header aliases (case/space/punctuation-insensitive), Excel serial dates read in UTC, dd/mm/yyyy, yyyy-mm-dd, d-Mon-yyyy, durations (`9 hrs 30 mins`, `9:30`, Excel time, hours), clock times, `-`/blank = null, week off / leave / absent keywords, Own / fleet-label / Others vehicles, default Local with one summary note, invalid KM dropped with a warning, unknown columns listed.
- **Verified against the plan's fixture** (rebuilt from its description): 30 rows, 27 duties, 3 week offs (6, 21, 22 Sep), 14 Sep counted once, 26 payable days, **₹6,500**, gap on 23 Sep, Audi → "Others · Audi" — in the TS tests **and** by pushing the app-built payload through the real Postgres `import_duties()` (`supabase/tests/phase7c.sql`, also covers fill, replace, undo, clash-blocks-import). All seven SQL suites pass.
- Bug caught by a real round-trip test: SheetJS read `01/09/2026` in a CSV as 9 January (US month-first). Files are now read with `raw: true` so dates always go through our day-first parser.
- SheetJS is lazy-loaded (own ~490 kB chunk). Installed from SheetJS's own patched distribution (0.20.3) — the npm `xlsx@0.18.5` has known advisories.
- `npm run check`: 117 tests; build OK.

**Not done:** your real `Driver-data.xlsx` hasn't been run through it (not in the repo) — try it on the Review step; Playwright end-to-end test; emails (Phase 8).

## Phase 8 — Email (Resend) ✅ (code complete; not yet sent through your Resend account)
- **Pipeline**: Postgres triggers → `emit_notification()` (pg_net, fire-and-forget; any failure is swallowed so a user action is never blocked) → Edge Function **`notify`** (secret-header auth) → React Email render → **Resend** → every attempt logged in **`email_log`**.
- **Events** (PLAN §7): user created / resend invite; service request submitted (recipients + accountable staff) and approved/rejected/fulfilled (manager if they have an email + accountable staff); starter pack submitted (recipients) and fulfilled (staff); leave applied — **one email per request, not per day** — and leave approved/rejected (driver). Password reset = Supabase SMTP via Resend (setup in docs/SETUP.md).
- **Templates** (React Email, LAIRON-branded, single column ≤560px, HTML + plain-text fallback, user text escaped): welcome, service request submitted / decided, starter pack submitted / fulfilled, leave applied / decided.
- **Safety**: a notification is only ever *sent* once per person (dedupe key + unique index, plus Resend idempotency key); the welcome email's one-time link is never written to the log (so that email can't be retried — use "Resend invite"); phone-only managers (synthetic address) are skipped; no recipients / load problems are logged as *skipped*/*failed* rows so nothing disappears silently.
- **Admin → Email log**: status tabs with counts (auto-refresh), search, error detail, **Retry** for failed emails, and **Notification recipients** (empty = every active admin).
- **Tests**: SQL `phase8.sql` (events fire correctly, 3-day leave = 1 event, failing HTTP never breaks the transaction, dedupe) · **25 Deno tests** (templates rendered to real HTML/text, recipient rules, delivery/dedupe/retry/redaction, event planning) · front-end Email log tests. Total: 125 front-end + 25 Deno + 8 SQL suites, all passing.

**Needs you:** follow docs/SETUP.md §5 (verify domain, secrets, deploy functions, enable pg_net, `edge_config` rows) and send a first real email.
**Not done:** delivery/bounce webhooks from Resend; Playwright end-to-end test.

## Phase 9 — Dashboard & polish ✅ (code complete; authenticated screens not yet seen with live data)
- **Admin dashboard** (`/admin`): six KPI cards from ONE Postgres call `admin_dashboard()` — pending service requests, pending starter packs (submitted + processing), drivers on duty now (+ "N with a duty today"), pending leave **requests** (consecutive days = one request) with day count, chauffeur beta this month (from `beta_summary()`, subtext total km + payable days), fuel spend (subtext litres). Each card opens the matching **filtered** list (`?status=` on Service requests / Starter packs, `?tab=` on Trip duty). **Quick actions**: Add staff / driver / manager / product. **Recent activity** feed built from `activity_log`: requests submitted/decided, starter packs, leave (multi-day collapsed to one line), closed duties — each links to the item. Auto-refreshes every minute.
- **Settings** (`/admin/settings`): company name (printed in all PDF headers), driver edit window (1–60 days, used by the driver app), link to Email log & notification recipients, and **Admins** (add, edit, resend invite, deactivate/reactivate; you can't deactivate yourself).
- **Starter packs list** gained a **Pending** tab (submitted + processing) to match the dashboard card.
- **Performance**: every page is **code-split by route**, thin progress bar while a page loads, friendly error/404 screen (never blank). Entry chunk **780 kB → 499 kB (146 kB gzip)** — found zod hiding in the first load via the manager layout and removed it; PDF (1.2 MB) and Excel (490 kB) libraries load only on use and are excluded from the service-worker precache (2.6 → 1.0 MiB). Font is **self-hosted** (no Google request).
- **PWA**: proper icon set (192, 512, maskable 512, Apple touch, favicon) generated by `scripts/make-icons.py`; manifest updated; `robots.txt` blocks the private areas only.
- **Lighthouse (mobile, production build, login page, two runs): Performance 97 · Accessibility 100 · Best practices 100 · SEO 100** (FCP 2.1 s, LCP 2.3 s, TBT 0 ms, CLS 0). Authenticated pages weren't measured (needs a session).
- **Tests**: `phase9.sql` (KPI function incl. request grouping and beta); 139 front-end tests; 25 Deno tests; 9 SQL suites — all passing.

**Not done:** Playwright end-to-end tests; logo upload (setting key exists, no UI); Lighthouse on logged-in screens.

## Phase 10 — Deploy ✅ (everything that can be prepared without your accounts is done; the actual deploy needs you)
**Built and verified here**
- **Hosting config** (`deploy/headers.ts` is the single source): strict **CSP** (no inline/eval scripts, no framing, only our origin + Supabase), HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP; hashed assets cached for a year, shell + service worker always revalidated. Emitted for **Vercel** (`vercel.ts`, compiles cleanly; SPA rewrite) and **Cloudflare Pages / Netlify** (`public/_headers`, `_redirects`, generated and kept in sync by a test).
- **CSP proven in real Chrome** (`npm run verify:site`): zero violations in normal use, service worker registers, self-hosted font loads, Supabase connections allowed — and an injected inline script, an external script, an iframe and a call to another origin are all **blocked**.
- **`npm run preflight`**: scans the production bundle for a service-role key / Supabase secret key / Resend key / server-secret names; rejects a service-role key in `VITE_SUPABASE_ANON_KEY` or secret-looking `VITE_*` variables; guards `supabase/config.toml` (only `manager-phone-login` and `notify` may skip the JWT check; sign-up must be off); validates migration names; flags go-live items (placeholder fleet numbers, unconfirmed beta start date). Ran clean on your real `.env`.
- **`npm run test:sql`**: one command runs every migration, the seed and all 9 SQL suites on a scratch Postgres. **CI** (`.github/workflows/ci.yml`): web checks + build + preflight, Deno tests + type-check, SQL suites.
- **`npm run bundle:sql`**: a single `schema.sql` (12 migrations) + `seed.sql` to paste into the Supabase SQL editor — proven on a fresh database (24 tables, all with RLS).
- **`npm run smoke:supabase`**: read-only, anonymous health/security check of a live project (tables unreadable, admin RPC refused, five functions deployed & refusing unauthenticated calls).
- **Docs**: `docs/DEPLOY.md` (staging vs production, Supabase, Resend DNS, Vercel/Cloudflare, domain, verification, **go-live checklist**, rollback, monitoring) and `docs/RUNBOOK.md` (day-to-day operations, month-end beta, troubleshooting, rotating secrets).
- Totals: 160+ front-end/script tests · 25 Deno tests · 9 SQL suites — all passing.

**Live state found today (smoke test of your configured project):** Supabase Auth is reachable and anonymous access is locked down, but **no tables and no Edge Functions are deployed yet** (21 of 22 checks "not ready"). I did not push anything to your project.

**Needs you (accounts/credentials I don't have):** apply the schema + seed, set Auth options, deploy the 5 functions + secrets, `edge_config`, first admin, Resend domain DNS, hosting project + domain. Follow `docs/DEPLOY.md` §1–3, then re-run `npm run smoke:supabase -- --strict` and `npm run verify:site -- <url>`.
**Not done:** Playwright end-to-end tests; real Lighthouse on logged-in screens; MSG91 OTP integration (the `otp` mode is wired but the SMS hook needs your MSG91 account).

## Project status
All 10 phases are implemented and tested locally. Remaining work is deployment and real-data verification — see DEPLOY.md.

## Navigation aligned to the approved HTML ✅ (after Phase 10)
The portal's navigation now matches `design/lairon-ez-prototype.html` (pixel-compared in headless Chrome at 1280×800 and 390×844, admin / driver / manager):
- **Admin desktop**: 268px blurred sidebar — brand + "Admin portal", groups **Overview · Operations · People · Masters**, the prototype's icons (clipboard-list, package, car-front, users, stethoscope, truck, layers, pill, list-checks), pending **count pills** (service requests, starter packs, leave requests), the signed-in **user block** with sign-out; top bar with **Admin › Section** breadcrumb and the notifications bell (pip + summary).
- **Admin mobile**: top bar (brand, bell, avatar → More) and the 5-tab bottom bar **Home · Requests · Starter · Duties · More**; **More** page with account card + tiles (Users, Doctors, Vehicles, Divisions, Products, Dropdowns).
- **Sub-pages** (forms/details): ← and the title in the top bar, bottom bar hidden, titles worded as in the HTML ("Add Vehicle", "Edit Division", "Start duty", "Apply leave", "Add service"…).
- **Driver / Doctor's Manager apps**: brand + role label, avatar → profile, centred bottom bar (Today · My Duties · Profile / My Doctors · New Request (draft badge) · My Requests · Profile), 680px column, floating add button.
- **Guarded by tests**: `scripts/prototype-nav.test.ts` parses the HTML's own `NAV`, `BOTTOM`, `MORE_ROOTS` and role arrays and fails if the app's groups, labels, order or icons differ; layout and route-chrome tests cover counts, active states, sub-page behaviour and titles.
- Also fixed: "More" is now announced as the current page for screen readers; auto-width primary buttons no longer stretch across the row (a CSS conflict present since Phase 3).
- **Dev-only preview** (`npm run dev`, then `/admin?preview=admin`, `driver`, `manager`, `staff`) fakes a signed-in user to view each shell without Supabase; it is not in the production bundle.

**Deliberate additions beyond the HTML (please confirm or remove):** a **Settings** tile on the More page and Settings reachable from the account block (admin pages added after the design: Settings, Email log). The Staff app has no screens in the HTML yet, so it follows the same role-app pattern.

## Page content aligned to the approved HTML ✅ (admin dashboard, forms, lists)
- **Shared style layer**: the prototype's component CSS now lives in `src/index.css` (`.btn`, `.input`, `.badge`, `.tag`, `.chip`, `.tabs`, `.dt` table-to-cards, `.form-card`, `.actionbar`, `.fab`, `.kpi`, `.attn`, `.bars`, `.timeline` …). Shared components (`DataTable`, `Tabs`, `ChipFilter`, `SearchInput`, `StatusBadge`, `EmptyState`, `Switch`/`SwitchRow`, `FormPage`/`Section`/`Field`, new `ListParts`) render with those classes.
- **Dashboard**: greeting + date, six KPI cards (same order, icons, sub-text, links), Quick actions row, **Needs attention**, **Service request value** six-month chart, **Drivers today**, **Recent activity**, desktop **Export report** (CSV). Data comes from `admin_dashboard()` — **migration 13** (`20261018000013_dashboard_content.sql`) adds the new blocks; an older database still renders (empty blocks).
- **Forms**: sections with icons, two-column grid, required `*`, hints, "Fields marked * are required.", Active switch rows, sticky action bar, "Save vehicle / Save changes" labels — vehicle, division, product (division chips), user, doctor. Other forms (duty, leave, service request, starter pack, dropdowns, import) use the new look with their existing layouts.
- **Lists**: page header + Add button (desktop) / floating button (phone), tabs with counts, search + chips toolbar, avatar/tile "person" cells, tags, status badges, icon row actions, "Showing X of N" + Show more — users, doctors, vehicles, divisions, products, service requests, starter packs.
- **Kept beyond the HTML** (real features): product CSV import, doctor/request/pack CSV + PDF exports, extra filter row (dates, staff, division, HQ), user Resend invite / Sign out icons.
- **Role apps + detail pages (second pass)**: driver **Today** (open-duty hero, action tiles, notices, completed-today entry cards, month stats), **My Duties** (stats, tinted calendar, day groups, icon actions), start/close duty, leave and week-off forms, **Profile** (profile card, contact list, leave requests); manager **My Doctors** cards (Request service / Edit; `?doctor=` preselects the doctor), **New service request** draft + submit card, **My Requests** cards, **Request submitted** screen; request, starter-pack and doctor **detail pages** (summary card, service cards / numbered product list, sticky action bar).
- **Staff app** (the HTML has no staff screens, so it follows the role-app pattern): home with greeting, action tiles, stats and recent requests; My Requests cards; starter-pack form sections, product rows and the "submitted" screen. **Photo upload on the user form** (staff and driver): upload / remove, saved after the user (admins may write to any user's avatar folder; a failed upload only warns).
- **Admin screens (third pass)**: Trip Duty hub (tab icons, filters bar, stats card, tinted calendar, duty entries table with icon actions, All drivers with avatars, leave-request cards with Reject/Approve, **Chauffeur beta** with rate card + rules, KPI tiles with the blue "Total beta" hero, finalise card), Beta rates form (banner, ₹ inputs, history), **Dropdowns** (vertical tabs with counts, banner, items list with switches/icons, mapping panel with pair table), list / item forms, **Import** (drop zone, accepted formats, recent imports, review stats, beta preview, checks, replace/fill options, action bar), Settings cards and Email log toolbar.
- Everything in the approved HTML now has a matching screen. Extra screens that exist only in the app (Settings, Email log, Staff app) use the same components.
- **Needs you**: apply migration 13 to the live database (SQL editor: paste `supabase/migrations/20261018000013_dashboard_content.sql`, or `supabase db push`) so the new dashboard blocks fill with real data.

## People navigation + Super Admin (owner request)
- **People** now lists separate links — **Drivers · Staffs · Managers · Doctors · Super Admins** — each opening its own list page (no tabs). Old `/admin/users?tab=…` links redirect. The nav test documents this as the one deliberate change from the HTML.
- **Super Admin**: the admin role is labelled "Super Admin" everywhere; **Super Admins** has its own page with **Add Super Admin** (email invite, same flow as other users). You cannot deactivate or sign out yourself from the list. Settings keeps its Super Admins section.

## Imports, trip end date, driver's own car (owner request)
- **Trip End Date** on every duty: Start duty (when already finished), Close duty (defaults to today), admin Add/Edit duty. Beta is still counted on the start date. Hours use the end date (22:00 → 07:15 next day = 9h 15m); a same-day end earlier than the start is rejected ("set the trip end date to the next day"). Shown on duty cards, the admin month table, CSV (End Date column) and the duty-sheet PDF. **Import**: a "Trip End Date" column (template updated); an end date before the start is ignored with a warning.
- **Own car (driver's)**: new Vehicle choice next to "Own (guest's vehicle)"; no KM recorded. Import: "Own car" = driver's own car, "Own" = guest's vehicle.
- **Import users** (Staffs, Drivers, Managers — never Super Admins): Import button on each role page → upload, review (bad phones, duplicates in file or already used, missing email, unknown role/HQ), then each valid row is created through the same function as Add (invite emails go out; any link that couldn't be emailed can be downloaded). Rows with errors are skipped.
- **Import service requests / starter packs**: Import button on both admin lists. One sheet row per service / product; rows sharing a Request No (or the same manager/staff/status/date) form one request. Keeps the status you give (Rejected / Cancelled need a note), links doctor / product when the name matches, **no emails are sent**, all-or-nothing in one transaction. Templates download from the page.
- **Database**: migrations **14** (end date, own car, import_duties) and **15** (the two import functions, notification switch-off) — apply both to the live database before using these features (SQL editor: paste each file in order, or `supabase db push`). Not yet done on your project.

## Fresh code after a deployment
- The app is a PWA, so the browser keeps the old build in a service-worker cache. Now: the new service worker takes over immediately (`skipWaiting` + `clientsClaim`), the page reloads onto it, and the app asks for updates **every 5 minutes, when it returns to the foreground and when the device comes back online** (`src/lib/pwa.ts`). No Vercel cache clearing is needed (hashed files; `index.html` and `sw.js` are always revalidated).
- The first deployment that contains this still needs one manual refresh on each device that has the old version (hard reload, or DevTools → Application → Service Workers → Unregister).

## Dialogs and pickers (fix)
- Pickers and dialogs inside glass cards were sized/placed relative to the card (a `backdrop-filter` parent captures `position: fixed` children), so the Qualification/Division picker in the doctor form looked clipped and half-transparent. All overlays (`SearchSelect`, `ConfirmDialog`, `ReassignDialog`) now render through a `Portal` on `<body>` with a solid panel; a test guards it.
- Profile page: spacing between the profile, contact and edit cards, and the contact list's label/value layout, fixed.
