import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Eye, FileDown, Inbox } from 'lucide-react'
import { DataTable, type Column } from '@/components/DataTable'
import { AddButton, IconLink, Tag } from '@/components/ListParts'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/FormPage'
import { SearchInput, Tabs } from '@/components/ListControls'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useDivisions } from '@/features/divisions/api'
import { fmtDate } from '@/lib/format'
import { usePacks, type Pack } from '../api'
import { PackBadge } from '../components/PackBadge'
import { exportPacksCsv } from '../export'
import { downloadPacksPdf } from '../pdf'
import type { PackStatus } from '../status'

type Tab = 'all' | 'pending' | PackStatus
const TABS: Tab[] = ['all', 'pending', 'submitted', 'processing', 'fulfilled', 'cancelled']
/** "Pending" = still needs the admin: submitted or processing (same as the dashboard card). */
const inTab = (tab: Tab, status: PackStatus) =>
  tab === 'all'
    ? true
    : tab === 'pending'
      ? status === 'submitted' || status === 'processing'
      : status === tab
const sel = inputCls

export function AdminPacksPage() {
  const { data, isLoading } = usePacks()
  const divisions = useDivisions()
  const toast = useToast()
  const [params] = useSearchParams()
  const initial = params.get('status') as Tab | null
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : 'all')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [staff, setStaff] = useState('')
  const [division, setDivision] = useState('')
  const [busy, setBusy] = useState(false)

  const all = useMemo(() => data ?? [], [data])
  const staffNames = useMemo(() => [...new Set(all.map((p) => p.staff_name))].sort(), [all])
  const rows = useMemo(
    () =>
      all.filter((p) => {
        if (!inTab(tab, p.status)) return false
        if (from && p.request_date < from) return false
        if (to && p.request_date > to) return false
        if (staff && p.staff_name !== staff) return false
        if (division && p.division !== division) return false
        return `${p.ref_no} ${p.doctor_name} ${p.staff_name} ${p.items.map((i) => i.product_name).join(' ')}`
          .toLowerCase()
          .includes(q.trim().toLowerCase())
      }),
    [all, tab, q, from, to, staff, division],
  )
  const count = (s: Tab) => all.filter((p) => inTab(s, p.status)).length
  const stamp = new Date().toISOString().slice(0, 10)

  const columns: Column<Pack>[] = [
    {
      key: 'ref',
      header: 'Request',
      primary: true,
      cell: (p) => (
        <div>
          <div className="pn mono font-bold">{p.ref_no}</div>
          <div className="ps">{fmtDate(p.request_date)}</div>
        </div>
      ),
    },
    {
      key: 'doctor',
      header: 'Doctor',
      cell: (p) => (
        <div>
          <div className="font-semibold">{p.doctor_name}</div>
          <div className="ps">{p.doctor_area}</div>
        </div>
      ),
    },
    { key: 'staff', header: 'Staff', cell: (p) => p.staff_name },
    { key: 'div', header: 'Division', cell: (p) => <Tag>{p.division}</Tag> },
    { key: 'n', header: 'Products', cell: (p) => p.items.length },
    { key: 'status', header: 'Status', cell: (p) => <PackBadge status={p.status} /> },
  ]

  async function bulkPdf() {
    setBusy(true)
    try {
      await downloadPacksPdf(rows, `starter-packs-${stamp}`)
    } catch {
      toast('Could not create the PDF', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Starter Packs"
        subtitle="Raised by staff for doctors"
        action={
          <div className="flex gap-2">
            <button className="btn btn-ghost" disabled={!rows.length || busy} onClick={bulkPdf}>
              <FileDown aria-hidden />{' '}
              <span className="hidden sm:inline">{busy ? 'Preparing…' : 'PDF'}</span>
            </button>
            <button
              className="btn btn-ghost"
              disabled={!rows.length}
              onClick={() => exportPacksCsv(rows, `starter-packs-${stamp}`)}
            >
              <Download aria-hidden /> <span className="hidden sm:inline">CSV</span>
            </button>
            <AddButton to="/admin/starter-packs/new" label="New request" />
          </div>
        }
      />
      <div className="mb-4 space-y-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'all', label: 'All', count: count('all') },
            { key: 'pending', label: 'Pending', count: count('pending') },
            { key: 'submitted', label: 'Submitted', count: count('submitted') },
            { key: 'processing', label: 'Processing', count: count('processing') },
            { key: 'fulfilled', label: 'Fulfilled', count: count('fulfilled') },
            { key: 'cancelled', label: 'Cancelled', count: count('cancelled') },
          ]}
        />
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search ref no, doctor, staff, product"
        />
        <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-4">
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
            aria-label="Staff"
            className={sel}
            value={staff}
            onChange={(e) => setStaff(e.target.value)}
          >
            <option value="">All staff</option>
            {staffNames.map((n) => (
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
            <option>All Division</option>
            {divisions.data?.map((d) => (
              <option key={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="mb-3 text-xs text-muted">
        PDF and CSV include exactly the requests shown by the current filters.
      </p>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(p) => p.id}
        loading={isLoading}
        empty={
          <EmptyState icon={Inbox} title="Nothing here yet" hint="New requests will appear here." />
        }
        actions={(p) => (
          <IconLink to={`/admin/starter-packs/${p.id}`} label={`View ${p.ref_no}`} icon={Eye} />
        )}
      />
    </>
  )
}
