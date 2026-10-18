// @vitest-environment node
import { renderToBuffer } from '@react-pdf/renderer'
import { StarterPackPdf } from './StarterPackPdf'
import type { Pack } from '@/features/starter-packs/api'

const mk = (n: number): Pack => ({
  id: `p${n}`,
  ref_no: `SP-2610-000${n}`,
  request_date: '2026-10-18',
  doctor_id: null,
  doctor_name: `Dr ${n}`,
  qualification: 'MD',
  doctor_area: 'Adyar',
  staff_id: 's',
  staff_name: 'Staff One',
  staff_area: 'Adyar',
  division: 'OL',
  status: 'submitted',
  fulfilled_at: null,
  admin_note: null,
  created_at: '2026-10-18T05:00:00Z',
  items: Array.from({ length: 30 }, (_, i) => ({
    id: `${n}-${i}`,
    request_id: `p${n}`,
    product_id: null,
    product_name: `Product ${i}`,
    quantity: '1 box',
    sort_order: i,
  })),
})

describe('StarterPackPdf', () => {
  it('accepts a custom company name', async () => {
    const buf = await renderToBuffer(<StarterPackPdf packs={[mk(1)]} company="LAIRON Pharma" />)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('renders single and bulk PDFs (bulk has at least one page per request)', async () => {
    const one = await renderToBuffer(<StarterPackPdf packs={[mk(1)]} />)
    const many = await renderToBuffer(<StarterPackPdf packs={[mk(1), mk(2), mk(3)]} />)
    expect(one.subarray(0, 5).toString()).toBe('%PDF-')
    expect(many.length).toBeGreaterThan(one.length)
  })
})
