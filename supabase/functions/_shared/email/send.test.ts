import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import {
  deliver,
  logProblem,
  retry,
  type Deps,
  type LogRow,
  type LogStore,
  type Message,
} from './send.ts'
import type { Planned } from './types.ts'

function fakeStore() {
  const rows = new Map<string, LogRow>()
  let n = 0
  const store: LogStore = {
    alreadySent: (k) =>
      Promise.resolve([...rows.values()].some((r) => r.dedupe_key === k && r.status === 'sent')),
    insert: (row) => {
      const id = `log${++n}`
      rows.set(id, {
        id,
        to: '',
        template: '',
        subject: null,
        status: 'pending',
        error: null,
        payload: null,
        attempts: 0,
        dedupe_key: null,
        entity: null,
        entity_id: null,
        ...row,
      } as LogRow)
      return Promise.resolve(id)
    },
    update: (id, patch) => {
      rows.set(id, { ...rows.get(id)!, ...patch } as LogRow)
      return Promise.resolve()
    },
    get: (id) => Promise.resolve(rows.get(id) ?? null),
  }
  return { rows, store }
}
function fakeMailer(results: { ok: boolean; id?: string; error?: string }[]) {
  const sent: Message[] = []
  return {
    sent,
    mailer: {
      send: (m: Message) => {
        sent.push(m)
        return Promise.resolve(results.shift() ?? { ok: true, id: 'r1' })
      },
    },
  }
}
const planned: Planned<'leave_applied'> = {
  template: 'leave_applied',
  to: 'boss@x.in',
  dedupeKey: 'leave_applied:l1:boss@x.in',
  entity: 'leave',
  entityId: 'l1',
  data: {
    driverName: 'RAVIKUMAR.N',
    from: '2026-10-20',
    to: '2026-10-22',
    days: 3,
    type: 'Casual',
    reason: 'Family',
    link: 'https://app.test/admin/trip-duty?tab=leave',
  },
}

Deno.test('deliver: renders, sends with an idempotency key, and logs it as sent', async () => {
  const { rows, store } = fakeStore()
  const { sent, mailer } = fakeMailer([{ ok: true, id: 're_123' }])
  const out = await deliver({ store, mailer } as Deps, planned)
  assertEquals(out.status, 'sent')
  assertEquals(sent.length, 1)
  assertEquals(sent[0].to, 'boss@x.in')
  assertEquals(sent[0].idempotencyKey, 'leave_applied:l1:boss@x.in')
  assertStringIncludes(sent[0].html, 'RAVIKUMAR.N')
  assert(sent[0].text.length > 0)
  const row = rows.get('log1')!
  assertEquals(
    [row.status, row.attempts, row.subject],
    ['sent', 1, 'Leave request: RAVIKUMAR.N, 20 Oct 2026 – 22 Oct 2026'],
  )
})

Deno.test('deliver: the same notification is never sent twice to the same person', async () => {
  const { store } = fakeStore()
  const { sent, mailer } = fakeMailer([])
  const deps = { store, mailer } as Deps
  await deliver(deps, planned)
  const second = await deliver(deps, planned)
  assertEquals(second.status, 'skipped')
  assertEquals(sent.length, 1)
})

Deno.test('deliver: a provider failure is logged with the error and never throws', async () => {
  const { rows, store } = fakeStore()
  const { mailer } = fakeMailer([{ ok: false, error: 'Resend 422: domain not verified' }])
  const out = await deliver({ store, mailer } as Deps, planned)
  assertEquals(out.status, 'failed')
  const row = rows.get('log1')!
  assertEquals(
    [row.status, row.error, row.attempts],
    ['failed', 'Resend 422: domain not verified', 1],
  )
})

Deno.test(
  'deliver: a store that blows up still returns a failed outcome (emails never block the user action)',
  async () => {
    const store = {
      ...fakeStore().store,
      insert: () => Promise.reject(new Error('db down')),
    } as LogStore
    const out = await deliver({ store, mailer: fakeMailer([]).mailer }, planned)
    assertEquals(out.status, 'failed')
    assertStringIncludes(out.error ?? '', 'db down')
  },
)

Deno.test('retry: re-sends a failed email from its stored data and bumps attempts', async () => {
  const { rows, store } = fakeStore()
  const { sent, mailer } = fakeMailer([
    { ok: false, error: 'timeout' },
    { ok: true, id: 're_9' },
  ])
  const deps = { store, mailer } as Deps
  await deliver(deps, planned)
  assertEquals(rows.get('log1')!.status, 'failed')
  const out = await retry(deps, 'log1')
  assertEquals(out.status, 'sent')
  const row = rows.get('log1')!
  assertEquals([row.status, row.attempts, row.error], ['sent', 2, null])
  assertEquals(sent.length, 2)
  assertStringIncludes(sent[1].html, 'Family')
  assertEquals((await retry(deps, 'log1')).status, 'skipped') // already sent
  assertEquals((await retry(deps, 'nope')).status, 'failed')
})

Deno.test(
  'welcome: the one-time link is never stored in the log, and the email can’t be retried',
  async () => {
    const { rows, store } = fakeStore()
    const { sent, mailer } = fakeMailer([{ ok: false, error: 'x' }])
    const deps = { store, mailer } as Deps
    await deliver(deps, {
      template: 'welcome',
      to: 'a@x.in',
      dedupeKey: 'welcome:1',
      entity: 'user',
      entityId: 'u1',
      data: { name: 'Asha', link: 'https://secret.test/token=abc' },
    })
    assertStringIncludes(sent[0].html, 'https://secret.test/token=abc') // the email itself has it
    assert(!JSON.stringify(rows.get('log1')!.payload).includes('token=abc')) // the log does not
    const out = await retry(deps, 'log1')
    assertEquals(out.status, 'failed')
    assertStringIncludes(out.error ?? '', 'Resend invite')
  },
)

Deno.test('logProblem records why nothing was sent', async () => {
  const { rows, store } = fakeStore()
  await logProblem(
    { store, mailer: fakeMailer([]).mailer },
    { template: 'leave.applied', status: 'skipped', error: 'No recipients' },
  )
  const r = [...rows.values()][0]
  assertEquals([r.to, r.status, r.error], ['(none)', 'skipped', 'No recipients'])
})
