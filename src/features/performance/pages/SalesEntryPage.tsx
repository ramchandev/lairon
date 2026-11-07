import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Lock, MapPin } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { DataTable, type Column } from '@/components/DataTable'
import { PageHeader } from '@/components/FormPage'
import { SearchSelect } from '@/components/SearchSelect'
import { Tag } from '@/components/ListParts'
import { useToast } from '@/components/Toast'
import { useLocations, useManagerLocations } from '@/features/locations/api'
import { useProducts } from '@/features/products/api'
import { revenueLocked, currentMonthKey } from '@/features/doctors/revenue'
import { monthLabel, shiftMonth } from '@/lib/time'
import {
  FIGURE_KEYS,
  totalsOf,
  useSalesEntries,
  useSaveSalesEntry,
  type Figures,
  type SalesEntry,
} from '../sales'
import { ManagerPicker, useManagerChoice } from '../components/ManagerPicker'

const LABELS: Record<keyof Figures, string> = {
  primary_target: 'Primary target',
  secondary_target: 'Secondary target',
  primary_ach: 'Primary achieved',
  secondary_ach: 'Secondary achieved',
  sales_return: 'Sales return',
}
type Draft = Partial<Record<keyof Figures, string>>

/** Manager: enter the month's targets and achievements per product, for a location they cover. */
export const SalesEntryPage = () => <SalesEntry />

/** Admin: the same screen, for a chosen manager (any month). */
export function AdminSalesEntryPage() {
  const { managerId, setManagerId, managers } = useManagerChoice()
  return (
    <>
      <ManagerPicker managers={managers} value={managerId} onChange={setManagerId} />
      {managerId ? (
        <SalesEntry managerId={managerId} />
      ) : (
        <p className="glass p-5 text-muted">Choose a manager to enter or correct their sales.</p>
      )}
    </>
  )
}

function SalesEntry({ managerId }: { managerId?: string }) {
  const { profile } = useAuth()
  const toast = useToast()
  const isAdmin = profile?.role === 'admin'
  const who = managerId ?? profile?.id ?? ''
  const [month, setMonth] = useState(currentMonthKey())
  const [locationId, setLocationId] = useState('')
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [added, setAdded] = useState<string[]>([])

  const locations = useLocations()
  const mine = useManagerLocations()
  const covered = useMemo(
    () => (locations.data ?? []).filter((l) => (mine.data?.[who] ?? []).includes(l.id)),
    [locations.data, mine.data, who],
  )
  const location = covered.find((l) => l.id === locationId) ?? covered[0]
  const products = useProducts()
  const entries = useSalesEntries({ managerId: who || undefined, from: month, to: month })
  const prev = useSalesEntries({
    managerId: who || undefined,
    from: shiftMonth(month, -1),
    to: shiftMonth(month, -1),
  })
  const save = useSaveSalesEntry()

  const saved = useMemo(
    () =>
      new Map(
        (entries.data ?? [])
          .filter((e) => e.location_id === location?.id)
          .map((e) => [e.product_id, e] as const),
      ),
    [entries.data, location?.id],
  )
  const byId = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p])), [products.data])
  const rowIds = [...new Set([...saved.keys(), ...added])].filter((id) => byId.has(id))
  rowIds.sort((a, b) => byId.get(a)!.name.localeCompare(byId.get(b)!.name))

  const value = (id: string, k: keyof Figures) =>
    drafts[id]?.[k] ?? String(saved.get(id)?.[k] ?? '')
  const figures = (id: string): Figures =>
    Object.fromEntries(FIGURE_KEYS.map((k) => [k, Number(value(id, k)) || 0])) as unknown as Figures
  const lockedRow = (id: string) => !isAdmin && revenueLocked('manager', month, saved.has(id))
  const dirty = Object.keys(drafts).filter((id) => rowIds.includes(id))
  const invalid = (id: string) =>
    FIGURE_KEYS.some((k) => value(id, k) !== '' && !(Number(value(id, k)) >= 0))

  const total = totalsOf(
    rowIds.reduce<Figures>(
      (a, id) => {
        const f = figures(id)
        for (const k of FIGURE_KEYS) a[k] += f[k]
        return a
      },
      { primary_target: 0, secondary_target: 0, primary_ach: 0, secondary_ach: 0, sales_return: 0 },
    ),
  )

  function edit(id: string, k: keyof Figures, v: string) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [k]: v } }))
  }
  function changeMonth(m: string) {
    setMonth(m)
    setDrafts({})
    setAdded([])
  }
  function copyLastMonth() {
    const fresh = (prev.data ?? []).filter(
      (e: SalesEntry) => e.location_id === location?.id && !rowIds.includes(e.product_id),
    )
    setAdded((a) => [...a, ...fresh.map((e) => e.product_id)])
    setDrafts((d) => ({
      ...d,
      ...Object.fromEntries(
        fresh.map((e) => [
          e.product_id,
          {
            primary_target: String(e.primary_target),
            secondary_target: String(e.secondary_target),
          } satisfies Draft,
        ]),
      ),
    }))
    toast(fresh.length ? `${fresh.length} products copied — targets only` : 'Nothing new to copy')
  }

  async function saveAll() {
    if (!location) return
    if (dirty.some(invalid)) return toast('Enter numbers of 0 or more', 'error')
    let ok = 0
    for (const id of dirty) {
      try {
        await save.mutateAsync({
          managerId,
          locationId: location.id,
          productId: id,
          month,
          figures: figures(id),
        })
        ok++
        setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== id)))
        setAdded((a) => a.filter((x) => x !== id))
      } catch (e) {
        toast(`${byId.get(id)?.name}: ${(e as Error).message}`, 'error')
        break
      }
    }
    if (ok) toast(ok === 1 ? 'Saved' : `${ok} products saved`)
  }

  const input = (id: string, k: keyof Figures) => (
    <input
      className="input mono !h-9 !w-24 text-right"
      inputMode="decimal"
      aria-label={`${LABELS[k]} — ${byId.get(id)?.name}`}
      value={value(id, k)}
      disabled={lockedRow(id)}
      onChange={(e) => edit(id, k, e.target.value)}
      aria-invalid={value(id, k) !== '' && !(Number(value(id, k)) >= 0)}
    />
  )
  const columns: Column<string>[] = [
    {
      key: 'product',
      header: 'Product',
      primary: true,
      cell: (id) => (
        <span className="flex items-center gap-2 font-semibold">
          {byId.get(id)?.name}
          {byId.get(id)?.tag && <Tag>{byId.get(id)!.tag === 'core' ? 'Core' : 'New'}</Tag>}
          {lockedRow(id) && <Lock className="size-4 text-muted" aria-label="Locked" />}
        </span>
      ),
    },
    ...FIGURE_KEYS.map((k) => ({
      key: k,
      header: LABELS[k],
      cell: (id: string) => input(id, k),
    })),
    {
      key: 'ach',
      header: 'Ach %',
      cell: (id) => <span className="mono">{totalsOf(figures(id)).achPct.toFixed(0)}%</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Sales Entry"
        subtitle="Targets and achievements by product — update them as the month goes"
      />
      {mine.isSuccess && covered.length === 0 ? (
        <p className="glass p-5">
          No location is assigned{isAdmin ? ' to this manager' : ' to you'} yet.{' '}
          {isAdmin
            ? 'Assign one under People → Managers → Edit.'
            : 'Ask an admin to assign your locations.'}
        </p>
      ) : (
        <>
          <p className="mb-3 flex items-center gap-2 text-sm text-muted">
            <MapPin className="size-4" aria-hidden />
            {isAdmin ? 'Covers' : 'You cover'}:{' '}
            <b className="text-ink">{covered.map((l) => l.code).join(' · ')}</b>
          </p>
          <div className="toolbar">
            <div className="chips" role="group" aria-label="Location">
              {covered.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="chip"
                  aria-pressed={l.id === location?.id}
                  onClick={() => {
                    setLocationId(l.id)
                    setDrafts({})
                    setAdded([])
                  }}
                >
                  {l.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost btn-sm"
                aria-label="Previous month"
                onClick={() => changeMonth(shiftMonth(month, -1))}
              >
                <ChevronLeft aria-hidden />
              </button>
              <b className="min-w-36 text-center">{monthLabel(month)}</b>
              <button
                className="btn btn-ghost btn-sm"
                aria-label="Next month"
                disabled={month >= currentMonthKey()}
                onClick={() => changeMonth(shiftMonth(month, 1))}
              >
                <ChevronRight aria-hidden />
              </button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="w-64">
              <SearchSelect
                value=""
                title="Add a product"
                placeholder="+ Add a product"
                options={(products.data ?? [])
                  .filter((p) => p.is_active && !rowIds.includes(p.id))
                  .map((p) => ({
                    value: p.id,
                    label: p.name,
                    hint: p.tag ? (p.tag === 'core' ? 'Core (KDP)' : 'New') : undefined,
                  }))}
                onChange={(v) => setAdded((a) => [...a, v])}
              />
            </div>
            <button className="btn btn-ghost" onClick={copyLastMonth}>
              <Copy aria-hidden /> Copy products from last month
            </button>
          </div>

          <DataTable
            rows={rowIds}
            columns={columns}
            rowKey={(id) => id}
            loading={entries.isLoading || products.isLoading}
            empty={
              <p className="p-6 text-center text-muted">
                No products yet for {location?.name} in {monthLabel(month)}. Add a product above.
              </p>
            }
          />
          {rowIds.length > 0 && (
            <p className="mt-3 text-sm text-muted">
              Total — primary target <b className="mono text-ink">{total.primary_target}</b>,
              primary achieved <b className="mono text-ink">{total.primary_ach}</b> (
              {total.achPct.toFixed(0)}%), secondary achieved{' '}
              <b className="mono text-ink">{total.secondary_ach}</b>, gap{' '}
              <b className="mono text-ink">{total.gap}</b>
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <button
              className="btn btn-primary"
              disabled={!dirty.length || save.isPending}
              onClick={() => void saveAll()}
            >
              {save.isPending ? 'Saving…' : dirty.length ? `Save ${dirty.length} changed` : 'Saved'}
            </button>
          </div>
        </>
      )}
    </>
  )
}
