import { useState } from 'react'
import { inputCls } from '@/components/form-styles'
import { useUsers } from '@/features/users/api'
import type { Doctor } from '../api'

/** Small action modal (not an add/edit form): pick a new Doctor's Manager. */
export function ReassignDialog({
  doctor,
  busy,
  onCancel,
  onConfirm,
}: {
  doctor: Doctor
  busy?: boolean
  onCancel: () => void
  onConfirm: (managerId: string) => void
}) {
  const managers = useUsers('manager')
  const [id, setId] = useState('')
  const options = (managers.data ?? []).filter((m) => m.is_active && m.id !== doctor.manager_id)
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#142033]/40 p-4"
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reassign-title"
        className="glass w-full max-w-sm rounded-modal bg-white/90 p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="reassign-title" className="text-lg font-extrabold tracking-tight">
          Reassign {doctor.name}
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Currently with <b>{doctor.manager_name ?? 'nobody'}</b>. Past requests are unaffected.
        </p>
        <label className="mt-3 block text-sm font-semibold">
          New Doctor’s Manager
          <select className={`${inputCls} mt-1`} value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Choose manager</option>
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-5 flex justify-end gap-2">
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
            onClick={() => onConfirm(id)}
            className="min-h-11 rounded-control bg-primary px-4 font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Please wait…' : 'Reassign'}
          </button>
        </div>
      </div>
    </div>
  )
}
