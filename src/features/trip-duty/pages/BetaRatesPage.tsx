import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { History, IndianRupee, Info } from 'lucide-react'
import { DataTable, type Column } from '@/components/DataTable'
import { Field, FormPage, Section } from '@/components/FormPage'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { fmtDate, inr } from '@/lib/format'
import { istParts } from '@/lib/time'
import { useAddRate, useBetaRates, type BetaRate } from '../admin-api'

const whole = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => /^[1-9]\d{0,5}$/.test(v), `${label} must be a whole number of rupees above 0`)
const schema = z.object({
  local_rate: whole('Local rate'),
  outstation_rate: whole('Outstation rate'),
  effective_from: z.string().min(1, 'Effective date is required'),
  note: z.string().trim(),
})
type Form = z.infer<typeof schema>

/** Rates are append-only: a change is a new row with its own effective date; nothing is edited in place. */
export function BetaRatesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const rates = useBetaRates()
  const add = useAddRate()
  const today = istParts().date
  const current = rates.data?.find((r) => r.effective_from <= today)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      local_rate: current ? String(current.local_rate) : '',
      outstation_rate: current ? String(current.outstation_rate) : '',
      effective_from: today,
      note: '',
    },
  })

  const onSubmit = handleSubmit((v) => {
    if (rates.data?.some((r) => r.effective_from === v.effective_from))
      return setError('effective_from', { message: 'A rate already starts on this date' })
    add.mutate(
      {
        effective_from: v.effective_from,
        local_rate: Number(v.local_rate),
        outstation_rate: Number(v.outstation_rate),
        note: v.note,
      },
      {
        onSuccess: () => {
          toast('New rate saved')
          navigate('/admin/trip-duty?tab=beta', { replace: true })
        },
        onError: (e) => toast(e.message, 'error'),
      },
    )
  })

  const columns: Column<BetaRate>[] = [
    {
      key: 'from',
      header: 'Effective from',
      primary: true,
      cell: (r) => (
        <span className="font-bold tabular">
          {fmtDate(r.effective_from)}
          {r.id === current?.id && <StatusBadge tone="ok"> Current</StatusBadge>}
        </span>
      ),
    },
    {
      key: 'l',
      header: 'Local',
      cell: (r) => <span className="tabular">{inr(r.local_rate)}</span>,
    },
    {
      key: 'o',
      header: 'Outstation',
      cell: (r) => <span className="tabular">{inr(r.outstation_rate)}</span>,
    },
    { key: 'n', header: 'Note', cell: (r) => r.note || '—' },
  ]

  return (
    <FormPage
      title="Beta rates"
      dirty={isDirty}
      saving={add.isPending}
      onSubmit={onSubmit}
      saveLabel="Save rates"
    >
      <div className="banner">
        <Info aria-hidden size={18} />
        <div>
          <b>New rates are never applied backwards.</b> They apply to duties on or after the
          effective date. Earlier days keep the rate they were paid at.
        </div>
      </div>
      <Section title="New rate" icon={IndianRupee}>
        <Field
          label="Local rate (₹)"
          required
          error={errors.local_rate?.message}
          hint="Per payable day"
        >
          <div className="input-group">
            <span className="prefix">₹</span>
            <input className={`${inputCls} mono`} inputMode="numeric" {...register('local_rate')} />
          </div>
        </Field>
        <Field
          label="Outstation rate (₹)"
          required
          error={errors.outstation_rate?.message}
          hint="Per payable day"
        >
          <div className="input-group">
            <span className="prefix">₹</span>
            <input
              className={`${inputCls} mono`}
              inputMode="numeric"
              {...register('outstation_rate')}
            />
          </div>
        </Field>
        <Field
          label="Effective from"
          required
          error={errors.effective_from?.message}
          hint="Can’t fall inside a finalised month."
        >
          <input type="date" className={inputCls} {...register('effective_from')} />
        </Field>
        <Field label="Note">
          <input
            className={inputCls}
            placeholder="e.g. Revised as per HR circular"
            {...register('note')}
          />
        </Field>
      </Section>
      <Section stack title="Rate history" icon={History}>
        <DataTable
          rows={rates.data ?? []}
          columns={columns}
          rowKey={(r) => r.id}
          loading={rates.isLoading}
        />
      </Section>
    </FormPage>
  )
}
