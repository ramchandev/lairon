import { ListChecks } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { Field, FormPage, Section } from '@/components/FormPage'
import { SwitchRow } from '@/components/Switch'
import { useToast } from '@/components/Toast'
import { useSubTitle } from '@/layouts/chrome'
import { inputCls } from '@/components/form-styles'
import { useAllLookupItems, useLookupLists, useSaveItem } from '../api'

const schema = z.object({
  value: z.string().trim().min(1, 'Enter a value'),
  is_active: z.boolean(),
})
type Form = z.infer<typeof schema>

export function ItemFormPage() {
  const { key = '', id } = useParams()
  const lists = useLookupLists()
  const items = useAllLookupItems()
  if (lists.isLoading || items.isLoading) return <p className="text-muted">Loading…</p>
  const list = lists.data?.find((l) => l.key === key)
  const item = id ? items.data?.find((i) => i.id === id) : undefined
  if (!list || (id && !item)) return <p className="glass p-5">Not found.</p>
  const last = Math.max(
    0,
    ...(items.data ?? []).filter((i) => i.list_key === key).map((i) => i.sort_order),
  )
  return (
    <Inner
      listKey={key}
      listLabel={list.label}
      id={id}
      nextOrder={last + 1}
      defaults={{ value: item?.value ?? '', is_active: item?.is_active ?? true }}
    />
  )
}

function Inner({
  listKey,
  listLabel,
  id,
  defaults,
  nextOrder,
}: {
  listKey: string
  listLabel: string
  id?: string
  defaults: Form
  nextOrder: number
}) {
  const navigate = useNavigate()
  const toast = useToast()
  useSubTitle(`${id ? 'Edit' : 'Add'} ${listLabel} item`)
  const save = useSaveItem(id)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: defaults })
  const onSubmit = handleSubmit((v) =>
    save.mutate(
      { ...v, list_key: listKey, sort_order: nextOrder },
      {
        onSuccess: () => {
          toast(id ? 'Item updated' : 'Item added')
          navigate(`/admin/dropdowns?list=${listKey}`, { replace: true })
        },
        onError: (e) => toast(e.message, 'error'),
      },
    ),
  )
  return (
    <FormPage
      title={id ? `Edit ${listLabel} item` : `Add ${listLabel} item`}
      saveLabel="Save item"
      dirty={isDirty}
      saving={save.isPending}
      onSubmit={onSubmit}
    >
      <Section title={listLabel} icon={ListChecks}>
        <Field
          label="Value"
          required
          full
          error={errors.value?.message}
          hint={
            id ? 'Renaming only affects new entries. Saved records keep the old text.' : undefined
          }
        >
          <input
            className={inputCls}
            autoFocus
            placeholder="Enter option text"
            {...register('value')}
          />
        </Field>
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <SwitchRow
              label="Active"
              hint="Inactive items are hidden from forms."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Section>
    </FormPage>
  )
}
