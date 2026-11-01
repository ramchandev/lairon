import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const ALL_DIVISION = 'All Division'

/**
 * Division, Qualification and Speciality are independent lists: any doctor can be in any division, with any qualification
 * and speciality (the old division ↔ qualification ↔ speciality mapping was removed on the client's request).
 */
export interface CascadeData {
  divisions: { id: string; name: string }[]
  qualifications: { id: string; value: string }[]
  specialities: { id: string; value: string }[]
}

/** Division options: active divisions + "All Division". */
export const divisionOptions = (d: CascadeData) => [...d.divisions.map((x) => x.name), ALL_DIVISION]
export const qualificationOptions = (d: CascadeData) => d.qualifications.map((q) => q.value)
export const specialityOptions = (d: CascadeData) => d.specialities.map((s) => s.value)

export const useCascadeData = () =>
  useQuery({
    queryKey: ['lookup', 'cascade'], // under ['lookup'] so dropdown edits refresh it
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CascadeData> => {
      const [div, items] = await Promise.all([
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
      ])
      for (const r of [div, items]) if (r.error) throw r.error
      const rows = items.data as { id: string; value: string; list_key: string }[]
      return {
        divisions: div.data as CascadeData['divisions'],
        qualifications: rows.filter((r) => r.list_key === 'qualification'),
        specialities: rows.filter((r) => r.list_key === 'speciality'),
      }
    },
  })
