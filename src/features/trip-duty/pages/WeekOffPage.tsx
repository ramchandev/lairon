import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Coffee } from 'lucide-react'
import { Field, FormPage, Section } from '@/components/FormPage'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { fmtDate } from '@/lib/format'
import { addDays, istParts } from '@/lib/time'
import { useAddWeekOff, useEditWindow } from '../api'

/** Week off needs no approval: one date, saved straight away. */
export function WeekOffPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const today = istParts().date
  const windowDays = useEditWindow().data ?? 7
  const add = useAddWeekOff()
  const {
    register,
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<{ date: string }>({ defaultValues: { date: today } })
  const date = useWatch({ control, name: 'date' })
  const onSubmit = handleSubmit(({ date }) =>
    add.mutate(date, {
      onSuccess: () => {
        toast('Week off saved')
        navigate('/driver', { replace: true })
      },
      onError: (e) => toast(e.message, 'error'),
    }),
  )
  return (
    <FormPage
      title="Week off"
      dirty={isDirty}
      saving={add.isPending}
      onSubmit={onSubmit}
      saveLabel="Mark week off"
    >
      <Section stack title="Day off" icon={Coffee}>
        <Field
          label="Date"
          required
          hint={`Choose today or a day from the last ${windowDays} days.`}
        >
          <input
            type="date"
            className={inputCls}
            min={addDays(today, -windowDays)}
            max={addDays(today, 60)}
            {...register('date', { required: true })}
          />
        </Field>
        {date && (
          <p className="rounded-control bg-muted-bg p-3 text-sm text-ink-2">
            Mark <b>{fmtDate(date)}</b> as your week off. No approval needed.
          </p>
        )}
      </Section>
    </FormPage>
  )
}
