import {
  planLeaveApplied, planLeaveDecided, planServiceRequestDecided, planServiceRequestSubmitted, planStarterPackFulfilled, planStarterPackSubmitted,
  type BatchRec, type LeaveRow, type PackRec,
} from './recipients.ts'
import type { Planned } from './types.ts'

/** What the webhook body from the database looks like (see emit_notification in migration 11). */
export interface NotifyBody { event?: string; id?: string; ids?: string[]; status?: string }

/** Everything `notify` needs from the database, so the planning logic can be tested without one. */
export interface Loader {
  batch(id: string): Promise<(BatchRec & { accountability_staff_id: string | null; manager_id: string | null }) | null>
  pack(id: string): Promise<(PackRec & { staff_id: string | null }) | null>
  leaveRows(ids: string[]): Promise<(LeaveRow & { driver_id: string | null })[]>
  email(profileId: string | null): Promise<string | null>
  admins(): Promise<string[]>
}

const need = <T>(v: T | null | undefined, what: string): T => {
  if (v === null || v === undefined) throw new Error(`${what} not found`)
  return v
}

/** Turn a database event into the list of emails to send. Throws when the record can't be found. */
export async function planEvent(body: NotifyBody, loader: Loader, appUrl: string): Promise<Planned[]> {
  const ctx = async () => ({ appUrl, admins: await loader.admins() })
  switch (body.event) {
    case 'service_request.submitted': {
      const b = need(await loader.batch(need(body.id, 'id')), 'Service request')
      return planServiceRequestSubmitted(b, await ctx(), await loader.email(b.accountability_staff_id))
    }
    case 'service_request.decided': {
      const status = body.status
      if (status !== 'approved' && status !== 'rejected' && status !== 'fulfilled') throw new Error(`Unexpected status: ${status}`)
      const b = need(await loader.batch(need(body.id, 'id')), 'Service request')
      return planServiceRequestDecided(b, status, await ctx(), await loader.email(b.manager_id), await loader.email(b.accountability_staff_id))
    }
    case 'starter_pack.submitted':
      return planStarterPackSubmitted(need(await loader.pack(need(body.id, 'id')), 'Starter pack'), await ctx())
    case 'starter_pack.fulfilled': {
      const p = need(await loader.pack(need(body.id, 'id')), 'Starter pack')
      return planStarterPackFulfilled(p, await ctx(), await loader.email(p.staff_id))
    }
    case 'leave.applied': {
      const rows = await loader.leaveRows(need(body.ids, 'ids'))
      return planLeaveApplied(need(rows.length ? rows : null, 'Leave request'), await ctx())
    }
    case 'leave.decided': {
      const status = body.status
      if (status !== 'approved' && status !== 'rejected') throw new Error(`Unexpected status: ${status}`)
      const rows = need((await loader.leaveRows(need(body.ids, 'ids'))) as (LeaveRow & { driver_id: string | null })[] | null, 'Leave request')
      if (!rows.length) throw new Error('Leave request not found')
      return planLeaveDecided(rows, status, await ctx(), await loader.email(rows[0].driver_id))
    }
    default:
      throw new Error(`Unknown event: ${body.event}`)
  }
}
