import { useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { DataTable, type Column } from '@/components/DataTable'
import { Field } from '@/components/FormPage'
import { PageHeader } from '@/components/FormPage'
import { SearchSelect } from '@/components/SearchSelect'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useDoctors } from '@/features/doctors/api'
import { currentMonthKey } from '@/features/doctors/revenue'
import { useLocations, useManagerLocations, type Location } from '@/features/locations/api'
import { istParts, monthLabel, monthOf, shiftMonth } from '@/lib/time'
import {
  datesOf,
  isDeviation,
  useDailyLogs,
  useDoctorCalls,
  useSaveDay,
  type ActivityType,
  type CallKind,
  type DailyLog,
  type DayType,
  type DoctorCall,
} from '../activity'
import { ManagerPicker, useManagerChoice } from '../components/ManagerPicker'

const DAY_TYPES: Record<DayType, string> = {
  field: 'Field work',
  meeting: 'Meeting / admin',
  weekoff: 'Week off',
  holiday: 'Holiday',
  leave: 'Leave',
}
const KINDS: Record<CallKind, string> = {
  planned_met: 'Planned call — met',
  missed: 'Planned call — missed',
  unplanned_met: 'Met, not planned',
}
const ACTIVITIES: Record<string, string> = {
  '': 'No activity',
  camp: 'Camp',
  cme: 'CME',
  other: 'Other',
}
const dayName = (d: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${d}T00:00:00Z`))

/** Manager: the day's tour plan vs actual and the doctors met. */
export const DailyLogPage = () => <DailyLogView />

/** Admin: the same, for a chosen manager. */
export function AdminDailyLogPage() {
  const { managerId, setManagerId, managers } = useManagerChoice()
  return (
    <>
      <ManagerPicker managers={managers} value={managerId} onChange={setManagerId} />
      {managerId ? (
        <DailyLogView managerId={managerId} />
      ) : (
        <p className="glass p-5 text-muted">Choose a manager to see or correct their daily log.</p>
      )}
    </>
  )
}

function DailyLogView({ managerId }: { managerId?: string }) {
  const { profile } = useAuth()
  const today = istParts().date
  const [day, setDay] = useState(today)
  const month = monthOf(day)
  const who = managerId ?? profile?.id ?? ''
  const range = { managerId: who || undefined, from: `${month}-01`, to: datesOf(month).at(-1)! }
  const logs = useDailyLogs(range)
  const calls = useDoctorCalls(range)
  const locations = useLocations()
  const mine = useManagerLocations()
  const covered = (locations.data ?? []).filter((l) => (mine.data?.[who] ?? []).includes(l.id))
  const isAdmin = profile?.role === 'admin'

  const log = logs.data?.find((l) => l.day === day)
  const dayCalls = (calls.data ?? []).filter((c) => c.day === day)

  const columns: Column<string>[] = [
    { key: 'd', header: 'Date', primary: true, cell: (d) => <b>{dayName(d)}</b> },
    {
      key: 't',
      header: 'Type',
      cell: (d) => {
        const l = logs.data?.find((x) => x.day === d)
        return l ? DAY_TYPES[l.day_type] : '—'
      },
    },
    {
      key: 'p',
      header: 'TP planned',
      cell: (d) => logs.data?.find((x) => x.day === d)?.tp_planned || '—',
    },
    {
      key: 'a',
      header: 'Actual work',
      cell: (d) => logs.data?.find((x) => x.day === d)?.actual_work || '—',
    },
    {
      key: 'v',
      header: 'Deviation',
      cell: (d) => {
        const l = logs.data?.find((x) => x.day === d)
        return !l ? '—' : l.deviation ? <b className="text-warn">Yes</b> : 'No'
      },
    },
    {
      key: 'c',
      header: 'Doctors met',
      cell: (d) =>
        (calls.data ?? []).filter((c) => c.day === d && c.kind !== 'missed').length || '—',
    },
  ]

  return (
    <>
      <PageHeader title="Daily Log" subtitle="Tour plan vs actual, and the doctors met each day" />
      <div className="toolbar">
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-sm"
            aria-label="Previous month"
            onClick={() => setDay(`${shiftMonth(month, -1)}-01`)}
          >
            <ChevronLeft aria-hidden />
          </button>
          <b className="min-w-36 text-center">{monthLabel(month)}</b>
          <button
            className="btn btn-ghost btn-sm"
            aria-label="Next month"
            onClick={() => setDay(`${shiftMonth(month, 1)}-01`)}
          >
            <ChevronRight aria-hidden />
          </button>
        </div>
        <input
          type="date"
          aria-label="Day"
          className={`${inputCls} !w-44`}
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
        />
        <button className="btn btn-ghost btn-sm" onClick={() => setDay(today)}>
          Today
        </button>
      </div>

      {mine.isSuccess && covered.length === 0 ? (
        <p className="glass p-5">
          No location is assigned {isAdmin ? 'to this manager' : 'to you'} yet.{' '}
          {isAdmin
            ? 'Assign one under People → Managers → Edit.'
            : 'Ask an admin to assign your locations.'}
        </p>
      ) : (
        <DayForm
          key={`${who}|${day}|${log ? 'saved' : 'new'}`}
          managerId={managerId}
          day={day}
          today={today}
          log={log}
          calls={dayCalls}
          covered={covered}
          admin={isAdmin}
        />
      )}

      <h2 className="mb-2 mt-6 text-lg font-bold">{monthLabel(month)} at a glance</h2>
      <DataTable
        rows={datesOf(month)}
        columns={columns}
        rowKey={(d) => d}
        pageSize={40}
        loading={logs.isLoading}
        onRowClick={(d) => {
          setDay(d)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    </>
  )
}

interface Row extends Omit<DoctorCall, 'amount'> {
  amount: string
}
const blankRow = (day: string, location: string | null): Row => ({
  day,
  location_id: location,
  doctor_id: null,
  doctor_name: '',
  speciality: null,
  place: null,
  kind: 'planned_met',
  activity_type: null,
  activity_name: null,
  amount: '',
  status: 'done',
  discussion: null,
  instructions: null,
})

function DayForm({
  managerId,
  day,
  today,
  log,
  calls,
  covered,
  admin,
}: {
  managerId?: string
  day: string
  today: string
  log?: DailyLog
  calls: DoctorCall[]
  covered: Location[]
  admin: boolean
}) {
  const toast = useToast()
  const save = useSaveDay()
  const doctors = useDoctors()
  const future = day > today
  const locked = !admin && monthOf(day) < currentMonthKey() && !!log
  const [f, setF] = useState({
    day_type: (log?.day_type ?? 'field') as DayType,
    location_id: log?.location_id ?? covered[0]?.id ?? '',
    tp_planned: log?.tp_planned ?? '',
    actual_work: log?.actual_work ?? '',
    deviation: log?.deviation ?? false,
    reason: log?.reason ?? '',
    prior_approval: log?.prior_approval ?? null,
    remarks: log?.remarks ?? '',
    chemist_calls: String(log?.chemist_calls ?? ''),
  })
  const [touchedDeviation, setTouchedDeviation] = useState(!!log)
  const [rows, setRows] = useState<Row[]>(
    calls.map((c) => ({ ...c, amount: c.amount ? String(c.amount) : '' })),
  )
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((s) => {
      const next = { ...s, [k]: v }
      if (!touchedDeviation && (k === 'tp_planned' || k === 'actual_work'))
        next.deviation = isDeviation(next.tp_planned, next.actual_work)
      return next
    })
  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  const bad = rows.some(
    (r) => !r.doctor_name.trim() || (r.amount !== '' && !(Number(r.amount) >= 0)),
  )
  function submit() {
    if (bad) return toast('Every doctor needs a name, and amounts must be 0 or more', 'error')
    save.mutate(
      {
        managerId,
        day,
        log: {
          day_type: f.day_type,
          location_id: f.location_id || null,
          tp_planned: f.tp_planned,
          actual_work: f.actual_work,
          deviation: f.deviation,
          reason: f.reason,
          prior_approval: f.prior_approval,
          remarks: f.remarks,
          chemist_calls: Number(f.chemist_calls) || 0,
        },
        calls: future
          ? []
          : rows.map((r) => ({
              ...r,
              location_id: r.location_id ?? (f.location_id || null),
              amount: Number(r.amount) || 0,
            })),
      },
      { onSuccess: () => toast('Day saved'), onError: (e) => toast(e.message, 'error') },
    )
  }

  const off = f.day_type === 'weekoff' || f.day_type === 'holiday' || f.day_type === 'leave'
  return (
    <section className="glass p-4" aria-label={`Log for ${day}`}>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        {dayName(day)}
        {locked && (
          <span className="flex items-center gap-1 text-sm font-medium text-muted">
            <Lock className="size-4" aria-hidden /> Locked — ask an admin to change it
          </span>
        )}
      </h2>
      {future && (
        <p className="mb-3 text-sm text-muted">
          A future day: you can enter the tour plan now; the rest opens on the day.
        </p>
      )}
      <fieldset disabled={locked} className="grid gap-3 md:grid-cols-2">
        <Field label="Day type">
          <select
            className={inputCls}
            value={f.day_type}
            onChange={(e) => set('day_type', e.target.value as DayType)}
          >
            {Object.entries(DAY_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location">
          <select
            className={inputCls}
            value={f.location_id}
            onChange={(e) => set('location_id', e.target.value)}
          >
            {covered.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="TP planned">
          <input
            className={inputCls}
            placeholder="e.g. MDU"
            value={f.tp_planned}
            onChange={(e) => set('tp_planned', e.target.value)}
          />
        </Field>
        {!future && (
          <Field label="Actual work">
            <input
              className={inputCls}
              placeholder="e.g. MDU"
              value={f.actual_work}
              onChange={(e) => set('actual_work', e.target.value)}
            />
          </Field>
        )}
        {!future && !off && (
          <>
            <Field
              label="Deviation"
              group
              hint="Worked out from planned vs actual — change it if it’s wrong."
            >
              <div className="chips" role="group" aria-label="Deviation">
                {(
                  [
                    [false, 'No'],
                    [true, 'Yes'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={label}
                    type="button"
                    className="chip"
                    aria-pressed={f.deviation === k}
                    onClick={() => {
                      setTouchedDeviation(true)
                      set('deviation', k)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            {f.deviation && (
              <>
                <Field label="Reason">
                  <input
                    className={inputCls}
                    value={f.reason}
                    onChange={(e) => set('reason', e.target.value)}
                  />
                </Field>
                <Field label="Prior approval">
                  <select
                    className={inputCls}
                    value={f.prior_approval === null ? '' : f.prior_approval ? 'yes' : 'no'}
                    onChange={(e) =>
                      set('prior_approval', e.target.value === '' ? null : e.target.value === 'yes')
                    }
                  >
                    <option value="">—</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </Field>
              </>
            )}
            <Field label="Chemist calls made">
              <input
                className={`${inputCls} mono`}
                inputMode="numeric"
                value={f.chemist_calls}
                onChange={(e) => set('chemist_calls', e.target.value.replace(/\D/g, ''))}
              />
            </Field>
          </>
        )}
        <Field label="Remarks" full>
          <input
            className={inputCls}
            value={f.remarks}
            onChange={(e) => set('remarks', e.target.value)}
          />
        </Field>
      </fieldset>

      {!future && !off && (
        <fieldset disabled={locked} className="mt-4">
          <h3 className="mb-2 font-bold">
            Doctors met ({rows.filter((r) => r.kind !== 'missed').length})
          </h3>
          {rows.map((r, i) => (
            <div
              key={i}
              className="mb-3 grid gap-2 rounded-xl border border-line bg-white/50 p-3 md:grid-cols-3"
            >
              <div className="md:col-span-2">
                <SearchSelect
                  value={r.doctor_id ?? r.doctor_name}
                  title="Doctor"
                  placeholder="Select doctor"
                  allowOther
                  options={(doctors.data ?? [])
                    .filter((d) => d.is_active)
                    .map((d) => ({
                      value: d.id,
                      label: d.name,
                      hint: [d.speciality, d.area].filter(Boolean).join(' · ') || undefined,
                    }))}
                  onChange={(v, label) => {
                    const d = doctors.data?.find((x) => x.id === v)
                    setRow(i, {
                      doctor_id: d?.id ?? null,
                      doctor_name: d?.name ?? label,
                      speciality: d?.speciality ?? r.speciality,
                      place: d?.area ?? r.place,
                    })
                  }}
                />
              </div>
              <select
                className={inputCls}
                aria-label={`Call type ${i + 1}`}
                value={r.kind}
                onChange={(e) => setRow(i, { kind: e.target.value as CallKind })}
              >
                {Object.entries(KINDS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                className={inputCls}
                aria-label={`Activity ${i + 1}`}
                value={r.activity_type ?? ''}
                onChange={(e) =>
                  setRow(i, { activity_type: (e.target.value || null) as ActivityType | null })
                }
              >
                {Object.entries(ACTIVITIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                className={inputCls}
                placeholder="Activity name"
                aria-label={`Activity name ${i + 1}`}
                value={r.activity_name ?? ''}
                onChange={(e) => setRow(i, { activity_name: e.target.value })}
              />
              <div className="flex gap-2">
                <input
                  className={`${inputCls} mono`}
                  inputMode="decimal"
                  placeholder="Amount"
                  aria-label={`Amount ${i + 1}`}
                  value={r.amount}
                  onChange={(e) => setRow(i, { amount: e.target.value })}
                />
                <select
                  className={inputCls}
                  aria-label={`Planned or done ${i + 1}`}
                  value={r.status}
                  onChange={(e) => setRow(i, { status: e.target.value as 'planned' | 'done' })}
                >
                  <option value="done">Done</option>
                  <option value="planned">Planned</option>
                </select>
              </div>
              <input
                className={`${inputCls} md:col-span-3`}
                placeholder="Discussion points by RBM"
                aria-label={`Discussion ${i + 1}`}
                value={r.discussion ?? ''}
                onChange={(e) => setRow(i, { discussion: e.target.value })}
              />
              <input
                className={`${inputCls} md:col-span-2`}
                placeholder="Instructions given to team"
                aria-label={`Instructions ${i + 1}`}
                value={r.instructions ?? ''}
                onChange={(e) => setRow(i, { instructions: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm justify-self-end"
                aria-label={`Remove doctor ${i + 1}`}
                onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
              >
                <Trash2 aria-hidden /> Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setRows((x) => [...x, blankRow(day, f.location_id || null)])}
          >
            <Plus aria-hidden /> Add doctor
          </button>
        </fieldset>
      )}

      <div className="mt-4 flex justify-end">
        <button className="btn btn-primary" disabled={locked || save.isPending} onClick={submit}>
          {save.isPending ? 'Saving…' : 'Save day'}
        </button>
      </div>
    </section>
  )
}
