import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { addDays } from '@/lib/time'

export type DayType = 'field' | 'meeting' | 'weekoff' | 'holiday' | 'leave'
export type CallKind = 'planned_met' | 'missed' | 'unplanned_met'
export type ActivityType = 'camp' | 'cme' | 'other'

export interface DailyLog {
  day: string
  day_type: DayType
  location_id: string | null
  tp_planned: string | null
  actual_work: string | null
  deviation: boolean
  reason: string | null
  prior_approval: boolean | null
  remarks: string | null
  chemist_calls: number
}

export interface DoctorCall {
  day: string
  location_id: string | null
  doctor_id: string | null
  doctor_name: string
  speciality: string | null
  place: string | null
  kind: CallKind
  activity_type: ActivityType | null
  activity_name: string | null
  amount: number
  status: 'planned' | 'done'
  discussion: string | null
  instructions: string | null
}

/** Typed-in figures for a month; null = use the calculated one. */
export const OVERRIDE_KEYS = [
  'working_days',
  'holidays',
  'leave_days',
  'days_worked',
  'meeting_days',
  'dr_calls',
  'ch_calls',
  'mcl_met',
  'missed_calls',
  'three_visit',
  'two_visit',
  'one_visit',
  'camps',
  'cmes',
] as const
export type OverrideKey = (typeof OVERRIDE_KEYS)[number]
export type MonthlyActivity = Record<OverrideKey, number | null> & {
  pob: number | null
  mcl_total: number | null
}

const LOG_COLS =
  'day, day_type, location_id, tp_planned, actual_work, deviation, reason, prior_approval, remarks, chemist_calls'
const CALL_COLS =
  'day, location_id, doctor_id, doctor_name, speciality, place, kind, activity_type, activity_name, amount, status, discussion, instructions'

const who = (managerId?: string) => managerId ?? 'me'

export const useDailyLogs = (opts: { managerId?: string; from: string; to: string }) =>
  useQuery({
    queryKey: ['daily-logs', who(opts.managerId), opts.from, opts.to],
    queryFn: async () => {
      let q = supabase.from('daily_logs').select(LOG_COLS).gte('day', opts.from).lte('day', opts.to)
      if (opts.managerId) q = q.eq('manager_id', opts.managerId)
      const { data, error } = await q.order('day')
      if (error) throw error
      return data as DailyLog[]
    },
  })

export const useDoctorCalls = (opts: { managerId?: string; from: string; to: string }) =>
  useQuery({
    queryKey: ['daily-calls', who(opts.managerId), opts.from, opts.to],
    queryFn: async () => {
      let q = supabase
        .from('daily_doctor_calls')
        .select(CALL_COLS)
        .gte('day', opts.from)
        .lte('day', opts.to)
      if (opts.managerId) q = q.eq('manager_id', opts.managerId)
      const { data, error } = await q.order('day').order('sort_order')
      if (error) throw error
      return (data as DoctorCall[]).map((c) => ({ ...c, amount: Number(c.amount) }))
    },
  })

export const useMonthlyActivity = (opts: { managerId?: string; month: string }) =>
  useQuery({
    queryKey: ['monthly-activity', who(opts.managerId), opts.month],
    queryFn: async () => {
      let q = supabase
        .from('monthly_activity')
        .select([...OVERRIDE_KEYS, 'pob', 'mcl_total'].join(', '))
        .eq('month', `${opts.month}-01`)
      if (opts.managerId) q = q.eq('manager_id', opts.managerId)
      const { data, error } = await q.maybeSingle()
      if (error) throw error
      const r = data as unknown as Record<string, number | string | null> | null
      return r
        ? (Object.fromEntries(
            Object.entries(r).map(([k, v]) => [k, v === null ? null : Number(v)]),
          ) as MonthlyActivity)
        : null
    },
  })

/** One transaction in Postgres (`save_day_entry`): the log plus the day's full list of doctors. */
export function useSaveDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      managerId?: string
      day: string
      log: Partial<DailyLog>
      calls: Partial<DoctorCall>[]
    }) => {
      const { error } = await supabase.rpc('save_day_entry', {
        p_manager: v.managerId ?? null,
        p_day: v.day,
        p_log: v.log,
        p_calls: v.calls,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['daily-logs'] })
      void qc.invalidateQueries({ queryKey: ['daily-calls'] })
    },
  })
}

export function useSaveMonthlyActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      managerId?: string
      month: string
      values: Record<string, string>
    }) => {
      const { error } = await supabase.rpc('save_monthly_activity', {
        p_manager: v.managerId ?? null,
        p_month: `${v.month}-01`,
        p_values: v.values,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['monthly-activity'] }),
  })
}

// ── calculations ──

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/** A deviation = both are filled in and they differ (e.g. planned "MDU/KARAI", actual "MDU"). Planned-only or actual-only is not one. */
export const isDeviation = (
  planned: string | null | undefined,
  actual: string | null | undefined,
) => !!norm(planned) && !!norm(actual) && norm(planned) !== norm(actual)

export interface Derived {
  working_days: number
  holidays: number
  leave_days: number
  days_worked: number
  meeting_days: number
  dr_calls: number
  ch_calls: number
  mcl_met: number
  missed_calls: number
  three_visit: number
  two_visit: number
  one_visit: number
  camps: number
  cmes: number
}

const daysIn = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/**
 * The month's figures worked out from the daily entries (optionally for one location).
 * Visits: doctors met 3+ times / exactly 2 / exactly once in the month. A camp or CME counts once per day and activity name.
 */
export function deriveActivity(
  logs: DailyLog[],
  calls: DoctorCall[],
  month: string,
  locationId?: string,
): Derived {
  const inMonth = (d: string) => d.startsWith(month)
  const ls = logs.filter((l) => inMonth(l.day) && (!locationId || l.location_id === locationId))
  const cs = calls.filter((c) => inMonth(c.day) && (!locationId || c.location_id === locationId))
  const count = (t: DayType) => ls.filter((l) => l.day_type === t).length
  const met = cs.filter((c) => c.kind !== 'missed')
  const perDoctor = new Map<string, number>()
  for (const c of met) {
    const k = c.doctor_id ?? norm(c.doctor_name)
    perDoctor.set(k, (perDoctor.get(k) ?? 0) + 1)
  }
  const visits = [...perDoctor.values()]
  const events = (t: ActivityType) =>
    new Set(cs.filter((c) => c.activity_type === t).map((c) => `${c.day}|${norm(c.activity_name)}`))
      .size
  return {
    working_days: daysIn(month) - count('weekoff') - count('holiday'),
    holidays: count('holiday'),
    leave_days: count('leave'),
    days_worked: count('field'),
    meeting_days: count('meeting'),
    dr_calls: met.length,
    ch_calls: ls.reduce((n, l) => n + l.chemist_calls, 0),
    mcl_met: perDoctor.size,
    missed_calls: cs.length - met.length,
    three_visit: visits.filter((n) => n >= 3).length,
    two_visit: visits.filter((n) => n === 2).length,
    one_visit: visits.filter((n) => n === 1).length,
    camps: events('camp'),
    cmes: events('cme'),
  }
}

export interface Effective extends Derived {
  dr_call_avg: number
  ch_call_avg: number
  coverage: number
}

/** A typed-in figure wins over the calculated one; averages and coverage are always worked out from the final numbers. */
export function effectiveActivity(
  derived: Derived,
  saved: MonthlyActivity | null,
  mclTotal = saved?.mcl_total ?? 0,
): Effective {
  const v = Object.fromEntries(
    OVERRIDE_KEYS.map((k) => [k, saved?.[k] ?? derived[k]]),
  ) as unknown as Derived
  const avg = (n: number) => (v.days_worked ? Math.round((n / v.days_worked) * 10) / 10 : 0)
  return {
    ...v,
    dr_call_avg: avg(v.dr_calls),
    ch_call_avg: avg(v.ch_calls),
    coverage: mclTotal ? Math.round((v.mcl_met / mclTotal) * 1000) / 10 : 0,
  }
}

/** Every date of a yyyy-mm month, oldest first. */
export function datesOf(month: string): string[] {
  return Array.from({ length: daysIn(month) }, (_, i) => addDays(`${month}-01`, i))
}

/** A manager's monthly figures for every month between two months, keyed by yyyy-mm (used by the appraisal). */
export const useMonthlyActivityRange = (opts: { managerId?: string; from: string; to: string }) =>
  useQuery({
    queryKey: ['monthly-activity-range', who(opts.managerId), opts.from, opts.to],
    enabled: !!opts.managerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_activity')
        .select(['month', ...OVERRIDE_KEYS, 'pob', 'mcl_total'].join(', '))
        .eq('manager_id', opts.managerId!)
        .gte('month', `${opts.from}-01`)
        .lte('month', `${opts.to}-01`)
      if (error) throw error
      const out: Record<string, MonthlyActivity> = {}
      for (const r of data as unknown as Record<string, number | string | null>[]) {
        const { month, ...rest } = r
        out[String(month).slice(0, 7)] = Object.fromEntries(
          Object.entries(rest).map(([k, v]) => [k, v === null ? null : Number(v)]),
        ) as MonthlyActivity
      }
      return out
    },
  })
