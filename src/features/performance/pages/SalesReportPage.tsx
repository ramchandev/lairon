import { useMemo, useState } from 'react'
import { Download, Save, Trash2 } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { DataTable, type Column } from '@/components/DataTable'
import { PageHeader } from '@/components/FormPage'
import { ChipFilter } from '@/components/ListControls'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { currentMonthKey } from '@/features/doctors/revenue'
import { useLocations, useManagerLocations } from '@/features/locations/api'
import { useProducts } from '@/features/products/api'
import { downloadCsv } from '@/lib/csvExport'
import { monthLabel } from '@/lib/time'
import { ManagerPicker, useManagerChoice } from '../components/ManagerPicker'
import { useDeletePreset, useReportPresets, useSavePreset } from '../presets'
import {
  buildSalesReport,
  financialYear,
  lakhs,
  useSalesEntries,
  type GroupBy,
  type ProductView,
  type ReportLine,
  type Totals,
  type Unit,
} from '../sales'

const REPORT = 'sales'
interface View {
  locationIds: string[]
  view: ProductView
  unit: Unit
  groupBy: GroupBy
  from: string
  to: string
}

/** Manager: their own sales report. */
export const SalesReportPage = () => <SalesReport />

/** Admin: any manager's report, or everyone's together. */
export function AdminSalesReportPage() {
  const { managerId, setManagerId, managers } = useManagerChoice()
  return (
    <>
      <ManagerPicker managers={managers} value={managerId} onChange={setManagerId} allowAll />
      <SalesReport managerId={managerId || undefined} admin />
    </>
  )
}

function SalesReport({ managerId, admin }: { managerId?: string; admin?: boolean }) {
  const { profile } = useAuth()
  const toast = useToast()
  const fy = financialYear(currentMonthKey())
  const [v, setV] = useState<View>({
    locationIds: [],
    view: 'all',
    unit: 'units',
    groupBy: 'product',
    from: fy.from,
    to: currentMonthKey(),
  })
  const [presetName, setPresetName] = useState('')
  const [presetId, setPresetId] = useState('')

  const locations = useLocations()
  const covered = useManagerLocations()
  const all = useMemo(() => locations.data ?? [], [locations.data])
  const whose = admin ? managerId : profile?.id
  const selectable = useMemo(
    () => (whose ? all.filter((l) => covered.data?.[whose]?.includes(l.id)) : admin ? all : []),
    [all, covered.data, whose, admin],
  )

  const products = useProducts()
  const entries = useSalesEntries({
    managerId: admin ? managerId : profile?.id,
    from: v.from,
    to: v.to,
  })
  const presets = useReportPresets<View>(REPORT)
  const savePreset = useSavePreset<View>(REPORT)
  const delPreset = useDeletePreset(REPORT)

  const names = useMemo(
    () => ({ locations: Object.fromEntries((locations.data ?? []).map((l) => [l.id, l.name])) }),
    [locations.data],
  )
  const picked = v.locationIds.filter((id) => selectable.some((l) => l.id === id))
  const report = useMemo(
    () =>
      buildSalesReport(
        entries.data ?? [],
        (products.data ?? []).map((p) => ({ id: p.id, name: p.name, tag: p.tag, pts: p.pts })),
        names,
        {
          locationIds: picked.length ? picked : selectable.map((l) => l.id),
          view: v.view,
          unit: v.unit,
          groupBy: v.groupBy,
        },
      ),
    [entries.data, products.data, names, v, picked, selectable],
  )

  const n = (x: number) =>
    v.unit === 'value'
      ? lakhs(x)
      : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(x)
  const p = (x: number) => `${x.toFixed(0)}%`
  const label = (l: ReportLine) => (v.groupBy === 'month' ? monthLabel(l.key.slice(0, 7)) : l.label)
  const cols: {
    key: string
    header: string
    get: (t: Totals) => string
    tone?: (t: Totals) => string
  }[] = [
    { key: 'pt', header: 'Primary target', get: (t) => n(t.primary_target) },
    { key: 'pa', header: 'Primary ach.', get: (t) => n(t.primary_ach) },
    {
      key: 'ap',
      header: 'Ach %',
      get: (t) => p(t.achPct),
      tone: (t) => (t.achPct >= 100 ? 'text-ok' : 'text-warn'),
    },
    { key: 'st', header: 'Secondary target', get: (t) => n(t.secondary_target) },
    { key: 'sa', header: 'Secondary ach.', get: (t) => n(t.secondary_ach) },
    { key: 'sv', header: 'Sec vs Pri %', get: (t) => p(t.secVsPri) },
    { key: 'gap', header: 'Gap (Pri − Sec)', get: (t) => n(t.gap) },
    { key: 'sr', header: 'Sales return', get: (t) => n(t.sales_return) },
    { key: 'net', header: 'Net secondary', get: (t) => n(t.netSecondary) },
  ]
  const rows = [...report.lines, { key: '__total', label: 'Total', totals: report.total }]
  const columns: Column<ReportLine>[] = [
    {
      key: 'name',
      header: { product: 'Product', month: 'Month', location: 'Location' }[v.groupBy],
      primary: true,
      cell: (l) => (l.key === '__total' ? <b>Total</b> : label(l)),
    },
    ...cols.map((c) => ({
      key: c.key,
      header:
        v.unit === 'value' && c.key !== 'ap' && c.key !== 'sv' ? `${c.header} (₹ L)` : c.header,
      cell: (l: ReportLine) => (
        <span
          className={`mono ${l.key === '__total' ? 'font-bold' : ''} ${c.tone?.(l.totals) ?? ''}`}
        >
          {c.get(l.totals)}
        </span>
      ),
    })),
  ]

  function applyPreset(id: string) {
    setPresetId(id)
    const pr = presets.data?.find((x) => x.id === id)
    if (pr) {
      setV({ ...v, ...pr.config })
      setPresetName(pr.name)
    }
  }
  function exportCsv() {
    downloadCsv(
      `sales-report-${v.from}-to-${v.to}.csv`,
      [
        { product: 'Product', month: 'Month', location: 'Location' }[v.groupBy],
        ...cols.map((c) => c.header),
      ],
      rows.map((l) => [
        l.key === '__total' ? 'Total' : label(l),
        ...cols.map((c) => c.get(l.totals)),
      ]),
    )
  }

  return (
    <>
      <PageHeader
        title="Sales Report"
        subtitle="Primary vs Secondary by product, month or location"
        action={
          <button className="btn btn-ghost" onClick={exportCsv} disabled={!report.lines.length}>
            <Download aria-hidden /> <span className="hidden sm:inline">Export CSV</span>
          </button>
        }
      />

      <section className="glass mb-3 flex flex-wrap items-end gap-3 p-3" aria-label="Saved views">
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="preset">
            Saved view
          </label>
          <select
            id="preset"
            className={inputCls}
            value={presetId}
            onChange={(e) => applyPreset(e.target.value)}
          >
            <option value="">Choose a saved view…</option>
            {(presets.data ?? []).map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="preset-name">
            Save this view as
          </label>
          <input
            id="preset-name"
            className={inputCls}
            placeholder="e.g. MDU Core"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
        </div>
        <button
          className="btn btn-ghost"
          disabled={!presetName.trim() || savePreset.isPending || !profile}
          onClick={() =>
            savePreset.mutate(
              { name: presetName, config: { ...v, locationIds: picked }, ownerId: profile!.id },
              {
                onSuccess: () => toast('View saved'),
                onError: (e) => toast(e.message, 'error'),
              },
            )
          }
        >
          <Save aria-hidden /> Save view
        </button>
        {presetId && (
          <button
            className="btn btn-ghost"
            onClick={() =>
              delPreset.mutate(presetId, {
                onSuccess: () => {
                  setPresetId('')
                  toast('View deleted')
                },
              })
            }
          >
            <Trash2 aria-hidden /> Delete
          </button>
        )}
      </section>

      <div className="toolbar !flex-wrap">
        <div className="chips" role="group" aria-label="Locations">
          {selectable.map((l) => {
            const on = picked.includes(l.id)
            return (
              <button
                key={l.id}
                type="button"
                className="chip"
                aria-pressed={on}
                onClick={() =>
                  setV({
                    ...v,
                    locationIds: on ? picked.filter((x) => x !== l.id) : [...picked, l.id],
                  })
                }
              >
                {l.name}
              </button>
            )
          })}
        </div>
        <ChipFilter
          value={v.view}
          onChange={(view) => setV({ ...v, view })}
          options={[
            { key: 'all', label: 'All products' },
            { key: 'core', label: 'Core' },
            { key: 'new', label: 'New' },
          ]}
        />
        <ChipFilter
          value={v.groupBy}
          onChange={(groupBy) => setV({ ...v, groupBy })}
          options={[
            { key: 'product', label: 'By product' },
            { key: 'month', label: 'By month' },
            { key: 'location', label: 'By location' },
          ]}
        />
        <ChipFilter
          value={v.unit}
          onChange={(unit) => setV({ ...v, unit })}
          options={[
            { key: 'units', label: 'Units' },
            { key: 'value', label: 'Value (₹ lakhs)' },
          ]}
        />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="from">From</label>
        <input
          id="from"
          type="month"
          className={`${inputCls} !w-40`}
          value={v.from}
          max={v.to}
          onChange={(e) => e.target.value && setV({ ...v, from: e.target.value })}
        />
        <label htmlFor="to">to</label>
        <input
          id="to"
          type="month"
          className={`${inputCls} !w-40`}
          value={v.to}
          min={v.from}
          onChange={(e) => e.target.value && setV({ ...v, to: e.target.value })}
        />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setV({ ...v, from: fy.from, to: currentMonthKey() })}
        >
          This financial year
        </button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(l) => l.key}
        loading={entries.isLoading}
        empty={<p className="p-6 text-center text-muted">No sales entered for these filters.</p>}
        pageSize={200}
      />
      {v.unit === 'value' && (
        <p className="mt-2 text-sm text-muted">
          Value = units × PTS (set on each product). Products without a PTS count as 0.
        </p>
      )}
    </>
  )
}
