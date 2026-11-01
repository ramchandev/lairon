// Admin actions on a user: deactivate | reactivate | force_logout | resend_invite | set_password | set_email (everyone except Super Admins)
import { admin, requireAdmin } from '../_shared/clients.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { deps } from '../_shared/email/deps.ts'
import { deliver } from '../_shared/email/send.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  const adminId = await requireAdmin(req)
  if (!adminId) return json(req, { error: 'Admins only' }, 403)

  const { action, user_id: userId, password, email } = await req.json().catch(() => ({}))
  if (typeof userId !== 'string') return json(req, { error: 'user_id is required' }, 400)
  if (userId === adminId && (action === 'deactivate' || action === 'force_logout')) {
    return json(req, { error: 'You cannot do this to your own account' }, 400)
  }
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name,email,role')
    .eq('id', userId)
    .maybeSingle()
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
    case 'set_password': {
      if (profile.role === 'admin')
        return json(req, { error: 'A Super Admin changes their own password (use “Forgot password”)' }, 400)
      if (typeof password !== 'string' || password.length < 8)
        return json(req, { error: 'The password must be at least 8 characters' }, 400)
      const { error } = await admin.auth.admin.updateUserById(userId, { password })
      if (error) return json(req, { error: error.message }, 400)
      await admin.rpc('admin_force_logout', { p_user: userId }) // old sessions end; they sign in with the new password
      return json(req, { ok: true })
    }
    case 'set_email': {
      if (profile.role === 'admin') return json(req, { error: 'A Super Admin’s email can’t be changed here' }, 400)
      const next = typeof email === 'string' ? email.trim().toLowerCase() : ''
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) return json(req, { error: 'Enter a valid email address' }, 400)
      const { data: taken } = await admin.from('profiles').select('id').ilike('email', next).neq('id', userId).maybeSingle()
      if (taken) return json(req, { error: 'Another user already has this email' }, 409)
      const { error } = await admin.auth.admin.updateUserById(userId, { email: next, email_confirm: true })
      if (error) return json(req, { error: error.message }, 400)
      await admin.from('profiles').update({ email: next }).eq('id', userId)
      await admin.rpc('admin_force_logout', { p_user: userId })
      return json(req, { ok: true })
    }
    case 'resend_invite': {
      if (!profile.email || profile.role !== 'admin')
        return json(req, { error: 'Invites are only for Super Admins; set a password for everyone else' }, 400)
      const appUrl = (Deno.env.get('APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '')
      // User already exists, so use a recovery link as the "set your password" link.
      const { data, error } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: profile.email,
        options: { redirectTo: `${appUrl}/set-password` },
      })
      if (error) return json(req, { error: error.message }, 400)
      const link = data.properties.action_link
      const r = await deliver(deps, {
        template: 'welcome',
        to: profile.email,
        data: { name: profile.full_name, link },
        dedupeKey: `welcome:${crypto.randomUUID()}`,
        entity: 'user',
        entityId: userId,
      })
      return json(req, {
        ok: true,
        email_sent: r.status === 'sent',
        invite_link: r.status === 'sent' ? null : link,
      })
    }
    default:
      return json(req, { error: 'Unknown action' }, 400)
  }
})
