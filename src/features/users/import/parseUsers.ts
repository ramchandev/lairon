import {
  canonical,
  norm,
  text,
  type BulkRow,
  type FieldSpec,
  type Issue,
  type Rec,
} from '@/features/bulk-import/sheet'
import { normalizePhone } from '@/lib/phone'
import type { ManagedRole } from '../schemas'

export const USER_FIELDS: FieldSpec[] = [
  { key: 'role', label: 'Role', aliases: ['usertype', 'type'] },
  { key: 'full_name', label: 'Full Name', aliases: ['name', 'username', 'employeename'] },
  {
    key: 'phone',
    label: 'Phone',
    aliases: ['mobile', 'mobileno', 'mobilenumber', 'phonenumber', 'contact'],
  },
  { key: 'email', label: 'Email', aliases: ['emailid', 'mail', 'emailaddress'] },
  { key: 'area', label: 'Area' },
  { key: 'hq', label: 'HQ', aliases: ['headquarters', 'headquarter'] },
  { key: 'bio', label: 'Bio', aliases: ['about', 'notes'] },
]
export const USER_TEMPLATE_HEADER = ['Role', 'Full Name', 'Phone', 'Email', 'Area', 'HQ', 'Bio']
export const USER_TEMPLATE_ROWS: (string | number)[][] = [
  [
    'Staff',
    'Karthik Raman',
    '9840122345',
    'karthik@lairon.in',
    'Velachery',
    '',
    'Field staff, OL division',
  ],
  ['Driver', 'Ravikumar N', '9884033456', 'ravikumar@lairon.in', '', '', ''],
  ['Manager', 'Anitha Rao', '9790011223', '', 'Anna Nagar', 'CHN', ''],
]

export interface UserRow extends BulkRow {
  role: ManagedRole | null
  full_name: string
  phone: string | null
  email: string
  area: string
  hq: string
  bio: string
}

const ROLE_WORDS: Record<string, ManagedRole | 'admin'> = {
  staff: 'staff',
  staffs: 'staff',
  driver: 'driver',
  drivers: 'driver',
  manager: 'manager',
  managers: 'manager',
  doctorsmanager: 'manager',
  doctormanager: 'manager',
  admin: 'admin',
  superadmin: 'admin',
}

export interface UserCtx {
  /** Role used for rows without a Role column (when the import is started from a role page). */
  defaultRole: ManagedRole | null
  existingPhones: Set<string>
  existingEmails: Set<string>
  hqs: string[]
}

const emailOk = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)

export function parseUsers(records: Rec[], ctx: UserCtx): { rows: UserRow[]; issues: Issue[] } {
  const seenPhones = new Map<string, number>()
  const seenEmails = new Map<string, number>()
  const rows = records.map((r): UserRow => {
    const line = r.__line
    const issues: Issue[] = []
    const err = (message: string) => issues.push({ severity: 'error', line, message })
    const warn = (message: string) => issues.push({ severity: 'warning', line, message })

    const roleText = text(r.role)
    let role: ManagedRole | null = null
    if (roleText) {
      const w = ROLE_WORDS[norm(roleText)]
      if (!w) err(`Unknown role “${roleText}” (use Staff, Driver or Manager)`)
      else if (w === 'admin')
        err('Super Admins can’t be imported — add them one by one under Super Admins')
      else role = w
    } else if (ctx.defaultRole) role = ctx.defaultRole
    else err('Role is missing (Staff, Driver or Manager)')

    const full_name = text(r.full_name)
    if (!full_name) err('Name is missing')

    const phone = normalizePhone(text(r.phone))
    if (!text(r.phone)) err('Phone is missing')
    else if (!phone) err(`“${text(r.phone)}” is not a valid 10-digit mobile number`)
    else if (ctx.existingPhones.has(phone)) err(`${phone} already belongs to a user`)
    else if (seenPhones.has(phone)) err(`Same phone as row ${seenPhones.get(phone)} in this file`)
    else seenPhones.set(phone, line)

    const email = text(r.email).toLowerCase()
    if (email && !emailOk(email)) err(`“${email}” is not a valid email`)
    else if (!email && role && role !== 'manager')
      err('Email is required (the login invite is sent there)')
    else if (email) {
      if (ctx.existingEmails.has(email)) err(`${email} already belongs to a user`)
      else if (seenEmails.has(email)) err(`Same email as row ${seenEmails.get(email)} in this file`)
      else seenEmails.set(email, line)
    }

    let hq = text(r.hq)
    if (hq && ctx.hqs.length) {
      const c = canonical(hq, ctx.hqs)
      if (c) hq = c
      else warn(`HQ “${hq}” isn’t in the HQ dropdown — saved as typed`)
    }
    const bio = text(r.bio)
    if (bio.length > 500) err('Bio is longer than 500 characters')

    return { line, issues, role, full_name, phone, email, area: text(r.area), hq, bio }
  })
  return { rows, issues: [] }
}
