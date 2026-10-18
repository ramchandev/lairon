import { addDays } from '@/lib/time'
import type { Issue, ParsedRow } from './parse'

export type ImportMode = 'replace' | 'fill'
export interface Rate {
  effective_from: string
  local_rate: number
  outstation_rate: number
}
export interface ExistingEntry {
  entry_date: string
  entry_type: string
  leave_status: string | null
}

export interface PlanInput {
  rows: ParsedRow[]
  month: string // yyyy-MM
  mode: ImportMode
  existing: ExistingEntry[]
  rates: Rate[]
  /** India "today" — gaps in the current month are only counted up to today. */
  today: string
}

export interface Plan {
  /** Rows that will be sent (everything except rows with errors). */
  rows: ParsedRow[]
  issues: Issue[]
  counts: {
    read: number
    duties: number
    weekOffs: number
    leaves: number
    errors: number
    gaps: number
  }
  gaps: string[]
  /** Fill mode only: rows on dates that already have an entry (the database skips them). */
  skipped: number
  /** Replace mode only: existing entries in the month that will be deleted. */
  replaced: number
  /** Number of rows that will actually be inserted. */
  willImport: number
  beta: {
    payableDays: number
    localDays: number
    outstationDays: number
    total: number
    dutyCount: number
  }
}

const rateFor = (rates: Rate[], date: string) =>
  [...rates]
    .filter((r) => r.effective_from <= date)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
const activeExisting = (e: ExistingEntry) =>
  !(e.entry_type === 'leave' && e.leave_status === 'rejected')

/**
 * Review plan for an import: row counts, the checks list (errors block, warnings/notes inform), gaps, and a beta preview
 * that follows the beta_summary() rules (closed duties only, one payable day per date, Outstation wins, rate by date).
 * The preview exists only so the admin sees the effect BEFORE importing; the stored numbers always come from Postgres.
 */
export function buildPlan({ rows, month, mode, existing, rates, today }: PlanInput): Plan {
  const issues: Issue[] = rows.flatMap((r) => r.issues)
  const valid = rows.filter((r) => r.date && !r.issues.some((i) => i.severity === 'error'))

  // Errors: a duty and a week off / leave on the same date can't both exist.
  const kindByDate = new Map<string, Set<string>>()
  for (const r of valid)
    kindByDate.set(
      r.date!,
      (kindByDate.get(r.date!) ?? new Set()).add(r.entryType === 'duty' ? 'duty' : 'off'),
    )
  const clash = new Set([...kindByDate].filter(([, k]) => k.size > 1).map(([d]) => d))
  const blocked = new Set<ParsedRow>()
  for (const r of valid) {
    if (clash.has(r.date!)) {
      blocked.add(r)
      issues.push({
        severity: 'error',
        line: r.line,
        message: `Duty and week off/leave on the same date (${r.date}) — fix the sheet`,
      })
    }
  }

  // Warnings: dates outside the chosen month.
  for (const r of valid)
    if (!r.date!.startsWith(month))
      issues.push({
        severity: 'warning',
        line: r.line,
        message: `Date ${r.date} is outside ${month}`,
      })

  // Notes: missing duty type, several duties on one date.
  const duties = valid.filter((r) => r.entryType === 'duty')
  const noType = duties.filter((r) => r.dutyType === null)
  if (noType.length) {
    issues.push({
      severity: 'note',
      message:
        noType.length === duties.length
          ? `No Duty Type given — all ${duties.length} duties counted as Local. Mark Outstation days after importing.`
          : `${noType.length} duties had no Duty Type and are counted as Local`,
    })
  }
  const perDate = new Map<string, number>()
  for (const r of duties) perDate.set(r.date!, (perDate.get(r.date!) ?? 0) + 1)
  for (const [d, n] of [...perDate].filter(([, n]) => n > 1))
    issues.push({
      severity: 'note',
      message: `${n} duties on ${d} — they count as one payable day`,
    })

  // Existing entries in the month.
  const inMonth = existing.filter((e) => e.entry_date.startsWith(month) && activeExisting(e))
  const takenDates = new Set(inMonth.map((e) => e.entry_date))
  const sendable = valid.filter((r) => !blocked.has(r))
  const skipped = mode === 'fill' ? sendable.filter((r) => takenDates.has(r.date!)).length : 0
  const toInsert = mode === 'fill' ? sendable.filter((r) => !takenDates.has(r.date!)) : sendable

  // Gaps: days of the month with no entry (in the file, or — in fill mode — already in the system).
  const covered = new Set([...sendable.map((r) => r.date!), ...(mode === 'fill' ? takenDates : [])])
  const monthEnd = addDays(`${month}-01`, 31).startsWith(month)
    ? addDays(`${month}-01`, 30)
    : addDays(`${month}-01`, 31 - Number(addDays(`${month}-01`, 31).slice(8)))
  const last = monthEnd < today || !today.startsWith(month) ? monthEnd : today
  const gaps: string[] = []
  for (let d = `${month}-01`; d <= last && gaps.length < 62; d = addDays(d, 1))
    if (!covered.has(d)) gaps.push(d)
  if (gaps.length)
    issues.push({
      severity: 'note',
      message: `${gaps.length} day${gaps.length === 1 ? '' : 's'} with no entry: ${gaps.map((d) => d.slice(8) + '/' + d.slice(5, 7)).join(', ')}`,
    })

  // Beta preview.
  const days = new Map<string, boolean>() // date -> is outstation
  for (const r of toInsert.filter((x) => x.entryType === 'duty'))
    days.set(r.date!, (days.get(r.date!) ?? false) || r.dutyType === 'Out Station')
  let total = 0,
    outstationDays = 0
  for (const [d, out] of days) {
    const rate = rateFor(rates, d)
    total += rate ? (out ? rate.outstation_rate : rate.local_rate) : 0
    if (out) outstationDays++
  }

  const errors = issues.filter((i) => i.severity === 'error').length
  return {
    rows: sendable,
    issues,
    gaps,
    skipped,
    replaced: mode === 'replace' ? inMonth.length : 0,
    willImport: toInsert.length,
    counts: {
      read: rows.length,
      duties: valid.filter((r) => r.entryType === 'duty').length,
      weekOffs: valid.filter((r) => r.entryType === 'week_off').length,
      leaves: valid.filter((r) => r.entryType === 'leave').length,
      errors,
      gaps: gaps.length,
    },
    beta: {
      payableDays: days.size,
      localDays: days.size - outstationDays,
      outstationDays,
      total,
      dutyCount: toInsert.filter((r) => r.entryType === 'duty').length,
    },
  }
}

/** The JSON the `import_duties` Postgres function takes. Postgres validates everything again. */
export function toPayload(
  plan: Plan,
  o: { fileName: string; driverId: string; month: string; mode: ImportMode },
) {
  return {
    file_name: o.fileName,
    driver_id: o.driverId,
    month: `${o.month}-01`,
    mode: o.mode,
    issues: plan.issues
      .filter((i) => i.severity !== 'note')
      .map((i) => ({ severity: i.severity, line: i.line ?? null, message: i.message })),
    rows: plan.rows.map((r) => ({
      entry_date: r.date,
      entry_type: r.entryType,
      duty_type: r.entryType === 'duty' ? (r.dutyType ?? 'Local') : null,
      vehicle: r.vehicle,
      guest_name: r.guest,
      guest_area: r.guestArea,
      pickup_point: r.pickup,
      drop_point: r.drop,
      start_km: r.startKm,
      end_km: r.endKm,
      start_time: r.startTime,
      end_time: r.endTime,
      end_date: r.endDate,
      total_km: r.totalKm,
      total_minutes: r.totalMinutes,
      fuel_litres: r.fuelLitres,
      fuel_amount: r.fuelAmount,
    })),
  }
}
