import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { sendPasswordReset } from '../api'
import { inputCls, primaryBlock } from '@/components/form-styles'

export function EmailLogin() {
  const [mode, setMode] = useState<'signin' | 'forgot' | 'sent'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSignIn(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError('Email or password is incorrect.') // generic on purpose
    setBusy(false)
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    await sendPasswordReset(email.trim())
    setBusy(false)
    setMode('sent')
  }

  if (mode === 'sent') {
    return (
      <div className="space-y-4 text-sm">
        <p className="font-semibold">Check your email</p>
        <p className="text-ink-2">
          If an account exists for {email}, we’ve sent a link to set a new password.
        </p>
        <button className="font-semibold text-primary" onClick={() => setMode('signin')}>
          Back to sign in
        </button>
      </div>
    )
  }

  if (mode === 'forgot') {
    return (
      <form onSubmit={onForgot} className="space-y-4">
        <p className="text-sm text-ink-2">
          Enter your email and we’ll send you a link to set a new password.
        </p>
        <label className="block text-sm font-semibold">
          Email
          <input
            className={`${inputCls} mt-1`}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <button className={primaryBlock} disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
        <button
          type="button"
          className="w-full text-sm font-semibold text-primary"
          onClick={() => setMode('signin')}
        >
          Back to sign in
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={onSignIn} className="space-y-4">
      <label className="block text-sm font-semibold">
        Email
        <input
          className={`${inputCls} mt-1`}
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm font-semibold">
        Password
        <div className="relative mt-1">
          <input
            className={`${inputCls} pr-12`}
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted"
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button className={primaryBlock} disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <button
        type="button"
        className="w-full text-sm font-semibold text-primary"
        onClick={() => {
          setMode('forgot')
          setError(null)
        }}
      >
        Forgot password?
      </button>
    </form>
  )
}
