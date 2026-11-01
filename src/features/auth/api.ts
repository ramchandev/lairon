import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/** Pull a human message out of an Edge Function error. */
async function fnError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body?.error) return String(body.error)
    } catch {
      /* fall through */
    }
  }
  if (error instanceof FunctionsFetchError)
    return 'Could not reach the server. If this keeps happening, the site address may not be allowed yet (APP_URL in Supabase secrets) — ask your administrator.'
  return 'Something went wrong. Please try again.'
}

export async function sendPasswordReset(email: string): Promise<void> {
  // Result is deliberately ignored: never reveal whether the email exists.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/set-password`,
  })
}

// ── Admin-only (used by the Users screens in Phase 3) ──
export interface CreateUserInput {
  role: 'admin' | 'staff' | 'driver' | 'manager'
  full_name: string
  phone: string
  email?: string
  area?: string
  hq?: string
  bio?: string
  /** Drivers are created with an admin-set password (no email is sent). */
  password?: string
}

export async function adminCreateUser(input: CreateUserInput) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', { body: input })
  if (error) throw new Error(await fnError(error))
  return data as {
    id: string
    email_sent: boolean
    email_error?: string
    invite_link: string | null
  }
}

export async function adminUserAction(
  action:
    'deactivate' | 'reactivate' | 'force_logout' | 'resend_invite' | 'set_password' | 'set_email',
  userId: string,
  password?: string,
  email?: string,
) {
  const { data, error } = await supabase.functions.invoke('admin-user-action', {
    body: { action, user_id: userId, password, email },
  })
  if (error) throw new Error(await fnError(error))
  return data as { ok: boolean; email_sent?: boolean; invite_link?: string | null }
}
