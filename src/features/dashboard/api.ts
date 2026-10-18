import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { buildFeed, type ActivityRow, type FeedItem } from './activity'

export interface Dashboard {
  month: string
  pending_service_requests: number
  pending_starter_packs: number
  drivers_on_duty_now: number
  drivers_with_duty_today: number
  pending_leave_requests: number
  pending_leave_days: number
  beta_total: number
  beta_payable_days: number
  total_km: number
  fuel_amount: number
  fuel_litres: number
  drivers_total: number
  /** Last six months of submitted service-request value (₹), oldest first. */
  sr_value_by_month: { m: string; v: number }[]
  attention_total: number
  attention: AttentionItem[]
  drivers_today: DriverToday[]
}

export interface AttentionItem {
  kind: 'request' | 'pack' | 'leave'
  id: string
  title: string
  sub: string
  status: string
  at: string
}

export interface DriverToday {
  id: string
  name: string
  avatar_url: string | null
  state: 'duty' | 'week_off' | 'leave' | 'none'
  duty_type: string | null
  vehicle: string | null
  pickup: string | null
  drop: string | null
}

/** All KPI numbers in one round trip (admin_dashboard() in Postgres). */
export const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_dashboard')
      if (error) throw error
      const d = data as Record<string, unknown>
      // Postgres numerics can arrive as strings; lists and the month label pass through untouched.
      const out = Object.fromEntries(
        Object.entries(d).map(([k, v]) => [
          k,
          typeof v === 'string' && k !== 'month' ? Number(v) : v,
        ]),
      ) as unknown as Dashboard
      // Older databases (before migration 13) lack the list blocks; show empty ones instead of crashing.
      return {
        ...out,
        drivers_total: out.drivers_total ?? 0,
        attention_total: out.attention_total ?? 0,
        attention: out.attention ?? [],
        drivers_today: out.drivers_today ?? [],
        sr_value_by_month: out.sr_value_by_month ?? [],
      }
    },
  })

export const useActivity = () =>
  useQuery({
    queryKey: ['activity'],
    refetchInterval: 60_000,
    queryFn: async (): Promise<FeedItem[]> => {
      const { data, error } = await supabase
        .from('activity_log')
        .select('id, actor_id, entity, entity_id, action, diff, created_at')
        .order('created_at', { ascending: false })
        .limit(150)
      if (error) throw error
      const rows = data as ActivityRow[]
      const ids = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x))]
      const actors: Record<string, string> = {}
      if (ids.length) {
        const { data: people } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ids)
        for (const p of people ?? []) actors[p.id] = p.full_name
      }
      return buildFeed(rows, actors, 12)
    },
  })
