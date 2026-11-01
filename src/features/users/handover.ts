import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Workload {
  doctors: number
  requests: number
  open_requests: number
  drafts: number
}

/** What a manager currently holds (admin only). */
export const useManagerWorkload = (managerId?: string) =>
  useQuery({
    queryKey: ['workload', managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('manager_workload', { p_manager: managerId! })
      if (error) throw error
      return data as Workload
    },
  })

const refresh = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all(
    ['batches', 'handovers', 'workload', 'doctors', 'service-revenue'].map((k) =>
      qc.invalidateQueries({ queryKey: [k] }),
    ),
  )

/** Move ONE request to another manager (its history, revenue and accountability follow). */
export function useReassignRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { batchId: string; toId: string; note: string }) => {
      const { error } = await supabase.rpc('reassign_request', {
        p_batch: v.batchId,
        p_to: v.toId,
        p_note: v.note || null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => refresh(qc),
  })
}

/** Hand over everything a manager holds (doctors + requests) to another manager. */
export function useTransferWork() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { fromId: string; toId: string; note: string }) => {
      const { data, error } = await supabase.rpc('transfer_manager_work', {
        p_from: v.fromId,
        p_to: v.toId,
        p_note: v.note || null,
      })
      if (error) throw new Error(error.message)
      return data as { doctors: number; requests: number; drafts_left: number }
    },
    onSuccess: () => refresh(qc),
  })
}
