// Doctor's Manager sign-in by phone number (PLAN §3.2).
//   MANAGER_AUTH_MODE=phone_only -> returns a one-time token_hash; client calls verifyOtp({token_hash, type:'magiclink'})
//   MANAGER_AUTH_MODE=otp        -> verifies the number is a registered manager, then the client calls
//                                   supabase.auth.signInWithOtp({phone}) (SMS via Send SMS Hook -> MSG91)
// phone_only means anyone who knows a manager's number can sign in as them. Prefer otp before go-live.
import { admin } from '../_shared/clients.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { normalizePhone } from '../_shared/phone.ts'

const MAX_ATTEMPTS = 5
const WINDOW_MIN = 15
const GENERIC = 'We could not sign you in with this number. Check it, or ask your admin.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)

  const body = await req.json().catch(() => ({}))
  const phone = normalizePhone(body.phone)
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (!phone) return json(req, { error: 'Enter a valid 10-digit mobile number' }, 400)

  // Rate limit: max 5 attempts / 15 min per phone and per IP.
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString()
  const [byPhone, byIp] = await Promise.all([
    admin.from('login_attempts').select('id', { count: 'exact', head: true }).eq('phone', phone).gte('created_at', since),
    admin.from('login_attempts').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', since),
  ])
  if ((byPhone.count ?? 0) >= MAX_ATTEMPTS || (byIp.count ?? 0) >= MAX_ATTEMPTS * 3) {
    return json(req, { error: `Too many attempts. Try again in ${WINDOW_MIN} minutes.` }, 429)
  }
  await admin.from('login_attempts').insert({ phone, ip })

  // Admin pre-registers managers. Unknown / inactive numbers get the same generic message.
  const { data: profile } = await admin.from('profiles').select('id,is_active')
    .eq('phone', phone).eq('role', 'manager').maybeSingle()
  if (!profile || !profile.is_active) return json(req, { error: GENERIC }, 401)

  const mode = Deno.env.get('MANAGER_AUTH_MODE') ?? 'phone_only'
  if (mode === 'otp') return json(req, { mode: 'otp', phone })

  // Use the auth user's own email (set at creation), so an admin editing the profile phone never breaks login.
  const { data: authUser } = await admin.auth.admin.getUserById(profile.id)
  const authEmail = authUser.user?.email
  if (!authEmail) return json(req, { error: GENERIC }, 401)
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: authEmail })
  if (error || !data.properties?.hashed_token) return json(req, { error: GENERIC }, 401)
  return json(req, { mode: 'phone_only', token_hash: data.properties.hashed_token })
})
