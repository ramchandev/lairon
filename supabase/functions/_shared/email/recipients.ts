import { dateRange } from './format.ts'
import type { LeaveData, Planned, ServiceRequestData, StarterPackData } from './types.ts'

// ───────────── people ─────────────
export const SYNTHETIC_DOMAIN = '@managers.lairon.internal'

/** A deliverable address, or null (blank, malformed, or the synthetic login address of a phone-only manager). */
export function cleanEmail(e: unknown): string | null {
  if (typeof e !== 'string') return null
  const v = e.trim().toLowerCase()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && !v.endsWith(SYNTHETIC_DOMAIN) ? v : null
}

export const uniqueEmails = (list: unknown[]): string[] => [
  ...new Set(list.map(cleanEmail).filter((x): x is string => !!x)),
]

/** The admins who get request emails: Settings → notify_emails, or every active admin when none are configured. */
export function resolveAdmins(configured: unknown, activeAdminEmails: unknown[]): string[] {
  const set = Array.isArray(configured) ? uniqueEmails(configured) : []
  return set.length ? set : uniqueEmails(activeAdminEmails)
}

export interface Ctx {
  appUrl: string
  admins: string[]
}
const base = (c: Ctx) => c.appUrl.replace(/\/$/, '')

// ───────────── records (what `notify` loads) ─────────────
export interface ServiceRec {
  doctor_name: string
  hospital_name: string
  area: string
  service_type: string
  service_amount: number | string
  offer_type: string
  offer_percent: number | null
  netrate_amount: number | null
}
export interface BatchRec {
  id: string
  ref_no: string | null
  manager_name: string | null
  accountability_staff_name: string | null
  admin_note: string | null
  services: ServiceRec[]
}
export interface PackRec {
  id: string
  ref_no: string | null
  request_date: string
  doctor_name: string
  qualification: string
  doctor_area: string
  staff_name: string
  staff_area: string
  division: string
  admin_note: string | null
  items: { product_name: string; quantity: string; sort_order: number }[]
}
export interface LeaveRow {
  id: string
  entry_date: string
  leave_type: string | null
  leave_reason: string | null
  decision_note: string | null
  driver_name: string | null
}

const money = (n: number | string) => Number(n)
function terms(s: ServiceRec): string {
  const t = s.offer_type.trim().toLowerCase()
  if (t === 'offer') return `Offer ${s.offer_percent ?? 0}%`
  if (t === 'netrate')
    return `Netrate ₹${new Intl.NumberFormat('en-IN').format(Number(s.netrate_amount ?? 0))}`
  return s.offer_type
}

function serviceData(
  b: BatchRec,
  status: ServiceRequestData['status'],
  link: string | null,
  note?: string | null,
): ServiceRequestData {
  return {
    refNo: b.ref_no ?? 'Draft',
    status,
    managerName: b.manager_name ?? '—',
    accountabilityName: b.accountability_staff_name ?? '—',
    total: b.services.reduce((n, s) => n + money(s.service_amount), 0),
    note: note ?? null,
    link,
    services: b.services.map((s) => ({
      doctor: s.doctor_name,
      hospital: s.hospital_name,
      area: s.area,
      serviceType: s.service_type,
      amount: money(s.service_amount),
      terms: terms(s),
    })),
  }
}

function packData(p: PackRec, link: string | null): StarterPackData {
  return {
    refNo: p.ref_no ?? '—',
    date: p.request_date,
    doctor: p.doctor_name,
    qualification: p.qualification,
    doctorArea: p.doctor_area,
    staffName: p.staff_name,
    staffArea: p.staff_area,
    division: p.division,
    note: p.admin_note,
    link,
    items: [...p.items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ name: i.product_name, quantity: i.quantity })),
  }
}

/** Per-day leave rows -> one request summary. */
export function leaveSummary(rows: LeaveRow[]): Omit<LeaveData, 'status' | 'link'> {
  const sorted = [...rows].sort((a, b) => a.entry_date.localeCompare(b.entry_date))
  const first = sorted[0]
  return {
    driverName: first.driver_name ?? 'Driver',
    from: first.entry_date,
    to: sorted[sorted.length - 1].entry_date,
    days: sorted.length,
    type: first.leave_type ?? 'Leave',
    reason: first.leave_reason ?? '',
    note: sorted.find((r) => r.decision_note)?.decision_note ?? null,
  }
}

const mk = <T extends Planned['template']>(
  template: T,
  to: string,
  data: Planned<T>['data'],
  entity: string,
  entityId: string,
  keyExtra = '',
): Planned<T> => ({
  template,
  to,
  data,
  entity,
  entityId,
  dedupeKey: `${template}:${entityId}${keyExtra ? ':' + keyExtra : ''}:${to}`,
})

// ───────────── who gets what (PLAN §7) ─────────────
/** Submitted → admins (with a review link) + the accountable staff member (no link: they have no screen for it). */
export function planServiceRequestSubmitted(b: BatchRec, ctx: Ctx, staffEmail: unknown): Planned[] {
  const out: Planned[] = ctx.admins.map((to) =>
    mk(
      'service_request_submitted',
      to,
      serviceData(b, 'submitted', `${base(ctx)}/admin/service-requests/${b.id}`),
      'service_request',
      b.id,
    ),
  )
  const staff = cleanEmail(staffEmail)
  if (staff && !ctx.admins.includes(staff))
    out.push(
      mk(
        'service_request_submitted',
        staff,
        serviceData(b, 'submitted', null),
        'service_request',
        b.id,
      ),
    )
  return out
}

/** Approved / rejected / fulfilled → the manager (if they have an email) + the accountable staff member. */
export function planServiceRequestDecided(
  b: BatchRec,
  status: 'approved' | 'rejected' | 'fulfilled',
  ctx: Ctx,
  managerEmail: unknown,
  staffEmail: unknown,
): Planned[] {
  const out: Planned[] = []
  const manager = cleanEmail(managerEmail)
  if (manager)
    out.push(
      mk(
        'service_request_decided',
        manager,
        serviceData(b, status, `${base(ctx)}/m/requests/view/${b.id}`, b.admin_note),
        'service_request',
        b.id,
        status,
      ),
    )
  const staff = cleanEmail(staffEmail)
  if (staff && staff !== manager)
    out.push(
      mk(
        'service_request_decided',
        staff,
        serviceData(b, status, null, b.admin_note),
        'service_request',
        b.id,
        status,
      ),
    )
  return out
}

export const planStarterPackSubmitted = (p: PackRec, ctx: Ctx): Planned[] =>
  ctx.admins.map((to) =>
    mk(
      'starter_pack_submitted',
      to,
      packData(p, `${base(ctx)}/admin/starter-packs/${p.id}`),
      'starter_pack',
      p.id,
    ),
  )

export function planStarterPackFulfilled(p: PackRec, ctx: Ctx, staffEmail: unknown): Planned[] {
  const to = cleanEmail(staffEmail)
  return to
    ? [
        mk(
          'starter_pack_fulfilled',
          to,
          packData(p, `${base(ctx)}/staff/requests/${p.id}`),
          'starter_pack',
          p.id,
        ),
      ]
    : []
}

export const planLeaveApplied = (rows: LeaveRow[], ctx: Ctx): Planned[] =>
  rows.length === 0
    ? []
    : ctx.admins.map((to) =>
        mk(
          'leave_applied',
          to,
          { ...leaveSummary(rows), link: `${base(ctx)}/admin/trip-duty?tab=leave` },
          'leave',
          rows[0].id,
        ),
      )

export function planLeaveDecided(
  rows: LeaveRow[],
  status: 'approved' | 'rejected',
  ctx: Ctx,
  driverEmail: unknown,
): Planned[] {
  const to = cleanEmail(driverEmail)
  return to && rows.length
    ? [
        mk(
          'leave_decided',
          to,
          { ...leaveSummary(rows), status, link: `${base(ctx)}/driver/profile` },
          'leave',
          rows[0].id,
          status,
        ),
      ]
    : []
}

export { dateRange }
