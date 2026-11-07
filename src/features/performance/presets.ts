import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Preset<C> {
  id: string
  name: string
  config: C
}

/** The signed-in person's own saved views of one report (RLS keeps everyone's apart). */
export const useReportPresets = <C>(report: string) =>
  useQuery({
    queryKey: ['report-presets', report],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_presets')
        .select('id, name, config')
        .eq('report', report)
        .order('name')
      if (error) throw error
      return data as Preset<C>[]
    },
  })

/** Saving under an existing name replaces that view. */
export function useSavePreset<C>(report: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, config, ownerId }: { name: string; config: C; ownerId: string }) => {
      const { error } = await supabase
        .from('report_presets')
        .upsert(
          { owner_id: ownerId, report, name: name.trim(), config },
          { onConflict: 'owner_id,report,name' },
        )
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['report-presets', report] }),
  })
}

export function useDeletePreset(report: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('report_presets').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['report-presets', report] }),
  })
}
