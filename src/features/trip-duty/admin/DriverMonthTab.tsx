import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileDown, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type Column } from '@/components/DataTable'
import { IconButton, IconLink } from '@/components/ListParts'
import { EmptyState } from '@/components/EmptyState'
import { MonthNav } from '@/components/MonthNav'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useUsers } from '@/features/users/api'
import { fmtDate } from '@/lib/format'
import { istParts, minutesText, monthOf, time12 } from '@/lib/time'
import { useAdminDeleteEntry, useAdminEntries, useBetaSummary } from '../admin-api'
import { MonthCalendar } from '../components/MonthCalendar'
import { StatsGrid } from '../components/StatsGrid'
import { exportEntriesCsv } from '../exports'
import { monthSummary, type DayEntry } from '../logic'
import { downloadDriverMonthPdf } from '../pdf'

const LEAVE_TONE = { pending: 'warn', approved: 'ok', rejected: 'danger' } as const

export function DriverMonthTab({
  month,
  driverId,
  onMonth,
  onDriver,
}: {
  month: string
  driverId: string
  onMonth: (m: string) => void
  onDriver: (id: string) => void
}) {
  const toast = useToast()
  const drivers = useUsers('driver')
  const entries = useAdminEntries(month, driverId || undefined)
  const beta = useBetaSummary(month, driverId || null)
  const del = useAdminDeleteEntry()
  const [toDelete, setToDelete] = useState<DayEntry | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const today = istParts().date
  const driver = drivers.data?.find((d) => d.id === driverId)
  const rows = entries.data ?? []
  const stats = monthSummary(rows)
  const b = beta.data?.[0]

  const columns: Column<DayEntry>[] = [
    {
      key: 'date',
      header: 'Date',
      primary: true,
      cell: (e) => <span className="font-bold tabular">{fmtDate(e.entry_date)}</span>,
    },
    {
      key: 'entry',
      header: 'Entry',
      cell: (e) =>
        e.entry_type === 'duty' ? (
          <span className="inline-flex flex-wrap gap-1">
            <StatusBadge tone={e.duty_status === 'open' ? 'warn' : 'info'}>
              {e.duty_type}
              {e.duty_status === 'open' ? ' · open' : ''}
            </StatusBadge>
            {e.entry_source === 'import' && <StatusBadge>Imported</StatusBadge>}
          </span>
        ) : e.entry_type === 'week_off' ? (
          <StatusBadge>Week off</StatusBadge>
        ) : (
          <StatusBadge tone={LEAVE_TONE[e.leave_status ?? 'pending']}>
            Leave · {e.leave_status}
          </StatusBadge>
        ),
    },
    { key: 'vehicle', header: 'Vehicle', cell: (e) => e.vehicle_label ?? '—' },
    {
      key: 'guest',
      header: 'Guest / route',
      cell: (e) =>
        e.entry_type !== 'duty' ? (
          (e.leave_reason ?? '—')
        ) : (
          <span>
            {e.guest_name || '—'}
            {(e.pickup_point || e.drop_point) && (
              <>
                <br />
                <span className="text-muted">
                  {[e.pickup_point, e.drop_point].filter(Boolean).join(' → ')}
                </span>
              </>
            )}
          </span>
        ),
    },
    {
      key: 'start',
      header: 'Start',
      cell: (e) =>
        e.entry_type === 'duty' ? (
          <span className="tabular">
            {time12(e.start_time)}
            {e.start_km !== null && (
              <>
                <br />
                {e.start_km} km
              </>
            )}
          </span>
        ) : (
          ''
        ),
    },
    {
      key: 'end',
      header: 'End',
      cell: (e) =>
        e.entry_type === 'duty' ? (
          <span className="tabular">
            {time12(e.end_time)}
            {e.end_date && e.end_date !== e.entry_date && (
              <>
                <br />
                {fmtDate(e.end_date)}
              </>
            )}
            {e.end_km !== null && (
              <>
                <br />
                {e.end_km} km
              </>
            )}
          </span>
        ) : (
          ''
        ),
    },
    { key: 'km', header: 'KM', cell: (e) => <span className="tabular">{e.total_km ?? ''}</span> },
    {
      key: 'hrs',
      header: 'Hours',
      cell: (e) => (
        <span className="tabular">
          {e.total_minutes !== null ? minutesText(e.total_minutes) : ''}
        </span>
      ),
    },
    {
      key: 'fuel',
      header: 'Fuel',
      cell: (e) => (
        <span className="tabular">
          {e.fuel_litres || e.fuel_amount ? `${e.fuel_litres ?? 0} L · ₹${e.fuel_amount ?? 0}` : ''}
        </span>
      ),
    },
  ]

  async function pdf() {
    if (!driver) return
    setPdfBusy(true)
    try {
      await downloadDriverMonthPdf({
        driverName: driver.full_name,
        month,
        entries: rows,
        stats,
        beta: b
          ? { total: b.total_amount, local: b.local_days, outstation: b.outstation_days }
          : null,
      })
    } catch {
      toast('Could not create the PDF', 'error')
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div>
      <div className="filters glass">
        <label className="field m-0">
          <span className="lbl">Driver</span>
          <select
            aria-label="Driver"
            className={inputCls}
            value={driverId}
            onChange={(e) => onDriver(e.target.value)}
          >
            <option value="">Choose a driver</option>
            {drivers.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
                {d.is_active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </label>
      </div>
      <MonthNav month={month} onChange={onMonth} max={monthOf(today)} />

      {!driverId ? (
        <div className="glass">
          <EmptyState
            icon={Truck}
            title="Choose a driver"
            hint="Pick a driver and month to see their calendar, every duty and totals."
          />
        </div>
      ) : (
        <>
          <div className="mb-3.5 flex flex-wrap gap-2">
            <Link
              to={`/admin/trip-duty/entries/new?driver=${driverId}&date=${month === monthOf(today) ? today : `${month}-01`}&m=${month}`}
              className="btn btn-primary"
            >
              <Plus aria-hidden /> Add duty
            </Link>
            <button
              className="btn btn-ghost"
              disabled={!rows.length}
              onClick={() =>
                exportEntriesCsv(rows, `duties-${driver?.full_name.replace(/\W+/g, '-')}-${month}`)
              }
            >
              <Download aria-hidden /> CSV
            </button>
            <button className="btn btn-ghost" disabled={!driver || pdfBusy} onClick={pdf}>
              <FileDown aria-hidden /> {pdfBusy ? 'Preparing…' : 'Duty sheet PDF'}
            </button>
          </div>
          <StatsGrid stats={stats} beta={b} />
          <div className="mt-3.5">
            <MonthCalendar month={month} entries={rows} today={today} detail />
          </div>
          <h2 className="sec-h">
            Duty entries ({rows.filter((e) => e.entry_type === 'duty').length})
          </h2>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(e) => e.id}
            loading={entries.isLoading}
            pageSize={50}
            empty={<EmptyState icon={Truck} title="No entries this month" />}
            actions={(e) => (
              <>
                {e.entry_type === 'duty' && (
                  <IconLink
                    to={`/admin/trip-duty/entries/${e.id}/edit?m=${month}`}
                    label={`Edit duty on ${fmtDate(e.entry_date)}`}
                    icon={Pencil}
                  />
                )}
                <IconButton
                  danger
                  label={`Delete entry on ${fmtDate(e.entry_date)}`}
                  icon={Trash2}
                  onClick={() => setToDelete(e)}
                />
              </>
            )}
          />
          {rows.length > 0 && (
            <p className="glass mt-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 p-4 text-sm font-semibold">
              <span>Totals</span>
              <span className="mono">
                {stats.duties} duties on {stats.dutyDays} days
              </span>
              <span className="mono">{stats.km.toLocaleString('en-IN')} km</span>
              <span className="mono">{stats.fuelLitres.toFixed(1)} L fuel</span>
              <span className="mono">₹{stats.fuelAmount.toLocaleString('en-IN')}</span>
            </p>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this entry?"
        confirmLabel="Delete"
        busy={del.isPending}
        description={
          toDelete && (
            <>
              {fmtDate(toDelete.entry_date)} ·{' '}
              {toDelete.entry_type === 'duty'
                ? toDelete.guest_name || 'duty'
                : toDelete.entry_type.replace('_', ' ')}
              . If this month’s beta is finalised it stays as paid until reopened.
            </>
          )
        }
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete &&
          del.mutate(toDelete.id, {
            onSuccess: () => {
              toast('Entry deleted')
              setToDelete(null)
            },
            onError: (e) => {
              setToDelete(null)
              toast(e.message, 'error')
            },
          })
        }
      />
    </div>
  )
}
