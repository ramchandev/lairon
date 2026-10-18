# LAIRON EZ

Mobile-first portal for LAIRON field operations. Source of truth: [`docs/PLAN.md`](docs/PLAN.md). Visual reference: [`design/lairon-ez-prototype.html`](design/lairon-ez-prototype.html).

## Run
```bash
npm install
cp .env.example .env     # then fill in your Supabase URL + anon key
npm run dev              # http://localhost:5173
npm run check            # typecheck + lint + tests
```

## Env
| Var | Where |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `.env` (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `MANAGER_AUTH_MODE` | `supabase/.env.functions` (Edge Functions only) |

Roles: admin → `/admin`, staff → `/staff`, driver → `/driver`, doctor's manager → `/m`.
Build proceeds phase by phase (see `docs/PLAN.md` §12; status in `docs/PROGRESS.md`).

## Database (Supabase)
```bash
npm i -g supabase               # or use npx supabase
supabase link --project-ref <ref>
supabase db push                # applies supabase/migrations
psql "$DB_URL" -f supabase/seed.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase1.sql   # use a scratch/local DB, not production
```

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run check` | Typecheck + lint + front-end tests |
| `npm run test:sql` | Migrations + seed + all SQL suites on a scratch Postgres (Docker) |
| `npm run test:functions` | Edge Function tests (Deno) |
| `npm run build && npm run preflight` | Production build, then a secrets/config safety check (`--strict` also fails on go-live warnings) |
| `npm run verify:site -- <url>` | Real-browser check of a running site's headers, CSP and service worker |
| `npm run smoke:supabase` | Read-only, anonymous check of your Supabase project (what's deployed, what's protected) |
| `npm run bundle:sql` | One SQL file to paste into the Supabase SQL editor (no CLI needed) |
| `npm run gen:hosting` | Regenerates `public/_headers` / `_redirects` from `deploy/headers.ts` |

`VITE_SUPABASE_ANON_KEY` can be either the legacy **anon** JWT or the newer **publishable** key (`sb_publishable_…`). It must never be the service-role / secret key.

Docs: [`docs/PLAN.md`](docs/PLAN.md) (spec) · [`docs/PROGRESS.md`](docs/PROGRESS.md) · [`docs/DEPLOY.md`](docs/DEPLOY.md) (deploy + go-live checklist) · [`docs/RUNBOOK.md`](docs/RUNBOOK.md) (day-to-day operations) · [`docs/SETUP.md`](docs/SETUP.md) · [`docs/DECISIONS.md`](docs/DECISIONS.md)
