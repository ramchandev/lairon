import { z } from 'zod'

export const passwordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })

export const profileSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required'),
  area: z.string().trim().optional(),
  hq: z.string().trim().optional(),
  bio: z.string().trim().max(500, 'Keep it under 500 characters').optional(),
})
export type ProfileForm = z.infer<typeof profileSchema>
