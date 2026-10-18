// Internal: admin "Retry" from the Email Log screen. Re-renders a failed email from its stored data and sends it again.
import { requireAdmin } from '../_shared/clients.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { deps } from '../_shared/email/deps.ts'
import { retry } from '../_shared/email/send.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)
  if (!(await requireAdmin(req))) return json(req, { error: 'Admins only' }, 403)
  const { log_id: logId } = await req.json().catch(() => ({}))
  if (typeof logId !== 'string') return json(req, { error: 'log_id is required' }, 400)
  return json(req, await retry(deps, logId))
})
