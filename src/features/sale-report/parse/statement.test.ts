import { DEFAULT_FIELDS } from '../fields'
import { analyse, buildLines, mapOf, stockMismatches, suggestField, toNumber } from './statement'

const F = DEFAULT_FIELDS
const map = (h: string) => suggestField(h, F).key

describe('suggestField', () => {
  it('knows the stockists’ different headings', () => {
    expect(['Open', 'Op. Stock', 'OPENING QTY.', 'Opstk', 'Op.Bal'].map(map)).toEqual([
      'opening',
      'opening',
      'opening',
      'opening',
      'opening',
    ])
    expect(['Clo.', 'Cl.Stock', 'CurStk', 'BAL.', 'Cl. Bal'].map(map)).toEqual([
      'closing',
      'closing',
      'closing',
      'closing',
      'closing',
    ])
    expect(['CM-Sales', 'Sales Qty', 'ISSUE QTY.', 'Sale', 'SALE'].map(map)).toEqual([
      'sales',
      'sales',
      'sales',
      'sales',
      'sales',
    ])
    expect(['S.Free', 'SFree', 'SS'].map(map)).toEqual(['free', 'free', 'free'])
    expect(['OrderQty.', 'OrdQt', 'ORD.'].map(map)).toEqual(['order_qty', 'order_qty', 'order_qty'])
  })
  it('keeps values, returns and unknown columns out of the quantity fields', () => {
    expect(map('OPENING VALUE')).toBeNull()
    expect(map('Closing Stock Value')).toBe('stock_value')
    expect(map('Purchase Return')).toBeNull()
    expect(map('DUMP')).toBeNull()
    expect(map('P.Free')).toBe('purchase_free')
  })
})

describe('toNumber', () => {
  it('reads dashes, commas, brackets and paid+free', () => {
    expect(['-', '  -', '', '1,234.5', '(5)', '-3', '9+1', 'abc', 7].map(toNumber)).toEqual([
      0,
      0,
      0,
      1234.5,
      -5,
      -3,
      10,
      null,
      7,
    ])
  })
})

const akash = [
  ['AKASH AGENCIES'],
  ['Stock and Sales - LAIRON LIFE SCIENCES-CRITICAL - 01-05-2026 to 30-05-2026.'],
  [
    'Sl.No',
    'Product',
    'Packing',
    'Rate',
    'LM-Sales',
    'Open',
    'Pur',
    'P.Free',
    'CM-Sales',
    'S.Free',
    'Dif.',
    'Clo.',
    'OrderQty.',
    'OrderValue.',
  ],
  [1, 'ELVION XT', '10S', 64.25, 44, 92, 0, 0, 44, 8, 0, 40, 0, 0],
  [2, 'LAIROCEF 1.5G INJ', 'VIAL', 203.57, 269, 281, 200, 80, 362, 116, 17, 100, 0, 0],
]
const marg = [
  ["VRJ PHARMACEUTICAL'S"],
  ['STOCK & SALES ANALYSIS  (LAIRION) 01/05/2026 - 31/05/2026'],
  [
    'ITEM DESCRIPTION',
    '   OPENING',
    '',
    '   RECEIPT',
    '',
    '    ISSUE',
    '',
    '   CLOSING',
    '',
    'DUMP',
  ],
  [null, 'QTY.', 'VALUE', 'QTY.', 'VALUE', 'QTY.', 'VALUE', 'QTY.', 'VALUE', 'QTY.'],
  ['LAIRION'],
  ['ELVION XT TAB                 10S', 181, 10175.22, 60, 3212.5, 154, 9653.48, 87, 4890.85, 27],
  ['GLICLART 60MG TAB             10S', 4, 145.14, 24, 829.44, 12, 410.4, 16, 580.56, '  -'],
]

describe('analyse', () => {
  it('reads a one-row header (Akash)', () => {
    const a = analyse(akash, F, 'AKASH CC SALES.xlsx')
    expect(a.problems).toEqual([])
    expect(a.meta).toMatchObject({ stockist: 'AKASH AGENCIES', divisionHint: 'cc' })
    expect(a.meta.period?.month).toBe('2026-05')
    expect(a.rows.map((r) => r.name)).toEqual(['ELVION XT', 'LAIROCEF 1.5G INJ'])
    const lines = buildLines(a, mapOf(a))
    expect(lines[1].values).toMatchObject({
      opening: 281,
      purchase: 200,
      purchase_free: 80,
      sales: 362,
      free: 116,
      closing: 100,
      adjustment: 17,
    })
    expect(stockMismatches(lines).bad).toHaveLength(0)
  })
  it('merges a two-row header and skips section titles (Marg)', () => {
    const a = analyse(marg, F, 'VRJ SALES.xlsx')
    expect(a.problems).toEqual([])
    expect(a.rows).toHaveLength(2)
    const lines = buildLines(a, mapOf(a))
    expect(lines[0].values).toMatchObject({ opening: 181, purchase: 60, sales: 154, closing: 87 })
  })
  it('lets the admin change a mapping', () => {
    const a = analyse(akash, F)
    const col = a.columns.find((c) => c.heading === 'LM-Sales')!
    const lines = buildLines(a, { ...mapOf(a), [col.index]: 'sales' })
    expect(lines[0].values.sales).toBe(44 + 44) // LM-Sales + CM-Sales now both count as sales
  })
  it('rejects a bill-wise report that has no stock columns', () => {
    const bills = [
      ['SARASWATHI PHARMA AGENCIES'],
      ['Manufacturerwise Sales Report From 01/05/26 To 31/05/26'],
      [
        'C',
        'Co',
        'Customer Name',
        'Address3',
        'BillDate',
        'BillNo',
        'BatchDescript',
        'Sales',
        'Free',
        'Rep',
        'NetAmount',
      ],
      ['7099', 'DR.S.RANJITH', 'ULUNDURPETTA', '16/05/26', '26S01026', 'GA26B-40E', 100],
    ]
    const a = analyse(bills, F, 'SARASWATHI CC REPL.PDF')
    expect(a.problems.join(' ')).toMatch(/no sales or stock columns|No sales or stock columns/)
  })
})
