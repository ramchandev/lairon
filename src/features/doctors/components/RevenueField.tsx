import { Lock } from 'lucide-react'
import { Field } from '@/components/FormPage'
import { inputCls } from '@/components/form-styles'
import { fmtDate } from '@/lib/format'
import { monthLabel } from '@/lib/time'
import { lastDayOf } from '../revenue'
import type { RevenueFieldState } from '../useRevenueField'

/** "Revenue this doctor brings in {month}" with the freeze rules spelled out. */
export function RevenueField({ month, state }: { month: string; state: RevenueFieldState }) {
  return (
    <Field
      label={`Revenue from this doctor — ${monthLabel(month)} (₹)`}
      error={state.invalid ? 'Enter an amount, e.g. 125000' : undefined}
      hint={
        state.locked ? (
          <span className="inline-flex items-center gap-1">
            <Lock size={13} aria-hidden /> {monthLabel(month)} has ended, so this is locked. Ask an
            admin to change it.
          </span>
        ) : state.saved === null ? (
          `Optional. You can edit it until ${fmtDate(lastDayOf(month))}.`
        ) : (
          `Saved. You can edit it until ${fmtDate(lastDayOf(month))}; you’ll be asked to confirm.`
        )
      }
    >
      <div className="input-group">
        <span className="prefix">₹</span>
        <input
          className={`${inputCls} mono`}
          inputMode="decimal"
          placeholder="e.g. 125000"
          value={state.text}
          disabled={state.locked || state.loading}
          onChange={(e) => state.setText(e.target.value)}
        />
      </div>
    </Field>
  )
}
