import { useMemo, useState } from 'react'
import { Info, Network, Plus, Trash2 } from 'lucide-react'
import { DataTable } from '@/components/DataTable'
import { IconButton } from '@/components/ListParts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ChipFilter } from '@/components/ListControls'
import { SearchSelect } from '@/components/SearchSelect'
import { useToast } from '@/components/Toast'
import { useDivisions } from '@/features/divisions/api'
import {
  useAddPair,
  useAllLookupItems,
  useCopyMapping,
  useMapPairs,
  useRemovePair,
  type MapPair,
} from '../api'

/** Professional Details mapping: which qualification ↔ speciality pairs each division offers (PLAN §6.5). */
export function MappingPanel() {
  const toast = useToast()
  const divisions = useDivisions()
  const items = useAllLookupItems()
  const [divId, setDivId] = useState<string | null>(null)
  const current = divId ?? divisions.data?.[0]?.id ?? null
  const pairs = useMapPairs(current)
  const add = useAddPair()
  const remove = useRemovePair()
  const copy = useCopyMapping()
  const [qual, setQual] = useState('')
  const [spec, setSpec] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const [toRemove, setToRemove] = useState<MapPair | null>(null)

  const name = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i.value])), [items.data])
  const opts = (key: string) =>
    (items.data ?? [])
      .filter((i) => i.list_key === key && i.is_active)
      .map((i) => ({ value: i.id, label: i.value }))
  const rows = [...(pairs.data ?? [])].sort(
    (a, b) =>
      (name.get(a.qualification_item_id) ?? '').localeCompare(
        name.get(b.qualification_item_id) ?? '',
      ) ||
      (name.get(a.speciality_item_id) ?? '').localeCompare(name.get(b.speciality_item_id) ?? ''),
  )
  const others = (divisions.data ?? []).filter((d) => d.id !== current)

  return (
    <section>
      <div className="banner">
        <Info aria-hidden size={18} />
        <div>
          <b>Changes apply to new entries only.</b> Records already saved keep the value they were
          saved with.
        </div>
      </div>
      <p className="muted mb-2.5 px-0.5">
        Pick a division to manage which qualification and speciality pairs appear in its
        Professional Details. “All Division” and divisions with no pairs show every qualification.
      </p>
      <div className="mb-3.5">
        <ChipFilter
          value={current ?? ''}
          onChange={setDivId}
          options={(divisions.data ?? []).map((d) => ({ key: d.id, label: d.name }))}
        />
      </div>

      {current && (
        <div className="map-add glass">
          <label className="field m-0">
            <span className="lbl">Qualification</span>
            <SearchSelect
              title="Qualification"
              placeholder="Select qualification"
              value={qual}
              options={opts('qualification')}
              onChange={setQual}
            />
          </label>
          <label className="field m-0">
            <span className="lbl">Speciality</span>
            <SearchSelect
              title="Speciality"
              placeholder="Select speciality"
              value={spec}
              options={opts('speciality')}
              onChange={setSpec}
            />
          </label>
          <button
            className="btn btn-primary"
            disabled={!qual || !spec || add.isPending}
            onClick={() =>
              add.mutate(
                { division_id: current, qualification_item_id: qual, speciality_item_id: spec },
                {
                  onSuccess: () => {
                    setQual('')
                    setSpec('')
                    toast('Pair added')
                  },
                  onError: (e) => toast(e.message, 'error'),
                },
              )
            }
          >
            <Plus aria-hidden /> Add pair
          </button>
          {others.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3 md:col-span-3">
              <span className="muted text-sm">Copy mapping from</span>
              <select
                aria-label="Copy mapping from division"
                className="input !h-10 !w-auto"
                value={copyFrom}
                onChange={(e) => setCopyFrom(e.target.value)}
              >
                <option value="">Choose division</option>
                {others.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-ghost btn-sm"
                disabled={!copyFrom || copy.isPending}
                onClick={() =>
                  copy.mutate(
                    { from: copyFrom, to: current },
                    {
                      onSuccess: (n) => {
                        toast(n ? `Copied ${n} pairs` : 'Nothing to copy')
                        setCopyFrom('')
                      },
                      onError: (e) => toast(e.message, 'error'),
                    },
                  )
                }
              >
                Copy
              </button>
            </div>
          )}
        </div>
      )}

      <DataTable
        rows={rows}
        columns={[
          {
            key: 'q',
            header: 'Qualification',
            primary: true,
            cell: (p) => <b>{name.get(p.qualification_item_id)}</b>,
          },
          { key: 's', header: 'Speciality', cell: (p) => name.get(p.speciality_item_id) },
        ]}
        rowKey={(p) => p.id}
        pageSize={100}
        empty={
          <EmptyState
            icon={Network}
            title="No pairs yet"
            hint="Without pairs, this division shows the full qualification and speciality lists."
          />
        }
        actions={(p) => (
          <IconButton danger label="Remove pair" icon={Trash2} onClick={() => setToRemove(p)} />
        )}
      />

      <ConfirmDialog
        open={!!toRemove}
        title="Remove this pair?"
        confirmLabel="Remove"
        busy={remove.isPending}
        description={
          toRemove && (
            <>
              {name.get(toRemove.qualification_item_id)} · {name.get(toRemove.speciality_item_id)}
            </>
          )
        }
        onCancel={() => setToRemove(null)}
        onConfirm={() =>
          toRemove &&
          remove.mutate(toRemove.id, {
            onSuccess: () => {
              toast('Pair removed')
              setToRemove(null)
            },
            onError: () => toast('Could not remove the pair', 'error'),
          })
        }
      />
    </section>
  )
}
