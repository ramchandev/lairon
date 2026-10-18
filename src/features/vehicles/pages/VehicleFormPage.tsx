import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { Field, FormPage, Section } from '@/components/FormPage'
import { CarFront, ShieldCheck } from 'lucide-react'
import { SwitchRow } from '@/components/Switch'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useSaveVehicle, useVehicles } from '../api'
import { vehicleSchema, type VehicleForm } from '../schemas'

const EMPTY: VehicleForm = {
  name: '',
  vehicle_number: '',
  color: '',
  make: '',
  model: '',
  year: '',
  is_active: true,
}

export function VehicleFormPage() {
  const { id } = useParams()
  const { data, isLoading } = useVehicles()
  if (id && isLoading) return <p className="text-muted">Loading…</p>
  const existing = id ? data?.find((v) => v.id === id) : undefined
  if (id && !existing) return <p className="glass p-5">Vehicle not found.</p>
  return (
    <Inner
      id={id}
      defaults={
        existing
          ? {
              name: existing.name,
              vehicle_number: existing.vehicle_number,
              color: existing.color ?? '',
              make: existing.make ?? '',
              model: existing.model ?? '',
              year: existing.year ? String(existing.year) : '',
              is_active: existing.is_active,
            }
          : EMPTY
      }
    />
  )
}

function Inner({ id, defaults }: { id?: string; defaults: VehicleForm }) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveVehicle(id)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<VehicleForm>({ resolver: zodResolver(vehicleSchema), defaultValues: defaults })

  const onSubmit = handleSubmit((v) =>
    save.mutate(v, {
      onSuccess: () => {
        toast(id ? 'Vehicle updated' : 'Vehicle added')
        navigate('/admin/vehicles', { replace: true })
      },
      onError: (e) => toast(e.message, 'error'),
    }),
  )

  return (
    <FormPage
      title={id ? 'Edit vehicle' : 'Add vehicle'}
      saveLabel={id ? 'Save changes' : 'Save vehicle'}
      dirty={isDirty}
      saving={save.isPending}
      onSubmit={onSubmit}
    >
      <Section title="Vehicle details" icon={CarFront}>
        <Field
          label="Short name"
          required
          error={errors.name?.message}
          hint="Drivers see “Short name + number”, e.g. CRYSTA 6435."
        >
          <input
            className={`${inputCls} uppercase`}
            placeholder="e.g. CRYSTA"
            {...register('name')}
          />
        </Field>
        <Field
          label="Vehicle number"
          required
          error={errors.vehicle_number?.message}
          hint="Full registration number."
        >
          <input
            className={`${inputCls} uppercase`}
            autoCapitalize="characters"
            placeholder="TN09 AB 6435"
            {...register('vehicle_number')}
          />
        </Field>
        <Field label="Make">
          <input className={inputCls} placeholder="e.g. Toyota" {...register('make')} />
        </Field>
        <Field label="Model">
          <input className={inputCls} placeholder="e.g. Innova Crysta" {...register('model')} />
        </Field>
        <Field label="Year" error={errors.year?.message}>
          <input
            className={inputCls}
            inputMode="numeric"
            maxLength={4}
            placeholder="2022"
            {...register('year')}
          />
        </Field>
        <Field label="Color">
          <input className={inputCls} placeholder="e.g. White" {...register('color')} />
        </Field>
      </Section>
      <Section title="Availability" icon={ShieldCheck}>
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <SwitchRow
              label="Active"
              hint="Inactive vehicles are hidden from the driver duty form."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Section>
    </FormPage>
  )
}
