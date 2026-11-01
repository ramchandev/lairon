import { useState } from 'react'
import { IndianRupee, Lock, Pencil } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { inr } from '@/lib/format'
import { monthLabel, shiftMonth } from '@/lib/time'
import {
  currentMonthKey,
  parseAmount,
  revenueLocked,
  useDoctorRevenue,
  useSetRevenue,
} from '../revenue'
import { RevenueConfirm } from './RevenueConfirm'

/** Monthly revenue this doctor brings in: current + the last 11 months (and any older saved month). Past months freeze once entered. */
export function DoctorRevenue({ doctorId, doctorName }: { doctorId: string; doctorName: string }) {
  const { profile } = useAuth()
  const toast = useToast()
  const q = useDoctorRevenue(doctorId)
  const set = useSetRevenue()
  const [editing, setEditing] = useState<{ month: string; text: string } | null>(null)
  const [confirm, setConfirm] = useState<{ month: string; amount: number } | null>(null)
  if (profile?.role !== 'admin' && profile?.role !== 'manager') return null

  const saved = new Map((q.data ?? []).map((r) => [r.month.slice(0, 7), r]))
  const now = currentMonthKey()
  const months = [
    ...new Set([...Array.from({ length: 12 }, (_, i) => shiftMonth(now, -i)), ...saved.keys()]),
  ].sort((a, b) => b.localeCompare(a))
  const amountOf = (m: string) => saved.get(m)?.amount ?? null
  const parsed = editing ? parseAmount(editing.text) : null

  return (
    <>
      <h2 className="sec-h">Monthly revenue</h2>
      <section className="glass card">
        <p className="muted mb-2 text-[13px]">
          What this doctor brings in each month. You can edit the current month; once a month has
          ended its figure is locked (an admin can still change it).
        </p>
        <ul className="plist">
          {months.map((m) => {
            const row = saved.get(m)
            const locked = revenueLocked(profile.role, m, !!row)
            const isEditing = editing?.month === m
            return (
              <li key={m}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{monthLabel(m)}</p>
                  {row?.entered_by_name && (
                    <p className="muted text-[13px]">Entered by {row.entered_by_name}</p>
                  )}
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <div className="input-group w-40">
                      <span className="prefix">₹</span>
                      <input
                        autoFocus
                        className={`${inputCls} mono`}
                        inputMode="decimal"
                        aria-label={`Revenue for ${monthLabel(m)}`}
                        value={editing.text}
                        onChange={(e) => setEditing({ month: m, text: e.target.value })}
                      />
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={parsed === null || parsed === amountOf(m)}
                      onClick={() => parsed !== null && setConfirm({ month: m, amount: parsed })}
                    >
                      Save
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="mono font-bold">{row ? inr(row.amount) : '—'}</span>
                    {locked ? (
                      <span
                        className="muted inline-flex items-center gap-1 text-[13px]"
                        title="Locked: the month has ended"
                      >
                        <Lock size={14} aria-hidden /> Locked
                      </span>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        aria-label={`${row ? 'Edit' : 'Enter'} revenue for ${monthLabel(m)}`}
                        onClick={() =>
                          setEditing({ month: m, text: row ? String(row.amount) : '' })
                        }
                      >
                        {row ? <Pencil aria-hidden /> : <IndianRupee aria-hidden />}{' '}
                        {row ? 'Edit' : 'Enter'}
                      </button>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </section>
      <RevenueConfirm
        open={!!confirm}
        doctorName={doctorName}
        month={confirm?.month ?? now}
        previous={confirm ? amountOf(confirm.month) : null}
        next={confirm?.amount ?? 0}
        admin={profile.role === 'admin'}
        busy={set.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          confirm &&
          set.mutate(
            { doctorId, month: confirm.month, amount: confirm.amount },
            {
              onSuccess: () => {
                toast('Revenue saved')
                setConfirm(null)
                setEditing(null)
              },
              onError: (e) => {
                setConfirm(null)
                toast(e.message, 'error')
              },
            },
          )
        }
      />
    </>
  )
}
