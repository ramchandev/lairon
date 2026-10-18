import type { Mailer } from './send.ts'

/** Resend over plain fetch. Reads RESEND_API_KEY / EMAIL_FROM at call time. */
export const resendMailer: Mailer = {
  async send(m) {
    const key = Deno.env.get('RESEND_API_KEY')
    if (!key) return { ok: false, error: 'RESEND_API_KEY is not set' }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(m.idempotencyKey ? { 'Idempotency-Key': m.idempotencyKey.slice(0, 250) } : {}) },
        body: JSON.stringify({ from: Deno.env.get('EMAIL_FROM') ?? 'LAIRON EZ <noreply@lairon.in>', to: [m.to], subject: m.subject, html: m.html, text: m.text }),
      })
      const body = await res.json().catch(() => ({}))
      return res.ok ? { ok: true, id: body.id } : { ok: false, error: `Resend ${res.status}: ${body.message ?? JSON.stringify(body)}` }
    } catch (e) {
      return { ok: false, error: `Could not reach Resend: ${e instanceof Error ? e.message : e}` }
    }
  },
}
