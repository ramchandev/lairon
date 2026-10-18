// @vitest-environment node
import { readImportFile } from './readFile'

const vehicles = [{ id: 'v1', name: 'AMAZE', vehicle_number: 'TN00XX6960' }]
const serial = (d: string) =>
  Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000 + 25569

describe('readImportFile (real SheetJS round-trips)', () => {
  it('reads an .xlsx with true Excel date cells without shifting any day', async () => {
    const XLSX = await import('xlsx')
    const ws: import('xlsx').WorkSheet = XLSX.utils.aoa_to_sheet([
      ['Date', 'Vehicle', 'Guest', 'Total KM', 'Total Hours'],
    ])
    ;['2026-09-01', '2026-09-13', '2026-09-30'].forEach((d, i) => {
      XLSX.utils.sheet_add_aoa(
        ws,
        [[{ t: 'n', v: serial(d), z: 'dd/mm/yyyy' }, 'AMAZE 6960', `Dr ${i}`, 93, '9 hrs 30 mins']],
        { origin: `A${i + 2}` },
      )
    })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const r = await readImportFile(new File([buf], 'PRAKALATHAN.M — September_2026.xlsx'), vehicles)
    expect(r.rows.map((x) => x.date)).toEqual(['2026-09-01', '2026-09-13', '2026-09-30'])
    expect(r.detected).toEqual({ driverName: 'PRAKALATHAN.M', month: '2026-09' })
    expect(r.rows[0]).toMatchObject({ vehicleKind: 'fleet', totalKm: 93, totalMinutes: 570 })
  })

  it('reads dd/mm/yyyy dates in a .csv as day-first (not US month-first)', async () => {
    const csv =
      'Date,Vehicle,Guest\n01/09/2026,Own,Dr A\n13/09/2026,Own,Dr B\n05/10/2026,Own,Dr C\n'
    const r = await readImportFile(new File([csv], 'duties.csv'), vehicles)
    expect(r.rows.map((x) => x.date)).toEqual(['2026-09-01', '2026-09-13', '2026-10-05'])
  })
})
