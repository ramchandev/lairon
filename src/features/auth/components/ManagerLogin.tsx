import { useState, type FormEvent } from 'react'
import { managerStartLogin, managerVerifyCode } from '../api'
import { inputCls, primaryBlock } from '@/components/form-styles'

/** Doctor's Manager: phone only (phone_only mode) or phone + 6-digit SMS code (otp mode). */
export function ManagerLogin() {
  const [phone, setPhone] = useState('')
  const [otpPhone, setOtpPhone] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onPhone(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const r = await managerStartLogin(phone)
    if (!r.ok) setError(r.error)
    else if (r.mode === 'otp') setOtpPhone(r.phone)
    // signed_in: AuthProvider picks up the session and the login page redirects.
    setBusy(false)
  }

  async function onCode(e: FormEvent) {
    e.preventDefault()
    if (!otpPhone) return
    setBusy(true)
    setError(null)
    const err = await managerVerifyCode(otpPhone, code)
    if (err) setError(err)
    setBusy(false)
  }

  if (otpPhone) {
    return (
      <form onSubmit={onCode} className="space-y-4">
        <p className="text-sm text-ink-2">We sent a 6-digit code to {otpPhone}.</p>
        <label className="block text-sm font-semibold">
          Code
          <input
            className={`${inputCls} mt-1 tabular tracking-[0.3em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button className={primaryBlock} disabled={busy || code.length !== 6}>
          {busy ? 'Checking…' : 'Verify and sign in'}
        </button>
        <button
          type="button"
          className="w-full text-sm font-semibold text-primary"
          onClick={() => {
            setOtpPhone(null)
            setCode('')
            setError(null)
          }}
        >
          Use a different number
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={onPhone} className="space-y-4">
      <label className="block text-sm font-semibold">
        Mobile number
        <div className="mt-1 flex gap-2">
          <span className="grid place-items-center rounded-control border border-line-2 bg-white/60 px-3 font-normal text-ink-2">
            +91
          </span>
          <input
            className={`${inputCls} tabular`}
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            required
          />
        </div>
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button className={primaryBlock} disabled={busy || phone.length !== 10}>
        {busy ? 'Please wait…' : 'Continue'}
      </button>
    </form>
  )
}
