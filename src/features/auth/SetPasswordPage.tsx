import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/AuthProvider'
import { passwordSchema } from './schemas'
import { inputCls, primaryBlock } from '@/components/form-styles'
import type { z } from 'zod'

type Form = z.infer<typeof passwordSchema>

/** Landing page for invite and password-reset links. supabase-js turns the link into a session. */
export function SetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(passwordSchema) })

  if (loading) return <div className="glass p-5 text-center text-muted">Checking your link…</div>
  if (!session) {
    return (
      <div className="glass space-y-3 p-5 text-sm">
        <p className="font-semibold">This link has expired or was already used.</p>
        <p className="text-ink-2">
          Ask your admin to resend the invite, or use “Forgot password?” on the sign-in page.
        </p>
        <Link to="/login" className="font-semibold text-primary">
          Go to sign in
        </Link>
      </div>
    )
  }

  async function onSubmit(v: Form) {
    setServerError(null)
    const { error } = await supabase.auth.updateUser({ password: v.password })
    if (error) return setServerError(error.message)
    navigate('/', { replace: true })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glass space-y-4 p-5" noValidate>
      <h1 className="text-lg font-extrabold tracking-tight">Set your password</h1>
      <label className="block text-sm font-semibold">
        New password
        <input
          className={`${inputCls} mt-1`}
          type="password"
          autoComplete="new-password"
          {...register('password')}
        />
        {errors.password && (
          <span role="alert" className="mt-1 block text-xs font-normal text-danger">
            {errors.password.message}
          </span>
        )}
      </label>
      <label className="block text-sm font-semibold">
        Confirm password
        <input
          className={`${inputCls} mt-1`}
          type="password"
          autoComplete="new-password"
          {...register('confirm')}
        />
        {errors.confirm && (
          <span role="alert" className="mt-1 block text-xs font-normal text-danger">
            {errors.confirm.message}
          </span>
        )}
      </label>
      {serverError && (
        <p role="alert" className="text-sm text-danger">
          {serverError}
        </p>
      )}
      <button className={primaryBlock} disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save password'}
      </button>
    </form>
  )
}
