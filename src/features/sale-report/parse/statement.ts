import { findPeriod, type Period } from './period'

export interface FieldDef {
  key: string
  label: string
  role: 'core' | 'extra'
  synonyms: string[]
}
export type DivisionHint = 'cc' | 'cd' | 'ol'

export interface Column {
  index: number
  heading: string
  field: string | null
  confidence: number
}
export interface DataRow {
  /** 1-based line in the file, for messages */
  line: number
  name: string
  pack: string | null
  /** numeric value per column index; null = not a number */
  cells: Record<number, number | null>
}
export interface Analysis {
  columns: Column[]
  nameCol: number
  packCol: number | null
  /** the headings joined — the same layout next month gives the same signature */
  signature: string
  meta: { stockist: string | null; period: Period | null; divisionHint: DivisionHint | null }
  rows: DataRow[]
  problems: string[]
}

const clean = (v: unknown) =>
  v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim()
const hnorm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
const squeeze = (s: string) => hnorm(s).replace(/ /g, '')

export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = clean(v)
  if (s === '' || /^[-–—.]+$/.test(s)) return 0
  const plus = /^(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)$/.exec(s) // "9+1" = paid + free
  if (plus) return Number(plus[1]) + Number(plus[2])
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-')
  const body = s.replace(/[(),\s]/g, '').replace(/^-/, '')
  if (!/^\d*\.?\d+$/.test(body)) return null
  const n = Number(body)
  return neg ? -n : n
}
/** An empty-looking numeric cell ("-" or 0) still counts as data; blank and text do not. */
const isNumeric = (v: unknown) => typeof v === 'number' || (clean(v) !== '' && toNumber(v) !== null)

/** Which field a heading means, with a 0..1 confidence. */
export function suggestField(
  heading: string,
  fields: FieldDef[],
): { key: string | null; confidence: number } {
  const h = hnorm(heading)
  if (!h) return { key: null, confidence: 0 }
  const variants = [
    h,
    h
      .replace(/\b(qty|quantity|nos)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  ].filter(Boolean)
  const isValue = /\b(value|val|amt|amount)\b/.test(h)
  const syn = fields.flatMap((f) =>
    [f.key.replace(/_/g, ' '), f.label, ...f.synonyms].map((s) => ({ key: f.key, s: squeeze(s) })),
  )
  const tails = (sq: string) => [sq, sq.replace(/(quantity|qty)$/, '')].filter((x) => x.length >= 2)
  for (const v of variants) {
    for (const sq of tails(v.replace(/ /g, ''))) {
      const hit = syn.find((x) => x.s === sq)
      if (hit) return { key: hit.key, confidence: 1 }
    }
  }
  if (isValue) {
    if (/clos|stock|bal|cur/.test(h) && fields.some((f) => f.key === 'stock_value'))
      return { key: 'stock_value', confidence: 0.8 }
    if (/sale|sal|issue/.test(h) && fields.some((f) => f.key === 'sales_value'))
      return { key: 'sales_value', confidence: 0.8 }
    return { key: null, confidence: 0 }
  }
  const sq = squeeze(variants[variants.length - 1])
  if (sq.length < 5) return { key: null, confidence: 0 }
  let best: { key: string; sc: number } | null = null
  for (const x of syn) {
    if (x.s.length < 5 || /value|val$/.test(x.s)) continue
    const lev = levenshtein(sq, x.s)
    const sc = 1 - lev / Math.max(sq.length, x.s.length)
    if (sc >= 0.8 && (!best || sc > best.sc)) best = { key: x.key, sc }
  }
  return best ? { key: best.key, confidence: best.sc } : { key: null, confidence: 0 }
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

const SUB = /^(qty|quantity|value|val|amount|amt|nos|free)$/

/** Where the headings are: the first of the top rows that names at least two of our fields; a "QTY / VALUE" row under it is merged in. */
function findHeader(rows: unknown[][], fields: FieldDef[]) {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const row = rows[r] ?? []
    const keys = new Set<string>()
    row.forEach((c) => {
      const f = suggestField(clean(c), fields)
      if (f.key && f.confidence >= 0.8) keys.add(f.key)
    })
    if (keys.size < 2) continue
    const next = rows[r + 1] ?? []
    const subCells = next.map(clean).filter(Boolean)
    const twoRow =
      subCells.length >= 2 &&
      subCells.filter((c) => SUB.test(hnorm(c))).length >= subCells.length / 2
    const width = Math.max(row.length, next.length)
    let group = ''
    const headings: string[] = []
    for (let c = 0; c < width; c++) {
      const top = clean(row[c])
      const sub = twoRow ? clean(next[c]) : ''
      if (top) group = top
      headings.push(twoRow ? (sub ? `${top || group} ${sub}` : top) : top)
    }
    return { row: r, dataStart: r + (twoRow ? 2 : 1), headings }
  }
  return null
}

const SKIP_NAME = /^(total|grand total|sub ?total|page|company|manufactur|\*+|-+)/i

export function analyse(rows: unknown[][], fields: FieldDef[], fileName = ''): Analysis {
  const problems: string[] = []
  const head = findHeader(rows, fields)
  const meta: Analysis['meta'] = { stockist: null, period: null, divisionHint: null }
  const top = (rows.slice(0, head ? head.row : 12) ?? []).map((r) =>
    (r ?? []).map(clean).filter(Boolean).join(' '),
  )
  meta.stockist = top.find((t) => t && !/stock|sales?\b|statement/i.test(t))?.slice(0, 80) ?? null
  const text = top.join(' ')
  meta.period = findPeriod(text) ?? findPeriod(fileName)
  const hay = `${fileName} ${text}`
  const fileTokens = ` ${fileName.toLowerCase().replace(/[^a-z]+/g, ' ')} `
  meta.divisionHint = / cc /.test(fileTokens)
    ? 'cc'
    : / cd /.test(fileTokens)
      ? 'cd'
      : / ol /.test(fileTokens)
        ? 'ol'
        : /critical/i.test(hay)
          ? 'cc'
          : /cardia/i.test(hay)
            ? 'cd'
            : /\boral\b/i.test(hay)
              ? 'ol'
              : null

  if (!head) {
    problems.push(
      'No sales or stock columns were found. Upload the stock & sales statement from the stockist.',
    )
    return { columns: [], nameCol: 0, packCol: null, signature: '', meta, rows: [], problems }
  }

  const columns: Column[] = head.headings.map((h, index) => ({
    index,
    heading: h,
    field: null,
    confidence: 0,
  }))
  // Two columns can mean the same field (SaleQuantity vs "Total Sales w/o free"): the better match wins, the earlier one on a tie.
  const rank = (c: Column, conf: number) =>
    conf + (/w o free|without free|net of free/.test(hnorm(c.heading)) ? 0.1 : 0)
  const best = new Map<string, { col: Column; r: number; conf: number }>()
  for (const col of columns) {
    const f = suggestField(col.heading, fields)
    if (!f.key) continue
    const r = rank(col, f.confidence)
    const cur = best.get(f.key)
    if (!cur || r > cur.r) best.set(f.key, { col, r, conf: f.confidence })
  }
  for (const [key, v] of best) {
    v.col.field = key
    v.col.confidence = v.conf
  }
  const body = rows.slice(head.dataStart)
  let nameCol = -1
  for (const re of [/(name|description|item|particular)/i, /product/i]) {
    nameCol = columns.findIndex(
      (c) => !c.field && re.test(c.heading) && !/code|no\b/i.test(c.heading),
    )
    if (nameCol >= 0) break
  }
  if (nameCol < 0) {
    nameCol = columns.findIndex(
      (c) =>
        !c.field &&
        body.slice(0, 30).filter((r) => clean(r?.[c.index]) && !isNumeric(r?.[c.index])).length >=
          3,
    )
  }
  if (nameCol < 0) nameCol = 0
  const pk = columns.findIndex((c) => /^pack(ing|g)?$/.test(hnorm(c.heading)))
  const packCol = pk >= 0 ? pk : null

  const out: DataRow[] = []
  body.forEach((r, i) => {
    const name = clean(r?.[nameCol])
    if (!name || isNumeric(r?.[nameCol]) || SKIP_NAME.test(name)) return
    if (hnorm(name) === hnorm(columns[nameCol].heading)) return
    const cells: Record<number, number | null> = {}
    let anyNumber = false
    for (const c of columns) {
      if (c.index === nameCol || c.index === packCol) continue
      const v = r?.[c.index]
      cells[c.index] = toNumber(v)
      if (isNumeric(v)) anyNumber = true
    }
    if (!anyNumber) return // a section title such as "LAIRON"
    out.push({
      line: head.dataStart + i + 1,
      name,
      pack: packCol === null ? null : clean(r?.[packCol]) || null,
      cells,
    })
  })

  const mapped = new Set(columns.map((c) => c.field).filter(Boolean))
  if (!mapped.has('sales') || !(mapped.has('closing') || mapped.has('opening'))) {
    problems.push(
      'This file has no sales or stock columns. Upload the stock & sales statement from the stockist.',
    )
  }
  if (!out.length) problems.push('No product rows were found below the headings.')
  const signature = columns
    .map((c) => hnorm(c.heading))
    .filter(Boolean)
    .join('|')
  return { columns, nameCol, packCol, signature, meta, rows: out, problems }
}

/** The map admin chose: column index → field key (or null to ignore). */
export type ColumnMap = Record<number, string | null>
export const mapOf = (a: Analysis): ColumnMap =>
  Object.fromEntries(a.columns.map((c) => [c.index, c.field]))

export interface Line {
  raw_name: string
  /** field key → number; core fields default to 0 */
  values: Record<string, number>
}
export const CORE_KEYS = ['opening', 'purchase', 'sales', 'free', 'closing', 'order_qty']

export function buildLines(a: Analysis, map: ColumnMap): Line[] {
  return a.rows.map((r) => {
    const values: Record<string, number> = Object.fromEntries(CORE_KEYS.map((k) => [k, 0]))
    for (const [idx, key] of Object.entries(map)) {
      if (!key) continue
      const v = r.cells[Number(idx)]
      if (v !== null && v !== undefined) values[key] = (values[key] ?? 0) + v
    }
    return { raw_name: r.name, values }
  })
}

/** Rows where opening + purchase − sales − free ≠ closing (stockists adjust, so this is a warning, not a block). */
export function stockMismatches(lines: Line[], hasPurchase = true, tolerance = 0.5) {
  if (!hasPurchase) return { checked: 0, bad: [] as Line[] } // without receipts the equation can't be checked
  const usable = lines.filter(
    (l) => l.values.opening || l.values.closing || l.values.sales || l.values.purchase,
  )
  const bad = usable.filter((l) => {
    const v = l.values
    const inflow = v.opening + v.purchase + (v.purchase_free ?? 0)
    const adj = v.adjustment ?? 0
    // sales may or may not already include the free quantity; adjustments are added or taken off
    return ![0, v.sale_return ?? 0].some((back) =>
      [v.sales + v.free, v.sales].some((out) =>
        [adj, -adj].some((a) => Math.abs(inflow + back - out + a - v.closing) <= tolerance),
      ),
    )
  })
  return { checked: usable.length, bad }
}
