import type { ReactNode } from 'react'
import { CircleX } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Person, Tag } from '@/components/ListParts'
import { fmtDate, inr } from '@/lib/format'
import { batchTotal, type Batch, type Service } from '../api'
import { isNetrate, isOffer } from '../schemas'
import { BatchBadge } from './BatchBadge'

const terms = (s: Service) =>
  isOffer(s.offer_type)
    ? `Offer ${s.offer_percent}%`
    : isNetrate(s.offer_type)
      ? `Netrate ${inr(Number(s.netrate_amount))}`
      : s.offer_type

const kv = (k: string, v: ReactNode) => (
  <div key={k}>
    <dt>{k}</dt>
    <dd>{v ?? '—'}</dd>
  </div>
)

/** Summary card + one card per service, as in the prototype's request detail (admin and manager views). */
export function RequestBody({ b }: { b: Batch }) {
  const expected = b.services.reduce((a, s) => a + Number(s.expected_business_value), 0)
  return (
    <>
      <section className="glass card">
        <div className="d-head">
          <div>
            <div className="eyebrow">Service request</div>
            <h1 className="d-title mono">{b.ref_no}</h1>
          </div>
          <BatchBadge status={b.status} />
        </div>
        <dl className="meta-grid">
          {kv('Submitted', b.submitted_at ? fmtDate(b.submitted_at) : null)}
          {kv('Doctor’s manager', b.manager_name)}
          {kv('Accountability', b.accountability_staff_name)}
          {kv('Services', b.services.length)}
          {kv('Total amount', <span className="mono">{inr(batchTotal(b))}</span>)}
          {kv('Expected business', <span className="mono">{inr(expected)}</span>)}
          {b.decided_at && kv('Decided', fmtDate(b.decided_at))}
        </dl>
        {b.admin_note && (
          <div className="note">
            <CircleX size={18} className="shrink-0" />
            <div>
              <b>{b.status === 'rejected' ? 'Rejection reason' : 'Admin note'}</b>
              <br />
              {b.admin_note}
            </div>
          </div>
        )}
      </section>

      <h2 className="sec-h">Services ({b.services.length})</h2>
      {b.services.map((s) => (
        <section key={s.id} className="glass card svc">
          <div className="svc-head">
            <Person
              lead={<Avatar name={s.doctor_name} />}
              name={s.doctor_name}
              sub={`${s.qualification} · ${s.speciality}`}
            />
            <Tag>{s.division}</Tag>
          </div>
          <dl className="meta-grid sm four">
            {kv('Hospital', s.hospital_name)}
            {kv('Pharmacy', s.pharmacy_name || '—')}
            {kv('Area · HQ', `${s.area} · ${s.hq}`)}
            {kv('Service type', s.service_type)}
            {kv('Service amount', <span className="mono">{inr(Number(s.service_amount))}</span>)}
            {kv(
              'Expected business',
              <span className="mono">{inr(Number(s.expected_business_value))}</span>,
            )}
            {kv(
              'Current business',
              <span className="mono">{inr(Number(s.current_business_value))}</span>,
            )}
            {kv('Offer / Netrate', terms(s))}
          </dl>
        </section>
      ))}
    </>
  )
}
