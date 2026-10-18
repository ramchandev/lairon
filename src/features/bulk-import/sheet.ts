import { cell, parseDate, parseNumber, type Issue } from '@/features/trip-duty/import/parse'

export { cell, parseDate, parseNumber }
export type { Issue }

export interface FieldSpec {
  key: string
  label: string
  /** Extra header spellings (case, spaces and punctuation are ignored when matching). */
  aliases?: string[]
}
export type Rec = Record<string, unknown> & { __line: number }

export const norm = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** First sheet of an .xlsx / .xls / .csv as rows of cells (header in the first non-empty row). SheetJS loads on demand. */
export async function readSheet(file: File): Promise<unknown[][]> {
  const XLSX = await import('xlsx')
  // raw:true keeps CSV text as typed (no month-first date guessing); dates stay as Excel serials.
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, raw: true })
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  })
}

/** Rows keyed by field. `unknown` = headers we did not recognise; `missing` = fields with no column. */
export function toRecords(aoa: unknown[][], fields: FieldSpec[]) {
  const byHeader = new Map<string, string>()
  for (const f of fields)
    for (const a of [f.label, f.key, ...(f.aliases ?? [])]) byHeader.set(norm(a), f.key)
  const headerIdx = aoa.findIndex((r) => r.some((c) => cell(c) !== null))
  const head = headerIdx >= 0 ? aoa[headerIdx] : []
  const cols = head.map((h) => byHeader.get(norm(h)) ?? null)
  const unknown = head.filter((h, i) => cols[i] === null && cell(h) !== null).map(String)
  const present = new Set(cols.filter(Boolean))
  const missing = fields.filter((f) => !present.has(f.key)).map((f) => f.key)
  const records: Rec[] = []
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = aoa[i]
    if (!row || row.every((c) => cell(c) === null)) continue
    const rec: Rec = { __line: i + 1 }
    cols.forEach((k, c) => {
      if (k) rec[k] = row[c]
    })
    records.push(rec)
  }
  return { records, unknown, missing }
}

/** Plain text of a cell ('' when blank); numbers lose a trailing ".0" (phone numbers saved as numbers in Excel). */
export const text = (v: unknown): string => {
  const c = cell(v)
  return c === null ? '' : typeof c === 'number' ? String(c) : c
}

/** Downloads a .xlsx template (header + example rows). */
export async function downloadSheetTemplate(
  fileName: string,
  header: string[],
  rows: (string | number)[][],
  sheetName = 'Import',
) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws['!cols'] = header.map((h) => ({ wch: Math.max(14, h.length + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, fileName)
}

/** Case-insensitive match against a list of allowed values; returns the canonical spelling. */
export const canonical = (value: string, allowed: string[]) =>
  allowed.find((a) => norm(a) === norm(value)) ?? null

export interface BulkRow {
  line: number
  issues: Issue[]
}
export const hasError = (r: BulkRow) => r.issues.some((i) => i.severity === 'error')

/** Finds a person by 10-digit mobile or by (case/space-insensitive) full name; null when absent or ambiguous. */
export function matchPerson<T extends { full_name: string; phone: string }>(
  value: string,
  people: T[],
  normalizePhone: (s: string) => string | null,
): T | null {
  if (!value) return null
  const p = normalizePhone(value)
  if (p) return people.find((x) => x.phone === p) ?? null
  const hits = people.filter((x) => norm(x.full_name) === norm(value))
  return hits.length === 1 ? hits[0] : null
}
