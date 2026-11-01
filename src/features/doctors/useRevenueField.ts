import { useState } from 'react'
import { parseAmount, revenueLocked, useDoctorRevenue } from './revenue'

/**
 * The monthly-revenue input for one doctor and month: the saved figure, what the user typed, whether the month is locked
 * for them, and whether there is something new to save. Typing resets when the doctor or month changes.
 */
export function useRevenueField(doctorId: string, month: string, role?: string) {
  const q = useDoctorRevenue(doctorId || undefined)
  const saved = q.data?.find((r) => r.month.slice(0, 7) === month)?.amount ?? null
  const key = `${doctorId}|${month}`
  const [typed, setTyped] = useState<{ key: string; value: string } | null>(null)
  const text = typed && typed.key === key ? typed.value : saved !== null ? String(saved) : ''
  const locked = revenueLocked(role, month, saved !== null)
  const parsed = text.trim() === '' ? null : parseAmount(text)
  return {
    loading: q.isLoading,
    saved,
    text,
    setText: (value: string) => setTyped({ key, value }),
    parsed,
    invalid: text.trim() !== '' && parsed === null,
    locked,
    /** A valid new amount that differs from what is saved (and the user is allowed to save it). */
    changed: !locked && parsed !== null && parsed !== saved,
  }
}
export type RevenueFieldState = ReturnType<typeof useRevenueField>
