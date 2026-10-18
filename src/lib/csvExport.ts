export type Cell = string | number | boolean | null | undefined

/** Quote a cell, and neutralise spreadsheet formulas (=, +, -, @) so exported text can't run as one. */
function cell(v: Cell): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const toCsv = (header: string[], rows: Cell[][]) =>
  [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')

export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  // BOM so Excel opens UTF-8 (₹, Tamil names) correctly.
  const url = URL.createObjectURL(
    new Blob(['﻿' + toCsv(header, rows)], { type: 'text/csv;charset=utf-8' }),
  )
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
