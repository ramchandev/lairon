import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DivisionForm } from './schemas'

export interface Division {
  id: string
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
  product_count: number
}
const KEY = ['divisions']

export const useDivisions = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('divisions')
        .select('id, name, description, sort_order, is_active, product_divisions(count)')
        .order('sort_order')
        .order('name')
      if (error) throw error
      return (
        data as unknown as (Omit<Division, 'product_count'> & {
          product_divisions: { count: number }[]
        })[]
      ).map(({ product_divisions, ...d }) => ({
        ...d,
        product_count: product_divisions[0]?.count ?? 0,
      })) as Division[]
    },
  })

const toRow = (v: DivisionForm) => ({
  name: v.name.trim(),
  description: v.description.trim() || null,
  sort_order: v.sort_order ? Number(v.sort_order) : 0,
  is_active: v.is_active,
})

export function useSaveDivision(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: DivisionForm) => {
      const { error } = await (id
        ? supabase.from('divisions').update(toRow(v)).eq('id', id)
        : supabase.from('divisions').insert(toRow(v)))
      if (error)
        throw new Error(
          error.code === '23505' ? 'A division with this name already exists.' : error.message,
        )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useToggleDivision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('divisions').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteDivision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('divisions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
