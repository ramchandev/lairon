import { ConfirmDialog } from '@/components/ConfirmDialog'
import { fmtDate, inr } from '@/lib/format'
import { monthLabel } from '@/lib/time'
import { currentMonthKey, lastDayOf } from '../revenue'

/** "Save this revenue? You can edit it until the month ends." — Yes / No. */
export function RevenueConfirm({
  open,
  doctorName,
  month,
  previous,
  next,
  admin,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean
  doctorName: string
  month: string
  previous: number | null
  next: number
  admin: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ended = month < currentMonthKey()
  return (
    <ConfirmDialog
      open={open}
      tone="primary"
      title={previous === null ? 'Save this revenue?' : 'Change this revenue?'}
      confirmLabel="Yes, save"
      cancelLabel="No"
      busy={busy}
      description={
        <>
          {previous === null ? (
            <>
              Save <b>{inr(next)}</b> as {doctorName}’s revenue for <b>{monthLabel(month)}</b>?
            </>
          ) : (
            <>
              Change {doctorName}’s revenue for <b>{monthLabel(month)}</b> from {inr(previous)} to{' '}
              <b>{inr(next)}</b>?
            </>
          )}{' '}
          {ended && admin
            ? 'This month has ended; only an admin can change it.'
            : `You can edit this until the month ends (${fmtDate(lastDayOf(month))}). After that it is locked and only an admin can change it.`}
        </>
      }
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
