import { renderEmail } from './render.ts'
import type { Planned, Template, TemplateData } from './types.ts'

export type LogStatus = 'pending' | 'sent' | 'failed' | 'skipped'
export interface LogRow {
  id: string; to: string; template: string; subject: string | null; status: LogStatus; error: string | null; payload: unknown
  attempts: number; dedupe_key: string | null; entity: string | null; entity_id: string | null
}
export interface LogStore {
  /** True when this notification was already SENT to this person. */
  alreadySent(dedupeKey: string): Promise<boolean>
  insert(row: Partial<LogRow>): Promise<string>
  update(id: string, patch: Partial<LogRow> & { sent_at?: string; provider_id?: string }): Promise<void>
  get(id: string): Promise<LogRow | null>
}
export interface Message { to: string; subject: string; html: string; text: string; idempotencyKey?: string }
export interface Mailer { send(m: Message): Promise<{ ok: boolean; id?: string; error?: string }> }
export interface Deps { store: LogStore; mailer: Mailer }
export interface Outcome { status: 'sent' | 'failed' | 'skipped'; logId?: string; error?: string }

/** The welcome email carries a one-time sign-in link, so that link is never written to the log. */
const SENSITIVE: Template[] = ['welcome']
const REDACTED = '[link not stored — use “Resend invite” on the Users page]'
const redact = (template: string, data: unknown) => (SENSITIVE.includes(template as Template) ? { ...(data as object), link: REDACTED } : data)

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Render, send and log one email. Never throws: a failure is recorded in email_log and returned. */
export async function deliver(deps: Deps, p: Planned): Promise<Outcome> {
  const { store, mailer } = deps
  try {
    if (await store.alreadySent(p.dedupeKey)) return { status: 'skipped', error: 'Already sent' }
    const logId = await store.insert({
      to: p.to, template: p.template, status: 'pending', attempts: 0, payload: redact(p.template, p.data) as unknown,
      dedupe_key: p.dedupeKey, entity: p.entity, entity_id: p.entityId,
    })
    let rendered
    try {
      rendered = await renderEmail(p.template, p.data as TemplateData[typeof p.template])
    } catch (e) {
      await store.update(logId, { status: 'failed', error: `Could not render: ${msg(e)}`, attempts: 1 })
      return { status: 'failed', logId, error: msg(e) }
    }
    const r = await mailer.send({ to: p.to, subject: rendered.subject, html: rendered.html, text: rendered.text, idempotencyKey: p.dedupeKey })
    await store.update(logId, r.ok
      ? { status: 'sent', error: null, attempts: 1, subject: rendered.subject, sent_at: new Date().toISOString(), provider_id: r.id }
      : { status: 'failed', error: r.error ?? 'Send failed', attempts: 1, subject: rendered.subject })
    return r.ok ? { status: 'sent', logId } : { status: 'failed', logId, error: r.error }
  } catch (e) {
    return { status: 'failed', error: msg(e) }
  }
}

/** Admin "Retry" on a failed email: re-render from the stored data and send again. */
export async function retry(deps: Deps, logId: string): Promise<Outcome> {
  const { store, mailer } = deps
  const row = await store.get(logId)
  if (!row) return { status: 'failed', error: 'Email not found' }
  if (row.status === 'sent') return { status: 'skipped', logId, error: 'This email was already sent' }
  if (SENSITIVE.includes(row.template as Template)) return { status: 'failed', logId, error: 'Welcome links expire and aren’t stored. Use “Resend invite” on the Users page.' }
  if (!row.payload || !row.to.includes('@')) return { status: 'failed', logId, error: 'Nothing to retry for this entry' }
  try {
    const rendered = await renderEmail(row.template as Template, row.payload as TemplateData[Template])
    const r = await mailer.send({ to: row.to, subject: rendered.subject, html: rendered.html, text: rendered.text, idempotencyKey: `${row.dedupe_key ?? row.id}:try${row.attempts + 1}` })
    await store.update(logId, r.ok
      ? { status: 'sent', error: null, attempts: row.attempts + 1, subject: rendered.subject, sent_at: new Date().toISOString(), provider_id: r.id }
      : { status: 'failed', error: r.error ?? 'Send failed', attempts: row.attempts + 1, subject: rendered.subject })
    return r.ok ? { status: 'sent', logId } : { status: 'failed', logId, error: r.error }
  } catch (e) {
    await store.update(logId, { status: 'failed', error: msg(e), attempts: row.attempts + 1 })
    return { status: 'failed', logId, error: msg(e) }
  }
}

/** Record why nothing was sent (no recipients, or a problem loading the record), so the Admin screen can show it. */
export async function logProblem(deps: Deps, o: { template: string; status: 'skipped' | 'failed'; error: string; entityId?: string }) {
  try {
    await deps.store.insert({ to: '(none)', template: o.template, status: o.status, error: o.error, attempts: 0, entity_id: o.entityId ?? null })
  } catch { /* logging must never throw */ }
}
