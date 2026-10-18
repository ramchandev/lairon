import { Portal } from './Portal'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  /** Show a required reason box (reject / cancel / reopen). The reason is passed to onConfirm. */
  reasonLabel?: string
  busy?: boolean
  onConfirm: (reason?: string) => void
  onCancel: () => void
}

/** Custom modal for every delete / reject / cancel / sign-out. Never window.confirm. Focus starts on Cancel. */
export function ConfirmDialog(props: Props) {
  // Mounting the body only while open resets the reason box each time without an effect.
  return props.open ? <DialogBody {...props} /> : null
}

function DialogBody({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  reasonLabel,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  const needsReason = Boolean(reasonLabel)
  const disabled = busy || (needsReason && reason.trim().length === 0)

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-[#142033]/40 p-4"
        onMouseDown={onCancel}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="border border-line bg-white shadow-[0_24px_60px_rgba(20,32,51,.28)] w-full max-w-sm rounded-modal p-5"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 id="confirm-title" className="text-lg font-extrabold tracking-tight">
            {title}
          </h2>
          {description && <div className="mt-1.5 text-sm text-ink-2">{description}</div>}
          {reasonLabel && (
            <label className="mt-3 block text-sm font-semibold">
              {reasonLabel}
              <textarea
                className="mt-1 w-full rounded-control border border-line-2 bg-white/80 p-3 font-normal outline-none focus:border-primary"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="min-h-11 rounded-control border border-line-2 bg-white/70 px-4 font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onConfirm(needsReason ? reason.trim() : undefined)}
              className={cn(
                'min-h-11 rounded-control px-4 font-semibold text-white disabled:opacity-50',
                tone === 'danger' ? 'bg-danger' : 'bg-primary',
              )}
            >
              {busy ? 'Please wait…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
