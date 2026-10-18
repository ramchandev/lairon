import { resolveVehicle } from './logic'
import type { DutyForm } from './schemas'

const text = (s: string) => s.trim() || null
const int = (s: string) => (s.trim() === '' ? null : Number(s))

/**
 * Form -> database row. Vehicle KM only applies to fleet vehicles. total_km / total_minutes are sent as null on purpose:
 * the database trigger recomputes them (so editing KM or times never leaves stale totals).
 */
export function dutyToRow(
  v: DutyForm,
  vehicles: { id: string; name: string; vehicle_number: string }[],
) {
  const vehicle = resolveVehicle(v.vehicle, v.other_details, vehicles)
  const fleet = vehicle.vehicle_source === 'fleet'
  return {
    entry_type: 'duty' as const,
    entry_date: v.entry_date,
    duty_type: v.duty_type,
    ...vehicle,
    guest_name: text(v.guest_name),
    guest_area: text(v.guest_area),
    pickup_point: text(v.pickup_point),
    drop_point: text(v.drop_point),
    start_km: fleet ? int(v.start_km) : null,
    start_time: v.start_time,
    end_km: v.finished && fleet ? int(v.end_km) : null,
    end_time: v.finished ? v.end_time : null,
    end_date: v.finished ? v.end_date || v.entry_date : null,
    fuel_litres: v.finished ? int(v.fuel_litres) : null,
    fuel_amount: v.finished ? int(v.fuel_amount) : null,
    total_km: null,
    total_minutes: null,
    duty_status: v.finished ? ('closed' as const) : ('open' as const),
    entry_source: 'app' as const,
  }
}
