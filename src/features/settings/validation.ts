export const MIN_WINDOW = 1
export const MAX_WINDOW = 60

/** Driver edit window: whole days, 1–60. Returns an error message or null. */
export function validateWindow(v: string): string | null {
  if (!/^\d+$/.test(v.trim())) return 'Enter a whole number of days'
  const n = Number(v)
  return n < MIN_WINDOW || n > MAX_WINDOW
    ? `Choose between ${MIN_WINDOW} and ${MAX_WINDOW} days`
    : null
}

export const validateCompany = (v: string): string | null =>
  v.trim().length === 0
    ? 'Company name is required'
    : v.trim().length > 80
      ? 'Keep it under 80 characters'
      : null
