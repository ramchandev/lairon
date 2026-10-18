/** Normalise an Indian mobile to E.164 (+91XXXXXXXXXX). Returns null when invalid. Mirror of supabase/functions/_shared/phone.ts. */
export function normalizePhone(input: string): string | null {
  let d = String(input ?? '').replace(/[\s\-().]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  if (d.startsWith('91') && d.length === 12) d = d.slice(2)
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null
}

/** +919876543210 -> +91 98765 43210 */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164)
  return m ? `+91 ${m[1]} ${m[2]}` : e164
}
