import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { MapPin, ShieldCheck } from 'lucide-react'
import { Field, FormPage, Section } from '@/components/FormPage'
import { SwitchRow } from '@/components/Switch'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useLocations, useSaveLocation, type LocationForm } from '../api'

const schema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(6, 'Up to 6 letters'),
  name: z.string().trim().min(1, 'Name is required'),
  sort_order: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{1,4}$/.test(v), 'Use a whole number'),
  is_active: z.boolean(),
})

export function LocationFormPage() {
  const { id } = useParams()
  const { data, isLoading } = useLocations()
  if (id && isLoading) return <p className="text-muted">Loading…</p>
  const l = id ? data?.find((x) => x.id === id) : undefined
  if (id && !l) return <p className="glass p-5">Location not found.</p>
  return (
    <Inner
      id={id}
      defaults={
        l
          ? { code: l.code, name: l.name, sort_order: String(l.sort_order), is_active: l.is_active }
          : { code: '', name: '', sort_order: '', is_active: true }
      }
    />
  )
}

function Inner({ id, defaults }: { id?: string; defaults: LocationForm }) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveLocation(id)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<LocationForm>({ resolver: zodResolver(schema), defaultValues: defaults })
  const onSubmit = handleSubmit((v) =>
    save.mutate(v, {
      onSuccess: () => {
        toast(id ? 'Location updated' : 'Location added')
        navigate('/admin/locations', { replace: true })
      },
      onError: (e) => toast(e.message, 'error'),
    }),
  )
  return (
    <FormPage
      title={id ? 'Edit location' : 'Add location'}
      saveLabel={id ? 'Save changes' : 'Save location'}
      dirty={isDirty}
      saving={save.isPending}
      onSubmit={onSubmit}
    >
      <Section title="Location details" icon={MapPin}>
        <Field label="Code" required error={errors.code?.message} hint="Short name, e.g. MDU.">
          <input className={inputCls} placeholder="e.g. MDU" {...register('code')} />
        </Field>
        <Field label="Name" required error={errors.name?.message}>
          <input className={inputCls} placeholder="e.g. Madurai" {...register('name')} />
        </Field>
        <Field
          label="Sort order"
          error={errors.sort_order?.message}
          hint="Lower numbers appear first."
        >
          <input className={inputCls} inputMode="numeric" {...register('sort_order')} />
        </Field>
      </Section>
      <Section title="Availability" icon={ShieldCheck}>
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <SwitchRow label="Active" checked={field.value} onChange={field.onChange} />
          )}
        />
      </Section>
    </FormPage>
  )
}
