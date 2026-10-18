import { z } from 'zod'

export const divisionSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim(),
  sort_order: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{1,4}$/.test(v), 'Use a whole number'),
  is_active: z.boolean(),
})
export type DivisionForm = z.infer<typeof divisionSchema>
