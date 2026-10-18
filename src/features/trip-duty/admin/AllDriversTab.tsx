import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Calendar, Users } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Person } from '@/components/ListParts'
import { DataTable, type Column } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { MonthNav } from '@/components/MonthNav'
import { inr } from '@/lib/format'
import { istParts, monthOf } from '@/lib/time'
import { useUsers } from '@/features/users/api'
import { useAdminEntries } from '../admin-api'
import { monthSummary, type DayEntry, type MonthStats } from '../logic'

interface Row extends MonthStats {
  id: string
  name: string
  phone: string
  active: boolean
}

/** One row per driver for the month: duty days / week offs / leaves / KM / fuel. */
export function AllDriversTab({
  month,
  onMonth,
  onOpen,
}: {
  month: string
  onMonth: (m: string) => void
  onOpen: (driverId: string) => void
}) {
  const drivers = useUsers('driver')
  const entries = useAdminEntries(month)
  const rows = useMemo<Row[]>(() => {
    const by = new Map<string, DayEntry[]>()
    for (const e of entries.data ?? [])
      if (e.driver_id) by.set(e.driver_id, [...(by.get(e.driver_id) ?? []), e])
    return (drivers.data ?? [])
      .filter((d) => d.is_active || by.has(d.id))
      .map((d) => ({
        id: d.id,
        name: d.full_name,
        phone: d.phone,
        active: d.is_active,
        ...monthSummary(by.get(d.id) ?? []),
      }))
  }, [drivers.data, entries.data])
  const mono = (n: ReactNode) => <span className="mono">{n}</span>
  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Driver',
      primary: true,
      cell: (r) => <Person lead={<Avatar name={r.name} />} name={r.name} sub={r.phone} />,
    },
    { key: 'duty', header: 'Duty days', cell: (r) => mono(r.dutyDays) },
    { key: 'off', header: 'Week offs', cell: (r) => mono(r.weekOffs) },
    { key: 'leave', header: 'Leaves', cell: (r) => mono(r.leaveDays) },
    {
      key: 'km',
      header: 'Total KM',
      cell: (r) => <b className="mono">{r.km.toLocaleString('en-IN')}</b>,
    },
    { key: 'amt', header: 'Fuel spend', cell: (r) => mono(inr(r.fuelAmount)) },
  ]
  return (
    <div>
      <MonthNav month={month} onChange={onMonth} max={monthOf(istParts().date)} />
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        loading={drivers.isLoading || entries.isLoading}
        pageSize={50}
        empty={<EmptyState icon={Users} title="No drivers yet" hint="Add drivers under Users." />}
        actions={(r) => (
          <button className="btn btn-ghost btn-sm" onClick={() => onOpen(r.id)}>
            <Calendar aria-hidden /> View month
          </button>
        )}
      />
    </div>
  )
}
