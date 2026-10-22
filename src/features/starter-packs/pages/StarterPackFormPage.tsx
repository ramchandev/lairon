import { useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { CircleCheck, Pill, Plus, Stethoscope, Trash2, UserRound } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { Avatar } from '@/components/Avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field, FormPage, Section } from '@/components/FormPage'
import { SearchSelect } from '@/components/SearchSelect'
import { Segmented } from '@/components/Segmented'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useDivisions } from '@/features/divisions/api'
import { useDoctors } from '@/features/doctors/api'
import { ALL_DIVISION } from '@/features/lookups/cascade'
import { useLookup } from '@/features/lookups/hooks'
import { useProducts } from '@/features/products/api'
import { useUsers } from '@/features/users/api'
import { useCreatePack, usePack } from '../api'
import { productsForDivision } from '../products'
import { emptyItem, packSchema, type PackForm } from '../schemas'

const today = () => new Date().toISOString().slice(0, 10)

/** Staff raise starter packs for themselves; Admin can raise one on behalf of a staff member. */
export function StarterPackFormPage() {
  const { profile } = useAuth()
  const [doneId, setDoneId] = useState<string | null>(null)
  const [round, setRound] = useState(0) // bumping this remounts the form for "New entry"
  const [keep, setKeep] = useState<Pick<PackForm, 'staff_id' | 'staff_name' | 'staff_area'> | null>(
    null,
  )
  if (!profile) return null
  if (doneId)
    return (
      <Done
        id={doneId}
        base={profile.role === 'admin' ? '/admin/starter-packs' : '/staff'}
        onNew={() => {
          setDoneId(null)
          setRound((r) => r + 1)
        }}
      />
    )
  return (
    <Inner
      key={round}
      keep={keep}
      onDone={(id, staff) => {
        setKeep(staff)
        setDoneId(id)
      }}
    />
  )
}

function Done({ id, base, onNew }: { id: string; base: string; onNew: () => void }) {
  const { data } = usePack(id)
  return (
    <section className="glass done mx-auto mt-4 max-w-md">
      <div className="done-ic">
        <CircleCheck />
      </div>
      <h1>Starter pack submitted</h1>
      <p className="muted mt-1.5">Reference number</p>
      <p className="mono done-ref">{data?.ref_no ?? '…'}</p>
      <div className="done-actions">
        <button className="btn btn-primary btn-lg" onClick={onNew}>
          New entry
        </button>
        <Link to={base === '/staff' ? '/staff/requests' : base} className="btn btn-ghost btn-lg">
          {base === '/staff' ? 'My requests' : 'Back to starter packs'}
        </Link>
      </div>
    </section>
  )
}

function Inner({
  keep,
  onDone,
}: {
  keep: Pick<PackForm, 'staff_id' | 'staff_name' | 'staff_area'> | null
  onDone: (id: string, staff: Pick<PackForm, 'staff_id' | 'staff_name' | 'staff_area'>) => void
}) {
  const { profile } = useAuth()
  const isAdmin = profile!.role === 'admin'
  const toast = useToast()
  const create = useCreatePack()
  const divisions = useDivisions()
  const products = useProducts()
  const doctors = useDoctors()
  const qualifications = useLookup('qualification')
  const staff = useUsers('staff')
  const [pendingDivision, setPendingDivision] = useState<string | null>(null)

  const form = useForm<PackForm>({
    resolver: zodResolver(packSchema),
    defaultValues: {
      request_date: today(),
      doctor_id: '',
      doctor_name: '',
      qualification: '',
      doctor_area: '',
      staff_id: keep?.staff_id ?? (isAdmin ? '' : profile!.id),
      staff_name: keep?.staff_name ?? (isAdmin ? '' : profile!.full_name),
      staff_area: keep?.staff_area ?? (isAdmin ? '' : (profile!.area ?? '')),
      division: ALL_DIVISION,
      items: [emptyItem],
    },
  })
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors, isDirty },
  } = form
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })
  const [division, doctorId, doctorName, qualification, items, staffId] = useWatch({
    control,
    name: ['division', 'doctor_id', 'doctor_name', 'qualification', 'items', 'staff_id'],
  })
  const mark = { shouldDirty: true } as const

  const productOptions = productsForDivision(
    products.data ?? [],
    divisions.data ?? [],
    division,
  ).map((p) => ({ value: p.name, label: p.name }))
  const divisionTabs = [
    ...(divisions.data ?? []).filter((d) => d.is_active).map((d) => d.name),
    ALL_DIVISION,
  ]

  function pickDoctor(value: string, label: string) {
    const d = doctors.data?.find((x) => x.id === value)
    if (!d) {
      setValue('doctor_id', '', mark)
      setValue('doctor_name', label, mark)
      return
    }
    setValue('doctor_id', d.id, mark)
    setValue('doctor_name', d.name, mark)
    if (d.qualification) setValue('qualification', d.qualification, mark)
    if (d.area) setValue('doctor_area', d.area, mark)
  }

  function changeDivision(next: string) {
    if (next === division) return
    const hasWork = items.some((i) => i.product_name.trim() || i.quantity.trim())
    if (hasWork)
      setPendingDivision(next) // ask before clearing the rows
    else setValue('division', next, mark)
  }

  const onSubmit = handleSubmit((v) =>
    create.mutate(v, {
      onSuccess: (id) =>
        onDone(id, { staff_id: v.staff_id, staff_name: v.staff_name, staff_area: v.staff_area }),
      onError: (e) => toast(e.message, 'error'),
    }),
  )

  return (
    <FormPage
      title="New starter pack"
      dirty={isDirty}
      saving={create.isPending}
      onSubmit={onSubmit}
      saveLabel="Submit request"
    >
      {isAdmin ? (
        <Section stack title="Staff" icon={UserRound}>
          <Field
            label="Staff member"
            required
            error={errors.staff_name?.message}
            hint="Raising this request on their behalf."
          >
            <select
              className={inputCls}
              value={staffId}
              onChange={(e) => {
                const s = staff.data?.find((x) => x.id === e.target.value)
                setValue('staff_id', s?.id ?? '', mark)
                setValue('staff_name', s?.full_name ?? '', mark)
                setValue('staff_area', s?.area ?? '', mark)
              }}
            >
              <option value="">Choose staff</option>
              {staff.data
                ?.filter((s) => s.is_active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Staff area" required error={errors.staff_area?.message}>
            <input className={inputCls} {...register('staff_area')} />
          </Field>
        </Section>
      ) : (
        <section className="glass notice flex-wrap" aria-label="Raising as">
          <Avatar name={profile!.full_name} url={profile!.avatar_url} />
          <div className="min-w-0 flex-1">
            <p className="muted text-[13px]">Raising as</p>
            <b className="block truncate">{profile!.full_name}</b>
            {profile!.area && <span className="muted text-[13px]">{profile!.area}</span>}
          </div>
          {!profile!.area && (
            <div className="w-full">
              <Field label="Your area" required error={errors.staff_area?.message}>
                <input className={inputCls} {...register('staff_area')} />
              </Field>
            </div>
          )}
        </section>
      )}

      <Section stack title="Doctor" icon={Stethoscope}>
        <Field label="Date" required error={errors.request_date?.message}>
          <input type="date" className={inputCls} {...register('request_date')} />
        </Field>
        <Field
          label="Doctor name"
          required
          error={errors.doctor_name?.message}
          hint="Search the doctor directory, or type a name under Others."
        >
          <SearchSelect
            title="Doctor"
            placeholder="Select doctor"
            allowOther
            value={doctorId || doctorName}
            options={(doctors.data ?? [])
              .filter((d) => d.is_active)
              .map((d) => ({ value: d.id, label: d.area ? `${d.name} · ${d.area}` : d.name }))}
            onChange={pickDoctor}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Qualification" required error={errors.qualification?.message}>
            <SearchSelect
              title="Qualification"
              placeholder="Select qualification"
              allowOther
              value={qualification}
              options={(qualifications.data ?? []).map((q) => ({ value: q.value, label: q.value }))}
              onChange={(v) => setValue('qualification', v, mark)}
            />
          </Field>
          <Field label="Doctor area" required error={errors.doctor_area?.message}>
            <input className={inputCls} {...register('doctor_area')} />
          </Field>
        </div>
      </Section>

      <Section stack title="Products" icon={Pill}>
        <Field group label="Division" error={errors.division?.message}>
          <Segmented
            label="Division"
            options={divisionTabs}
            value={division}
            onChange={changeDivision}
          />
        </Field>
        <ul className="space-y-3">
          {fields.map((f, idx) => (
            <li key={f.id} className="rounded-control border border-line bg-white/60 p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-start">
                <Field
                  label={`Product ${idx + 1}`}
                  required
                  error={errors.items?.[idx]?.product_name?.message}
                >
                  <Controller
                    control={control}
                    name={`items.${idx}.product_name`}
                    render={({ field }) => (
                      <SearchSelect
                        title="Product"
                        placeholder="Select product"
                        allowOther
                        value={field.value}
                        options={productOptions}
                        note={division === ALL_DIVISION ? undefined : `Products for ${division}`}
                        onChange={(v) => {
                          field.onChange(v)
                          setValue(
                            `items.${idx}.product_id`,
                            products.data?.find((p) => p.name === v)?.id ?? '',
                            mark,
                          )
                        }}
                      />
                    )}
                  />
                </Field>
                <Field label="Quantity" required error={errors.items?.[idx]?.quantity?.message}>
                  <input
                    className={inputCls}
                    placeholder="e.g. 1 box"
                    {...register(`items.${idx}.quantity`)}
                  />
                </Field>
                <button
                  type="button"
                  aria-label={`Remove product ${idx + 1}`}
                  onClick={() => (fields.length === 1 ? replace([emptyItem]) : remove(idx))}
                  className="icon-btn danger mt-6 border-line-2 bg-white/70"
                >
                  <Trash2 aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {typeof errors.items?.message === 'string' && (
          <p role="alert" className="text-xs text-danger">
            {errors.items.message}
          </p>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => append(emptyItem)}>
          <Plus aria-hidden /> Add product
        </button>
      </Section>

      <ConfirmDialog
        open={!!pendingDivision}
        title="Switch division?"
        confirmLabel="Switch and clear"
        tone="danger"
        description={
          <>
            The products you added will be cleared, because the list changes to{' '}
            <b>{pendingDivision}</b>.
          </>
        }
        onCancel={() => setPendingDivision(null)}
        onConfirm={() => {
          setValue('division', pendingDivision!, mark)
          replace([emptyItem])
          setPendingDivision(null)
        }}
      />
    </FormPage>
  )
}
