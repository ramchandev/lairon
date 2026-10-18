import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardPlus, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/FormPage'
import { SearchSelect } from '@/components/SearchSelect'
import { useToast } from '@/components/Toast'
import { useUsers } from '@/features/users/api'
import { inr } from '@/lib/format'
import {
  batchTotal,
  useDeleteService,
  useDraftBatch,
  useEnsureDraft,
  useSetAccountability,
  useSubmitBatch,
  type Service,
} from '../api'
import { ServiceCard } from '../components/ServiceCard'

/** Manager's open draft: pick accountability staff once, add services, then submit them together. */
export function DraftRequestPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const draft = useDraftBatch()
  const ensure = useEnsureDraft()
  const staff = useUsers('staff')
  const setStaff = useSetAccountability()
  const remove = useDeleteService()
  const submit = useSubmitBatch()
  const [toRemove, setToRemove] = useState<Service | null>(null)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const started = useRef(false)

  // Start the draft on first visit (idempotent: one open draft per manager).
  useEffect(() => {
    if (draft.isSuccess && !draft.data && !started.current) {
      started.current = true
      ensure.mutate()
    }
  }, [draft.isSuccess, draft.data, ensure])

  const b = draft.data
  if (draft.isLoading || !b)
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="glass h-24 animate-pulse" />
        <div className="glass h-24 animate-pulse" />
      </div>
    )

  const canSubmit = b.services.length > 0 && !!b.accountability_staff_id
  const staffOptions = (staff.data ?? [])
    .filter((s) => s.is_active)
    .map((s) => ({ value: s.id, label: s.area ? `${s.full_name} · ${s.area}` : s.full_name }))

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>New service request</h1>
          <p className="muted">Add one or more services, then submit them together.</p>
        </div>
      </div>

      <section className="glass card">
        <Field
          label="Accountability (staff)"
          required
          hint="This staff member gets a copy of the request email."
        >
          <SearchSelect
            title="Accountability staff"
            placeholder="Select staff"
            value={b.accountability_staff_id ?? ''}
            options={staffOptions}
            onChange={(staffId) =>
              setStaff.mutate(
                { batchId: b.id, staffId },
                { onError: () => toast('Could not save the staff', 'error') },
              )
            }
          />
        </Field>
      </section>

      <div className="mx-0.5 mt-5 mb-2.5 flex items-center justify-between">
        <h2 className="text-base font-bold">Services ({b.services.length})</h2>
        {b.services.length > 0 && (
          <Link to="/m/request/add" className="btn btn-ghost btn-sm">
            <Plus aria-hidden /> Add service
          </Link>
        )}
      </div>

      {b.services.length === 0 ? (
        <div className="glass">
          <EmptyState
            icon={ClipboardPlus}
            title="No services yet"
            hint="Add a service for one of your doctors to start."
            action={
              <Link to="/m/request/add" className="btn btn-primary">
                <Plus aria-hidden /> Add service
              </Link>
            }
          />
        </div>
      ) : (
        <ul>
          {b.services.map((s, i) => (
            <ServiceCard
              key={s.id}
              s={s}
              index={i}
              actions={
                <>
                  <Link to={`/m/request/edit/${s.id}`} className="btn btn-ghost btn-sm">
                    <Pencil aria-hidden /> Edit
                  </Link>
                  <button className="btn btn-soft-danger btn-sm" onClick={() => setToRemove(s)}>
                    <Trash2 aria-hidden /> Remove
                  </button>
                </>
              }
            />
          ))}
        </ul>
      )}

      {b.services.length > 0 && (
        <section className="glass submit-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[13px] text-muted">Total service amount</span>
              <div className="tot mono">{inr(batchTotal(b))}</div>
            </div>
            <span className="badge b-muted">Draft</span>
          </div>
          <button
            className="btn btn-primary btn-lg btn-block mt-3.5"
            disabled={!canSubmit}
            onClick={() => setConfirmSubmit(true)}
          >
            <Send aria-hidden /> Submit service request
          </button>
          <p className="muted mt-2.5 text-center text-[13px]">
            {canSubmit
              ? 'Your draft is saved. You can come back to it any time.'
              : 'Choose the accountability staff to submit.'}
          </p>
        </section>
      )}

      <ConfirmDialog
        open={!!toRemove}
        title="Remove this service?"
        confirmLabel="Remove"
        busy={remove.isPending}
        description={
          <>
            {toRemove?.doctor_name} · {toRemove?.service_type}
          </>
        }
        onCancel={() => setToRemove(null)}
        onConfirm={() =>
          toRemove &&
          remove.mutate(toRemove.id, {
            onSuccess: () => {
              toast('Service removed')
              setToRemove(null)
            },
            onError: () => toast('Could not remove the service', 'error'),
          })
        }
      />
      <ConfirmDialog
        open={confirmSubmit}
        tone="primary"
        title="Submit service request?"
        confirmLabel="Submit"
        busy={submit.isPending}
        description={
          <>
            {b.services.length} {b.services.length === 1 ? 'service' : 'services'} totalling{' '}
            <b>{inr(batchTotal(b))}</b> will be sent for approval. You can’t edit them after
            submitting.
          </>
        }
        onCancel={() => setConfirmSubmit(false)}
        onConfirm={() =>
          submit.mutate(b.id, {
            onSuccess: () => navigate(`/m/requests/done/${b.id}`, { replace: true }),
            onError: (e) => {
              setConfirmSubmit(false)
              toast(e.message, 'error')
            },
          })
        }
      />
    </div>
  )
}
