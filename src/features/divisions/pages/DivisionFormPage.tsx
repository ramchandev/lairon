import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { Field, FormPage, Section } from '@/components/FormPage'
import { Layers, ShieldCheck } from 'lucide-react'
import { SwitchRow } from '@/components/Switch'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useDivisions, useSaveDivision } from '../api'
import { divisionSchema, type DivisionForm } from '../schemas'

export function DivisionFormPage() {
  const { id } = useParams()
  const { data, isLoading } = useDivisions()
  if (id && isLoading) return <p className="text-muted">Loading…</p>
  const d = id ? data?.find((x) => x.id === id) : undefined
  if (id && !d) return <p className="glass p-5">Division not found.</p>
  return (
    <Inner
      id={id}
      defaults={
        d
          ? {
              name: d.name,
              description: d.description ?? '',
              sort_order: String(d.sort_order),
              is_active: d.is_active,
            }
          : { name: '', description: '', sort_order: '', is_active: true }
      }
    />
  )
}

function Inner({ id, defaults }: { id?: string; defaults: DivisionForm }) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveDivision(id)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<DivisionForm>({ resolver: zodResolver(divisionSchema), defaultValues: defaults })
  const onSubmit = handleSubmit((v) =>
    save.mutate(v, {
      onSuccess: () => {
        toast(id ? 'Division updated' : 'Division added')
        navigate('/admin/divisions', { replace: true })
      },
      onError: (e) => toast(e.message, 'error'),
    }),
  )
  return (
    <FormPage
      title={id ? 'Edit division' : 'Add division'}
      saveLabel={id ? 'Save changes' : 'Save division'}
      dirty={isDirty}
      saving={save.isPending}
      onSubmit={onSubmit}
    >
      <Section title="Division details" icon={Layers}>
        <Field label="Name" required error={errors.name?.message}>
          <input className={inputCls} placeholder="e.g. OL" {...register('name')} />
        </Field>
        <Field
          label="Sort order"
          error={errors.sort_order?.message}
          hint="Lower numbers appear first."
        >
          <input className={inputCls} inputMode="numeric" {...register('sort_order')} />
        </Field>
        <Field label="Description" full>
          <textarea rows={4} className={inputCls} {...register('description')} />
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
