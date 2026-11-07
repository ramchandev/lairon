import { useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { DataTable, rowBtn, type Column } from '@/components/DataTable'
import { Section } from '@/components/FormPage'
import { SearchInput } from '@/components/ListControls'
import { Switch } from '@/components/Switch'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useLocations } from '@/features/locations/api'
import { Pick } from '@/features/sale-report/Pick'
import {
  useSaveStockistDetails,
  useStockistDetails,
  type StockistDetails,
  type StockistForm,
} from '../stockists'

const EMPTY: StockistForm = {
  name: '',
  location_id: '',
  is_active: true,
  contact_person: null,
  phone: null,
  email: null,
  address: null,
  gstin: null,
  drug_licence: null,
  notes: null,
}
const TEXT: { key: keyof StockistForm; label: string; wide?: boolean }[] = [
  { key: 'contact_person', label: 'Contact person' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'drug_licence', label: 'Drug licence no.' },
  { key: 'address', label: 'Address', wide: true },
  { key: 'notes', label: 'Notes', wide: true },
]

/** Admin: the stockist master — name, location, contact and licence details, kept and edited here. */
export function StockistDetailsTab() {
  const rowsQ = useStockistDetails()
  const locations = useLocations().data
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState('')
  const [editing, setEditing] = useState<StockistDetails | 'new' | null>(null)
  const place = (id: string) => locations?.find((l) => l.id === id)?.name ?? '—'
  const rows = useMemo(
    () =>
      (rowsQ.data ?? [])
        .filter((s) => !loc || s.location_id === loc)
        .filter((s) =>
          `${s.name} ${s.contact_person ?? ''} ${s.phone ?? ''}`
            .toLowerCase()
            .includes(q.trim().toLowerCase()),
        ),
    [rowsQ.data, q, loc],
  )
  const columns: Column<StockistDetails>[] = [
    { key: 'n', header: 'Stockist', primary: true, cell: (s) => <b>{s.name}</b> },
    { key: 'l', header: 'Location', cell: (s) => place(s.location_id) },
    { key: 'c', header: 'Contact', cell: (s) => s.contact_person ?? '—' },
    { key: 'p', header: 'Phone', cell: (s) => s.phone ?? '—' },
    {
      key: 'g',
      header: 'GSTIN',
      cell: (s) => <span className="mono text-[13px]">{s.gstin ?? '—'}</span>,
    },
    {
      key: 'a',
      header: 'Status',
      cell: (s) =>
        s.is_active ? (
          <span className="text-ok">Active</span>
        ) : (
          <span className="text-muted">Inactive</span>
        ),
    },
  ]
  return (
    <div className="space-y-4">
      <div className="toolbar !flex-wrap">
        <SearchInput value={q} onChange={setQ} placeholder="Search stockists" />
        <div className="min-w-44">
          <Pick
            ariaLabel="Filter by location"
            value={loc}
            onChange={setLoc}
            all="All locations"
            options={(locations ?? []).map((l) => ({ value: l.id, label: l.name }))}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          <Plus aria-hidden /> Add stockist
        </button>
      </div>
      {editing && (
        <StockistEditor
          key={editing === 'new' ? 'new' : editing.id}
          stockist={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(s) => s.id}
        loading={rowsQ.isLoading}
        pageSize={50}
        empty={<p className="p-6 text-center text-muted">No stockists found.</p>}
        actions={(s) => (
          <button className={rowBtn} aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}>
            <Pencil aria-hidden />
          </button>
        )}
      />
    </div>
  )
}

function StockistEditor({
  stockist,
  onClose,
}: {
  stockist: StockistDetails | null
  onClose: () => void
}) {
  const toast = useToast()
  const locations = useLocations().data
  const save = useSaveStockistDetails(stockist?.id)
  const [f, setF] = useState<StockistForm>(stockist ?? EMPTY)
  const set = (k: keyof StockistForm, v: string | boolean | null) => setF({ ...f, [k]: v })
  return (
    <Section title={stockist ? `Edit ${stockist.name}` : 'New stockist'} stack>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Name
          <input
            className={inputCls}
            value={f.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>
        <div className="text-sm font-semibold">
          Location
          <Pick
            ariaLabel="Location"
            value={f.location_id}
            onChange={(v) => set('location_id', v)}
            placeholder="Choose…"
            options={(locations ?? []).map((l) => ({ value: l.id, label: l.name }))}
          />
        </div>
        {TEXT.map((t) => (
          <label
            key={t.key}
            className={`block text-sm font-semibold ${t.wide ? 'sm:col-span-2' : ''}`}
          >
            {t.label}
            <input
              className={inputCls}
              value={(f[t.key] as string | null) ?? ''}
              onChange={(e) => set(t.key, e.target.value)}
            />
          </label>
        ))}
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Switch checked={f.is_active} onChange={(v) => set('is_active', v)} label="Active" />
          Active
        </div>
      </div>
      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          disabled={!f.name.trim() || !f.location_id || save.isPending}
          onClick={() =>
            save.mutate(f, {
              onSuccess: () => {
                toast('Stockist saved')
                onClose()
              },
              onError: (e) => toast(e.message, 'error'),
            })
          }
        >
          Save
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Section>
  )
}
