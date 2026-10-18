import { z } from 'zod'
import { isNetrate, isOffer, parseAmount } from './helpers'

export { isNetrate, isOffer, parseAmount }

const amount = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v !== '', `${label} is required`)
    .refine((v) => v === '' || parseAmount(v) >= 0, 'Enter a valid amount')

export const serviceSchema = z
  .object({
    request_date: z.string().min(1, 'Date is required'),
    doctor_id: z.string(),
    doctor_name: z.string().trim().min(1, 'Doctor name is required'),
    save_as_doctor: z.boolean(),
    area: z.string().trim().min(1, 'Area is required'),
    hospital_name: z.string().trim().min(1, 'Hospital name is required'),
    pharmacy_name: z.string().trim(),
    hq: z.string().trim().min(1, 'HQ is required'),
    division: z.string().trim().min(1, 'Division is required'),
    qualification: z.string().trim().min(1, 'Qualification is required'),
    speciality: z.string().trim().min(1, 'Speciality is required'),
    service_amount: amount('Service amount'),
    service_type: z.string().trim().min(1, 'Service type is required'),
    expected_business_value: amount('Expected business value'),
    current_business_value: amount('Current business value'),
    offer_type: z.string().trim().min(1, 'Choose Offer or Netrate'),
    offer_percent: z.string().trim(),
    netrate_amount: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (isOffer(v.offer_type)) {
      const n = parseAmount(v.offer_percent)
      if (Number.isNaN(n))
        ctx.addIssue({ code: 'custom', path: ['offer_percent'], message: 'Offer % is required' })
      else if (n < 0 || n > 100)
        ctx.addIssue({
          code: 'custom',
          path: ['offer_percent'],
          message: 'Offer % must be between 0 and 100',
        })
    }
    if (isNetrate(v.offer_type) && !(parseAmount(v.netrate_amount) >= 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['netrate_amount'],
        message: 'Netrate amount is required',
      })
    }
  })
export type ServiceForm = z.infer<typeof serviceSchema>
