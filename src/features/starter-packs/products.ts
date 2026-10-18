import { ALL_DIVISION } from '@/features/lookups/cascade'

interface P {
  id: string
  name: string
  is_active: boolean
  division_ids: string[]
}
interface D {
  id: string
  name: string
}

/** Products offered for a division tab. "All Division" = every active product. */
export function productsForDivision(
  products: P[],
  divisions: D[],
  division: string,
): { id: string; name: string }[] {
  const active = products.filter((p) => p.is_active)
  const div = divisions.find((d) => d.name.toLowerCase() === division.toLowerCase())
  const list =
    !div || division === ALL_DIVISION
      ? active
      : active.filter((p) => p.division_ids.includes(div.id))
  return list.map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}
