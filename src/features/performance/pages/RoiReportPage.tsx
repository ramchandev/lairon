import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  IndianRupee,
  Stethoscope,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { DataTable, type Column } from '@/components/DataTable'
import { PageHeader } from '@/components/FormPage'
import { ChipFilter } from '@/components/ListControls'
import { currentMonthKey } from '@/features/doctors/revenue'
import { useLocations, useManagerLocations } from '@/features/locations/api'
import { downloadCsv } from '@/lib/csvExport'
import { inr } from '@/lib/format'
import { monthLabel, shiftMonth } from '@/lib/time'
import { ManagerPicker, useManagerChoice } from '../components/ManagerPicker'
import { buildRoi, ROI_TARGET, useRoiData, type RoiDoctor } from '../roi'
import { financialYear, quarterOf } from '../sales'

const short = (m: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
    new Date(`${m}-01T00:00:00Z`),
  )

/** Manager: ROI of the doctors on their service requests. */
export const RoiReportPage = () => <RoiReport />

/** Admin: any manager's ROI, or everyone's. */
export function AdminRoiReportPage() {
  const { managerId, setManagerId, managers } = useManagerChoice()
  return (
    <>
      <ManagerPicker managers={managers} value={managerId} onChange={setManagerId} allowAll />
      <RoiReport managerId={managerId || undefined} admin />
    </>
  )
}

function RoiReport({ managerId, admin }: { managerId?: string; admin?: boolean }) {
  const { profile } = useAuth()
  const [asOf, setAsOf] = useState(currentMonthKey())
  const [view, setView] = useState<'months' | 'quarters'>('months')
  const [locationIds, setLocationIds] = useState<string[]>([])
  const fy = financialYear(asOf)
  const data = useRoiData()
  const locations = useLocations()
  const covered = useManagerLocations()

  const whose = admin ? managerId : profile?.id
  const places = useMemo(() => {
    const all = locations.data ?? []
    if (!whose) return all
    return all.filter((l) => covered.data?.[whose]?.includes(l.id))
  }, [locations.data, covered.data, whose])
  const locName = (id: string | null) =>
    places.find((l) => l.id === id)?.name ?? (id ? '—' : 'No location')

  const report = useMemo(
    () =>
      buildRoi(data.data?.services ?? [], data.data?.revenue ?? [], {
        fyFrom: fy.from,
        asOf,
        managerId: whose,
        locationIds,
      }),
    [data.data, fy.from, asOf, whose, locationIds],
  )
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
  const qSum = (d: RoiDoctor, q: string) =>
    report.months.filter((m) => quarterOf(m) === q).reduce((n, m) => n + (d.byMonth[m] ?? 0), 0)
  const money = (n: number) => (n ? inr(n) : '—')

  const periodCols = view === 'months' ? report.months : quarters
  const cell = (d: RoiDoctor, p: string) => (view === 'months' ? (d.byMonth[p] ?? 0) : qSum(d, p))
  const label = (p: string) => (view === 'months' ? short(p) : p)

  const columns: Column<RoiDoctor>[] = [
    {
      key: 'doctor',
      header: 'Doctor',
      primary: true,
      cell: (d) => (
        <div>
          <div className="font-semibold">{d.name}</div>
          <div className="text-xs text-muted">
            {[d.speciality, locName(d.locationId)].filter(Boolean).join(' · ')}
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Service amount',
      cell: (d) => <span className="mono">{money(d.serviceAmount)}</span>,
    },
    ...periodCols.map((p) => ({
      key: p,
      header: label(p),
      cell: (d: RoiDoctor) => <span className="mono">{money(cell(d, p))}</span>,
    })),
    {
      key: 'ret',
      header: 'Return to date',
      cell: (d) => <b className="mono">{money(d.totalReturn)}</b>,
    },
    {
      key: 'roi',
      header: 'ROI',
      cell: (d) => <b className={`mono ${d.achieved ? 'text-ok' : ''}`}>{d.roi.toFixed(1)}×</b>,
    },
    {
      key: 'status',
      header: `${ROI_TARGET}× achieved`,
      cell: (d) =>
        d.achieved ? (
          <span className="flex items-center gap-1 text-ok">
            <CheckCircle2 className="size-4" aria-hidden /> Yes
          </span>
        ) : (
          'Not yet'
        ),
    },
  ]

  function exportCsv() {
    downloadCsv(
      `roi-${asOf}.csv`,
      [
        'Doctor',
        'Speciality',
        'Location',
        'Service amount',
        ...periodCols.map(label),
        'Return to date',
        'ROI (x)',
        'Achieved',
      ],
      report.doctors.map((d) => [
        d.name,
        d.speciality,
        locName(d.locationId),
        d.serviceAmount,
        ...periodCols.map((p) => cell(d, p)),
        d.totalReturn,
        Number(d.roi.toFixed(2)),
        d.achieved ? 'Yes' : 'No',
      ]),
    )
  }

  return (
    <>
      <PageHeader
        title="ROI"
        subtitle={`Return on services — achieved when a doctor returns ${ROI_TARGET}× the service amount`}
        action={
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!report.doctors.length}>
            <Download aria-hidden /> <span className="hidden sm:inline">Export CSV</span>
          </button>
        }
      />
      <section aria-label="Key numbers" className="kpis kpis-3 mb-4">
        <div className="kpi glass">
          <span className="k-ic t-ok">
            <CheckCircle2 size={20} />
          </span>
          <span className="k-val mono">
            {report.achieved} / {report.doctors.length}
          </span>
          <span>
            <span className="k-lbl">Doctors at {ROI_TARGET}×</span>
            <br />
            <span className="k-sub">as of {monthLabel(asOf)}</span>
          </span>
        </div>
        <div className="kpi glass">
          <span className="k-ic t-info">
            <IndianRupee size={20} />
          </span>
          <span className="k-val mono">{inr(report.totals.totalReturn)}</span>
          <span>
            <span className="k-lbl">Return to date</span>
            <br />
            <span className="k-sub">on {inr(report.totals.serviceAmount)} spent</span>
          </span>
        </div>
        <div className="kpi glass">
          <span className="k-ic t-teal">
            <TrendingUp size={20} />
          </span>
          <span className="k-val mono">{report.totals.roi.toFixed(1)}×</span>
          <span>
            <span className="k-lbl">Overall ROI</span>
            <br />
            <span className="k-sub">cumulative</span>
          </span>
        </div>
      </section>

      <div className="toolbar !flex-wrap">
        <div className="chips" role="group" aria-label="Locations">
          {places.map((l) => {
            const on = locationIds.includes(l.id)
            return (
              <button
                key={l.id}
                type="button"
                className="chip"
                aria-pressed={on}
                onClick={() =>
                  setLocationIds(
                    on ? locationIds.filter((x) => x !== l.id) : [...locationIds, l.id],
                  )
                }
              >
                {l.name}
              </button>
            )
          })}
        </div>
        <ChipFilter
          value={view}
          onChange={setView}
          options={[
            { key: 'months', label: 'Monthly' },
            { key: 'quarters', label: 'Quarterly' },
          ]}
        />
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-sm"
            aria-label="Previous month"
            onClick={() => setAsOf(shiftMonth(asOf, -1))}
          >
            <ChevronLeft aria-hidden />
          </button>
          <b className="min-w-36 text-center">As of {monthLabel(asOf)}</b>
          <button
            className="btn btn-ghost btn-sm"
            aria-label="Next month"
            disabled={asOf >= currentMonthKey()}
            onClick={() => setAsOf(shiftMonth(asOf, 1))}
          >
            <ChevronRight aria-hidden />
          </button>
        </div>
      </div>

      <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <Stethoscope className="size-4" aria-hidden /> Doctors at {ROI_TARGET}× by month:
        {report.months.map((m) => (
          <span key={m} className="rounded-full bg-white/70 px-2 py-0.5">
            {short(m)} <b className="mono text-ink">{report.achievedByMonth[m]}</b>
          </span>
        ))}
      </p>

      <DataTable
        rows={report.doctors}
        columns={columns}
        rowKey={(d) => d.key}
        rowTo={(d) =>
          d.key.startsWith('name:') ? null : `${admin ? '/admin' : '/m'}/doctors/${d.key}`
        }
        loading={data.isLoading}
        pageSize={100}
        empty={
          <p className="p-6 text-center text-muted">
            No services with a service amount yet. ROI appears once requests are submitted and
            revenue is recorded.
          </p>
        }
      />
    </>
  )
}
