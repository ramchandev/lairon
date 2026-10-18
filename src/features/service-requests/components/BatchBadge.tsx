import { StatusBadge } from '@/components/StatusBadge'
import { STATUS_LABEL, STATUS_TONE, type BatchStatus } from '../status'

export const BatchBadge = ({ status }: { status: BatchStatus }) => (
  <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusBadge>
)
