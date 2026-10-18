import type { ReactNode } from 'react'
import { Avatar } from '@/components/Avatar'
import { Person, Tag } from '@/components/ListParts'
import { inr } from '@/lib/format'
import { isNetrate, isOffer } from '../schemas'
import type { Service } from '../api'

/** One service line in the prototype's style. Actions (edit/remove) are optional so the same card is used read-only. */
export function ServiceCard({ s, actions }: { s: Service; actions?: ReactNode; index?: number }) {
  const offer = isOffer(s.offer_type)
    ? `Offer · ${s.offer_percent}%`
    : isNetrate(s.offer_type)
      ? `Netrate · ${inr(Number(s.netrate_amount))}`
      : s.offer_type
  return (
    <li className="glass svc-item list-none">
      <div className="svc-head">
        <Person
          lead={<Avatar name={s.doctor_name} />}
          name={s.doctor_name}
          sub={[s.qualification, s.speciality].filter(Boolean).join(' · ')}
        />
        <Tag>{s.division}</Tag>
      </div>
      <dl className="meta-grid sm">
        <div>
          <dt>Service type</dt>
          <dd>{s.service_type}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd className="mono">{inr(Number(s.service_amount))}</dd>
        </div>
        <div>
          <dt>Offer / Netrate</dt>
          <dd>{offer}</dd>
        </div>
        <div>
          <dt>Hospital</dt>
          <dd>{s.hospital_name}</dd>
        </div>
        <div>
          <dt>Expected</dt>
          <dd className="mono">{inr(Number(s.expected_business_value))}</dd>
        </div>
        <div>
          <dt>Current</dt>
          <dd className="mono">{inr(Number(s.current_business_value))}</dd>
        </div>
      </dl>
      {actions && <div className="row-actions">{actions}</div>}
    </li>
  )
}
