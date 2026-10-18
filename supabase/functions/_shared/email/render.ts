// react and react-dom must be the same version (React throws otherwise), so pin both here.
import 'npm:react-dom@19.1.0'
import { render } from 'npm:@react-email/components@1.0.10'
import { TEMPLATES } from './templates.tsx'
import type { Template, TemplateData } from './types.ts'

export interface Rendered { subject: string; html: string; text: string }

/** HTML for mail clients plus a plain-text fallback (some clients and spam filters want one). */
export async function renderEmail<T extends Template>(template: T, data: TemplateData[T]): Promise<Rendered> {
  const def = TEMPLATES[template] as unknown as { subject: (d: TemplateData[T]) => string; element: (d: TemplateData[T]) => Parameters<typeof render>[0] }
  if (!def) throw new Error(`Unknown email template: ${template}`)
  const el = def.element(data)
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })])
  return { subject: def.subject(data), html, text }
}
