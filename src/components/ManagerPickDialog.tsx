import { useState, type ReactNode } from 'react'
import { inputCls } from '@/components/form-styles'
import { Portal } from '@/components/Portal'
import { useUsers } from '@/features/users/api'

/** Small action modal: choose an active manager (and an optional note) to take something over. */
export function ManagerPickDialog({
  title,
  intro,
  excludeId,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
  secondary,
}: {
  title: string
  intro?: ReactNode
  /** The manager who is giving the work up (not offered as a receiver). */
  excludeId?: string | null
  confirmLabel: string
  busy?: boolean
  onCancel: () => void
  onConfirm: (managerId: string, note: string) => void
  /** An extra, quieter choice (e.g. "Deactivate without handing over"). */
  secondary?: { label: string; onClick: () => void }
}) {
  const managers = useUsers('manager')
  const [id, setId] = useState('')
  const [note, setNote] = useState('')
  const options = (managers.data ?? []).filter((m) => m.is_active && m.id !== excludeId)
  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-[#142033]/40 p-4"
        onMouseDown={onCancel}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pick-title"
          className="w-full max-w-md rounded-modal border border-line bg-white p-5 shadow-[0_24px_60px_rgba(20,32,51,.28)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 id="pick-title" className="text-lg font-extrabold tracking-tight">
            {title}
          </h2>
          {intro && <div className="mt-1.5 text-sm text-ink-2">{intro}</div>}
          <label className="mt-3 block text-sm font-semibold">
            New manager
            <select
              className={`${inputCls} mt-1`}
              value={id}
              onChange={(e) => setId(e.target.value)}
            >
              <option value="">Choose manager</option>
              {options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm font-semibold">
            Note (optional)
            <input
              className={`${inputCls} mt-1 font-normal`}
              placeholder="e.g. Ram has left the organisation"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {secondary && (
              <button
                type="button"
                onClick={secondary.onClick}
                className="mr-auto min-h-11 px-1 text-sm font-semibold text-danger"
              >
                {secondary.label}
              </button>
            )}
            <button
              autoFocus
              type="button"
              onClick={onCancel}
              className="min-h-11 rounded-control border border-line-2 bg-white/70 px-4 font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!id || busy}
              onClick={() => onConfirm(id, note.trim())}
              className="min-h-11 rounded-control bg-primary px-4 font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Please wait…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
