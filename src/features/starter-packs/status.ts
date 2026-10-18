export type PackStatus = 'submitted' | 'processing' | 'fulfilled' | 'cancelled'
export const PACK_TONE = {
  submitted: 'info',
  processing: 'warn',
  fulfilled: 'ok',
  cancelled: 'muted',
} as const
export const PACK_LABEL: Record<PackStatus, string> = {
  submitted: 'Submitted',
  processing: 'Processing',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
}
