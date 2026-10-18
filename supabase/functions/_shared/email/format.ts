const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
export const inr = (n: number) => `₹${inr0.format(Math.round(Number(n)))}`

/** '2026-10-18' -> '18 Oct 2026' (date-only values are treated as calendar dates, never shifted by timezone). */
export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))

export const dateRange = (from: string, to: string) => (from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`)

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
