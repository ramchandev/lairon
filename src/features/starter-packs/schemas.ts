import { z } from 'zod'

export const packSchema = z.object({
  request_date: z.string().min(1, 'Date is required'),
  doctor_id: z.string(),
  doctor_name: z.string().trim().min(1, 'Doctor name is required'),
  qualification: z.string().trim().min(1, 'Qualification is required'),
  doctor_area: z.string().trim().min(1, 'Doctor area is required'),
  staff_id: z.string(),
  staff_name: z.string().trim().min(1, 'Staff name is required'),
  staff_area: z.string().trim().min(1, 'Staff area is required'),
  division: z.string().trim().min(1, 'Choose a division'),
  items: z
    .array(
      z.object({
        product_id: z.string(),
        product_name: z.string().trim().min(1, 'Choose or type a product'),
        quantity: z.string().trim().min(1, 'Enter a quantity'),
      }),
    )
    .min(1, 'Add at least one product'),
})
export type PackForm = z.infer<typeof packSchema>
export const emptyItem = { product_id: '', product_name: '', quantity: '' }
