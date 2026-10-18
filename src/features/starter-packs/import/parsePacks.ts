import {
  canonical,
  matchPerson,
  norm,
  parseDate,
  text,
  type BulkRow,
  type FieldSpec,
  type Issue,
  type Rec,
} from '@/features/bulk-import/sheet'
import { normalizePhone } from '@/lib/phone'

export const SP_FIELDS: FieldSpec[] = [
  { key: 'ref_no', label: 'Request No', aliases: ['refno', 'ref', 'reference', 'spno'] },
  { key: 'request_date', label: 'Date', aliases: ['requestdate'] },
  { key: 'doctor', label: 'Doctor Name', aliases: ['doctor'] },
  { key: 'qualification', label: 'Qualification' },
  { key: 'doctor_area', label: 'Doctor Area', aliases: ['area'] },
  { key: 'staff', label: 'Staff', aliases: ['staffname', 'staffmember'] },
  { key: 'staff_area', label: 'Staff Area' },
  { key: 'division', label: 'Division' },
  { key: 'status', label: 'Status' },
  { key: 'note', label: 'Admin Note', aliases: ['note', 'cancelreason', 'reason', 'remarks'] },
  { key: 'product', label: 'Product', aliases: ['productname'] },
  { key: 'quantity', label: 'Quantity', aliases: ['qty'] },
]
export const SP_TEMPLATE_HEADER = SP_FIELDS.map((f) => f.label)
export const SP_TEMPLATE_ROWS: (string | number)[][] = [
  [
    '',
    '11/09/2026',
    'Dr. Anitha Rao',
    'MD',
    'Anna Nagar',
    'Karthik Raman',
    'Velachery',
    'OL',
    'Fulfilled',
    '',
    'Rosvalar-10',
    '2 boxes',
  ],
  [
    '',
    '11/09/2026',
    'Dr. Anitha Rao',
    'MD',
    'Anna Nagar',
    'Karthik Raman',
    'Velachery',
    'OL',
    'Fulfilled',
    '',
    'Rosvalar-20',
    '1 box',
  ],
]

const STATUS_WORDS = {
  submitted: 'submitted',
  pending: 'submitted',
  processing: 'processing',
  fulfilled: 'fulfilled',
  completed: 'fulfilled',
  cancelled: 'cancelled',
  canceled: 'cancelled',
} as const
type Status = (typeof STATUS_WORDS)[keyof typeof STATUS_WORDS]

export interface SpRow extends BulkRow {
  group: string
  ref_no: string
  request_date: string | null
  doctor_id: string | null
  doctor_name: string
  qualification: string
  doctor_area: string
  staff_id: string | null
  staff_name: string
  staff_area: string
  division: string
  status: Status
  note: string
  product_id: string | null
  product_name: string
  quantity: string
}

export interface SpCtx {
  staff: { id: string; full_name: string; phone: string; area: string | null }[]
  doctors: { id: string; name: string }[]
  products: { id: string; name: string }[]
  divisions: string[]
  existingRefs: Set<string>
}

export function parsePacks(records: Rec[], ctx: SpCtx): { rows: SpRow[]; issues: Issue[] } {
  const first = new Map<string, SpRow>()
  const rows = records.map((r): SpRow => {
    const line = r.__line
    const issues: Issue[] = []
    const err = (message: string) => issues.push({ severity: 'error', line, message })
    const warn = (message: string) => issues.push({ severity: 'warning', line, message })

    const request_date = parseDate(r.request_date)
    if (!request_date)
      err(text(r.request_date) ? `Unreadable date “${text(r.request_date)}”` : 'Date is missing')
    const doctor_name = text(r.doctor)
    if (!doctor_name) err('Doctor name is missing')
    const staff = matchPerson(text(r.staff), ctx.staff, normalizePhone)
    if (!text(r.staff)) err('Staff is missing')
    else if (!staff) err(`Staff “${text(r.staff)}” not found (use the exact name or phone)`)

    let division = text(r.division)
    if (!division) err('Division is missing')
    else {
      const c = canonical(division, [...ctx.divisions, 'All Division'])
      if (c) division = c
      else warn(`Division “${division}” isn’t one of your divisions — saved as typed`)
    }
    const statusText = text(r.status)
    const status = statusText
      ? STATUS_WORDS[norm(statusText) as keyof typeof STATUS_WORDS]
      : 'submitted'
    if (!status)
      err(`Unknown status “${statusText}” (Submitted, Processing, Fulfilled or Cancelled)`)
    const note = text(r.note)
    if (status === 'cancelled' && !note) err('A cancelled pack needs an Admin Note (the reason)')

    let product_name = text(r.product)
    let product_id: string | null = null
    if (!product_name) err('Product is missing')
    else {
      const p = ctx.products.find((x) => norm(x.name) === norm(product_name))
      if (p) {
        product_name = p.name
        product_id = p.id
      } else warn(`Product “${product_name}” isn’t in the catalogue — saved as typed`)
    }
    const quantity = text(r.quantity)
    if (!quantity) err('Quantity is missing')
    const qualification = text(r.qualification)
    if (!qualification) warn('Qualification is blank')

    const ref_no = text(r.ref_no).toUpperCase()
    if (ref_no && ctx.existingRefs.has(ref_no)) err(`Request number ${ref_no} already exists`)
    const group =
      ref_no ||
      [
        request_date ?? '',
        norm(doctor_name),
        norm(text(r.staff)),
        norm(division),
        status ?? '',
      ].join('|')

    const docs = ctx.doctors.filter((d) => norm(d.name) === norm(doctor_name))
    const row: SpRow = {
      line,
      issues,
      group,
      ref_no,
      request_date,
      doctor_id: docs.length === 1 ? docs[0].id : null,
      doctor_name,
      qualification,
      doctor_area: text(r.doctor_area),
      staff_id: staff?.id ?? null,
      staff_name: staff?.full_name ?? text(r.staff),
      staff_area: text(r.staff_area) || (staff?.area ?? ''),
      division,
      status: status ?? 'submitted',
      note,
      product_id,
      product_name,
      quantity,
    }
    const f = first.get(group)
    if (!f) first.set(group, row)
    else if (
      ref_no &&
      (f.staff_id !== row.staff_id || f.status !== row.status || f.doctor_name !== row.doctor_name)
    )
      err(`Same Request No as row ${f.line} but a different doctor, staff or status`)
    return row
  })
  return { rows, issues: [] }
}

/** Valid rows -> the import_starter_packs() payload (one pack per group). */
export function toPacksPayload(rows: SpRow[], fileName: string) {
  const groups = new Map<string, SpRow[]>()
  for (const r of rows) groups.set(r.group, [...(groups.get(r.group) ?? []), r])
  return {
    file_name: fileName,
    packs: [...groups.values()].map((g) => ({
      ref_no: g[0].ref_no || null,
      request_date: g[0].request_date,
      doctor_id: g[0].doctor_id,
      doctor_name: g[0].doctor_name,
      qualification: g[0].qualification,
      doctor_area: g[0].doctor_area,
      staff_id: g[0].staff_id,
      staff_area: g[0].staff_area,
      division: g[0].division,
      status: g[0].status,
      admin_note: g[0].note || null,
      items: g.map((r) => ({
        product_id: r.product_id,
        product_name: r.product_name,
        quantity: r.quantity,
      })),
    })),
  }
}
