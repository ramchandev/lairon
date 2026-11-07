import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { shiftMonth } from '@/lib/time'

/** ROI is achieved when a doctor's cumulative return reaches this many times the cumulative service amount. */
export const ROI_TARGET = 4

export interface RoiService {
  id: string
  doctor_id: string | null
  doctor_name: string
  speciality: string
  location_id: string | null
  manager_id: string | null
  amount: number
  /** yyyy-mm of the request date */
  month: string
}
export interface RoiRevenue {
  service_id: string
  /** yyyy-mm */
  month: string
  amount: number
}

/** Services (submitted, approved or fulfilled) with their handling manager, and every month's revenue recorded on them. */
export const useRoiData = () =>
  useQuery({
    queryKey: ['roi-data'],
    queryFn: async () => {
      const [s, r] = await Promise.all([
        supabase
          .from('service_requests')
          .select(
            'id, doctor_id, doctor_name, speciality, service_amount, request_date, batch:batch_id(manager_id, status), doctor:doctor_id(location_id)',
          ),
        supabase.from('service_revenue').select('service_id, month, amount'),
      ])
      if (s.error) throw s.error
      if (r.error) throw r.error
      type Raw = {
        id: string
        doctor_id: string | null
        doctor_name: string
        speciality: string
        service_amount: number | string
        request_date: string
        batch: { manager_id: string | null; status: string } | null
        doctor: { location_id: string | null } | null
      }
      const services: RoiService[] = (s.data as unknown as Raw[])
        .filter((x) => x.batch && ['submitted', 'approved', 'fulfilled'].includes(x.batch.status))
        .map((x) => ({
          id: x.id,
          doctor_id: x.doctor_id,
          doctor_name: x.doctor_name,
          speciality: x.speciality,
          location_id: x.doctor?.location_id ?? null,
          manager_id: x.batch!.manager_id,
          amount: Number(x.service_amount),
          month: x.request_date.slice(0, 7),
        }))
      const revenue: RoiRevenue[] = (
        r.data as { service_id: string; month: string; amount: number | string }[]
      ).map((x) => ({
        service_id: x.service_id,
        month: x.month.slice(0, 7),
        amount: Number(x.amount),
      }))
      return { services, revenue }
    },
  })

export interface RoiDoctor {
  key: string
  name: string
  speciality: string
  locationId: string | null
  /** Cumulative service amount up to the chosen month */
  serviceAmount: number
  /** Return recorded in each month of the financial year (up to the chosen month) */
  byMonth: Record<string, number>
  /** Cumulative return up to the chosen month */
  totalReturn: number
  /** totalReturn ÷ serviceAmount (0 when nothing was spent) */
  roi: number
  achieved: boolean
}
export interface RoiReport {
  months: string[]
  doctors: RoiDoctor[]
  /** Doctors at the target as of the end of each month of the year */
  achievedByMonth: Record<string, number>
  achieved: number
  totals: { serviceAmount: number; totalReturn: number; roi: number }
}

/** The twelve months of a financial year starting at `from` (yyyy-mm). */
export const fyMonths = (from: string) => Array.from({ length: 12 }, (_, i) => shiftMonth(from, i))

/**
 * ROI by doctor, credited to the manager who handles the request. For any month the figure is cumulative:
 * everything returned up to then ÷ everything spent up to then, so it works monthly, quarterly or for the year.
 */
export function buildRoi(
  services: RoiService[],
  revenue: RoiRevenue[],
  o: { fyFrom: string; asOf: string; managerId?: string; locationIds?: string[] },
): RoiReport {
  const months = fyMonths(o.fyFrom)
  const mine = services.filter(
    (s) =>
      (!o.managerId || s.manager_id === o.managerId) &&
      (!o.locationIds?.length || (s.location_id !== null && o.locationIds.includes(s.location_id))),
  )
  const svc = new Map(mine.map((s) => [s.id, s]))
  const keyOf = (s: RoiService) => s.doctor_id ?? `name:${s.doctor_name.trim().toLowerCase()}`
  const returns = revenue.filter((r) => svc.has(r.service_id))

  const at = (end: string) => {
    const per = new Map<string, { amount: number; ret: number }>()
    for (const s of mine) {
      if (s.month > end) continue
      const e = per.get(keyOf(s)) ?? { amount: 0, ret: 0 }
      e.amount += s.amount
      per.set(keyOf(s), e)
    }
    for (const r of returns) {
      if (r.month > end) continue
      const e = per.get(keyOf(svc.get(r.service_id)!))
      if (e) e.ret += r.amount
    }
    return per
  }
  const hit = (v: { amount: number; ret: number }) => v.amount > 0 && v.ret >= ROI_TARGET * v.amount

  const achievedByMonth = Object.fromEntries(
    months.map((m) => [m, [...at(m).values()].filter(hit).length]),
  )
  const cum = at(o.asOf)
  const info = new Map(mine.map((s) => [keyOf(s), s]))
  const doctors: RoiDoctor[] = [...cum.entries()].map(([key, v]) => {
    const s = info.get(key)!
    const byMonth: Record<string, number> = {}
    for (const r of returns) {
      if (keyOf(svc.get(r.service_id)!) !== key || r.month > o.asOf || !months.includes(r.month))
        continue
      byMonth[r.month] = (byMonth[r.month] ?? 0) + r.amount
    }
    return {
      key,
      name: s.doctor_name,
      speciality: s.speciality,
      locationId: s.location_id,
      serviceAmount: v.amount,
      byMonth,
      totalReturn: v.ret,
      roi: v.amount ? v.ret / v.amount : 0,
      achieved: hit(v),
    }
  })
  doctors.sort((a, b) => b.roi - a.roi || a.name.localeCompare(b.name))
  const serviceAmount = doctors.reduce((n, d) => n + d.serviceAmount, 0)
  const totalReturn = doctors.reduce((n, d) => n + d.totalReturn, 0)
  return {
    months,
    doctors,
    achievedByMonth,
    achieved: doctors.filter((d) => d.achieved).length,
    totals: { serviceAmount, totalReturn, roi: serviceAmount ? totalReturn / serviceAmount : 0 },
  }
}
