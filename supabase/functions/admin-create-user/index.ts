// Admin creates a user: auth user + profile (+ invite email for admin/staff/driver).
import { admin, requireAdmin } from '../_shared/clients.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { managerEmail, normalizePhone } from '../_shared/phone.ts'
import { deps } from '../_shared/email/deps.ts'
import { deliver } from '../_shared/email/send.ts'

const ROLES = ['admin', 'staff', 'driver', 'manager'] as const
type Role = (typeof ROLES)[number]
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)

  const adminId = await requireAdmin(req)
  if (!adminId) return json(req, { error: 'Admins only' }, 403)

  const b = await req.json().catch(() => ({}))
  const role = b.role as Role
  if (!ROLES.includes(role)) return json(req, { error: 'Invalid role' }, 400)
  const fullName = text(b.full_name)
  const phone = normalizePhone(b.phone)
  const email = text(b.email)?.toLowerCase() ?? null
  if (!fullName) return json(req, { error: 'Name is required' }, 400)
  if (!phone) return json(req, { error: 'Enter a valid 10-digit mobile number' }, 400)
  if (role !== 'manager' && (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    return json(req, { error: 'A valid email is required' }, 400)
  }

  const { data: dupe } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle()
  if (dupe) return json(req, { error: 'A user with this phone number already exists' }, 409)

  const appUrl = (Deno.env.get('APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '')
  let userId: string
  let actionLink: string | null = null

  if (role === 'manager') {
    // Phone-only managers get a synthetic email; no password, no invite.
    const { data, error } = await admin.auth.admin.createUser({
      email: managerEmail(phone), email_confirm: true, user_metadata: { full_name: fullName },
    })
    if (error || !data.user) return json(req, { error: error?.message ?? 'Could not create user' }, 400)
    userId = data.user.id
  } else {
    // generateLink('invite') creates the auth user and returns the set-password link.
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'invite', email: email!, options: { redirectTo: `${appUrl}/set-password`, data: { full_name: fullName } },
    })
    if (error || !data.user) return json(req, { error: error?.message ?? 'Could not create user' }, 400)
    userId = data.user.id
    actionLink = data.properties.action_link
  }

  const { error: pErr } = await admin.from('profiles').insert({
    id: userId, role, full_name: fullName, phone, email,
    area: text(b.area), hq: text(b.hq), bio: text(b.bio), avatar_url: text(b.avatar_url),
  })
  if (pErr) {
    await admin.auth.admin.deleteUser(userId) // roll back so the email/phone can be reused
    return json(req, { error: pErr.message }, 400)
  }

  let emailSent = false
  let emailError: string | undefined
  if (actionLink && email) {
    const r = await deliver(deps, {
      template: 'welcome', to: email, data: { name: fullName, link: actionLink }, dedupeKey: `welcome:${crypto.randomUUID()}`, entity: 'user', entityId: userId,
    })
    emailSent = r.status === 'sent'
    emailError = r.error
  }
  // If email could not be sent, hand the link back to the admin so they can share it themselves.
  return json(req, { id: userId, email_sent: emailSent, email_error: emailError, invite_link: emailSent ? null : actionLink })
})
