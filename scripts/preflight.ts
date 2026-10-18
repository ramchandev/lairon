// Run before every deploy:  npm run build && npm run preflight        (add --strict to also fail on go-live warnings)
// Exits 1 on any ERROR. Warnings are things to fix before real users arrive.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { toHeadersFile } from '../deploy/headers.ts'
import {
  checkEnv,
  checkFunctionsConfig,
  goLiveWarnings,
  migrationProblems,
  scanBundle,
  type Issue,
} from './preflight-lib.ts'

const strict = process.argv.includes('--strict')
const ci = process.env.PREFLIGHT_CI === '1'

// Pick up .env the way Vite would (without printing any value).
const env: Record<string, string | undefined> = { ...process.env }
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const issues: Issue[] = []
issues.push(...checkEnv(env, { ci }))

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) =>
    statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)],
  )
if (existsSync('dist')) {
  const js = walk('dist')
    .filter((f) => /\.(js|html|webmanifest)$/.test(f))
    .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
  issues.push(...scanBundle(js))
  console.log(`Scanned ${js.length} files in dist/ for leaked secrets.`)
} else issues.push({ severity: 'error', message: 'dist/ not found — run `npm run build` first' })

issues.push(...checkFunctionsConfig(readFileSync('supabase/config.toml', 'utf8')))
issues.push(...migrationProblems(readdirSync('supabase/migrations')))
if (readFileSync('public/_headers', 'utf8') !== toHeadersFile())
  issues.push({
    severity: 'error',
    message: 'public/_headers is out of date. Run `npm run gen:hosting`.',
  })
if (!/^\.env$/m.test(readFileSync('.gitignore', 'utf8')))
  issues.push({ severity: 'error', message: '.env is not in .gitignore' })
if (!ci) issues.push(...goLiveWarnings(readFileSync('supabase/seed.sql', 'utf8'), env))

const errors = issues.filter((i) => i.severity === 'error')
const warns = issues.filter((i) => i.severity === 'warn')
for (const i of errors) console.error(`✗ ERROR  ${i.message}`)
for (const i of warns) console.warn(`! WARN   ${i.message}`)
if (!errors.length) console.log('✓ No blocking problems.')
if (warns.length)
  console.log(
    `\n${warns.length} go-live item(s) above need attention${strict ? ' (strict mode: failing)' : ''}.`,
  )
process.exit(errors.length || (strict && warns.length) ? 1 : 0)
