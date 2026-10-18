import { betaRows, BETA_HEADER, entryRows, ENTRY_HEADER } from './exports'
import type { DayEntry } from './logic'

const entry = (o: Partial<DayEntry>): DayEntry => ({
  id: 'x',
  driver_id: 'd',
  driver_name: 'RAVIKUMAR.N',
  entry_date: '2026-10-01',
  entry_type: 'duty',
  duty_type: 'Local',
  vehicle_source: 'fleet',
  vehicle_id: 'v',
  vehicle_label: 'AMAZE 6960',
  guest_name: 'Dr J',
  guest_area: 'Adyar',
  pickup_point: 'A',
  drop_point: 'B',
  start_km: 100,
  start_time: '09:00:00',
  end_km: 193,
  end_time: '18:30:00',
  end_date: null,
  total_km: 93,
  total_minutes: 570,
  fuel_litres: 10,
  fuel_amount: 1000,
  duty_status: 'closed',
  leave_type: null,
  leave_reason: null,
  leave_status: null,
  entry_source: 'import',
  created_at: '',
  decision_note: null,
  ...o,
})

describe('trip duty exports', () => {
  it('writes every field per entry, with readable hours and HH:MM times', () => {
    const [r] = entryRows([entry({})])
    expect(r).toHaveLength(ENTRY_HEADER.length)
    expect(r[ENTRY_HEADER.indexOf('Start Time')]).toBe('09:00')
    expect(r[ENTRY_HEADER.indexOf('Hours')]).toBe('9h 30m')
    expect(r[ENTRY_HEADER.indexOf('Entry')]).toBe('Duty')
    expect(
      entryRows([
        entry({
          entry_type: 'week_off',
          duty_type: null,
          start_time: null,
          end_time: null,
          total_minutes: null,
        }),
      ])[0][2],
    ).toBe('Week off')
  })
  it('writes one beta row per driver', () => {
    const rows = betaRows('2026-10', [
      {
        driver_id: 'a',
        driver_name: 'RAVIKUMAR.N',
        local_days: 10,
        outstation_days: 2,
        payable_days: 12,
        local_amount: 2500,
        outstation_amount: 600,
        total_amount: 3100,
      },
    ])
    expect(rows[0]).toHaveLength(BETA_HEADER.length)
    expect(rows[0]).toEqual(['2026-10', 'RAVIKUMAR.N', 10, 2, 12, 2500, 600, 3100])
  })
})
