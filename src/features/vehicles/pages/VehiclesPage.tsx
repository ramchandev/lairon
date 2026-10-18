import { useMemo, useState } from 'react'
import { CarFront, Inbox, Pencil, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type Column } from '@/components/DataTable'
import { AddButton, Fab, IconButton, IconLink, IconTile, Person, Tag } from '@/components/ListParts'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/FormPage'
import { ChipFilter, SearchInput } from '@/components/ListControls'
import { ActiveBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { formatVehicleNumber, vehicleLabel } from '@/lib/format'
import { useDeleteVehicle, useVehicles, type Vehicle } from '../api'

export function VehiclesPage() {
  const { data, isLoading } = useVehicles()
  const del = useDeleteVehicle()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [toDelete, setToDelete] = useState<Vehicle | null>(null)

  const rows = useMemo(
    () =>
      (data ?? []).filter((v) => {
        if (status !== 'all' && v.is_active !== (status === 'active')) return false
        const hay = `${v.name} ${v.vehicle_number} ${v.make ?? ''} ${v.model ?? ''}`.toLowerCase()
        return hay.includes(q.trim().toLowerCase())
      }),
    [data, q, status],
  )

  const columns: Column<Vehicle>[] = [
    {
      key: 'name',
      header: 'Vehicle',
      primary: true,
      cell: (v) => {
        const label = vehicleLabel(v.name, v.vehicle_number)
        return (
          <Person
            lead={<IconTile icon={CarFront} />}
            name={label}
            sub={`Shown to drivers as “${label}”`}
          />
        )
      },
    },
    {
      key: 'number',
      header: 'Number',
      cell: (v) => <Tag mono>{formatVehicleNumber(v.vehicle_number)}</Tag>,
    },
    {
      key: 'make',
      header: 'Make / Model',
      cell: (v) => [v.make, v.model].filter(Boolean).join(' · ') || '—',
    },
    { key: 'year', header: 'Year', cell: (v) => v.year ?? '—' },
    { key: 'color', header: 'Color', cell: (v) => v.color || '—' },
    { key: 'active', header: 'Status', cell: (v) => <ActiveBadge active={v.is_active} /> },
  ]

  return (
    <>
      <PageHeader
        title="Vehicles"
        subtitle="Fleet used for trip duties. Drivers also get an “Others” option for hired vehicles."
        action={<AddButton to="/admin/vehicles/new" label="Add Vehicle" />}
      />
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search vehicles…" />
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
        rowKey={(v) => v.id}
        loading={isLoading}
        empty={
          <EmptyState
            icon={Inbox}
            title="Nothing here yet"
            hint="Tap “Add Vehicle” to create the first one."
          />
        }
        actions={(v) => (
          <>
            <IconLink to={`/admin/vehicles/${v.id}/edit`} label={`Edit ${v.name}`} icon={Pencil} />
            <IconButton
              danger
              label={`Delete ${v.name}`}
              icon={Trash2}
              onClick={() => setToDelete(v)}
            />
          </>
        )}
      />
      <Fab to="/admin/vehicles/new" label="Add Vehicle" />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete this vehicle?"
        confirmLabel="Delete"
        busy={del.isPending}
        description={
          <>
            Past duties keep their saved vehicle name.{' '}
            <b>{toDelete && vehicleLabel(toDelete.name, toDelete.vehicle_number)}</b> will no longer
            appear for drivers.
          </>
        }
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete &&
          del.mutate(toDelete.id, {
            onSuccess: () => {
              toast('Vehicle deleted')
              setToDelete(null)
            },
            onError: () => toast('Could not delete the vehicle', 'error'),
          })
        }
      />
    </>
  )
}
