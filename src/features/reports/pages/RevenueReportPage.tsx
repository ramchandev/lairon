import { useMemo, useState } from 'react'
import { Download, IndianRupee, Inbox, Stethoscope, TrendingUp } from 'lucide-react'
import { DataTable, type Column } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/FormPage'
import { ChipFilter, SearchInput } from '@/components/ListControls'
import { downloadCsv } from '@/lib/csvExport'
import { inr } from '@/lib/format'
import { istParts, monthLabel, monthOf, shiftMonth } from '@/lib/time'
import { buildReport, useRevenueByDoctor, type DoctorRevenue } from '../revenue'

const PERIODS = { '3': 'Last 3 months', '6': 'Last 6 months', '12': 'Last 12 months' } as const
type Period = keyof typeof PERIODS

const short = (m: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
    new Date(`${m}-01T00:00:00Z`),
  )

/** Admin report: what each doctor has brought in, month by month, from the revenue managers confirm on service requests. */
export function RevenueReportPage() {
  const [period, setPeriod] = useState<Period>('6')
  const [q, setQ] = useState('')
  const to = monthOf(istParts().date)
  const from = shiftMonth(to, -(Number(period) - 1))
  const { data, isLoading, isError } = useRevenueByDoctor(from, to)

  const report = useMemo(() => buildReport(data ?? [], from, to), [data, from, to])
  const rows = useMemo(
    () =>
      report.doctors.filter((d) =>
        `${d.name} ${d.manager ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [report, q],
  )
  const best = report.doctors[0]

  const columns: Column<DoctorRevenue>[] = [
    {
      key: 'doctor',
      header: 'Doctor',
      primary: true,
      cell: (d) => (
        <div>
          <div className="font-semibold">{d.name}</div>
          <div className="text-xs text-muted">{d.manager ?? 'Unassigned'}</div>
        </div>
      ),
    },
    ...report.months.map((m) => ({
      key: m,
      header: short(m),
      cell: (d: DoctorRevenue) => (d.byMonth[m] ? inr(d.byMonth[m]) : '—'),
    })),
    { key: 'total', header: 'Total', cell: (d) => <b className="mono">{inr(d.total)}</b> },
  ]

  function exportCsv() {
    downloadCsv(
      `revenue-by-doctor-${from}-to-${to}.csv`,
      ['Doctor', 'Manager', ...report.months.map(monthLabel), 'Total'],
      [
        ...rows.map((d) => [
          d.name,
          d.manager ?? '',
          ...report.months.map((m) => d.byMonth[m] ?? 0),
          d.total,
        ]),
        ['Total', '', ...report.months.map((m) => report.monthTotals[m] ?? 0), report.total],
      ],
    )
  }

  return (
    <>
      <PageHeader
        title="Revenue Report"
        subtitle="Revenue by doctor, month on month"
        action={
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!rows.length}>
            <Download aria-hidden /> <span className="hidden sm:inline">Export CSV</span>
          </button>
        }
      />
      <section aria-label="Key numbers" className="kpis kpis-3 mb-4">
        <div className="kpi glass">
          <span className="k-ic t-ok">
            <IndianRupee size={20} />
          </span>
          <span className="k-val mono">{inr(report.total)}</span>
          <span>
            <span className="k-lbl">Total revenue</span>
            <br />
            <span className="k-sub">{PERIODS[period]}</span>
          </span>
        </div>
        <div className="kpi glass">
          <span className="k-ic t-info">
            <Stethoscope size={20} />
          </span>
          <span className="k-val mono">{report.doctors.length}</span>
          <span>
            <span className="k-lbl">Doctors with revenue</span>
            <br />
            <span className="k-sub">in this period</span>
          </span>
        </div>
        <div className="kpi glass">
          <span className="k-ic t-teal">
            <TrendingUp size={20} />
          </span>
          <span className="k-val mono">{best ? inr(best.total) : '—'}</span>
          <span>
            <span className="k-lbl">Top doctor</span>
            <br />
            <span className="k-sub">{best?.name ?? 'No revenue yet'}</span>
          </span>
        </div>
      </section>

      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search doctor or manager…" />
        <ChipFilter
          value={period}
          onChange={setPeriod}
          options={[
            { key: '3', label: '3 months' },
            { key: '6', label: '6 months' },
            { key: '12', label: '12 months' },
          ]}
        />
      </div>
      {isError && (
        <p role="alert" className="mb-3 rounded-control bg-danger-bg p-3 text-sm text-danger">
          Couldn’t load the report. Pull to refresh or try again.
        </p>
      )}
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(d) => d.key}
        rowTo={(d) => (d.doctorId ? `/admin/doctors/${d.doctorId}` : null)}
        loading={isLoading}
        empty={
          <EmptyState
            icon={Inbox}
            title={q ? 'No results' : 'No revenue recorded'}
            hint={
              q
                ? `Nothing matches “${q}”.`
                : 'Revenue appears here once managers confirm it on their service requests.'
            }
          />
        }
      />
      {rows.length > 0 && (
        <p className="mt-3 text-right text-sm text-muted">
          Total for the period: <b className="mono">{inr(report.total)}</b>
        </p>
      )}
    </>
  )
}
