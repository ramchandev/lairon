import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Download, FileDown, PackageCheck, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { useBatch, useDecideBatch } from '../api'
import { RequestBody } from '../components/RequestBody'
import { exportBatchesCsv } from '../export'
import { downloadBatchPdf } from '../pdf'

type Action = 'approve' | 'reject' | 'fulfil'
export function AdminRequestDetailPage() {
  const { id } = useParams()
  const toast = useToast()
  const { data: b, isLoading } = useBatch(id)
  const decide = useDecideBatch()
  const [action, setAction] = useState<Action | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  if (isLoading) return <p className="text-muted">Loading…</p>
  if (!b) return <p className="glass p-5">Request not found.</p>

  const copy = {
    approve: {
      title: 'Approve this request?',
      confirm: 'Approve',
      tone: 'primary' as const,
      body: 'The manager will see it as approved.',
    },
    reject: {
      title: 'Reject this request?',
      confirm: 'Reject',
      tone: 'danger' as const,
      body: 'The manager sees your reason. A rejected request can’t be reopened — they can submit a new one.',
    },
    fulfil: {
      title: 'Mark as fulfilled?',
      confirm: 'Mark fulfilled',
      tone: 'primary' as const,
      body: 'Use this once the services have been delivered.',
    },
  }

  function run(note?: string) {
    if (!action) return
    const status =
      action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'fulfilled'
    decide.mutate(
      { id: b!.id, status, note },
      {
        onSuccess: () => {
          toast(`Request ${status}`)
          setAction(null)
        },
        onError: (e) => {
          setAction(null)
          toast(e.message, 'error')
        },
      },
    )
  }

  async function pdf() {
    setPdfBusy(true)
    try {
      await downloadBatchPdf(b!)
    } catch {
      toast('Could not create the PDF', 'error')
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[824px] pb-28">
      <RequestBody b={b} />

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
          onClick={() => exportBatchesCsv([b], b.ref_no ?? 'service-request')}
          aria-label="Export CSV"
        >
          <Download aria-hidden />
          <span className="hidden lg:inline">Export CSV</span>
        </button>
        <span className="spacer" />
        {b.status === 'submitted' && (
          <>
            <button className="btn btn-soft-danger" onClick={() => setAction('reject')}>
              <X aria-hidden /> Reject
            </button>
            <button className="btn btn-primary" onClick={() => setAction('approve')}>
              <Check aria-hidden /> Approve
            </button>
          </>
        )}
        {b.status === 'approved' && (
          <button className="btn btn-primary" onClick={() => setAction('fulfil')}>
            <PackageCheck aria-hidden /> Mark fulfilled
          </button>
        )}
      </div>

      {action && (
        <ConfirmDialog
          open
          title={copy[action].title}
          tone={copy[action].tone}
          confirmLabel={copy[action].confirm}
          busy={decide.isPending}
          reasonLabel={action === 'reject' ? 'Reason' : undefined}
          description={copy[action].body}
          onCancel={() => setAction(null)}
          onConfirm={run}
        />
      )}
    </div>
  )
}
