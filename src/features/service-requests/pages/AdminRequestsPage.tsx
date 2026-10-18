import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Eye, Inbox } from 'lucide-react'
import { DataTable, type Column } from '@/components/DataTable'
import { IconLink } from '@/components/ListParts'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/FormPage'
import { SearchInput, Tabs } from '@/components/ListControls'
import { inputCls } from '@/components/form-styles'
import { useDivisions } from '@/features/divisions/api'
import { useLookup } from '@/features/lookups/hooks'
import { fmtDate, inr } from '@/lib/format'
import { batchTotal, useBatches, type Batch } from '../api'
import { BatchBadge } from '../components/BatchBadge'
import { exportBatchesCsv } from '../export'
import type { BatchStatus } from '../status'

type Tab = 'all' | Exclude<BatchStatus, 'draft'>
const TABS: Tab[] = ['all', 'submitted', 'approved', 'fulfilled', 'rejected']
const sel = inputCls

export function AdminRequestsPage() {
  const { data, isLoading } = useBatches()
  const divisions = useDivisions()
  const hqs = useLookup('hq')
  const [params] = useSearchParams()
  const initial = params.get('status') as Tab | null
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : 'all')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [manager, setManager] = useState('')
  const [staff, setStaff] = useState('')
  const [division, setDivision] = useState('')
  const [hq, setHq] = useState('')

  const submitted = useMemo(() => (data ?? []).filter((b) => b.status !== 'draft'), [data])
  const people = (key: 'manager_name' | 'accountability_staff_name') =>
    [...new Set(submitted.map((b) => b[key]).filter(Boolean) as string[])].sort()

  const rows = useMemo(
    () =>
      submitted.filter((b) => {
        if (tab !== 'all' && b.status !== tab) return false
        const day = (b.submitted_at ?? b.created_at).slice(0, 10)
        if (from && day < from) return false
        if (to && day > to) return false
        if (manager && b.manager_name !== manager) return false
        if (staff && b.accountability_staff_name !== staff) return false
        if (division && !b.services.some((s) => s.division === division)) return false
        if (hq && !b.services.some((s) => s.hq === hq)) return false
        return `${b.ref_no} ${b.manager_name} ${b.accountability_staff_name} ${b.services.map((s) => s.doctor_name).join(' ')}`
          .toLowerCase()
          .includes(q.trim().toLowerCase())
      }),
    [submitted, tab, q, from, to, manager, staff, division, hq],
  )
  const count = (s: Tab) =>
    s === 'all' ? submitted.length : submitted.filter((b) => b.status === s).length

  const columns: Column<Batch>[] = [
    {
      key: 'ref',
      header: 'Request',
      primary: true,
      cell: (b) => (
        <div>
          <div className="pn mono font-bold">{b.ref_no}</div>
          <div className="ps">{b.submitted_at ? fmtDate(b.submitted_at) : '—'}</div>
        </div>
      ),
    },
    { key: 'manager', header: 'Manager', cell: (b) => b.manager_name ?? '—' },
    { key: 'staff', header: 'Accountability', cell: (b) => b.accountability_staff_name ?? '—' },
    { key: 'n', header: 'Services', cell: (b) => b.services.length },
    {
      key: 'total',
      header: 'Amount',
      cell: (b) => <span className="mono font-bold">{inr(batchTotal(b))}</span>,
    },
    { key: 'status', header: 'Status', cell: (b) => <BatchBadge status={b.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Service Requests"
        subtitle="Raised by doctor’s managers"
        action={
          <button
            className="btn btn-ghost"
            disabled={rows.length === 0}
            onClick={() =>
              exportBatchesCsv(rows, `service-requests-${new Date().toISOString().slice(0, 10)}`)
            }
          >
            <Download aria-hidden /> <span className="hidden sm:inline">Export CSV</span>
          </button>
        }
      />
      <div className="mb-3.5 space-y-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'all', label: 'All', count: count('all') },
            { key: 'submitted', label: 'Pending', count: count('submitted') },
            { key: 'approved', label: 'Approved', count: count('approved') },
            { key: 'fulfilled', label: 'Fulfilled', count: count('fulfilled') },
            { key: 'rejected', label: 'Rejected', count: count('rejected') },
          ]}
        />
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search ref no, manager, staff, doctor"
        />
        <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-6">
          <label className="field">
            <span className="lbl">From</span>
            <input
              type="date"
              className={inputCls}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="lbl">To</span>
            <input
              type="date"
              className={inputCls}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <select
            aria-label="Manager"
            className={sel}
            value={manager}
            onChange={(e) => setManager(e.target.value)}
          >
            <option value="">All managers</option>
            {people('manager_name').map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <select
            aria-label="Accountability staff"
            className={sel}
            value={staff}
            onChange={(e) => setStaff(e.target.value)}
          >
            <option value="">All staff</option>
            {people('accountability_staff_name').map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <select
            aria-label="Division"
            className={sel}
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            <option value="">All divisions</option>
            {divisions.data?.map((d) => (
              <option key={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            aria-label="HQ"
            className={sel}
            value={hq}
            onChange={(e) => setHq(e.target.value)}
          >
            <option value="">All HQ</option>
            {hqs.data?.map((h) => (
              <option key={h.id}>{h.value}</option>
            ))}
          </select>
        </div>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(b) => b.id}
        loading={isLoading}
        empty={
          <EmptyState icon={Inbox} title="Nothing here yet" hint="New requests will appear here." />
        }
        actions={(b) => (
          <IconLink to={`/admin/service-requests/${b.id}`} label={`View ${b.ref_no}`} icon={Eye} />
        )}
      />
    </>
  )
}
