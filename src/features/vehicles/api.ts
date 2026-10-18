import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { normalizeVehicleNumber } from '@/lib/format'
import type { VehicleForm } from './schemas'

export interface Vehicle {
  id: string
  name: string
  vehicle_number: string
  color: string | null
  make: string | null
  model: string | null
  year: number | null
  is_active: boolean
}
const KEY = ['vehicles']

export const useVehicles = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('name')
        .order('vehicle_number')
      if (error) throw error
      return data as Vehicle[]
    },
  })

const toRow = (v: VehicleForm) => ({
  name: v.name.trim(),
  vehicle_number: normalizeVehicleNumber(v.vehicle_number),
  color: v.color.trim() || null,
  make: v.make.trim() || null,
  model: v.model.trim() || null,
  year: v.year ? Number(v.year) : null,
  is_active: v.is_active,
})

function friendly(error: { code?: string; message: string }): Error {
  if (error.code === '23505') return new Error('A vehicle with this number already exists.')
  return new Error(error.message)
}

export function useSaveVehicle(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: VehicleForm) => {
      const q = id
        ? supabase.from('vehicles').update(toRow(v)).eq('id', id)
        : supabase.from('vehicles').insert(toRow(v))
      const { error } = await q
      if (error) throw friendly(error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useToggleVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('vehicles').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Duty entries keep a text snapshot (vehicle_label), so deleting never changes history.
      const { error } = await supabase.from('vehicles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
