import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, Plus, UserX } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { DataTable, type Column } from '@/components/DataTable'
import { PageHeader } from '@/components/FormPage'
import { IconButton } from '@/components/ListParts'
import { Tabs } from '@/components/ListControls'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { currentMonthKey, revenueLocked } from '@/features/doctors/revenue'
import { useLocations, useManagerLocations } from '@/features/locations/api'
import { monthLabel, shiftMonth } from '@/lib/time'
import { financialYear } from '../sales'
import {
  VALUE_KEYS,
  useAddStockist,
  useSaveStockistEntry,
  useSetStockistActive,
  useStockistEntries,
  useStockists,
  type Stockist,
  type StockistValues,
} from '../stockists'

const LABELS: Record<keyof StockistValues, string> = {
  sales_value: 'Sales value',
  closing_value: 'Closing value',
  return_value: 'Return value',
}
type Draft = Partial<Record<keyof StockistValues, string>>
const lakhs = (n: number) => (n ? n.toFixed(2) : '—')
const short = (m: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
    new Date(`${m}-01T00:00:00Z`),
  )

/** Stockists of the locations a manager covers (admin: all), with their monthly sales, closing and return values (₹ lakhs). */
export function StockistsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const locations = useLocations()
  const mine = useManagerLocations()
  const places = useMemo(
    () =>
      (locations.data ?? []).filter((l) =>
        isAdmin ? l.is_active : (mine.data?.[profile?.id ?? ''] ?? []).includes(l.id),
      ),
    [locations.data, mine.data, isAdmin, profile?.id],
  )
  const [locationId, setLocationId] = useState('')
  const place = places.find((l) => l.id === locationId) ?? places[0]
  const [tab, setTab] = useState<'entry' | 'year'>('entry')

  return (
    <>
      <PageHeader
        title="Stockists"
        subtitle="Monthly sales, closing and return values by stockist (₹ lakhs)"
      />
      {mine.isSuccess && places.length === 0 ? (
        <p className="glass p-5">
          No location is assigned to you yet. Ask an admin to assign your locations.
        </p>
      ) : (
        <>
          <div className="toolbar">
            <div className="chips" role="group" aria-label="Location">
              {places.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="chip"
                  aria-pressed={l.id === place?.id}
                  onClick={() => setLocationId(l.id)}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
          <Tabs
            tabs={[
              { key: 'entry', label: 'Monthly entry' },
              { key: 'year', label: 'Year view' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <div className="mt-4">
            {place &&
              (tab === 'entry' ? (
                <Entry locationId={place.id} locationName={place.name} admin={isAdmin} />
              ) : (
                <YearView locationId={place.id} />
              ))}
          </div>
        </>
      )}
    </>
  )
}

function Entry({
  locationId,
  locationName,
  admin,
}: {
  locationId: string
  locationName: string
  admin: boolean
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [month, setMonth] = useState(currentMonthKey())
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [name, setName] = useState('')
  const stockists = useStockists()
  const entries = useStockistEntries(month, month)
  const add = useAddStockist()
  const off = useSetStockistActive()
  const save = useSaveStockistEntry()
  const rows = (stockists.data ?? []).filter((s) => s.location_id === locationId && s.is_active)
  const saved = new Map((entries.data ?? []).map((e) => [e.stockist_id, e]))

  const value = (id: string, k: keyof StockistValues) =>
    drafts[id]?.[k] ?? (saved.get(id) ? String(saved.get(id)![k]) : '')
  const bad = (id: string) =>
    VALUE_KEYS.some((k) => value(id, k) !== '' && !(Number(value(id, k)) >= 0))
  const locked = (id: string) => !admin && revenueLocked('manager', month, saved.has(id))
  const dirty = Object.keys(drafts).filter((id) => rows.some((r) => r.id === id))
  const sum = (k: keyof StockistValues) =>
    rows.reduce((n, r) => n + (Number(value(r.id, k)) || 0), 0)

  async function saveAll() {
    if (dirty.some(bad)) return toast('Enter numbers of 0 or more', 'error')
    let ok = 0
    for (const id of dirty) {
      try {
        await save.mutateAsync({
          stockistId: id,
          month,
          values: Object.fromEntries(
            VALUE_KEYS.map((k) => [k, Number(value(id, k)) || 0]),
          ) as unknown as StockistValues,
        })
        ok++
        setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== id)))
      } catch (e) {
        toast(`${rows.find((r) => r.id === id)?.name}: ${(e as Error).message}`, 'error')
        break
      }
    }
    if (ok) toast(ok === 1 ? 'Saved' : `${ok} stockists saved`)
  }

  const columns: Column<Stockist>[] = [
    {
      key: 'name',
      header: 'Stockist',
      primary: true,
      cell: (s) => (
        <span className="flex items-center gap-2 font-semibold">
          {s.name}
          {locked(s.id) && <Lock className="size-4 text-muted" aria-label="Locked" />}
        </span>
      ),
    },
    ...VALUE_KEYS.map((k) => ({
      key: k,
      header: `${LABELS[k]} (₹ L)`,
      cell: (s: Stockist) => (
        <input
          className="input mono !h-9 !w-28 text-right"
          inputMode="decimal"
          aria-label={`${LABELS[k]} — ${s.name}`}
          value={value(s.id, k)}
          disabled={locked(s.id)}
          aria-invalid={value(s.id, k) !== '' && !(Number(value(s.id, k)) >= 0)}
          onChange={(e) =>
            setDrafts((d) => ({ ...d, [s.id]: { ...d[s.id], [k]: e.target.value } }))
          }
        />
      ),
    })),
  ]

  return (
    <>
      <div className="toolbar">
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-sm"
            aria-label="Previous month"
            onClick={() => {
              setMonth(shiftMonth(month, -1))
              setDrafts({})
            }}
          >
            <ChevronLeft aria-hidden />
          </button>
          <b className="min-w-36 text-center">{monthLabel(month)}</b>
          <button
            className="btn btn-ghost btn-sm"
            aria-label="Next month"
            disabled={month >= currentMonthKey()}
            onClick={() => {
              setMonth(shiftMonth(month, 1))
              setDrafts({})
            }}
          >
            <ChevronRight aria-hidden />
          </button>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim() || !profile) return
            add.mutate(
              { name, locationId, userId: profile.id },
              {
                onSuccess: () => {
                  toast('Stockist added')
                  setName('')
                },
                onError: (err) => toast(err.message, 'error'),
              },
            )
          }}
        >
          <input
            className={`${inputCls} !w-56`}
            aria-label="New stockist name"
            placeholder={`New stockist in ${locationName}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-ghost" type="submit" disabled={!name.trim() || add.isPending}>
            <Plus aria-hidden /> Add stockist
          </button>
        </form>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(s) => s.id}
        loading={stockists.isLoading || entries.isLoading}
        pageSize={100}
        empty={
          <p className="p-6 text-center text-muted">
            No stockists in {locationName} yet. Add the first one above.
          </p>
        }
        actions={(s) => (
          <IconButton
            danger
            label={`Remove ${s.name} from the list`}
            icon={UserX}
            onClick={() =>
              off.mutate(
                { id: s.id, active: false },
                { onSuccess: () => toast('Removed from the list — past values are kept') },
              )
            }
          />
        )}
      />
      {rows.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          Total — sales <b className="mono text-ink">{sum('sales_value').toFixed(2)}</b>, closing{' '}
          <b className="mono text-ink">{sum('closing_value').toFixed(2)}</b>, return{' '}
          <b className="mono text-ink">{sum('return_value').toFixed(2)}</b> lakhs
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
  )
}

function YearView({ locationId }: { locationId: string }) {
  const [asOf, setAsOf] = useState(currentMonthKey())
  const [metric, setMetric] = useState<keyof StockistValues>('sales_value')
  const fy = financialYear(asOf)
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(fy.from, i))
  const stockists = useStockists()
  const entries = useStockistEntries(fy.from, fy.to)
  const rows = (stockists.data ?? []).filter((s) => s.location_id === locationId)
  const at = (id: string, m: string) =>
    (entries.data ?? []).find((e) => e.stockist_id === id && e.month.startsWith(m))?.[metric] ?? 0

  const columns: Column<Stockist>[] = [
    { key: 'name', header: 'Stockist', primary: true, cell: (s) => <b>{s.name}</b> },
    ...months.map((m) => ({
      key: m,
      header: short(m),
      cell: (s: Stockist) => <span className="mono">{lakhs(at(s.id, m))}</span>,
    })),
    {
      key: 'total',
      header: 'Total',
      cell: (s) => <b className="mono">{lakhs(months.reduce((n, m) => n + at(s.id, m), 0))}</b>,
    },
  ]
  return (
    <>
      <div className="toolbar">
        <div className="chips" role="group" aria-label="Value">
          {VALUE_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className="chip"
              aria-pressed={metric === k}
              onClick={() => setMetric(k)}
            >
              {LABELS[k]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-sm"
            aria-label="Previous year"
            onClick={() => setAsOf(shiftMonth(fy.from, -1))}
          >
            <ChevronLeft aria-hidden />
          </button>
          <b className="min-w-36 text-center">
            {short(fy.from)} – {short(fy.to)}
          </b>
          <button
            className="btn btn-ghost btn-sm"
            aria-label="Next year"
            disabled={fy.to >= currentMonthKey()}
            onClick={() => setAsOf(shiftMonth(fy.to, 1))}
          >
            <ChevronRight aria-hidden />
          </button>
        </div>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(s) => s.id}
        loading={stockists.isLoading}
        pageSize={100}
        empty={<p className="p-6 text-center text-muted">No stockists in this location yet.</p>}
      />
      <p className="mt-2 text-sm text-muted">Values in ₹ lakhs.</p>
    </>
  )
}
