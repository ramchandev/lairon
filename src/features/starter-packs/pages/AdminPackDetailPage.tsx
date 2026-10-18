import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Ban, Download, FileDown, Hourglass, PackageCheck } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { usePack, useSetPackStatus } from '../api'
import { PackSummary } from '../components/PackSummary'
import { exportPacksCsv } from '../export'
import { downloadPacksPdf } from '../pdf'
import type { PackStatus } from '../status'

type Action = 'processing' | 'fulfilled' | 'cancelled'
const COPY: Record<
  Action,
  { title: string; confirm: string; tone: 'primary' | 'danger'; body: string }
> = {
  processing: {
    title: 'Mark as processing?',
    confirm: 'Mark processing',
    tone: 'primary',
    body: 'Staff will see that the pack is being prepared.',
  },
  fulfilled: {
    title: 'Mark as fulfilled?',
    confirm: 'Mark fulfilled',
    tone: 'primary',
    body: 'Use this once the starter pack has been handed over.',
  },
  cancelled: {
    title: 'Cancel this request?',
    confirm: 'Cancel request',
    tone: 'danger',
    body: 'The staff member sees your reason. This can’t be undone.',
  },
}

export function AdminPackDetailPage() {
  const { id } = useParams()
  const toast = useToast()
  const { data: p, isLoading } = usePack(id)
  const setStatus = useSetPackStatus()
  const [action, setAction] = useState<Action | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  if (isLoading) return <p className="text-muted">Loading…</p>
  if (!p) return <p className="glass p-5">Request not found.</p>
  const open = p.status === 'submitted' || p.status === 'processing'

  const run = (note?: string) =>
    action &&
    setStatus.mutate(
      { id: p.id, status: action as PackStatus, note },
      {
        onSuccess: () => {
          toast(`Marked ${action}`)
          setAction(null)
        },
        onError: (e) => {
          setAction(null)
          toast(e.message, 'error')
        },
      },
    )

  async function pdf() {
    setPdfBusy(true)
    try {
      await downloadPacksPdf([p!], p!.ref_no ?? 'starter-pack')
    } catch {
      toast('Could not create the PDF', 'error')
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[824px] pb-28">
      <PackSummary pack={p} />
      <div className="actionbar">
        <button
          className="btn btn-ghost shrink"
          disabled={pdfBusy}
          onClick={pdf}
          aria-label="Download PDF"
        >
          <FileDown aria-hidden />
          <span className="hidden lg:inline">{pdfBusy ? 'Preparing…' : 'Download PDF'}</span>
        </button>
        <button
          className="btn btn-ghost shrink"
          onClick={() => exportPacksCsv([p], p.ref_no ?? 'starter-pack')}
          aria-label="Export CSV"
        >
          <Download aria-hidden />
          <span className="hidden lg:inline">CSV</span>
        </button>
        <span className="spacer" />
        {open && (
          <button className="btn btn-soft-danger" onClick={() => setAction('cancelled')}>
            <Ban aria-hidden /> Cancel
          </button>
        )}
        {p.status === 'submitted' && (
          <button className="btn btn-primary" onClick={() => setAction('processing')}>
            <Hourglass aria-hidden /> Start processing
          </button>
        )}
        {open && (
          <button
            className={p.status === 'submitted' ? 'btn btn-ghost' : 'btn btn-primary'}
            onClick={() => setAction('fulfilled')}
          >
            <PackageCheck aria-hidden /> Mark fulfilled
          </button>
        )}
      </div>
      {action && (
        <ConfirmDialog
          open
          title={COPY[action].title}
          tone={COPY[action].tone}
          confirmLabel={COPY[action].confirm}
          busy={setStatus.isPending}
          reasonLabel={action === 'cancelled' ? 'Reason' : undefined}
          description={COPY[action].body}
          onCancel={() => setAction(null)}
          onConfirm={run}
        />
      )}
    </div>
  )
}
