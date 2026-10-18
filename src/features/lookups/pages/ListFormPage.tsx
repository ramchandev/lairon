import { ListPlus } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { Field, FormPage, Section } from '@/components/FormPage'
import { SwitchRow } from '@/components/Switch'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { slugify } from '@/lib/format'
import { useLookupLists, useSaveList } from '../api'

const schema = z.object({
  label: z.string().trim().min(1, 'List name is required'),
  allow_other: z.boolean(),
})
type Form = z.infer<typeof schema>

export function ListFormPage() {
  const { key } = useParams()
  const lists = useLookupLists()
  if (key && lists.isLoading) return <p className="text-muted">Loading…</p>
  const existing = key ? lists.data?.find((l) => l.key === key) : undefined
  if (key && !existing) return <p className="glass p-5">List not found.</p>
  return (
    <Inner
      existingKey={key}
      defaults={{ label: existing?.label ?? '', allow_other: existing?.allow_other ?? false }}
    />
  )
}

function Inner({ existingKey, defaults }: { existingKey?: string; defaults: Form }) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveList(existingKey)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: defaults })
  const onSubmit = handleSubmit((v) => {
    const key = existingKey ?? slugify(v.label)
    if (!key) return toast('Use letters or numbers in the name', 'error')
    save.mutate(
      { key, ...v },
      {
        onSuccess: () => {
          toast(existingKey ? 'List updated' : 'Dropdown list created')
          navigate(`/admin/dropdowns?list=${key}`, { replace: true })
        },
        onError: (e) => toast(e.message, 'error'),
      },
    )
  })
  return (
    <FormPage
      title={existingKey ? 'List settings' : 'New dropdown list'}
      saveLabel={existingKey ? 'Save changes' : 'Create list'}
      dirty={isDirty}
      saving={save.isPending}
      onSubmit={onSubmit}
    >
      <Section title="List details" icon={ListPlus}>
        <Field
          label="List name"
          required
          full
          error={errors.label?.message}
          hint="Becomes a new tab here. A developer then wires it to the form field that should use it."
        >
          <input
            className={inputCls}
            autoFocus
            placeholder="e.g. Guest Type"
            {...register('label')}
          />
        </Field>
        <Controller
          control={control}
          name="allow_other"
          render={({ field }) => (
            <SwitchRow
              label="Allow “Others”"
              hint="Forms show an “Others” choice that opens a free-text box."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Section>
    </FormPage>
  )
}
