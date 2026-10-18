import { useState } from 'react'
import { CircleX } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { fmtDate } from '@/lib/format'
import { useDeleteEntries, useLeaves } from '../api'
import { groupLeaves, type LeaveGroup } from '../logic'

const TONE = { pending: 'warn', approved: 'ok', rejected: 'danger' } as const

/** "My leave requests" on the driver's profile; a pending request can be cancelled. */
export function LeaveRequests() {
  const { data } = useLeaves()
  const del = useDeleteEntries()
  const toast = useToast()
  const [target, setTarget] = useState<LeaveGroup | null>(null)
  const groups = groupLeaves(data ?? [])
    .reverse()
    .slice(0, 10)
  if (!groups.length) return null
  return (
    <section>
      <h2 className="sec-h">My leave requests</h2>
      {groups.map((g) => (
        <article key={g.ids[0]} className="glass entry">
          <div className="entry-top">
            <b>{g.from === g.to ? fmtDate(g.from) : `${fmtDate(g.from)} – ${fmtDate(g.to)}`}</b>
            <StatusBadge tone={TONE[g.status]}>{g.status}</StatusBadge>
            {g.status === 'pending' && (
              <span className="acts">
                <button className="btn btn-soft-danger btn-sm" onClick={() => setTarget(g)}>
                  Cancel
                </button>
              </span>
            )}
          </div>
          <div className="entry-meta">
            <span>{g.type}</span>
            {g.reason && <span>{g.reason}</span>}
            <span>
              {g.days} {g.days === 1 ? 'day' : 'days'}
            </span>
          </div>
          {g.note && (
            <div className="note">
              <CircleX size={18} className="shrink-0" />
              <div>{g.note}</div>
            </div>
          )}
        </article>
      ))}
      <ConfirmDialog
        open={!!target}
        title="Cancel this leave request?"
        confirmLabel="Cancel request"
        busy={del.isPending}
        description={
          target && (
            <>
              {fmtDate(target.from)}
              {target.from !== target.to && <> – {fmtDate(target.to)}</>} will be removed.
            </>
          )
        }
        onCancel={() => setTarget(null)}
        onConfirm={() =>
          target &&
          del.mutate(target.ids, {
            onSuccess: () => {
              toast('Leave request cancelled')
              setTarget(null)
            },
            onError: (e) => {
              setTarget(null)
              toast(e.message, 'error')
            },
          })
        }
      />
    </section>
  )
}
