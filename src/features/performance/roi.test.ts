import { buildRoi, fyMonths, type RoiRevenue, type RoiService } from './roi'

const svc = (
  id: string,
  doctor: string,
  amount: number,
  month: string,
  f: Partial<RoiService> = {},
): RoiService => ({
  id,
  doctor_id: doctor,
  doctor_name: `Dr ${doctor}`,
  speciality: 'MS',
  location_id: 'mdu',
  manager_id: 'm1',
  amount,
  month,
  ...f,
})
const rev = (service_id: string, month: string, amount: number): RoiRevenue => ({
  service_id,
  month,
  amount,
})
const o = { fyFrom: '2026-04', asOf: '2026-09' }

describe('ROI', () => {
  it('a service of 10,000 that returns 40,000 is 4× — achieved', () => {
    const r = buildRoi(
      [svc('s1', 'a', 10000, '2026-04')],
      [rev('s1', '2026-05', 25000), rev('s1', '2026-06', 15000)],
      o,
    )
    expect(r.doctors[0]).toMatchObject({
      serviceAmount: 10000,
      totalReturn: 40000,
      roi: 4,
      achieved: true,
    })
    expect(r.achieved).toBe(1)
  })
  it('39,999 is not enough', () => {
    const r = buildRoi([svc('s1', 'a', 10000, '2026-04')], [rev('s1', '2026-05', 39999)], o)
    expect(r.doctors[0].achieved).toBe(false)
  })
  it('is cumulative per doctor across services', () => {
    const r = buildRoi(
      [svc('s1', 'a', 10000, '2026-04'), svc('s2', 'a', 10000, '2026-07')],
      [rev('s1', '2026-05', 30000), rev('s2', '2026-08', 50000)],
      o,
    )
    expect(r.doctors).toHaveLength(1)
    expect(r.doctors[0]).toMatchObject({
      serviceAmount: 20000,
      totalReturn: 80000,
      roi: 4,
      achieved: true,
    })
  })
  it('only counts what happened up to the chosen month', () => {
    const r = buildRoi(
      [svc('s1', 'a', 10000, '2026-04'), svc('s2', 'a', 10000, '2026-10')],
      [rev('s1', '2026-05', 40000), rev('s1', '2026-10', 5000)],
      o,
    )
    expect(r.doctors[0]).toMatchObject({ serviceAmount: 10000, totalReturn: 40000 })
  })
  it('counts how many doctors had reached 4× at the end of each month', () => {
    const r = buildRoi(
      [svc('s1', 'a', 10000, '2026-04'), svc('s2', 'b', 10000, '2026-04')],
      [rev('s1', '2026-05', 40000), rev('s2', '2026-07', 40000)],
      o,
    )
    expect(r.achievedByMonth['2026-04']).toBe(0)
    expect(r.achievedByMonth['2026-05']).toBe(1)
    expect(r.achievedByMonth['2026-06']).toBe(1)
    expect(r.achievedByMonth['2026-07']).toBe(2)
  })
  it('credits only the manager handling the request, and filters by location', () => {
    const services = [
      svc('s1', 'a', 100, '2026-04'),
      svc('s2', 'b', 100, '2026-04', { manager_id: 'm2', location_id: 'ngl' }),
    ]
    expect(buildRoi(services, [], { ...o, managerId: 'm2' }).doctors.map((d) => d.key)).toEqual([
      'b',
    ])
    expect(
      buildRoi(services, [], { ...o, locationIds: ['mdu'] }).doctors.map((d) => d.key),
    ).toEqual(['a'])
  })
  it('a doctor with no spend is never achieved, and the year runs April to March', () => {
    expect(
      buildRoi([svc('s1', 'a', 0, '2026-04')], [rev('s1', '2026-05', 5)], o).doctors[0].achieved,
    ).toBe(false)
    expect(fyMonths('2026-04')[11]).toBe('2027-03')
  })
})
