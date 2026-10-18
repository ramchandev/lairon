export type BatchStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'fulfilled'
export const STATUS_TONE = {
  draft: 'muted',
  submitted: 'info',
  approved: 'ok',
  rejected: 'danger',
  fulfilled: 'teal',
} as const
export const STATUS_LABEL: Record<BatchStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  fulfilled: 'Fulfilled',
}
