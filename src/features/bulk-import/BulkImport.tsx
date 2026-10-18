import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  CircleCheck,
  Download,
  FileSpreadsheet,
  Info,
  OctagonAlert,
  Upload,
} from 'lucide-react'
import { DataTable, type Column } from '@/components/DataTable'
import { useToast } from '@/components/Toast'
import { downloadCsv } from '@/lib/csvExport'
import {
  downloadSheetTemplate,
  hasError,
  readSheet,
  toRecords,
  type BulkRow,
  type FieldSpec,
  type Issue,
  type Rec,
} from './sheet'

export interface CommitResult {
  message: string
  /** Rows that were not saved, with the reason. */
  failures?: { line: number; message: string }[]
  /** Extra table (e.g. invite links) offered as a CSV download. */
  download?: { name: string; header: string[]; rows: (string | number)[][]; label: string }
}

export interface BulkConfig<R extends BulkRow> {
  intro: string
  fields: FieldSpec[]
  templateFile: string
  templateHeader: string[]
  templateRows: (string | number)[][]
  /** The "Accepted formats" card body. */
  formats: ReactNode
  /** False while reference data (staff, doctors, products…) is still loading. */
  ready: boolean
  parse: (records: Rec[], missing: string[]) => { rows: R[]; issues: Issue[] }
  columns: Column<R>[]
  /** true: rows with errors are skipped and the rest imported; false: any error blocks the whole import. */
  partial?: boolean
  stats?: (rows: R[]) => [string, number | string][]
  importLabel: (n: number) => string
  commit: (rows: R[], progress: (done: number, total: number) => void) => Promise<CommitResult>
  doneTo: string
  doneLabel: string
}

const ICON = { error: OctagonAlert, warning: AlertTriangle, note: Info } as const
const TONE = { error: 'text-danger', warning: 'text-warn', note: 'text-info' } as const

/** Shared import flow: choose file → review every row (nothing saved yet) → import → result. */
export function BulkImport<R extends BulkRow>({ cfg }: { cfg: BulkConfig<R> }) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<{
    name: string
    rows: R[]
    issues: Issue[]
    unknown: string[]
  } | null>(null)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [result, setResult] = useState<CommitResult | null>(null)

  async function onFile(f: File) {
    setBusy(true)
    setError(null)
    try {
      const aoa = await readSheet(f)
      const { records, unknown, missing } = toRecords(aoa, cfg.fields)
      if (!records.length) {
        setError('No data rows found under the header (the header must be in the first row).')
        return
      }
      const parsed = cfg.parse(records, missing)
      setFile({ name: f.name, unknown, ...parsed })
    } catch {
      setError('This file couldn’t be read. Use .xlsx, .xls or .csv, or download the template.')
    } finally {
      setBusy(false)
    }
  }

  const rows = useMemo(() => file?.rows ?? [], [file])
  const bad = useMemo(() => rows.filter(hasError), [rows])
  const good = useMemo(() => rows.filter((r) => !hasError(r)), [rows])
  const fileErrors = (file?.issues ?? []).filter((i) => i.severity === 'error')
  const allIssues = [
    ...(file?.issues ?? []),
    ...rows.flatMap((r) => r.issues.map((i) => ({ ...i, line: i.line ?? r.line }))),
  ].sort(
    (a, b) =>
      ['error', 'warning', 'note'].indexOf(a.severity) -
      ['error', 'warning', 'note'].indexOf(b.severity),
  )
  const canImport =
    cfg.ready &&
    !busy &&
    !progress &&
    fileErrors.length === 0 &&
    good.length > 0 &&
    (cfg.partial || bad.length === 0)

  async function run() {
    setProgress([0, good.length])
    try {
      setResult(await cfg.commit(good, (d, t) => setProgress([d, t])))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The import failed', 'error')
    } finally {
      setProgress(null)
    }
  }

  if (result)
    return (
      <div className="mx-auto max-w-[824px]">
        <section className="glass done mt-4">
          <div className="done-ic">
            <CircleCheck />
          </div>
          <h1>{result.failures?.length ? 'Import finished with problems' : 'Import complete'}</h1>
          <p className="muted mt-1.5">{result.message}</p>
          {result.failures && result.failures.length > 0 && (
            <ul className="issues mt-4 text-left">
              {result.failures.map((f) => (
                <li key={f.line} className="lv-error">
                  <span className="badge b-danger shrink-0">Row {f.line}</span>
                  <span>{f.message}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="done-actions">
            {result.download && (
              <button
                className="btn btn-ghost btn-lg"
                onClick={() =>
                  downloadCsv(result.download!.name, result.download!.header, result.download!.rows)
                }
              >
                <Download aria-hidden /> {result.download.label}
              </button>
            )}
            <Link to={cfg.doneTo} className="btn btn-primary btn-lg">
              {cfg.doneLabel}
            </Link>
          </div>
        </section>
      </div>
    )

  if (!file)
    return (
      <div className="mx-auto max-w-[824px]">
        <p className="muted mb-3.5 px-0.5">{cfg.intro}</p>
        <section className="glass form-card">
          <h2 className="sec-t">
            <Upload aria-hidden /> 1. Choose file
          </h2>
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              const f = e.dataTransfer.files[0]
              if (f) void onFile(f)
            }}
            className={`dropzone ${over ? 'over' : ''}`}
          >
            <span className="dz-ic">
              <FileSpreadsheet aria-hidden />
            </span>
            <b>{busy ? 'Reading file…' : 'Tap to choose a file'}</b>
            <span className="muted text-[13px]">
              or drop it here · .xlsx, .xls or .csv · first sheet · headers in row 1
            </span>
            <input
              ref={input}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              disabled={busy || !cfg.ready}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = ''
              }}
            />
          </label>
          {error && (
            <p role="alert" className="mt-3 rounded-control bg-danger-bg p-3 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="mt-3.5 flex flex-wrap gap-2.5">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                void downloadSheetTemplate(cfg.templateFile, cfg.templateHeader, cfg.templateRows)
              }
            >
              <Download aria-hidden /> Download template
            </button>
          </div>
        </section>
        <section className="glass form-card">
          <h2 className="sec-t">
            <Info aria-hidden /> Accepted format
          </h2>
          {cfg.formats}
        </section>
      </div>
    )

  const stats: [string, number | string][] = [
    ['Rows read', rows.length],
    ...(cfg.stats?.(rows) ?? []),
    ['Errors', bad.length + fileErrors.length],
  ]
  return (
    <div className="mx-auto max-w-[824px] pb-28">
      <section className="glass form-card">
        <h2 className="sec-t">
          <FileSpreadsheet aria-hidden /> {file.name}
        </h2>
        <p className="muted text-sm">
          Nothing is saved until you press Import.
          {file.unknown.length > 0 && <> Ignored columns: {file.unknown.join(', ')}.</>}
        </p>
      </section>
      <div className="stats mb-3.5">
        {stats.map(([k, v]) => (
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
      {allIssues.length > 0 && (
        <section className="glass card mb-3.5">
          <div className="card-h">
            <h2>Checks</h2>
            <span className="muted text-[13px]">
              {allIssues.filter((i) => i.severity === 'error').length} errors ·{' '}
              {allIssues.filter((i) => i.severity === 'warning').length} warnings
            </span>
          </div>
          <ul className="issues">
            {allIssues.slice(0, 200).map((i, n) => {
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
          {cfg.partial && bad.length > 0 && (
            <p className="muted mt-2 text-[13px]">
              Rows with errors are skipped; the other {good.length} are imported.
            </p>
          )}
        </section>
      )}
      <h2 className="sec-h">Rows ({rows.length})</h2>
      <DataTable rows={rows} columns={cfg.columns} rowKey={(r) => String(r.line)} pageSize={40} />
      <div className="actionbar">
        <span className="spacer" />
        <button className="btn btn-ghost" onClick={() => setFile(null)} disabled={!!progress}>
          Choose another file
        </button>
        <button className="btn btn-primary" disabled={!canImport} onClick={() => void run()}>
          <Check aria-hidden />{' '}
          {progress ? `Importing ${progress[0]} of ${progress[1]}…` : cfg.importLabel(good.length)}
        </button>
      </div>
    </div>
  )
}
