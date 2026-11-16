import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  ClipboardPlus,
  Download,
  Eye,
  Inbox,
  MapPin,
  Pencil,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { Avatar } from '@/components/Avatar'
import { DataTable, type Column } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ChipFilter, SearchInput } from '@/components/ListControls'
import { Fab, IconLink, Person, Tag } from '@/components/ListParts'
import { ActiveBadge, StatusBadge } from '@/components/StatusBadge'
import { CallLink } from '@/features/users/components'
import { downloadCsv } from '@/lib/csvExport'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { useDoctors, type Doctor } from '../api'

/**
 * Manager home: every doctor in the directory (managers see all; they edit only the ones they added).
 * Phone: cards. Computer: a searchable table like the admin's, with the request / edit actions on each row.
 */
export function MyDoctorsPage() {
  const { profile } = useAuth()
  const desktop = useIsDesktop()
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

  const columns: Column<Doctor>[] = [
    {
      key: 'name',
      header: 'Doctor',
      primary: true,
      cell: (d) => <Person lead={<Avatar name={d.name} />} name={d.name} sub={d.speciality} />,
    },
    { key: 'qual', header: 'Qualification', cell: (d) => d.qualification || '—' },
    { key: 'div', header: 'Division', cell: (d) => (d.division ? <Tag>{d.division}</Tag> : '—') },
    { key: 'hospital', header: 'Hospital', cell: (d) => d.hospital_name || '—' },
    { key: 'area', header: 'Area', cell: (d) => d.area || '—' },
    { key: 'phone', header: 'Phone', cell: (d) => (d.phone ? <CallLink phone={d.phone} /> : '—') },
    { key: 'status', header: 'Status', cell: (d) => <ActiveBadge active={d.is_active} /> },
  ]
  const exportCsv = () =>
    downloadCsv(
      `doctors-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Doctor', 'Phone', 'Division', 'Qualification', 'Speciality', 'Hospital', 'Area', 'Status'],
      rows.map((d) => [
        d.name,
        d.phone,
        d.division,
        d.qualification,
        d.speciality,
        d.hospital_name,
        d.area,
        d.is_active ? 'Active' : 'Inactive',
      ]),
    )

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Doctors</h1>
          <p className="muted">
            {n} doctor{n === 1 ? '' : 's'}
          </p>
        </div>
        <div className="hidden gap-2 lg:flex">
          <button className="btn btn-ghost" onClick={exportCsv} disabled={rows.length === 0}>
            <Download aria-hidden /> Export CSV
          </button>
          <Link to="/m/doctors/new" className="btn btn-primary">
            <UserPlus aria-hidden /> Add doctor
          </Link>
        </div>
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
      ) : desktop ? (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(d) => d.id}
          rowTo={(d) => `/m/doctors/${d.id}`}
          pageSize={50}
          actions={(d) => (
            <>
              <IconLink
                to={`/m/request/add?doctor=${d.id}`}
                label={`Request service for ${d.name}`}
                icon={ClipboardPlus}
              />
              <IconLink to={`/m/doctors/${d.id}`} label={`View ${d.name}`} icon={Eye} />
              {d.manager_id === profile?.id && (
                <IconLink to={`/m/doctors/${d.id}/edit`} label={`Edit ${d.name}`} icon={Pencil} />
              )}
            </>
          )}
        />
      ) : (
        <div>
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
