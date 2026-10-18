import {
  buildCalendar,
  dateRange,
  groupLeaves,
  monthSummary,
  resolveVehicle,
  tripSummary,
  tripText,
  vehicleChoice,
  type DayEntry,
} from './logic'

const e = (o: Partial<DayEntry>): DayEntry => ({
  id: Math.random().toString(36).slice(2),
  driver_id: 'd',
  entry_date: '2026-10-01',
  entry_type: 'duty',
  duty_type: 'Local',
  vehicle_source: 'own',
  vehicle_id: null,
  vehicle_label: null,
  guest_name: null,
  guest_area: null,
  pickup_point: null,
  drop_point: null,
  start_km: null,
  start_time: null,
  end_km: null,
  end_time: null,
  total_km: null,
  total_minutes: null,
  fuel_litres: null,
  fuel_amount: null,
  duty_status: 'closed',
  leave_type: null,
  leave_reason: null,
  leave_status: null,
  entry_source: 'app',
  created_at: '',
  driver_name: null,
  decision_note: null,
  ...o,
})

describe('tripSummary', () => {
  it('computes km and minutes, including past midnight', () => {
    expect(
      tripSummary({ startKm: '1450', endKm: '1502', startTime: '09:00', endTime: '18:15' }),
    ).toEqual({ km: 52, minutes: 555, nextDay: false })
    const t = tripSummary({ startKm: '100', endKm: '152', startTime: '22:00', endTime: '07:15' })
    expect(t).toEqual({ km: 52, minutes: 555, nextDay: true })
    expect(tripText(t)).toBe('52 km · 9h 15m · Ends next day')
  })
  it('stays quiet until inputs are valid', () => {
    expect(tripSummary({ startKm: '200', endKm: '100' }).km).toBeNull()
    expect(tripSummary({ startKm: '', endKm: '' })).toEqual({
      km: null,
      minutes: null,
      nextDay: false,
    })
    expect(tripText({ km: null, minutes: null, nextDay: false })).toBe('')
  })
})

describe('monthSummary', () => {
  it('counts duty days once per date and totals km / fuel', () => {
    const s = monthSummary([
      e({ entry_date: '2026-10-01', total_km: 40, fuel_litres: 5, fuel_amount: 500 }),
      e({ entry_date: '2026-10-01', total_km: 10 }),
      e({ entry_date: '2026-10-02', total_km: 20 }),
      e({ entry_date: '2026-10-03', entry_type: 'week_off', duty_type: null }),
      e({ entry_date: '2026-10-04', entry_type: 'leave', leave_status: 'approved' }),
      e({ entry_date: '2026-10-05', entry_type: 'leave', leave_status: 'rejected' }),
    ])
    expect(s).toMatchObject({
      dutyDays: 2,
      duties: 3,
      weekOffs: 1,
      leaveDays: 1,
      km: 70,
      fuelLitres: 5,
      fuelAmount: 500,
    })
  })
})

describe('buildCalendar', () => {
  it('lays out Monday-first weeks and marks days', () => {
    const weeks = buildCalendar('2026-10', [
      e({ entry_date: '2026-10-02', duty_type: 'Local' }),
      e({ entry_date: '2026-10-02', duty_type: 'Out Station' }),
      e({ entry_date: '2026-10-05', entry_type: 'week_off' }),
    ])
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks[0][3].date).toBe('2026-10-01') // 1 Oct 2026 is a Thursday
    const d2 = weeks[0][4]
    expect(d2).toMatchObject({ date: '2026-10-02', duties: 2, outstation: true })
    expect(weeks[1][0]).toMatchObject({ date: '2026-10-05', weekOff: true })
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(31)
  })
})

describe('groupLeaves', () => {
  it('merges consecutive days with the same type/reason/status', () => {
    const l = (d: string, extra: Partial<DayEntry> = {}) =>
      e({
        entry_date: d,
        entry_type: 'leave',
        leave_type: 'Casual',
        leave_reason: 'Family',
        leave_status: 'pending',
        ...extra,
      })
    const g = groupLeaves([
      l('2026-10-10'),
      l('2026-10-11'),
      l('2026-10-13'),
      l('2026-10-14', { leave_status: 'approved' }),
    ])
    expect(g.map((x) => [x.from, x.to, x.days, x.status])).toEqual([
      ['2026-10-10', '2026-10-11', 2, 'pending'],
      ['2026-10-13', '2026-10-13', 1, 'pending'],
      ['2026-10-14', '2026-10-14', 1, 'approved'],
    ])
  })
  it('keeps different drivers apart even on the same dates', () => {
    const l = (driver: string, d: string) =>
      e({
        driver_id: driver,
        entry_date: d,
        entry_type: 'leave',
        leave_type: 'Casual',
        leave_reason: 'x',
        leave_status: 'pending',
      })
    const g = groupLeaves([
      l('a', '2026-10-10'),
      l('b', '2026-10-10'),
      l('a', '2026-10-11'),
      l('b', '2026-10-11'),
    ])
    expect(g.map((x) => [x.driverId, x.days])).toEqual([
      ['a', 2],
      ['b', 2],
    ])
  })
  it('builds inclusive ranges', () =>
    expect(dateRange('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]))
})

describe('vehicle snapshot', () => {
  const vehicles = [{ id: 'v1', name: 'CRYSTA', vehicle_number: 'TN09AB6435' }]
  it('stores a plain-text label for every kind of vehicle', () => {
    expect(resolveVehicle('fleet:v1', '', vehicles)).toEqual({
      vehicle_source: 'fleet',
      vehicle_id: 'v1',
      vehicle_label: 'CRYSTA 6435',
    })
    expect(resolveVehicle('own', '', vehicles)).toEqual({
      vehicle_source: 'own',
      vehicle_id: null,
      vehicle_label: 'Own (guest vehicle)',
    })
    expect(resolveVehicle('other', ' Audi ', vehicles)).toEqual({
      vehicle_source: 'other',
      vehicle_id: null,
      vehicle_label: 'Others · Audi',
    })
  })
  it('round-trips the dropdown choice', () => {
    expect(vehicleChoice({ vehicle_source: 'fleet', vehicle_id: 'v1' })).toBe('fleet:v1')
    expect(vehicleChoice({ vehicle_source: 'own', vehicle_id: null })).toBe('own')
  })
})
