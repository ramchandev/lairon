# Supabase setup (one-time)

Order matters. Run these against your Supabase project.

## 1. Database
```bash
supabase login
supabase link --project-ref <your-ref>
supabase db push                                   # applies supabase/migrations/*
psql "<db connection string>" -f supabase/seed.sql # dropdowns, products, fleet, settings
```
(Or paste each migration file, then `seed.sql`, into the Supabase SQL editor in filename order.)

## 2. Auth settings (Dashboard → Authentication)
- **Sign In / Providers → Email**: enabled; **disable "Allow new users to sign up"** (Admin creates users).
- **URL Configuration**: Site URL = your app URL; add `<app url>/set-password` and `<app url>/login` to Redirect URLs.
- **SMTP Settings**: custom SMTP with Resend so invite/reset emails come from your domain.
- **Sessions** (Pro plan): set *Time-box user sessions* / *Inactivity timeout* to 90 days so managers rarely log in again.
- Doctor's Manager `otp` mode only: enable **Phone** provider and configure the **Send SMS Hook** → MSG91.

## 3. Edge Functions
```bash
cp supabase/.env.functions.example supabase/.env.functions   # fill in values; never commit
supabase secrets set --env-file supabase/.env.functions
supabase functions deploy admin-create-user admin-user-action manager-phone-login
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically. `config.toml` already sets `verify_jwt = false` for `manager-phone-login` only.

## 4. Create the first admin (no self sign-up, so bootstrap once)
1. Dashboard → Authentication → Users → **Add user** → email + password, tick *Auto Confirm User*. Copy the user's UUID.
2. SQL editor:
```sql
insert into profiles (id, role, full_name, phone, email)
values ('<uuid>', 'admin', 'Your Name', '+91XXXXXXXXXX', 'you@example.com');
```
3. Sign in at `/login`. From now on create everyone else from the portal (Phase 3 Users screens call `admin-create-user`).

## Manager login modes
| `MANAGER_AUTH_MODE` | Behaviour |
|---|---|
| `phone_only` | Registered manager's number signs in directly. Anyone who knows the number can sign in as them. |
| `otp` | Same screen plus a 6-digit SMS code. Recommended before go-live. |

Switching modes needs no frontend change: `supabase secrets set MANAGER_AUTH_MODE=otp`.

## 5. Email (Resend) — Phase 8
Emails flow: **database trigger → `notify` Edge Function → Resend**, and every attempt is recorded in **Admin → Email log** (failed ones have a Retry button).

1. **Resend**: add and verify your sending domain (add the SPF + DKIM DNS records Resend shows). Create an API key.
2. **Function secrets** (`supabase/.env.functions`, then `supabase secrets set --env-file supabase/.env.functions`):
   `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `LAIRON EZ <noreply@lairon.in>` — must be on the verified domain), `APP_URL` (your deployed app URL, used in email links), and a long random `NOTIFY_WEBHOOK_SECRET` (e.g. `openssl rand -hex 32`).
3. **Deploy**: `supabase functions deploy notify send-email admin-create-user admin-user-action manager-phone-login`
   (`notify` is configured with `verify_jwt = false` in `config.toml`; it checks the secret header instead).
4. **Enable `pg_net`**: Dashboard → Database → Extensions → `pg_net`.
5. **Tell the database where `notify` lives** (SQL editor, once per environment — use the same secret as above):
```sql
insert into edge_config (key, value) values
  ('notify_url',    'https://<project-ref>.supabase.co/functions/v1/notify'),
  ('notify_secret', '<NOTIFY_WEBHOOK_SECRET>')
on conflict (key) do update set value = excluded.value;
```
   Until both rows exist, no emails are sent and nothing else is affected.
6. **Who gets "new request" emails**: Admin → Email log → *Notification recipients*. Leave it empty to notify every active admin.
7. **Password-reset emails** go through Supabase Auth, not `notify`. Route them through Resend too: Dashboard → Authentication → SMTP Settings → enable custom SMTP: host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key, sender = your `EMAIL_FROM` address.
8. **Try it**: submit a starter pack as staff → within seconds an email arrives and a row appears in Email log. If it says *failed*, the *Detail* column shows Resend's reason (most often an unverified domain).

| Event | Sent to |
|---|---|
| User created / resend invite | the user (set-password link — never stored in the log) |
| Service request submitted | notification recipients + accountable staff |
| Service request approved / rejected / fulfilled | manager (if they have an email) + accountable staff |
| Starter pack submitted | notification recipients |
| Starter pack fulfilled | the staff member |
| Leave applied (one email per request, not per day) | notification recipients |
| Leave approved / rejected | the driver |

Phone-only managers have no email unless an admin adds one on their profile; they are simply skipped.

## Running the tests
```bash
npm run check                 # typecheck + lint + 125 front-end tests
npm run test:functions        # Edge Function tests (needs Deno): templates, recipients, delivery, retry
# SQL suites (scratch Postgres only): psql -v ON_ERROR_STOP=1 -f supabase/tests/phase1.sql  (… phase4, 5, 6, 7a, 7b, 7c, 8)
```

## Go-live checklist (Phase 10 draft)
- [ ] Supabase **production** project: run migrations + seed; set Site URL / redirect URLs; disable sign-ups; custom SMTP (Resend); sessions 90 days (Pro).
- [ ] Pro plan + daily backups before go-live.
- [ ] Replace placeholder **fleet registration numbers** (`TN00XX####`) and confirm the beta-rate start date (seed: 01 Apr 2026).
- [ ] Create the 7 drivers (Appendix D) with real phone + email; create staff and Doctor's Managers.
- [ ] Edge Function secrets set; functions deployed; `edge_config` rows inserted; `pg_net` enabled.
- [ ] Resend domain verified (SPF + DKIM); `EMAIL_FROM` on that domain; send a real test email.
- [ ] Hosting (Vercel / Cloudflare Pages): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; SPA fallback to `index.html`; HTTPS; custom domain; `APP_URL` secret updated to it.
- [ ] Switch `MANAGER_AUTH_MODE` to `otp` (MSG91) if phone-only sign-in is too open for your risk appetite.
- [ ] Run the import on the real `Driver-data.xlsx` and compare the beta preview with the old sheet.
- [ ] Install the PWA on a phone and walk through each role.
