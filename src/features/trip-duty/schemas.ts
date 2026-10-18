import { z } from 'zod'
import { diffDays } from '@/lib/time'

const isInt = (v: string) => /^\d{1,7}$/.test(v.trim())
const isNum = (v: string) => v.trim() === '' || /^\d{1,7}(\.\d{1,2})?$/.test(v.trim())
export const isFleet = (choice: string) => choice.startsWith('fleet:')

export const makeDutySchema = (relaxed = false) =>
  z
    .object({
      entry_date: z.string().min(1, 'Date is required'),
      duty_type: z.string().min(1, 'Choose the duty type'),
      vehicle: z.string().min(1, 'Choose a vehicle'),
      other_details: z.string().trim(),
      guest_name: z.string().trim().min(1, 'Guest name is required'),
      guest_area: z.string().trim(),
      pickup_point: z.string().trim(),
      drop_point: z.string().trim(),
      start_km: z.string().trim(),
      start_time: relaxed ? z.string() : z.string().min(1, 'Starting time is required'),
      end_date: z.string(),
      finished: z.boolean(),
      end_km: z.string().trim(),
      end_time: z.string(),
      fuel_litres: z.string().trim(),
      fuel_amount: z.string().trim(),
    })
    .superRefine((v, ctx) => {
      const add = (path: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message })
      const fleet = isFleet(v.vehicle)
      if (v.vehicle === 'other' && !v.other_details)
        add('other_details', 'Enter the vehicle details')
      if (fleet && !relaxed && !isInt(v.start_km))
        add('start_km', 'Starting KM is required for fleet vehicles')
      if (v.start_km && !isInt(v.start_km)) add('start_km', 'Enter whole kilometres')
      if (!isNum(v.fuel_litres)) add('fuel_litres', 'Enter litres, e.g. 12.5')
      if (!isNum(v.fuel_amount)) add('fuel_amount', 'Enter an amount')
      if (v.finished) {
        if (!v.end_time) add('end_time', 'Closing time is required')
        if (!v.end_date) {
          if (!relaxed) add('end_date', 'Trip end date is required')
        } else if (v.end_date < v.entry_date) add('end_date', 'The trip can’t end before it starts')
        else if (
          v.end_date === v.entry_date &&
          v.end_time &&
          v.start_time &&
          v.end_time < v.start_time
        )
          add(
            'end_time',
            'Closing time is before the start — set the trip end date to the next day',
          )
        if (fleet) {
          if (!isInt(v.end_km)) add('end_km', 'Ending KM is required for fleet vehicles')
          else if (isInt(v.start_km) && Number(v.end_km) < Number(v.start_km))
            add('end_km', 'Ending KM can’t be less than starting KM')
        }
      }
    })
/** Drivers must fill everything; admins editing imported rows may leave times/KM empty. */
export const dutySchema = makeDutySchema(false)
export const adminDutySchema = makeDutySchema(true)
export type DutyForm = z.infer<typeof dutySchema>

/** Close-duty form; KM is only required when the duty used a fleet vehicle. */
export const closeSchema = (
  fleet: boolean,
  startKm: number | null,
  start?: { date: string; time: string },
) =>
  z
    .object({
      end_km: z.string().trim(),
      end_time: z.string().min(1, 'Closing time is required'),
      end_date: z.string().min(1, 'Trip end date is required'),
      fuel_litres: z.string().trim(),
      fuel_amount: z.string().trim(),
    })
    .superRefine((v, ctx) => {
      const add = (path: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message })
      if (fleet && !isInt(v.end_km)) add('end_km', 'Ending KM is required for fleet vehicles')
      else if (fleet && startKm !== null && Number(v.end_km) < startKm)
        add('end_km', `Ending KM can’t be less than the starting ${startKm}`)
      if (start && v.end_date) {
        if (v.end_date < start.date) add('end_date', 'The trip can’t end before it starts')
        else if (
          v.end_date === start.date &&
          v.end_time &&
          start.time &&
          v.end_time < start.time.slice(0, 5)
        )
          add(
            'end_time',
            'Closing time is before the start — set the trip end date to the next day',
          )
      }
      if (!isNum(v.fuel_litres)) add('fuel_litres', 'Enter litres, e.g. 12.5')
      if (!isNum(v.fuel_amount)) add('fuel_amount', 'Enter an amount')
    })
export type CloseForm = z.infer<ReturnType<typeof closeSchema>>

export const MAX_LEAVE_DAYS = 31
export const leaveSchema = z
  .object({
    from: z.string().min(1, 'Choose the first day'),
    to: z.string().min(1, 'Choose the last day'),
    leave_type: z.string().min(1, 'Choose a leave type'),
    reason: z.string().trim().min(1, 'Please give a reason'),
  })
  .superRefine((v, ctx) => {
    if (v.from && v.to && v.to < v.from)
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'The last day can’t be before the first day',
      })
    else if (v.from && v.to && diffDays(v.from, v.to) + 1 > MAX_LEAVE_DAYS)
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: `Leave can be at most ${MAX_LEAVE_DAYS} days at a time`,
      })
  })
export type LeaveForm = z.infer<typeof leaveSchema>
