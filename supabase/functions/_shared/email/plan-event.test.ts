import { assertEquals, assertRejects } from 'jsr:@std/assert@1'
import { planEvent, type Loader } from './plan-event.ts'

const batch = {
  id: 'b1', ref_no: 'SR-2610-0001', manager_name: 'Mgr', accountability_staff_name: 'Staff', admin_note: 'ok', manager_id: 'm1', accountability_staff_id: 's1',
  services: [{ doctor_name: 'Dr A', hospital_name: 'H', area: 'A', service_type: 'Camp', service_amount: 100, offer_type: 'Offer', offer_percent: 5, netrate_amount: null }],
}
const emails: Record<string, string | null> = { m1: 'mgr@x.in', s1: 'staff@x.in', d1: 'drv@x.in' }
const loader: Loader = {
  batch: (id) => Promise.resolve(id === 'b1' ? batch : null),
  pack: (id) => Promise.resolve(id === 'p1' ? { id: 'p1', ref_no: 'SP-1', request_date: '2026-10-18', doctor_name: 'Dr A', qualification: 'MD', doctor_area: 'A', staff_name: 'S', staff_area: 'A', division: 'OL', admin_note: null, items: [], staff_id: 's1' } : null),
  leaveRows: (ids) => Promise.resolve(ids.map((id, i) => ({ id, driver_id: 'd1', driver_name: 'RAVI', entry_date: `2026-10-2${i}`, leave_type: 'Casual', leave_reason: 'x', decision_note: null }))),
  email: (id) => Promise.resolve(id ? (emails[id] ?? null) : null),
  admins: () => Promise.resolve(['boss@x.in']),
}
const url = 'https://app.test'

Deno.test('every database event maps to the right recipients', async () => {
  assertEquals((await planEvent({ event: 'service_request.submitted', id: 'b1' }, loader, url)).map((p) => p.to), ['boss@x.in', 'staff@x.in'])
  assertEquals((await planEvent({ event: 'service_request.decided', id: 'b1', status: 'approved' }, loader, url)).map((p) => p.to), ['mgr@x.in', 'staff@x.in'])
  assertEquals((await planEvent({ event: 'starter_pack.submitted', id: 'p1' }, loader, url)).map((p) => p.to), ['boss@x.in'])
  assertEquals((await planEvent({ event: 'starter_pack.fulfilled', id: 'p1' }, loader, url)).map((p) => p.to), ['staff@x.in'])
  assertEquals((await planEvent({ event: 'leave.applied', ids: ['l1', 'l2', 'l3'] }, loader, url)).map((p) => p.to), ['boss@x.in'])
  assertEquals((await planEvent({ event: 'leave.decided', ids: ['l1'], status: 'rejected' }, loader, url)).map((p) => p.to), ['drv@x.in'])
})

Deno.test('a 3-day leave request produces one email per recipient, not three', async () => {
  const p = await planEvent({ event: 'leave.applied', ids: ['l1', 'l2', 'l3'] }, loader, url)
  assertEquals(p.length, 1)
  assertEquals((p[0].data as { days: number }).days, 3)
})

Deno.test('a manager with no email (phone-only) is simply skipped', async () => {
  const noMgr: Loader = { ...loader, email: (id) => Promise.resolve(id === 'm1' ? null : (emails[id ?? ''] ?? null)) }
  assertEquals((await planEvent({ event: 'service_request.decided', id: 'b1', status: 'fulfilled' }, noMgr, url)).map((p) => p.to), ['staff@x.in'])
})

Deno.test('bad input is rejected with a clear message (so `notify` can log it)', async () => {
  await assertRejects(() => planEvent({ event: 'nope' }, loader, url), Error, 'Unknown event')
  await assertRejects(() => planEvent({ event: 'service_request.submitted', id: 'missing' }, loader, url), Error, 'Service request not found')
  await assertRejects(() => planEvent({ event: 'service_request.decided', id: 'b1', status: 'draft' }, loader, url), Error, 'Unexpected status')
  await assertRejects(() => planEvent({ event: 'starter_pack.submitted' }, loader, url), Error, 'id not found')
})
