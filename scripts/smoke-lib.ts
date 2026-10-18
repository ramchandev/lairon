export type Verdict = 'ok' | 'warn' | 'error'
export interface Result {
  name: string
  verdict: Verdict
  detail: string
}

type Fetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; text(): Promise<string> }>

const MISSING = /PGRST20[0-9]|42P01|does not exist|Could not find the (table|function)/i

/** Tables an anonymous visitor must never be able to read. */
export const PROTECTED_TABLES = [
  'profiles',
  'doctors',
  'driver_day_entries',
  'service_request_batches',
  'service_requests',
  'starter_pack_requests',
  'starter_pack_items',
  'beta_rates',
  'beta_statements',
  'app_settings',
  'email_log',
  'activity_log',
  'login_attempts',
  'edge_config',
  'duty_import_batches',
]

/** What an anonymous read of a table means. */
export function classifyTable(name: string, status: number, body: string): Result {
  if (status === 200) {
    let rows: unknown = null
    try {
      rows = JSON.parse(body)
    } catch {
      /* not JSON */
    }
    if (Array.isArray(rows) && rows.length > 0)
      return {
        name,
        verdict: 'error',
        detail: `LEAK: an anonymous request returned ${rows.length} row(s)`,
      }
    return { name, verdict: 'ok', detail: 'exists, anonymous read returns nothing' }
  }
  if (status === 401 || status === 403)
    return { name, verdict: 'ok', detail: 'permission denied for anonymous (good)' }
  if (status === 404 || MISSING.test(body))
    return { name, verdict: 'warn', detail: 'not found — migrations not applied yet?' }
  return { name, verdict: 'warn', detail: `unexpected HTTP ${status}` }
}

export interface FnExpect {
  name: string
  method?: 'POST'
  body: string
  expect: number
  why: string
}
/** Calls that are harmless without credentials: each is rejected before any side effect. */
export const FUNCTIONS: FnExpect[] = [
  {
    name: 'manager-phone-login',
    body: '{}',
    expect: 400,
    why: 'rejects a missing phone number (public by design, rate-limited)',
  },
  { name: 'notify', body: '{}', expect: 401, why: 'rejects calls without the webhook secret' },
  {
    name: 'admin-create-user',
    body: '{}',
    expect: 401,
    why: 'rejects calls without an admin session',
  },
  {
    name: 'admin-user-action',
    body: '{}',
    expect: 401,
    why: 'rejects calls without an admin session',
  },
  { name: 'send-email', body: '{}', expect: 401, why: 'rejects calls without an admin session' },
]

export function classifyFunction(fn: FnExpect, status: number): Result {
  if (status === fn.expect)
    return { name: `function ${fn.name}`, verdict: 'ok', detail: `deployed; ${fn.why}` }
  if (status === 404)
    return { name: `function ${fn.name}`, verdict: 'warn', detail: 'not deployed yet' }
  const open = status >= 200 && status < 300
  return {
    name: `function ${fn.name}`,
    verdict: open ? 'error' : 'warn',
    detail: open
      ? `OPEN: answered ${status} without credentials`
      : `answered ${status}, expected ${fn.expect}`,
  }
}

export function classifyRpc(name: string, status: number, body: string): Result {
  if (status === 200)
    return { name: `rpc ${name}`, verdict: 'error', detail: 'OPEN: an anonymous call succeeded' }
  if (status === 404 || MISSING.test(body))
    return {
      name: `rpc ${name}`,
      verdict: 'warn',
      detail: 'not found — migrations not applied yet?',
    }
  return { name: `rpc ${name}`, verdict: 'ok', detail: 'refused for anonymous (good)' }
}

/** Supabase publishes whether sign-up is open at /auth/v1/settings (read-only). Admins create every user, so it must be closed. */
export function classifySignup(status: number, body: string): Result {
  const name = 'Self sign-up disabled'
  if (status !== 200)
    return { name, verdict: 'warn', detail: `could not read auth settings (HTTP ${status})` }
  try {
    const s = JSON.parse(body) as { disable_signup?: boolean }
    return s.disable_signup === true
      ? { name, verdict: 'ok', detail: 'new users can only be created by an admin' }
      : {
          name,
          verdict: 'error',
          detail:
            'sign-up is OPEN — anyone could create an account. Turn off "Allow new users to sign up" in Authentication → Sign In / Providers.',
        }
  } catch {
    return { name, verdict: 'warn', detail: 'unexpected auth settings response' }
  }
}

export async function runSmoke(base: string, anonKey: string, f: Fetch): Promise<Result[]> {
  const h = { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  const out: Result[] = []
  const health = await f(`${base}/auth/v1/health`, { headers: { apikey: anonKey } }).catch(
    () => null,
  )
  out.push(
    health?.status === 200
      ? { name: 'Supabase Auth reachable', verdict: 'ok', detail: 'health check passed' }
      : {
          name: 'Supabase Auth reachable',
          verdict: 'error',
          detail: `health check failed (${health?.status ?? 'no response'}) — wrong URL or project paused?`,
        },
  )
  const settings = await f(`${base}/auth/v1/settings`, { headers: { apikey: anonKey } }).catch(
    () => null,
  )
  if (settings) out.push(classifySignup(settings.status, await settings.text()))
  for (const t of PROTECTED_TABLES) {
    const r = await f(`${base}/rest/v1/${t}?select=*&limit=1`, { headers: h })
    out.push(classifyTable(`table ${t}`, r.status, await r.text()))
  }
  const rpc = await f(`${base}/rest/v1/rpc/admin_dashboard`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: '{}',
  })
  out.push(classifyRpc('admin_dashboard', rpc.status, await rpc.text()))
  for (const fn of FUNCTIONS) {
    const r = await f(`${base}/functions/v1/${fn.name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey },
      body: fn.body,
    })
    out.push(classifyFunction(fn, r.status))
  }
  return out
}
