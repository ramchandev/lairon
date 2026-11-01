import type { ReactNode } from 'react'
import { ArrowRightLeft, CircleX } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { ServiceRevenue } from '@/features/doctors/components/ServiceRevenue'
import { useServiceRevenue } from '@/features/doctors/revenue'
import { Avatar } from '@/components/Avatar'
import { Person, Tag } from '@/components/ListParts'
import { fmtDate, inr } from '@/lib/format'
import { batchTotal, useHandovers, type Batch, type Service } from '../api'
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
  const { profile } = useAuth()
  const handovers = useHandovers(b.id)
  const revenue = useServiceRevenue(b.services.map((s) => s.id))
  // Revenue follows the request: the manager who handles it now (or an admin) enters it, once it is submitted and not rejected.
  const canEnter =
    ['submitted', 'approved', 'fulfilled'].includes(b.status) &&
    (profile?.role === 'admin' || (profile?.role === 'manager' && b.manager_id === profile.id))
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
          {kv('Manager', b.manager_name)}
          {kv('Accountability', b.accountability_staff_name)}
          {kv('Services', b.services.length)}
          {kv('Total amount', <span className="mono">{inr(batchTotal(b))}</span>)}
          {kv('Expected business', <span className="mono">{inr(expected)}</span>)}
          {b.decided_at && kv('Decided', fmtDate(b.decided_at))}
        </dl>
        {handovers.data && handovers.data.length > 0 && (
          <div className="note info">
            <ArrowRightLeft size={18} className="shrink-0" />
            <div>
              <b>Handed over</b>
              {handovers.data.map((h) => (
                <div key={h.id}>
                  {h.from_manager_name ?? '—'} → {h.to_manager_name ?? '—'} ·{' '}
                  {fmtDate(h.changed_at)}
                  {h.note ? ` · ${h.note}` : ''}
                </div>
              ))}
            </div>
          </div>
        )}
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
          {['submitted', 'approved', 'fulfilled'].includes(b.status) && (
            <ServiceRevenue
              serviceId={s.id}
              doctorName={s.doctor_name}
              startDate={s.request_date}
              rows={(revenue.data ?? []).filter((r) => r.service_id === s.id)}
              canEnter={canEnter}
            />
          )}
        </section>
      ))}
    </>
  )
}
