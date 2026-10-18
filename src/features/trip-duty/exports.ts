import { downloadCsv, type Cell } from '@/lib/csvExport'
import { minutesText } from '@/lib/time'
import type { BetaSummaryRow } from './admin-api'
import type { DayEntry } from './logic'

export const ENTRY_HEADER = [
  'Date',
  'Driver',
  'Entry',
  'Duty Type',
  'Vehicle',
  'Guest',
  'Guest Area',
  'Pickup',
  'Drop',
  'Start Time',
  'Start KM',
  'End Time',
  'End KM',
  'Total KM',
  'Hours',
  'Fuel Litres',
  'Fuel Amount',
  'Status',
  'Leave Type',
  'Leave Status',
  'Source',
]
const ENTRY_LABEL = { duty: 'Duty', week_off: 'Week off', leave: 'Leave' } as const
const t = (v: string | null) => (v ? v.slice(0, 5) : '')

/** One row per entry (duty, week off, leave) with every field, for the admin driver-month export. */
export const entryRows = (entries: DayEntry[]): Cell[][] =>
  entries.map((e) => [
    e.entry_date,
    e.driver_name,
    ENTRY_LABEL[e.entry_type],
    e.duty_type,
    e.vehicle_label,
    e.guest_name,
    e.guest_area,
    e.pickup_point,
    e.drop_point,
    t(e.start_time),
    e.start_km,
    t(e.end_time),
    e.end_km,
    e.total_km,
    e.total_minutes !== null ? minutesText(e.total_minutes) : '',
    e.fuel_litres,
    e.fuel_amount,
    e.duty_status,
    e.leave_type,
    e.leave_status,
    e.entry_source,
  ])

export const exportEntriesCsv = (entries: DayEntry[], name: string) =>
  downloadCsv(`${name}.csv`, ENTRY_HEADER, entryRows(entries))

export const BETA_HEADER = [
  'Month',
  'Driver',
  'Local days',
  'Outstation days',
  'Total payable duties',
  'Local amount',
  'Outstation amount',
  'Total beta',
]

/** One row per driver, like the old "Monthly Chauffeur Beta Summary" sheet. */
export const betaRows = (month: string, rows: BetaSummaryRow[]): Cell[][] =>
  rows.map((r) => [
    month,
    r.driver_name,
    r.local_days,
    r.outstation_days,
    r.payable_days,
    r.local_amount,
    r.outstation_amount,
    r.total_amount,
  ])

export const exportBetaCsv = (month: string, rows: BetaSummaryRow[]) =>
  downloadCsv(`chauffeur-beta-${month}.csv`, BETA_HEADER, betaRows(month, rows))
