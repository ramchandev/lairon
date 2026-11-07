import { useState } from 'react'
import { useUsers } from '@/features/users/api'
import { inputCls } from '@/components/form-styles'

/** Admin: which manager's figures to show. Managers never see this. */
export function useManagerChoice(initial = '') {
  const [managerId, setManagerId] = useState(initial)
  const managers = (useUsers('manager').data ?? []).filter((m) => m.is_active)
  return { managerId, setManagerId, managers }
}

export function ManagerPicker({
  managers,
  value,
  onChange,
  allowAll,
}: {
  managers: { id: string; full_name: string }[]
  value: string
  onChange: (id: string) => void
  allowAll?: boolean
}) {
  return (
    <div className="mb-3 max-w-xs">
      <label className="mb-1 block text-sm font-semibold" htmlFor="perf-manager">
        Manager
      </label>
      <select
        id="perf-manager"
        className={inputCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{allowAll ? 'All managers' : 'Select a manager'}</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name}
          </option>
        ))}
      </select>
    </div>
  )
}
