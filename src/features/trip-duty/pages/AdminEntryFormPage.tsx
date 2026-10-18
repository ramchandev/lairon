import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Field, FormPage, Section } from '@/components/FormPage'
import { Segmented } from '@/components/Segmented'
import { SwitchRow } from '@/components/Switch'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useLookup } from '@/features/lookups/hooks'
import { useUsers } from '@/features/users/api'
import { useVehicles } from '@/features/vehicles/api'
import { vehicleLabel } from '@/lib/format'
import { useEntry } from '../api'
import { useAdminSaveDuty } from '../admin-api'
import { tripSummary, tripText, vehicleChoice, type DayEntry } from '../logic'
import { adminDutySchema, isFleet, type DutyForm } from '../schemas'

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')
const numStr = (n: number | null) => (n === null || n === undefined ? '' : String(n))

/** Admin add/edit of any driver's duty. Looser than the driver form: imported rows may have no times or KM. */
export function AdminEntryFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const entry = useEntry(id)
  const drivers = useUsers('driver')
  if ((id && entry.isLoading) || drivers.isLoading) return <p className="text-muted">Loading…</p>
  if (id && (!entry.data || entry.data.entry_type !== 'duty'))
    return <p className="glass p-5">Duty not found.</p>
  const driverId = entry.data?.driver_id ?? params.get('driver') ?? ''
  const driverName =
    drivers.data?.find((d) => d.id === driverId)?.full_name ?? entry.data?.driver_name ?? 'Driver'
  if (!driverId) return <p className="glass p-5">Choose a driver from Trip duty first.</p>
  return (
    <Inner
      id={id}
      entry={entry.data ?? undefined}
      driverId={driverId}
      driverName={driverName}
      date={params.get('date') ?? ''}
      backMonth={params.get('m') ?? ''}
    />
  )
}

function Inner({
  id,
  entry,
  driverId,
  driverName,
  date,
  backMonth,
}: {
  id?: string
  entry?: DayEntry
  driverId: string
  driverName: string
  date: string
  backMonth: string
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const vehicles = useVehicles()
  const dutyTypes = useLookup('duty_type')
  const save = useAdminSaveDuty({ id, driverId })
  const isOther = entry?.vehicle_source === 'other'
  const defaults: DutyForm = {
    entry_date: entry?.entry_date ?? date,
    duty_type: entry?.duty_type ?? 'Local',
    vehicle: entry ? vehicleChoice(entry) : '',
    other_details: isOther ? (entry?.vehicle_label ?? '').replace(/^Others · /, '') : '',
    guest_name: entry?.guest_name ?? '',
    guest_area: entry?.guest_area ?? '',
    pickup_point: entry?.pickup_point ?? '',
    drop_point: entry?.drop_point ?? '',
    start_km: numStr(entry?.start_km ?? null),
    start_time: hhmm(entry?.start_time ?? null),
    finished: entry ? entry.duty_status === 'closed' : true,
    end_km: numStr(entry?.end_km ?? null),
    end_time: hhmm(entry?.end_time ?? null),
    fuel_litres: numStr(entry?.fuel_litres ?? null),
    fuel_amount: numStr(entry?.fuel_amount ?? null),
  }
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<DutyForm>({ resolver: zodResolver(adminDutySchema), defaultValues: defaults })
  const [vehicle, finished, startKm, endKm, startTime, endTime, dutyType] = useWatch({
    control,
    name: ['vehicle', 'finished', 'start_km', 'end_km', 'start_time', 'end_time', 'duty_type'],
  })
  const fleet = isFleet(vehicle)
  const live = tripText(
    tripSummary({
      startKm,
      endKm: finished ? endKm : '',
      startTime,
      endTime: finished ? endTime : '',
    }),
  )
  const typeOptions = dutyTypes.data?.length
    ? dutyTypes.data.map((d) => d.value)
    : ['Local', 'Out Station']
  const month = backMonth || (entry?.entry_date ?? date).slice(0, 7)

  const onSubmit = handleSubmit((v) =>
    save.mutate(
      { v, vehicles: vehicles.data ?? [] },
      {
        onSuccess: () => {
          toast(id ? 'Duty updated' : 'Duty added')
          navigate(`/admin/trip-duty?tab=month&driver=${driverId}&m=${month}`, { replace: true })
        },
        onError: (e) => toast(e.message, 'error'),
      },
    ),
  )

  return (
    <FormPage
      title={id ? 'Edit duty' : 'Add duty'}
      subtitle={`${driverName}${entry?.entry_source === 'import' ? ' · imported entry' : ''}`}
      dirty={isDirty}
      saving={save.isPending}
      onSubmit={onSubmit}
    >
      <Section stack title="Duty">
        <Field label="Date" required error={errors.entry_date?.message}>
          <input type="date" className={inputCls} {...register('entry_date')} />
        </Field>
        <Field group label="Duty type *" error={errors.duty_type?.message}>
          <Segmented
            label="Duty type"
            options={typeOptions}
            value={dutyType}
            onChange={(v) => setValue('duty_type', v, { shouldDirty: true })}
          />
        </Field>
        <Field label="Vehicle" required error={errors.vehicle?.message}>
          <select className={inputCls} {...register('vehicle')}>
            <option value="">Select vehicle</option>
            {vehicles.data
              ?.filter((v) => v.is_active || `fleet:${v.id}` === defaults.vehicle)
              .map((v) => (
                <option key={v.id} value={`fleet:${v.id}`}>
                  {vehicleLabel(v.name, v.vehicle_number)}
                </option>
              ))}
            <option value="own">Own (guest’s vehicle)</option>
            <option value="other">Others</option>
          </select>
        </Field>
        {vehicle === 'other' && (
          <Field label="Vehicle details" required error={errors.other_details?.message}>
            <input className={inputCls} {...register('other_details')} />
          </Field>
        )}
      </Section>
      <Section stack title="Guest & route">
        <Field label="Guest name" required error={errors.guest_name?.message}>
          <input className={inputCls} {...register('guest_name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Guest area">
            <input className={inputCls} {...register('guest_area')} />
          </Field>
          <Field label="Pickup point">
            <input className={inputCls} {...register('pickup_point')} />
          </Field>
          <Field label="Drop point">
            <input className={inputCls} {...register('drop_point')} />
          </Field>
        </div>
      </Section>
      <Section stack title="Times, KM & fuel">
        <div className="grid gap-4 sm:grid-cols-2">
          {fleet && (
            <Field label="Starting KM" error={errors.start_km?.message}>
              <input
                className={`${inputCls} tabular`}
                inputMode="numeric"
                {...register('start_km')}
              />
            </Field>
          )}
          <Field label="Starting time" error={errors.start_time?.message}>
            <input type="time" className={inputCls} {...register('start_time')} />
          </Field>
        </div>
        <Controller
          control={control}
          name="finished"
          render={({ field }) => (
            <SwitchRow
              label="Closed duty"
              hint="Only closed duties earn beta."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {finished && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {fleet && (
                <Field label="Ending KM" error={errors.end_km?.message}>
                  <input
                    className={`${inputCls} tabular`}
                    inputMode="numeric"
                    {...register('end_km')}
                  />
                </Field>
              )}
              <Field label="Closing time" error={errors.end_time?.message}>
                <input type="time" className={inputCls} {...register('end_time')} />
              </Field>
              <Field label="Fuel (litres)" error={errors.fuel_litres?.message}>
                <input
                  className={`${inputCls} tabular`}
                  inputMode="decimal"
                  {...register('fuel_litres')}
                />
              </Field>
              <Field label="Fuel amount (₹)" error={errors.fuel_amount?.message}>
                <input
                  className={`${inputCls} tabular`}
                  inputMode="decimal"
                  {...register('fuel_amount')}
                />
              </Field>
            </div>
            {live && (
              <p
                aria-live="polite"
                className="rounded-control bg-primary-soft p-3 text-sm font-bold text-primary tabular"
              >
                {live}
              </p>
            )}
            <p className="text-xs text-muted">
              Total KM and hours are recalculated from the start/end values. For imported rows with
              a stated total, leave KM empty to keep it.
            </p>
          </>
        )}
      </Section>
    </FormPage>
  )
}
