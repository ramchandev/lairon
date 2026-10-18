import type { ReactNode } from 'react'
import { ArrowRight, CarFront, Clock, Fuel, Gauge, UserRound } from 'lucide-react'
import { fmtDate, inr } from '@/lib/format'
import { minutesText, time12 } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { DayEntry } from '../logic'

/** One duty as the prototype's "entry" card: type badge, route, then vehicle / km / time / fuel. */
export function DutyCard({
  e,
  actions,
  highlight,
}: {
  e: DayEntry
  actions?: ReactNode
  highlight?: boolean
}) {
  const hasRoute = !!(e.pickup_point || e.drop_point)
  return (
    <li className={cn('glass entry list-none', highlight && 'ring-2 ring-primary/40')}>
      <div className="entry-top">
        <span className={cn('badge', e.duty_type === 'Out Station' ? 'b-teal' : 'b-info')}>
          {e.duty_type === 'Out Station' ? 'Out Station' : 'Local'}
        </span>
        {e.duty_status === 'open' && <span className="badge b-warn">Open</span>}
        {e.entry_source === 'import' && <span className="badge b-muted">Imported</span>}
        {actions && <span className="acts">{actions}</span>}
      </div>
      <div className="entry-route">
        {hasRoute ? (
          <>
            <span>{e.pickup_point || '—'}</span>
            <ArrowRight aria-hidden />
            <span>{e.drop_point || '—'}</span>
          </>
        ) : (
          e.guest_name || 'Duty'
        )}
      </div>
      <div className="entry-meta">
        {e.guest_name && hasRoute && (
          <span>
            <UserRound aria-hidden />
            {e.guest_name}
          </span>
        )}
        <span>
          <CarFront aria-hidden />
          {e.vehicle_label ?? '—'}
        </span>
        {(e.start_km !== null || e.total_km !== null) && (
          <span className="mono">
            <Gauge aria-hidden />
            {e.total_km !== null ? `${e.total_km} km` : `Start ${e.start_km}`}
          </span>
        )}
        <span className="mono">
          <Clock aria-hidden />
          {time12(e.start_time)}
          {e.end_time && (
            <>
              {' '}
              – {time12(e.end_time)}
              {e.end_date && e.end_date !== e.entry_date && <> · {fmtDate(e.end_date)}</>}
            </>
          )}
          {e.total_minutes ? ` · ${minutesText(e.total_minutes)}` : ''}
        </span>
        {(e.fuel_litres || e.fuel_amount) && (
          <span className="mono">
            <Fuel aria-hidden />
            {e.fuel_litres ? `${e.fuel_litres} L` : ''}
            {e.fuel_litres && e.fuel_amount ? ' · ' : ''}
            {e.fuel_amount ? inr(Number(e.fuel_amount)) : ''}
          </span>
        )}
      </div>
    </li>
  )
}
