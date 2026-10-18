import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { Field, FormPage, Section } from '@/components/FormPage'
import { Check, Pill, ShieldCheck } from 'lucide-react'
import { SwitchRow } from '@/components/Switch'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useDivisions } from '@/features/divisions/api'
import { useProducts, useSaveProduct } from '../api'
import { productSchema, type ProductForm } from '../schemas'

export function ProductFormPage() {
  const { id } = useParams()
  const { data, isLoading } = useProducts()
  const divisions = useDivisions()
  if ((id && isLoading) || divisions.isLoading) return <p className="text-muted">Loading…</p>
  const p = id ? data?.find((x) => x.id === id) : undefined
  if (id && !p) return <p className="glass p-5">Product not found.</p>
  return (
    <Inner
      id={id}
      divisions={divisions.data ?? []}
      defaults={
        p
          ? {
              name: p.name,
              description: p.description ?? '',
              division_ids: p.division_ids,
              is_active: p.is_active,
            }
          : { name: '', description: '', division_ids: [], is_active: true }
      }
    />
  )
}

function Inner({
  id,
  defaults,
  divisions,
}: {
  id?: string
  defaults: ProductForm
  divisions: { id: string; name: string }[]
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveProduct(id)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProductForm>({ resolver: zodResolver(productSchema), defaultValues: defaults })
  const onSubmit = handleSubmit((v) =>
    save.mutate(v, {
      onSuccess: () => {
        toast(id ? 'Product updated' : 'Product added')
        navigate('/admin/products', { replace: true })
      },
      onError: (e) => toast(e.message, 'error'),
    }),
  )
  return (
    <FormPage
      title={id ? 'Edit product' : 'Add product'}
      saveLabel={id ? 'Save changes' : 'Save product'}
      dirty={isDirty}
      saving={save.isPending}
      onSubmit={onSubmit}
    >
      <Section title="Product details" icon={Pill}>
        <Field label="Product name" required full error={errors.name?.message}>
          <input className={inputCls} placeholder="e.g. Rosvalar-10" {...register('name')} />
        </Field>
        <Field label="Description" full>
          <textarea rows={4} className={inputCls} {...register('description')} />
        </Field>
        <Field
          label="Divisions"
          group
          full
          hint="A product can belong to more than one division. With none selected it only shows under “All Division”."
        >
          <Controller
            control={control}
            name="division_ids"
            render={({ field }) => (
              <div className="chips" role="group" aria-label="Divisions">
                {divisions.map((d) => {
                  const on = field.value.includes(d.id)
                  return (
                    <button
                      key={d.id}
                      type="button"
                      className="chip"
                      aria-pressed={on}
                      onClick={() =>
                        field.onChange(
                          on ? field.value.filter((x) => x !== d.id) : [...field.value, d.id],
                        )
                      }
                    >
                      {on && <Check aria-hidden />}
                      {d.name}
                    </button>
                  )
                })}
              </div>
            )}
          />
        </Field>
      </Section>
      <Section title="Availability" icon={ShieldCheck}>
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <SwitchRow
              label="Active"
              hint="Inactive products are hidden from the starter pack form."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Section>
    </FormPage>
  )
}
