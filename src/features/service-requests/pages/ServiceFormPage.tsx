import { useEffect, useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Field, FormPage, Section } from '@/components/FormPage'
import { Segmented } from '@/components/Segmented'
import { SearchSelect } from '@/components/SearchSelect'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useDoctors } from '@/features/doctors/api'
import { ProfessionalFields } from '@/features/doctors/components/ProfessionalFields'
import { useLookup } from '@/features/lookups/hooks'
import { isNetrate, isOffer, serviceSchema, type ServiceForm } from '../schemas'
import { useDraftBatch, useEnsureDraft, useSaveService, type Service } from '../api'

const today = () => new Date().toISOString().slice(0, 10)
const money = (n: number | null) => (n === null || n === undefined ? '' : String(n))

export function ServiceFormPage() {
  const { id } = useParams()
  const draft = useDraftBatch()
  const ensure = useEnsureDraft()
  const asked = useRef(false)
  useEffect(() => {
    if (draft.isSuccess && !draft.data && !asked.current) {
      asked.current = true
      ensure.mutate()
    }
  }, [draft.isSuccess, draft.data, ensure])

  if (draft.isLoading || !draft.data) return <p className="text-muted">Loading…</p>
  const existing = id ? draft.data.services.find((s) => s.id === id) : undefined
  if (id && !existing)
    return <p className="glass p-5">Service not found, or the request was already submitted.</p>
  return <Inner batchId={draft.data.id} id={id} existing={existing} />
}

function Inner({ batchId, id, existing }: { batchId: string; id?: string; existing?: Service }) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveService(batchId, id)
  const doctors = useDoctors()
  const hqs = useLookup('hq')
  const serviceTypes = useLookup('service_type')
  const offerTypes = useLookup('offer_type')

  const defaults: ServiceForm = {
    request_date: existing?.request_date ?? today(),
    doctor_id: existing?.doctor_id ?? '',
    doctor_name: existing?.doctor_name ?? '',
    save_as_doctor: false,
    area: existing?.area ?? '',
    hospital_name: existing?.hospital_name ?? '',
    pharmacy_name: existing?.pharmacy_name ?? '',
    hq: existing?.hq ?? '',
    division: existing?.division ?? '',
    qualification: existing?.qualification ?? '',
    speciality: existing?.speciality ?? '',
    service_amount: money(existing?.service_amount ?? null),
    service_type: existing?.service_type ?? '',
    expected_business_value: money(existing?.expected_business_value ?? null),
    current_business_value: money(existing?.current_business_value ?? null),
    offer_type: existing?.offer_type ?? '',
    offer_percent: money(existing?.offer_percent ?? null),
    netrate_amount: money(existing?.netrate_amount ?? null),
  }
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ServiceForm>({ resolver: zodResolver(serviceSchema), defaultValues: defaults })
  const [doctorId, doctorName, division, qualification, speciality, offerType, serviceType] =
    useWatch({
      control,
      name: [
        'doctor_id',
        'doctor_name',
        'division',
        'qualification',
        'speciality',
        'offer_type',
        'service_type',
      ],
    })
  const mark = { shouldDirty: true } as const

  const activeDoctors = (doctors.data ?? []).filter((d) => d.is_active || d.id === doctorId)
  function pickDoctor(value: string, label: string) {
    const d = activeDoctors.find((x) => x.id === value)
    if (!d) {
      setValue('doctor_id', '', mark)
      setValue('doctor_name', label, mark)
      return
    } // typed: a new doctor
    setValue('doctor_id', d.id, mark)
    setValue('doctor_name', d.name, mark)
    setValue('save_as_doctor', false, mark)
    // Autofill what the doctor profile already knows.
    const fill = (
      k:
        | 'area'
        | 'hospital_name'
        | 'pharmacy_name'
        | 'hq'
        | 'division'
        | 'qualification'
        | 'speciality',
      v: string | null,
    ) => v && setValue(k, v, mark)
    fill('area', d.area)
    fill('hospital_name', d.hospital_name)
    fill('pharmacy_name', d.pharmacy_name)
    fill('hq', d.hq)
    setValue('division', d.division ?? '', mark)
    setValue('qualification', d.qualification ?? '', mark)
    setValue('speciality', d.speciality ?? '', mark)
  }

  // "Request service" on a doctor card opens this form with ?doctor=<id> already chosen.
  const [params] = useSearchParams()
  const wanted = params.get('doctor')
  const preset = useRef(false)
  useEffect(() => {
    if (preset.current || existing || !wanted || !doctors.data) return
    preset.current = true
    pickDoctor(wanted, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, doctors.data, existing])

  const offerOptions = offerTypes.data?.length
    ? offerTypes.data.map((o) => o.value)
    : ['Offer', 'Netrate']
  const onSubmit = handleSubmit((v) =>
    save.mutate(v, {
      onSuccess: () => {
        toast(id ? 'Service updated' : 'Service added')
        navigate('/m/request', { replace: true })
      },
      onError: (e) => toast(e.message, 'error'),
    }),
  )

  return (
    <FormPage
      title={id ? 'Edit service' : 'Add service'}
      dirty={isDirty}
      saving={save.isPending}
      onSubmit={onSubmit}
      saveLabel={id ? 'Save service' : 'Add service'}
    >
      <Section stack title="Basic information">
        <Field label="Date" required error={errors.request_date?.message}>
          <input type="date" className={inputCls} {...register('request_date')} />
        </Field>
        <Field
          label="Doctor name"
          required
          error={errors.doctor_name?.message}
          hint="Pick one of your doctors to autofill, or type a new name under Others."
        >
          <SearchSelect
            title="Doctor"
            placeholder="Select doctor"
            allowOther
            value={doctorId || doctorName}
            options={activeDoctors.map((d) => ({ value: d.id, label: d.name }))}
            onChange={pickDoctor}
          />
        </Field>
        {!doctorId && doctorName && (
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-5 accent-[#2b5cc6]"
              {...register('save_as_doctor')}
            />{' '}
            Also save to My Doctors
          </label>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Area" required error={errors.area?.message}>
            <input className={inputCls} {...register('area')} />
          </Field>
          <Field label="HQ" required error={errors.hq?.message}>
            <select className={inputCls} {...register('hq')}>
              <option value="">Select HQ</option>
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
          <Field label="Hospital name" required error={errors.hospital_name?.message}>
            <input className={inputCls} {...register('hospital_name')} />
          </Field>
          <Field label="Pharmacy name">
            <input className={inputCls} {...register('pharmacy_name')} />
          </Field>
        </div>
      </Section>

      <Section title="Professional details">
        <ProfessionalFields
          value={{ division, qualification, speciality }}
          errors={{
            division: errors.division?.message,
            qualification: errors.qualification?.message,
            speciality: errors.speciality?.message,
          }}
          onChange={(p) => {
            setValue('division', p.division, mark)
            setValue('qualification', p.qualification, mark)
            setValue('speciality', p.speciality, mark)
          }}
        />
      </Section>

      <Section stack title="Service & business details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Service amount (₹)" required error={errors.service_amount?.message}>
            <input
              className={`${inputCls} tabular`}
              inputMode="decimal"
              {...register('service_amount')}
            />
          </Field>
          <Field label="Service type" required error={errors.service_type?.message}>
            {serviceTypes.data?.length ? (
              <SearchSelect
                title="Service type"
                placeholder="Select service type"
                allowOther
                value={serviceType}
                options={serviceTypes.data.map((s) => ({ value: s.value, label: s.value }))}
                onChange={(v) => setValue('service_type', v, mark)}
              />
            ) : (
              <input
                className={inputCls}
                placeholder="e.g. Camp, CME"
                {...register('service_type')}
              />
            )}
          </Field>
          <Field
            label="Expected business value (₹)"
            required
            error={errors.expected_business_value?.message}
          >
            <input
              className={`${inputCls} tabular`}
              inputMode="decimal"
              {...register('expected_business_value')}
            />
          </Field>
          <Field
            label="Current business value (₹)"
            required
            error={errors.current_business_value?.message}
          >
            <input
              className={`${inputCls} tabular`}
              inputMode="decimal"
              {...register('current_business_value')}
            />
          </Field>
        </div>
        <Field group label="Offer / Netrate *" error={errors.offer_type?.message}>
          <Controller
            control={control}
            name="offer_type"
            render={({ field }) => (
              <Segmented
                label="Offer or Netrate"
                options={offerOptions}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
        {isOffer(offerType) && (
          <Field label="Offer %" required error={errors.offer_percent?.message}>
            <input
              className={`${inputCls} tabular`}
              inputMode="decimal"
              {...register('offer_percent')}
            />
          </Field>
        )}
        {isNetrate(offerType) && (
          <Field label="Netrate amount (₹)" required error={errors.netrate_amount?.message}>
            <input
              className={`${inputCls} tabular`}
              inputMode="decimal"
              {...register('netrate_amount')}
            />
          </Field>
        )}
      </Section>
    </FormPage>
  )
}
