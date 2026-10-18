import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarCheck,
  CarFront,
  Download,
  FileDown,
  History,
  IndianRupee,
  List,
  Lock,
  LockOpen,
  MapPin,
  Pencil,
  Route,
  type LucideIcon,
} from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { EmptyState } from '@/components/EmptyState'
import { Person } from '@/components/ListParts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type Column } from '@/components/DataTable'
import { MonthNav } from '@/components/MonthNav'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useUsers } from '@/features/users/api'
import { fmtDate, inr } from '@/lib/format'
import { istParts, monthLabel, monthOf } from '@/lib/time'
import {
  useBetaDays,
  useBetaMonth,
  useBetaRates,
  useBetaSummary,
  useFinaliseMonth,
  useReopenMonth,
  type BetaDay,
  type BetaSummaryRow,
} from '../admin-api'
import { exportBetaCsv } from '../exports'
import { downloadBetaPdf } from '../pdf'

const Counter = ({
  label,
  value,
  icon: Icon,
  tone,
  hero,
}: {
  label: string
  value: string
  icon: LucideIcon
  tone?: string
  hero?: boolean
}) => (
  <div className={`kpi glass cursor-default ${hero ? 'kpi-hero' : ''}`}>
    <span className={`k-ic ${tone ?? ''}`}>
      <Icon size={20} />
    </span>
    <span className="k-val mono">{value}</span>
    <span className="k-lbl">{label}</span>
  </div>
)

/** Chauffeur beta (PLAN §6.11). Every number comes from the beta_summary() / beta_days() database functions. */
export function BetaTab({
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
  const summary = useBetaSummary(month, driverId || null)
  const days = useBetaDays(month, driverId || null)
  const monthRow = useBetaMonth(month)
  const rates = useBetaRates()
  const finalise = useFinaliseMonth()
  const reopen = useReopenMonth()
  const [dialog, setDialog] = useState<'finalise' | 'reopen' | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  const rows = summary.data ?? []
  const sum = (k: 'local_days' | 'outstation_days' | 'payable_days' | 'total_amount') =>
    rows.reduce((n, r) => n + r[k], 0)
  const finalised = monthRow.data?.status === 'finalised'
  const today = istParts().date
  const inForce = rates.data?.find((r) => r.effective_from <= today)
  const monthEnd = `${month}-31`
  const rateForMonth = rates.data?.find((r) => r.effective_from <= monthEnd) ?? null

  const columns: Column<BetaSummaryRow>[] = [
    {
      key: 'd',
      header: 'Driver',
      primary: true,
      cell: (r) => (
        <Person
          lead={<Avatar name={r.driver_name} />}
          name={r.driver_name}
          sub={r.payable_days ? `${r.payable_days} payable days` : 'No duties this month'}
        />
      ),
    },
    {
      key: 'l',
      header: 'Local days',
      cell: (r) => <span className="mono">{r.local_days}</span>,
    },
    {
      key: 'o',
      header: 'Outstation days',
      cell: (r) => <span className="mono">{r.outstation_days}</span>,
    },
    {
      key: 'p',
      header: 'Total payable duties',
      cell: (r) => <span className="mono">{r.payable_days}</span>,
    },
    {
      key: 't',
      header: 'Total beta',
      cell: (r) => <b className="mono">{inr(r.total_amount)}</b>,
    },
  ]
  const dayColumns: Column<BetaDay>[] = [
    {
      key: 'date',
      header: 'Date',
      primary: true,
      cell: (d) => <span className="font-bold tabular">{fmtDate(d.entry_date)}</span>,
    },
    {
      key: 'n',
      header: 'Duties logged',
      cell: (d) => (
        <span className="tabular">
          {d.duties_logged}
          {d.duties_logged > 1 && <span className="ml-1.5 text-xs text-muted">→ counted once</span>}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Day counted as',
      cell: (d) => (
        <StatusBadge tone={d.day_type === 'Outstation' ? 'teal' : 'info'}>{d.day_type}</StatusBadge>
      ),
    },
    {
      key: 'beta',
      header: 'Beta',
      cell: (d) => <span className="font-bold tabular">{inr(d.beta)}</span>,
    },
  ]

  async function pdf() {
    setPdfBusy(true)
    try {
      await downloadBetaPdf({
        month,
        rows,
        finalised,
        rates: rateForMonth
          ? { local: rateForMonth.local_rate, outstation: rateForMonth.outstation_rate }
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
            <option value="">All drivers</option>
            {drivers.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn btn-ghost"
          disabled={!rows.length}
          onClick={() => exportBetaCsv(month, rows)}
        >
          <Download aria-hidden /> CSV
        </button>
        <button className="btn btn-ghost" disabled={!rows.length || pdfBusy} onClick={pdf}>
          <FileDown aria-hidden /> {pdfBusy ? 'Preparing…' : 'PDF'}
        </button>
      </div>
      <MonthNav month={month} onChange={onMonth} max={monthOf(today)} />

      <section className="glass card rate-card">
        <div className="card-h">
          <h2>
            <IndianRupee size={20} aria-hidden /> Beta rates
          </h2>
          <Link to="/admin/trip-duty/beta-rates" className="btn btn-ghost btn-sm">
            <Pencil aria-hidden /> Edit rates
          </Link>
        </div>
        <div className="rates">
          <div className="rate">
            <span className="muted text-[13px]">Local</span>
            <b className="mono">{inForce ? inr(inForce.local_rate) : '—'}</b>
            <span className="muted text-[13px]">per payable day</span>
          </div>
          <div className="rate">
            <span className="muted text-[13px]">Outstation</span>
            <b className="mono">{inForce ? inr(inForce.outstation_rate) : '—'}</b>
            <span className="muted text-[13px]">per payable day</span>
          </div>
        </div>
        <p className="sr-only">
          Local {inForce ? inr(inForce.local_rate) : '—'} · Outstation{' '}
          {inForce ? inr(inForce.outstation_rate) : '—'} per payable day
        </p>
        <ul className="rules">
          <li>
            <CalendarCheck aria-hidden />
            <span>
              Only closed duties are paid. Several duties by the same driver on the same date count
              as <b>one payable duty</b>.
            </span>
          </li>
          <li>
            <Route aria-hidden />
            <span>
              If <b>any</b> Outstation duty is on that date, the whole day counts as{' '}
              <b>Outstation</b>. Week offs, leave and open duties pay nothing.
            </span>
          </li>
          {inForce && (
            <li>
              <History aria-hidden />
              <span>
                Rates in force since <b>{fmtDate(inForce.effective_from)}</b>. Each day is paid at
                the rate in force on that date.
              </span>
            </li>
          )}
        </ul>
      </section>

      <div className="card-h mt-5 mb-3 px-0.5">
        <h2 className="text-base font-bold">
          {driverId
            ? (drivers.data?.find((d) => d.id === driverId)?.full_name ?? 'Driver')
            : 'All drivers'}{' '}
          · {monthLabel(month)}
        </h2>
        {finalised ? (
          <StatusBadge tone="ok">Finalised</StatusBadge>
        ) : (
          <StatusBadge tone="warn">Draft</StatusBadge>
        )}
      </div>
      <div className="kpis beta-kpis">
        <Counter label="Local days" value={String(sum('local_days'))} icon={MapPin} tone="t-info" />
        <Counter
          label="Outstation days"
          value={String(sum('outstation_days'))}
          icon={Route}
          tone="t-teal"
        />
        <Counter
          label="Total payable duties"
          value={String(sum('payable_days'))}
          icon={CalendarCheck}
          tone="t-violet"
        />
        <Counter label="Total beta" value={inr(sum('total_amount'))} icon={IndianRupee} hero />
      </div>

      <div className="mt-3.5">
        {driverId ? (
          <DataTable
            rows={days.data ?? []}
            columns={dayColumns}
            rowKey={(d) => d.entry_date}
            loading={days.isLoading}
            pageSize={50}
            empty={
              <EmptyState
                icon={CarFront}
                title="No payable duties"
                hint={`This driver has no closed duties in ${month}, so no beta.`}
              />
            }
          />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.driver_id}
            loading={summary.isLoading}
            pageSize={50}
            empty={<EmptyState icon={CarFront} title="No drivers yet" />}
            actions={(r) => (
              <button className="btn btn-ghost btn-sm" onClick={() => onDriver(r.driver_id)}>
                <List aria-hidden /> Day-wise
              </button>
            )}
          />
        )}
      </div>
      {driverId && (
        <p className="mt-3">
          <button className="link inline-ic" onClick={() => onDriver('')}>
            <ArrowLeft aria-hidden /> Back to all drivers
          </button>
        </p>
      )}

      <section className="glass card mt-3.5 flex flex-wrap items-center gap-3.5">
        <div className="min-w-[220px] flex-1">
          <b>{finalised ? 'Month finalised' : 'Finalise this month'}</b>
          <p className="muted text-[13px]">
            {finalised
              ? 'Locked. This month reads from the saved statements, so later duty edits don’t change the amounts paid. Reopen it (with a reason) to recalculate.'
              : 'Locks the beta amounts for payroll. Duties edited later will not change a finalised month.'}
          </p>
        </div>
        {finalised ? (
          <button className="btn btn-ghost" onClick={() => setDialog('reopen')}>
            <LockOpen aria-hidden /> Reopen
          </button>
        ) : (
          <button
            className="btn btn-primary"
            disabled={!rows.length || !!driverId}
            title={
              driverId ? 'Finalise applies to all drivers; clear the driver filter' : undefined
            }
            onClick={() => setDialog('finalise')}
          >
            <Lock aria-hidden /> Finalise month
          </button>
        )}
      </section>

      <ConfirmDialog
        open={dialog === 'finalise'}
        tone="primary"
        title="Finalise this month?"
        confirmLabel="Finalise"
        busy={finalise.isPending}
        description={
          <>
            Beta for <b>{month}</b> ({inr(sum('total_amount'))} across {rows.length} drivers) is
            saved as paid. Later duty edits won’t change it unless you reopen the month.
          </>
        }
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          finalise.mutate(month, {
            onSuccess: () => {
              toast('Month finalised')
              setDialog(null)
            },
            onError: (e) => {
              setDialog(null)
              toast(e.message, 'error')
            },
          })
        }
      />
      <ConfirmDialog
        open={dialog === 'reopen'}
        title="Reopen this month?"
        confirmLabel="Reopen"
        tone="danger"
        busy={reopen.isPending}
        reasonLabel="Reason for reopening (logged)"
        description="Saved statements are removed and the month recalculates from the duties."
        onCancel={() => setDialog(null)}
        onConfirm={(reason) =>
          reason &&
          reopen.mutate(
            { month, reason },
            {
              onSuccess: () => {
                toast('Month reopened')
                setDialog(null)
              },
              onError: (e) => {
                setDialog(null)
                toast(e.message, 'error')
              },
            },
          )
        }
      />
    </div>
  )
}
