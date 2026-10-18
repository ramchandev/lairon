import { format } from 'date-fns'

export const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)

export const fmtDate = (d: Date | string) => format(new Date(d), 'dd MMM yyyy')
export const fmtTime = (d: Date | string) => format(new Date(d), 'hh:mm a')

/** TN09AB6435 -> TN 09 AB 6435 (falls back to the raw value). */
export function formatVehicleNumber(n: string): string {
  const m = /^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$/.exec(n)
  return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : n
}

/** What drivers see in the dropdown: name + last 4 digits, e.g. CRYSTA 6435. */
export const vehicleLabel = (name: string, number: string) => `${name} ${number.slice(-4)}`

/** Stored form: uppercase, no spaces. */
export const normalizeVehicleNumber = (n: string) => n.toUpperCase().replace(/\s+/g, '')

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
