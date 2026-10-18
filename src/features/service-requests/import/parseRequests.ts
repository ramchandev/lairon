import {
  canonical,
  matchPerson,
  norm,
  parseDate,
  parseNumber,
  text,
  type BulkRow,
  type FieldSpec,
  type Issue,
  type Rec,
} from '@/features/bulk-import/sheet'
import { normalizePhone } from '@/lib/phone'

export const SR_FIELDS: FieldSpec[] = [
  {
    key: 'ref_no',
    label: 'Request No',
    aliases: ['refno', 'ref', 'reference', 'srno', 'requestref'],
  },
  {
    key: 'manager',
    label: "Doctor's Manager",
    aliases: ['manager', 'managername', 'doctormanager', 'managerphone'],
  },
  {
    key: 'staff',
    label: 'Accountability',
    aliases: ['accountabilitystaff', 'staff', 'staffname', 'accountabilitystaffname'],
  },
  { key: 'status', label: 'Status' },
  { key: 'note', label: 'Admin Note', aliases: ['note', 'rejectionreason', 'reason', 'remarks'] },
  {
    key: 'submitted_on',
    label: 'Submitted On',
    aliases: ['submitteddate', 'submitted', 'requestdate'],
  },
  { key: 'request_date', label: 'Service Date', aliases: ['date', 'servicedate'] },
  { key: 'doctor', label: 'Doctor Name', aliases: ['doctor'] },
  { key: 'area', label: 'Area' },
  { key: 'hospital', label: 'Hospital Name', aliases: ['hospital'] },
  { key: 'pharmacy', label: 'Pharmacy Name', aliases: ['pharmacy'] },
  { key: 'hq', label: 'HQ' },
  { key: 'division', label: 'Division' },
  { key: 'qualification', label: 'Qualification' },
  { key: 'speciality', label: 'Speciality', aliases: ['specialty'] },
  { key: 'service_amount', label: 'Service Amount', aliases: ['amount', 'serviceamt'] },
  { key: 'service_type', label: 'Service Type', aliases: ['service'] },
  {
    key: 'expected',
    label: 'Expected Business Value',
    aliases: ['expectedbusiness', 'expectedvalue', 'expected'],
  },
  {
    key: 'current',
    label: 'Current Business Value',
    aliases: ['currentbusiness', 'currentvalue', 'current'],
  },
  { key: 'offer_type', label: 'Offer / Netrate', aliases: ['offertype', 'offer', 'offernetrate'] },
  { key: 'offer_percent', label: 'Offer %', aliases: ['offerpercent', 'offerpct'] },
  { key: 'netrate', label: 'Netrate Amount', aliases: ['netrateamount', 'netrate'] },
]
export const SR_TEMPLATE_HEADER = SR_FIELDS.map((f) => f.label)
export const SR_TEMPLATE_ROWS: (string | number)[][] = [
  [
    '',
    'Anitha Rao',
    'Karthik Raman',
    'Fulfilled',
    '',
    '10/09/2026',
    '10/09/2026',
    'Dr. Rakshana',
    'T. Nagar',
    'Apollo Hospital',
    '',
    'CHN',
    'OL',
    'MD',
    'Cardiology',
    5000,
    'CME',
    20000,
    10000,
    'Offer',
    10,
    '',
  ],
  [
    '',
    'Anitha Rao',
    'Karthik Raman',
    'Fulfilled',
    '',
    '10/09/2026',
    '11/09/2026',
    'Dr. Jaswanth',
    'Adyar',
    'Fortis',
    'MedPlus',
    'CHN',
    'OL',
    'MBBS',
    'General Medicine',
    3000,
    'Camp',
    12000,
    8000,
    'Netrate',
    '',
    450,
  ],
]

export const STATUSES = ['submitted', 'approved', 'rejected', 'fulfilled'] as const
type Status = (typeof STATUSES)[number]
const STATUS_WORDS: Record<string, Status> = {
  submitted: 'submitted',
  pending: 'submitted',
  approved: 'approved',
  rejected: 'rejected',
  fulfilled: 'fulfilled',
  completed: 'fulfilled',
}

export interface SrService {
  request_date: string
  doctor_id: string | null
  doctor_name: string
  area: string
  hospital_name: string
  pharmacy_name: string
  hq: string
  division: string
  qualification: string
  speciality: string
  service_amount: number
  service_type: string
  expected_business_value: number
  current_business_value: number
  offer_type: string
  offer_percent: number | null
  netrate_amount: number | null
}
export interface SrRow extends BulkRow {
  /** Rows with the same key become one request. */
  group: string
  ref_no: string
  manager_id: string | null
  manager_name: string
  staff_id: string | null
  staff_name: string
  status: Status
  note: string
  submitted_on: string | null
  service: SrService | null
}

export interface SrCtx {
  managers: { id: string; full_name: string; phone: string }[]
  staff: { id: string; full_name: string; phone: string }[]
  doctors: { id: string; name: string; manager_id: string | null }[]
  existingRefs: Set<string>
  hqs: string[]
  serviceTypes: string[]
  offerTypes: string[]
  divisions: string[]
}

export function parseRequests(records: Rec[], ctx: SrCtx): { rows: SrRow[]; issues: Issue[] } {
  const offerTypes = ctx.offerTypes.length ? ctx.offerTypes : ['Offer', 'Netrate']
  const firstByGroup = new Map<string, SrRow>()
  const rows = records.map((r): SrRow => {
    const line = r.__line
    const issues: Issue[] = []
    const err = (message: string) => issues.push({ severity: 'error', line, message })
    const warn = (message: string) => issues.push({ severity: 'warning', line, message })

    const manager = matchPerson(text(r.manager), ctx.managers, normalizePhone)
    if (!text(r.manager)) err('Doctor’s Manager is missing')
    else if (!manager)
      err(`Doctor’s Manager “${text(r.manager)}” not found (use the exact name or phone)`)
    const staff = matchPerson(text(r.staff), ctx.staff, normalizePhone)
    if (!text(r.staff)) err('Accountability staff is missing')
    else if (!staff) err(`Staff “${text(r.staff)}” not found (use the exact name or phone)`)

    const statusText = text(r.status)
    const status = statusText ? STATUS_WORDS[norm(statusText)] : 'submitted'
    if (!status) err(`Unknown status “${statusText}” (Submitted, Approved, Rejected or Fulfilled)`)
    const note = text(r.note)
    if (status === 'rejected' && !note) err('A rejected request needs an Admin Note (the reason)')

    const request_date = parseDate(r.request_date)
    if (!request_date)
      err(
        text(r.request_date)
          ? `Unreadable service date “${text(r.request_date)}”`
          : 'Service date is missing',
      )
    const submitted_on = parseDate(r.submitted_on) ?? request_date

    const need = (v: string, label: string) => {
      if (!v) err(`${label} is missing`)
      return v
    }
    const doctor_name = need(text(r.doctor), 'Doctor name')
    const area = need(text(r.area), 'Area')
    const hospital_name = need(text(r.hospital), 'Hospital name')
    let hq = need(text(r.hq), 'HQ')
    let division = need(text(r.division), 'Division')
    const qualification = need(text(r.qualification), 'Qualification')
    const speciality = need(text(r.speciality), 'Speciality')
    let service_type = need(text(r.service_type), 'Service type')

    if (hq && ctx.hqs.length) {
      const c = canonical(hq, ctx.hqs)
      if (c) hq = c
      else warn(`HQ “${hq}” isn’t in the HQ dropdown — saved as typed`)
    }
    if (division && ctx.divisions.length) {
      const c = canonical(division, [...ctx.divisions, 'All Division'])
      if (c) division = c
      else warn(`Division “${division}” isn’t one of your divisions — saved as typed`)
    }
    if (service_type && ctx.serviceTypes.length) {
      const c = canonical(service_type, ctx.serviceTypes)
      if (c) service_type = c
      else warn(`Service type “${service_type}” isn’t in the dropdown — saved as typed`)
    }

    const amount = parseNumber(r.service_amount)
    if (amount === null || amount < 0) err('Service amount must be a number (0 or more)')
    const expected = parseNumber(r.expected) ?? 0
    const current = parseNumber(r.current) ?? 0

    const offerText = text(r.offer_type)
    const offer_type = offerText ? (canonical(offerText, offerTypes) ?? '') : ''
    let offer_percent: number | null = null
    let netrate_amount: number | null = null
    if (!offerText) err('Offer / Netrate is missing')
    else if (!offer_type) err(`Offer type “${offerText}” isn’t one of ${offerTypes.join(' / ')}`)
    else if (norm(offer_type) === 'offer') {
      offer_percent = parseNumber(r.offer_percent)
      if (offer_percent === null || offer_percent < 0 || offer_percent > 100)
        err('Offer % (0–100) is required when the type is Offer')
    } else if (norm(offer_type) === 'netrate') {
      netrate_amount = parseNumber(r.netrate)
      if (netrate_amount === null || netrate_amount < 0)
        err('Netrate amount is required when the type is Netrate')
    }

    const ref_no = text(r.ref_no).toUpperCase()
    if (ref_no && ctx.existingRefs.has(ref_no)) err(`Request number ${ref_no} already exists`)
    const group =
      ref_no ||
      [norm(text(r.manager)), norm(text(r.staff)), status ?? '', submitted_on ?? ''].join('|')

    const doc = manager
      ? ctx.doctors.find((d) => d.manager_id === manager.id && norm(d.name) === norm(doctor_name))
      : undefined
    const row: SrRow = {
      line,
      issues,
      group,
      ref_no,
      manager_id: manager?.id ?? null,
      manager_name: manager?.full_name ?? text(r.manager),
      staff_id: staff?.id ?? null,
      staff_name: staff?.full_name ?? text(r.staff),
      status: status ?? 'submitted',
      note,
      submitted_on,
      service:
        request_date && amount !== null
          ? {
              request_date,
              doctor_id: doc?.id ?? null,
              doctor_name,
              area,
              hospital_name,
              pharmacy_name: text(r.pharmacy),
              hq,
              division,
              qualification,
              speciality,
              service_amount: amount,
              service_type,
              expected_business_value: expected,
              current_business_value: current,
              offer_type,
              offer_percent,
              netrate_amount,
            }
          : null,
    }
    // Rows sharing a Request No must describe the same request.
    const first = firstByGroup.get(group)
    if (!first) firstByGroup.set(group, row)
    else if (
      ref_no &&
      (first.manager_id !== row.manager_id ||
        first.staff_id !== row.staff_id ||
        first.status !== row.status)
    )
      err(`Same Request No as row ${first.line} but a different manager, staff or status`)
    return row
  })
  return { rows, issues: [] }
}

/** Valid rows -> the import_service_requests() payload (one request per group). */
export function toRequestsPayload(rows: SrRow[], fileName: string) {
  const groups = new Map<string, SrRow[]>()
  for (const r of rows) groups.set(r.group, [...(groups.get(r.group) ?? []), r])
  return {
    file_name: fileName,
    requests: [...groups.values()].map((g) => ({
      ref_no: g[0].ref_no || null,
      manager_id: g[0].manager_id,
      staff_id: g[0].staff_id,
      status: g[0].status,
      submitted_on: g[0].submitted_on,
      admin_note: g[0].note || null,
      services: g.map((r) => r.service),
    })),
  }
}
