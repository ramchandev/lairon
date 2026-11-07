import {
  datesOf,
  deriveActivity,
  effectiveActivity,
  isDeviation,
  type DailyLog,
  type DoctorCall,
  type MonthlyActivity,
} from './activity'

const log = (day: string, f: Partial<DailyLog> = {}): DailyLog => ({
  day,
  day_type: 'field',
  location_id: 'mdu',
  tp_planned: null,
  actual_work: null,
  deviation: false,
  reason: null,
  prior_approval: null,
  remarks: null,
  chemist_calls: 0,
  ...f,
})
const call = (day: string, name: string, f: Partial<DoctorCall> = {}): DoctorCall => ({
  day,
  location_id: 'mdu',
  doctor_id: null,
  doctor_name: name,
  speciality: null,
  place: null,
  kind: 'planned_met',
  activity_type: null,
  activity_name: null,
  amount: 0,
  status: 'done',
  discussion: null,
  instructions: null,
  ...f,
})
const noSaved = null as MonthlyActivity | null

describe('deviation', () => {
  it('is a difference between a planned and an actual place, ignoring case and spaces', () => {
    expect(isDeviation('MDU', 'mdu ')).toBe(false)
    expect(isDeviation('MDU/KARAI', 'MDU')).toBe(true)
    expect(isDeviation('MDU', '')).toBe(false)
    expect(isDeviation(null, 'chennai')).toBe(false)
  })
})

describe('derived monthly activity', () => {
  const logs = [
    log('2026-09-01', { chemist_calls: 4 }),
    log('2026-09-02', { chemist_calls: 6 }),
    log('2026-09-03', { day_type: 'meeting' }),
    log('2026-09-06', { day_type: 'weekoff' }),
    log('2026-09-07', { day_type: 'holiday' }),
    log('2026-09-08', { day_type: 'leave' }),
    log('2026-10-01', { chemist_calls: 99 }),
  ]
  const calls = [
    call('2026-09-01', 'Dr A'),
    call('2026-09-02', 'dr a'),
    call('2026-09-02', 'Dr B', { kind: 'unplanned_met' }),
    call('2026-09-02', 'Dr C', { kind: 'missed' }),
    call('2026-09-02', 'Dr D', { activity_type: 'camp', activity_name: 'Ortho camp' }),
    call('2026-09-02', 'Dr E', { activity_type: 'camp', activity_name: 'ortho camp' }),
    call('2026-09-03', 'Dr A'),
    call('2026-10-01', 'Dr Z'),
  ]
  const d = deriveActivity(logs, calls, '2026-09')
  it('counts days by type, working days = days − week offs − holidays', () => {
    expect(d).toMatchObject({
      days_worked: 2,
      meeting_days: 1,
      holidays: 1,
      leave_days: 1,
      working_days: 28,
    })
  })
  it('counts doctor calls (met, not missed), chemist calls and missed calls for the month only', () => {
    expect(d).toMatchObject({ dr_calls: 6, ch_calls: 10, missed_calls: 1 })
  })
  it('counts doctors met once, twice and three or more times (names matched ignoring case)', () => {
    expect(d).toMatchObject({ mcl_met: 4, three_visit: 1, two_visit: 0, one_visit: 3 })
  })
  it('counts one camp per day and name', () => {
    expect(d.camps).toBe(1)
    expect(d.cmes).toBe(0)
  })
  it('can be limited to one location', () => {
    const only = deriveActivity(
      [log('2026-09-01', { location_id: 'ngl', chemist_calls: 3 })],
      [call('2026-09-01', 'Dr A', { location_id: 'ngl' }), call('2026-09-01', 'Dr B')],
      '2026-09',
      'ngl',
    )
    expect(only).toMatchObject({ dr_calls: 1, ch_calls: 3, days_worked: 1 })
  })
})

describe('effective figures', () => {
  const derived = deriveActivity(
    [log('2026-09-01'), log('2026-09-02')],
    [
      call('2026-09-01', 'A'),
      call('2026-09-02', 'B'),
      call('2026-09-02', 'C'),
      call('2026-09-02', 'D'),
    ],
    '2026-09',
  )
  it('uses the calculated numbers, with the average per day worked and coverage from the MCL size', () => {
    const e = effectiveActivity(derived, noSaved, 8)
    expect(e.dr_calls).toBe(4)
    expect(e.dr_call_avg).toBe(2)
    expect(e.coverage).toBe(50)
  })
  it('a typed-in figure wins, and the averages follow it', () => {
    const saved = {
      dr_calls: 102,
      days_worked: 18,
      mcl_met: 125,
      mcl_total: 200,
      pob: null,
    } as unknown as MonthlyActivity
    const e = effectiveActivity(derived, { ...saved, ch_calls: null }, 200)
    expect(e.dr_calls).toBe(102)
    expect(e.dr_call_avg).toBe(5.7)
    expect(e.coverage).toBe(62.5)
  })
  it('no division by zero', () => {
    const e = effectiveActivity(deriveActivity([], [], '2026-09'), noSaved, 0)
    expect(e.dr_call_avg).toBe(0)
    expect(e.coverage).toBe(0)
  })
})

it('lists every date of the month', () => {
  expect(datesOf('2026-02')).toHaveLength(28)
  expect(datesOf('2026-09')[29]).toBe('2026-09-30')
})
