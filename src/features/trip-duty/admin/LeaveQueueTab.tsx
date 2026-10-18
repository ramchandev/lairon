import { useMemo, useState } from 'react'
import { Check, CalendarCheck, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/components/Toast'
import { Avatar } from '@/components/Avatar'
import { Person } from '@/components/ListParts'
import { fmtDate } from '@/lib/format'
import { useDecideLeave, usePendingLeaves } from '../admin-api'
import { groupLeaves, type LeaveGroup } from '../logic'

/** Approvals queue: each request (a run of consecutive days) is approved or rejected as one. */
export function LeaveQueueTab() {
  const { data, isLoading } = usePendingLeaves()
  const decide = useDecideLeave()
  const toast = useToast()
  const [target, setTarget] = useState<{ g: LeaveGroup; status: 'approved' | 'rejected' } | null>(
    null,
  )
  const groups = useMemo(() => groupLeaves(data ?? []), [data])

  if (isLoading) return <div className="glass h-24 animate-pulse" aria-busy="true" />
  if (!groups.length)
    return (
      <div className="glass">
        <EmptyState
          icon={CalendarCheck}
          title="No pending leave requests"
          hint="Requests drivers send will wait here for your decision."
        />
      </div>
    )

  return (
    <>
      {groups.map((g) => (
        <section key={g.ids[0]} className="glass card mb-3">
          <div className="svc-head">
            <Person
              lead={<Avatar name={g.driverName ?? 'Driver'} />}
              name={g.driverName ?? 'Driver'}
              sub={g.reason ? `“${g.reason}”` : undefined}
            />
            <span className="badge b-warn">Pending</span>
          </div>
          <dl className="meta-grid sm four">
            <div>
              <dt>From</dt>
              <dd>{fmtDate(g.from)}</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>{fmtDate(g.to)}</dd>
            </div>
            <div>
              <dt>Days</dt>
              <dd>{g.days}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{g.type}</dd>
            </div>
          </dl>
          <div className="mt-4 flex gap-2.5">
            <button
              className="btn btn-soft-danger flex-1"
              onClick={() => setTarget({ g, status: 'rejected' })}
            >
              <X aria-hidden /> Reject
            </button>
            <button
              className="btn btn-primary flex-1"
              onClick={() => setTarget({ g, status: 'approved' })}
            >
              <Check aria-hidden /> Approve
            </button>
          </div>
        </section>
      ))}
      {target && (
        <ConfirmDialog
          open
          tone={target.status === 'approved' ? 'primary' : 'danger'}
          busy={decide.isPending}
          title={target.status === 'approved' ? 'Approve this leave?' : 'Reject this leave?'}
          confirmLabel={target.status === 'approved' ? 'Approve' : 'Reject'}
          reasonLabel={target.status === 'rejected' ? 'Reason (shown to the driver)' : undefined}
          description={
            <>
              <b>{target.g.driverName}</b> · {fmtDate(target.g.from)}
              {target.g.from !== target.g.to && <> – {fmtDate(target.g.to)}</>} ({target.g.days}{' '}
              {target.g.days === 1 ? 'day' : 'days'})
            </>
          }
          onCancel={() => setTarget(null)}
          onConfirm={(note) =>
            decide.mutate(
              { ids: target.g.ids, status: target.status, note },
              {
                onSuccess: () => {
                  toast(`Leave ${target.status}`)
                  setTarget(null)
                },
                onError: (e) => {
                  setTarget(null)
                  toast(e.message, 'error')
                },
              },
            )
          }
        />
      )}
    </>
  )
}
