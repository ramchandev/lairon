import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { normalizePhone } from '@/lib/phone'

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

export type ManagerStart =
  | { ok: true; mode: 'signed_in' }
  | { ok: true; mode: 'otp'; phone: string }
  | { ok: false; error: string }

/** Step 1 of Doctor's Manager sign-in. phone_only signs in directly; otp sends an SMS code. */
export async function managerStartLogin(rawPhone: string): Promise<ManagerStart> {
  const phone = normalizePhone(rawPhone)
  if (!phone) return { ok: false, error: 'Enter a valid 10-digit mobile number' }
  const { data, error } = await supabase.functions.invoke('manager-phone-login', {
    body: { phone },
  })
  if (error) return { ok: false, error: await fnError(error) }

  if (data.mode === 'otp') {
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: false },
    })
    return otpErr
      ? { ok: false, error: 'Could not send the code. Please try again.' }
      : { ok: true, mode: 'otp', phone }
  }
  const { error: vErr } = await supabase.auth.verifyOtp({
    token_hash: data.token_hash,
    type: 'magiclink',
  })
  return vErr
    ? { ok: false, error: 'Sign-in failed. Please try again.' }
    : { ok: true, mode: 'signed_in' }
}

/** Step 2 (otp mode only). */
export async function managerVerifyCode(phone: string, token: string): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
  return error ? 'That code is not correct or has expired.' : null
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
  action: 'deactivate' | 'reactivate' | 'force_logout' | 'resend_invite' | 'set_password',
  userId: string,
  password?: string,
) {
  const { data, error } = await supabase.functions.invoke('admin-user-action', {
    body: { action, user_id: userId, password },
  })
  if (error) throw new Error(await fnError(error))
  return data as { ok: boolean; email_sent?: boolean; invite_link?: string | null }
}
