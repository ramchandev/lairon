import { Navigate } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/app/AuthProvider'
import { ROLE_HOME } from '@/lib/constants'
import { EmailLogin } from './components/EmailLogin'

/** One sign-in for everyone (Super Admin, Manager, Staff, Driver): email + password. */
export function LoginPage() {
  const { session, profile, blocked } = useAuth()

  if (session && profile) return <Navigate to={ROLE_HOME[profile.role]} replace />

  return (
    <div className="glass p-5">
      {!isSupabaseConfigured && (
        <p className="mb-4 rounded-control bg-warn-bg p-3 text-sm text-warn">
          Supabase isn’t configured. Add your URL and anon key to <code>.env</code> and restart{' '}
          <code>npm run dev</code>.
        </p>
      )}
      {blocked && (
        <p role="alert" className="mb-4 rounded-control bg-danger-bg p-3 text-sm text-danger">
          Your account isn’t active. Please contact your admin.
        </p>
      )}

      <EmailLogin />
    </div>
  )
}
