import {
  DEFAULT_CONFIG,
  averageScore,
  buildInputs,
  ratingOf,
  scoreMonth,
  totalPoints,
  type Gathered,
  type MonthInputs,
} from './appraisal'
import type { SalesEntry } from './sales'

const base: MonthInputs = {
  month: '2026-04',
  hasData: true,
  sales: { target: 100, achieved: 100 },
  kdp: [
    { name: 'A', target: 100, achieved: 100 },
    { name: 'B', target: 100, achieved: 100 },
  ],
  newProducts: { target: 100, achieved: 100 },
  coveragePct: 100,
  newCustomers: 3,
  cmes: 3,
  roiDoctors: 3,
}
const pts = (s: ReturnType<typeof scoreMonth>, k: string) =>
  s.lines.find((l) => l.key === k)!.points

describe('appraisal scoring', () => {
  it('the default setup adds up to 100 points', () => {
    expect(totalPoints(DEFAULT_CONFIG)).toBe(100)
  })
  it('hitting every target scores 100 and is Outstanding', () => {
    const s = scoreMonth(base, DEFAULT_CONFIG)
    expect(s.total).toBeCloseTo(100, 6)
    expect(s.rating).toBe('Outstanding')
  })
  it('each part scores achieved ÷ target × its points', () => {
    const s = scoreMonth(
      {
        ...base,
        sales: { target: 100, achieved: 80 },
        coveragePct: 50,
        newCustomers: 1,
        cmes: 0,
        roiDoctors: 0,
      },
      DEFAULT_CONFIG,
    )
    expect(pts(s, 'sales')).toBeCloseTo(28, 6)
    expect(pts(s, 'coverage')).toBeCloseTo(5, 6)
    expect(pts(s, 'new_customers')).toBeCloseTo(1, 6)
    expect(pts(s, 'cme')).toBe(0)
    expect(pts(s, 'roi')).toBe(0)
  })
  it('is not capped: doing more than the target scores more than the points', () => {
    const s = scoreMonth(
      {
        ...base,
        sales: { target: 100, achieved: 120 },
        newProducts: { target: 100, achieved: 150 },
      },
      DEFAULT_CONFIG,
    )
    expect(pts(s, 'sales')).toBeCloseTo(42, 6)
    expect(pts(s, 'new_products')).toBeCloseTo(15, 6)
    expect(s.total).toBeGreaterThan(100)
  })
  it('splits the core (KDP) points equally between groups', () => {
    const s = scoreMonth(
      {
        ...base,
        kdp: [
          { name: 'A', target: 100, achieved: 100 },
          { name: 'B', target: 100, achieved: 0 },
        ],
      },
      DEFAULT_CONFIG,
    )
    expect(pts(s, 'kdp')).toBeCloseTo(17.5, 6)
    expect(s.lines.find((l) => l.key === 'kdp')!.pct).toBeCloseTo(50, 6)
  })
  it('a missing target scores 0, not an error', () => {
    const s = scoreMonth({ ...base, sales: { target: 0, achieved: 50 }, kdp: [] }, DEFAULT_CONFIG)
    expect(pts(s, 'sales')).toBe(0)
    expect(pts(s, 'kdp')).toBe(0)
  })
  it('rating bands: ≥100 Outstanding, 95–99 Good, 92–95 Satisfactory, below 92 Below par', () => {
    const r = (n: number) => ratingOf(n, DEFAULT_CONFIG.bands)
    expect([r(110), r(100), r(97), r(95), r(93), r(92), r(91.9), r(0)]).toEqual([
      'Outstanding',
      'Outstanding',
      'Good',
      'Good',
      'Satisfactory',
      'Satisfactory',
      'Below par',
      'Below par',
    ])
  })
  it('averages only the months that have data', () => {
    const a = scoreMonth(base, DEFAULT_CONFIG)
    const b = scoreMonth(
      { ...base, month: '2026-05', hasData: false, sales: { target: 0, achieved: 0 } },
      DEFAULT_CONFIG,
    )
    expect(averageScore([a, b], DEFAULT_CONFIG)).toMatchObject({ months: 1, rating: 'Outstanding' })
    expect(averageScore([b], DEFAULT_CONFIG)).toMatchObject({ months: 0, total: 0, rating: '—' })
  })
})

describe('gathering the inputs', () => {
  const e = (product: string, month: string, f: Partial<SalesEntry>): SalesEntry => ({
    id: product + month,
    manager_id: 'm',
    location_id: 'l',
    product_id: product,
    month,
    primary_target: 0,
    secondary_target: 0,
    primary_ach: 0,
    secondary_ach: 0,
    sales_return: 0,
    ...f,
  })
  const g: Gathered = {
    months: ['2026-04', '2026-05'],
    products: [
      { id: 'p1', name: 'Lairobon', tag: 'core', pts: 100, kdp_group: 'LAIROBON' },
      { id: 'p2', name: 'Lairobon D3', tag: 'core', pts: 50, kdp_group: 'LAIROBON' },
      { id: 'p3', name: 'Rbplar', tag: 'core', pts: 10, kdp_group: null },
      { id: 'p4', name: 'Newbie', tag: 'new', pts: 20, kdp_group: null },
    ],
    entries: [
      e('p1', '2026-04-01', {
        primary_target: 10,
        primary_ach: 12,
        secondary_target: 20,
        secondary_ach: 8,
      }),
      e('p2', '2026-04-01', { primary_target: 4, primary_ach: 4 }),
      e('p3', '2026-04-01', { primary_target: 100, primary_ach: 50 }),
      e('p4', '2026-04-01', { primary_target: 10, primary_ach: 5 }),
    ],
    logs: [],
    calls: [],
    monthly: {},
    conversions: [],
    roiByMonth: { '2026-04': 2 },
  }
  const inputs = buildInputs(g, DEFAULT_CONFIG)
  it('value = units × PTS on the chosen basis', () => {
    expect(inputs[0].sales).toEqual({
      target: 10 * 100 + 4 * 50 + 100 * 10 + 10 * 20,
      achieved: 12 * 100 + 4 * 50 + 50 * 10 + 5 * 20,
    })
    expect(buildInputs(g, { ...DEFAULT_CONFIG, sales_basis: 'secondary' })[0].sales).toEqual({
      target: 2000,
      achieved: 800,
    })
  })
  it('core products are grouped by KDP group (or their own name), new products tracked separately', () => {
    expect(inputs[0].kdp).toEqual([
      { name: 'LAIROBON', target: 14, achieved: 16 },
      { name: 'Rbplar', target: 100, achieved: 50 },
    ])
    expect(inputs[0].newProducts).toEqual({ target: 10, achieved: 5 })
  })
  it('a month with nothing entered has no data; ROI doctors come from the ROI report', () => {
    expect(inputs[0]).toMatchObject({ hasData: true, roiDoctors: 2 })
    expect(inputs[1]).toMatchObject({ hasData: false, roiDoctors: 0 })
  })
  it('counts doctors converted in the month as new customers', () => {
    const withConv = buildInputs(
      { ...g, conversions: [{ converted_on: '2026-05-10' } as never] },
      DEFAULT_CONFIG,
    )
    expect(withConv[1]).toMatchObject({ newCustomers: 1, hasData: true })
  })
})
