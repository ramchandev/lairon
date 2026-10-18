export type Severity = 'error' | 'warn'
export interface Issue {
  severity: Severity
  message: string
}
const err = (message: string): Issue => ({ severity: 'error', message })
const warn = (message: string): Issue => ({ severity: 'warn', message })

const b64urlJson = (part: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(
      Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    )
  } catch {
    return null
  }
}

/** Every JWT-shaped string in `text` with its `role` claim (anon, authenticated, service_role…). */
export function findJwtRoles(text: string): { role: string; preview: string }[] {
  const out: { role: string; preview: string }[] = []
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g)) {
    const payload = b64urlJson(m[0].split('.')[1])
    if (payload && typeof payload.role === 'string')
      out.push({ role: payload.role, preview: `${m[0].slice(0, 12)}…` })
  }
  return out
}

/** Frontend env: URL shape, and — most importantly — that the key is a PUBLIC one. */
export function checkEnv(
  env: Record<string, string | undefined>,
  opts: { ci?: boolean } = {},
): Issue[] {
  const issues: Issue[] = []
  const url = env.VITE_SUPABASE_URL ?? ''
  const key = env.VITE_SUPABASE_ANON_KEY ?? ''
  if (!url) issues.push(err('VITE_SUPABASE_URL is not set'))
  else if (!opts.ci && !/^https:\/\/[a-z0-9]{15,25}\.supabase\.co$/.test(url))
    issues.push(
      err(`VITE_SUPABASE_URL should look like https://<project-ref>.supabase.co (got ${url})`),
    )
  if (!key) issues.push(err('VITE_SUPABASE_ANON_KEY is not set'))
  if (/^sb_secret_/.test(key))
    issues.push(
      err(
        'VITE_SUPABASE_ANON_KEY holds a SECRET key (sb_secret_…). Use the public anon / publishable key.',
      ),
    )
  for (const r of findJwtRoles(key))
    if (r.role === 'service_role')
      issues.push(
        err(
          'VITE_SUPABASE_ANON_KEY is the SERVICE ROLE key — it would be public in the browser. Use the anon key.',
        ),
      )
  for (const name of Object.keys(env)) {
    if (name.startsWith('VITE_') && /(SERVICE|SECRET|PRIVATE|RESEND|PASSWORD)/i.test(name))
      issues.push(
        err(
          `${name} is exposed to the browser (VITE_ prefix) but looks like a secret. Secrets belong in Edge Function secrets.`,
        ),
      )
  }
  return issues
}

/** The built JS must never contain a service-role key, a Supabase secret key or a Resend key. */
export function scanBundle(files: { path: string; text: string }[]): Issue[] {
  const issues: Issue[] = []
  for (const f of files) {
    for (const r of findJwtRoles(f.text))
      if (r.role === 'service_role')
        issues.push(err(`${f.path} contains a service_role key (${r.preview})`))
    if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(f.text))
      issues.push(err(`${f.path} contains a Supabase secret key`))
    if (/\bre_[A-Za-z0-9]{20,}\b/.test(f.text))
      issues.push(err(`${f.path} contains what looks like a Resend API key`))
    if (/SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|NOTIFY_WEBHOOK_SECRET/.test(f.text))
      issues.push(err(`${f.path} mentions a server-only secret name`))
  }
  return issues
}

/** Only these Edge Functions may skip Supabase's JWT check; each guards itself another way. */
export const PUBLIC_FUNCTIONS = ['manager-phone-login', 'notify']

export function checkFunctionsConfig(toml: string): Issue[] {
  const issues: Issue[] = []
  const found = new Map<string, boolean>()
  for (const m of toml.matchAll(/\[functions\.([a-z0-9-]+)\]([^[]*)/g))
    found.set(m[1], /verify_jwt\s*=\s*true/.test(m[2]))
  for (const [name, verifies] of found) {
    if (!verifies && !PUBLIC_FUNCTIONS.includes(name))
      issues.push(
        err(
          `Edge Function "${name}" has verify_jwt = false but isn't in the public allow-list (${PUBLIC_FUNCTIONS.join(', ')})`,
        ),
      )
  }
  for (const name of PUBLIC_FUNCTIONS)
    if (found.get(name) !== false)
      issues.push(
        err(
          `Edge Function "${name}" must be configured with verify_jwt = false (it checks its own secret / rate limit)`,
        ),
      )
  if (/enable_signup\s*=\s*true/.test(toml))
    issues.push(
      err('Self sign-up is enabled (auth.enable_signup = true). Admins create every user.'),
    )
  return issues
}

/** Things that are fine in development but must change before real users arrive. */
export function goLiveWarnings(seedSql: string, env: Record<string, string | undefined>): Issue[] {
  const out: Issue[] = []
  const fleet = seedSql.match(/TN00XX\d{4}/g)
  if (fleet)
    out.push(
      warn(
        `${new Set(fleet).size} fleet vehicles still have PLACEHOLDER registration numbers (TN00XX####). Replace them with the real numbers before drivers use the app.`,
      ),
    )
  if (/confirm the real start date/i.test(seedSql))
    out.push(
      warn(
        'The chauffeur beta rate is seeded from 01 Apr 2026 ("confirm the real start date"). Check it under Trip duty → Chauffeur beta → Edit rates.',
      ),
    )
  if (/localhost/.test(env.VITE_SUPABASE_URL ?? ''))
    out.push(warn('VITE_SUPABASE_URL points at localhost.'))
  return out
}

export function migrationProblems(files: string[]): Issue[] {
  const issues: Issue[] = []
  const names = files.filter((f) => f.endsWith('.sql')).sort()
  const stamps = names.map((f) => f.split('_')[0])
  if (new Set(stamps).size !== stamps.length)
    issues.push(err('Two migrations share the same timestamp prefix'))
  for (const f of names)
    if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(f))
      issues.push(err(`Migration "${f}" doesn't match <14-digit timestamp>_<name>.sql`))
  return issues
}
