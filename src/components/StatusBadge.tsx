import { cn } from '@/lib/utils'

const TONES = {
  ok: 'b-ok',
  info: 'b-info',
  warn: 'b-warn',
  danger: 'b-danger',
  teal: 'b-teal',
  muted: 'b-muted',
} as const

export function StatusBadge({
  tone = 'muted',
  children,
}: {
  tone?: keyof typeof TONES
  children: React.ReactNode
}) {
  return <span className={cn('badge', TONES[tone])}>{children}</span>
}
export const ActiveBadge = ({ active }: { active: boolean }) => (
  <StatusBadge tone={active ? 'ok' : 'muted'}>{active ? 'Active' : 'Inactive'}</StatusBadge>
)
