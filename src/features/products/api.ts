import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ProductForm } from './schemas'

export interface Product {
  id: string
  name: string
  description: string | null
  is_active: boolean
  division_ids: string[]
}
const KEY = ['products']

export const useProducts = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, is_active, product_divisions(division_id)')
        .order('name')
      if (error) throw error
      return (
        data as unknown as (Omit<Product, 'division_ids'> & {
          product_divisions: { division_id: string }[]
        })[]
      ).map(({ product_divisions, ...p }) => ({
        ...p,
        division_ids: product_divisions.map((d) => d.division_id),
      })) as Product[]
    },
  })

const dupMsg = 'A product with this name already exists.'

async function syncDivisions(productId: string, divisionIds: string[]) {
  const del = await supabase.from('product_divisions').delete().eq('product_id', productId)
  if (del.error) throw del.error
  if (divisionIds.length) {
    const ins = await supabase
      .from('product_divisions')
      .insert(divisionIds.map((division_id) => ({ product_id: productId, division_id })))
    if (ins.error) throw ins.error
  }
}

export function useSaveProduct(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: ProductForm) => {
      const row = {
        name: v.name.trim(),
        description: v.description.trim() || null,
        is_active: v.is_active,
      }
      let productId = id
      if (id) {
        const { error } = await supabase.from('products').update(row).eq('id', id)
        if (error) throw new Error(error.code === '23505' ? dupMsg : error.message)
      } else {
        const { data, error } = await supabase.from('products').insert(row).select('id').single()
        if (error) throw new Error(error.code === '23505' ? dupMsg : error.message)
        productId = data.id
      }
      await syncDivisions(productId!, v.division_ids)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['divisions'] })
    },
  })
}

export function useToggleProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('products').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Starter-pack items keep a text snapshot (product_name), so history is unaffected.
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['divisions'] })
    },
  })
}

// ── CSV import ──
export interface ImportRow {
  line: number
  name: string
  description: string
  divisionIds: string[]
  status: 'new' | 'update' | 'error'
  error?: string
  existingId?: string
}

/** Existing products (matched case-insensitively) get their description updated and divisions ADDED, never removed. */
export function useImportProducts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: ImportRow[]) => {
      let created = 0,
        updated = 0
      for (const r of rows) {
        if (r.status === 'error') continue
        if (r.status === 'new') {
          const { data, error } = await supabase
            .from('products')
            .insert({ name: r.name, description: r.description || null })
            .select('id')
            .single()
          if (error) throw new Error(`Line ${r.line}: ${error.message}`)
          await syncDivisions(data.id, r.divisionIds)
          created++
        } else if (r.existingId) {
          if (r.description)
            await supabase
              .from('products')
              .update({ description: r.description })
              .eq('id', r.existingId)
          if (r.divisionIds.length) {
            const { error } = await supabase.from('product_divisions').upsert(
              r.divisionIds.map((division_id) => ({ product_id: r.existingId!, division_id })),
              { onConflict: 'product_id,division_id', ignoreDuplicates: true },
            )
            if (error) throw new Error(`Line ${r.line}: ${error.message}`)
          }
          updated++
        }
      }
      return { created, updated }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['divisions'] })
    },
  })
}
