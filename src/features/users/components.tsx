import { Phone } from 'lucide-react'
import { formatPhone } from '@/lib/phone'

export { Avatar } from '@/components/Avatar'

export function CallLink({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone}`}
      className="inline-flex items-center gap-1.5 font-semibold tabular text-primary"
    >
      <Phone className="size-4" /> {formatPhone(phone)}
    </a>
  )
}

/** Managers created without an email have a synthetic login address — never show it. */
export const visibleEmail = (e: string | null) =>
  e && !e.endsWith('@managers.lairon.internal') ? e : null
