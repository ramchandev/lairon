import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileDown } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { useBatch } from '../api'
import { RequestBody } from '../components/RequestBody'
import { downloadBatchPdf } from '../pdf'

/** Read-only view of a submitted request (manager). */
export function RequestViewPage() {
  const { id } = useParams()
  const toast = useToast()
  const { data: b, isLoading } = useBatch(id)
  const [busy, setBusy] = useState(false)
  if (isLoading) return <p className="text-muted">Loading…</p>
  if (!b) return <p className="glass p-5">Request not found.</p>

  async function pdf() {
    setBusy(true)
    try {
      await downloadBatchPdf(b!)
    } catch {
      toast('Could not create the PDF', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <RequestBody b={b} />
      <button className="btn btn-ghost w-full" disabled={busy} onClick={pdf}>
        <FileDown aria-hidden /> {busy ? 'Preparing…' : 'Download PDF'}
      </button>
    </div>
  )
}
