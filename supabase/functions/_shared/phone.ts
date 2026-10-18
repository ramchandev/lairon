/** Normalise an Indian mobile to E.164 (+91XXXXXXXXXX). Returns null when invalid. Mirror of src/lib/phone.ts. */
export function normalizePhone(input: string): string | null {
  let d = String(input ?? '').replace(/[\s\-().]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  if (d.startsWith('91') && d.length === 12) d = d.slice(2)
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null
}

/** Synthetic auth email for phone-only managers. */
export function managerEmail(e164: string): string {
  return `m${e164.replace('+', '')}@managers.lairon.internal`
}
