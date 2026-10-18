import { StatusBadge } from '@/components/StatusBadge'
import { PACK_LABEL, PACK_TONE, type PackStatus } from '../status'

export const PackBadge = ({ status }: { status: PackStatus }) => (
  <StatusBadge tone={PACK_TONE[status]}>{PACK_LABEL[status]}</StatusBadge>
)
