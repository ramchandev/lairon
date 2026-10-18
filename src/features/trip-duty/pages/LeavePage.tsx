import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { CalendarRange, FileText } from 'lucide-react'
import { Field, FormPage, Section } from '@/components/FormPage'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useLookup } from '@/features/lookups/hooks'
import { addDays, diffDays, istParts } from '@/lib/time'
import { useApplyLeave, useEditWindow } from '../api'
import { leaveSchema, type LeaveForm } from '../schemas'

export function LeavePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const today = istParts().date
  const windowDays = useEditWindow().data ?? 7
  const types = useLookup('leave_type')
  const apply = useApplyLeave()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { from: today, to: today, leave_type: '', reason: '' },
  })
  const [from, to] = useWatch({ control, name: ['from', 'to'] })
  const days = from && to && to >= from ? diffDays(from, to) + 1 : 0
  const onSubmit = handleSubmit((v) =>
    apply.mutate(v, {
      onSuccess: (n) => {
        toast(`Leave request sent for ${n} ${n === 1 ? 'day' : 'days'}`)
        navigate('/driver', { replace: true })
      },
      onError: (e) => toast(e.message, 'error'),
    }),
  )
  return (
    <FormPage
      title="Apply leave"
      subtitle="Your admin approves or rejects it."
      dirty={isDirty}
      saving={apply.isPending}
      onSubmit={onSubmit}
      saveLabel="Send request"
    >
      <Section stack title="Dates" icon={CalendarRange}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="From" required error={errors.from?.message}>
            <input
              type="date"
              className={inputCls}
              min={addDays(today, -windowDays)}
              {...register('from')}
            />
          </Field>
          <Field label="To" required error={errors.to?.message}>
            <input type="date" className={inputCls} min={from || undefined} {...register('to')} />
          </Field>
        </div>
        {days > 0 && (
          <p
            aria-live="polite"
            className="rounded-control bg-primary-soft p-3 text-sm font-bold text-primary tabular"
          >
            {days} {days === 1 ? 'day' : 'days'}
          </p>
        )}
      </Section>
      <Section stack title="Details" icon={FileText}>
        <Field label="Leave type" required error={errors.leave_type?.message}>
          <select className={inputCls} {...register('leave_type')}>
            <option value="">Select type</option>
            {(types.data?.length
              ? types.data.map((t) => t.value)
              : ['Casual', 'Sick', 'Emergency', 'Other']
            ).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Reason" required error={errors.reason?.message}>
          <textarea rows={3} className={inputCls} {...register('reason')} />
        </Field>
      </Section>
    </FormPage>
  )
}
