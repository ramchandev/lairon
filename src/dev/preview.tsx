// DEV ONLY (never in the production bundle): `?preview=admin|driver|manager|staff` signs in a fake user so the real layouts
// can be compared with design/lairon-ez-prototype.html without a Supabase session. Data queries still run (and come back empty).
import type { ReactNode } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { AuthContext, type AuthState, type Profile } from '@/app/AuthProvider'

const NAMES = {
  admin: 'Admin User',
  staff: 'Staff One',
  driver: 'Prakalathan M',
  manager: 'Dr. Meena Rao',
} as const
export type PreviewRole = keyof typeof NAMES

export function PreviewAuth({ role, children }: { role: PreviewRole; children: ReactNode }) {
  const profile: Profile = {
    id: 'preview',
    role,
    full_name: NAMES[role],
    phone: '+919876543210',
    email: 'admin@lairon.in',
    area: null,
    hq: null,
    bio: null,
    avatar_url: null,
    is_active: true,
  }
  const value: AuthState = {
    session: { user: { id: 'preview' } } as Session,
    profile,
    loading: false,
    blocked: false,
    signOut: async () => {},
    refreshProfile: async () => {},
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function seedPreview(qc: QueryClient) {
  qc.setQueryData(['dashboard'], {
    month: '2026-10',
    pending_service_requests: 3,
    pending_starter_packs: 2,
    drivers_on_duty_now: 2,
    drivers_with_duty_today: 4,
    pending_leave_requests: 1,
    pending_leave_days: 2,
    beta_total: 17600,
    beta_payable_days: 68,
    total_km: 12345,
    fuel_amount: 45000,
    fuel_litres: 410,
  })
  qc.setQueryData(['more-counts'], {
    users: 14,
    doctors: 28,
    vehicles: 6,
    divisions: 3,
    products: 81,
  })
  qc.setQueryData(['batches', 'draft'], { id: 'd', status: 'draft', services: [{}, {}] })
}
