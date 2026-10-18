import { z } from 'zod'
import { normalizeVehicleNumber } from '@/lib/format'

const maxYear = new Date().getFullYear() + 1

export const vehicleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  vehicle_number: z
    .string()
    .trim()
    .min(1, 'Vehicle number is required')
    .refine(
      (v) => /^[A-Z0-9]{6,12}$/.test(normalizeVehicleNumber(v)),
      'Enter a valid number, e.g. TN09AB6435',
    ),
  color: z.string().trim(),
  make: z.string().trim(),
  model: z.string().trim(),
  year: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (/^\d{4}$/.test(v) && +v >= 1990 && +v <= maxYear),
      `Year must be between 1990 and ${maxYear}`,
    ),
  is_active: z.boolean(),
})
export type VehicleForm = z.infer<typeof vehicleSchema>
