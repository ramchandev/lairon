import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Download, FileSpreadsheet, Inbox, Info, Undo2, Upload } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/ListParts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type Column } from '@/components/DataTable'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { monthLabel } from '@/lib/time'
import { fmtDate } from '@/lib/format'
import { useImportBatches, useUndoImport, type ImportBatch } from './api'
import { downloadTemplate } from './template'

/** Step 1: choose a file (or drop it), get the template, and manage recent imports. */
export function ImportUpload({
  onFile,
  busy,
  error,
}: {
  onFile: (f: File) => void
  busy: boolean
  error: string | null
}) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const batches = useImportBatches()
  const undo = useUndoImport()
  const [target, setTarget] = useState<ImportBatch | null>(null)

  const columns: Column<ImportBatch>[] = [
    {
      key: 'file',
      header: 'File',
      primary: true,
      cell: (b) => (
        <div>
          <div className="pn">{b.file_name ?? 'Import'}</div>
          <div className="ps">{fmtDate(b.created_at)}</div>
        </div>
      ),
    },
    { key: 'driver', header: 'Driver', cell: (b) => b.driver_name ?? '—' },
    { key: 'month', header: 'Month', cell: (b) => monthLabel(b.month.slice(0, 7)) },
    { key: 'rows', header: 'Rows', cell: (b) => <span className="tabular">{b.rows_read}</span> },
    { key: 'duties', header: 'Duties', cell: (b) => <span className="tabular">{b.duties}</span> },
    {
      key: 'when',
      header: 'Imported',
      cell: (b) => <span className="tabular">{fmtDate(b.created_at)}</span>,
    },
    {
      key: 'st',
      header: 'Status',
      cell: (b) =>
        b.undone_at ? (
          <StatusBadge>Undone</StatusBadge>
        ) : (
          <StatusBadge tone="ok">Imported</StatusBadge>
        ),
    },
  ]

  return (
    <div className="mx-auto max-w-[824px]">
      <p className="muted mb-3.5 px-0.5">
        Upload a driver’s monthly duty sheet (Excel or CSV). You’ll review every row before anything
        is saved.
      </p>
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
            if (f) onFile(f)
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
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
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
          <button className="btn btn-ghost btn-sm" onClick={() => void downloadTemplate()}>
            <Download aria-hidden /> Download template
          </button>
        </div>
      </section>

      <section className="glass form-card">
        <h2 className="sec-t">
          <Info aria-hidden /> Accepted formats
        </h2>
        <div className="formats">
          <div>
            <b>Current LAIRON sheet</b>
            <p className="muted text-[13px]">
              Date · Vehicle · Guest · Total KM · Total Hours · Month
            </p>
            <ul className="text-[13px]">
              <li>“weekoff” in Guest → Week off</li>
              <li>“Own” vehicle → guest’s own car (no KM)</li>
              <li>Vehicle not in fleet (e.g. Audi) → saved as Others</li>
              <li>No duty type column → counted as Local</li>
            </ul>
          </div>
          <div>
            <b>Full template</b>
            <p className="muted text-[13px]">
              Date · Driver · Entry Type · Duty Type · Vehicle · Guest · Guest Area · Pickup · Drop
              · Starting KM · Ending KM · Starting Time · Closing Time · Total Hours · Fuel in
              Liters · Fuel Amount
            </p>
            <ul className="text-[13px]">
              <li>Dates as dd/mm/yyyy or Excel dates</li>
              <li>Entry Type: Duty / Week Off / Leave</li>
              <li>Duty Type: Local / Out Station</li>
            </ul>
          </div>
        </div>
      </section>

      <h2 className="sec-h">Recent imports</h2>
      <DataTable
        rows={batches.data ?? []}
        columns={columns}
        rowKey={(b) => b.id}
        loading={batches.isLoading}
        empty={<EmptyState icon={Inbox} title="No imports yet" />}
        actions={(b) => (
          <>
            {b.driver_id && (
              <Link
                to={`/admin/trip-duty?tab=month&driver=${b.driver_id}&m=${b.month.slice(0, 7)}`}
                className="btn btn-ghost btn-sm"
              >
                <Calendar aria-hidden /> View
              </Link>
            )}
            {!b.undone_at && (
              <IconButton
                danger
                label={`Undo import ${b.file_name ?? ''}`.trim()}
                icon={Undo2}
                onClick={() => setTarget(b)}
              />
            )}
          </>
        )}
      />

      <ConfirmDialog
        open={!!target}
        title="Undo this import?"
        confirmLabel="Undo import"
        busy={undo.isPending}
        description={
          <>
            Removes the <b>{target?.duties} duties</b> and other entries this import created for{' '}
            <b>{target?.driver_name}</b>. Entries added by hand stay. If you used “Replace the
            month”, the replaced entries are not restored.
          </>
        }
        onCancel={() => setTarget(null)}
        onConfirm={() =>
          target &&
          undo.mutate(target.id, {
            onSuccess: (n) => {
              toast(`Removed ${n} entries`)
              setTarget(null)
            },
            onError: (e) => {
              setTarget(null)
              toast(e.message, 'error')
            },
          })
        }
      />
    </div>
  )
}
