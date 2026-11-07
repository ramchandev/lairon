import { z } from 'zod'

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim(),
  division_ids: z.array(z.string()),
  tag: z.enum(['', 'core', 'new']),
  pts: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d+(\.\d{1,2})?$/.test(v), 'Enter a price like 115.45'),
  kdp_group: z.string().trim(),
  is_active: z.boolean(),
})
export type ProductForm = z.infer<typeof productSchema>
