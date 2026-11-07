import type { Analysis, ColumnMap, Line } from './parse/statement'
import type { CommitLine } from './api'

const COLUMNS = [
  'opening',
  'purchase',
  'sales',
  'free',
  'closing',
  'order_qty',
  'last_month_sales',
  'sale_return',
] as const
const OPTIONAL = ['rate', 'stock_value', 'sales_value'] as const

/** One saved line from a parsed row: the fields that have a database column go there, everything else (purchase free, adjustments, admin-added headings) goes in `extra`. */
export function toCommitLine(line: Line, productId: string | null): CommitLine {
  const v = line.values
  const known = new Set<string>([...COLUMNS, ...OPTIONAL])
  const extra = Object.fromEntries(Object.entries(v).filter(([k]) => !known.has(k)))
  return {
    product_id: productId,
    raw_name: line.raw_name,
    opening: v.opening ?? 0,
    purchase: v.purchase ?? 0,
    sales: v.sales ?? 0,
    free: v.free ?? 0,
    closing: v.closing ?? 0,
    order_qty: v.order_qty ?? 0,
    last_month_sales: v.last_month_sales ?? 0,
    sale_return: v.sale_return ?? 0,
    rate: v.rate ?? null,
    stock_value: v.stock_value ?? null,
    sales_value: v.sales_value ?? null,
    extra,
  }
}

/** Headings whose field the admin changed from the suggestion — the importer learns them as synonyms. */
export function learnedSynonyms(a: Analysis, map: ColumnMap): { field: string; heading: string }[] {
  return a.columns
    .filter((c) => map[c.index] && map[c.index] !== c.field && c.heading.trim())
    .map((c) => ({
      field: map[c.index] as string,
      heading: c.heading.replace(/\s+/g, ' ').trim().toLowerCase(),
    }))
}
