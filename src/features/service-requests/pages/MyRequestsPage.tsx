import { Link } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { fmtDate, inr } from '@/lib/format'
import { batchTotal, useBatches } from '../api'
import { BatchBadge } from '../components/BatchBadge'

export function MyRequestsPage() {
  const { data, isLoading } = useBatches()
  if (isLoading)
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="glass h-20 animate-pulse" />
        <div className="glass h-20 animate-pulse" />
      </div>
    )
  const draft = data?.find((b) => b.status === 'draft')
  const sent = (data ?? []).filter((b) => b.status !== 'draft')

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>My Requests</h1>
          <p className="muted">{sent.length} submitted</p>
        </div>
      </div>
      {draft && draft.services.length > 0 && (
        <Link to="/m/request" className="glass req-card draft">
          <div className="rc-top">
            <b>Draft</b>
            <span className="badge b-muted">Not submitted</span>
          </div>
          <div className="muted mt-1 text-[13px]">
            {draft.services.length} service{draft.services.length > 1 ? 's' : ''} ·{' '}
            {inr(batchTotal(draft))} · tap to continue
          </div>
        </Link>
      )}
      {sent.length === 0 ? (
        <div className="glass">
          <EmptyState
            icon={ClipboardList}
            title="No requests yet"
            hint="Requests you submit show up here with their status."
          />
        </div>
      ) : (
        sent.map((b) => (
          <Link key={b.id} to={`/m/requests/view/${b.id}`} className="glass req-card">
            <div className="rc-top">
              <b className="mono">{b.ref_no}</b>
              <BatchBadge status={b.status} />
            </div>
            <div className="rc-amt mono">{inr(batchTotal(b))}</div>
            <div className="muted text-[13px]">
              {b.submitted_at ? fmtDate(b.submitted_at) : ''} · {b.services.length} service
              {b.services.length > 1 ? 's' : ''} ·{' '}
              {[...new Set(b.services.map((s) => s.doctor_name))].join(', ')}
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
