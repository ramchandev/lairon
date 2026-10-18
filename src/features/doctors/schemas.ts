import { z } from 'zod'
import { normalizePhone } from '@/lib/phone'

export const doctorSchema = z.object({
  name: z.string().trim().min(1, 'Doctor name is required'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || normalizePhone(v) !== null, 'Enter a valid 10-digit mobile number'),
  email: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
      'Enter a valid email or leave it blank',
    ),
  division: z.string().trim(),
  qualification: z.string().trim(),
  speciality: z.string().trim(),
  area: z.string().trim(),
  hospital_name: z.string().trim(),
  pharmacy_name: z.string().trim(),
  hq: z.string().trim(),
  notes: z.string().trim().max(1000, 'Keep notes under 1000 characters'),
  manager_id: z.string(),
  is_active: z.boolean(),
})
export type DoctorForm = z.infer<typeof doctorSchema>
