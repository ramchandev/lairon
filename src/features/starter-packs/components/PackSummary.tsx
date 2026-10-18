import { CircleX } from 'lucide-react'
import { fmtDate } from '@/lib/format'
import type { Pack } from '../api'
import { PackBadge } from './PackBadge'

/** Read-only view of a starter pack, as in the prototype: facts card + numbered product list. */
export function PackSummary({ pack }: { pack: Pack }) {
  const facts: [string, React.ReactNode][] = [
    ['Date', fmtDate(pack.request_date)],
    ['Doctor', pack.doctor_name],
    ['Qualification', pack.qualification],
    ['Doctor area', pack.doctor_area],
    ['Staff', pack.staff_name],
    ['Staff area', pack.staff_area],
    ['Division', <span className="tag">{pack.division}</span>],
  ]
  return (
    <>
      <section className="glass card">
        <div className="d-head">
          <div>
            <div className="eyebrow">Starter pack</div>
            <h1 className="d-title mono">{pack.ref_no}</h1>
          </div>
          <PackBadge status={pack.status} />
        </div>
        <dl className="meta-grid">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {pack.admin_note && (
          <div className="note">
            <CircleX size={18} className="shrink-0" />
            <div>
              <b>Note</b>
              <br />
              {pack.admin_note}
            </div>
          </div>
        )}
      </section>
      <section className="glass card mt-3.5">
        <div className="card-h">
          <h2>Products ({pack.items.length})</h2>
        </div>
        <ul className="plist">
          {pack.items.map((i, n) => (
            <li key={i.id}>
              <span className="sn">{n + 1}</span>
              <span className="pname">{i.product_name}</span>
              <span className="qty">{i.quantity}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
