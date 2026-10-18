import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Active items of a managed dropdown list, in admin-defined order. Values are saved as plain text snapshots. */
export function useLookup(listKey: string) {
  return useQuery({
    queryKey: ['lookup', listKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lookup_items')
        .select('id, value')
        .eq('list_key', listKey)
        .eq('is_active', true)
        .order('sort_order')
        .order('value')
      if (error) throw error
      return data as { id: string; value: string }[]
    },
    staleTime: 5 * 60_000,
  })
}
