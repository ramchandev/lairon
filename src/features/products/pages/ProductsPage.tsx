import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Inbox, Pencil, Pill, Trash2, Upload } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type Column } from '@/components/DataTable'
import {
  AddButton,
  Fab,
  IconButton,
  IconLink,
  IconTile,
  Person,
  Tags,
} from '@/components/ListParts'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/FormPage'
import { ChipFilter, SearchInput } from '@/components/ListControls'
import { ActiveBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { useDivisions } from '@/features/divisions/api'
import { useDeleteProduct, useProducts, type Product } from '../api'

export function ProductsPage() {
  const { data, isLoading } = useProducts()
  const divisions = useDivisions()
  const del = useDeleteProduct()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [division, setDivision] = useState('all')
  const [target, setTarget] = useState<Product | null>(null)
  const divName = useMemo(
    () => new Map((divisions.data ?? []).map((d) => [d.id, d.name])),
    [divisions.data],
  )

  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (p) =>
          (division === 'all' || p.division_ids.includes(division)) &&
          `${p.name} ${p.description ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [data, q, division],
  )

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      primary: true,
      cell: (p) => (
        <Person
          lead={<IconTile icon={Pill} hue={250} />}
          name={p.name}
          sub={p.description || undefined}
        />
      ),
    },
    {
      key: 'divs',
      header: 'Divisions',
      cell: (p) => <Tags items={p.division_ids.map((id) => divName.get(id) ?? '?')} />,
    },
    { key: 'active', header: 'Status', cell: (p) => <ActiveBadge active={p.is_active} /> },
  ]

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Product catalogue by division"
        action={
          <div className="flex gap-2">
            <Link to="/admin/products/import" className="btn btn-ghost">
              <Upload aria-hidden /> Import CSV
            </Link>
            <AddButton to="/admin/products/new" label="Add Product" />
          </div>
        }
      />
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search products…" />
        <ChipFilter
          value={division}
          onChange={setDivision}
          options={[
            { key: 'all', label: 'All' },
            ...(divisions.data ?? []).map((d) => ({ key: d.id, label: d.name })),
          ]}
        />
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(p) => p.id}
        loading={isLoading}
        empty={
          <EmptyState
            icon={Inbox}
            title={q ? 'No results' : 'Nothing here yet'}
            hint={
              q
                ? `Nothing matches “${q}”. Try a different search.`
                : 'Tap “Add Product” to create the first one.'
            }
          />
        }
        actions={(p) => (
          <>
            <IconLink to={`/admin/products/${p.id}/edit`} label={`Edit ${p.name}`} icon={Pencil} />
            <IconButton
              danger
              label={`Delete ${p.name}`}
              icon={Trash2}
              onClick={() => setTarget(p)}
            />
          </>
        )}
      />
      <Fab to="/admin/products/new" label="Add Product" />
      <ConfirmDialog
        open={!!target}
        title="Delete this product?"
        confirmLabel="Delete"
        busy={del.isPending}
        description={
          <>
            Past starter-pack requests keep the saved product name. <b>{target?.name}</b> will
            disappear from new forms.
          </>
        }
        onCancel={() => setTarget(null)}
        onConfirm={() =>
          target &&
          del.mutate(target.id, {
            onSuccess: () => {
              toast('Product deleted')
              setTarget(null)
            },
            onError: () => toast('Could not delete the product', 'error'),
          })
        }
      />
    </>
  )
}
