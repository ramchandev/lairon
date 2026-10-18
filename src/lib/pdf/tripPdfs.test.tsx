// @vitest-environment node
import { renderToBuffer } from '@react-pdf/renderer'
import { BetaPdf } from './BetaPdf'
import { DriverMonthPdf } from './DriverMonthPdf'
import type { DayEntry } from '@/features/trip-duty/logic'

const duty = (n: number): DayEntry => ({
  id: String(n),
  driver_id: 'd',
  driver_name: 'RAVIKUMAR.N',
  entry_date: `2026-10-${String(n).padStart(2, '0')}`,
  entry_type: 'duty',
  duty_type: n % 4 ? 'Local' : 'Out Station',
  vehicle_source: 'fleet',
  vehicle_id: 'v',
  vehicle_label: 'AMAZE 6960',
  guest_name: 'Dr J',
  guest_area: 'Adyar',
  pickup_point: 'Airport',
  drop_point: 'Hotel',
  start_km: 100,
  start_time: '09:00',
  end_km: 193,
  end_time: '18:30',
  total_km: 93,
  total_minutes: 570,
  fuel_litres: 10,
  fuel_amount: 1000,
  duty_status: 'closed',
  leave_type: null,
  leave_reason: null,
  leave_status: null,
  entry_source: 'app',
  created_at: '',
  decision_note: null,
})

describe('trip PDFs', () => {
  it('renders the driver monthly duty sheet over several pages', async () => {
    const entries = Array.from({ length: 28 }, (_, i) => duty(i + 1))
    const buf = await renderToBuffer(
      <DriverMonthPdf
        driverName="RAVIKUMAR.N"
        month="2026-10"
        entries={entries}
        stats={{
          dutyDays: 28,
          duties: 28,
          weekOffs: 0,
          leaveDays: 0,
          km: 2604,
          fuelLitres: 280,
          fuelAmount: 28000,
        }}
        beta={{ total: 7600, local: 21, outstation: 7 }}
      />,
    )
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })
  it('renders the beta summary', async () => {
    const buf = await renderToBuffer(
      <BetaPdf
        month="2026-10"
        finalised
        rates={{ local: 250, outstation: 300 }}
        rows={[
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
        ]}
      />,
    )
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(1500)
  })
})
