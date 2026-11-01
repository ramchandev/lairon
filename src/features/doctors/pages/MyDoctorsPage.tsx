import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ClipboardPlus, Inbox, MapPin, Pencil, Phone, UserPlus } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { Avatar } from '@/components/Avatar'
import { EmptyState } from '@/components/EmptyState'
import { ChipFilter, SearchInput } from '@/components/ListControls'
import { Fab, Person, Tag } from '@/components/ListParts'
import { StatusBadge } from '@/components/StatusBadge'
import { CallLink } from '@/features/users/components'
import { useDoctors } from '../api'

/** Manager home: every doctor in the directory as cards (managers see all; they edit only the ones they added). */
export function MyDoctorsPage() {
  const { profile } = useAuth()
  const { data, isLoading } = useDoctors()
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')

  const rows = useMemo(
    () =>
      (data ?? []).filter((d) => {
        if (status !== 'all' && d.is_active !== (status === 'active')) return false
        if (scope === 'mine' && d.manager_id !== profile?.id) return false
        return `${d.name} ${d.phone ?? ''} ${d.speciality ?? ''} ${d.qualification ?? ''} ${d.hospital_name ?? ''} ${d.area ?? ''}`
          .toLowerCase()
          .includes(q.trim().toLowerCase())
      }),
    [data, q, status, scope, profile?.id],
  )
  const n = data?.length ?? 0

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Doctors</h1>
          <p className="muted">
            {n} doctor{n === 1 ? '' : 's'}
          </p>
        </div>
        <Link to="/m/doctors/new" className="btn btn-primary hidden lg:inline-flex">
          <UserPlus aria-hidden /> Add doctor
        </Link>
      </div>
      {n > 0 && (
        <div className="toolbar">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search name, phone, hospital, area…"
          />
          <ChipFilter
            value={scope}
            onChange={setScope}
            options={[
              { key: 'all', label: 'All doctors' },
              { key: 'mine', label: 'Added by me' },
            ]}
          />
          <ChipFilter
            value={status}
            onChange={setStatus}
            options={[
              { key: 'active', label: 'Active' },
              { key: 'inactive', label: 'Inactive' },
              { key: 'all', label: 'All' },
            ]}
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-24 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="glass">
          <EmptyState
            icon={Inbox}
            title={n ? 'No matches' : 'No doctors yet'}
            hint={
              n
                ? 'Try another name, hospital or area.'
                : 'Add your first doctor to start requesting services.'
            }
            action={
              !n ? (
                <Link to="/m/doctors/new" className="btn btn-primary">
                  Add your first doctor
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-3.5 xl:grid-cols-3">
          {rows.map((d) => (
            <section key={d.id} className="glass doc-card">
              <Link to={`/m/doctors/${d.id}`} className="doc-main">
                <Person
                  lead={<Avatar name={d.name} />}
                  name={
                    <>
                      {d.name} {!d.is_active && <StatusBadge>Inactive</StatusBadge>}
                    </>
                  }
                  sub={[d.qualification, d.speciality].filter(Boolean).join(' · ') || undefined}
                />
                {d.division && <Tag>{d.division}</Tag>}
              </Link>
              <div className="doc-sub">
                {d.hospital_name && (
                  <span>
                    <Building2 aria-hidden />
                    {d.hospital_name}
                  </span>
                )}
                {d.area && (
                  <span>
                    <MapPin aria-hidden />
                    {d.area}
                  </span>
                )}
                {d.phone && (
                  <span>
                    <Phone aria-hidden />
                    <CallLink phone={d.phone} />
                  </span>
                )}
              </div>
              <div className="row-actions">
                <Link to={`/m/request/add?doctor=${d.id}`} className="btn btn-primary btn-sm">
                  <ClipboardPlus aria-hidden /> Request service
                </Link>
                {d.manager_id === profile?.id && (
                  <Link to={`/m/doctors/${d.id}/edit`} className="btn btn-ghost btn-sm">
                    <Pencil aria-hidden /> Edit
                  </Link>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <Fab to="/m/doctors/new" label="Add doctor" />
    </div>
  )
}
