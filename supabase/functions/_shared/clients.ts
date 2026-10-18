import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

/** Service-role client. Server only — bypasses RLS. */
export const admin: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Returns the calling admin's id, or null if the caller is not an active admin. */
export async function requireAdmin(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data } = await userClient.auth.getUser()
  if (!data.user) return null
  const { data: p } = await admin.from('profiles').select('role,is_active').eq('id', data.user.id).maybeSingle()
  return p?.role === 'admin' && p.is_active ? data.user.id : null
}
