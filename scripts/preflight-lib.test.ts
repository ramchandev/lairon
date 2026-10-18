import {
  checkEnv,
  checkFunctionsConfig,
  findJwtRoles,
  goLiveWarnings,
  migrationProblems,
  scanBundle,
} from './preflight-lib'

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (role: string) =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role, exp: 2000000000 })}.c2lnbmF0dXJlLXNpZ25hdHVyZQ`
const URL_OK = 'https://abcdefghijklmnopqrst.supabase.co'

describe('preflight: keys', () => {
  it('reads the role claim from JWT-looking strings', () => {
    expect(
      findJwtRoles(`x="${jwt('anon')}" y="${jwt('service_role')}"`).map((r) => r.role),
    ).toEqual(['anon', 'service_role'])
    expect(findJwtRoles('eyJnotreallyajwt.eyJnope.zzz')).toEqual([])
  })
  it('accepts a public anon key and the new publishable format', () => {
    expect(checkEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: jwt('anon') })).toEqual([])
    expect(
      checkEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: 'sb_publishable_abc123' }),
    ).toEqual([])
  })
  it('rejects a service-role JWT or secret key in the frontend variable', () => {
    expect(
      checkEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: jwt('service_role') }).map(
        (i) => i.message,
      ),
    ).toEqual([expect.stringMatching(/SERVICE ROLE/)])
    expect(
      checkEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: 'sb_secret_abcdefghijk' }).map(
        (i) => i.message,
      ),
    ).toEqual([expect.stringMatching(/SECRET key/)])
  })
  it('flags secret-looking VITE_ variables and a malformed URL', () => {
    const msgs = checkEnv({
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'k',
      VITE_RESEND_API_KEY: 'x',
    })
      .map((i) => i.message)
      .join('\n')
    expect(msgs).toMatch(/VITE_RESEND_API_KEY is exposed/)
    expect(msgs).toMatch(/<project-ref>\.supabase\.co/)
    expect(
      checkEnv(
        { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' },
        { ci: true },
      ),
    ).toEqual([])
    expect(checkEnv({}).length).toBe(2)
  })
})

describe('preflight: bundle scan', () => {
  it('passes a clean bundle (an anon key inside is fine)', () => {
    expect(scanBundle([{ path: 'dist/a.js', text: `const k="${jwt('anon')}"` }])).toEqual([])
  })
  it('fails on a service-role key, a Supabase secret key, a Resend key or secret names', () => {
    const text = `a="${jwt('service_role')}"; b="sb_secret_abcdefghijklmn"; c="re_abcdefghijklmnopqrstuv"; d="SUPABASE_SERVICE_ROLE_KEY"`
    expect(
      scanBundle([{ path: 'dist/x.js', text }])
        .map((i) => i.message)
        .join('|'),
    ).toMatch(/service_role.*Supabase secret key.*Resend.*server-only secret name/)
  })
})

describe('preflight: Edge Function auth config', () => {
  const GOOD = `[auth]\nenable_signup = false\n[functions.manager-phone-login]\nverify_jwt = false\n[functions.notify]\nverify_jwt = false\n[functions.send-email]\nverify_jwt = true\n`
  it('accepts exactly the two public functions', () =>
    expect(checkFunctionsConfig(GOOD)).toEqual([]))
  it('rejects an extra public function, a missing public flag and open sign-up', () => {
    expect(
      checkFunctionsConfig(GOOD + '[functions.admin-create-user]\nverify_jwt = false\n').map(
        (i) => i.message,
      ),
    ).toEqual([expect.stringContaining('admin-create-user')])
    expect(
      checkFunctionsConfig(
        GOOD.replace(
          '[functions.notify]\nverify_jwt = false',
          '[functions.notify]\nverify_jwt = true',
        ),
      ).map((i) => i.message),
    ).toEqual([expect.stringContaining('"notify" must be')])
    expect(
      checkFunctionsConfig(GOOD.replace('enable_signup = false', 'enable_signup = true')).map(
        (i) => i.message,
      ),
    ).toEqual([expect.stringContaining('sign-up')])
  })
  it('the real config.toml passes', async () => {
    const fs = await import('node:fs')
    expect(checkFunctionsConfig(fs.readFileSync('supabase/config.toml', 'utf8'))).toEqual([])
  })
})

describe('preflight: go-live warnings and migrations', () => {
  it('warns about placeholder fleet numbers and the unconfirmed rate date', () => {
    const w = goLiveWarnings(
      "('CRYSTA','TN00XX6435'),('CRYSTA','TN00XX2172'), 'Initial rates — confirm the real start date'",
      {},
    ).map((i) => i.message)
    expect(w[0]).toMatch(/2 fleet vehicles/)
    expect(w[1]).toMatch(/01 Apr 2026/)
    expect(goLiveWarnings('', { VITE_SUPABASE_URL: 'http://localhost:1' })).toHaveLength(1)
  })
  it('checks migration file names and duplicate timestamps', () => {
    expect(migrationProblems(['20261018000001_a.sql', '20261018000002_b.sql'])).toEqual([])
    expect(migrationProblems(['20261018000001_a.sql', '20261018000001_b.sql']).length).toBe(1)
    expect(migrationProblems(['1_bad.sql']).length).toBe(1)
  })
  it('the real migrations are well named', async () => {
    const fs = await import('node:fs')
    expect(migrationProblems(fs.readdirSync('supabase/migrations'))).toEqual([])
  })
})
