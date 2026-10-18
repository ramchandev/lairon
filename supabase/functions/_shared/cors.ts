// Browser origins allowed to call these functions: APP_URL (also used in email links) plus any comma-separated
// EXTRA_ORIGINS (e.g. the *.vercel.app address alongside the custom domain). Localhost is always allowed for development.
const clean = (u: string) => u.trim().replace(/\/$/, '')
const allowed = clean(Deno.env.get('APP_URL') ?? 'http://localhost:5173')
const others = (Deno.env.get('EXTRA_ORIGINS') ?? '').split(',').map(clean).filter(Boolean)

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const ok = origin === allowed || others.includes(origin) || origin.startsWith('http://localhost:')
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}
