import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/app/AuthProvider'
import { Field, FormPage, Section } from '@/components/FormPage'
import { Building2, GraduationCap, ShieldCheck, Stethoscope } from 'lucide-react'
import { SwitchRow } from '@/components/Switch'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useLookup } from '@/features/lookups/hooks'
import { useUsers } from '@/features/users/api'
import { formatPhone } from '@/lib/phone'
import { useDoctor, useSaveDoctor } from '../api'
import { ProfessionalFields } from '../components/ProfessionalFields'
import { doctorPaths } from '../paths'
import { doctorSchema, type DoctorForm } from '../schemas'

export function DoctorFormPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const doctor = useDoctor(id)
  if (!profile || (id && doctor.isLoading)) return <p className="text-muted">Loading…</p>
  if (id && !doctor.data) return <p className="glass p-5">Doctor not found.</p>
  const d = doctor.data
  const defaults: DoctorForm = {
    name: d?.name ?? '',
    phone: d?.phone ? formatPhone(d.phone).replace('+91 ', '') : '',
    email: d?.email ?? '',
    division: d?.division ?? '',
    qualification: d?.qualification ?? '',
    speciality: d?.speciality ?? '',
    area: d?.area ?? '',
    hospital_name: d?.hospital_name ?? '',
    pharmacy_name: d?.pharmacy_name ?? '',
    hq: d?.hq ?? '',
    notes: d?.notes ?? '',
    manager_id: d?.manager_id ?? (profile.role === 'manager' ? profile.id : ''),
    is_active: d?.is_active ?? true,
  }
  return <Inner id={id} defaults={defaults} />
}

function Inner({ id, defaults }: { id?: string; defaults: DoctorForm }) {
  const { profile } = useAuth()
  const role = profile!.role
  const isAdmin = role === 'admin'
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveDoctor(id)
  const hqs = useLookup('hq')
  const managers = useUsers('manager')
  const {
    register,
    control,
    setValue,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<DoctorForm>({ resolver: zodResolver(doctorSchema), defaultValues: defaults })
  const paths = doctorPaths(role)
  const [division, qualification, speciality] = useWatch({
    control,
    name: ['division', 'qualification', 'speciality'],
  })

  const onSubmit = handleSubmit((v) => {
    if (!v.manager_id) return setError('manager_id', { message: 'Choose a Doctor’s Manager' })
    save.mutate(v, {
      onSuccess: () => {
        toast(id ? 'Doctor updated' : 'Doctor added')
        navigate(paths.list, { replace: true })
      },
      onError: (e) => toast(e.message, 'error'),
    })
  })

  const mark = { shouldDirty: true } as const
  return (
    <FormPage
      title={id ? 'Edit doctor' : 'Add doctor'}
      saveLabel={id ? 'Save changes' : 'Save doctor'}
      dirty={isDirty}
      saving={save.isPending}
      onSubmit={onSubmit}
    >
      <Section title="Doctor details" icon={Stethoscope}>
        <Field label="Doctor name" required error={errors.name?.message}>
          <input className={inputCls} placeholder="e.g. Dr. Anitha Rao" {...register('name')} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <div className="input-group">
            <span className="prefix">+91</span>
            <input
              className={`${inputCls} mono`}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="Optional"
              {...register('phone')}
            />
          </div>
        </Field>
        {isAdmin && (
          <Field
            label="Doctor’s Manager"
            required
            error={errors.manager_id?.message}
            hint="Changing this reassigns the doctor. Past requests are unaffected."
          >
            <select className={inputCls} {...register('manager_id')}>
              <option value="">Select doctor’s manager</option>
              {managers.data
                ?.filter((m) => m.is_active || m.id === defaults.manager_id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                    {m.is_active ? '' : ' (inactive)'}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label="HQ">
          <select className={inputCls} {...register('hq')}>
            <option value="">Select hq</option>
            {defaults.hq && !hqs.data?.some((h) => h.value === defaults.hq) && (
              <option value={defaults.hq}>{defaults.hq}</option>
            )}
            {hqs.data?.map((h) => (
              <option key={h.id} value={h.value}>
                {h.value}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input className={inputCls} type="email" placeholder="Optional" {...register('email')} />
        </Field>
      </Section>

      <Section title="Professional details" icon={GraduationCap}>
        <ProfessionalFields
          value={{ division, qualification, speciality }}
          onChange={(p) => {
            setValue('division', p.division, mark)
            setValue('qualification', p.qualification, mark)
            setValue('speciality', p.speciality, mark)
          }}
        />
      </Section>

      <Section title="Practice" icon={Building2}>
        <Field label="Hospital name">
          <input className={inputCls} {...register('hospital_name')} />
        </Field>
        <Field label="Pharmacy name">
          <input className={inputCls} {...register('pharmacy_name')} />
        </Field>
        <Field label="Area">
          <input className={inputCls} {...register('area')} />
        </Field>
        <Field label="Notes" full error={errors.notes?.message}>
          <textarea rows={3} className={inputCls} {...register('notes')} />
        </Field>
      </Section>

      <Section title="Access" icon={ShieldCheck}>
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <SwitchRow
              label="Active"
              hint="Inactive doctors are hidden from request forms."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Section>
    </FormPage>
  )
}
