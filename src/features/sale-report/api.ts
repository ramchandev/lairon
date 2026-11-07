import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DEFAULT_FIELDS } from './fields'
import type { ColumnMap, FieldDef } from './parse/statement'
import { DEFAULT_SETTINGS, type Settings } from './reports'

/** The headings the importer understands (admin-editable); the built-in list until the table loads. */
export const useImportFields = () =>
  useQuery({
    queryKey: ['import-fields'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_fields')
        .select('key, label, role, synonyms')
        .order('sort_order')
        .order('label')
      if (error) throw error
      return (data as FieldDef[]).length ? (data as FieldDef[]) : DEFAULT_FIELDS
    },
    placeholderData: DEFAULT_FIELDS,
  })

export function useSaveImportField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (f: {
      key: string
      label: string
      role?: 'core' | 'extra'
      synonyms: string[]
    }) => {
      const { error } = await supabase.from('import_fields').upsert({
        key: f.key,
        label: f.label,
        synonyms: f.synonyms,
        ...(f.role ? { role: f.role } : {}),
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['import-fields'] }),
  })
}

export function useDeleteImportField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase
        .from('import_fields')
        .delete()
        .eq('key', key)
        .eq('role', 'extra')
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['import-fields'] }),
  })
}

export interface Alias {
  id: string
  alias: string
  product_id: string
  stockist_id: string | null
}
export const useAliases = () =>
  useQuery({
    queryKey: ['product-aliases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_aliases')
        .select('id, alias, product_id, stockist_id')
      if (error) throw error
      return data as Alias[]
    },
  })
export function useSaveAliases() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      rows: { alias: string; product_id: string; stockist_id: string | null }[],
    ) => {
      for (const r of rows) {
        const { error } = await supabase.from('product_aliases').insert(r)
        if (error && error.code !== '23505') throw new Error(error.message)
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['product-aliases'] }),
  })
}
export function useDeleteAlias() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_aliases').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['product-aliases'] }),
  })
}

export const useTemplates = (stockistId: string) =>
  useQuery({
    queryKey: ['import-templates', stockistId],
    enabled: !!stockistId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stockist_import_templates')
        .select('signature, column_map')
        .eq('stockist_id', stockistId)
      if (error) throw error
      return Object.fromEntries(
        (data as { signature: string; column_map: ColumnMap }[]).map((t) => [
          t.signature,
          t.column_map,
        ]),
      ) as Record<string, ColumnMap>
    },
  })
export function useSaveTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { stockistId: string; signature: string; map: ColumnMap }) => {
      const { error } = await supabase
        .from('stockist_import_templates')
        .upsert(
          { stockist_id: v.stockistId, signature: v.signature, column_map: v.map },
          { onConflict: 'stockist_id,signature' },
        )
      if (error) throw new Error(error.message)
    },
    onSuccess: (_d, v) =>
      void qc.invalidateQueries({ queryKey: ['import-templates', v.stockistId] }),
  })
}

export interface Upload {
  id: string
  stockist_id: string
  division_id: string | null
  month: string
  file_name: string
  file_hash: string | null
  status: 'active' | 'replaced'
  uploaded_at: string
  stockist: { name: string } | null
  division: { name: string } | null
  lines: { count: number }[]
}
export const useUploads = () =>
  useQuery({
    queryKey: ['stockist-uploads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stockist_uploads')
        .select(
          'id, stockist_id, division_id, month, file_name, file_hash, status, uploaded_at, stockist:stockist_id(name), division:division_id(name), lines:stockist_sales_lines(count)',
        )
        .order('month', { ascending: false })
        .order('uploaded_at', { ascending: false })
      if (error) throw error
      return (data as unknown as Upload[]).map((u) => ({ ...u, month: u.month.slice(0, 10) }))
    },
  })

export interface CommitLine {
  product_id: string | null
  raw_name: string
  opening: number
  purchase: number
  sales: number
  free: number
  closing: number
  order_qty: number
  last_month_sales: number
  sale_return: number
  rate: number | null
  stock_value: number | null
  sales_value: number | null
  extra: Record<string, number>
}
export function useCommitUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      stockistId: string
      divisionId: string | null
      month: string
      fileName: string
      fileHash: string | null
      from: string | null
      to: string | null
      mapping: ColumnMap
      lines: CommitLine[]
      replace: boolean
    }) => {
      const { error } = await supabase.rpc('commit_stockist_upload', {
        p_stockist: v.stockistId,
        p_division: v.divisionId,
        p_month: `${v.month}-01`,
        p_file_name: v.fileName,
        p_file_hash: v.fileHash,
        p_period_from: v.from,
        p_period_to: v.to,
        p_mapping: v.mapping,
        p_lines: v.lines,
        p_replace: v.replace,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stockist-uploads'] }),
  })
}
export function useDeleteUpload() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_stockist_upload', { p_upload: id })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stockist-uploads'] }),
  })
}

/* ---------- reports ---------- */

export interface SaleLine {
  product_id: string | null
  raw_name: string
  opening: number
  purchase: number
  sales: number
  free: number
  closing: number
  order_qty: number
  sale_return: number
  rate: number | null
  stock_value: number | null
  sales_value: number | null
  upload: { stockist_id: string; division_id: string | null; month: string }
}

/** Every live statement line from `from` to `to` (yyyy-mm). Read in pages — a month holds thousands of lines. */
export const useSaleLines = (from: string, to: string, enabled = true) =>
  useQuery({
    queryKey: ['sale-lines', from, to],
    enabled,
    queryFn: async () => {
      const out: SaleLine[] = []
      for (let at = 0; ; at += 1000) {
        const { data, error } = await supabase
          .from('stockist_sales_lines')
          .select(
            'product_id, raw_name, opening, purchase, sales, free, closing, order_qty, sale_return, rate, stock_value, sales_value, upload:upload_id!inner(stockist_id, division_id, month, status)',
          )
          .eq('upload.status', 'active')
          .gte('upload.month', `${from}-01`)
          .lte('upload.month', `${to}-01`)
          .order('id')
          .range(at, at + 999)
        if (error) throw error
        const page = data as unknown as SaleLine[]
        out.push(...page)
        if (page.length < 1000) break
      }
      return out.map((l) => ({
        ...l,
        opening: Number(l.opening),
        purchase: Number(l.purchase),
        sales: Number(l.sales),
        free: Number(l.free),
        closing: Number(l.closing),
        order_qty: Number(l.order_qty),
        sale_return: Number(l.sale_return),
        upload: { ...l.upload, month: l.upload.month.slice(0, 7) },
      }))
    },
  })

export const useSaleSettings = () =>
  useQuery({
    queryKey: ['sale-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_report_settings')
        .select('cover_months, history_months, slow_cover_months')
        .eq('id', 1)
        .maybeSingle()
      if (error) throw error
      return data
        ? {
            cover_months: Number(data.cover_months),
            history_months: Number(data.history_months),
            slow_cover_months: Number(data.slow_cover_months),
          }
        : DEFAULT_SETTINGS
    },
    placeholderData: DEFAULT_SETTINGS,
  })

export function useSaveSaleSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: Settings) => {
      const { error } = await supabase.from('sale_report_settings').upsert({ id: 1, ...s })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sale-settings'] }),
  })
}
