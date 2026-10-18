import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const ALL_DIVISION = 'All Division'

export interface CascadeData {
  divisions: { id: string; name: string }[]
  qualifications: { id: string; value: string }[]
  specialities: { id: string; value: string }[]
  pairs: { division_id: string; qualification_item_id: string; speciality_item_id: string }[]
}

const ci = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Division options: active divisions + "All Division". */
export const divisionOptions = (d: CascadeData) => [...d.divisions.map((x) => x.name), ALL_DIVISION]

function divisionId(d: CascadeData, division: string): string | null {
  if (!division || ci(division, ALL_DIVISION)) return null
  return d.divisions.find((x) => ci(x.name, division))?.id ?? null
}

const pick = (all: { id: string; value: string }[], ids: Set<string>) =>
  all.filter((x) => ids.has(x.id)).map((x) => x.value)

/** Mapped qualifications for the division; "All Division" or no mapping → every active qualification. */
export function qualificationOptions(d: CascadeData, division: string): string[] {
  const id = divisionId(d, division)
  if (id) {
    const mapped = pick(
      d.qualifications,
      new Set(d.pairs.filter((p) => p.division_id === id).map((p) => p.qualification_item_id)),
    )
    if (mapped.length) return mapped
  }
  return d.qualifications.map((q) => q.value)
}

/** Specialities for (division + qualification) → else for the division → else all active. */
export function specialityOptions(
  d: CascadeData,
  division: string,
  qualification: string,
): string[] {
  const id = divisionId(d, division)
  if (id) {
    const forDivision = d.pairs.filter((p) => p.division_id === id)
    const q = qualification ? d.qualifications.find((x) => ci(x.value, qualification)) : undefined
    if (q) {
      const exact = pick(
        d.specialities,
        new Set(
          forDivision
            .filter((p) => p.qualification_item_id === q.id)
            .map((p) => p.speciality_item_id),
        ),
      )
      if (exact.length) return exact
    }
    const mapped = pick(d.specialities, new Set(forDivision.map((p) => p.speciality_item_id)))
    if (mapped.length) return mapped
  }
  return d.specialities.map((s) => s.value)
}

/** True when the division → qualification → speciality lists were narrowed by the mapping (for the "filtered" note). */
export const isFiltered = (d: CascadeData, division: string) =>
  !!divisionId(d, division) && d.pairs.some((p) => p.division_id === divisionId(d, division))

export const useCascadeData = () =>
  useQuery({
    queryKey: ['lookup', 'cascade'], // under ['lookup'] so dropdown edits refresh it
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CascadeData> => {
      const [div, items, map] = await Promise.all([
        supabase
          .from('divisions')
          .select('id, name')
          .eq('is_active', true)
          .order('sort_order')
          .order('name'),
        supabase
          .from('lookup_items')
          .select('id, value, list_key')
          .in('list_key', ['qualification', 'speciality'])
          .eq('is_active', true)
          .order('sort_order')
          .order('value'),
        supabase
          .from('division_qual_spec_map')
          .select('division_id, qualification_item_id, speciality_item_id'),
      ])
      for (const r of [div, items, map]) if (r.error) throw r.error
      const rows = items.data as { id: string; value: string; list_key: string }[]
      return {
        divisions: div.data as CascadeData['divisions'],
        qualifications: rows.filter((r) => r.list_key === 'qualification'),
        specialities: rows.filter((r) => r.list_key === 'speciality'),
        pairs: map.data as CascadeData['pairs'],
      }
    },
  })
