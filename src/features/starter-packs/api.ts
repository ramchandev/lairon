import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PackStatus } from './status'
import type { PackForm } from './schemas'

export interface PackItem {
  id: string
  request_id: string
  product_id: string | null
  product_name: string
  quantity: string
  sort_order: number
}
export interface Pack {
  id: string
  ref_no: string | null
  request_date: string
  doctor_id: string | null
  doctor_name: string
  qualification: string
  doctor_area: string
  staff_id: string | null
  staff_name: string
  staff_area: string
  division: string
  status: PackStatus
  fulfilled_at: string | null
  admin_note: string | null
  created_at: string
  items: PackItem[]
}

const KEY = ['packs']
const COLS = '*, items:starter_pack_items(*)'
const ordered = (p: Pack): Pack => ({
  ...p,
  items: [...p.items].sort((a, b) => a.sort_order - b.sort_order),
})

/** RLS: staff get their own, admin gets all. */
export const usePacks = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('starter_pack_requests')
        .select(COLS)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as Pack[]).map(ordered)
    },
  })

export const usePack = (id?: string) =>
  useQuery({
    queryKey: [...KEY, id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('starter_pack_requests')
        .select(COLS)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data ? ordered(data as unknown as Pack) : null
    },
  })

/** Header + items in one transaction (RPC), at least one product required. Returns the new id. */
export function useCreatePack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: PackForm) => {
      const { data, error } = await supabase.rpc('create_starter_pack', { payload: v })
      if (error) throw new Error(error.message)
      return data as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useSetPackStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: PackStatus; note?: string }) => {
      const patch: { status: PackStatus; admin_note?: string } = { status }
      if (note) patch.admin_note = note
      const { error } = await supabase.from('starter_pack_requests').update(patch).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
