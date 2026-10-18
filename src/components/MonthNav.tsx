import { ChevronLeft, ChevronRight } from 'lucide-react'
import { monthLabel, shiftMonth } from '@/lib/time'

/** Previous / next month with the label between. `max` stops navigating into the future. */
export function MonthNav({
  month,
  onChange,
  max,
}: {
  month: string
  onChange: (m: string) => void
  max?: string
}) {
  return (
    <div className="filters glass !flex items-center justify-between gap-2 !p-2.5">
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="icon-btn"
      >
        <ChevronLeft className="size-5" />
      </button>
      <span className="font-bold">{monthLabel(month)}</span>
      <button
        type="button"
        aria-label="Next month"
        disabled={!!max && month >= max}
        onClick={() => onChange(shiftMonth(month, 1))}
        className="icon-btn disabled:opacity-40"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}
