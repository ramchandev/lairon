import { z } from 'zod'

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().trim(),
  division_ids: z.array(z.string()),
  is_active: z.boolean(),
})
export type ProductForm = z.infer<typeof productSchema>
