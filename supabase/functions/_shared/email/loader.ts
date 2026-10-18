import { admin } from '../clients.ts'
import { resolveAdmins, type BatchRec, type LeaveRow, type PackRec } from './recipients.ts'
import type { Loader } from './plan-event.ts'

const oneEmail = async (id: string | null): Promise<string | null> => {
  if (!id) return null
  const { data } = await admin.from('profiles').select('email').eq('id', id).maybeSingle()
  return (data?.email as string | null) ?? null
}

/** Loads records with the service role (the webhook runs outside any user session). */
export const dbLoader: Loader = {
  async batch(id) {
    const { data, error } = await admin.from('service_request_batches').select('*, services:service_requests(*)').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return data as (BatchRec & { accountability_staff_id: string | null; manager_id: string | null }) | null
  },
  async pack(id) {
    const { data, error } = await admin.from('starter_pack_requests').select('*, items:starter_pack_items(*)').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return data as (PackRec & { staff_id: string | null }) | null
  },
  async leaveRows(ids) {
    const { data, error } = await admin.from('driver_day_entries').select('id, driver_id, driver_name, entry_date, leave_type, leave_reason, decision_note').in('id', ids)
    if (error) throw new Error(error.message)
    return (data ?? []) as (LeaveRow & { driver_id: string | null })[]
  },
  email: oneEmail,
  async admins() {
    const [{ data: setting }, { data: active }] = await Promise.all([
      admin.from('app_settings').select('value').eq('key', 'notify_emails').maybeSingle(),
      admin.from('profiles').select('email').eq('role', 'admin').eq('is_active', true),
    ])
    return resolveAdmins(setting?.value, (active ?? []).map((a) => a.email))
  },
}
