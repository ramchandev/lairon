import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Ban } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { usePack, useSetPackStatus } from '../api'
import { PackSummary } from '../components/PackSummary'

/** Staff view of one of their own requests; they can cancel it while it is still Submitted. */
export function PackDetailPage() {
  const { id } = useParams()
  const toast = useToast()
  const { data: p, isLoading } = usePack(id)
  const setStatus = useSetPackStatus()
  const [confirm, setConfirm] = useState(false)
  if (isLoading) return <p className="text-muted">Loading…</p>
  if (!p) return <p className="glass p-5">Request not found.</p>
  return (
    <div>
      <PackSummary pack={p} />
      {p.status === 'submitted' && (
        <button className="btn btn-soft-danger mt-3.5 w-full" onClick={() => setConfirm(true)}>
          <Ban aria-hidden /> Cancel this request
        </button>
      )}
      <ConfirmDialog
        open={confirm}
        title="Cancel this request?"
        confirmLabel="Cancel request"
        busy={setStatus.isPending}
        description="It will be marked cancelled and won’t be processed. You can raise a new one any time."
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          setStatus.mutate(
            { id: p.id, status: 'cancelled' },
            {
              onSuccess: () => {
                toast('Request cancelled')
                setConfirm(false)
              },
              onError: (e) => {
                setConfirm(false)
                toast(e.message, 'error')
              },
            },
          )
        }
      />
    </div>
  )
}
