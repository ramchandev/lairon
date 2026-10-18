import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { Calendar, Play, UserRound } from 'lucide-react'
import { Field, FormPage, Section } from '@/components/FormPage'
import { Segmented } from '@/components/Segmented'
import { SwitchRow } from '@/components/Switch'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useLookup } from '@/features/lookups/hooks'
import { useVehicles } from '@/features/vehicles/api'
import { vehicleLabel } from '@/lib/format'
import { addDays, istParts } from '@/lib/time'
import { useEditWindow, useEntry, useLastKm, useSaveDuty } from '../api'
import { tripSummary, tripText, vehicleChoice, type DayEntry } from '../logic'
import { dutySchema, isFleet, type DutyForm } from '../schemas'

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')
/** Saved end date, or (older rows) the next day when the closing time is earlier than the start. */
const endDateOf = (e: DayEntry) =>
  e.end_date ??
  (e.end_time && e.start_time && e.end_time < e.start_time
    ? addDays(e.entry_date, 1)
    : e.entry_date)
const numStr = (n: number | null) => (n === null || n === undefined ? '' : String(n))

export function DutyFormPage() {
  const { id } = useParams()
  const entry = useEntry(id)
  const windowDays = useEditWindow()
  if ((id && entry.isLoading) || windowDays.isLoading) return <p className="text-muted">Loading…</p>
  if (id && (!entry.data || entry.data.entry_type !== 'duty'))
    return <p className="glass p-5">Duty not found.</p>
  return <Inner id={id} entry={entry.data ?? undefined} windowDays={windowDays.data ?? 7} />
}

function Inner({ id, entry, windowDays }: { id?: string; entry?: DayEntry; windowDays: number }) {
  const navigate = useNavigate()
  const toast = useToast()
  const now = istParts()
  const minDate = addDays(now.date, -windowDays)
  const vehicles = useVehicles()
  const dutyTypes = useLookup('duty_type')
  const save = useSaveDuty(id)
  const locked = !!entry && entry.entry_date < minDate

  const isOther = entry?.vehicle_source === 'other'
  const defaults: DutyForm = {
    entry_date: entry?.entry_date ?? now.date,
    duty_type: entry?.duty_type ?? 'Local',
    vehicle: entry ? vehicleChoice(entry) : '',
    other_details: isOther ? (entry?.vehicle_label ?? '').replace(/^Others · /, '') : '',
    guest_name: entry?.guest_name ?? '',
    guest_area: entry?.guest_area ?? '',
    pickup_point: entry?.pickup_point ?? '',
    drop_point: entry?.drop_point ?? '',
    start_km: numStr(entry?.start_km ?? null),
    start_time: entry ? hhmm(entry.start_time) : now.time,
    finished: entry?.duty_status === 'closed',
    end_km: numStr(entry?.end_km ?? null),
    end_time: hhmm(entry?.end_time ?? null),
    end_date: entry ? endDateOf(entry) : now.date,
    fuel_litres: numStr(entry?.fuel_litres ?? null),
    fuel_amount: numStr(entry?.fuel_amount ?? null),
  }
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<DutyForm>({ resolver: zodResolver(dutySchema), defaultValues: defaults })
  const [vehicle, finished, startKm, endKm, startTime, endTime, dutyType, entryDate, endDate] =
    useWatch({
      control,
      name: [
        'vehicle',
        'finished',
        'start_km',
        'end_km',
        'start_time',
        'end_time',
        'duty_type',
        'entry_date',
        'end_date',
      ],
    })
  const fleet = isFleet(vehicle)
  const lastKm = useLastKm(fleet ? vehicle.slice(6) : undefined)
  const wasClosed = entry?.duty_status === 'closed'
  // Live totals are derived, never stored in form state, so typing never re-renders the sections.
  const live = tripText(
    tripSummary({
      startKm,
      endKm: finished ? endKm : '',
      startTime,
      endTime: finished ? endTime : '',
      startDate: entryDate,
      endDate: finished ? endDate : '',
    }),
  )
  const lowKm =
    fleet && lastKm.data != null && startKm.trim() !== '' && Number(startKm) < lastKm.data

  const typeOptions = dutyTypes.data?.length
    ? dutyTypes.data.map((d) => d.value)
    : ['Local', 'Out Station']
  const onSubmit = handleSubmit((v) =>
    save.mutate(
      { v, vehicles: vehicles.data ?? [] },
      {
        onSuccess: () => {
          toast(v.finished ? 'Duty submitted' : id ? 'Duty updated' : 'Duty started')
          navigate('/driver', { replace: true })
        },
        onError: (e) => toast(e.message, 'error'),
      },
    ),
  )

  if (locked)
    return (
      <p className="glass p-5">
        This duty is older than {windowDays} days, so only an admin can change it.
      </p>
    )

  return (
    <FormPage
      title={id ? 'Edit duty' : 'Start duty'}
      dirty={isDirty}
      saving={save.isPending}
      onSubmit={onSubmit}
      saveLabel={finished ? 'Submit duty' : id ? 'Save' : 'Start duty'}
    >
      <Section stack title="Duty" icon={Calendar}>
        <Field
          label="Date"
          required
          error={errors.entry_date?.message}
          hint={`You can enter duties from the last ${windowDays} days.`}
        >
          <input
            type="date"
            className={inputCls}
            min={minDate}
            max={now.date}
            {...register('entry_date')}
          />
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
            <option value="driver_own">Own car (driver’s)</option>
            <option value="own">Own (guest’s vehicle)</option>
            <option value="other">Others</option>
          </select>
        </Field>
        {vehicle === 'other' && (
          <Field label="Vehicle details" required error={errors.other_details?.message}>
            <input
              className={inputCls}
              placeholder="e.g. Audi, hired taxi"
              {...register('other_details')}
            />
          </Field>
        )}
      </Section>

      <Section stack title="Guest" icon={UserRound}>
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

      <Section stack title="Start" icon={Play}>
        <div className="grid gap-4 sm:grid-cols-2">
          {fleet && (
            <Field
              label="Starting KM"
              required
              error={errors.start_km?.message}
              hint={
                lastKm.data != null
                  ? `Last closing KM on this vehicle: ${lastKm.data.toLocaleString('en-IN')}`
                  : undefined
              }
            >
              <input
                className={`${inputCls} tabular`}
                inputMode="numeric"
                {...register('start_km')}
              />
            </Field>
          )}
          <Field label="Starting time" required error={errors.start_time?.message}>
            <input type="time" className={inputCls} {...register('start_time')} />
          </Field>
        </div>
        {lowKm && (
          <p role="status" className="rounded-control bg-warn-bg p-3 text-sm text-warn">
            Starting KM is lower than the last closing KM ({lastKm.data}). Please double-check — you
            can still continue.
          </p>
        )}
      </Section>

      <Section stack>
        {!wasClosed && (
          <Controller
            control={control}
            name="finished"
            render={({ field }) => (
              <SwitchRow
                label="Duty already finished?"
                hint="Turn on to enter the end details now."
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        )}
        {finished && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {fleet && (
                <Field label="Ending KM" required error={errors.end_km?.message}>
                  <input
                    className={`${inputCls} tabular`}
                    inputMode="numeric"
                    {...register('end_km')}
                  />
                </Field>
              )}
              <Field
                label="Trip end date"
                required
                error={errors.end_date?.message}
                hint="The day the trip ended. Beta is counted on the start date."
              >
                <input type="date" className={inputCls} min={entryDate} {...register('end_date')} />
              </Field>
              <Field label="Closing time" required error={errors.end_time?.message}>
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
          </>
        )}
      </Section>
    </FormPage>
  )
}
