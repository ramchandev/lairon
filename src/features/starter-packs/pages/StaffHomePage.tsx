import { Link } from 'react-router-dom'
import { PackagePlus } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { fmtDate } from '@/lib/format'
import { usePacks } from '../api'
import { PackBadge } from '../components/PackBadge'

export function StaffHomePage() {
  const { profile } = useAuth()
  const { data } = usePacks()
  const open = (data ?? []).filter(
    (p) => p.status === 'submitted' || p.status === 'processing',
  ).length
  const done = (data ?? []).filter((p) => p.status === 'fulfilled').length
  const h = new Date().getHours()
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return (
    <div>
      <div className="hello mb-4">
        <div>
          <p className="eyebrow">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h1>
            {greet}, {profile?.full_name.split(' ')[0]}
          </h1>
        </div>
      </div>
      <section className="duty-hero" aria-label="Make a starter pack">
        <div className="dh-top">
          <span className="dh-pill">Starter pack</span>
        </div>
        <div className="dh-route">
          <span>Meeting a doctor?</span>
        </div>
        <p className="mt-1 mb-4 text-[15px] text-white/90">
          Pick the doctor, add the products and submit. Your name and area are already filled in.
        </p>
        <Link to="/staff/new" className="btn btn-white btn-lg">
          <PackagePlus aria-hidden /> New Starter Pack
        </Link>
      </section>
      <h2 className="sec-h">Overview</h2>
      <div className="stats !grid-cols-2">
        <div className="stat">
          <b className="mono">{open}</b>
          <span>In progress</span>
        </div>
        <div className="stat">
          <b className="mono">{done}</b>
          <span>Fulfilled</span>
        </div>
      </div>
      <h2 className="sec-h">Recent</h2>
      {!data?.length ? (
        <div className="glass p-4 text-sm text-muted">
          Nothing yet. Raise your first starter pack above.
        </div>
      ) : (
        data.slice(0, 3).map((p) => (
          <Link key={p.id} to={`/staff/requests/${p.id}`} className="glass req-card">
            <div className="rc-top">
              <b className="mono">{p.ref_no}</b>
              <PackBadge status={p.status} />
            </div>
            <div className="muted mt-1 text-[13px]">
              {p.doctor_name} · {fmtDate(p.request_date)}
            </div>
          </Link>
        ))
      )}
      <p className="mt-3.5">
        <Link to="/staff/requests" className="link">
          See all
        </Link>
      </p>
    </div>
  )
}
