import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ClipboardPlus, Inbox, MapPin, Pencil, Phone, UserPlus } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { EmptyState } from '@/components/EmptyState'
import { ChipFilter, SearchInput } from '@/components/ListControls'
import { Fab, Person, Tag } from '@/components/ListParts'
import { StatusBadge } from '@/components/StatusBadge'
import { CallLink } from '@/features/users/components'
import { useDoctors } from '../api'

/** Manager home: their doctors as cards. RLS guarantees only their own appear. */
export function MyDoctorsPage() {
  const { data, isLoading } = useDoctors()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')

  const rows = useMemo(
    () =>
      (data ?? []).filter((d) => {
        if (status !== 'all' && d.is_active !== (status === 'active')) return false
        return `${d.name} ${d.speciality ?? ''} ${d.qualification ?? ''} ${d.hospital_name ?? ''} ${d.area ?? ''}`
          .toLowerCase()
          .includes(q.trim().toLowerCase())
      }),
    [data, q, status],
  )
  const n = data?.length ?? 0

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>My Doctors</h1>
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
          <SearchInput value={q} onChange={setQ} placeholder="Search name, hospital, area…" />
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
        rows.map((d) => (
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
              <Link to={`/m/doctors/${d.id}/edit`} className="btn btn-ghost btn-sm">
                <Pencil aria-hidden /> Edit
              </Link>
            </div>
          </section>
        ))
      )}

      <Fab to="/m/doctors/new" label="Add doctor" />
    </div>
  )
}
