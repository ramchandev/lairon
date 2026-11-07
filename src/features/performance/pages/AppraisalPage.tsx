import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { DataTable, type Column } from '@/components/DataTable'
import { PageHeader } from '@/components/FormPage'
import { Tabs } from '@/components/ListControls'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { currentMonthKey } from '@/features/doctors/revenue'
import { useProducts } from '@/features/products/api'
import { downloadCsv } from '@/lib/csvExport'
import { monthLabel, shiftMonth } from '@/lib/time'
import { ManagerPicker, useManagerChoice } from '../components/ManagerPicker'
import { useDailyLogs, useDoctorCalls, useMonthlyActivityRange } from '../activity'
import {
  DEFAULT_CONFIG,
  averageScore,
  buildInputs,
  scoreMonth,
  totalPoints,
  useAppraisalConfig,
  useSaveAppraisalConfig,
  type AppraisalConfig,
  type ScoreLine,
} from '../appraisal'
import { useConversionPlans } from '../plans'
import { buildRoi, fyMonths, useRoiData } from '../roi'
import { financialYear, useSalesEntries } from '../sales'

type Tab = 'report' | 'setup'

/** Admin only: the appraisal of each manager, and the one setup behind it. */
export function AppraisalPage() {
  const [tab, setTab] = useState<Tab>('report')
  return (
    <>
      <PageHeader
        title="Appraisal"
        subtitle="Monthly score of each manager — not shown to managers"
      />
      <Tabs
        tabs={[
          { key: 'report', label: 'Report' },
          { key: 'setup', label: 'Setup' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-4">{tab === 'report' ? <AppraisalReport /> : <AppraisalSetup />}</div>
    </>
  )
}

const n1 = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 1 })
const n2 = (n: number) => n.toFixed(2)

function AppraisalReport() {
  const { managerId, setManagerId, managers } = useManagerChoice()
  const [asOf, setAsOf] = useState(currentMonthKey())
  const [picked, setPicked] = useState('')
  const fy = financialYear(asOf)
  const months = useMemo(() => fyMonths(fy.from), [fy.from])
  const cfg = useAppraisalConfig()
  const products = useProducts()
  const mid = managerId || undefined
  const range = { managerId: mid, from: fy.from, to: months[11] }
  const dayRange = { managerId: mid, from: `${fy.from}-01`, to: `${months[11]}-31` }
  const entries = useSalesEntries(range)
  const logs = useDailyLogs(dayRange)
  const calls = useDoctorCalls(dayRange)
  const monthly = useMonthlyActivityRange(range)
  const plans = useConversionPlans(mid)
  const roi = useRoiData()
  const config = cfg.data ?? DEFAULT_CONFIG

  const scores = useMemo(() => {
    if (!mid) return []
    const roiByMonth: Record<string, number> = {}
    for (const m of months) {
      roiByMonth[m] = buildRoi(roi.data?.services ?? [], roi.data?.revenue ?? [], {
        fyFrom: fy.from,
        asOf: m,
        managerId: mid,
      }).achieved
    }
    return buildInputs(
      {
        months,
        entries: entries.data ?? [],
        products: (products.data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          tag: p.tag,
          pts: p.pts,
          kdp_group: p.kdp_group,
        })),
        logs: logs.data ?? [],
        calls: calls.data ?? [],
        monthly: monthly.data ?? {},
        conversions: plans.data ?? [],
        roiByMonth,
      },
      config,
    ).map((i) => scoreMonth(i, config))
  }, [
    mid,
    months,
    fy.from,
    entries.data,
    products.data,
    logs.data,
    calls.data,
    monthly.data,
    plans.data,
    roi.data,
    config,
  ])

  const avg = averageScore(scores, config)
  const sel = scores.find((s) => s.month === (picked || asOf)) ?? scores.find((s) => s.hasData)
  const managerName = managers.find((m) => m.id === managerId)?.full_name ?? ''
  const loading = !!mid && (entries.isLoading || roi.isLoading || products.isLoading)

  const lineCols: Column<ScoreLine>[] = [
    { key: 'l', header: 'Parameter', primary: true, cell: (l) => <b>{l.label}</b> },
    { key: 't', header: 'Target', cell: (l) => <span className="mono">{n1(l.target)}</span> },
    { key: 'a', header: 'Achieved', cell: (l) => <span className="mono">{n1(l.achieved)}</span> },
    { key: 'p', header: 'Ach %', cell: (l) => <span className="mono">{n1(l.pct)}%</span> },
    { key: 'pt', header: 'Points', cell: (l) => <b className="mono">{n2(l.points)}</b> },
    { key: 'm', header: 'Out of', cell: (l) => <span className="mono">{l.max}</span> },
  ]

  function exportCsv() {
    downloadCsv(
      `appraisal-${managerName || 'manager'}-${fy.from}.csv`,
      [
        'Month',
        'Parameter',
        'Target',
        'Achieved',
        'Ach %',
        'Points',
        'Out of',
        'Month total',
        'Rating',
      ],
      scores
        .filter((s) => s.hasData)
        .flatMap((s) =>
          s.lines.map((l) => [
            s.month,
            l.label,
            Number(l.target.toFixed(2)),
            Number(l.achieved.toFixed(2)),
            Number(l.pct.toFixed(1)),
            Number(l.points.toFixed(2)),
            l.max,
            Number(s.total.toFixed(2)),
            s.rating,
          ]),
        ),
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <ManagerPicker managers={managers} value={managerId} onChange={setManagerId} />
        <div className="mb-3 flex items-center gap-1">
          <button
            className="btn btn-ghost btn-sm"
            aria-label="Previous year"
            onClick={() => setAsOf(shiftMonth(asOf, -12))}
          >
            <ChevronLeft aria-hidden />
          </button>
          <b className="mono px-2">
            FY {fy.from.slice(0, 4)}–{String(Number(fy.from.slice(0, 4)) + 1).slice(2)}
          </b>
          <button
            className="btn btn-ghost btn-sm"
            aria-label="Next year"
            onClick={() => setAsOf(shiftMonth(asOf, 12))}
          >
            <ChevronRight aria-hidden />
          </button>
        </div>
        <button className="btn btn-ghost mb-3 ml-auto" onClick={exportCsv} disabled={!avg.months}>
          <Download aria-hidden /> <span className="hidden sm:inline">Export CSV</span>
        </button>
      </div>

      {!mid && <p className="text-muted">Select a manager to see their appraisal.</p>}
      {loading && <p className="text-muted">Loading…</p>}
      {mid && !loading && (
        <>
          <section aria-label="Key numbers" className="kpis kpis-3 mb-4">
            <div className="kpi glass">
              <span className="k-val mono">{avg.months ? n2(avg.total) : '—'}</span>
              <span>
                <span className="k-lbl">Average score</span>
                <br />
                <span className="k-sub">{avg.months} month(s) with data</span>
              </span>
            </div>
            <div className="kpi glass">
              <span className="k-val">{avg.rating}</span>
              <span>
                <span className="k-lbl">Rating</span>
              </span>
            </div>
            <div className="kpi glass">
              <span className="k-val mono">{sel ? n2(sel.total) : '—'}</span>
              <span>
                <span className="k-lbl">{sel ? monthLabel(sel.month) : 'Month'}</span>
                <br />
                <span className="k-sub">{sel?.rating ?? ''}</span>
              </span>
            </div>
          </section>

          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Month">
            {scores.map((s) => (
              <button
                key={s.month}
                className={`chip ${sel?.month === s.month ? 'on' : ''}`}
                aria-pressed={sel?.month === s.month}
                disabled={!s.hasData}
                onClick={() => setPicked(s.month)}
              >
                {new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }).format(
                  new Date(`${s.month}-01T00:00:00Z`),
                )}
                {s.hasData ? ` · ${n1(s.total)}` : ''}
              </button>
            ))}
          </div>

          {sel && sel.hasData ? (
            <>
              <h3 className="mb-2 font-bold">
                {monthLabel(sel.month)} — {n2(sel.total)} points · {sel.rating}
              </h3>
              <DataTable
                columns={lineCols}
                rows={sel.lines}
                rowKey={(l) => l.key}
                empty="No figures"
              />
            </>
          ) : (
            <p className="text-muted">Nothing entered for this manager in this year yet.</p>
          )}
        </>
      )}
    </>
  )
}

function AppraisalSetup() {
  const saved = useAppraisalConfig()
  const save = useSaveAppraisalConfig()
  const toast = useToast()
  const [draft, setDraft] = useState<AppraisalConfig | null>(null)
  const c = draft ?? saved.data ?? DEFAULT_CONFIG
  const set = (fn: (d: AppraisalConfig) => AppraisalConfig) => setDraft(fn(structuredClone(c)))
  const num = (v: string) => (v === '' ? 0 : Number(v))
  const total = totalPoints(c)

  const POINT_LABELS: [keyof AppraisalConfig['points'], string][] = [
    ['sales', 'Total sales'],
    ['kdp', 'Core (KDP) products'],
    ['coverage', 'Coverage'],
    ['new_customers', 'New customers'],
    ['cme', 'CME'],
    ['new_products', 'New products'],
    ['roi', 'ROI'],
  ]
  const TARGET_LABELS: [keyof AppraisalConfig['targets'], string][] = [
    ['coverage_pct', 'Coverage % target'],
    ['new_customers', 'New customers a month'],
    ['cme', 'CMEs a month'],
    ['roi_doctors', 'Doctors at 4× a month'],
  ]

  async function onSave() {
    if (c.bands.some((b) => !b.label.trim())) return toast('Name every rating', 'error')
    try {
      await save.mutateAsync(c)
      setDraft(null)
      toast('Appraisal setup saved')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section aria-label="Points">
        <h3 className="mb-2 font-bold">Points</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {POINT_LABELS.map(([k, label]) => (
            <label key={k} className="block text-sm font-semibold">
              {label}
              <input
                className={inputCls}
                type="number"
                min={0}
                inputMode="decimal"
                value={c.points[k]}
                onChange={(e) =>
                  set((d) => ({ ...d, points: { ...d.points, [k]: num(e.target.value) } }))
                }
              />
            </label>
          ))}
        </div>
        <p className={`mt-2 text-sm ${total === 100 ? 'text-ok' : 'text-warn'}`} role="status">
          Total {total} points{total === 100 ? '' : ' — usually 100'}. Scores are not capped, so
          doing more than a target earns more.
        </p>
      </section>

      <section aria-label="Targets">
        <h3 className="mb-2 font-bold">Targets (same for every manager)</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {TARGET_LABELS.map(([k, label]) => (
            <label key={k} className="block text-sm font-semibold">
              {label}
              <input
                className={inputCls}
                type="number"
                min={0}
                inputMode="decimal"
                value={c.targets[k]}
                onChange={(e) =>
                  set((d) => ({ ...d, targets: { ...d.targets, [k]: num(e.target.value) } }))
                }
              />
            </label>
          ))}
          <label className="block text-sm font-semibold">
            Total sales counted on
            <select
              className={inputCls}
              value={c.sales_basis}
              onChange={(e) =>
                set((d) => ({ ...d, sales_basis: e.target.value as 'primary' | 'secondary' }))
              }
            >
              <option value="primary">Primary sales</option>
              <option value="secondary">Secondary sales</option>
            </select>
          </label>
        </div>
      </section>

      <section aria-label="Ratings">
        <h3 className="mb-2 font-bold">Ratings</h3>
        <p className="mb-2 text-sm text-muted">
          A score gets the highest rating whose “from” it reaches.
        </p>
        <div className="space-y-2">
          {c.bands.map((b, i) => (
            <div key={i} className="flex items-end gap-2">
              <label className="block text-sm font-semibold">
                From
                <input
                  className={inputCls}
                  type="number"
                  inputMode="decimal"
                  aria-label={`Rating ${i + 1} from`}
                  value={b.min}
                  onChange={(e) =>
                    set((d) => ({
                      ...d,
                      bands: d.bands.map((x, j) =>
                        j === i ? { ...x, min: num(e.target.value) } : x,
                      ),
                    }))
                  }
                />
              </label>
              <label className="block flex-1 text-sm font-semibold">
                Rating
                <input
                  className={inputCls}
                  aria-label={`Rating ${i + 1} name`}
                  value={b.label}
                  onChange={(e) =>
                    set((d) => ({
                      ...d,
                      bands: d.bands.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    }))
                  }
                />
              </label>
              <button
                className="btn btn-ghost btn-sm"
                disabled={c.bands.length <= 1}
                onClick={() => set((d) => ({ ...d, bands: d.bands.filter((_, j) => j !== i) }))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          className="btn btn-ghost btn-sm mt-2"
          onClick={() => set((d) => ({ ...d, bands: [...d.bands, { min: 0, label: '' }] }))}
        >
          Add rating
        </button>
      </section>

      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          onClick={() => void onSave()}
          disabled={!draft || save.isPending}
        >
          Save setup
        </button>
        <button className="btn btn-ghost" onClick={() => setDraft(null)} disabled={!draft}>
          Reset
        </button>
      </div>
    </div>
  )
}
