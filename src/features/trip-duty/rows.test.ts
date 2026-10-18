import { dutyToRow } from './rows'
import { dutySchema, closeSchema, leaveSchema, type DutyForm } from './schemas'

const vehicles = [{ id: 'v1', name: 'CRYSTA', vehicle_number: 'TN09AB6435' }]
const base: DutyForm = {
  entry_date: '2026-10-18',
  duty_type: 'Local',
  vehicle: 'fleet:v1',
  other_details: '',
  guest_name: 'Dr Rakshana',
  guest_area: 'Adyar',
  pickup_point: 'Airport',
  drop_point: 'Hotel',
  start_km: '1450',
  start_time: '09:00',
  finished: false,
  end_km: '',
  end_time: '',
  end_date: '2026-10-18',
  fuel_litres: '',
  fuel_amount: '',
}
const errs = (v: Partial<DutyForm>) => {
  const r = dutySchema.safeParse({ ...base, ...v })
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
}

describe('duty form validation', () => {
  it('accepts a started fleet duty', () => expect(errs({})).toEqual([]))
  it('requires starting KM only for fleet vehicles', () => {
    expect(errs({ start_km: '' })).toEqual(['start_km'])
    expect(errs({ vehicle: 'own', start_km: '' })).toEqual([])
  })
  it('requires details for Others', () => {
    expect(errs({ vehicle: 'other' })).toEqual(['other_details'])
    expect(errs({ vehicle: 'other', other_details: 'Audi' })).toEqual([])
  })
  it('when finished, needs a closing time and (fleet) ending KM not below the start', () => {
    expect(errs({ finished: true })).toEqual(['end_time', 'end_km'])
    expect(errs({ finished: true, end_time: '18:00', end_km: '1400' })).toEqual(['end_km'])
    expect(
      errs({
        finished: true,
        end_time: '18:00',
        end_km: '1502',
        fuel_litres: '12.5',
        fuel_amount: '1300',
      }),
    ).toEqual([])
    expect(errs({ finished: true, vehicle: 'own', end_time: '18:00' })).toEqual([])
  })
})

describe('dutyToRow', () => {
  it('saves an open duty without end fields and lets the database compute totals', () => {
    const r = dutyToRow(base, vehicles)
    expect(r).toMatchObject({
      duty_status: 'open',
      vehicle_label: 'CRYSTA 6435',
      vehicle_source: 'fleet',
      start_km: 1450,
      end_time: null,
      total_km: null,
      total_minutes: null,
    })
  })
  it('drops KM for own / other vehicles even if typed earlier', () => {
    expect(
      dutyToRow(
        { ...base, vehicle: 'own', finished: true, end_time: '18:00', end_km: '1500' },
        vehicles,
      ),
    ).toMatchObject({
      start_km: null,
      end_km: null,
      vehicle_label: 'Own (guest vehicle)',
      duty_status: 'closed',
    })
    expect(
      dutyToRow({ ...base, vehicle: 'other', other_details: 'Audi' }, vehicles).vehicle_label,
    ).toBe('Others · Audi')
  })
})

describe('close + leave validation', () => {
  it('close: fleet needs ending KM at or above the start', () => {
    const ok = closeSchema(true, 1450)
    expect(
      ok.safeParse({
        end_km: '1400',
        end_time: '18:00',
        end_date: '2026-10-18',
        fuel_litres: '',
        fuel_amount: '',
      }).success,
    ).toBe(false)
    expect(
      ok.safeParse({
        end_km: '1500',
        end_time: '18:00',
        end_date: '2026-10-18',
        fuel_litres: '',
        fuel_amount: '',
      }).success,
    ).toBe(true)
    expect(
      closeSchema(false, null).safeParse({
        end_km: '',
        end_time: '18:00',
        end_date: '2026-10-18',
        fuel_litres: '',
        fuel_amount: '',
      }).success,
    ).toBe(true)
  })
  it('trip end date: required, not before the start, and a past-midnight time needs the next day', () => {
    const done = { finished: true, vehicle: 'own', end_time: '07:00' }
    expect(errs({ ...done, end_date: '' })).toEqual(['end_date'])
    expect(errs({ ...done, end_date: '2026-10-17' })).toEqual(['end_date'])
    expect(errs({ ...done, end_date: '2026-10-18' })).toEqual(['end_time']) // 07:00 < 09:00 on the same day
    expect(errs({ ...done, end_date: '2026-10-19' })).toEqual([])
    const close = closeSchema(false, null, { date: '2026-10-18', time: '09:00:00' })
    const c = { end_km: '', end_time: '07:00', fuel_litres: '', fuel_amount: '' }
    expect(close.safeParse({ ...c, end_date: '2026-10-18' }).success).toBe(false)
    expect(close.safeParse({ ...c, end_date: '2026-10-19' }).success).toBe(true)
  })
  it("saves the end date (and the driver's own car without KM)", () => {
    const row = dutyToRow(
      { ...base, vehicle: 'driver_own', finished: true, end_time: '07:00', end_date: '2026-10-19' },
      vehicles,
    )
    expect(row).toMatchObject({
      vehicle_source: 'driver_own',
      vehicle_label: 'Own car (driver)',
      vehicle_id: null,
      start_km: null,
      end_date: '2026-10-19',
    })
  })
  it('leave: range must be ordered and at most 31 days', () => {
    const v = { leave_type: 'Casual', reason: 'Family' }
    expect(leaveSchema.safeParse({ ...v, from: '2026-10-10', to: '2026-10-09' }).success).toBe(
      false,
    )
    expect(leaveSchema.safeParse({ ...v, from: '2026-10-01', to: '2026-11-15' }).success).toBe(
      false,
    )
    expect(leaveSchema.safeParse({ ...v, from: '2026-10-10', to: '2026-10-12' }).success).toBe(true)
  })
})
