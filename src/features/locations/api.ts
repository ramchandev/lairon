import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Location {
  id: string
  code: string
  name: string
  sort_order: number
  is_active: boolean
}
const KEY = ['locations']

export const useLocations = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, code, name, sort_order, is_active')
        .order('sort_order')
        .order('name')
      if (error) throw error
      return data as Location[]
    },
  })

export interface LocationForm {
  code: string
  name: string
  sort_order: string
  is_active: boolean
}

export function useSaveLocation(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: LocationForm) => {
      const row = {
        code: v.code.trim().toUpperCase(),
        name: v.name.trim(),
        sort_order: v.sort_order ? Number(v.sort_order) : 0,
        is_active: v.is_active,
      }
      const { error } = await (id
        ? supabase.from('locations').update(row).eq('id', id)
        : supabase.from('locations').insert(row))
      if (error)
        throw new Error(
          error.code === '23505'
            ? 'A location with this code or name already exists.'
            : error.message,
        )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** manager id -> ids of the locations they cover. A manager receives only their own; admins receive everyone's. */
export const useManagerLocations = () =>
  useQuery({
    queryKey: ['manager-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manager_locations')
        .select('manager_id, location_id')
      if (error) throw error
      const map: Record<string, string[]> = {}
      for (const r of data as { manager_id: string; location_id: string }[])
        (map[r.manager_id] ??= []).push(r.location_id)
      return map
    },
  })

/** Admin only: replace the set of locations a manager covers. */
export function useSetManagerLocations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      managerId,
      locationIds,
    }: {
      managerId: string
      locationIds: string[]
    }) => {
      const del = await supabase.from('manager_locations').delete().eq('manager_id', managerId)
      if (del.error) throw del.error
      if (locationIds.length) {
        const ins = await supabase
          .from('manager_locations')
          .insert(locationIds.map((location_id) => ({ manager_id: managerId, location_id })))
        if (ins.error) throw ins.error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager-locations'] }),
  })
}
