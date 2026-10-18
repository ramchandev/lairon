// Admin actions on a user: deactivate | reactivate | force_logout | resend_invite
import { admin, requireAdmin } from '../_shared/clients.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { deps } from '../_shared/email/deps.ts'
import { deliver } from '../_shared/email/send.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  const adminId = await requireAdmin(req)
  if (!adminId) return json(req, { error: 'Admins only' }, 403)

  const { action, user_id: userId } = await req.json().catch(() => ({}))
  if (typeof userId !== 'string') return json(req, { error: 'user_id is required' }, 400)
  if (userId === adminId && (action === 'deactivate' || action === 'force_logout')) {
    return json(req, { error: 'You cannot do this to your own account' }, 400)
  }
  const { data: profile } = await admin.from('profiles').select('full_name,email,role').eq('id', userId).maybeSingle()
  if (!profile) return json(req, { error: 'User not found' }, 404)

  switch (action) {
    case 'deactivate': {
      await admin.from('profiles').update({ is_active: false }).eq('id', userId)
      await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
      await admin.rpc('admin_force_logout', { p_user: userId })
      return json(req, { ok: true })
    }
    case 'reactivate': {
      await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
      await admin.from('profiles').update({ is_active: true }).eq('id', userId)
      return json(req, { ok: true })
    }
    case 'force_logout': {
      const { error } = await admin.rpc('admin_force_logout', { p_user: userId })
      return error ? json(req, { error: error.message }, 400) : json(req, { ok: true })
    }
    case 'resend_invite': {
      if (!profile.email || profile.role === 'manager') return json(req, { error: 'This user signs in without a password' }, 400)
      const appUrl = (Deno.env.get('APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '')
      // User already exists, so use a recovery link as the "set your password" link.
      const { data, error } = await admin.auth.admin.generateLink({
        type: 'recovery', email: profile.email, options: { redirectTo: `${appUrl}/set-password` },
      })
      if (error) return json(req, { error: error.message }, 400)
      const link = data.properties.action_link
      const r = await deliver(deps, {
        template: 'welcome', to: profile.email, data: { name: profile.full_name, link }, dedupeKey: `welcome:${crypto.randomUUID()}`, entity: 'user', entityId: userId,
      })
      return json(req, { ok: true, email_sent: r.status === 'sent', invite_link: r.status === 'sent' ? null : link })
    }
    default:
      return json(req, { error: 'Unknown action' }, 400)
  }
})
