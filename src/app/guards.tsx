import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { ROLE_HOME, type UserRole } from '@/lib/constants'

export function RequireRole({ role }: { role: UserRole }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading)
    return <div className="grid min-h-screen place-items-center text-muted">Loading…</div>
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  if (!profile || !profile.is_active) return <Navigate to="/login" replace />
  if (profile.role !== role) return <Navigate to={ROLE_HOME[profile.role]} replace />
  return <Outlet />
}

export function HomeRedirect() {
  const { session, profile, loading } = useAuth()
  if (loading) return null
  if (!session || !profile) return <Navigate to="/login" replace />
  return <Navigate to={ROLE_HOME[profile.role]} replace />
}
