export type Field =
  | 'date'
  | 'driver'
  | 'entryType'
  | 'dutyType'
  | 'vehicle'
  | 'guest'
  | 'guestArea'
  | 'pickup'
  | 'drop'
  | 'startKm'
  | 'endKm'
  | 'totalKm'
  | 'startTime'
  | 'endTime'
  | 'totalHours'
  | 'fuelLitres'
  | 'fuelAmount'
  | 'month'

/** Case/space/punctuation-insensitive header aliases (PLAN §6.12). */
const ALIASES: Record<Field, string[]> = {
  date: ['date', 'dutydate', 'entrydate'],
  driver: ['driver', 'drivername', 'chauffeur'],
  entryType: ['entrytype', 'status', 'entry'],
  dutyType: ['dutytype', 'localoutstation', 'triptype'],
  vehicle: ['vehicle', 'vehiclename', 'vehicleno', 'vehiclenumber', 'car'],
  guest: ['guest', 'guestname', 'doctor', 'doctorname'],
  guestArea: ['guestarea', 'area'],
  pickup: ['pickup', 'pickuppoint', 'from'],
  drop: ['drop', 'droppoint', 'to'],
  startKm: ['startingkm', 'startkm', 'openingkm'],
  endKm: ['endingkm', 'endkm', 'closingkm'],
  totalKm: ['totalkm', 'km', 'kms'],
  startTime: ['startingtime', 'starttime', 'openingtime'],
  endTime: ['closingtime', 'endtime', 'endingtime'],
  totalHours: ['totalhours', 'hours', 'duration'],
  fuelLitres: ['fuelinliters', 'fuelinlitres', 'fuelliters', 'fuellitres'],
  fuelAmount: ['fuelamount', 'fuelcost'],
  month: ['month'],
}
const norm = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
const FIELD_BY_ALIAS = new Map(
  Object.entries(ALIASES).flatMap(([f, as]) => as.map((a) => [a, f as Field] as const)),
)

export type Severity = 'error' | 'warning' | 'note'
export interface Issue {
  severity: Severity
  line?: number
  message: string
}
export type EntryKind = 'duty' | 'week_off' | 'leave'
export type VehicleKind = 'fleet' | 'own' | 'other'

export interface ParsedRow {
  line: number
  date: string | null
  rawDate: string
  entryType: EntryKind
  dutyType: 'Local' | 'Out Station' | null // null = not stated, defaulted to Local at import
  vehicle: string | null
  vehicleKind: VehicleKind | null
  guest: string | null
  guestArea: string | null
  pickup: string | null
  drop: string | null
  startKm: number | null
  endKm: number | null
  totalKm: number | null
  startTime: string | null
  endTime: string | null
  totalMinutes: number | null
  fuelLitres: number | null
  fuelAmount: number | null
  issues: Issue[]
}

// ───────────── cell readers ─────────────
const BLANK = new Set(['', '-', '–', '—', 'na', 'n/a'])
export function cell(v: unknown): string | number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim()
  return BLANK.has(s.toLowerCase()) ? null : s
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const monthIndex = (name: string) => MONTHS.indexOf(name.slice(0, 3).toLowerCase())
const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? dt.toISOString().slice(0, 10)
    : null
}

/** Excel serial -> yyyy-MM-dd, using UTC. (Reading dates as JS Dates shifted every day back by one in testing.) */
export const serialToDate = (n: number) =>
  new Date(Math.floor(n - 25569) * 86_400_000).toISOString().slice(0, 10)

export function parseDate(v: unknown): string | null {
  const c = cell(v)
  if (c === null) return null
  if (typeof c === 'number') return c > 20_000 && c < 80_000 ? serialToDate(c) : null
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(c)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(c) // day first, as used in India
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1])
  m = /^(\d{1,2})[\s\-/]([A-Za-z]{3,9})[\s\-/,]*(\d{2,4})$/.exec(c)
  if (m && monthIndex(m[2]) >= 0)
    return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], monthIndex(m[2]) + 1, +m[1])
  return null
}

const hhmm = (mins: number) =>
  `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

/** Clock time -> 'HH:MM'. Accepts Excel time fractions, 09:30, 9:30 AM, 21:05:00. */
export function parseTime(v: unknown): string | null {
  const c = cell(v)
  if (c === null) return null
  if (typeof c === 'number') return c >= 0 && c < 1 ? hhmm(Math.round(c * 1440) % 1440) : null
  const m = /^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm)?$/i.exec(c)
  if (!m) return null
  let h = +m[1]
  const min = +m[2]
  if (m[3]) {
    h = (h % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0)
  }
  return h < 24 && min < 60 ? hhmm(h * 60 + min) : null
}

/** Duration -> minutes. '9 hrs 30 mins', '9:30', an Excel time (0.39 of a day) or a plain number of hours. */
export function parseMinutes(v: unknown): number | null {
  const c = cell(v)
  if (c === null) return null
  if (typeof c === 'number') return c < 1 ? Math.round(c * 1440) : Math.round(c * 60)
  let m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(c)
  if (m) return +m[1] * 60 + +m[2]
  const h = /(\d+(?:\.\d+)?)\s*h/i.exec(c)
  const mi = /(\d+)\s*m/i.exec(c)
  if (h || mi) return Math.round((h ? +h[1] : 0) * 60 + (mi ? +mi[1] : 0))
  m = /^\d+(?:\.\d+)?$/.exec(c)
  return m ? Math.round(Number(c) * 60) : null
}

export function parseNumber(v: unknown): number | null {
  const c = cell(v)
  if (c === null) return null
  const n = typeof c === 'number' ? c : Number(c.replace(/[,\s₹]/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : null
}

const dutyTypeOf = (v: unknown): ParsedRow['dutyType'] => {
  const c = cell(v)
  if (typeof c !== 'string') return null
  return /out/i.test(c) ? 'Out Station' : /local/i.test(c) ? 'Local' : null
}

// ───────────── detection from file name / month cells ─────────────
export interface Detected {
  driverName: string | null
  month: string | null
}

/** "PRAKALATHAN.M — September_2026.xlsx" -> driver + month. Both stay editable in the UI. */
export function detectFromFileName(fileName: string): Detected {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '')
  const m = /^(.*?)[\s_]*[—–-][\s_]*([A-Za-z]{3,9})[\s_.-]*(\d{4})$/.exec(base)
  if (m && monthIndex(m[2]) >= 0)
    return {
      driverName: m[1].trim() || null,
      month: `${m[3]}-${String(monthIndex(m[2]) + 1).padStart(2, '0')}`,
    }
  const only = /([A-Za-z]{3,9})[\s_.-]+(\d{4})/.exec(base)
  return {
    driverName: null,
    month:
      only && monthIndex(only[1]) >= 0
        ? `${only[2]}-${String(monthIndex(only[1]) + 1).padStart(2, '0')}`
        : null,
  }
}

/** 'September_2026', 'Sep 2026', '2026-09', or a date -> 'yyyy-MM'. */
export function parseMonthCell(v: unknown): string | null {
  const c = cell(v)
  if (c === null) return null
  if (typeof c === 'number') return c > 20_000 ? serialToDate(c).slice(0, 7) : null
  const m = /^([A-Za-z]{3,9})[\s_.-]*(\d{4})$/.exec(c)
  if (m && monthIndex(m[1]) >= 0) return `${m[2]}-${String(monthIndex(m[1]) + 1).padStart(2, '0')}`
  const d = /^(\d{4})-(\d{2})$/.exec(c)
  return d ? c : null
}

export function matchDriver<T extends { full_name: string }>(
  name: string | null,
  drivers: T[],
): T | null {
  if (!name) return null
  const n = norm(name)
  return (
    drivers.find((d) => norm(d.full_name) === n) ??
    drivers.find((d) => norm(d.full_name).startsWith(n) || n.startsWith(norm(d.full_name))) ??
    null
  )
}

// ───────────── sheet -> rows ─────────────
export interface ParsedSheet {
  rows: ParsedRow[]
  unknownColumns: string[]
  detected: Detected
  fatal: string | null
}
interface Vehicle {
  id: string
  name: string
  vehicle_number: string
}

const fleetLabel = (v: Vehicle) => norm(`${v.name} ${v.vehicle_number.slice(-4)}`)
const WEEK_OFF = /\bweek\s*-?\s*off\b/i
const LEAVE = /\b(leave|absent)\b/i

/** `aoa` = first sheet as an array of rows (header in row 1, dates as Excel serials). */
export function parseSheet(aoa: unknown[][], vehicles: Vehicle[] = []): ParsedSheet {
  const empty = (fatal: string): ParsedSheet => ({
    rows: [],
    unknownColumns: [],
    detected: { driverName: null, month: null },
    fatal,
  })
  const headRow = aoa.findIndex((r) => r.some((c) => cell(c) !== null))
  if (headRow < 0) return empty('The file is empty.')

  const cols = new Map<Field, number>()
  const unknown: string[] = []
  aoa[headRow].forEach((h, i) => {
    const label = cell(h)
    if (label === null) return
    const f = FIELD_BY_ALIAS.get(norm(label))
    if (f && !cols.has(f)) cols.set(f, i)
    else unknown.push(String(label))
  })
  if (!cols.has('date'))
    return empty('No Date column found. Download the template to see the expected columns.')

  const get = (r: unknown[], f: Field) => (cols.has(f) ? r[cols.get(f)!] : null)
  const fleet = new Map(vehicles.map((v) => [fleetLabel(v), v]))
  const rows: ParsedRow[] = []
  const driverNames = new Set<string>()
  const monthVotes = new Map<string, number>()

  for (let i = headRow + 1; i < aoa.length; i++) {
    const r = aoa[i]
    if (!r.some((c) => cell(c) !== null)) continue
    const line = i + 1
    const issues: Issue[] = []
    const rawDate = String(cell(get(r, 'date')) ?? '')
    const date = parseDate(get(r, 'date'))
    if (!date)
      issues.push({
        severity: 'error',
        line,
        message: rawDate
          ? `Unreadable date “${rawDate}” — row skipped`
          : 'Missing date — row skipped',
      })

    const guest = cell(get(r, 'guest'))
    const vehicleCell = cell(get(r, 'vehicle'))
    const entryCell = cell(get(r, 'entryType'))
    const joined = [guest, vehicleCell, entryCell].filter((x) => typeof x === 'string') as string[]
    const entryType: EntryKind = joined.some((s) => WEEK_OFF.test(s))
      ? 'week_off'
      : joined.some((s) => LEAVE.test(s))
        ? 'leave'
        : 'duty'

    const drv = cell(get(r, 'driver'))
    if (typeof drv === 'string') driverNames.add(drv)
    const mc = parseMonthCell(get(r, 'month'))
    if (mc) monthVotes.set(mc, (monthVotes.get(mc) ?? 0) + 1)

    let vehicle: string | null = null
    let vehicleKind: VehicleKind | null = null
    if (entryType === 'duty' && vehicleCell !== null) {
      vehicle = String(vehicleCell)
      if (/^own\b/i.test(vehicle)) vehicleKind = 'own'
      else if (fleet.has(norm(vehicle))) vehicleKind = 'fleet'
      else {
        vehicleKind = 'other'
        issues.push({
          severity: 'note',
          line,
          message: `Vehicle “${vehicle}” isn’t in the fleet — saved as “Others · ${vehicle}”`,
        })
      }
    }

    let startKm = parseNumber(get(r, 'startKm'))
    let endKm = parseNumber(get(r, 'endKm'))
    let totalKm = parseNumber(get(r, 'totalKm'))
    if (startKm !== null && endKm !== null && endKm < startKm) {
      issues.push({
        severity: 'warning',
        line,
        message: `Ending KM (${endKm}) is lower than starting KM (${startKm}) — KM ignored`,
      })
      startKm = endKm = null
    }
    if (totalKm === null && startKm !== null && endKm !== null) totalKm = endKm - startKm
    if (
      entryType === 'duty' &&
      vehicleKind === 'fleet' &&
      startKm === null &&
      endKm === null &&
      totalKm === null
    ) {
      issues.push({ severity: 'warning', line, message: 'Fleet vehicle without KM' })
    }

    rows.push({
      line,
      date,
      rawDate,
      entryType,
      dutyType: entryType === 'duty' ? dutyTypeOf(get(r, 'dutyType')) : null,
      vehicle,
      vehicleKind,
      guest: typeof guest === 'string' && entryType === 'duty' ? guest : null,
      guestArea: entryType === 'duty' ? (cell(get(r, 'guestArea')) as string | null) : null,
      pickup: entryType === 'duty' ? (cell(get(r, 'pickup')) as string | null) : null,
      drop: entryType === 'duty' ? (cell(get(r, 'drop')) as string | null) : null,
      startKm,
      endKm,
      totalKm,
      startTime: parseTime(get(r, 'startTime')),
      endTime: parseTime(get(r, 'endTime')),
      totalMinutes: parseMinutes(get(r, 'totalHours')),
      fuelLitres: parseNumber(get(r, 'fuelLitres')),
      fuelAmount: parseNumber(get(r, 'fuelAmount')),
      issues,
    })
  }

  // Month: the Month column wins, otherwise the most common date's month.
  const votes = monthVotes.size
    ? monthVotes
    : rows.reduce(
        (m, r) => (r.date ? m.set(r.date.slice(0, 7), (m.get(r.date.slice(0, 7)) ?? 0) + 1) : m),
        new Map<string, number>(),
      )
  const month = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const driverName = driverNames.size === 1 ? [...driverNames][0] : null
  return {
    rows,
    unknownColumns: unknown,
    detected: { driverName, month },
    fatal: rows.length === 0 ? 'No data rows found under the header.' : null,
  }
}
