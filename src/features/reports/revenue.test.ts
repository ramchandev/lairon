import { buildReport, monthRange, type RevenueRow } from './revenue'

const row = (
  id: string,
  name: string,
  month: string,
  amount: number,
  manager = 'Ram',
): RevenueRow => ({
  doctor_id: id,
  doctor_name: name,
  manager_name: manager,
  month: `${month}-01`,
  amount,
  services: 1,
})

describe('revenue by doctor report', () => {
  it('lists every month in the period, oldest first, across a year end', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })
  it('pivots to one line per doctor with monthly columns, highest total first', () => {
    const r = buildReport(
      [
        row('a', 'Dr A', '2026-09', 1000),
        row('a', 'Dr A', '2026-10', 2000),
        row('b', 'Dr B', '2026-10', 9000, 'Priya'),
      ],
      '2026-09',
      '2026-10',
    )
    expect(r.months).toEqual(['2026-09', '2026-10'])
    expect(r.doctors.map((d) => [d.name, d.total])).toEqual([
      ['Dr B', 9000],
      ['Dr A', 3000],
    ])
    expect(r.doctors[1].byMonth).toEqual({ '2026-09': 1000, '2026-10': 2000 })
    expect(r.monthTotals).toEqual({ '2026-09': 1000, '2026-10': 11000 })
    expect(r.total).toBe(12000)
  })
  it('an empty period still has its month columns', () => {
    const r = buildReport([], '2026-09', '2026-10')
    expect(r.doctors).toEqual([])
    expect(r.monthTotals).toEqual({ '2026-09': 0, '2026-10': 0 })
  })
})
