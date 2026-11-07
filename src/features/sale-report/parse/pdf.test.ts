import { DEFAULT_FIELDS } from '../fields'
import { itemsToRows, type PdfItem } from './pdf'
import { analyse } from './statement'

const CH = 5 // width of one character in the fake page
/** Lay text out on a page: each line is [y, [[x, text], ...]]. */
const page = (lines: [number, [number, string][]][]): PdfItem[] =>
  lines.flatMap(([y, cells]) =>
    cells.map(([x, str]) => ({ str, x, y, w: str.length * CH, page: 1 })),
  )
// right-aligned figure ending at x1
const fig = (x1: number, v: string): [number, string] => [x1 - v.length * CH, v]

const statement = page([
  [800, [[40, 'KASI AGENCIES']]],
  [785, [[40, 'Stock & Sales Statement 01-05-2026 to 31-05-2026']]],
  [
    760,
    [
      [40, 'Product Name'],
      [200, 'Op. Stock'],
      [260, 'Pur. Qty'],
      [320, 'Sales Qty'],
      [380, 'Cl.Stock'],
    ],
  ],
  [740, [[40, 'ELVION XT TAB'], fig(230, '92'), fig(290, '0'), fig(350, '52'), fig(410, '40')]],
  [
    725,
    [[40, 'LAIROCEF 1.5G INJ'], fig(230, '281'), fig(290, '200'), fig(350, '362'), fig(410, '119')],
  ],
  [710, [[40, 'CLOPILART 75'], fig(230, '10'), fig(290, '30'), fig(350, '25'), fig(410, '15')]],
  [690, [[40, 'Total'], fig(230, '383'), fig(290, '230'), fig(350, '439'), fig(410, '174')]],
])

describe('itemsToRows (PDF layout)', () => {
  const rows = itemsToRows(statement, DEFAULT_FIELDS)

  it('keeps the heading row and one row per product, without the total', () => {
    const names = rows.map((r) => String(r[0]))
    expect(names).toContain('ELVION XT TAB')
    expect(names).toContain('CLOPILART 75')
    expect(names.some((n) => /^total$/i.test(n))).toBe(false)
  })

  it('lines the figures up under their headings', () => {
    const a = analyse(rows, DEFAULT_FIELDS, 'KASI CD SALES.pdf')
    expect(a.problems).toEqual([])
    const by = Object.fromEntries(a.columns.map((c) => [c.heading, c.field]))
    expect(by['Op. Stock']).toBe('opening')
    expect(by['Pur. Qty']).toBe('purchase')
    expect(by['Sales Qty']).toBe('sales')
    expect(by['Cl.Stock']).toBe('closing')
    expect(a.rows).toHaveLength(3)
    expect(a.meta.period?.month).toBe('2026-05')
  })
})

describe('a PDF with no stock or sales columns', () => {
  const bills = page([
    [800, [[40, 'SARASWATHI AGENCIES']]],
    [
      760,
      [
        [40, 'Bill No'],
        [140, 'Date'],
        [240, 'Party'],
        [340, 'Amount'],
      ],
    ],
    [740, [[40, 'B-101'], [140, '02-05-2026'], [240, 'Dr Rao'], fig(380, '1200')]],
    [725, [[40, 'B-102'], [140, '03-05-2026'], [240, 'Dr Iyer'], fig(380, '800')]],
  ])
  it('is refused with a message the admin can act on', () => {
    const a = analyse(itemsToRows(bills, DEFAULT_FIELDS), DEFAULT_FIELDS, 'REPL.pdf')
    expect(a.problems.join(' ')).toMatch(/no sales or stock columns/i)
  })
})
