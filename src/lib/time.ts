import { TIMEZONE } from './constants'

/** Today's date and the current time in India (the app's display timezone), regardless of the device's zone. */
export function istParts(d: Date = new Date()): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}

/** 'yyyy-MM-dd' + n days (calendar arithmetic in UTC, so no DST/zone surprises). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const diffDays = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  )

/** 555 -> "9h 15m", 45 -> "45m", 120 -> "2h". */
export function minutesText(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h ? `${h}h` : '', m || !h ? `${m}m` : ''].filter(Boolean).join(' ')
}

/** 'HH:MM[:SS]' -> minutes since midnight, NaN when invalid. */
export function timeToMinutes(t: string): number {
  const m = /^(\d{2}):(\d{2})/.exec(t)
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

/** '09:30' / '09:30:00' -> '9:30 AM'. */
export function time12(t: string | null): string {
  const mins = t ? timeToMinutes(t) : NaN
  if (Number.isNaN(mins)) return '—'
  const h = Math.floor(mins / 60)
  return `${h % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export const monthOf = (date: string) => date.slice(0, 7)
export const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}
export const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00Z`),
  )
