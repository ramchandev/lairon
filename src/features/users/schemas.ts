import { z } from 'zod'
import { normalizePhone } from '@/lib/phone'

export type ManagedRole = 'staff' | 'driver' | 'manager' | 'admin'

const emailOk = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)

/** Per-role required fields (PLAN §5.1): Staff/Driver need an email; Manager's is optional. */
export const userSchema = (role: ManagedRole) =>
  z.object({
    full_name: z.string().trim().min(1, 'Name is required'),
    phone: z
      .string()
      .trim()
      .refine((v) => normalizePhone(v) !== null, 'Enter a valid 10-digit mobile number'),
    email: z
      .string()
      .trim()
      .refine(
        (v) => (role === 'manager' ? v === '' || emailOk(v) : emailOk(v)),
        role === 'manager' ? 'Enter a valid email or leave it blank' : 'A valid email is required',
      ),
    area: z.string().trim(),
    hq: z.string().trim(),
    bio: z.string().trim().max(500, 'Keep it under 500 characters'),
  })
export type UserForm = z.infer<ReturnType<typeof userSchema>>

export const ROLE_META: Record<
  ManagedRole,
  { label: string; plural: string; hasArea: boolean; hasBio: boolean }
> = {
  staff: { label: 'Staff', plural: 'Staffs', hasArea: true, hasBio: true },
  driver: { label: 'Driver', plural: 'Drivers', hasArea: false, hasBio: true },
  manager: { label: 'Doctor’s Manager', plural: 'Doctor’s Managers', hasArea: true, hasBio: false },
  admin: { label: 'Super Admin', plural: 'Super Admins', hasArea: false, hasBio: false },
}

/** List page of each role (each has its own link under People in the admin navigation). */
export const ROLE_PATH: Record<ManagedRole, string> = {
  staff: 'staff',
  driver: 'drivers',
  manager: 'managers',
  admin: 'super-admins',
}
export const roleListUrl = (role: ManagedRole) => `/admin/${ROLE_PATH[role]}`
