import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { renderEmail } from './render.ts'
import type { LeaveData, ServiceRequestData, StarterPackData } from './types.ts'

const sr: ServiceRequestData = {
  refNo: 'SR-2610-0001', status: 'submitted', managerName: 'Mgr One', accountabilityName: 'Staff One', total: 125000,
  services: [
    { doctor: 'Dr A', hospital: 'Apollo', area: 'Adyar', serviceType: 'Camp', amount: 100000, terms: 'Offer 10%' },
    { doctor: 'Dr B', hospital: 'MIOT', area: 'Manapakkam', serviceType: 'CME', amount: 25000, terms: 'Netrate ₹900' },
  ],
  link: 'https://app.test/admin/service-requests/abc',
}
const sp: StarterPackData = {
  refNo: 'SP-2610-0001', date: '2026-10-18', doctor: 'Dr A', qualification: 'MD', doctorArea: 'Adyar', staffName: 'Staff One', staffArea: 'Adyar', division: 'OL',
  items: [{ name: 'Lairobon', quantity: '1 box' }, { name: 'Free text', quantity: '10 strips' }], link: 'https://app.test/admin/starter-packs/x',
}
const leave: LeaveData = { driverName: 'RAVIKUMAR.N', from: '2026-10-20', to: '2026-10-22', days: 3, type: 'Casual', reason: 'Family function', link: 'https://app.test/admin/trip-duty?tab=leave' }

Deno.test('welcome email has the link in HTML and in the plain-text fallback', async () => {
  const r = await renderEmail('welcome', { name: 'Asha', link: 'https://app.test/set-password#token=1' })
  assertEquals(r.subject, 'Welcome to LAIRON EZ — set your password')
  assertStringIncludes(r.html, 'href="https://app.test/set-password#token=1"')
  assertStringIncludes(r.html, 'LAIRON EZ')
  assertStringIncludes(r.text, 'https://app.test/set-password#token=1')
  assert(!/<[a-z]/i.test(r.text), 'plain text must not contain HTML tags')
})

Deno.test('service request submitted lists every service, Indian-grouped totals and the review link', async () => {
  const r = await renderEmail('service_request_submitted', sr)
  assertEquals(r.subject, 'Service request SR-2610-0001 submitted (₹1,25,000)')
  for (const s of ['Dr A', 'Dr B', 'Apollo', 'Offer 10%', 'Netrate ₹900', '₹1,00,000', '₹25,000']) assertStringIncludes(r.html, s)
  assertStringIncludes(r.html, 'href="https://app.test/admin/service-requests/abc"')
  assertStringIncludes(r.text, 'Dr B')
})

Deno.test('a recipient with no screen gets no button (accountable staff)', async () => {
  const r = await renderEmail('service_request_submitted', { ...sr, link: null })
  assert(!r.html.includes('Review request'))
  assertStringIncludes(r.html, 'accountable staff')
})

Deno.test('service request decisions show status and the admin note', async () => {
  const rej = await renderEmail('service_request_decided', { ...sr, status: 'rejected', note: 'No budget this quarter' })
  assertEquals(rej.subject, 'Service request SR-2610-0001 rejected')
  assertStringIncludes(rej.html, 'Rejected')
  assertStringIncludes(rej.html, 'No budget this quarter')
  const ok = await renderEmail('service_request_decided', { ...sr, status: 'fulfilled' })
  assertEquals(ok.subject, 'Service request SR-2610-0001 fulfilled')
})

Deno.test('starter pack emails list products with quantities', async () => {
  const a = await renderEmail('starter_pack_submitted', sp)
  assertEquals(a.subject, 'Starter pack SP-2610-0001: Staff One for Dr A')
  for (const s of ['Lairobon', '1 box', 'Free text', '10 strips', '18 Oct 2026', 'OL']) assertStringIncludes(a.html, s)
  const b = await renderEmail('starter_pack_fulfilled', sp)
  assertEquals(b.subject, 'Starter pack SP-2610-0001 fulfilled')
  assertStringIncludes(b.html, 'Fulfilled')
})

Deno.test('leave emails show a date range, the reason and the decision note', async () => {
  const a = await renderEmail('leave_applied', leave)
  assertEquals(a.subject, 'Leave request: RAVIKUMAR.N, 20 Oct 2026 – 22 Oct 2026')
  assertStringIncludes(a.html, 'Family function')
  const d = await renderEmail('leave_decided', { ...leave, status: 'rejected', note: 'Peak week' })
  assertEquals(d.subject, 'Your leave was rejected: 20 Oct 2026 – 22 Oct 2026')
  assertStringIncludes(d.html, 'Peak week')
  const one = await renderEmail('leave_applied', { ...leave, to: '2026-10-20', days: 1 })
  assertEquals(one.subject, 'Leave request: RAVIKUMAR.N, 20 Oct 2026')
})

Deno.test('user-supplied text is escaped in HTML', async () => {
  const r = await renderEmail('leave_applied', { ...leave, reason: '<script>alert(1)</script>' })
  assert(!r.html.includes('<script>alert(1)</script>'))
  assertStringIncludes(r.html, '&lt;script&gt;')
})
