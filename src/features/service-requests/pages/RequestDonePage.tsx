import { Link, useParams } from 'react-router-dom'
import { CircleCheck, Mail } from 'lucide-react'
import { inr } from '@/lib/format'
import { batchTotal, useBatch } from '../api'

export function RequestDonePage() {
  const { id } = useParams()
  const { data: b } = useBatch(id)
  return (
    <section className="glass done mt-4">
      <div className="done-ic">
        <CircleCheck />
      </div>
      <h1>Request submitted</h1>
      <p className="muted mt-1.5">Reference number</p>
      <p className="mono done-ref">{b?.ref_no ?? '…'}</p>
      {b && (
        <dl className="meta-grid">
          <div>
            <dt>Services</dt>
            <dd>{b.services.length}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd className="mono">{inr(batchTotal(b))}</dd>
          </div>
          <div>
            <dt>Accountability</dt>
            <dd>{b.accountability_staff_name ?? '—'}</dd>
          </div>
        </dl>
      )}
      <div className="note info text-left">
        <Mail size={18} className="shrink-0" />
        <div>
          LAIRON admin{b?.accountability_staff_name ? ` and ${b.accountability_staff_name}` : ''}{' '}
          have been emailed. You’ll see the status change in My Requests.
        </div>
      </div>
      <div className="done-actions">
        <Link to={`/m/requests/view/${id}`} className="btn btn-primary btn-lg">
          View request
        </Link>
        <Link to="/m/doctors" className="btn btn-ghost btn-lg">
          Back to My Doctors
        </Link>
      </div>
    </section>
  )
}
