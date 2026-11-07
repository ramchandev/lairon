import type { Cell } from '@/lib/csvExport'
import { shiftMonth } from '@/lib/time'

/** One product line of one stockist's statement for one month, with ₹ worked out (our PTS first, else the stockist's own rate/value). */
export interface SaleRow {
  month: string // yyyy-mm
  stockistId: string
  stockist: string
  locationId: string
  location: string
  divisionId: string
  division: string
  productKey: string
  product: string
  opening: number
  purchase: number
  sales: number
  free: number
  closing: number
  orderQty: number
  saleReturn: number
  salesValue: number
  stockValue: number
}

export interface Settings {
  cover_months: number
  history_months: number
  slow_cover_months: number
}
export const DEFAULT_SETTINGS: Settings = {
  cover_months: 1.5,
  history_months: 3,
  slow_cover_months: 3,
}

export type Kind = 'text' | 'qty' | 'money' | 'pct'
export interface Table {
  columns: { label: string; kind: Kind }[]
  rows: Cell[][]
  note?: string
}

export interface UploadRef {
  stockistId: string
  stockist: string
  divisionId: string
  division: string
  month: string
}

export const REPORTS = [
  { key: 'reorder', label: 'What to order', hint: 'Products to reorder, all stockists together' },
  {
    key: 'reorder-stockist',
    label: 'Order by stockist',
    hint: 'Suggested order for each stockist and product',
  },
  {
    key: 'consolidation',
    label: 'Monthly consolidation',
    hint: 'Opening, purchase, sales and closing by product',
  },
  { key: 'top-products', label: 'Top products', hint: 'Best sellers, with change from last month' },
  { key: 'top-stockists', label: 'Top stockists', hint: 'Who sold the most' },
  {
    key: 'not-selling',
    label: 'Stocked, not selling',
    hint: 'High closing stock, low or no sales',
  },
  { key: 'trend', label: 'Month-on-month', hint: 'Product sales over the last months' },
  { key: 'by-division', label: 'By division', hint: 'Critical care, cardia, oral…' },
  { key: 'by-location', label: 'By location', hint: 'Sales and stock for each location' },
  { key: 'scheme', label: 'Scheme & returns', hint: 'Free quantity and returns against sales' },
  { key: 'status', label: 'Upload status', hint: 'Which statements are in, which are missing' },
] as const
export type ReportKey = (typeof REPORTS)[number]['key']

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((n, x) => n + f(x), 0)
const r2 = (n: number) => Math.round(n * 100) / 100
const pct = (a: number, b: number) => (b > 0 ? r2((a / b) * 100) : null)
function group<T>(xs: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    const g = m.get(k)
    if (g) g.push(x)
    else m.set(k, [x])
  }
  return m
}

/** Average monthly sales of one stockist + division + product over the last `history_months` up to `month`. */
export function averageSales(rows: SaleRow[], month: string, settings: Settings) {
  const from = shiftMonth(month, -(settings.history_months - 1))
  const win = rows.filter((r) => r.month >= from && r.month <= month)
  const seen = new Map<string, Set<string>>() // stockist|division → months with a statement
  const total = new Map<string, number>() // stockist|division|product → sales
  for (const r of win) {
    const sd = `${r.stockistId}|${r.divisionId}`
    if (!seen.has(sd)) seen.set(sd, new Set())
    seen.get(sd)!.add(r.month)
    const k = `${sd}|${r.productKey}`
    total.set(k, (total.get(k) ?? 0) + r.sales)
  }
  return (r: SaleRow) => {
    const sd = `${r.stockistId}|${r.divisionId}`
    return (total.get(`${sd}|${r.productKey}`) ?? 0) / Math.max(1, seen.get(sd)?.size ?? 1)
  }
}

const suggest = (avg: number, closing: number, cover: number) =>
  Math.max(0, Math.ceil(avg * cover - closing))

export function runReport(
  id: ReportKey,
  rows: SaleRow[],
  month: string,
  settings: Settings,
  uploads: UploadRef[] = [],
): Table {
  const cur = rows.filter((r) => r.month === month)
  const text = (label: string) => ({ label, kind: 'text' as const })
  const qty = (label: string) => ({ label, kind: 'qty' as const })
  const money = (label: string) => ({ label, kind: 'money' as const })
  const pc = (label: string) => ({ label, kind: 'pct' as const })

  switch (id) {
    case 'consolidation': {
      const out = [...group(cur, (r) => r.productKey).values()].map((g) => [
        g[0].product,
        sum(g, (r) => r.opening),
        sum(g, (r) => r.purchase),
        sum(g, (r) => r.sales),
        sum(g, (r) => r.free),
        sum(g, (r) => r.closing),
        r2(sum(g, (r) => r.salesValue)),
        new Set(g.filter((r) => r.sales > 0).map((r) => r.stockistId)).size,
      ])
      out.sort((a, b) => (b[3] as number) - (a[3] as number))
      return {
        columns: [
          text('Product'),
          qty('Opening'),
          qty('Purchase'),
          qty('Sales'),
          qty('Free'),
          qty('Closing'),
          money('Sales ₹'),
          qty('Stockists selling'),
        ],
        rows: out,
      }
    }
    case 'top-products': {
      const prev = group(
        rows.filter((r) => r.month === shiftMonth(month, -1)),
        (r) => r.productKey,
      )
      const total = sum(cur, (r) => r.sales)
      const out = [...group(cur, (r) => r.productKey).values()]
        .map((g) => {
          const s = sum(g, (r) => r.sales)
          const p = sum(prev.get(g[0].productKey) ?? [], (r) => r.sales)
          return [
            g[0].product,
            s,
            r2(sum(g, (r) => r.salesValue)),
            pct(s, total),
            p,
            p > 0 ? r2(((s - p) / p) * 100) : null,
          ]
        })
        .filter((r) => (r[1] as number) > 0)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
      return {
        columns: [
          text('Product'),
          qty('Sales'),
          money('Sales ₹'),
          pc('Share %'),
          qty('Last month'),
          pc('Change %'),
        ],
        rows: out,
      }
    }
    case 'top-stockists': {
      const out = [...group(cur, (r) => r.stockistId).values()]
        .map((g) => [
          g[0].stockist,
          g[0].location,
          sum(g, (r) => r.sales),
          r2(sum(g, (r) => r.salesValue)),
          new Set(g.filter((r) => r.sales > 0).map((r) => r.productKey)).size,
          r2(sum(g, (r) => r.stockValue)),
        ])
        .sort((a, b) => (b[3] as number) - (a[3] as number))
      return {
        columns: [
          text('Stockist'),
          text('Location'),
          qty('Sales'),
          money('Sales ₹'),
          qty('Products sold'),
          money('Closing ₹'),
        ],
        rows: out,
      }
    }
    case 'not-selling': {
      const avg = averageSales(rows, month, settings)
      const out = cur
        .map((r) => ({ r, a: avg(r) }))
        .filter(
          ({ r, a }) => r.closing > 0 && (a === 0 || r.closing / a > settings.slow_cover_months),
        )
        .sort((x, y) => y.r.stockValue - x.r.stockValue || y.r.closing - x.r.closing)
        .map(({ r, a }) => [
          r.stockist,
          r.division,
          r.product,
          r.closing,
          r2(a),
          a > 0 ? r2(r.closing / a) : null,
          r2(r.stockValue),
        ])
      return {
        columns: [
          text('Stockist'),
          text('Division'),
          text('Product'),
          qty('Closing'),
          qty('Avg monthly sales'),
          qty('Months of stock'),
          money('Stock ₹'),
        ],
        rows: out,
        note: `Closing stock lasting more than ${settings.slow_cover_months} months (average of the last ${settings.history_months}), or with no sales at all.`,
      }
    }
    case 'reorder':
    case 'reorder-stockist': {
      const avg = averageSales(rows, month, settings)
      const lines = cur.map((r) => {
        const a = avg(r)
        return { r, a, s: suggest(a, r.closing, settings.cover_months) }
      })
      const note = `Suggested = average monthly sales (last ${settings.history_months} months) × ${settings.cover_months} months − closing stock.`
      if (id === 'reorder-stockist') {
        return {
          columns: [
            text('Stockist'),
            text('Division'),
            text('Product'),
            qty('Avg monthly sales'),
            qty('Closing'),
            qty('Suggested order'),
            qty('Asked by stockist'),
          ],
          rows: lines
            .filter((l) => l.s > 0)
            .sort((x, y) => y.s - x.s)
            .map((l) => [
              l.r.stockist,
              l.r.division,
              l.r.product,
              r2(l.a),
              l.r.closing,
              l.s,
              l.r.orderQty,
            ]),
          note,
        }
      }
      const out = [...group(lines, (l) => l.r.productKey).values()]
        .map((g) => [
          g[0].r.product,
          g.filter((l) => l.s > 0).length,
          r2(sum(g, (l) => l.a)),
          sum(g, (l) => l.r.closing),
          sum(g, (l) => l.s),
          sum(g, (l) => l.r.orderQty),
        ])
        .filter((r) => (r[4] as number) > 0)
        .sort((a, b) => (b[4] as number) - (a[4] as number))
      return {
        columns: [
          text('Product'),
          qty('Stockists to order'),
          qty('Avg monthly sales'),
          qty('Closing'),
          qty('Suggested order'),
          qty('Asked by stockists'),
        ],
        rows: out,
        note,
      }
    }
    case 'trend': {
      const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5))
      const out = [
        ...group(
          rows.filter((r) => months.includes(r.month)),
          (r) => r.productKey,
        ).values(),
      ]
        .map((g) => {
          const by = months.map((m) =>
            sum(
              g.filter((r) => r.month === m),
              (r) => r.sales,
            ),
          )
          const p = by[4]
          return [g[0].product, ...by, p > 0 ? r2(((by[5] - p) / p) * 100) : null]
        })
        .filter((r) => (r[6] as number) > 0 || (r[5] as number) > 0)
        .sort((a, b) => (b[6] as number) - (a[6] as number))
      return {
        columns: [text('Product'), ...months.map(qty), pc('Change %')],
        rows: out,
        note: 'Units sold (paid quantity) per month.',
      }
    }
    case 'by-division':
    case 'by-location': {
      const loc = id === 'by-location'
      const out = [...group(cur, (r) => (loc ? r.locationId : r.divisionId)).values()]
        .map((g) => [
          loc ? g[0].location : g[0].division,
          sum(g, (r) => r.sales),
          r2(sum(g, (r) => r.salesValue)),
          sum(g, (r) => r.closing),
          r2(sum(g, (r) => r.stockValue)),
          new Set(g.map((r) => r.stockistId)).size,
        ])
        .sort((a, b) => (b[2] as number) - (a[2] as number))
      return {
        columns: [
          text(loc ? 'Location' : 'Division'),
          qty('Sales'),
          money('Sales ₹'),
          qty('Closing'),
          money('Closing ₹'),
          qty('Stockists'),
        ],
        rows: out,
      }
    }
    case 'scheme': {
      const out = [...group(cur, (r) => r.productKey).values()]
        .map((g) => {
          const s = sum(g, (r) => r.sales)
          const f = sum(g, (r) => r.free)
          const ret = sum(g, (r) => r.saleReturn)
          return [g[0].product, s, f, pct(f, s), ret, pct(ret, s)]
        })
        .filter((r) => (r[2] as number) > 0 || (r[4] as number) > 0)
        .sort(
          (a, b) =>
            ((b[3] as number) ?? 1e9) - ((a[3] as number) ?? 1e9) ||
            (b[2] as number) - (a[2] as number),
        )
      return {
        columns: [
          text('Product'),
          qty('Sales'),
          qty('Free'),
          pc('Free %'),
          qty('Returns'),
          pc('Returns %'),
        ],
        rows: out,
        note: 'Free % and Returns % are against paid sales; a blank % means free or returns with no sales.',
      }
    }
    case 'status': {
      const pairs = new Map<string, UploadRef>()
      for (const u of uploads) pairs.set(`${u.stockistId}|${u.divisionId}`, u)
      const got = new Set(
        uploads.filter((u) => u.month === month).map((u) => `${u.stockistId}|${u.divisionId}`),
      )
      const out = [...pairs.entries()]
        .map(([k, u]) => {
          const months = uploads
            .filter((x) => `${x.stockistId}|${x.divisionId}` === k)
            .map((x) => x.month)
            .sort()
          return [
            u.stockist,
            u.division,
            got.has(k) ? 'Received' : 'Missing',
            months[months.length - 1].slice(0, 7),
          ]
        })
        .sort((a, b) =>
          a[2] === b[2] ? String(a[0]).localeCompare(String(b[0])) : a[2] === 'Missing' ? -1 : 1,
        )
      return {
        columns: [text('Stockist'), text('Division'), text('This month'), text('Last statement')],
        rows: out,
        note: 'Lists every stockist + division that has sent a statement before.',
      }
    }
  }
}

export interface Lookups {
  products: Map<string, { name: string; pts: number | null }>
  stockists: Map<string, { name: string; locationId: string }>
  locations: Map<string, string>
  divisions: Map<string, string>
}
export interface RawLine {
  product_id: string | null
  raw_name: string
  sales: number
  free: number
  opening: number
  purchase: number
  closing: number
  order_qty: number
  sale_return: number
  rate: number | null
  stock_value: number | null
  sales_value: number | null
  upload: { stockist_id: string; division_id: string | null; month: string }
}

/** Statement lines → report rows. ₹ uses our PTS; without one, the stockist's own value or rate. */
export function toSaleRows(lines: RawLine[], lk: Lookups): SaleRow[] {
  return lines.map((l) => {
    const p = l.product_id ? lk.products.get(l.product_id) : undefined
    const st = lk.stockists.get(l.upload.stockist_id)
    const pts = p?.pts ?? null
    const unit = pts ?? l.rate ?? 0
    const name = p?.name ?? l.raw_name
    return {
      month: l.upload.month,
      stockistId: l.upload.stockist_id,
      stockist: st?.name ?? 'Unknown stockist',
      locationId: st?.locationId ?? '',
      location: lk.locations.get(st?.locationId ?? '') ?? '—',
      divisionId: l.upload.division_id ?? '',
      division: lk.divisions.get(l.upload.division_id ?? '') ?? 'All divisions',
      productKey: l.product_id ?? `raw:${l.raw_name.toUpperCase().trim()}`,
      product: name,
      opening: l.opening,
      purchase: l.purchase,
      sales: l.sales,
      free: l.free,
      closing: l.closing,
      orderQty: l.order_qty,
      saleReturn: l.sale_return,
      salesValue: pts !== null ? l.sales * pts : (l.sales_value ?? l.sales * unit),
      stockValue: pts !== null ? l.closing * pts : (l.stock_value ?? l.closing * unit),
    }
  })
}
