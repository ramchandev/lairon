import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/AuthProvider'
import { supabase } from '@/lib/supabase'
import { addDays } from '@/lib/time'
import { dateRange, type DayEntry } from './logic'
import { dutyToRow } from './rows'
import type { CloseForm, DutyForm, LeaveForm } from './schemas'

const KEY = ['duty']
type Veh = { id: string; name: string; vehicle_number: string }

/** RLS scopes every query here to the signed-in driver. */
export const useMonthEntries = (month: string) =>
  useQuery({
    queryKey: [...KEY, 'month', month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_day_entries')
        .select('*')
        .gte('entry_date', `${month}-01`)
        .lt('entry_date', addDays(`${month}-01`, 32).slice(0, 7) + '-01')
        .order('entry_date')
        .order('start_time', { nullsFirst: true })
      if (error) throw error
      return data as DayEntry[]
    },
  })

export const useOpenDuties = () =>
  useQuery({
    queryKey: [...KEY, 'open'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_day_entries')
        .select('*')
        .eq('entry_type', 'duty')
        .eq('duty_status', 'open')
        .order('entry_date')
      if (error) throw error
      return data as DayEntry[]
    },
  })

export const useLeaves = () =>
  useQuery({
    queryKey: [...KEY, 'leaves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_day_entries')
        .select('*')
        .eq('entry_type', 'leave')
        .order('entry_date', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as DayEntry[]
    },
  })

export const useEntry = (id?: string) =>
  useQuery({
    queryKey: [...KEY, 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_day_entries')
        .select('*')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as DayEntry | null
    },
  })

/** Days a driver can still add/edit (admin setting, default 7). */
export const useEditWindow = () =>
  useQuery({
    queryKey: [...KEY, 'window'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('driver_edit_window_days')
      if (error) return 7
      return Number(data) || 7
    },
  })

/** Last closing KM on this vehicle by any driver, for the "lower than last time" warning. */
export const useLastKm = (vehicleId?: string) =>
  useQuery({
    queryKey: [...KEY, 'lastkm', vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('last_vehicle_km', { p_vehicle: vehicleId! })
      if (error) throw error
      return (data as number | null) ?? null
    },
  })

export interface BetaRow {
  local_days: number
  outstation_days: number
  payable_days: number
  total_amount: number
}
/** Beta so far this month, from the same Postgres function admin uses (drivers only ever get their own row). */
export const useMyBeta = (month: string) =>
  useQuery({
    queryKey: [...KEY, 'beta', month],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('beta_summary', { p_month: `${month}-01` })
      if (error) throw error
      return ((data as BetaRow[])[0] ?? null) as BetaRow | null
    },
  })

function useDone() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: KEY })
}

const friendly = (m: string) =>
  /row-level security/i.test(m) ? 'You can only add or change entries from the last few days.' : m

export function useSaveDuty(id?: string) {
  const { profile } = useAuth()
  const done = useDone()
  return useMutation({
    mutationFn: async ({ v, vehicles }: { v: DutyForm; vehicles: Veh[] }) => {
      const row = dutyToRow(v, vehicles)
      const { error } = await (id
        ? supabase.from('driver_day_entries').update(row).eq('id', id)
        : supabase.from('driver_day_entries').insert({ ...row, driver_id: profile!.id }))
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: done,
  })
}

export function useCloseDuty(id: string) {
  const done = useDone()
  return useMutation({
    mutationFn: async (v: CloseForm & { fleet: boolean }) => {
      const { error } = await supabase
        .from('driver_day_entries')
        .update({
          end_km: v.fleet && v.end_km ? Number(v.end_km) : null,
          end_time: v.end_time,
          end_date: v.end_date,
          fuel_litres: v.fuel_litres ? Number(v.fuel_litres) : null,
          fuel_amount: v.fuel_amount ? Number(v.fuel_amount) : null,
          duty_status: 'closed',
          total_km: null,
          total_minutes: null,
        })
        .eq('id', id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: done,
  })
}

export function useAddWeekOff() {
  const { profile } = useAuth()
  const done = useDone()
  return useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase.from('driver_day_entries').insert({
        driver_id: profile!.id,
        entry_date: date,
        entry_type: 'week_off',
        entry_source: 'app',
      })
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: done,
  })
}

/** One row per day, inserted in a single statement: if any day conflicts, none are saved. */
export function useApplyLeave() {
  const { profile } = useAuth()
  const done = useDone()
  return useMutation({
    mutationFn: async (v: LeaveForm) => {
      const rows = dateRange(v.from, v.to).map((entry_date) => ({
        driver_id: profile!.id,
        entry_date,
        entry_type: 'leave',
        leave_type: v.leave_type,
        leave_reason: v.reason.trim(),
        entry_source: 'app',
      }))
      const { error } = await supabase.from('driver_day_entries').insert(rows)
      if (error) throw new Error(friendly(error.message))
      return rows.length
    },
    onSuccess: done,
  })
}

export function useDeleteEntries() {
  const done = useDone()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('driver_day_entries').delete().in('id', ids)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: done,
  })
}
