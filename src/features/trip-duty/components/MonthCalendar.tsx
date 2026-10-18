import { cn } from '@/lib/utils'
import { buildCalendar, type CalDay, type DayEntry } from '../logic'

const HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Month grid in the prototype's style: tinted day cells with a dot (duty blue, week off grey, leave amber). */
export function MonthCalendar({
  month,
  entries,
  today,
  selected,
  onSelect,
  detail,
}: {
  month: string
  entries: DayEntry[]
  today: string
  selected?: string | null
  onSelect?: (date: string) => void
  /** Admin view: also print "Outstation" and "N duties" under the day number. */
  detail?: boolean
}) {
  const weeks = buildCalendar(month, entries)
  const cell = (d: CalDay) => {
    if (!d.inMonth) return <div key={d.date} className="day empty" aria-hidden="true" />
    const type = d.duties > 0 ? 'duty' : d.weekOff ? 'week_off' : d.leave ? 'leave' : ''
    const meta = [
      d.outstation ? 'Outstation' : '',
      d.duties > 1 ? `${d.duties} duties` : '',
      type === 'week_off' ? 'Week off' : '',
      type === 'leave' ? 'Leave' : '',
    ]
      .filter(Boolean)
      .join(' · ')
    return (
      <button
        key={d.date}
        type="button"
        onClick={() => onSelect?.(d.date)}
        aria-label={`${d.date}${d.duties ? `, ${d.duties} duties${d.outstation ? ', outstation' : ''}` : ''}${d.weekOff ? ', week off' : ''}${d.leave ? `, leave ${d.leave}` : ''}`}
        className={cn(
          'day cursor-pointer text-ink',
          type,
          d.date === today && 'today',
          selected === d.date && 'ring-2 ring-primary',
        )}
      >
        <span className="mono">{d.day}</span>
        {type && <span className="dot" />}
        {detail && meta && <span className="meta !block">{meta}</span>}
      </button>
    )
  }
  return (
    <section className="glass card">
      <div className="cal">
        {HEAD.map((h) => (
          <div key={h} className="dow">
            {h}
          </div>
        ))}
        {weeks.flat().map(cell)}
      </div>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--color-info)' }} />
          Duty
        </span>
        <span>
          <i style={{ background: '#6b7689' }} />
          Week off
        </span>
        <span>
          <i style={{ background: '#c2680a' }} />
          Leave
        </span>
        <span>
          <i style={{ background: 'transparent', border: '2px solid var(--color-primary)' }} />
          Today
        </span>
      </div>
    </section>
  )
}
