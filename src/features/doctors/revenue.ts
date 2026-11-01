import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { addDays, istParts, monthOf } from '@/lib/time'

export interface RevenueRow {
  id: string
  doctor_id: string
  /** First day of the month (yyyy-mm-01). */
  month: string
  amount: number
  entered_by_name: string | null
  updated_at: string
}

const KEY = ['doctor-revenue']

/** Every saved month for one doctor, newest first. Only admins and managers can read it. */
export const useDoctorRevenue = (doctorId?: string) =>
  useQuery({
    queryKey: [...KEY, doctorId],
    enabled: !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_revenue')
        .select('id, doctor_id, month, amount, entered_by_name, updated_at')
        .eq('doctor_id', doctorId!)
        .order('month', { ascending: false })
      if (error) throw error
      return (data as RevenueRow[]).map((r) => ({ ...r, amount: Number(r.amount) }))
    },
  })

/** One transaction in Postgres (`set_doctor_revenue`), which also enforces the month freeze. */
export function useSetRevenue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { doctorId: string; month: string; amount: number }) => {
      const { error } = await supabase.rpc('set_doctor_revenue', {
        p_doctor: v.doctorId,
        p_month: `${v.month}-01`,
        p_amount: v.amount,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
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
