import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarX,
  CarFront,
  Coffee,
  Flag,
  Hourglass,
  Play,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { EmptyState } from '@/components/EmptyState'
import { fmtDate } from '@/lib/format'
import { istParts, minutesText, monthOf, time12, timeToMinutes, diffDays } from '@/lib/time'
import { useNow } from '@/lib/useNow'
import { useLeaves, useMonthEntries, useMyBeta, useOpenDuties } from '../api'
import { DutyCard } from '../components/DutyCard'
import { StatsGrid } from '../components/StatsGrid'
import { groupLeaves, monthSummary, type DayEntry } from '../logic'

/** Minutes since an open duty started (India time), so a duty left open overnight still shows the right clock. */
function elapsed(e: DayEntry, now: Date): number | null {
  const start = timeToMinutes(e.start_time ?? '')
  if (Number.isNaN(start)) return null
  const n = istParts(now)
  return diffDays(e.entry_date, n.date) * 1440 + timeToMinutes(n.time) - start
}

export function TodayPage() {
  const { profile } = useAuth()
  const now = useNow()
  const today = istParts(now).date
  const month = monthOf(today)
  const entries = useMonthEntries(month)
  const open = useOpenDuties()
  const leaves = useLeaves()
  const beta = useMyBeta(month)

  const all = entries.data ?? []
  const todays = all.filter((e) => e.entry_date === today)
  const openDuty = open.data?.[0]
  const weekOffToday = todays.some((e) => e.entry_type === 'week_off')
  const leaveToday = todays.some((e) => e.entry_type === 'leave' && e.leave_status !== 'rejected')
  const closedToday = todays.filter((e) => e.entry_type === 'duty' && e.duty_status === 'closed')
  const pendingLeaves = groupLeaves(leaves.data ?? []).filter(
    (g) => g.status === 'pending' && g.to >= today,
  )

  const startBlocked = openDuty
    ? 'Close the open duty first'
    : weekOffToday
      ? 'Today is your week off'
      : leaveToday
        ? 'You’re on leave today'
        : null
  const h = Number(istParts(now).time.slice(0, 2))
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const mins = openDuty ? elapsed(openDuty, now) : null

  const tile = (
    Icon: LucideIcon,
    tone: string,
    label: string,
    sub: string,
    to: string,
    disabled?: boolean,
  ) => {
    const body = (
      <>
        <span className={`k-ic ${tone}`}>
          <Icon size={22} />
        </span>
        <b>{label}</b>
        <span className="text-[13px] text-muted">{sub}</span>
      </>
    )
    return disabled ? (
      <button type="button" disabled aria-disabled="true" className="act-tile glass disabled">
        {body}
      </button>
    ) : (
      <Link to={to} className="act-tile glass">
        {body}
      </Link>
    )
  }

  return (
    <div>
      <div className="hello mb-4">
        <div>
          <p className="eyebrow">
            {new Intl.DateTimeFormat('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: 'UTC',
            }).format(new Date(`${today}T00:00:00Z`))}
          </p>
          <h1>
            {greet}, {profile?.full_name.split(' ')[0]}
          </h1>
        </div>
      </div>

      {openDuty && (
        <section className="duty-hero" aria-label="Open duty">
          <div className="dh-top">
            <span className="dh-pill">
              <i className="live" aria-hidden="true" />
              On duty{mins !== null ? ` · ${minutesText(Math.max(0, mins))}` : ''}
            </span>
            <span className="dh-type">{openDuty.duty_type}</span>
          </div>
          <div className="dh-route">
            <span>{openDuty.pickup_point || openDuty.guest_name || 'Duty'}</span>
            {openDuty.drop_point && (
              <>
                <ArrowRight aria-hidden />
                <span>{openDuty.drop_point}</span>
              </>
            )}
          </div>
          <dl className="dh-meta">
            <div>
              <dt>Guest</dt>
              <dd>{openDuty.guest_name || '—'}</dd>
            </div>
            <div>
              <dt>Vehicle</dt>
              <dd>{openDuty.vehicle_label ?? '—'}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{time12(openDuty.start_time)}</dd>
            </div>
            <div>
              <dt>Start KM</dt>
              <dd className="mono">{openDuty.start_km ?? '—'}</dd>
            </div>
          </dl>
          <Link to={`/driver/duty/close/${openDuty.id}`} className="btn btn-white btn-lg">
            <Flag aria-hidden /> Close duty
          </Link>
          <Link
            to={`/driver/duty/edit/${openDuty.id}`}
            className="mt-2 block text-center text-sm font-semibold text-white/90 underline-offset-2 hover:underline"
          >
            Edit duty details
          </Link>
        </section>
      )}

      {weekOffToday && (
        <div className="glass notice">
          <span className="k-ic t-violet">
            <Coffee size={20} />
          </span>
          <div>
            <b>Week off today</b>
            <p className="muted text-sm">Enjoy your day off.</p>
          </div>
        </div>
      )}
      {leaveToday && (
        <div className="glass notice">
          <span className="k-ic t-warn">
            <CalendarX size={20} />
          </span>
          <div>
            <b>On leave today</b>
          </div>
        </div>
      )}

      <div className="act-tiles">
        {tile(
          Play,
          't-info',
          'Start duty',
          startBlocked ?? 'Local or Out Station',
          '/driver/duty/new',
          !!startBlocked,
        )}
        {tile(Coffee, 't-violet', 'Week off', 'Mark a day off', '/driver/weekoff')}
        {tile(CalendarX, 't-warn', 'Apply leave', 'Sent for approval', '/driver/leave')}
      </div>

      {pendingLeaves.length > 0 && (
        <div className="mt-3.5">
          {pendingLeaves.map((g) => (
            <div key={g.from} className="glass notice">
              <span className="k-ic t-warn">
                <Hourglass size={20} />
              </span>
              <div>
                <b>Leave request pending</b>
                <p className="muted text-sm">
                  {g.type} ·{' '}
                  {g.from === g.to ? fmtDate(g.from) : `${fmtDate(g.from)} – ${fmtDate(g.to)}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="sec-h">
        Completed today{closedToday.length ? ` (${closedToday.length})` : ''}
      </h2>
      {closedToday.length ? (
        <ul>
          {closedToday.map((e) => (
            <DutyCard key={e.id} e={e} />
          ))}
        </ul>
      ) : (
        <div className="glass">
          <EmptyState
            icon={CarFront}
            title="Nothing closed yet today"
            hint={
              openDuty
                ? 'Close your open duty when the trip ends.'
                : 'Tap Start duty when you pick up your guest.'
            }
          />
        </div>
      )}

      <h2 className="sec-h">This month</h2>
      {entries.isLoading ? (
        <div className="glass h-24 animate-pulse" />
      ) : (
        <StatsGrid compact stats={monthSummary(all)} beta={beta.data} />
      )}
      <p className="mt-3.5">
        <Link className="link inline-ic" to="/driver/month">
          See all my duties <ArrowRight aria-hidden />
        </Link>
      </p>
    </div>
  )
}
