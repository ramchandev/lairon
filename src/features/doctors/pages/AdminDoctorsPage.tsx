import { useMemo, useState } from 'react'
import { Download, Eye, Inbox, Pencil, Repeat } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { DataTable, type Column } from '@/components/DataTable'
import { AddButton, Fab, IconButton, IconLink, Person, Tag } from '@/components/ListParts'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/FormPage'
import { ChipFilter, SearchInput } from '@/components/ListControls'
import { ActiveBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useUsers } from '@/features/users/api'
import { downloadCsv } from '@/lib/csvExport'
import { useDoctors, useReassignDoctor, type Doctor } from '../api'
import { ReassignDialog } from '../components/ReassignDialog'

export function AdminDoctorsPage() {
  const { data, isLoading } = useDoctors()
  const managers = useUsers('manager')
  const reassign = useReassignDoctor()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [manager, setManager] = useState('all') // all | none | <manager id>
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [target, setTarget] = useState<Doctor | null>(null)

  const rows = useMemo(
    () =>
      (data ?? []).filter((d) => {
        if (status !== 'all' && d.is_active !== (status === 'active')) return false
        if (
          manager === 'none' ? d.manager_id !== null : manager !== 'all' && d.manager_id !== manager
        )
          return false
        return `${d.name} ${d.speciality ?? ''} ${d.hospital_name ?? ''} ${d.area ?? ''} ${d.manager_name ?? ''}`
          .toLowerCase()
          .includes(q.trim().toLowerCase())
      }),
    [data, q, manager, status],
  )

  const columns: Column<Doctor>[] = [
    {
      key: 'name',
      header: 'Doctor',
      primary: true,
      cell: (d) => <Person lead={<Avatar name={d.name} />} name={d.name} sub={d.speciality} />,
    },
    { key: 'qual', header: 'Qualification', cell: (d) => d.qualification || '—' },
    {
      key: 'div',
      header: 'Division',
      cell: (d) => (d.division ? <Tag>{d.division}</Tag> : '—'),
    },
    { key: 'hospital', header: 'Hospital', cell: (d) => d.hospital_name || '—' },
    { key: 'area', header: 'Area', cell: (d) => d.area || '—' },
    {
      key: 'manager',
      header: 'Manager',
      cell: (d) => d.manager_name ?? <span className="text-warn">Unassigned</span>,
    },
    { key: 'status', header: 'Status', cell: (d) => <ActiveBadge active={d.is_active} /> },
  ]

  // Exports exactly what the current filters show.
  const exportCsv = () =>
    downloadCsv(
      `doctors-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Doctor',
        'Phone',
        'Email',
        'Division',
        'Qualification',
        'Speciality',
        'Hospital',
        'Pharmacy',
        'Area',
        'HQ',
        'Manager',
        'Status',
        'Notes',
      ],
      rows.map((d) => [
        d.name,
        d.phone,
        d.email,
        d.division,
        d.qualification,
        d.speciality,
        d.hospital_name,
        d.pharmacy_name,
        d.area,
        d.hq,
        d.manager_name,
        d.is_active ? 'Active' : 'Inactive',
        d.notes,
      ]),
    )

  return (
    <>
      <PageHeader
        title="Doctors"
        subtitle="Managed by doctor’s managers"
        action={
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={exportCsv} disabled={rows.length === 0}>
              <Download aria-hidden /> <span className="hidden sm:inline">Export CSV</span>
            </button>
            <AddButton to="/admin/doctors/new" label="Add Doctor" />
          </div>
        }
      />
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search doctors…" />
        <select
          aria-label="Filter by manager"
          className={`${inputCls} sm:!w-64`}
          value={manager}
          onChange={(e) => setManager(e.target.value)}
        >
          <option value="all">All managers</option>
          <option value="none">Unassigned</option>
          {managers.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
        <ChipFilter
          value={status}
          onChange={setStatus}
          options={[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'inactive', label: 'Inactive' },
          ]}
        />
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(d) => d.id}
        loading={isLoading}
        empty={
          <EmptyState
            icon={Inbox}
            title={q ? 'No results' : 'Nothing here yet'}
            hint={
              q
                ? `Nothing matches “${q}”. Try a different search.`
                : 'Doctors are added by their Doctor’s Manager, or by you.'
            }
          />
        }
        actions={(d) => (
          <>
            <IconLink to={`/admin/doctors/${d.id}`} label={`View ${d.name}`} icon={Eye} />
            <IconLink to={`/admin/doctors/${d.id}/edit`} label={`Edit ${d.name}`} icon={Pencil} />
            <IconButton label={`Reassign ${d.name}`} icon={Repeat} onClick={() => setTarget(d)} />
          </>
        )}
      />
      <Fab to="/admin/doctors/new" label="Add Doctor" />
      {target && (
        <ReassignDialog
          doctor={target}
          busy={reassign.isPending}
          onCancel={() => setTarget(null)}
          onConfirm={(manager_id) =>
            reassign.mutate(
              { id: target.id, manager_id },
              {
                onSuccess: () => {
                  toast(`${target.name} reassigned`)
                  setTarget(null)
                },
                onError: () => toast('Could not reassign the doctor', 'error'),
              },
            )
          }
        />
      )}
    </>
  )
}
