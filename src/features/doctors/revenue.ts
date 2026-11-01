import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { addDays, istParts, monthOf, shiftMonth } from '@/lib/time'

export interface RevenueRow {
  id: string
  service_id: string
  /** First day of the month (yyyy-mm-01). */
  month: string
  amount: number
  entered_by_name: string | null
  updated_at: string
}

const KEY = ['service-revenue']

/** Saved monthly revenue for these services (a manager only receives their own requests' rows; admins all). */
export const useServiceRevenue = (serviceIds: string[]) =>
  useQuery({
    queryKey: [...KEY, [...serviceIds].sort().join(',')],
    enabled: serviceIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_revenue')
        .select('id, service_id, month, amount, entered_by_name, updated_at')
        .in('service_id', serviceIds)
        .order('month', { ascending: false })
      if (error) throw error
      return (data as RevenueRow[]).map((r) => ({ ...r, amount: Number(r.amount) }))
    },
  })

/** One transaction in Postgres (`set_service_revenue`), which also enforces who may enter it and the month freeze. */
export function useSetServiceRevenue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { serviceId: string; month: string; amount: number }) => {
      const { error } = await supabase.rpc('set_service_revenue', {
        p_service: v.serviceId,
        p_month: `${v.month}-01`,
        p_amount: v.amount,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY })
      void qc.invalidateQueries({ queryKey: ['doctor-revenue-summary'] })
    },
  })
}

export interface DoctorRevenueMonth {
  month: string
  amount: number
  services: number
}
/** A doctor's revenue by month: the sum over all of the doctor's services. */
export const useDoctorRevenueSummary = (doctorId?: string) =>
  useQuery({
    queryKey: ['doctor-revenue-summary', doctorId],
    enabled: !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('doctor_revenue_summary', { p_doctor: doctorId! })
      if (error) throw error
      return (data as DoctorRevenueMonth[]).map((r) => ({ ...r, amount: Number(r.amount) }))
    },
  })

/** Months a service can carry revenue for: from the month it started up to the current month, newest first. */
export function revenueMonths(serviceDate: string): string[] {
  const now = monthOf(istParts().date)
  const out: string[] = []
  for (let m = now; m >= serviceDate.slice(0, 7) && out.length < 60; m = shiftMonth(m, -1))
    out.push(m)
  return out
}

export const currentMonthKey = () => monthOf(istParts().date)

/**
 * Same rule as the database: an admin can always change it. A manager can change the current or a future month; a month
 * that has ended is frozen once it has an entry (a month with no entry yet can still be filled in once).
 */
export function revenueLocked(role: string | undefined, month: string, hasEntry: boolean): boolean {
  if (role === 'admin') return false
  return month < currentMonthKey() && hasEntry
}

/** Last day of a yyyy-mm month, as yyyy-mm-dd. */
export const lastDayOf = (month: string) => addDays(`${monthPlus(month)}-01`, -1)
function monthPlus(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

/** Valid amount text ("1,25,000" or "12500.50") -> number, else null. */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[,\s₹]/g, '')
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(t)) return null
  return Number(t)
}
