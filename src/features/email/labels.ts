export const TEMPLATE_LABEL: Record<string, string> = {
  welcome: 'Welcome / set password',
  service_request_submitted: 'Service request submitted',
  service_request_decided: 'Service request decision',
  starter_pack_submitted: 'Starter pack submitted',
  starter_pack_fulfilled: 'Starter pack fulfilled',
  leave_applied: 'Leave applied',
  leave_decided: 'Leave decision',
}
export const templateLabel = (t: string) => TEMPLATE_LABEL[t] ?? t

export type EmailStatus = 'pending' | 'sent' | 'failed' | 'skipped'
export const STATUS_TONE = {
  pending: 'warn',
  sent: 'ok',
  failed: 'danger',
  skipped: 'muted',
} as const

/** Emails that failed (or never finished) can be retried; the welcome link is deliberately not stored, so it can't. */
export const canRetry = (e: { status: string; template: string; to: string }) =>
  (e.status === 'failed' || e.status === 'pending') &&
  e.template !== 'welcome' &&
  e.to.includes('@')

export const parseEmails = (text: string): { emails: string[]; invalid: string[] } => {
  const parts = text
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const valid = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)
  return { emails: [...new Set(parts.filter(valid))], invalid: parts.filter((s) => !valid(s)) }
}
