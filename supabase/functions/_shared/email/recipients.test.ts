import { assertEquals } from 'jsr:@std/assert@1'
import {
  cleanEmail,
  planLeaveApplied,
  planLeaveDecided,
  planServiceRequestDecided,
  planServiceRequestSubmitted,
  planStarterPackFulfilled,
  planStarterPackSubmitted,
  resolveAdmins,
  uniqueEmails,
  type BatchRec,
  type Ctx,
  type LeaveRow,
  type PackRec,
} from './recipients.ts'

const ctx: Ctx = { appUrl: 'https://app.test/', admins: ['boss@lairon.in', 'ops@lairon.in'] }
const batch: BatchRec = {
  id: 'b1',
  ref_no: 'SR-2610-0001',
  manager_name: 'Mgr',
  accountability_staff_name: 'Staff',
  admin_note: 'Approved with conditions',
  services: [
    {
      doctor_name: 'Dr A',
      hospital_name: 'H',
      area: 'A',
      service_type: 'Camp',
      service_amount: '100000.00',
      offer_type: 'Offer',
      offer_percent: 10,
      netrate_amount: null,
    },
    {
      doctor_name: 'Dr B',
      hospital_name: 'H',
      area: 'A',
      service_type: 'CME',
      service_amount: 25000,
      offer_type: 'Netrate',
      offer_percent: null,
      netrate_amount: 900,
    },
  ],
}
const pack: PackRec = {
  id: 'p1',
  ref_no: 'SP-2610-0001',
  request_date: '2026-10-18',
  doctor_name: 'Dr A',
  qualification: 'MD',
  doctor_area: 'Adyar',
  staff_name: 'Staff',
  staff_area: 'Adyar',
  division: 'OL',
  admin_note: null,
  items: [
    { product_name: 'B', quantity: '2', sort_order: 1 },
    { product_name: 'A', quantity: '1', sort_order: 0 },
  ],
}
const leave = (id: string, d: string, extra: Partial<LeaveRow> = {}): LeaveRow => ({
  id,
  entry_date: d,
  leave_type: 'Casual',
  leave_reason: 'Family',
  decision_note: null,
  driver_name: 'RAVIKUMAR.N',
  ...extra,
})

Deno.test(
  'emails: blank, malformed and synthetic manager addresses are dropped; duplicates collapse',
  () => {
    assertEquals(cleanEmail('  Boss@Lairon.IN '), 'boss@lairon.in')
    assertEquals(cleanEmail('m919876543210@managers.lairon.internal'), null)
    assertEquals(cleanEmail('nope'), null)
    assertEquals(cleanEmail(null), null)
    assertEquals(uniqueEmails(['a@x.in', 'A@X.IN', null, '', 'b@x.in']), ['a@x.in', 'b@x.in'])
  },
)

Deno.test('admins: configured list wins; otherwise every active admin', () => {
  assertEquals(resolveAdmins(['ops@x.in', 'bad'], ['boss@x.in']), ['ops@x.in'])
  assertEquals(resolveAdmins([], ['boss@x.in', 'boss@x.in']), ['boss@x.in'])
  assertEquals(resolveAdmins(null, ['boss@x.in']), ['boss@x.in'])
  assertEquals(resolveAdmins(undefined, []), [])
})

Deno.test(
  'service request submitted: admins get a review link, accountable staff get no link and no duplicate',
  () => {
    const p = planServiceRequestSubmitted(batch, ctx, 'staff@x.in')
    assertEquals(
      p.map((x) => x.to),
      ['boss@lairon.in', 'ops@lairon.in', 'staff@x.in'],
    )
    assertEquals((p[0].data as { link: string }).link, 'https://app.test/admin/service-requests/b1')
    assertEquals((p[2].data as { link: unknown }).link, null)
    assertEquals((p[0].data as { total: number }).total, 125000)
    assertEquals(
      (p[0].data as { services: { terms: string }[] }).services.map((s) => s.terms),
      ['Offer 10%', 'Netrate ₹900'],
    )
    // staff who is also an admin gets one email
    assertEquals(planServiceRequestSubmitted(batch, ctx, 'BOSS@lairon.in').length, 2)
    // no accountable staff email -> admins only
    assertEquals(planServiceRequestSubmitted(batch, ctx, null).length, 2)
  },
)

Deno.test(
  'service request decided: manager (with link) and staff; phone-only manager is skipped',
  () => {
    const p = planServiceRequestDecided(batch, 'rejected', ctx, 'mgr@x.in', 'staff@x.in')
    assertEquals(
      p.map((x) => x.to),
      ['mgr@x.in', 'staff@x.in'],
    )
    assertEquals((p[0].data as { link: string }).link, 'https://app.test/m/requests/view/b1')
    assertEquals((p[0].data as { note: string }).note, 'Approved with conditions')
    assertEquals(p[0].dedupeKey, 'service_request_decided:b1:rejected:mgr@x.in')
    const phoneOnly = planServiceRequestDecided(
      batch,
      'approved',
      ctx,
      'm919876543210@managers.lairon.internal',
      'staff@x.in',
    )
    assertEquals(
      phoneOnly.map((x) => x.to),
      ['staff@x.in'],
    )
    assertEquals(planServiceRequestDecided(batch, 'approved', ctx, null, null), [])
  },
)

Deno.test('dedupe keys separate different decisions on the same request', () => {
  const a = planServiceRequestDecided(batch, 'approved', ctx, 'mgr@x.in', null)[0].dedupeKey
  const b = planServiceRequestDecided(batch, 'fulfilled', ctx, 'mgr@x.in', null)[0].dedupeKey
  assertEquals(a === b, false)
})

Deno.test(
  'starter pack: submitted → admins; fulfilled → the staff member; items keep their order',
  () => {
    const s = planStarterPackSubmitted(pack, ctx)
    assertEquals(s.length, 2)
    assertEquals(
      (s[0].data as { items: { name: string }[] }).items.map((i) => i.name),
      ['A', 'B'],
    )
    assertEquals((s[0].data as { link: string }).link, 'https://app.test/admin/starter-packs/p1')
    const f = planStarterPackFulfilled(pack, ctx, 'staff@x.in')
    assertEquals(
      f.map((x) => x.to),
      ['staff@x.in'],
    )
    assertEquals((f[0].data as { link: string }).link, 'https://app.test/staff/requests/p1')
    assertEquals(planStarterPackFulfilled(pack, ctx, ''), [])
  },
)

Deno.test(
  'leave: a 3-day request is ONE summary email per admin; decision goes to the driver',
  () => {
    const rows = [leave('3', '2026-10-22'), leave('1', '2026-10-20'), leave('2', '2026-10-21')]
    const a = planLeaveApplied(rows, ctx)
    assertEquals(a.length, 2)
    const d = a[0].data as { from: string; to: string; days: number; link: string }
    assertEquals([d.from, d.to, d.days], ['2026-10-20', '2026-10-22', 3])
    assertEquals(d.link, 'https://app.test/admin/trip-duty?tab=leave')
    assertEquals(planLeaveApplied([], ctx), [])
    const dec = planLeaveDecided(
      [leave('1', '2026-10-20', { decision_note: 'Peak week' })],
      'rejected',
      ctx,
      'drv@x.in',
    )
    assertEquals(
      dec.map((x) => x.to),
      ['drv@x.in'],
    )
    assertEquals((dec[0].data as { note: string; status: string }).note, 'Peak week')
    assertEquals(planLeaveDecided(rows, 'approved', ctx, null), [])
  },
)
