import { useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, NotebookPen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthProvider'
import { PageHeader } from '@/components/FormPage'
import { useToast } from '@/components/Toast'
import { currentMonthKey, revenueLocked } from '@/features/doctors/revenue'
import { useLocations, useManagerLocations } from '@/features/locations/api'
import { monthLabel, shiftMonth } from '@/lib/time'
import {
  OVERRIDE_KEYS,
  datesOf,
  deriveActivity,
  effectiveActivity,
  useDailyLogs,
  useDoctorCalls,
  useMonthlyActivity,
  useSaveMonthlyActivity,
  type Derived,
  type MonthlyActivity,
  type OverrideKey,
} from '../activity'
import { ManagerPicker, useManagerChoice } from '../components/ManagerPicker'

interface Line {
  key: OverrideKey | 'pob' | 'mcl_total' | 'dr_call_avg' | 'ch_call_avg' | 'coverage'
  label: string
  hint?: string
}
const LINES: Line[] = [
  { key: 'working_days', label: 'No. of working days' },
  { key: 'holidays', label: 'Holidays' },
  { key: 'leave_days', label: 'Leave' },
  { key: 'days_worked', label: 'No. of days worked' },
  { key: 'meeting_days', label: 'Meeting / admin / others' },
  { key: 'dr_calls', label: 'No. of Dr calls made' },
  { key: 'dr_call_avg', label: 'Dr call average' },
  { key: 'ch_calls', label: 'No. of chemist calls made' },
  { key: 'ch_call_avg', label: 'Chemist call average' },
  { key: 'pob', label: 'POB', hint: 'Entered by you (₹ lakhs)' },
  { key: 'mcl_total', label: 'Total no. of Drs in MCL', hint: 'Entered by you' },
  { key: 'mcl_met', label: 'MCL Drs met', hint: 'Different doctors met in the month' },
  { key: 'missed_calls', label: 'Missed calls' },
  { key: 'coverage', label: 'Coverage %', hint: 'MCL Drs met ÷ total Drs in MCL' },
  { key: 'three_visit', label: '3-visit Drs in MCL / met', hint: 'Doctors met 3 or more times' },
  { key: 'two_visit', label: '2-visit Drs in MCL / met', hint: 'Doctors met twice' },
  { key: 'one_visit', label: '1-visit Drs in MCL / met', hint: 'Doctors met once' },
  { key: 'camps', label: 'No. of camps done' },
  { key: 'cmes', label: 'No. of CMEs done' },
]
const isOverride = (k: Line['key']): k is OverrideKey =>
  (OVERRIDE_KEYS as readonly string[]).includes(k)

/** Manager: the month's field-activity figures, worked out from the daily log; any number can be typed over. */
export const FieldActivityPage = () => <FieldActivity />

/** Admin: the same, for a chosen manager. */
export function AdminFieldActivityPage() {
  const { managerId, setManagerId, managers } = useManagerChoice()
  return (
    <>
      <ManagerPicker managers={managers} value={managerId} onChange={setManagerId} />
      {managerId ? (
        <FieldActivity managerId={managerId} />
      ) : (
        <p className="glass p-5 text-muted">Choose a manager to see their field activity.</p>
      )}
    </>
  )
}

function FieldActivity({ managerId }: { managerId?: string }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const who = managerId ?? profile?.id ?? ''
  const [month, setMonth] = useState(currentMonthKey())
  const [locationId, setLocationId] = useState('') // '' = all locations
  const range = { managerId: who || undefined, from: `${month}-01`, to: datesOf(month).at(-1)! }
  const logs = useDailyLogs(range)
  const calls = useDoctorCalls(range)
  const saved = useMonthlyActivity({ managerId: who || undefined, month })
  const locations = useLocations()
  const mine = useManagerLocations()
  const covered = (locations.data ?? []).filter((l) => (mine.data?.[who] ?? []).includes(l.id))

  const derived = deriveActivity(logs.data ?? [], calls.data ?? [], month, locationId || undefined)
  const filtered = !!locationId // overrides belong to the whole month, so a single location shows the calculated numbers
  const eff = effectiveActivity(
    derived,
    filtered ? null : (saved.data ?? null),
    saved.data?.mcl_total ?? 0,
  )
  const locked = !isAdmin && revenueLocked('manager', month, !!saved.data)

  return (
    <>
      <PageHeader
        title="Field Activity"
        subtitle="Calculated from the daily log — type over any number to correct it"
        action={
          <Link
            to={isAdmin ? '/admin/field-activity/daily' : '/m/performance/daily'}
            className="btn btn-ghost"
          >
            <NotebookPen aria-hidden /> <span className="hidden sm:inline">Daily log</span>
          </Link>
        }
      />
      <div className="toolbar">
        <div className="chips" role="group" aria-label="Location">
          <button
            type="button"
            className="chip"
            aria-pressed={!locationId}
            onClick={() => setLocationId('')}
          >
            All locations
          </button>
          {covered.map((l) => (
            <button
              key={l.id}
              type="button"
              className="chip"
              aria-pressed={locationId === l.id}
              onClick={() => setLocationId(l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-sm"
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft aria-hidden />
          </button>
          <b className="min-w-36 text-center">{monthLabel(month)}</b>
          <button
            className="btn btn-ghost btn-sm"
            aria-label="Next month"
            disabled={month >= currentMonthKey()}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight aria-hidden />
          </button>
        </div>
      </div>
      {filtered && (
        <p className="mb-3 text-sm text-muted">
          Showing the calculated figures for this location. Choose “All locations” to type over a
          number.
        </p>
      )}
      {locked && (
        <p className="mb-3 flex items-center gap-1 text-sm text-muted">
          <Lock className="size-4" aria-hidden /> This month has ended and is locked. Ask an admin
          to change it.
        </p>
      )}
      {/* key: the typed-over values restart from what is saved whenever the month or manager changes */}
      <Figures
        key={`${who}|${month}|${saved.dataUpdatedAt}`}
        managerId={managerId}
        month={month}
        derived={derived}
        eff={eff}
        saved={saved.data ?? null}
        readOnly={filtered || locked}
      />
    </>
  )
}

function Figures({
  managerId,
  month,
  derived,
  eff,
  saved,
  readOnly,
}: {
  managerId?: string
  month: string
  derived: Derived
  eff: ReturnType<typeof effectiveActivity>
  saved: MonthlyActivity | null
  readOnly: boolean
}) {
  const toast = useToast()
  const save = useSaveMonthlyActivity()
  const initial = (k: OverrideKey | 'pob' | 'mcl_total') =>
    saved?.[k] == null ? '' : String(saved[k])
  const keys = [...OVERRIDE_KEYS, 'pob', 'mcl_total'] as const
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(keys.map((k) => [k, initial(k)])),
  )
  const dirty = keys.some((k) => v[k] !== initial(k))
  const bad = keys.some((k) => v[k] !== '' && !(Number(v[k]) >= 0))

  // What is shown while typing: the typed value, else the calculated one; averages and coverage follow.
  const typedMcl = v.mcl_total === '' ? 0 : Number(v.mcl_total) || 0
  const live = {
    ...eff,
    ...Object.fromEntries(OVERRIDE_KEYS.map((k) => [k, v[k] === '' ? derived[k] : Number(v[k])])),
  } as typeof eff
  const per = (n: number) => (live.days_worked ? Math.round((n / live.days_worked) * 10) / 10 : 0)
  const shown: Record<Line['key'], string> = {
    ...(Object.fromEntries(OVERRIDE_KEYS.map((k) => [k, String(live[k])])) as Record<
      OverrideKey,
      string
    >),
    dr_call_avg: String(per(live.dr_calls)),
    ch_call_avg: String(per(live.ch_calls)),
    coverage: `${typedMcl ? Math.round((live.mcl_met / typedMcl) * 1000) / 10 : 0}%`,
    pob: '',
    mcl_total: '',
  }

  return (
    <section className="glass p-3" aria-label="Field activity figures">
      <table className="dt" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Parameter</th>
            <th className="text-right">{monthLabel(month)}</th>
            <th className="text-right">Type over</th>
          </tr>
        </thead>
        <tbody>
          {LINES.map((l) => {
            const editable = isOverride(l.key) || l.key === 'pob' || l.key === 'mcl_total'
            const typed = editable && v[l.key] !== ''
            return (
              <tr key={l.key}>
                <td>
                  <div className="font-semibold">{l.label}</div>
                  {l.hint && <div className="text-xs text-muted">{l.hint}</div>}
                </td>
                <td className="mono text-right font-bold">
                  {l.key === 'pob' || l.key === 'mcl_total' ? v[l.key] || '—' : shown[l.key]}
                  {typed && isOverride(l.key) && (
                    <div className="text-xs font-normal text-warn">typed</div>
                  )}
                </td>
                <td className="text-right">
                  {editable && (
                    <input
                      className="input mono !h-9 !w-24 text-right"
                      inputMode="decimal"
                      aria-label={l.label}
                      placeholder={isOverride(l.key) ? String(derived[l.key]) : ''}
                      disabled={readOnly}
                      value={v[l.key]}
                      onChange={(e) => setV({ ...v, [l.key]: e.target.value })}
                      aria-invalid={v[l.key] !== '' && !(Number(v[l.key]) >= 0)}
                    />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-3 text-sm text-muted">
        The grey number in a box is the calculated one; leave it empty to use it.
      </p>
      <div className="mt-3 flex justify-end">
        <button
          className="btn btn-primary"
          disabled={readOnly || !dirty || bad || save.isPending}
          onClick={() =>
            save.mutate(
              { managerId, month, values: v },
              {
                onSuccess: () => toast('Figures saved'),
                onError: (e) => toast(e.message, 'error'),
              },
            )
          }
        >
          {save.isPending ? 'Saving…' : dirty ? 'Save figures' : 'Saved'}
        </button>
      </div>
    </section>
  )
}
