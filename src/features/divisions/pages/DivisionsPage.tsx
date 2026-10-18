import { useState } from 'react'
import { Inbox, Pencil, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type Column } from '@/components/DataTable'
import { AddButton, Fab, IconButton, IconLink, Person } from '@/components/ListParts'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/FormPage'
import { ActiveBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { useDeleteDivision, useDivisions, useToggleDivision, type Division } from '../api'

export function DivisionsPage() {
  const { data, isLoading } = useDivisions()
  const toggle = useToggleDivision()
  const del = useDeleteDivision()
  const toast = useToast()
  const [target, setTarget] = useState<Division | null>(null)

  const columns: Column<Division>[] = [
    {
      key: 'name',
      header: 'Division',
      primary: true,
      cell: (d) => (
        <Person
          lead={
            <span
              className="av-icon text-[13px] font-bold"
              style={{
                background: 'hsl(220 70% 94%)',
                color: 'hsl(220 55% 38%)',
                borderRadius: 12,
              }}
            >
              {d.name}
            </span>
          }
          name={d.name}
          sub={d.description || 'No description'}
        />
      ),
    },
    { key: 'products', header: 'Products', cell: (d) => d.product_count },
    { key: 'active', header: 'Status', cell: (d) => <ActiveBadge active={d.is_active} /> },
  ]

  // A division that still has products is deactivated, never deleted.
  const hasProducts = (target?.product_count ?? 0) > 0

  function confirm() {
    if (!target) return
    const done = (msg: string) => {
      toast(msg)
      setTarget(null)
    }
    if (hasProducts)
      toggle.mutate(
        { id: target.id, is_active: false },
        { onSuccess: () => done('Division deactivated') },
      )
    else
      del.mutate(target.id, {
        onSuccess: () => done('Division deleted'),
        onError: () => toast('Could not delete the division', 'error'),
      })
  }

  return (
    <>
      <PageHeader
        title="Divisions"
        subtitle="Business divisions used across requests and products"
        action={<AddButton to="/admin/divisions/new" label="Add Division" />}
      />
      <DataTable
        rows={data ?? []}
        columns={columns}
        rowKey={(d) => d.id}
        loading={isLoading}
        empty={
          <EmptyState
            icon={Inbox}
            title="Nothing here yet"
            hint="Tap “Add Division” to create the first one."
          />
        }
        actions={(d) => (
          <>
            <IconLink to={`/admin/divisions/${d.id}/edit`} label={`Edit ${d.name}`} icon={Pencil} />
            <IconButton
              danger
              label={`${d.product_count > 0 ? 'Deactivate' : 'Delete'} ${d.name}`}
              icon={Trash2}
              onClick={() => setTarget(d)}
            />
          </>
        )}
      />
      <Fab to="/admin/divisions/new" label="Add Division" />
      <ConfirmDialog
        open={!!target}
        tone="danger"
        confirmLabel={hasProducts ? 'Deactivate' : 'Delete'}
        title={hasProducts ? 'Deactivate this division?' : 'Delete this division?'}
        busy={del.isPending || toggle.isPending}
        description={
          hasProducts ? (
            <>
              <b>{target?.name}</b> has {target?.product_count} mapped products, so it will be
              deactivated instead of deleted. Existing records keep their saved division.
            </>
          ) : (
            <>Existing records keep their saved division name.</>
          )
        }
        onCancel={() => setTarget(null)}
        onConfirm={confirm}
      />
    </>
  )
}
