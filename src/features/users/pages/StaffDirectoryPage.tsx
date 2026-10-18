import { useMemo, useState } from 'react'
import { Contact } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { SearchInput } from '@/components/ListControls'
import { useUsers } from '../api'
import { Avatar, CallLink, visibleEmail } from '../components'

/** Read-only, searchable by name or area. Staff and Doctor's Managers see active staff only (enforced by RLS). */
export function StaffDirectoryPage() {
  const { data, isLoading } = useUsers('staff')
  const [q, setQ] = useState('')
  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (u) =>
          u.is_active &&
          `${u.full_name} ${u.area ?? ''} ${u.hq ?? ''}`
            .toLowerCase()
            .includes(q.trim().toLowerCase()),
      ),
    [data, q],
  )
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Staff directory</h1>
      <SearchInput value={q} onChange={setQ} placeholder="Search by name or area" />
      {isLoading ? (
        <div className="glass h-20 animate-pulse" />
      ) : rows.length === 0 ? (
        <div className="glass">
          <EmptyState icon={Contact} title="No staff found" />
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((u) => (
            <li key={u.id} className="glass flex items-center gap-3 p-4">
              <Avatar name={u.full_name} url={u.avatar_url} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{u.full_name}</p>
                <p className="truncate text-sm text-muted">
                  {[u.area, u.hq].filter(Boolean).join(' · ') || 'No area set'}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <CallLink phone={u.phone} />
                  {visibleEmail(u.email) && (
                    <span className="truncate text-ink-2">{visibleEmail(u.email)}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
