import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface LookupList {
  key: string
  label: string
  icon: string | null
  allow_other: boolean
  is_system: boolean
  sort_order: number
}
export interface LookupItem {
  id: string
  list_key: string
  value: string
  sort_order: number
  is_active: boolean
}
export interface MapPair {
  id: string
  division_id: string
  qualification_item_id: string
  speciality_item_id: string
}

const LISTS = ['lookup-lists']
const ITEMS = ['lookup-items-all']
const MAP = ['lookup-map']

function refresh(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: LISTS })
  qc.invalidateQueries({ queryKey: ITEMS })
  qc.invalidateQueries({ queryKey: MAP })
  qc.invalidateQueries({ queryKey: ['lookup'] }) // useLookup() caches used by forms
}

const dup = (e: { code?: string; message: string }, what: string) =>
  new Error(e.code === '23505' ? `${what} already exists.` : e.message)

export const useLookupLists = () =>
  useQuery({
    queryKey: LISTS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lookup_lists')
        .select('*')
        .order('sort_order')
        .order('label')
      if (error) throw error
      return data as LookupList[]
    },
  })

/** Every item, active or not (admin only). Small tables, so one query serves all tabs. */
export const useAllLookupItems = () =>
  useQuery({
    queryKey: ITEMS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lookup_items')
        .select('*')
        .order('sort_order')
        .order('value')
      if (error) throw error
      return data as LookupItem[]
    },
  })

export function useSaveList(existingKey?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { key?: string; label: string; allow_other: boolean }) => {
      if (existingKey) {
        const { error } = await supabase
          .from('lookup_lists')
          .update({ label: v.label, allow_other: v.allow_other })
          .eq('key', existingKey)
        if (error) throw error
      } else {
        const { error } = await supabase.from('lookup_lists').insert({
          key: v.key,
          label: v.label,
          allow_other: v.allow_other,
          icon: 'list',
          sort_order: 100,
        })
        if (error) throw dup(error, 'A dropdown list with this name')
      }
    },
    onSuccess: () => refresh(qc),
  })
}

export function useDeleteList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase
        .from('lookup_lists')
        .delete()
        .eq('key', key)
        .eq('is_system', false)
      if (error) throw error
    },
    onSuccess: () => refresh(qc),
  })
}

export function useSaveItem(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      list_key: string
      value: string
      is_active: boolean
      sort_order?: number
    }) => {
      const row = { value: v.value.trim(), is_active: v.is_active }
      const { error } = await (id
        ? supabase.from('lookup_items').update(row).eq('id', id)
        : supabase
            .from('lookup_items')
            .insert({ ...row, list_key: v.list_key, sort_order: v.sort_order ?? 0 }))
      if (error) throw dup(error, 'This item')
    },
    onSuccess: () => refresh(qc),
  })
}

export function useToggleItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('lookup_items').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refresh(qc),
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Records store plain text, never this id, so history is untouched. Mapping rows cascade.
      const { error } = await supabase.from('lookup_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refresh(qc),
  })
}

export function useReorderItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const results = await Promise.all(
        orderedIds.map((id, i) =>
          supabase
            .from('lookup_items')
            .update({ sort_order: i + 1 })
            .eq('id', id),
        ),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onSuccess: () => refresh(qc),
  })
}

// ── Division ↔ qualification ↔ speciality mapping ──
export const useMapPairs = (divisionId: string | null) =>
  useQuery({
    queryKey: [...MAP, divisionId],
    enabled: !!divisionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('division_qual_spec_map')
        .select('*')
        .eq('division_id', divisionId!)
      if (error) throw error
      return data as MapPair[]
    },
  })

export function useAddPair() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      division_id: string
      qualification_item_id: string
      speciality_item_id: string
    }) => {
      const { error } = await supabase.from('division_qual_spec_map').insert(v)
      if (error) throw dup(error, 'This pair')
    },
    onSuccess: () => refresh(qc),
  })
}

export function useRemovePair() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('division_qual_spec_map').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => refresh(qc),
  })
}

/** Adds every pair of `from` to `to` (existing pairs are kept). */
export function useCopyMapping() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const { data, error } = await supabase
        .from('division_qual_spec_map')
        .select('qualification_item_id, speciality_item_id')
        .eq('division_id', from)
      if (error) throw error
      if (!data.length) return 0
      const { error: e2 } = await supabase.from('division_qual_spec_map').upsert(
        data.map((r) => ({ ...r, division_id: to })),
        {
          onConflict: 'division_id,qualification_item_id,speciality_item_id',
          ignoreDuplicates: true,
        },
      )
      if (e2) throw e2
      return data.length
    },
    onSuccess: () => refresh(qc),
  })
}
