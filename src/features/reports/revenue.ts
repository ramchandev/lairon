import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { shiftMonth } from '@/lib/time'

export interface RevenueRow {
  doctor_id: string | null
  doctor_name: string
  manager_name: string | null
  /** yyyy-mm-01 */
  month: string
  amount: number
  services: number
}

/** One row per doctor and month in the period (admin only; computed in Postgres). */
export const useRevenueByDoctor = (from: string, to: string) =>
  useQuery({
    queryKey: ['report', 'revenue-by-doctor', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('revenue_by_doctor', {
        p_from: `${from}-01`,
        p_to: `${to}-01`,
      })
      if (error) throw error
      return (data as RevenueRow[]).map((r) => ({ ...r, amount: Number(r.amount) }))
    },
  })

export interface DoctorRevenue {
  key: string
  doctorId: string | null
  name: string
  manager: string | null
  total: number
  /** Most services in any single month. */
  services: number
  byMonth: Record<string, number>
}

export interface RevenueReport {
  months: string[]
  doctors: DoctorRevenue[]
  monthTotals: Record<string, number>
  total: number
}

/** Every month from..to inclusive (yyyy-mm), oldest first. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let m = from; m <= to && out.length < 60; m = shiftMonth(m, 1)) out.push(m)
  return out
}

/** Pivots the rows into one line per doctor (highest revenue first) with a column per month. */
export function buildReport(rows: RevenueRow[], from: string, to: string): RevenueReport {
  const months = monthRange(from, to)
  const by = new Map<string, DoctorRevenue>()
  const monthTotals: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]))
  for (const r of rows) {
    const m = r.month.slice(0, 7)
    const key = r.doctor_id ?? `name:${r.doctor_name}`
    const d =
      by.get(key) ??
      ({
        key,
        doctorId: r.doctor_id,
        name: r.doctor_name,
        manager: r.manager_name,
        total: 0,
        services: 0,
        byMonth: {},
      } satisfies DoctorRevenue)
    d.byMonth[m] = (d.byMonth[m] ?? 0) + r.amount
    d.total += r.amount
    d.services = Math.max(d.services, r.services)
    by.set(key, d)
    monthTotals[m] = (monthTotals[m] ?? 0) + r.amount
  }
  const doctors = [...by.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  return { months, doctors, monthTotals, total: doctors.reduce((n, d) => n + d.total, 0) }
}
