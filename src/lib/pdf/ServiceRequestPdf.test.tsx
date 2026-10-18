// @vitest-environment node
import { renderToBuffer } from '@react-pdf/renderer'
import { ServiceRequestPdf } from './ServiceRequestPdf'
import type { Batch } from '@/features/service-requests/api'

const batch: Batch = {
  id: 'b',
  ref_no: 'SR-2610-0001',
  manager_id: 'm',
  manager_name: 'Mgr One',
  accountability_staff_id: 's',
  accountability_staff_name: 'Staff One',
  status: 'approved',
  submitted_at: '2026-10-18T05:00:00Z',
  decided_at: null,
  admin_note: 'OK to proceed',
  created_at: '2026-10-18T05:00:00Z',
  services: Array.from({ length: 3 }, (_, i) => ({
    id: `s${i}`,
    batch_id: 'b',
    request_date: '2026-10-18',
    doctor_id: null,
    doctor_name: `Dr ${i}`,
    area: 'Adyar',
    hospital_name: 'Apollo',
    pharmacy_name: null,
    hq: 'CHN',
    division: 'OL',
    qualification: 'MD',
    speciality: 'Cardiologist',
    service_amount: 125000,
    service_type: 'Camp',
    expected_business_value: 1000000,
    current_business_value: 500000,
    offer_type: i === 0 ? 'Netrate' : 'Offer',
    offer_percent: 10,
    netrate_amount: 900,
  })),
}

describe('ServiceRequestPdf', () => {
  it('renders a valid PDF', async () => {
    const buf = await renderToBuffer(<ServiceRequestPdf batch={batch} />)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(1500)
  })
})
