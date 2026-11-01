import { z } from 'zod'
import { normalizePhone } from '@/lib/phone'

export type ManagedRole = 'staff' | 'driver' | 'manager' | 'admin'

const emailOk = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)

/** Per-role required fields (PLAN §5.1): Staff/Driver need an email; Manager's is optional. */
export const MIN_PASSWORD = 8

/** Staffs, Drivers and Managers get an admin-set password (no invite email); Super Admins get an email invite. */
export const usesPassword = (role: ManagedRole) => role !== 'admin'

/** `editing`: an existing user (a driver's password is then optional — fill it only to change it). */
export const userSchema = (role: ManagedRole, editing = false) =>
  z.object({
    full_name: z.string().trim().min(1, 'Name is required'),
    phone: z
      .string()
      .trim()
      .refine((v) => normalizePhone(v) !== null, 'Enter a valid 10-digit mobile number'),
    email: z.string().trim().refine(emailOk, 'A valid email is required'),
    area: z.string().trim(),
    hq: z.string().trim(),
    bio: z.string().trim().max(500, 'Keep it under 500 characters'),
    /** Drivers only: the password the admin sets (no email is sent). */
    password: z
      .string()
      .refine(
        (v) => !usesPassword(role) || (editing && v === '') || v.length >= MIN_PASSWORD,
        `Use at least ${MIN_PASSWORD} characters`,
      ),
  })
export type UserForm = z.infer<ReturnType<typeof userSchema>>

export const ROLE_META: Record<
  ManagedRole,
  { label: string; plural: string; hasArea: boolean; hasBio: boolean }
> = {
  staff: { label: 'Staff', plural: 'Staffs', hasArea: true, hasBio: true },
  driver: { label: 'Driver', plural: 'Drivers', hasArea: false, hasBio: true },
  manager: { label: 'Manager', plural: 'Managers', hasArea: true, hasBio: true },
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
