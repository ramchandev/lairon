/** A doctor can have several specialities; they are stored as one comma-separated text. */
export const splitList = (v: string | null | undefined): string[] =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export const joinList = (items: string[]): string =>
  [...new Set(items.map((s) => s.trim()).filter(Boolean))].join(', ')
