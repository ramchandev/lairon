import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { toPayload } from './plan'

export interface ImportBatch {
  id: string
  file_name: string | null
  driver_id: string | null
  driver_name: string | null
  month: string
  rows_read: number
  duties: number
  week_offs: number
  leaves: number
  mode: 'replace' | 'fill'
  replaced_count: number
  created_at: string
  undone_at: string | null
}

export const useImportBatches = () =>
  useQuery({
    queryKey: ['duty', 'import-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('duty_import_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15)
      if (error) throw error
      return data as ImportBatch[]
    },
  })

/** One transaction in Postgres (`import_duties`), which validates everything again. */
export function useRunImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (batch: ReturnType<typeof toPayload>) => {
      const { data, error } = await supabase.rpc('import_duties', { batch })
      if (error) throw new Error(error.message)
      return data as {
        batch_id: string
        rows_read: number
        duties: number
        week_offs: number
        leaves: number
        replaced: number
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duty'] }),
  })
}

/** Removes only the entries that import created; hand-entered entries stay. */
export function useUndoImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase.rpc('undo_duty_import', { p_batch: batchId })
      if (error) throw new Error(error.message)
      return data as number
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duty'] }),
  })
}
