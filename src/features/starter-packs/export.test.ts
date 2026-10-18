import { packsToRows, PACK_CSV_HEADER } from './export'
import type { Pack } from './api'

const pack: Pack = {
  id: 'p',
  ref_no: 'SP-2610-0001',
  request_date: '2026-10-18',
  doctor_id: null,
  doctor_name: 'Dr A',
  qualification: 'MD',
  doctor_area: 'Adyar',
  staff_id: 's',
  staff_name: 'Staff One',
  staff_area: 'Adyar',
  division: 'OL',
  status: 'processing',
  fulfilled_at: null,
  admin_note: null,
  created_at: '2026-10-18T05:00:00Z',
  items: [
    {
      id: '1',
      request_id: 'p',
      product_id: null,
      product_name: 'Lairobon',
      quantity: '1 box',
      sort_order: 0,
    },
    {
      id: '2',
      request_id: 'p',
      product_id: null,
      product_name: 'Other',
      quantity: '10 strips',
      sort_order: 1,
    },
  ],
}

describe('starter pack CSV rows', () => {
  it('has one row per product matching the header', () => {
    const rows = packsToRows([pack])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveLength(PACK_CSV_HEADER.length)
    expect(rows[1].slice(-2)).toEqual(['Other', '10 strips'])
    expect(rows[0][8]).toBe('Processing')
  })
})
