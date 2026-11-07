import {
  buildSalesReport,
  financialYear,
  lakhs,
  pct,
  quarterOf,
  totalsOf,
  type ProductInfo,
  type ReportFilters,
  type SalesEntry,
} from './sales'

const products: ProductInfo[] = [
  { id: 'p1', name: 'Lairobon', tag: 'core', pts: 100 },
  { id: 'p2', name: 'Lairobon-D3 2k', tag: 'new', pts: 50 },
  { id: 'p3', name: 'Medealar', tag: null, pts: null },
]
const e = (
  product: string,
  location: string,
  month: string,
  f: Partial<SalesEntry> = {},
): SalesEntry => ({
  id: `${product}${location}${month}`,
  manager_id: 'm',
  location_id: location,
  product_id: product,
  month,
  primary_target: 0,
  secondary_target: 0,
  primary_ach: 0,
  secondary_ach: 0,
  sales_return: 0,
  ...f,
})
const names = { locations: { mdu: 'Madurai', ngl: 'Nagercoil' } }
const base: ReportFilters = { locationIds: [], view: 'all', unit: 'units', groupBy: 'product' }

describe('sales formulas', () => {
  it('match the Excel: Ach %, secondary vs primary, gap, and IFERROR → 0', () => {
    const t = totalsOf({
      primary_target: 350,
      secondary_target: 400,
      primary_ach: 480,
      secondary_ach: 286,
      sales_return: 6,
    })
    expect(t.achPct).toBeCloseTo(137.14, 2)
    expect(t.secVsPri).toBeCloseTo(59.58, 2)
    expect(t.gap).toBe(194)
    expect(t.secAchPct).toBeCloseTo(71.5, 2)
    expect(t.netSecondary).toBe(280)
    expect(pct(5, 0)).toBe(0)
  })
  it('groups by product and adds months and locations together', () => {
    const r = buildSalesReport(
      [
        e('p1', 'mdu', '2026-04-01', {
          primary_target: 1700,
          primary_ach: 1500,
          secondary_ach: 2352,
        }),
        e('p1', 'ngl', '2026-04-01', { primary_target: 100, primary_ach: 50 }),
        e('p1', 'mdu', '2026-05-01', { primary_target: 1700, primary_ach: 2851 }),
      ],
      products,
      names,
      base,
    )
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].totals.primary_target).toBe(3500)
    expect(r.lines[0].totals.primary_ach).toBe(4401)
    expect(r.total.secondary_ach).toBe(2352)
  })
  it('filters by location and by Core / New', () => {
    const rows = [
      e('p1', 'mdu', '2026-04-01', { primary_ach: 10 }),
      e('p1', 'ngl', '2026-04-01', { primary_ach: 20 }),
      e('p2', 'mdu', '2026-04-01', { primary_ach: 30 }),
      e('p3', 'mdu', '2026-04-01', { primary_ach: 40 }),
    ]
    expect(
      buildSalesReport(rows, products, names, { ...base, locationIds: ['mdu'] }).total.primary_ach,
    ).toBe(80)
    expect(
      buildSalesReport(rows, products, names, { ...base, view: 'core' }).total.primary_ach,
    ).toBe(30)
    expect(
      buildSalesReport(rows, products, names, { ...base, view: 'new' }).total.primary_ach,
    ).toBe(30)
  })
  it('value = units × PTS, and a product without a PTS adds nothing', () => {
    const rows = [
      e('p1', 'mdu', '2026-04-01', { primary_ach: 10 }),
      e('p3', 'mdu', '2026-04-01', { primary_ach: 40 }),
    ]
    expect(
      buildSalesReport(rows, products, names, { ...base, unit: 'value' }).total.primary_ach,
    ).toBe(1000)
  })
  it('groups by month in date order and by location by name', () => {
    const rows = [
      e('p1', 'mdu', '2026-05-01', { primary_ach: 2 }),
      e('p1', 'mdu', '2026-04-01', { primary_ach: 1 }),
      e('p1', 'ngl', '2026-04-01', { primary_ach: 4 }),
    ]
    expect(
      buildSalesReport(rows, products, names, { ...base, groupBy: 'month' }).lines.map(
        (l) => l.label,
      ),
    ).toEqual(['2026-04-01', '2026-05-01'])
    expect(
      buildSalesReport(rows, products, names, { ...base, groupBy: 'location' }).lines.map((l) => [
        l.label,
        l.totals.primary_ach,
      ]),
    ).toEqual([
      ['Madurai', 3],
      ['Nagercoil', 4],
    ])
  })
})

describe('financial year helpers', () => {
  it('quarters run April–June as Q1', () => {
    expect(
      ['2026-04', '2026-06', '2026-07', '2026-10', '2027-01', '2027-03'].map(quarterOf),
    ).toEqual(['Q1', 'Q1', 'Q2', 'Q3', 'Q4', 'Q4'])
  })
  it('the financial year is April to March', () => {
    expect(financialYear('2026-11')).toEqual({ from: '2026-04', to: '2027-03' })
    expect(financialYear('2027-02')).toEqual({ from: '2026-04', to: '2027-03' })
  })
  it('lakhs shows two decimals', () => {
    expect(lakhs(1750000)).toBe('17.50')
  })
})
