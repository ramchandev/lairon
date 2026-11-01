import { useState } from 'react'
import { IndianRupee, Lock, Pencil } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { inr } from '@/lib/format'
import { monthLabel } from '@/lib/time'
import {
  parseAmount,
  revenueLocked,
  revenueMonths,
  useSetServiceRevenue,
  type RevenueRow,
} from '../revenue'
import { RevenueConfirm } from './RevenueConfirm'

/**
 * Month-on-month revenue for ONE service (what the doctor brings in because of it). The manager who handles the request
 * enters the current month; a month that has ended is locked once it has an entry (an admin can still change it).
 */
export function ServiceRevenue({
  serviceId,
  doctorName,
  startDate,
  rows,
  canEnter,
}: {
  serviceId: string
  doctorName: string
  startDate: string
  rows: RevenueRow[]
  /** false while the request is a draft/rejected, or when someone other than its manager/admin is looking. */
  canEnter: boolean
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const set = useSetServiceRevenue()
  const [editing, setEditing] = useState<{ month: string; text: string } | null>(null)
  const [confirm, setConfirm] = useState<{ month: string; amount: number } | null>(null)
  const saved = new Map(rows.map((r) => [r.month.slice(0, 7), r]))
  const months = revenueMonths(startDate)
  const parsed = editing ? parseAmount(editing.text) : null
  const total = rows.reduce((n, r) => n + r.amount, 0)

  return (
    <div className="mt-4 border-t border-line pt-3.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <b className="text-[13.5px]">Monthly revenue</b>
        {rows.length > 0 && <span className="muted mono text-[13px]">Total {inr(total)}</span>}
      </div>
      <ul className="plist">
        {months.map((m) => {
          const row = saved.get(m)
          const locked = revenueLocked(profile?.role, m, !!row)
          const isEditing = editing?.month === m
          return (
            <li key={m}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{monthLabel(m)}</p>
                {row?.entered_by_name && (
                  <p className="muted text-[12.5px]">Entered by {row.entered_by_name}</p>
                )}
              </div>
              {isEditing ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="input-group w-36">
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
                    disabled={parsed === null || parsed === (row?.amount ?? null)}
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
                  {!canEnter ? null : locked ? (
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
                      onClick={() => setEditing({ month: m, text: row ? String(row.amount) : '' })}
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
      <RevenueConfirm
        open={!!confirm}
        doctorName={doctorName}
        month={confirm?.month ?? months[0]}
        previous={confirm ? (saved.get(confirm.month)?.amount ?? null) : null}
        next={confirm?.amount ?? 0}
        admin={profile?.role === 'admin'}
        busy={set.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          confirm &&
          set.mutate(
            { serviceId, month: confirm.month, amount: confirm.amount },
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
    </div>
  )
}
