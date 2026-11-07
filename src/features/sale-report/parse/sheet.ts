/** An .xls / .xlsx as rows of cells: the sheet with the most filled cells (statements often have two empty extra sheets). SheetJS loads on demand. */
export async function readRows(data: ArrayBuffer): Promise<unknown[][]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(data, { type: 'array', cellDates: false, raw: true })
  let best: unknown[][] = []
  let bestCount = -1
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    })
    const count = rows.reduce((n, r) => n + r.filter((c) => c !== null && c !== '').length, 0)
    if (count > bestCount) {
      best = rows
      bestCount = count
    }
  }
  return best
}

/** SHA-256 of the file, to spot the same file uploaded twice. */
export async function fileHash(data: ArrayBuffer): Promise<string | null> {
  try {
    const d = await crypto.subtle.digest('SHA-256', data)
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}
