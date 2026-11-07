import { useMemo, useState } from 'react'
import { Download, Save, Trash2, X } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { Pick } from '../Pick'
import { ReportTable, arrange, type Sort } from './ReportTable'
import { useDivisions } from '@/features/divisions/api'
import { useLocations } from '@/features/locations/api'
import { useProducts } from '@/features/products/api'
import { useStockists } from '@/features/performance/stockists'
import { useDeletePreset, useReportPresets, useSavePreset } from '@/features/performance/presets'
import { downloadCsv } from '@/lib/csvExport'
import { monthLabel, shiftMonth } from '@/lib/time'
import { useSaleLines, useSaleSettings, useSaveSaleSettings, useUploads } from '../api'
import {
  REPORTS,
  runReport,
  toSaleRows,
  type ReportKey,
  type Settings,
  type UploadRef,
} from '../reports'

interface View {
  report: ReportKey
  locationId: string
  divisionId: string
  stockistId: string
}
const PRESET_REPORT = 'sale-report'
/** Admin: the monthly reports built from the uploaded statements, with saved views, CSV and the reorder settings. */
export function ReportsTab() {
  const toast = useToast()
  const { profile } = useAuth()
  const uploadsQ = useUploads()
  const settings = useSaleSettings().data!
  const saveSettings = useSaveSaleSettings()
  const locationRows = useLocations().data
  const divisionRows = useDivisions().data
  const stockistRows = useStockists().data
  const productRows = useProducts().data
  const locations = useMemo(() => locationRows ?? [], [locationRows])
  const divisions = useMemo(() => divisionRows ?? [], [divisionRows])
  const stockists = useMemo(() => stockistRows ?? [], [stockistRows])
  const products = useMemo(() => productRows ?? [], [productRows])
  const presets = useReportPresets<View>(PRESET_REPORT)
  const savePreset = useSavePreset<View>(PRESET_REPORT)
  const delPreset = useDeletePreset(PRESET_REPORT)

  const [v, setV] = useState<View>({
    report: 'reorder',
    locationId: '',
    divisionId: '',
    stockistId: '',
  })
  const [pickedMonth, setMonth] = useState('')
  const [presetId, setPresetId] = useState('')
  const [presetName, setPresetName] = useState('')
  const [draft, setDraft] = useState<Settings | null>(null)

  const active = useMemo(
    () => (uploadsQ.data ?? []).filter((u) => u.status === 'active'),
    [uploadsQ.data],
  )
  const months = useMemo(
    () => [...new Set(active.map((u) => u.month.slice(0, 7)))].sort().reverse(),
    [active],
  )
  const month = pickedMonth || months[0] || ''
  const span = Math.max(settings.history_months, 6)
  const linesQ = useSaleLines(month ? shiftMonth(month, -(span - 1)) : '', month, !!month)

  const lookups = useMemo(
    () => ({
      products: new Map(products.map((p) => [p.id, { name: p.name, pts: p.pts }])),
      stockists: new Map(stockists.map((s) => [s.id, { name: s.name, locationId: s.location_id }])),
      locations: new Map(locations.map((l) => [l.id, l.name])),
      divisions: new Map(divisions.map((d) => [d.id, d.name])),
    }),
    [products, stockists, locations, divisions],
  )
  const keep = (r: { stockistId: string; locationId: string; divisionId: string }) =>
    (!v.locationId || r.locationId === v.locationId) &&
    (!v.divisionId || r.divisionId === v.divisionId) &&
    (!v.stockistId || r.stockistId === v.stockistId)

  const rows = useMemo(
    () => toSaleRows(linesQ.data ?? [], lookups).filter(keep),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linesQ.data, lookups, v.locationId, v.divisionId, v.stockistId],
  )
  const uploadRefs: UploadRef[] = useMemo(
    () =>
      active
        .map((u) => ({
          stockistId: u.stockist_id,
          stockist: u.stockist?.name ?? '—',
          divisionId: u.division_id ?? '',
          division: u.division?.name ?? 'All divisions',
          month: u.month.slice(0, 7),
          locationId: lookups.stockists.get(u.stockist_id)?.locationId ?? '',
        }))
        .filter(keep)
        .map((u) => ({
          stockistId: u.stockistId,
          stockist: u.stockist,
          divisionId: u.divisionId,
          division: u.division,
          month: u.month,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, lookups, v.locationId, v.divisionId, v.stockistId],
  )
  const table = useMemo(
    () => (month ? runReport(v.report, rows, month, settings, uploadRefs) : null),
    [v.report, rows, month, settings, uploadRefs],
  )

  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>(null)
  const onScreen = useMemo(() => arrange(table?.rows ?? [], q, sort), [table, q, sort])
  const [saving, setSaving] = useState(false)
  const current = REPORTS.find((r) => r.key === v.report)!
  const form = draft ?? settings

  function applyPreset(id: string) {
    setPresetId(id)
    const p = presets.data?.find((x) => x.id === id)
    if (p) {
      setV({ ...v, ...p.config })
      setPresetName(p.name)
    }
  }
  function exportCsv() {
    if (!table) return
    downloadCsv(
      `sale-report-${v.report}-${month}.csv`,
      table.columns.map((c) => c.label),
      onScreen.map((r) => r.map((x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x))),
    )
  }

  if (uploadsQ.isSuccess && !months.length)
    return (
      <div className="glass p-6 text-center text-muted">
        No statements saved yet. Upload some on the Upload tab and the reports appear here.
      </div>
    )

  return (
    <div className="space-y-4">
      <section className="glass flex flex-wrap items-end gap-3 p-3" aria-label="Report and filters">
        <div className="min-w-56 text-sm font-semibold">
          Report
          <div className="mt-1">
            <Pick
              ariaLabel="Report"
              value={v.report}
              onChange={(k) => {
                setV({ ...v, report: k as ReportKey })
                setSort(null)
              }}
              options={REPORTS.map((r) => ({ value: r.key, label: r.label, hint: r.hint }))}
            />
          </div>
        </div>
        <div className="min-w-40 text-sm font-semibold">
          Month
          <div className="mt-1">
            <Pick
              ariaLabel="Month"
              value={month}
              onChange={setMonth}
              options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
            />
          </div>
        </div>
        <div className="min-w-44 text-sm font-semibold">
          Location
          <div className="mt-1">
            <Pick
              ariaLabel="Location"
              value={v.locationId}
              onChange={(x) => setV({ ...v, locationId: x })}
              all="All locations"
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
            />
          </div>
        </div>
        <div className="min-w-44 text-sm font-semibold">
          Division
          <div className="mt-1">
            <Pick
              ariaLabel="Division"
              value={v.divisionId}
              onChange={(x) => setV({ ...v, divisionId: x })}
              all="All divisions"
              options={divisions.map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>
        </div>
        <div className="min-w-44 text-sm font-semibold">
          Stockist
          <div className="mt-1">
            <Pick
              ariaLabel="Stockist"
              value={v.stockistId}
              onChange={(x) => setV({ ...v, stockistId: x })}
              all="All stockists"
              options={stockists.map((st) => ({ value: st.id, label: st.name }))}
            />
          </div>
        </div>
        <div className="min-w-44 text-sm font-semibold">
          Saved view
          <div className="mt-1">
            <Pick
              ariaLabel="Saved view"
              value={presetId}
              onChange={applyPreset}
              options={(presets.data ?? []).map((x) => ({ value: x.id, label: x.name }))}
            />
          </div>
        </div>
        {saving ? (
          <>
            <input
              className={`${inputCls} !w-48`}
              aria-label="Name for this view"
              placeholder="e.g. Madurai reorder"
              autoFocus
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
            <button
              className="btn btn-primary"
              disabled={!presetName.trim() || savePreset.isPending || !profile}
              onClick={() =>
                savePreset.mutate(
                  { name: presetName, config: v, ownerId: profile!.id },
                  {
                    onSuccess: () => {
                      toast('View saved')
                      setSaving(false)
                    },
                    onError: (e) => toast(e.message, 'error'),
                  },
                )
              }
            >
              Save
            </button>
            <button className="btn btn-ghost" aria-label="Cancel" onClick={() => setSaving(false)}>
              <X aria-hidden />
            </button>
          </>
        ) : (
          <button className="btn btn-ghost" onClick={() => setSaving(true)}>
            <Save aria-hidden /> Save view
          </button>
        )}
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
            <Trash2 aria-hidden /> Delete view
          </button>
        )}
        <button className="btn btn-ghost ml-auto" onClick={exportCsv} disabled={!onScreen.length}>
          <Download aria-hidden /> Export CSV
        </button>
      </section>

      <div>
        <h2 className="text-lg font-bold">{current.label}</h2>
        <p className="text-[13px] text-muted">
          {current.hint}
          {month && ` — ${monthLabel(month)}`}
          {table?.note ? `. ${table.note}` : ''}
        </p>
      </div>

      <ReportTable
        key={v.report}
        table={table}
        rows={onScreen}
        loading={linesQ.isLoading}
        q={q}
        onQ={setQ}
        sort={sort}
        onSort={setSort}
      />

      <details className="glass p-4">
        <summary className="cursor-pointer font-bold">Reorder settings</summary>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {(
            [
              ['cover_months', 'Cover months to order for', 0.5],
              ['history_months', 'Months of sales to average', 1],
              ['slow_cover_months', 'Months of stock that counts as slow', 0.5],
            ] as const
          ).map(([k, label, step]) => (
            <label key={k} className="text-sm font-semibold">
              {label}
              <input
                type="number"
                min={k === 'history_months' ? 1 : 0}
                max={k === 'history_months' ? 12 : undefined}
                step={step}
                className={`${inputCls} mt-1 block w-28`}
                value={form[k]}
                onChange={(e) => setDraft({ ...form, [k]: Number(e.target.value) })}
              />
            </label>
          ))}
          <button
            className="btn btn-primary"
            disabled={!draft || saveSettings.isPending}
            onClick={() =>
              saveSettings.mutate(form, {
                onSuccess: () => {
                  setDraft(null)
                  toast('Settings saved')
                },
                onError: (e) => toast(e.message, 'error'),
              })
            }
          >
            Save settings
          </button>
        </div>
      </details>
    </div>
  )
}
