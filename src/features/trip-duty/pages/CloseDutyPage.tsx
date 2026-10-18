import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { Flag } from 'lucide-react'
import { Field, FormPage, Section } from '@/components/FormPage'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { istParts, time12 } from '@/lib/time'
import { useCloseDuty, useEntry } from '../api'
import { tripSummary, tripText, type DayEntry } from '../logic'
import { closeSchema, type CloseForm } from '../schemas'

export function CloseDutyPage() {
  const { id } = useParams()
  const { data: e, isLoading } = useEntry(id)
  if (isLoading) return <p className="text-muted">Loading…</p>
  if (!e || e.entry_type !== 'duty') return <p className="glass p-5">Duty not found.</p>
  if (e.duty_status === 'closed') return <p className="glass p-5">This duty is already closed.</p>
  return <Inner id={e.id} e={e} />
}

function Inner({ id, e }: { id: string; e: DayEntry }) {
  const navigate = useNavigate()
  const toast = useToast()
  const close = useCloseDuty(id)
  const fleet = e.vehicle_source === 'fleet'
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<CloseForm>({
    resolver: zodResolver(
      closeSchema(fleet, e.start_km, { date: e.entry_date, time: e.start_time ?? '' }),
    ),
    defaultValues: {
      end_km: '',
      end_time: istParts().time,
      end_date: istParts().date,
      fuel_litres: '',
      fuel_amount: '',
    },
  })
  const [endKm, endTime, endDate] = useWatch({ control, name: ['end_km', 'end_time', 'end_date'] })
  const live = tripText(
    tripSummary({
      startKm: String(e.start_km ?? ''),
      endKm,
      startTime: e.start_time ?? '',
      endTime,
      startDate: e.entry_date,
      endDate,
    }),
  )
  const onSubmit = handleSubmit((v) =>
    close.mutate(
      { ...v, fleet },
      {
        onSuccess: () => {
          toast('Duty submitted')
          navigate('/driver', { replace: true })
        },
        onError: (er) => toast(er.message, 'error'),
      },
    ),
  )
  return (
    <FormPage
      title="Close duty"
      dirty={isDirty}
      saving={close.isPending}
      onSubmit={onSubmit}
      saveLabel="Submit duty"
    >
      <Section stack title="This duty">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {(
            [
              ['Guest', e.guest_name],
              ['Vehicle', e.vehicle_label],
              ['Route', [e.pickup_point, e.drop_point].filter(Boolean).join(' → ')],
              [
                'Started',
                `${time12(e.start_time)}${e.start_km !== null ? ` · ${e.start_km} km` : ''}`,
              ],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-semibold">{v || '—'}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section stack title="End" icon={Flag}>
        <div className="grid gap-4 sm:grid-cols-2">
          {fleet && (
            <Field
              label="Ending KM"
              required
              error={errors.end_km?.message}
              hint={`Starting KM was ${e.start_km}`}
            >
              <input
                className={`${inputCls} tabular`}
                inputMode="numeric"
                autoFocus
                {...register('end_km')}
              />
            </Field>
          )}
          <Field
            label="Trip end date"
            required
            error={errors.end_date?.message}
            hint="The day the trip ended. Beta is counted on the start date."
          >
            <input type="date" className={inputCls} min={e.entry_date} {...register('end_date')} />
          </Field>
          <Field label="Closing time" required error={errors.end_time?.message}>
            <input type="time" className={inputCls} {...register('end_time')} />
          </Field>
          <Field label="Fuel (litres)" error={errors.fuel_litres?.message}>
            <input
              className={`${inputCls} tabular`}
              inputMode="decimal"
              {...register('fuel_litres')}
            />
          </Field>
          <Field label="Fuel amount (₹)" error={errors.fuel_amount?.message}>
            <input
              className={`${inputCls} tabular`}
              inputMode="decimal"
              {...register('fuel_amount')}
            />
          </Field>
        </div>
        {live && (
          <p
            aria-live="polite"
            className="rounded-control bg-primary-soft p-3 text-sm font-bold text-primary tabular"
          >
            {live}
          </p>
        )}
      </Section>
    </FormPage>
  )
}
