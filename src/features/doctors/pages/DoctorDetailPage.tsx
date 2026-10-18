import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ClipboardList, Pencil, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { EmptyState } from '@/components/EmptyState'
import { Person } from '@/components/ListParts'
import { useAuth } from '@/app/AuthProvider'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ActiveBadge, StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { CallLink } from '@/features/users/components'
import { fmtDate, inr } from '@/lib/format'
import { useDeleteDoctor, useDoctor, useDoctorHistory } from '../api'
import { doctorPaths } from '../paths'

const STATUS_TONE = {
  draft: 'muted',
  submitted: 'info',
  approved: 'ok',
  rejected: 'danger',
  fulfilled: 'teal',
} as const

export function DoctorDetailPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { data: d, isLoading } = useDoctor(id)
  const history = useDoctorHistory(id)
  const del = useDeleteDoctor()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  if (!profile || isLoading) return <p className="text-muted">Loading…</p>
  if (!d) return <p className="glass p-5">Doctor not found.</p>
  const paths = doctorPaths(profile.role)

  const rows: [string, React.ReactNode][] = [
    ['Division', d.division],
    ['Qualification', d.qualification],
    ['Speciality', d.speciality],
    ['Hospital', d.hospital_name],
    ['Pharmacy', d.pharmacy_name],
    ['Area', d.area],
    ['HQ', d.hq],
    ['Email', d.email],
    ['Doctor’s Manager', profile.role === 'admin' ? d.manager_name : null],
    ['Notes', d.notes],
  ]

  return (
    <div className="mx-auto max-w-[824px] pb-6">
      <section className="glass card">
        <div className="d-head">
          <Person
            lead={<Avatar name={d.name} size={52} />}
            name={<h1 className="d-title">{d.name}</h1>}
            sub={d.phone ? <CallLink phone={d.phone} /> : d.speciality}
          />
          <ActiveBadge active={d.is_active} />
        </div>
        <dl className="meta-grid">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd className="whitespace-pre-wrap">{v}</dd>
              </div>
            ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <Link to={paths.edit(d.id)} className="btn btn-ghost">
            <Pencil aria-hidden /> Edit
          </Link>
          <button className="btn btn-soft-danger" onClick={() => setConfirm(true)}>
            <Trash2 aria-hidden /> Delete
          </button>
        </div>
      </section>

      <h2 className="sec-h">Service request history</h2>
      {history.isLoading ? (
        <div className="glass h-16 animate-pulse" />
      ) : !history.data?.length ? (
        <div className="glass">
          <EmptyState
            icon={ClipboardList}
            title="No service requests yet"
            hint="Requests raised for this doctor will show up here."
          />
        </div>
      ) : (
        <section className="glass card">
          <ul className="plist">
            {history.data.map((s) => (
              <li key={s.id}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.service_type}</p>
                  <p className="muted text-[13px]">
                    <span className="mono">{fmtDate(s.request_date)}</span>
                    {s.batch?.ref_no && <> · {s.batch.ref_no}</>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="mono font-bold">{inr(s.service_amount)}</span>
                  {s.batch && (
                    <StatusBadge
                      tone={STATUS_TONE[s.batch.status as keyof typeof STATUS_TONE] ?? 'muted'}
                    >
                      {s.batch.status}
                    </StatusBadge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={confirm}
        title="Delete this doctor?"
        confirmLabel="Delete"
        busy={del.isPending}
        description="Past requests keep the doctor’s name as saved. This can’t be undone. To just hide the doctor, mark them inactive instead."
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          del.mutate(d.id, {
            onSuccess: () => {
              toast('Doctor deleted')
              navigate(paths.list, { replace: true })
            },
            onError: () => {
              setConfirm(false)
              toast('Could not delete the doctor', 'error')
            },
          })
        }
      />
    </div>
  )
}
