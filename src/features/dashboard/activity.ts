export interface ActivityRow {
  id: string
  actor_id: string | null
  entity: string
  entity_id: string | null
  action: string
  diff: { old?: Record<string, unknown>; new?: Record<string, unknown> } | null
  created_at: string
}
export interface FeedItem {
  id: string
  at: string
  text: string
  to?: string
  kind: 'request' | 'pack' | 'leave' | 'duty'
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const VERB: Record<string, string> = {
  approved: 'approved',
  rejected: 'rejected',
  fulfilled: 'marked fulfilled',
  processing: 'started processing',
  cancelled: 'cancelled',
}

/**
 * Turns raw activity_log rows (newest first) into short human sentences. Only meaningful events appear:
 * service request submissions/decisions, starter pack requests/status changes, leave requests/decisions and closed duties.
 * Multi-day leave (one log row per day, written in one statement) collapses into a single line.
 */
export function buildFeed(
  rows: ActivityRow[],
  actors: Record<string, string>,
  limit = 12,
): FeedItem[] {
  const out: FeedItem[] = []
  const merged = new Map<string, { item: FeedItem; days: number; label: (n: number) => string }>()
  const who = (r: ActivityRow) => (r.actor_id ? actors[r.actor_id] : undefined) ?? 'An admin'

  for (const r of rows) {
    const n = r.diff?.new ?? {}
    const o = r.diff?.old ?? {}
    let item: FeedItem | null = null

    if (r.entity === 'service_request_batches' && r.action === 'update' && n.status !== o.status) {
      const ref = str(n.ref_no) || 'a service request'
      const to = `/admin/service-requests/${r.entity_id}`
      if (n.status === 'submitted')
        item = {
          id: r.id,
          at: r.created_at,
          kind: 'request',
          to,
          text: `${str(n.manager_name) || 'A manager'} submitted service request ${ref}`,
        }
      else if (VERB[str(n.status)])
        item = {
          id: r.id,
          at: r.created_at,
          kind: 'request',
          to,
          text: `${who(r)} ${VERB[str(n.status)]} service request ${ref}`,
        }
    } else if (r.entity === 'starter_pack_requests') {
      const to = `/admin/starter-packs/${r.entity_id}`
      if (r.action === 'insert')
        item = {
          id: r.id,
          at: r.created_at,
          kind: 'pack',
          to,
          text: `${str(n.staff_name) || 'Staff'} requested starter pack ${str(n.ref_no)} for ${str(n.doctor_name)}`,
        }
      else if (r.action === 'update' && n.status !== o.status && VERB[str(n.status)])
        item = {
          id: r.id,
          at: r.created_at,
          kind: 'pack',
          to,
          text: `${who(r)} ${VERB[str(n.status)]} starter pack ${str(n.ref_no)}`,
        }
    } else if (r.entity === 'driver_day_entries') {
      const driver = str(n.driver_name) || 'A driver'
      const second = r.created_at.slice(0, 19)
      if (r.action === 'insert' && n.entry_type === 'leave' && n.leave_status === 'pending') {
        const key = `applied|${r.actor_id}|${driver}|${second}`
        const m = merged.get(key)
        if (m) {
          m.days++
          continue
        }
        const label = (days: number) =>
          `${driver} requested ${days === 1 ? 'leave' : `${days} days of leave`}`
        item = {
          id: r.id,
          at: r.created_at,
          kind: 'leave',
          to: '/admin/trip-duty?tab=leave',
          text: label(1),
        }
        merged.set(key, { item, days: 1, label })
      } else if (
        r.action === 'update' &&
        n.entry_type === 'leave' &&
        o.leave_status === 'pending' &&
        (n.leave_status === 'approved' || n.leave_status === 'rejected')
      ) {
        const key = `decided|${n.leave_status}|${r.actor_id}|${driver}|${second}`
        const m = merged.get(key)
        if (m) {
          m.days++
          continue
        }
        const label = (days: number) =>
          `${who(r)} ${n.leave_status} ${days === 1 ? '' : `${days} days of `}leave for ${driver}`.replace(
            '  ',
            ' ',
          )
        item = {
          id: r.id,
          at: r.created_at,
          kind: 'leave',
          to: '/admin/trip-duty?tab=leave',
          text: label(1),
        }
        merged.set(key, { item, days: 1, label })
      } else if (
        r.action === 'update' &&
        n.entry_type === 'duty' &&
        o.duty_status === 'open' &&
        n.duty_status === 'closed'
      ) {
        const km = typeof n.total_km === 'number' ? ` (${n.total_km} km)` : ''
        item = {
          id: r.id,
          at: r.created_at,
          kind: 'duty',
          to: `/admin/trip-duty?tab=month&driver=${str(n.driver_id)}&m=${str(n.entry_date).slice(0, 7)}`,
          text: `${driver} closed a duty${km}`,
        }
      }
    }
    if (item) out.push(item)
  }
  for (const m of merged.values()) m.item.text = m.label(m.days)
  return out.slice(0, limit)
}
