import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { normalizePhone } from '@/lib/phone'
import { adminCreateUser, adminUserAction } from '@/features/auth/api'
import type { ManagedRole, UserForm } from './schemas'

export interface UserRow {
  id: string
  role: ManagedRole
  full_name: string
  phone: string
  email: string | null
  area: string | null
  hq: string | null
  bio: string | null
  avatar_url: string | null
  is_active: boolean
}
const KEY = ['users']
const COLS = 'id, role, full_name, phone, email, area, hq, bio, avatar_url, is_active'

export const useUsers = (role: ManagedRole) =>
  useQuery({
    queryKey: [...KEY, role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(COLS)
        .eq('role', role)
        .order('full_name')
      if (error) throw error
      return data as UserRow[]
    },
  })

/** Counts for the tab badges. */
export const useUserCounts = () =>
  useQuery({
    queryKey: [...KEY, 'counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .in('role', ['staff', 'driver', 'manager'])
      if (error) throw error
      const c = { staff: 0, driver: 0, manager: 0, admin: 0 }
      for (const r of data) c[r.role as ManagedRole]++
      return c
    },
  })

export const useUser = (id?: string) =>
  useQuery({
    queryKey: [...KEY, 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(COLS)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as UserRow | null
    },
  })

export function useCreateUser(role: ManagedRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: UserForm) =>
      adminCreateUser({
        role,
        full_name: v.full_name,
        phone: v.phone,
        email: v.email || undefined,
        area: v.area || undefined,
        hq: v.hq || undefined,
        bio: v.bio || undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateUser(id: string, role: ManagedRole) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: UserForm) => {
      const patch: Record<string, string | null> = {
        full_name: v.full_name.trim(),
        phone: normalizePhone(v.phone),
        area: v.area || null,
        hq: v.hq || null,
        bio: v.bio || null,
      }
      // Staff/driver email is their login identity; only a manager's optional contact email is editable.
      if (role === 'manager') patch.email = v.email || null
      const { error } = await supabase.from('profiles').update(patch).eq('id', id)
      if (error)
        throw new Error(
          error.code === '23505' ? 'Another user already has this phone number.' : error.message,
        )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUserAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ action, id }: { action: Parameters<typeof adminUserAction>[0]; id: string }) =>
      adminUserAction(action, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
