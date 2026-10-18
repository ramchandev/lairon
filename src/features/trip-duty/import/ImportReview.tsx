import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, IndianRupee, Info, OctagonAlert } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type Column } from '@/components/DataTable'
import { Field, Section } from '@/components/FormPage'
import { StatusBadge } from '@/components/StatusBadge'
import { inputCls } from '@/components/form-styles'
import { useUsers } from '@/features/users/api'
import { fmtDate, inr } from '@/lib/format'
import { istParts, minutesText } from '@/lib/time'
import { useAdminEntries, useBetaMonth, useBetaRates } from '../admin-api'
import { matchDriver, type ParsedRow } from './parse'
import { buildPlan, type ImportMode, type Plan } from './plan'
import type { ReadResult } from './readFile'

const ICON = { error: OctagonAlert, warning: AlertTriangle, note: Info } as const
const TONE = { error: 'text-danger', warning: 'text-warn', note: 'text-info' } as const

export interface ReviewState {
  driverId: string
  month: string
  mode: ImportMode
}

/** Step 2: nothing is saved yet. Shows counters, the checks, a beta preview and every row. */
export function ImportReview({
  file,
  busy,
  onBack,
  onImport,
}: {
  file: ReadResult
  busy: boolean
  onBack: () => void
  onImport: (plan: Plan, state: ReviewState) => void
}) {
  const drivers = useUsers('driver')
  const rates = useBetaRates()
  const detected = matchDriver(file.detected.driverName, drivers.data ?? [])
  const [driverId, setDriverId] = useState('')
  const [month, setMonth] = useState(file.detected.month ?? '')
  const [mode, setMode] = useState<ImportMode | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const effectiveDriver = driverId || detected?.id || ''
  const existing = useAdminEntries(month || '1970-01', effectiveDriver || undefined)
  const monthRow = useBetaMonth(month || '1970-01')
  const existingCount = effectiveDriver && month ? (existing.data?.length ?? 0) : 0
  const chosenMode: ImportMode = mode ?? (existingCount > 0 ? 'fill' : 'replace')

  const plan = useMemo(
    () =>
      buildPlan({
        rows: file.rows,
        month: month || '1970-01',
        mode: chosenMode,
        existing: effectiveDriver ? (existing.data ?? []) : [],
        rates: rates.data ?? [],
        today: istParts().date,
      }),
    [file.rows, month, chosenMode, effectiveDriver, existing.data, rates.data],
  )
  const ready =
    !!effectiveDriver &&
    /^\d{4}-\d{2}$/.test(month) &&
    plan.counts.errors === 0 &&
    plan.willImport > 0 &&
    !busy
  const finalised = monthRow.data?.status === 'finalised'
  const run = () => onImport(plan, { driverId: effectiveDriver, month, mode: chosenMode })

  const columns: Column<ParsedRow>[] = [
    {
      key: 'line',
      header: 'Row',
      primary: true,
      cell: (r) => (
        <span className="tabular">
          #{r.line} ·{' '}
          {r.date ? fmtDate(r.date) : <span className="text-danger">{r.rawDate || 'no date'}</span>}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Entry',
      cell: (r) =>
        r.entryType === 'duty' ? (
          <StatusBadge tone={r.dutyType === 'Out Station' ? 'info' : 'ok'}>
            {r.dutyType ?? 'Local'}
            {r.dutyType ? '' : ' (default)'}
          </StatusBadge>
        ) : (
          <StatusBadge>{r.entryType === 'week_off' ? 'Week off' : 'Leave'}</StatusBadge>
        ),
    },
    { key: 'vehicle', header: 'Vehicle', cell: (r) => r.vehicle ?? '—' },
    { key: 'guest', header: 'Guest', cell: (r) => r.guest ?? '—' },
    { key: 'km', header: 'KM', cell: (r) => <span className="tabular">{r.totalKm ?? ''}</span> },
    {
      key: 'hrs',
      header: 'Hours',
      cell: (r) => (
        <span className="tabular">
          {r.totalMinutes !== null ? minutesText(r.totalMinutes) : ''}
        </span>
      ),
    },
  ]

  const c = plan.counts
  return (
    <div className="mx-auto max-w-[824px] pb-28">
      <Section stack title="Import into">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Driver"
            required
            hint={
              !detected && file.detected.driverName
                ? `“${file.detected.driverName}” wasn’t matched to a driver — choose one.`
                : undefined
            }
          >
            <select
              className={inputCls}
              value={effectiveDriver}
              onChange={(e) => setDriverId(e.target.value)}
            >
              <option value="">Choose driver</option>
              {drivers.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Month" required>
            <input
              type="month"
              className={inputCls}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>
        </div>
        <p className="text-sm text-muted">
          File: <b>{file.fileName}</b>
          {file.unknownColumns.length > 0 && (
            <> · Ignored columns: {file.unknownColumns.join(', ')}</>
          )}
        </p>
      </Section>

      <div className="stats mb-3.5">
        {(
          [
            ['Rows read', c.read],
            ['Duties', c.duties],
            ['Week offs', c.weekOffs],
            ['Leaves', c.leaves],
            ['Errors', c.errors],
            ['Days with no entry', c.gaps],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="stat">
            <b
              className="mono"
              style={
                k === 'Errors'
                  ? { color: v ? 'var(--color-danger)' : 'var(--color-ok)' }
                  : undefined
              }
            >
              {v}
            </b>
            <span>{k}</span>
          </div>
        ))}
      </div>

      <section aria-label="Beta preview" className="glass card mb-3.5">
        <div className="card-h">
          <h2 className="flex items-center gap-2">
            <IndianRupee size={20} className="text-primary" aria-hidden /> Beta preview
          </h2>
          <span className="muted text-[13px]">{plan.beta.payableDays} payable days</span>
        </div>
        <p>
          <b className="mono text-[22px]">{inr(plan.beta.total)}</b>{' '}
          <span className="muted">
            · {plan.beta.dutyCount} duties → {plan.beta.payableDays} payable days
            {plan.beta.outstationDays > 0 &&
              ` (${plan.beta.localDays} local · ${plan.beta.outstationDays} outstation)`}
          </span>
        </p>
      </section>

      {existingCount > 0 && (
        <Section stack title={`${existingCount} entries already exist for this driver in ${month}`}>
          <div role="radiogroup" aria-label="How to import" className="radio-row">
            {(
              [
                [
                  'fill',
                  'Fill empty days only',
                  `Keeps what is already there; ${plan.skipped} rows on days that already have an entry are skipped.`,
                ],
                [
                  'replace',
                  'Replace the month',
                  `Deletes the ${plan.replaced || existingCount} existing entries first, then imports the file.`,
                ],
              ] as const
            ).map(([k, t, d]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={chosenMode === k}
                onClick={() => setMode(k)}
                className="radio text-left"
                style={
                  chosenMode === k
                    ? {
                        borderColor: 'var(--color-primary)',
                        boxShadow: '0 0 0 3px rgba(43,92,198,.15)',
                      }
                    : undefined
                }
              >
                <span>
                  <b>{t}</b>
                  <br />
                  <span className="muted text-[13px]">{d}</span>
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}
      {finalised && (
        <p className="rounded-control bg-warn-bg p-3 text-sm text-warn">
          Beta for {month} is finalised. You can still import, but its amounts stay locked until the
          month is reopened.
        </p>
      )}

      {plan.issues.length > 0 && (
        <Section stack title="Checks">
          <ul className="issues">
            {(['error', 'warning', 'note'] as const)
              .flatMap((sev) => plan.issues.filter((i) => i.severity === sev))
              .map((i, n) => {
                const Icon = ICON[i.severity]
                return (
                  <li key={n} className={i.severity === 'error' ? 'lv-error' : undefined}>
                    <Icon className={`mt-0.5 size-4 shrink-0 ${TONE[i.severity]}`} />
                    <span>
                      {i.line !== undefined && <b className="mono">Row {i.line}: </b>}
                      {i.message}
                    </span>
                  </li>
                )
              })}
          </ul>
        </Section>
      )}

      <section>
        <h2 className="sec-h">Rows to import ({file.rows.length})</h2>
        <DataTable
          rows={file.rows}
          columns={columns}
          rowKey={(r) => String(r.line)}
          pageSize={40}
        />
      </section>

      <div className="actionbar">
        <span className="spacer" />
        <button className="btn btn-ghost" onClick={onBack} disabled={busy}>
          <ArrowLeft aria-hidden /> Choose another file
        </button>
        <button
          className="btn btn-primary"
          disabled={!ready}
          onClick={() =>
            chosenMode === 'replace' && existingCount > 0 ? setConfirmReplace(true) : run()
          }
        >
          <Check aria-hidden /> {busy ? 'Importing…' : `Import ${plan.willImport} rows`}
        </button>
      </div>

      <ConfirmDialog
        open={confirmReplace}
        title="Replace the month?"
        confirmLabel="Replace and import"
        busy={busy}
        description={
          <>
            This deletes <b>{existingCount} existing entries</b> for this driver in {month}, then
            imports {plan.willImport} rows.
            {finalised && (
              <> Beta for this month is finalised and stays locked until reopened.</>
            )}{' '}
            It can be undone, but deleted entries are not restored.
          </>
        }
        onCancel={() => setConfirmReplace(false)}
        onConfirm={() => {
          setConfirmReplace(false)
          run()
        }}
      />
    </div>
  )
}
