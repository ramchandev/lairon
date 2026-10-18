import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/app/AuthProvider'
import { ROLE_HOME } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { EmailLogin } from './components/EmailLogin'
import { ManagerLogin } from './components/ManagerLogin'

export function LoginPage() {
  const { session, profile, blocked } = useAuth()
  const [tab, setTab] = useState<'email' | 'manager'>('email')

  if (session && profile) return <Navigate to={ROLE_HOME[profile.role]} replace />

  return (
    <div className="glass p-5">
      <div role="tablist" className="mb-5 grid grid-cols-2 gap-1 rounded-control bg-muted-bg p-1">
        {(['email', 'manager'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'min-h-10 rounded-[10px] text-sm font-semibold text-muted',
              tab === t && 'bg-white text-primary shadow-sm',
            )}
          >
            {t === 'email' ? 'Email' : 'Doctor’s Manager'}
          </button>
        ))}
      </div>

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

      {tab === 'email' ? <EmailLogin /> : <ManagerLogin />}
    </div>
  )
}
