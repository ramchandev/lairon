import { Inbox, Pencil } from 'lucide-react'
import { DataTable, type Column } from '@/components/DataTable'
import { AddButton, Fab, IconLink, Person } from '@/components/ListParts'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/FormPage'
import { ActiveBadge } from '@/components/StatusBadge'
import { useLocations, type Location } from '../api'

export function LocationsPage() {
  const { data, isLoading } = useLocations()
  const columns: Column<Location>[] = [
    {
      key: 'name',
      header: 'Location',
      primary: true,
      cell: (l) => (
        <Person
          lead={
            <span className="av-icon text-[13px] font-bold" style={{ borderRadius: 12 }}>
              {l.code}
            </span>
          }
          name={l.name}
          sub={l.code}
        />
      ),
    },
    { key: 'active', header: 'Status', cell: (l) => <ActiveBadge active={l.is_active} /> },
  ]
  return (
    <>
      <PageHeader
        title="Locations"
        subtitle="Places a manager covers, assigned on the manager’s profile"
        action={<AddButton to="/admin/locations/new" label="Add Location" />}
      />
      <DataTable
        rows={data ?? []}
        columns={columns}
        rowKey={(l) => l.id}
        rowTo={(l) => `/admin/locations/${l.id}/edit`}
        loading={isLoading}
        empty={
          <EmptyState
            icon={Inbox}
            title="Nothing here yet"
            hint="Tap “Add Location” to create the first one."
          />
        }
        actions={(l) => (
          <IconLink to={`/admin/locations/${l.id}/edit`} label={`Edit ${l.name}`} icon={Pencil} />
        )}
      />
      <Fab to="/admin/locations/new" label="Add Location" />
    </>
  )
}
