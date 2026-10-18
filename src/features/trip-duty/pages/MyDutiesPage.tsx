import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, ChevronLeft, ChevronRight, Info, Pencil, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { IconButton, IconLink } from '@/components/ListParts'
import { addDays, istParts, monthLabel, monthOf, shiftMonth } from '@/lib/time'
import { useDeleteEntries, useEditWindow, useMonthEntries, useMyBeta } from '../api'
import { DutyCard } from '../components/DutyCard'
import { MonthCalendar } from '../components/MonthCalendar'
import { StatsGrid } from '../components/StatsGrid'
import { monthSummary, type DayEntry } from '../logic'

const LEAVE_TONE = { pending: 'warn', approved: 'ok', rejected: 'danger' } as const
const dayLabel = (d: string) =>
  new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${d}T00:00:00Z`))

export function MyDutiesPage() {
  const toast = useToast()
  const today = istParts().date
  const thisMonth = monthOf(today)
  const [params, setParams] = useSearchParams()
  const month = /^\d{4}-\d{2}$/.test(params.get('m') ?? '') ? params.get('m')! : thisMonth
  const entries = useMonthEntries(month)
  const beta = useMyBeta(month)
  const windowDays = useEditWindow().data ?? 7
  const del = useDeleteEntries()
  const [selected, setSelected] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<DayEntry | null>(null)

  const all = useMemo(() => entries.data ?? [], [entries.data])
  const byDay = useMemo(() => {
    const m = new Map<string, DayEntry[]>()
    for (const e of all) m.set(e.entry_date, [...(m.get(e.entry_date) ?? []), e])
    return [...m.entries()].sort(([a], [b]) => b.localeCompare(a)) // newest first
  }, [all])

  const minDate = addDays(today, -windowDays)
  const canChange = (e: DayEntry) =>
    e.entry_source === 'app' &&
    e.entry_date >= minDate &&
    !(e.entry_type === 'leave' && e.leave_status !== 'pending')
  const go = (delta: number) => {
    setParams({ m: shiftMonth(month, delta) })
    setSelected(null)
  }
  const pick = (d: string) => {
    setSelected(d)
    document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const actions = (e: DayEntry) =>
    canChange(e) && (
      <>
        {e.entry_type === 'duty' && (
          <IconLink
            to={`/driver/duty/edit/${e.id}`}
            label={`Edit duty on ${dayLabel(e.entry_date)}`}
            icon={Pencil}
          />
        )}
        <IconButton
          danger
          label={`${e.entry_type === 'leave' ? 'Cancel' : 'Delete'} entry on ${dayLabel(e.entry_date)}`}
          icon={Trash2}
          onClick={() => setToDelete(e)}
        />
      </>
    )

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>My Duties</h1>
          <p className="muted">{monthLabel(month)}</p>
        </div>
      </div>
      <div className="glass mb-3.5 flex items-center justify-between gap-2 p-2.5">
        <button aria-label="Previous month" onClick={() => go(-1)} className="icon-btn">
          <ChevronLeft />
        </button>
        <span className="font-bold">{monthLabel(month)}</span>
        <button
          aria-label="Next month"
          disabled={month >= thisMonth}
          onClick={() => go(1)}
          className="icon-btn disabled:opacity-40"
        >
          <ChevronRight />
        </button>
      </div>

      {entries.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <div className="glass h-24 animate-pulse" />
          <div className="glass h-64 animate-pulse" />
        </div>
      ) : (
        <>
          <StatsGrid stats={monthSummary(all)} beta={beta.data} />
          <div className="mt-3.5">
            <MonthCalendar
              month={month}
              entries={all}
              today={today}
              selected={selected}
              onSelect={pick}
            />
          </div>
          {byDay.length === 0 ? (
            <div className="glass mt-3.5">
              <EmptyState
                icon={CalendarCheck}
                title="No entries this month"
                hint="Duties, week offs and leave you log show up here."
              />
            </div>
          ) : (
            byDay.map(([date, list]) => (
              <section key={date} id={`day-${date}`} className="scroll-mt-20">
                <h3 className="day-h">
                  {dayLabel(date)}
                  {list.filter((e) => e.entry_type === 'duty').length > 1 &&
                    ` · ${list.length} duties`}
                </h3>
                <ul>
                  {list.map((e) =>
                    e.entry_type === 'duty' ? (
                      <DutyCard
                        key={e.id}
                        e={e}
                        highlight={selected === date}
                        actions={actions(e)}
                      />
                    ) : (
                      <li key={e.id} className="glass entry list-none">
                        <div className="entry-top">
                          {e.entry_type === 'week_off' ? (
                            <span className="badge b-muted">Week off</span>
                          ) : (
                            <>
                              <span className="badge b-warn">
                                Leave{e.leave_type ? ` · ${e.leave_type}` : ''}
                              </span>
                              {e.leave_status && (
                                <StatusBadge tone={LEAVE_TONE[e.leave_status]}>
                                  {e.leave_status}
                                </StatusBadge>
                              )}
                            </>
                          )}
                          <span className="acts">{actions(e)}</span>
                        </div>
                        {e.leave_reason && (
                          <div className="entry-meta">
                            <span>{e.leave_reason}</span>
                          </div>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              </section>
            ))
          )}
          <p className="muted mt-3.5 inline-flex items-center gap-1.5 text-[13px]">
            <Info size={15} aria-hidden />
            You can edit or delete entries from the last {windowDays} days. For older ones, ask your
            admin.
          </p>
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={toDelete?.entry_type === 'leave' ? 'Cancel this leave day?' : 'Delete this entry?'}
        confirmLabel={toDelete?.entry_type === 'leave' ? 'Cancel leave' : 'Delete'}
        busy={del.isPending}
        description="Your admin can still see it in the history if it was already counted."
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete &&
          del.mutate([toDelete.id], {
            onSuccess: () => {
              toast('Removed')
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
