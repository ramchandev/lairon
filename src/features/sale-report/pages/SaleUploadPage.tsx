import { useMemo, useState } from 'react'
import { ChevronLeft, FolderOpen } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { DataTable, type Column } from '@/components/DataTable'
import { PageHeader } from '@/components/FormPage'
import { Tabs } from '@/components/ListControls'
import { inputCls } from '@/components/form-styles'
import { canPreview } from '@/layouts/adminNav'
import { monthLabel, shiftMonth } from '@/lib/time'
import { useUploads } from '../api'
import { HeadingsTab } from './HeadingsTab'
import { UploadsTab } from './UploadsTab'
import { UploadTab } from './UploadTab'

interface MonthRow {
  month: string
  uploads: number
  stockists: number
}
const thisMonth = () => new Date().toISOString().slice(0, 7)

/** Admin: stockist statements, month by month. The month list comes first; inside a month there is what is uploaded and a new upload. */
export function SaleUploadPage() {
  const { profile } = useAuth()
  const uploads = useUploads()
  const [month, setMonth] = useState<string | null>(null)
  const [view, setView] = useState<'months' | 'headings'>('months')
  const [start, setStart] = useState(shiftMonth(thisMonth(), -1))

  const rows: MonthRow[] = useMemo(() => {
    const by = new Map<string, { n: number; s: Set<string> }>()
    for (const u of (uploads.data ?? []).filter((x) => x.status === 'active')) {
      const m = u.month.slice(0, 7)
      const g = by.get(m) ?? { n: 0, s: new Set<string>() }
      g.n++
      g.s.add(u.stockist_id)
      by.set(m, g)
    }
    return [...by.entries()]
      .map(([m, g]) => ({ month: m, uploads: g.n, stockists: g.s.size }))
      .sort((a, b) => b.month.localeCompare(a.month))
  }, [uploads.data])

  if (month) return <MonthDetail month={month} onBack={() => setMonth(null)} />

  const columns: Column<MonthRow>[] = [
    { key: 'm', header: 'Month', primary: true, cell: (r) => <b>{monthLabel(r.month)}</b> },
    { key: 'u', header: 'Uploads', className: 'ta-r tabular', cell: (r) => r.uploads },
    { key: 's', header: 'Stockists', className: 'ta-r tabular', cell: (r) => r.stockists },
  ]
  return (
    <>
      <PageHeader title="Sale Upload" subtitle="Stockists’ monthly stock & sales statements" />
      {canPreview(profile?.email) && (
        <Tabs
          tabs={[
            { key: 'months', label: 'Months' },
            { key: 'headings', label: 'Headings' },
          ]}
          value={view}
          onChange={setView}
        />
      )}
      <div className="mt-4 space-y-4">
        {view === 'headings' && canPreview(profile?.email) ? (
          <HeadingsTab />
        ) : (
          <>
            <section className="glass flex flex-wrap items-end gap-3 p-3" aria-label="Open a month">
              <label className="text-sm font-semibold">
                Month
                <input
                  type="month"
                  className={`${inputCls} mt-1 block`}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <button
                className="btn btn-primary"
                disabled={!/^\d{4}-\d{2}$/.test(start)}
                onClick={() => setMonth(start)}
              >
                <FolderOpen aria-hidden /> Open month
              </button>
              <span className="text-[13px] text-muted">
                Pick the month a new batch of statements belongs to, or open one below.
              </span>
            </section>
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(r) => r.month}
              loading={uploads.isLoading}
              onRowClick={(r) => setMonth(r.month)}
              empty={
                <div className="p-6 text-center text-muted">
                  Nothing uploaded yet. Open a month above to add the first statements.
                </div>
              }
            />
          </>
        )}
      </div>
    </>
  )
}

function MonthDetail({ month, onBack }: { month: string; onBack: () => void }) {
  const [tab, setTab] = useState<'uploaded' | 'new'>('uploaded')
  return (
    <>
      <PageHeader
        title={monthLabel(month)}
        subtitle="Sale Upload"
        action={
          <button className="btn btn-ghost" onClick={onBack}>
            <ChevronLeft aria-hidden /> All months
          </button>
        }
      />
      <Tabs
        tabs={[
          { key: 'uploaded', label: 'Uploaded' },
          { key: 'new', label: 'New upload' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-4">
        {tab === 'uploaded' ? <UploadsTab month={month} /> : <UploadTab forMonth={month} />}
      </div>
    </>
  )
}
