import { parseAmount, serviceSchema, type ServiceForm } from './schemas'

const valid: ServiceForm = {
  request_date: '2026-10-18',
  doctor_id: '',
  doctor_name: 'Dr X',
  save_as_doctor: false,
  area: 'Adyar',
  hospital_name: 'Apollo',
  pharmacy_name: '',
  hq: 'CHN',
  division: 'OL',
  qualification: 'MD',
  speciality: 'Cardiologist',
  service_amount: '5,000',
  service_type: 'Camp',
  expected_business_value: '100000',
  current_business_value: '50000',
  offer_type: 'Offer',
  offer_percent: '10',
  netrate_amount: '',
}
const errs = (v: Partial<ServiceForm>) => {
  const r = serviceSchema.safeParse({ ...valid, ...v })
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
}

describe('serviceSchema', () => {
  it('accepts a complete Offer service', () => expect(errs({})).toEqual([]))
  it('requires Offer % for Offer and 0–100', () => {
    expect(errs({ offer_percent: '' })).toEqual(['offer_percent'])
    expect(errs({ offer_percent: '101' })).toEqual(['offer_percent'])
  })
  it('requires a Netrate amount for Netrate (not the percent)', () => {
    expect(errs({ offer_type: 'Netrate', offer_percent: '' })).toEqual(['netrate_amount'])
    expect(errs({ offer_type: 'Netrate', offer_percent: '', netrate_amount: '1200' })).toEqual([])
  })
  it('requires the starred fields', () => {
    expect(errs({ doctor_name: '', area: '', hq: '', division: '', service_type: '' })).toEqual([
      'doctor_name',
      'area',
      'hq',
      'division',
      'service_type',
    ])
  })
  it('parses Indian-formatted amounts', () => {
    expect(parseAmount('1,25,000')).toBe(125000)
    expect(parseAmount('₹ 5000.50')).toBe(5000.5)
    expect(parseAmount('')).toBeNaN()
  })
})
