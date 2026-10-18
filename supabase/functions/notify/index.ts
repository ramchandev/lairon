// Database webhook receiver (PLAN §7). Called by Postgres (pg_net) when a request is submitted/decided, a starter pack is
// raised/fulfilled, or leave is applied/decided. Loads the record with the service role, renders the React Email template,
// sends via Resend, and records every attempt in email_log. It never makes the user's action fail.
import { json } from '../_shared/cors.ts'
import { deps } from '../_shared/email/deps.ts'
import { dbLoader } from '../_shared/email/loader.ts'
import { planEvent, type NotifyBody } from '../_shared/email/plan-event.ts'
import { deliver, logProblem } from '../_shared/email/send.ts'

/** Constant-time string comparison for the shared secret. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)
  const expected = Deno.env.get('NOTIFY_WEBHOOK_SECRET')
  const given = req.headers.get('x-webhook-secret') ?? ''
  if (!expected || !same(given, expected)) return json(req, { error: 'Unauthorized' }, 401)

  const body = (await req.json().catch(() => ({}))) as NotifyBody
  const event = body.event ?? 'unknown'
  try {
    const planned = await planEvent(
      body,
      dbLoader,
      Deno.env.get('APP_URL') ?? 'http://localhost:5173',
    )
    if (planned.length === 0) {
      await logProblem(deps, {
        template: event,
        status: 'skipped',
        error:
          'No recipients for this event (check Settings → notification emails, and the person’s email)',
        entityId: body.id ?? body.ids?.[0],
      })
      return json(req, { ok: true, sent: 0, note: 'no recipients' })
    }
    const results = []
    for (const p of planned) results.push(await deliver(deps, p)) // sequential: stays well inside Resend's rate limit
    return json(req, {
      ok: true,
      sent: results.filter((r) => r.status === 'sent').length,
      failed: results.filter((r) => r.status === 'failed').length,
    })
  } catch (e) {
    await logProblem(deps, {
      template: event,
      status: 'failed',
      error: e instanceof Error ? e.message : String(e),
      entityId: body.id ?? body.ids?.[0],
    })
    return json(req, { ok: false, error: 'Could not prepare the notification (logged)' }) // 200 on purpose: pg_net does not retry
  }
})
