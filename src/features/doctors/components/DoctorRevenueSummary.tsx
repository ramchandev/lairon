import { useAuth } from '@/app/AuthProvider'
import { inr } from '@/lib/format'
import { monthLabel } from '@/lib/time'
import { useDoctorRevenueSummary } from '../revenue'

/** Read-only: what this doctor brings in each month, added up over all the doctor's services. */
export function DoctorRevenueSummary({ doctorId }: { doctorId: string }) {
  const { profile } = useAuth()
  const q = useDoctorRevenueSummary(doctorId)
  if (profile?.role !== 'admin' && profile?.role !== 'manager') return null
  if (!q.data?.length) return null
  return (
    <>
      <h2 className="sec-h">Monthly revenue (all services)</h2>
      <section className="glass card">
        <ul className="plist">
          {q.data.map((r) => (
            <li key={r.month}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{monthLabel(r.month.slice(0, 7))}</p>
                <p className="muted text-[13px]">
                  {r.services} service{r.services === 1 ? '' : 's'}
                </p>
              </div>
              <span className="mono font-bold">{inr(r.amount)}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
