import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { shiftMonth } from '@/lib/time'

export interface SalesEntry {
  id: string
  manager_id: string
  location_id: string
  product_id: string
  /** yyyy-mm-01 */
  month: string
  primary_target: number
  secondary_target: number
  primary_ach: number
  secondary_ach: number
  sales_return: number
}

export type Figures = Pick<
  SalesEntry,
  'primary_target' | 'secondary_target' | 'primary_ach' | 'secondary_ach' | 'sales_return'
>
export const FIGURE_KEYS: (keyof Figures)[] = [
  'primary_target',
  'secondary_target',
  'primary_ach',
  'secondary_ach',
  'sales_return',
]

const COLS =
  'id, manager_id, location_id, product_id, month, primary_target, secondary_target, primary_ach, secondary_ach, sales_return'

/** Entries between two months (yyyy-mm). A manager only receives their own rows; admins pass a manager or get everyone's. */
export const useSalesEntries = (opts: { managerId?: string; from: string; to: string }) =>
  useQuery({
    queryKey: ['sales-entries', opts.managerId ?? 'all', opts.from, opts.to],
    queryFn: async () => {
      let q = supabase
        .from('sales_entries')
        .select(COLS)
        .gte('month', `${opts.from}-01`)
        .lte('month', `${opts.to}-01`)
      if (opts.managerId) q = q.eq('manager_id', opts.managerId)
      const { data, error } = await q
      if (error) throw error
      return (data as Record<string, string | number>[]).map((r) => ({
        ...r,
        month: String(r.month).slice(0, 10),
        primary_target: Number(r.primary_target),
        secondary_target: Number(r.secondary_target),
        primary_ach: Number(r.primary_ach),
        secondary_ach: Number(r.secondary_ach),
        sales_return: Number(r.sales_return),
      })) as SalesEntry[]
    },
  })

/** One transaction in Postgres (`save_sales_entry`), which enforces coverage, the current-month limit and the month lock. */
export function useSaveSalesEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      managerId?: string
      locationId: string
      productId: string
      month: string
      figures: Figures
    }) => {
      const { error } = await supabase.rpc('save_sales_entry', {
        p_manager: v.managerId ?? null,
        p_location: v.locationId,
        p_product: v.productId,
        p_month: `${v.month}-01`,
        p_primary_target: v.figures.primary_target,
        p_secondary_target: v.figures.secondary_target,
        p_primary_ach: v.figures.primary_ach,
        p_secondary_ach: v.figures.secondary_ach,
        p_sales_return: v.figures.sales_return,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sales-entries'] }),
  })
}

// ── calculations (the same formulas as the Excel sheets) ──

/** Percentage of `part` in `whole`; 0 when there is nothing to divide by (Excel: IFERROR(…,0)). */
export const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0)

export interface Totals extends Figures {
  /** Primary achieved ÷ primary target */
  achPct: number
  /** Secondary achieved ÷ secondary target */
  secAchPct: number
  /** Secondary ÷ primary achieved */
  secVsPri: number
  /** Primary achieved − secondary achieved */
  gap: number
  /** Secondary achieved − sales return */
  netSecondary: number
}

export function totalsOf(f: Figures): Totals {
  return {
    ...f,
    achPct: pct(f.primary_ach, f.primary_target),
    secAchPct: pct(f.secondary_ach, f.secondary_target),
    secVsPri: pct(f.secondary_ach, f.primary_ach),
    gap: f.primary_ach - f.secondary_ach,
    netSecondary: f.secondary_ach - f.sales_return,
  }
}

const zero = (): Figures => ({
  primary_target: 0,
  secondary_target: 0,
  primary_ach: 0,
  secondary_ach: 0,
  sales_return: 0,
})

export type Unit = 'units' | 'value'
export type GroupBy = 'product' | 'month' | 'location'
export type ProductView = 'all' | 'core' | 'new'

export interface ProductInfo {
  id: string
  name: string
  tag: 'core' | 'new' | null
  pts: number | null
}

export interface ReportFilters {
  locationIds: string[]
  view: ProductView
  unit: Unit
  groupBy: GroupBy
}

export interface ReportLine {
  key: string
  label: string
  totals: Totals
}

/** Sums the entries that match the filters, grouped by product, month or location. Value = units × PTS (products without a PTS count 0). */
export function buildSalesReport(
  entries: SalesEntry[],
  products: ProductInfo[],
  names: { locations: Record<string, string> },
  f: ReportFilters,
): { lines: ReportLine[]; total: Totals } {
  const byProduct = new Map(products.map((p) => [p.id, p]))
  const groups = new Map<string, { label: string; sum: Figures }>()
  const all = zero()
  for (const e of entries) {
    const p = byProduct.get(e.product_id)
    if (!p) continue
    if (f.locationIds.length && !f.locationIds.includes(e.location_id)) continue
    if (f.view !== 'all' && p.tag !== f.view) continue
    const k = f.unit === 'value' ? (p.pts ?? 0) : 1
    const key = f.groupBy === 'product' ? p.id : f.groupBy === 'month' ? e.month : e.location_id
    const label =
      f.groupBy === 'product'
        ? p.name
        : f.groupBy === 'month'
          ? e.month
          : (names.locations[key] ?? '?')
    const g = groups.get(key) ?? { label, sum: zero() }
    for (const fk of FIGURE_KEYS) {
      g.sum[fk] += e[fk] * k
      all[fk] += e[fk] * k
    }
    groups.set(key, g)
  }
  const lines = [...groups.entries()]
    .map(([key, g]) => ({ key, label: g.label, totals: totalsOf(g.sum) }))
    .sort((a, b) =>
      f.groupBy === 'month' ? a.key.localeCompare(b.key) : a.label.localeCompare(b.label),
    )
  return { lines, total: totalsOf(all) }
}

/** ₹ lakhs with two decimals, as the Excel shows value ("17.50"). */
export const lakhs = (rupees: number) => (rupees / 100000).toFixed(2)

/** Quarter label of a yyyy-mm month in the Indian financial year (Apr–Jun = Q1). */
export function quarterOf(month: string): string {
  const m = Number(month.slice(5, 7))
  const q = Math.floor(((m + 8) % 12) / 3) + 1
  return `Q${q}`
}

/** The financial year (Apr–Mar) a yyyy-mm month belongs to, as its first and last month. */
export function financialYear(month: string): { from: string; to: string } {
  const y = Number(month.slice(0, 4))
  const startYear = Number(month.slice(5, 7)) >= 4 ? y : y - 1
  const from = `${startYear}-04`
  return { from, to: shiftMonth(from, 11) }
}
