// Pure helpers with no dependencies. Kept out of schemas.ts so code that only needs them (the manager layout's badge,
// the API layer) doesn't pull the validation library into the first page load.

/** "1,25,000" / "5000.50" -> number, NaN when invalid. */
export const parseAmount = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(/[,\s₹]/g, '')))

export const isOffer = (t: string) => t.trim().toLowerCase() === 'offer'
export const isNetrate = (t: string) => t.trim().toLowerCase() === 'netrate'
