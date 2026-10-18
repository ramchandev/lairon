import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AppSettings {
  company_name: string
  driver_edit_window_days: number
}
export const DEFAULT_SETTINGS: AppSettings = { company_name: 'LAIRON', driver_edit_window_days: 7 }
const KEY = ['app-settings', 'all']

export const useAppSettings = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['company_name', 'driver_edit_window_days'])
      if (error) throw error
      const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
      return {
        company_name:
          typeof m.company_name === 'string' && m.company_name.trim()
            ? m.company_name
            : DEFAULT_SETTINGS.company_name,
        driver_edit_window_days:
          Number(m.driver_edit_window_days) || DEFAULT_SETTINGS.driver_edit_window_days,
      }
    },
  })

export function useSaveSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: { key: keyof AppSettings; value: string | number }) => {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: s.key, value: s.value, updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['duty', 'window'] })
    },
  })
}

/** Company name for PDF headers. Never throws: a failed lookup just means "LAIRON". */
export async function fetchCompanyName(): Promise<string> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'company_name')
      .maybeSingle()
    return typeof data?.value === 'string' && data.value.trim()
      ? data.value
      : DEFAULT_SETTINGS.company_name
  } catch {
    return DEFAULT_SETTINGS.company_name
  }
}
