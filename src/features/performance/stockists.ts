import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Stockist {
  id: string
  name: string
  location_id: string
  is_active: boolean
}
export interface StockistEntry {
  stockist_id: string
  /** yyyy-mm-01 */
  month: string
  sales_value: number
  closing_value: number
  return_value: number
}
export type StockistValues = Pick<StockistEntry, 'sales_value' | 'closing_value' | 'return_value'>
export const VALUE_KEYS = ['sales_value', 'closing_value', 'return_value'] as const

/** The stockists of the locations the signed-in manager covers (an admin gets all). */
export const useStockists = () =>
  useQuery({
    queryKey: ['stockists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stockists')
        .select('id, name, location_id, is_active')
        .order('name')
      if (error) throw error
      return data as Stockist[]
    },
  })

export const useStockistEntries = (from: string, to: string) =>
  useQuery({
    queryKey: ['stockist-entries', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stockist_entries')
        .select('stockist_id, month, sales_value, closing_value, return_value')
        .gte('month', `${from}-01`)
        .lte('month', `${to}-01`)
      if (error) throw error
      return (data as Record<string, string | number>[]).map((r) => ({
        stockist_id: String(r.stockist_id),
        month: String(r.month).slice(0, 10),
        sales_value: Number(r.sales_value),
        closing_value: Number(r.closing_value),
        return_value: Number(r.return_value),
      })) as StockistEntry[]
    },
  })

export function useAddStockist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { name: string; locationId: string; userId: string }) => {
      const { error } = await supabase
        .from('stockists')
        .insert({ name: v.name.trim(), location_id: v.locationId, created_by: v.userId })
      if (error)
        throw new Error(
          error.code === '23505' ? 'This stockist is already in this location.' : error.message,
        )
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stockists'] }),
  })
}

export function useSetStockistActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('stockists')
        .update({ is_active: v.active })
        .eq('id', v.id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stockists'] }),
  })
}

/** One transaction in Postgres (`save_stockist_entry`), which enforces coverage, the current-month limit and the month lock. */
export function useSaveStockistEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { stockistId: string; month: string; values: StockistValues }) => {
      const { error } = await supabase.rpc('save_stockist_entry', {
        p_stockist: v.stockistId,
        p_month: `${v.month}-01`,
        p_sales: v.values.sales_value,
        p_closing: v.values.closing_value,
        p_return: v.values.return_value,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stockist-entries'] }),
  })
}

/* ---------- master details (admin) ---------- */

export interface StockistDetails extends Stockist {
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  gstin: string | null
  drug_licence: string | null
  notes: string | null
}
export type StockistForm = Omit<StockistDetails, 'id'>

/** Read separately from `useStockists` so the lists everyone uses keep working before the details columns exist. */
export const useStockistDetails = () =>
  useQuery({
    queryKey: ['stockist-details'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stockists')
        .select(
          'id, name, location_id, is_active, contact_person, phone, email, address, gstin, drug_licence, notes',
        )
        .order('name')
      if (error) throw error
      return data as StockistDetails[]
    },
  })

const blank = (s: string | null) => (s?.trim() ? s.trim() : null)

export function useSaveStockistDetails(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (f: StockistForm) => {
      const row = {
        name: f.name.trim(),
        location_id: f.location_id,
        is_active: f.is_active,
        contact_person: blank(f.contact_person),
        phone: blank(f.phone),
        email: blank(f.email),
        address: blank(f.address),
        gstin: blank(f.gstin)?.toUpperCase() ?? null,
        drug_licence: blank(f.drug_licence),
        notes: blank(f.notes),
      }
      const { error } = id
        ? await supabase.from('stockists').update(row).eq('id', id)
        : await supabase.from('stockists').insert(row)
      if (error)
        throw new Error(
          error.code === '23505' ? 'This stockist is already in this location.' : error.message,
        )
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stockist-details'] })
      void qc.invalidateQueries({ queryKey: ['stockists'] })
    },
  })
}
