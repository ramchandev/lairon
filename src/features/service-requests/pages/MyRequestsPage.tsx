import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Eye } from 'lucide-react'
import { DataTable, type Column } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ChipFilter, SearchInput } from '@/components/ListControls'
import { IconLink } from '@/components/ListParts'
import { fmtDate, inr } from '@/lib/format'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { batchTotal, useBatches, type Batch } from '../api'
import { BatchBadge } from '../components/BatchBadge'

const doctorsOf = (b: Batch) => [...new Set(b.services.map((s) => s.doctor_name))]

/** A manager's home. Phone: request cards. Computer: a searchable table like the admin lists. */
export function MyRequestsPage() {
  const { data, isLoading } = useBatches()
  const desktop = useIsDesktop()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'submitted' | 'approved' | 'fulfilled' | 'rejected'>(
    'all',
  )
  const draft = data?.find((b) => b.status === 'draft')
  const sent = useMemo(() => (data ?? []).filter((b) => b.status !== 'draft'), [data])
  const rows = useMemo(
    () =>
      sent.filter(
        (b) =>
          (status === 'all' || b.status === status) &&
          `${b.ref_no} ${doctorsOf(b).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [sent, status, q],
  )

  if (isLoading)
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="glass h-20 animate-pulse" />
        <div className="glass h-20 animate-pulse" />
      </div>
    )

  const draftCard = draft && draft.services.length > 0 && (
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
  )

  const columns: Column<Batch>[] = [
    {
      key: 'ref',
      header: 'Request',
      primary: true,
      cell: (b) => (
        <div>
          <div className="pn mono font-bold">{b.ref_no}</div>
          <div className="ps">{b.submitted_at ? fmtDate(b.submitted_at) : ''}</div>
        </div>
      ),
    },
    { key: 'doc', header: 'Doctors', cell: (b) => doctorsOf(b).join(', ') || '—' },
    { key: 'n', header: 'Services', cell: (b) => b.services.length },
    {
      key: 'amt',
      header: 'Amount',
      cell: (b) => <span className="mono font-bold">{inr(batchTotal(b))}</span>,
    },
    { key: 'st', header: 'Status', cell: (b) => <BatchBadge status={b.status} /> },
  ]

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>My Requests</h1>
          <p className="muted">{sent.length} submitted</p>
        </div>
        {desktop && (
          <Link to="/m/request" className="btn btn-primary">
            New request
          </Link>
        )}
      </div>
      {draftCard}
      {sent.length === 0 ? (
        <div className="glass">
          <EmptyState
            icon={ClipboardList}
            title="No requests yet"
            hint="Requests you submit show up here with their status."
          />
        </div>
      ) : desktop ? (
        <>
          <div className="toolbar">
            <SearchInput value={q} onChange={setQ} placeholder="Search request no or doctor…" />
            <ChipFilter
              value={status}
              onChange={setStatus}
              options={[
                { key: 'all', label: 'All' },
                { key: 'submitted', label: 'Submitted' },
                { key: 'approved', label: 'Approved' },
                { key: 'fulfilled', label: 'Fulfilled' },
                { key: 'rejected', label: 'Rejected' },
              ]}
            />
          </div>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(b) => b.id}
            rowTo={(b) => `/m/requests/view/${b.id}`}
            empty={
              <EmptyState icon={ClipboardList} title="No results" hint="Try a different search." />
            }
            actions={(b) => (
              <IconLink to={`/m/requests/view/${b.id}`} label={`View ${b.ref_no}`} icon={Eye} />
            )}
          />
        </>
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
              {b.services.length > 1 ? 's' : ''} · {doctorsOf(b).join(', ')}
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
