import { Link } from 'react-router-dom'
import { Package, Plus } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { fmtDate } from '@/lib/format'
import { usePacks } from '../api'
import { PackBadge } from '../components/PackBadge'

export function MyPacksPage() {
  const { data, isLoading } = usePacks()
  return (
    <div>
      <div className="page-h">
        <div>
          <h1>My Requests</h1>
          <p className="muted">{data?.length ?? 0} starter packs</p>
        </div>
        <Link to="/staff/new" className="btn btn-primary hidden lg:inline-flex">
          <Plus aria-hidden /> New starter pack
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <div className="glass h-20 animate-pulse" />
          <div className="glass h-20 animate-pulse" />
        </div>
      ) : !data?.length ? (
        <div className="glass">
          <EmptyState
            icon={Package}
            title="No starter packs yet"
            hint="Requests you raise appear here with their status."
            action={
              <Link to="/staff/new" className="btn btn-primary">
                <Plus aria-hidden /> New starter pack
              </Link>
            }
          />
        </div>
      ) : (
        data.map((p) => (
          <Link key={p.id} to={`/staff/requests/${p.id}`} className="glass req-card">
            <div className="rc-top">
              <b className="mono">{p.ref_no}</b>
              <PackBadge status={p.status} />
            </div>
            <div className="rc-amt">{p.doctor_name}</div>
            <div className="muted text-[13px]">
              {fmtDate(p.request_date)} · {p.division} · {p.items.length}{' '}
              {p.items.length === 1 ? 'product' : 'products'}
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
