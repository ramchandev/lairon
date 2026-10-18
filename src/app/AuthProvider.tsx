import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/lib/constants'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  phone: string
  email: string | null
  area: string | null
  hq: string | null
  bio: string | null
  avatar_url: string | null
  is_active: boolean
}

export interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  /** True when a signed-in user has no active profile (deactivated or not set up). They are signed out. */
  blocked: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const PROFILE_COLS = 'id, role, full_name, phone, email, area, hq, bio, avatar_url, is_active'

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('id', userId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (cancelled) return
        const p = data as Profile | null
        if (!p || !p.is_active) {
          setBlocked(true)
          setProfile(null)
          await supabase.auth.signOut() // deactivated users are signed out
        } else {
          setBlocked(false)
          setProfile(p)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, tick])

  const value: AuthState = {
    session,
    profile,
    loading,
    blocked,
    signOut: async () => {
      await supabase.auth.signOut()
    },
    refreshProfile: async () => {
      setTick((t) => t + 1)
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
