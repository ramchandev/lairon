// READ-ONLY check of a live Supabase project using only the PUBLIC anon key — what any visitor could do:
//   npm run smoke:supabase                (uses VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env)
//   npm run smoke:supabase -- --strict    (also fail when something isn't deployed yet — use after go-live)
import { existsSync, readFileSync } from 'node:fs'
import { runSmoke } from './smoke-lib.ts'

const env: Record<string, string | undefined> = { ...process.env }
if (existsSync('.env'))
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
const base = (env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const key = env.VITE_SUPABASE_ANON_KEY ?? ''
if (!base || !key) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (in .env).')
  process.exit(1)
}
const strict = process.argv.includes('--strict')

console.log(`Checking ${base} (read-only, anonymous)…\n`)
const results = await runSmoke(base, key, (url, init) => fetch(url, init))
const icon = { ok: '✓', warn: '!', error: '✗' } as const
for (const r of results) console.log(`${icon[r.verdict]} ${r.name.padEnd(36)} ${r.detail}`)
const errors = results.filter((r) => r.verdict === 'error').length
const warns = results.filter((r) => r.verdict === 'warn').length
console.log(`\n${results.length - errors - warns} ok · ${warns} not ready yet · ${errors} PROBLEMS`)
process.exit(errors || (strict && warns) ? 1 : 0)
