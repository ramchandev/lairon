import { detectFromFileName, parseSheet, type ParsedSheet } from './parse'

export interface ReadResult extends ParsedSheet {
  fileName: string
}

/**
 * Parse an .xlsx / .xls / .csv in the browser. First sheet, header in row 1.
 * cellDates:false keeps dates as Excel serial numbers (converted in UTC by parseDate); raw:true keeps CSV text untouched.
 */
export async function readImportFile(
  file: File,
  vehicles: { id: string; name: string; vehicle_number: string }[],
): Promise<ReadResult> {
  const XLSX = await import('xlsx')
  // raw:true stops SheetJS guessing US month-first dates in CSV text (01/09/2026 became 9 January); our parser reads dd/mm.
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, raw: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  })
  return withFileName(file.name, parseSheet(aoa, vehicles))
}

/** File name fills in the driver/month the sheet itself didn't say. */
export function withFileName(fileName: string, parsed: ParsedSheet): ReadResult {
  const fromName = detectFromFileName(fileName)
  return {
    ...parsed,
    fileName,
    detected: {
      driverName: parsed.detected.driverName ?? fromName.driverName,
      month: parsed.detected.month ?? fromName.month,
    },
  }
}
