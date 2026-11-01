import { useEffect } from 'react'
import { ManagerPickDialog } from '@/components/ManagerPickDialog'
import { useToast } from '@/components/Toast'
import { useManagerWorkload, useTransferWork } from './handover'
import type { UserRow } from './api'

/**
 * Hand over everything a manager holds (doctors + requests) to another manager — used from the Managers list, and offered
 * first when deactivating a manager so their requests keep being followed up (monthly revenue) by someone else.
 */
export function HandoverFlow({
  user,
  thenDeactivate,
  onClose,
  onDeactivate,
}: {
  user: UserRow
  thenDeactivate: boolean
  onClose: () => void
  onDeactivate: (u: UserRow) => void
}) {
  const toast = useToast()
  const w = useManagerWorkload(user.id)
  const transfer = useTransferWork()
  const none = !!w.data && w.data.doctors + w.data.requests + w.data.drafts === 0

  // Nothing to hand over: deactivating goes straight to the normal confirmation; a plain hand-over just says so.
  useEffect(() => {
    if (!none) return
    if (thenDeactivate) onDeactivate(user)
    else {
      toast(`${user.full_name} has no doctors or requests to hand over`)
      onClose()
    }
  }, [none, thenDeactivate, onDeactivate, onClose, toast, user])

  if (!w.data || none) return null
  const d = w.data
  return (
    <ManagerPickDialog
      title={
        thenDeactivate
          ? `Hand over ${user.full_name}’s work first?`
          : `Hand over ${user.full_name}’s work`
      }
      excludeId={user.id}
      confirmLabel={thenDeactivate ? 'Hand over, then deactivate' : 'Hand over'}
      busy={transfer.isPending}
      intro={
        <>
          <b>{user.full_name}</b> currently holds <b>{d.doctors}</b> doctor
          {d.doctors === 1 ? '' : 's'} and <b>{d.requests}</b> request{d.requests === 1 ? '' : 's'}{' '}
          ({d.open_requests} open
          {d.drafts ? `, ${d.drafts} draft` : ''}). The new manager takes them over, sees the whole
          history and continues the monthly revenue.
        </>
      }
      secondary={
        thenDeactivate
          ? { label: 'Deactivate without handing over', onClick: () => onDeactivate(user) }
          : undefined
      }
      onCancel={onClose}
      onConfirm={(toId, note) =>
        transfer.mutate(
          { fromId: user.id, toId, note },
          {
            onSuccess: (r) => {
              toast(
                `Handed over ${r.requests} request${r.requests === 1 ? '' : 's'} and ${r.doctors} doctor${r.doctors === 1 ? '' : 's'}${r.drafts_left ? ` (${r.drafts_left} draft left)` : ''}`,
              )
              if (thenDeactivate) onDeactivate(user)
              else onClose()
            },
            onError: (e) => toast(e.message, 'error'),
          },
        )
      }
    />
  )
}
