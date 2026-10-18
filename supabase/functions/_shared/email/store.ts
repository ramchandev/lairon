import { admin } from '../clients.ts'
import type { LogRow, LogStore } from './send.ts'

/** email_log in Postgres, via the service role. */
export const dbStore: LogStore = {
  async alreadySent(key) {
    const { data } = await admin.from('email_log').select('id').eq('dedupe_key', key).eq('status', 'sent').limit(1)
    return !!data?.length
  },
  async insert(row) {
    const { data, error } = await admin.from('email_log').insert(row).select('id').single()
    if (error) throw new Error(`email_log: ${error.message}`)
    return data.id as string
  },
  async update(id, patch) {
    const { error } = await admin.from('email_log').update(patch).eq('id', id)
    // A concurrent duplicate that already SENT the same notification: mark this one skipped instead of failing.
    if (error?.code === '23505') await admin.from('email_log').update({ status: 'skipped', error: 'Already sent' }).eq('id', id)
    else if (error) throw new Error(`email_log: ${error.message}`)
  },
  async get(id) {
    const { data } = await admin.from('email_log').select('*').eq('id', id).maybeSingle()
    return (data as LogRow | null) ?? null
  },
}
