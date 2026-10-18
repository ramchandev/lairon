import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/AuthProvider'
import { supabase } from '@/lib/supabase'
import { addDays } from '@/lib/time'
import type { DayEntry } from './logic'
import { dutyToRow } from './rows'
import type { DutyForm } from './schemas'

// All keys start with 'duty' so the driver-side mutations' invalidation also refreshes admin views.
const KEY = ['duty', 'admin']
const nextMonthStart = (month: string) => addDays(`${month}-01`, 32).slice(0, 7) + '-01'

/** Admin: entries for a month, optionally for one driver (RLS gives admin everything). */
export const useAdminEntries = (month: string, driverId?: string | null) =>
  useQuery({
    queryKey: [...KEY, 'entries', month, driverId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('driver_day_entries')
        .select('*')
        .gte('entry_date', `${month}-01`)
        .lt('entry_date', nextMonthStart(month))
        .order('entry_date')
        .order('start_time', { nullsFirst: true })
      if (driverId) q = q.eq('driver_id', driverId)
      const { data, error } = await q
      if (error) throw error
      return data as DayEntry[]
    },
  })

export const usePendingLeaves = () =>
  useQuery({
    queryKey: [...KEY, 'pending-leaves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_day_entries')
        .select('*')
        .eq('entry_type', 'leave')
        .eq('leave_status', 'pending')
        .order('driver_name')
        .order('entry_date')
      if (error) throw error
      return data as DayEntry[]
    },
  })

function useDone() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['duty'] })
}

export function useDecideLeave() {
  const done = useDone()
  return useMutation({
    mutationFn: async ({
      ids,
      status,
      note,
    }: {
      ids: string[]
      status: 'approved' | 'rejected'
      note?: string
    }) => {
      const { error } = await supabase.rpc('decide_leave', {
        p_ids: ids,
        p_status: status,
        p_note: note ?? null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: done,
  })
}

/** Admin add/edit of a single duty. entry_source is left as-is on edit so imported rows stay marked as imported. */
export function useAdminSaveDuty(opts: { id?: string; driverId?: string }) {
  const done = useDone()
  return useMutation({
    mutationFn: async ({
      v,
      vehicles,
    }: {
      v: DutyForm
      vehicles: { id: string; name: string; vehicle_number: string }[]
    }) => {
      const { entry_source, ...row } = dutyToRow(v, vehicles)
      const { error } = await (opts.id
        ? supabase.from('driver_day_entries').update(row).eq('id', opts.id)
        : supabase
            .from('driver_day_entries')
            .insert({ ...row, entry_source, driver_id: opts.driverId }))
      if (error) throw new Error(error.message)
    },
    onSuccess: done,
  })
}

export function useAdminDeleteEntry() {
  const done = useDone()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('driver_day_entries').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: done,
  })
}

// ───────────── Chauffeur beta ─────────────
export interface BetaSummaryRow {
  driver_id: string
  driver_name: string
  local_days: number
  outstation_days: number
  payable_days: number
  local_amount: number
  outstation_amount: number
  total_amount: number
}
export interface BetaDay {
  entry_date: string
  duties_logged: number
  day_type: 'Local' | 'Outstation'
  beta: number
}
export interface BetaRate {
  id: string
  effective_from: string
  local_rate: number
  outstation_rate: number
  note: string | null
  created_at: string
}
export interface BetaMonth {
  month: string
  status: 'draft' | 'finalised'
  finalised_at: string | null
  reopened_at: string | null
  reopen_reason: string | null
}

const num = (r: BetaSummaryRow): BetaSummaryRow => ({
  ...r,
  local_amount: Number(r.local_amount),
  outstation_amount: Number(r.outstation_amount),
  total_amount: Number(r.total_amount),
})

/** The single source of truth for beta (screen, CSV, PDF, finalisation): the Postgres function. Never recompute in the browser. */
export const useBetaSummary = (month: string, driverId?: string | null) =>
  useQuery({
    queryKey: [...KEY, 'beta', month, driverId ?? 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('beta_summary', {
        p_month: `${month}-01`,
        p_driver: driverId ?? null,
      })
      if (error) throw error
      return (data as BetaSummaryRow[]).map(num)
    },
  })

export const useBetaDays = (month: string, driverId?: string | null) =>
  useQuery({
    queryKey: [...KEY, 'beta-days', month, driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('beta_days', {
        p_month: `${month}-01`,
        p_driver: driverId!,
      })
      if (error) throw error
      return (data as BetaDay[]).map((d) => ({ ...d, beta: Number(d.beta) }))
    },
  })

export const useBetaMonth = (month: string) =>
  useQuery({
    queryKey: [...KEY, 'beta-month', month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beta_months')
        .select('*')
        .eq('month', `${month}-01`)
        .maybeSingle()
      if (error) throw error
      return data as BetaMonth | null
    },
  })

export const useBetaRates = () =>
  useQuery({
    queryKey: [...KEY, 'rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beta_rates')
        .select('*')
        .order('effective_from', { ascending: false })
      if (error) throw error
      return (data as BetaRate[]).map((r) => ({
        ...r,
        local_rate: Number(r.local_rate),
        outstation_rate: Number(r.outstation_rate),
      }))
    },
  })

/** Rates are never edited in place: a change is a new row with a later effective date. */
export function useAddRate() {
  const { profile } = useAuth()
  const done = useDone()
  return useMutation({
    mutationFn: async (v: {
      effective_from: string
      local_rate: number
      outstation_rate: number
      note?: string
    }) => {
      const { error } = await supabase
        .from('beta_rates')
        .insert({ ...v, note: v.note?.trim() || null, created_by: profile?.id })
      if (error) {
        if (error.code === '23505')
          throw new Error('A rate already starts on that date. Choose a different effective date.')
        throw new Error(error.message)
      }
    },
    onSuccess: done,
  })
}

export function useFinaliseMonth() {
  const done = useDone()
  return useMutation({
    mutationFn: async (month: string) => {
      const { error } = await supabase.rpc('finalise_beta_month', { p_month: `${month}-01` })
      if (error) throw new Error(error.message)
    },
    onSuccess: done,
  })
}

export function useReopenMonth() {
  const done = useDone()
  return useMutation({
    mutationFn: async ({ month, reason }: { month: string; reason: string }) => {
      const { error } = await supabase.rpc('reopen_beta_month', {
        p_month: `${month}-01`,
        p_reason: reason,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: done,
  })
}
