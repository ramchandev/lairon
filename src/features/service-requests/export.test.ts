import { batchesToRows, CSV_HEADER } from './export'
import type { Batch, Service } from './api'

const svc = (n: number): Service => ({
  id: `s${n}`,
  batch_id: 'b',
  request_date: '2026-10-18',
  doctor_id: null,
  doctor_name: `Dr ${n}`,
  area: 'Adyar',
  hospital_name: 'Apollo',
  pharmacy_name: null,
  hq: 'CHN',
  division: 'OL',
  qualification: 'MD',
  speciality: 'Cardiologist',
  service_amount: 5000 * n,
  service_type: 'Camp',
  expected_business_value: 100000,
  current_business_value: 50000,
  offer_type: 'Offer',
  offer_percent: 10,
  netrate_amount: null,
})
const batch: Batch = {
  id: 'b',
  ref_no: 'SR-2610-0001',
  manager_id: 'm',
  manager_name: 'Mgr',
  accountability_staff_id: 's',
  accountability_staff_name: 'Staff',
  status: 'approved',
  submitted_at: '2026-10-18T05:00:00Z',
  decided_at: null,
  admin_note: null,
  created_at: '2026-10-18T05:00:00Z',
  services: [svc(1), svc(2)],
}

describe('service request CSV rows', () => {
  it('emits one row per line item with batch details repeated', () => {
    const rows = batchesToRows([batch])
    expect(rows).toHaveLength(2)
    expect(rows[0].length).toBe(CSV_HEADER.length)
    expect(rows[1][0]).toBe('SR-2610-0001')
    expect(rows[1][6]).toBe('Dr 2')
    expect(rows[1][14]).toBe(10000)
    expect(rows[0][1]).toBe('Approved')
  })
  it('skips batches without services', () => {
    expect(batchesToRows([{ ...batch, services: [] }])).toEqual([])
  })
})
