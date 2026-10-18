# Deploying LAIRON EZ

The app is a static React build (hosting) + one Supabase project (database, auth, storage, Edge Functions) + Resend (email).
Nothing here needs a server of your own.

> **Where am I?** Run `npm run smoke:supabase` any time. It checks your Supabase project read-only, as an anonymous visitor, and tells you what is and isn't deployed yet.

## 0. Before you start

| Decision | Recommendation |
|---|---|
| Environments | **Two** Supabase projects: *staging* (try everything, import test sheets) and *production*. Never test against production data. If you only have one project today, treat it as staging and create production before go-live. |
| Supabase plan | **Pro** for production: daily backups + point-in-time recovery, no pausing, 90-day sessions for managers. The free plan pauses after a week of inactivity. |
| Region | **Mumbai (ap-south-1)** — your users are in India. |
| Hosting | **Vercel** or **Cloudflare Pages**. Config for both is in the repo (`vercel.ts`, `public/_headers`, `public/_redirects`). |
| Manager sign-in | `phone_only` is convenient but anyone who knows a manager's number can sign in as them. Plan to switch to `otp` (SMS via MSG91, India DLT registration needed) before real data goes in. |

Local tools: Node 22+, and (optional) the [Supabase CLI](https://supabase.com/docs/guides/cli). Without the CLI you can do everything from the dashboard.

## 1. Supabase

### 1a. Create the project and load the schema
Choose **one**:

**Option A — Supabase CLI**
```bash
supabase login
supabase link --project-ref <ref>
supabase db push                                   # applies supabase/migrations/* in order
psql "<connection string>" -f supabase/seed.sql    # dropdowns, divisions, products, fleet placeholders, settings
```

**Option B — dashboard only (no CLI)**
```bash
npm run bundle:sql      # writes supabase/.bundle/schema.sql and seed.sql
```
Dashboard → **SQL editor** → paste and run `schema.sql`, then `seed.sql`. Run them **once, on an empty project**.

Check: `npm run smoke:supabase` should now show every table as *"exists, anonymous read returns nothing"*.

### 1b. Dashboard settings (Authentication, Database)
- **Authentication → Providers → Email**: enabled; **turn OFF "Allow new users to sign up"** (admins create every user).
- **Authentication → URL Configuration**: Site URL = your final app URL (e.g. `https://ez.yourdomain.in`); add `https://ez.yourdomain.in/set-password` and `/login` to Redirect URLs. (You can set this after step 3; do it before inviting anyone.)
- **Authentication → SMTP**: custom SMTP with Resend (host `smtp.resend.com`, port `465`, user `resend`, password = Resend API key, sender = your `EMAIL_FROM`). This is what sends password-reset emails.
- **Authentication → Sessions** (Pro): time-box / inactivity timeout **90 days** so managers rarely sign in again.
- **Database → Extensions**: enable **`pg_net`** (used by email notifications).
- **Storage**: the `avatars` bucket is created by the migration (public read, 2 MB, images only). Confirm it exists.

### 1c. Edge Functions
```bash
cp supabase/.env.functions.example supabase/.env.functions     # fill in; NEVER commit
supabase secrets set --env-file supabase/.env.functions
supabase functions deploy admin-create-user admin-user-action manager-phone-login notify send-email
```
Secrets: `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `MANAGER_AUTH_MODE`, `NOTIFY_WEBHOOK_SECRET` (generate with `openssl rand -hex 32`). `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically.

*No CLI?* Dashboard → Edge Functions → create each function and paste its `index.ts` + the `_shared` folder, or install the CLI — it is the reliable way to deploy `_shared` imports.

Tell the database where `notify` lives (SQL editor, once per environment):
```sql
insert into edge_config (key, value) values
  ('notify_url',    'https://<ref>.supabase.co/functions/v1/notify'),
  ('notify_secret', '<same value as NOTIFY_WEBHOOK_SECRET>')
on conflict (key) do update set value = excluded.value;
```

### 1d. First admin (no self sign-up, so create one by hand)
Dashboard → Authentication → Users → **Add user** (email + password, tick *Auto confirm*). Copy its UUID, then in the SQL editor:
```sql
insert into profiles (id, role, full_name, phone, email)
values ('<uuid>', 'admin', 'Your Name', '+91XXXXXXXXXX', 'you@example.com');
```

### 1e. Verify
```bash
npm run smoke:supabase -- --strict      # must finish with 0 problems and nothing "not ready yet"
```
It confirms an anonymous visitor can read **no** table, can't call admin functions, and that all five Edge Functions are deployed and refuse unauthenticated calls.

## 2. Resend (email)
1. Resend → **Domains** → add your domain (use a subdomain such as `mail.yourdomain.in`).
2. Add the DNS records Resend shows: **SPF** (TXT), **DKIM** (TXT/CNAME) and, recommended, **DMARC** (`_dmarc` TXT, start with `p=none`). Wait for *Verified*.
3. Create an API key (sending access) → `RESEND_API_KEY`. Set `EMAIL_FROM` to an address on the verified domain.
4. After deploying: sign in → **Email log** → send yourself a real event (e.g. raise a starter pack) and confirm the row says *sent* and the email arrives (check spam once).

## 3. Hosting

Build settings are the same everywhere: **build command** `npm run build`, **output** `dist`, **Node** 22.

Environment variables (build-time, public): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the **anon / publishable** key — never the service-role or secret key; `npm run preflight` blocks that).

**Vercel**: Import the repo → framework *Vite* is detected → add the two env vars → deploy. `vercel.ts` provides the SPA rewrite, the security headers/CSP and cache rules. Add your domain under Settings → Domains and create the DNS record Vercel asks for.
**Cloudflare Pages**: connect the repo, build `npm run build`, output `dist`, add the env vars. `public/_headers` and `public/_redirects` are picked up automatically.

Then:
1. Put the final URL in the function secret `APP_URL` (`supabase secrets set APP_URL=https://…`) and redeploy `notify`, `admin-create-user`, `admin-user-action` so email links point to the right place.
2. Set Supabase **Site URL / Redirect URLs** to the same domain (step 1b).
3. If Supabase sits on a **custom domain**, add it to `connect-src` / `img-src` in `deploy/headers.ts`, run `npm run gen:hosting`, redeploy.

Verify the live site:
```bash
npm run verify:site -- https://ez.yourdomain.in
```
It loads the site in real Chrome and checks the security headers, that the CSP blocks injected scripts/foreign origins but allows normal use and Supabase, and that the service worker registers.

## 4. Before every deploy
```bash
npm run check          # typecheck + lint + tests
npm run test:sql       # all migrations + SQL suites on a scratch database (Docker)
npm run test:functions # Edge Function tests (needs Deno)
npm run build && npm run preflight      # add --strict to fail on go-live warnings
```
CI (`.github/workflows/ci.yml`) runs the same on every push. **Database changes** ship as a *new* migration file — never edit one that already ran in production.

## 5. Go-live checklist
**Data**
- [ ] Replace the 6 placeholder fleet numbers (`TN00XX####`) with real registrations (Vehicles).
- [ ] Confirm the beta-rate start date and amounts (Trip duty → Chauffeur beta → Edit rates). Seed: ₹250 / ₹300 from 01 Apr 2026.
- [ ] Create the 7 drivers (Users → Drivers) with real phone + email; they get a set-password email.
- [ ] Create staff and Doctor's Managers; for managers who need email notifications, add an email on their profile.
- [ ] Review dropdowns (qualification/speciality duplicates like `MD` vs `M.D`), fill **Service Type**, check the Qualification mapping.
- [ ] Import one real driver sheet (`Driver-data.xlsx`) on **staging** and compare the *Beta preview* with the old sheet.

**Security**
- [ ] `npm run preflight` clean; `npm run smoke:supabase -- --strict` clean; `npm run verify:site -- <url>` clean.
- [ ] Sign-ups disabled; admin accounts use strong, unique passwords.
- [ ] Decide `MANAGER_AUTH_MODE` (switch to `otp` once MSG91 is ready: `supabase secrets set MANAGER_AUTH_MODE=otp`).
- [ ] Pro plan, daily backups / PITR on. Know where the **service-role key** is stored (only in Supabase secrets / your password manager).

**Email**
- [ ] Resend domain *Verified*; a real email delivered; password-reset email delivered (SMTP through Resend).
- [ ] Notification recipients set (Email log page) or confirmed "all active admins".

**Walk-through (on a phone, installed as an app)** — one real flow per role:
- [ ] Admin: dashboard loads; approve a service request; export a PDF **and** CSV (confirms downloads work under the CSP); finalise a test month then reopen it.
- [ ] Staff: raise a starter pack → admin gets an email → fulfil → staff gets an email.
- [ ] Manager: sign in by phone; add a doctor; submit a service request.
- [ ] Driver: start duty → close duty; apply leave → admin approves → driver gets an email; week off.
- [ ] Offline: open the installed app with no connection — the shell loads and shows a clear message instead of a blank screen.

## 6. Rolling back
| What broke | How to undo |
|---|---|
| A bad front-end release | Vercel: *Deployments → previous → Promote to production* (instant). Cloudflare: *Rollback* on the previous deployment. Users get the fixed build on next load (the service worker updates itself). |
| A bad Edge Function | `git checkout <good commit> -- supabase/functions && supabase functions deploy <name>`. |
| A bad migration | Migrations only move forward. Fix with a **new** migration. If data was damaged, restore from backup/PITR (Dashboard → Database → Backups) to a new project and copy back what you need. Take a manual backup before any risky migration. |
| A leaked key | Rotate it (see RUNBOOK → *Rotating secrets*) — the preflight scan exists to stop this ever shipping, but know the steps. |

## 7. Monitoring (cheap and enough)
- **Email log** → *Failed* tab: check weekly (or after any outage). Retry from there.
- **Supabase Dashboard → Logs / Reports**: Edge Function errors, auth errors, database CPU.
- **Uptime**: point any free monitor at `GET https://<your domain>/login` (expects 200).
- **Backups**: confirm the latest daily backup exists once a month.
