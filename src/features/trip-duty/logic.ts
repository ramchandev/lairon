import { addDays } from '@/lib/time'
import { minutesText, timeToMinutes } from '@/lib/time'
import { vehicleLabel } from '@/lib/format'

export type EntryType = 'duty' | 'week_off' | 'leave'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface DayEntry {
  id: string
  driver_id: string | null
  entry_date: string
  entry_type: EntryType
  duty_type: string | null
  vehicle_source: 'fleet' | 'own' | 'other' | null
  vehicle_id: string | null
  vehicle_label: string | null
  guest_name: string | null
  guest_area: string | null
  pickup_point: string | null
  drop_point: string | null
  start_km: number | null
  start_time: string | null
  end_km: number | null
  end_time: string | null
  total_km: number | null
  total_minutes: number | null
  fuel_litres: number | null
  fuel_amount: number | null
  duty_status: 'open' | 'closed' | null
  leave_type: string | null
  leave_reason: string | null
  leave_status: LeaveStatus | null
  entry_source: 'app' | 'import'
  created_at: string
  driver_name: string | null
  decision_note: string | null
}

// ───────────── live trip totals ─────────────
export interface Trip {
  km: number | null
  minutes: number | null
  nextDay: boolean
}

/** Same arithmetic as the database trigger: km = end − start; minutes wrap past midnight. */
export function tripSummary(i: {
  startKm?: string
  endKm?: string
  startTime?: string
  endTime?: string
}): Trip {
  const s = i.startKm?.trim() ? Number(i.startKm) : NaN
  const e = i.endKm?.trim() ? Number(i.endKm) : NaN
  const km = Number.isInteger(s) && Number.isInteger(e) && e >= s ? e - s : null
  const a = timeToMinutes(i.startTime ?? '')
  const b = timeToMinutes(i.endTime ?? '')
  if (Number.isNaN(a) || Number.isNaN(b)) return { km, minutes: null, nextDay: false }
  const nextDay = b < a
  return { km, minutes: nextDay ? b + 1440 - a : b - a, nextDay }
}

/** "52 km · 9h 15m · Ends next day" */
export const tripText = (t: Trip) =>
  [
    t.km !== null ? `${t.km} km` : '',
    t.minutes !== null ? minutesText(t.minutes) : '',
    t.nextDay ? 'Ends next day' : '',
  ]
    .filter(Boolean)
    .join(' · ')

// ───────────── month stats ─────────────
export interface MonthStats {
  dutyDays: number
  duties: number
  weekOffs: number
  leaveDays: number
  km: number
  fuelLitres: number
  fuelAmount: number
}

export function monthSummary(entries: DayEntry[]): MonthStats {
  const duty = entries.filter((e) => e.entry_type === 'duty')
  return {
    dutyDays: new Set(duty.map((e) => e.entry_date)).size,
    duties: duty.length,
    weekOffs: entries.filter((e) => e.entry_type === 'week_off').length,
    leaveDays: entries.filter((e) => e.entry_type === 'leave' && e.leave_status !== 'rejected')
      .length,
    km: duty.reduce((n, e) => n + (e.total_km ?? 0), 0),
    fuelLitres: duty.reduce((n, e) => n + Number(e.fuel_litres ?? 0), 0),
    fuelAmount: duty.reduce((n, e) => n + Number(e.fuel_amount ?? 0), 0),
  }
}

// ───────────── calendar ─────────────
export interface CalDay {
  date: string
  day: number
  inMonth: boolean
  duties: number
  outstation: boolean
  weekOff: boolean
  leave: LeaveStatus | null
}

/** Monday-first weeks covering the month. Outstation wins for the day, like the beta rule. */
export function buildCalendar(month: string, entries: DayEntry[]): CalDay[][] {
  const first = `${month}-01`
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
  const daysIn = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate()
  const total = Math.ceil((lead + daysIn) / 7) * 7
  const days: CalDay[] = []
  for (let i = 0; i < total; i++) {
    const date = addDays(first, i - lead)
    const todays = entries.filter((e) => e.entry_date === date)
    const duty = todays.filter((e) => e.entry_type === 'duty')
    days.push({
      date,
      day: Number(date.slice(8)),
      inMonth: date.startsWith(month),
      duties: duty.length,
      outstation: duty.some((e) => e.duty_type === 'Out Station'),
      weekOff: todays.some((e) => e.entry_type === 'week_off'),
      leave: todays.find((e) => e.entry_type === 'leave')?.leave_status ?? null,
    })
  }
  return Array.from({ length: total / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7))
}

// ───────────── leave requests ─────────────
export interface LeaveGroup {
  from: string
  to: string
  days: number
  type: string
  reason: string
  status: LeaveStatus
  ids: string[]
  note: string | null
  driverId: string | null
  driverName: string | null
}

/** Collapses per-day leave rows into requests: same driver, consecutive dates, same type, reason and status. */
export function groupLeaves(entries: DayEntry[]): LeaveGroup[] {
  const rows = entries
    .filter((e) => e.entry_type === 'leave')
    .sort(
      (a, b) =>
        (a.driver_id ?? '').localeCompare(b.driver_id ?? '') ||
        a.entry_date.localeCompare(b.entry_date),
    )
  const out: LeaveGroup[] = []
  for (const e of rows) {
    const key = [e.leave_type ?? '', e.leave_reason ?? '', e.leave_status ?? 'pending']
    const last = out[out.length - 1]
    if (
      last &&
      last.driverId === e.driver_id &&
      [last.type, last.reason, last.status].join('|') === key.join('|') &&
      addDays(last.to, 1) === e.entry_date
    ) {
      last.to = e.entry_date
      last.days++
      last.ids.push(e.id)
    } else
      out.push({
        from: e.entry_date,
        to: e.entry_date,
        days: 1,
        type: key[0],
        reason: key[1],
        status: key[2] as LeaveStatus,
        ids: [e.id],
        note: e.decision_note,
        driverId: e.driver_id,
        driverName: e.driver_name,
      })
  }
  return out
}

/** Every date from..to inclusive. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d)
  return out
}

// ───────────── vehicle choice ─────────────
export const OWN_LABEL = 'Own (guest vehicle)'
export const vehicleChoice = (e: Pick<DayEntry, 'vehicle_source' | 'vehicle_id'>) =>
  e.vehicle_source === 'fleet' && e.vehicle_id
    ? `fleet:${e.vehicle_id}`
    : e.vehicle_source === 'own'
      ? 'own'
      : e.vehicle_source === 'other'
        ? 'other'
        : ''

/** Resolve the dropdown choice into the saved snapshot columns (plain text label, nullable id). */
export function resolveVehicle(
  choice: string,
  otherDetails: string,
  vehicles: { id: string; name: string; vehicle_number: string }[],
) {
  if (choice === 'own')
    return { vehicle_source: 'own' as const, vehicle_id: null, vehicle_label: OWN_LABEL }
  if (choice === 'other')
    return {
      vehicle_source: 'other' as const,
      vehicle_id: null,
      vehicle_label: `Others · ${otherDetails.trim()}`,
    }
  const v = vehicles.find((x) => `fleet:${x.id}` === choice)
  return {
    vehicle_source: v ? ('fleet' as const) : null,
    vehicle_id: v?.id ?? null,
    vehicle_label: v ? vehicleLabel(v.name, v.vehicle_number) : null,
  }
}
