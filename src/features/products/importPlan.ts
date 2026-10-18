import { csvToObjects } from '@/lib/csv'
import type { ImportRow, Product } from './api'

/** Turn CSV text into a reviewable plan. Columns: name, description, divisions ("OL|CC"). Pure, so it's unit-tested. */
export function planProductImport(
  text: string,
  divisions: { id: string; name: string }[],
  existing: Pick<Product, 'id' | 'name'>[],
): ImportRow[] {
  const byDiv = new Map(divisions.map((d) => [d.name.toLowerCase(), d.id]))
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p.id]))
  const seen = new Set<string>()

  return csvToObjects(text).map((o, i): ImportRow => {
    const line = i + 2 // header is line 1
    const name = (o.name ?? '').trim()
    const description = (o.description ?? '').trim()
    const base = { line, name, description, divisionIds: [] as string[] }
    if (!name) return { ...base, status: 'error', error: 'Name is missing' }
    if (seen.has(name.toLowerCase()))
      return { ...base, status: 'error', error: 'Duplicate name in this file' }
    seen.add(name.toLowerCase())

    const names = (o.divisions ?? '')
      .split(/[|;]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const unknown = names.filter((n) => !byDiv.has(n.toLowerCase()))
    if (unknown.length)
      return { ...base, status: 'error', error: `Unknown division: ${unknown.join(', ')}` }
    const divisionIds = names.map((n) => byDiv.get(n.toLowerCase())!)

    const existingId = byName.get(name.toLowerCase())
    return existingId
      ? { ...base, divisionIds, status: 'update', existingId }
      : { ...base, divisionIds, status: 'new' }
  })
}
