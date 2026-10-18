import {
  classifyFunction,
  classifyRpc,
  classifySignup,
  classifyTable,
  FUNCTIONS,
  runSmoke,
} from './smoke-lib'

describe('smoke: tables', () => {
  it('an anonymous read that returns rows is a leak', () => {
    expect(classifyTable('t', 200, '[{"id":1}]').verdict).toBe('error')
  })
  it('empty results and permission errors are good', () => {
    expect(classifyTable('t', 200, '[]').verdict).toBe('ok')
    expect(classifyTable('t', 401, '{"message":"permission denied"}').verdict).toBe('ok')
    expect(classifyTable('t', 403, '').verdict).toBe('ok')
  })
  it('a missing table means migrations are not applied (warning, not a leak)', () => {
    expect(
      classifyTable('t', 404, '{"code":"PGRST205","message":"Could not find the table"}').verdict,
    ).toBe('warn')
  })
})

describe('smoke: sign-up', () => {
  it('open sign-up is an error; closed is ok', () => {
    expect(classifySignup(200, '{"disable_signup":true}').verdict).toBe('ok')
    expect(classifySignup(200, '{"disable_signup":false}').verdict).toBe('error')
    expect(classifySignup(200, '{}').verdict).toBe('error')
    expect(classifySignup(500, '').verdict).toBe('warn')
  })
})

describe('smoke: functions and rpc', () => {
  const fn = (n: string) => FUNCTIONS.find((f) => f.name === n)!
  it('expected rejections mean deployed and protected', () => {
    expect(classifyFunction(fn('notify'), 401).verdict).toBe('ok')
    expect(classifyFunction(fn('manager-phone-login'), 400).verdict).toBe('ok')
    expect(classifyFunction(fn('admin-create-user'), 401).verdict).toBe('ok')
  })
  it('404 = not deployed; a 2xx without credentials is an open door', () => {
    expect(classifyFunction(fn('notify'), 404).verdict).toBe('warn')
    expect(classifyFunction(fn('notify'), 200).verdict).toBe('error')
    expect(classifyFunction(fn('admin-user-action'), 200).verdict).toBe('error')
  })
  it('admin_dashboard must refuse anonymous callers', () => {
    expect(classifyRpc('admin_dashboard', 200, '{}').verdict).toBe('error')
    expect(
      classifyRpc('admin_dashboard', 401, '{"message":"permission denied for function"}').verdict,
    ).toBe('ok')
    expect(classifyRpc('admin_dashboard', 404, '{"code":"PGRST202"}').verdict).toBe('warn')
  })
})

describe('smoke: full run', () => {
  const reply = (status: number, body = '') =>
    Promise.resolve({ status, text: () => Promise.resolve(body) })
  it('a correctly locked-down project passes with no errors', async () => {
    const res = await runSmoke('https://x.supabase.co', 'anon', (url) => {
      if (url.includes('/auth/v1/health')) return reply(200)
      if (url.includes('/auth/v1/settings')) return reply(200, '{"disable_signup":true}')
      if (url.includes('/rest/v1/rpc/')) return reply(401, '{"message":"permission denied"}')
      if (url.includes('/rest/v1/')) return reply(200, '[]')
      if (url.includes('/functions/v1/manager-phone-login')) return reply(400)
      return reply(401)
    })
    expect(res.filter((r) => r.verdict !== 'ok')).toEqual([])
    expect(res.length).toBeGreaterThan(20)
  })
  it('catches a table that leaks and a project that is unreachable', async () => {
    const leaky = await runSmoke('https://x.supabase.co', 'anon', (url) =>
      url.includes('/rest/v1/profiles')
        ? reply(200, '[{"id":"1"}]')
        : reply(url.includes('/auth/') ? 200 : 401),
    )
    expect(leaky.filter((r) => r.verdict === 'error').map((r) => r.name)).toEqual([
      'table profiles',
    ])
    const down = await runSmoke('https://x.supabase.co', 'anon', (url) =>
      url.includes('/auth/')
        ? Promise.reject(new Error('offline'))
        : reply(404, '{"code":"PGRST205"}'),
    )
    expect(down[0].verdict).toBe('error')
  })
})
