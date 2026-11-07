import { DEFAULT_SETTINGS, averageSales, runReport, toSaleRows, type SaleRow } from './reports'

const row = (o: Partial<SaleRow>): SaleRow => ({
  month: '2026-05',
  stockistId: 's1',
  stockist: 'Akash',
  locationId: 'l1',
  location: 'Madurai',
  divisionId: 'd1',
  division: 'Critical Care',
  productKey: 'p1',
  product: 'ELVION XT',
  opening: 0,
  purchase: 0,
  sales: 0,
  free: 0,
  closing: 0,
  orderQty: 0,
  saleReturn: 0,
  salesValue: 0,
  stockValue: 0,
  ...o,
})
const S = { ...DEFAULT_SETTINGS } // cover 1.5, history 3, slow 3

const rows = [
  row({ month: '2026-03', sales: 30 }),
  row({ month: '2026-04', sales: 60, salesValue: 600 }),
  row({ month: '2026-05', sales: 90, closing: 20, salesValue: 900, free: 9, saleReturn: 3 }),
  // a second stockist sitting on stock, not selling
  row({
    stockistId: 's2',
    stockist: 'Kasi',
    locationId: 'l2',
    location: 'Theni',
    closing: 100,
    stockValue: 5000,
    month: '2026-05',
  }),
]

describe('sale reports', () => {
  it('averages the last 3 months of a stockist’s sales', () => {
    const avg = averageSales(rows, '2026-05', S)
    expect(avg(rows[2])).toBe(60) // (30+60+90)/3
  })

  it('reorder = average × cover − closing, rounded up', () => {
    const t = runReport('reorder', rows, '2026-05', S)
    // 60 × 1.5 − 20 = 70
    expect(t.rows[0][0]).toBe('ELVION XT')
    expect(t.rows[0][4]).toBe(70)
    const by = runReport('reorder-stockist', rows, '2026-05', S)
    expect(by.rows).toHaveLength(1)
    expect(by.rows[0][5]).toBe(70)
  })

  it('a changed cover month changes the suggestion', () => {
    const t = runReport('reorder-stockist', rows, '2026-05', { ...S, cover_months: 1 })
    expect(t.rows[0][5]).toBe(40)
  })

  it('flags stock that is not selling', () => {
    const t = runReport('not-selling', rows, '2026-05', S)
    expect(t.rows.map((r) => r[0])).toEqual(['Kasi'])
    expect(t.rows[0][5]).toBeNull() // no sales → no months-of-stock figure
  })

  it('ranks top products with change from last month', () => {
    const t = runReport('top-products', rows, '2026-05', S)
    expect(t.rows[0].slice(0, 2)).toEqual(['ELVION XT', 90])
    expect(t.rows[0][5]).toBe(50) // 60 → 90
  })

  it('totals the month by location and division', () => {
    const loc = runReport('by-location', rows, '2026-05', S)
    expect(loc.rows[0].slice(0, 3)).toEqual(['Madurai', 90, 900])
    expect(runReport('by-division', rows, '2026-05', S).rows).toHaveLength(1)
  })

  it('shows free and returns against sales', () => {
    const t = runReport('scheme', rows, '2026-05', S)
    expect(t.rows[0]).toEqual(['ELVION XT', 90, 9, 10, 3, 3.33])
  })

  it('upload status lists stockists whose file is missing this month', () => {
    const up = [
      {
        stockistId: 's1',
        stockist: 'Akash',
        divisionId: 'd1',
        division: 'CC',
        month: '2026-05-01',
      },
      { stockistId: 's2', stockist: 'Kasi', divisionId: 'd1', division: 'CC', month: '2026-04-01' },
    ]
    const t = runReport(
      'status',
      rows,
      '2026-05',
      S,
      up.map((u) => ({ ...u, month: u.month.slice(0, 7) })),
    )
    expect(t.rows.map((r) => [r[0], r[2]])).toEqual([
      ['Kasi', 'Missing'],
      ['Akash', 'Received'],
    ])
  })

  it('trend gives six months of units', () => {
    const t = runReport('trend', rows, '2026-05', S)
    expect(t.rows[0].slice(1, 7)).toEqual([0, 0, 0, 30, 60, 90])
  })
})

describe('toSaleRows', () => {
  const lk = {
    products: new Map([['p1', { name: 'ELVION XT', pts: 64 }]]),
    stockists: new Map([['s1', { name: 'Akash', locationId: 'l1' }]]),
    locations: new Map([['l1', 'Madurai']]),
    divisions: new Map([['d1', 'Critical Care']]),
  }
  const line = {
    product_id: 'p1',
    raw_name: 'ELION XT TAB',
    sales: 10,
    free: 0,
    opening: 0,
    purchase: 0,
    closing: 5,
    order_qty: 0,
    sale_return: 0,
    rate: 70,
    stock_value: 400,
    sales_value: 750,
    upload: { stockist_id: 's1', division_id: 'd1', month: '2026-05' },
  }
  it('values at our PTS, else the stockist’s own figures', () => {
    const [a] = toSaleRows([line], lk)
    expect([a.product, a.salesValue, a.stockValue]).toEqual(['ELVION XT', 640, 320])
    const [b] = toSaleRows([{ ...line, product_id: null }], lk)
    expect([b.product, b.salesValue, b.stockValue]).toEqual(['ELION XT TAB', 750, 400])
  })
})
