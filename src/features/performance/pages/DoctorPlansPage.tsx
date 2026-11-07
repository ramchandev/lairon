import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { DataTable, type Column } from '@/components/DataTable'
import { Field, PageHeader } from '@/components/FormPage'
import { IconButton } from '@/components/ListParts'
import { Tabs } from '@/components/ListControls'
import { SearchSelect } from '@/components/SearchSelect'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useDoctors, type Doctor } from '@/features/doctors/api'
import { currentMonthKey } from '@/features/doctors/revenue'
import { useLocations } from '@/features/locations/api'
import { inr } from '@/lib/format'
import { monthLabel, shiftMonth } from '@/lib/time'
import { ManagerPicker, useManagerChoice } from '../components/ManagerPicker'
import {
  COVERAGE_ROLES,
  useAddCoreDoctor,
  useConversionPlans,
  useCoreCoverage,
  useCoreDoctors,
  useDeleteConversion,
  useRemoveCoreDoctor,
  useSaveConversion,
  useSetCoverage,
  type ConversionDraft,
  type ConversionPlan,
  type CoverageRole,
} from '../plans'
import { buildRoi, ROI_TARGET, useRoiData } from '../roi'
import { financialYear } from '../sales'

type Tab = 'conversion' | 'converted' | 'core'

/** Manager: conversion plan, newly converted doctors and core-doctor coverage. */
export const DoctorPlansPage = () => <DoctorPlans />

/** Admin: the same for a chosen manager. */
export function AdminDoctorPlansPage() {
  const { managerId, setManagerId, managers } = useManagerChoice()
  return (
    <>
      <ManagerPicker managers={managers} value={managerId} onChange={setManagerId} />
      {managerId ? (
        <DoctorPlans managerId={managerId} />
      ) : (
        <p className="glass p-5 text-muted">Choose a manager to see their doctor plans.</p>
      )}
    </>
  )
}

const doctorOptions = (doctors: Doctor[]) =>
  doctors
    .filter((d) => d.is_active)
    .map((d) => ({
      value: d.id,
      label: d.name,
      hint: [d.speciality, d.area].filter(Boolean).join(' · ') || undefined,
    }))

function DoctorPlans({ managerId }: { managerId?: string }) {
  const { profile } = useAuth()
  const who = managerId ?? profile?.id ?? ''
  const [tab, setTab] = useState<Tab>('conversion')
  return (
    <>
      <PageHeader
        title="Doctor Plans"
        subtitle="Conversion plan, newly converted doctors, and core-doctor coverage"
      />
      <Tabs
        tabs={[
          { key: 'conversion', label: 'Conversion Plan' },
          { key: 'converted', label: 'New Converted Drs' },
          { key: 'core', label: 'Core Dr Coverage' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-4">
        {tab === 'conversion' && <ConversionPlanTab who={who} managerId={managerId} />}
        {tab === 'converted' && <ConvertedTab who={who} managerId={managerId} />}
        {tab === 'core' && <CoreCoverageTab who={who} managerId={managerId} />}
      </div>
    </>
  )
}

// ── Conversion plan ──

const blank = (month: string): ConversionDraft => ({
  month: `${month}-01`,
  doctor_id: null,
  doctor_name: '',
  hospital: null,
  speciality: null,
  location_id: null,
  visits: 0,
  visited_date: null,
  pob: null,
  activities: null,
  remarks: null,
  converted_on: null,
})

function ConversionPlanTab({ who, managerId }: { who: string; managerId?: string }) {
  const toast = useToast()
  const plans = useConversionPlans(managerId)
  const doctors = useDoctors()
  const locations = useLocations()
  const save = useSaveConversion()
  const del = useDeleteConversion()
  const [month, setMonth] = useState(currentMonthKey())
  const [editing, setEditing] = useState<{ id?: string; draft: ConversionDraft } | null>(null)
  const rows = (plans.data ?? []).filter((p) => p.month.startsWith(month))
  const locName = (id: string | null) => locations.data?.find((l) => l.id === id)?.name ?? '—'

  const columns: Column<ConversionPlan>[] = [
    {
      key: 'doctor',
      header: 'Doctor',
      primary: true,
      cell: (p) => (
        <div>
          <div className="font-semibold">{p.doctor_name}</div>
          <div className="text-xs text-muted">
            {[p.hospital, p.speciality, locName(p.location_id)]
              .filter((x) => x && x !== '—')
              .join(' · ')}
          </div>
        </div>
      ),
    },
    { key: 'visits', header: 'Visits', cell: (p) => p.visits },
    { key: 'date', header: 'Visited', cell: (p) => p.visited_date ?? '—' },
    { key: 'pob', header: 'POB', cell: (p) => (p.pob === null ? '—' : inr(p.pob)) },
    { key: 'act', header: 'Activities', cell: (p) => p.activities || '—' },
    { key: 'rem', header: 'Remarks', cell: (p) => p.remarks || '—' },
    {
      key: 'conv',
      header: 'Converted',
      cell: (p) =>
        p.converted_on ? (
          <span className="flex items-center gap-1 text-ok">
            <CheckCircle2 className="size-4" aria-hidden /> {p.converted_on}
          </span>
        ) : (
          '—'
        ),
    },
  ]

  function submit() {
    if (!editing) return
    if (!editing.draft.doctor_name.trim()) return toast('Choose or type a doctor', 'error')
    save.mutate(
      { id: editing.id, managerId: who, draft: editing.draft },
      {
        onSuccess: () => {
          toast(editing.id ? 'Plan updated' : 'Added to the plan')
          setEditing(null)
        },
        onError: (e) => toast(e.message, 'error'),
      },
    )
  }
  const set = (patch: Partial<ConversionDraft>) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e))

  return (
    <>
      <div className="toolbar">
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
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight aria-hidden />
          </button>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ draft: blank(month) })}>
          <Plus aria-hidden /> Add doctor to plan
        </button>
      </div>

      {editing && (
        <section
          className="glass mb-4 grid gap-3 p-4 md:grid-cols-2"
          aria-label="Conversion plan entry"
        >
          <Field label="Doctor" required full group>
            <SearchSelect
              value={editing.draft.doctor_id ?? editing.draft.doctor_name}
              title="Doctor"
              placeholder="Select doctor"
              allowOther
              options={doctorOptions(doctors.data ?? [])}
              onChange={(v, label) => {
                const d = doctors.data?.find((x) => x.id === v)
                set({
                  doctor_id: d?.id ?? null,
                  doctor_name: d?.name ?? label,
                  speciality: d?.speciality ?? editing.draft.speciality,
                  hospital: d?.hospital_name ?? editing.draft.hospital,
                  location_id: d?.location_id ?? editing.draft.location_id,
                })
              }}
            />
          </Field>
          <Field label="Hospital / clinic">
            <input
              className={inputCls}
              value={editing.draft.hospital ?? ''}
              onChange={(e) => set({ hospital: e.target.value })}
            />
          </Field>
          <Field label="Speciality">
            <input
              className={inputCls}
              value={editing.draft.speciality ?? ''}
              onChange={(e) => set({ speciality: e.target.value })}
            />
          </Field>
          <Field label="No. of visits">
            <input
              className={`${inputCls} mono`}
              inputMode="numeric"
              value={editing.draft.visits || ''}
              onChange={(e) => set({ visits: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            />
          </Field>
          <Field label="Visited date">
            <input
              type="date"
              className={inputCls}
              value={editing.draft.visited_date ?? ''}
              onChange={(e) => set({ visited_date: e.target.value || null })}
            />
          </Field>
          <Field label="POB (₹)">
            <input
              className={`${inputCls} mono`}
              inputMode="decimal"
              value={editing.draft.pob ?? ''}
              onChange={(e) =>
                set({
                  pob: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </Field>
          <Field
            label="Converted on"
            hint="Fill this when the doctor starts prescribing — they then appear under New Converted Drs."
          >
            <input
              type="date"
              className={inputCls}
              value={editing.draft.converted_on ?? ''}
              onChange={(e) => set({ converted_on: e.target.value || null })}
            />
          </Field>
          <Field label="Activities" full>
            <input
              className={inputCls}
              value={editing.draft.activities ?? ''}
              onChange={(e) => set({ activities: e.target.value })}
            />
          </Field>
          <Field label="Remarks" full>
            <input
              className={inputCls}
              value={editing.draft.remarks ?? ''}
              onChange={(e) => set({ remarks: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2 md:col-span-2">
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={save.isPending} onClick={submit}>
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </section>
      )}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(p) => p.id}
        loading={plans.isLoading}
        onRowClick={(p) => setEditing({ id: p.id, draft: { ...p } })}
        empty={
          <p className="p-6 text-center text-muted">
            No doctors planned for {monthLabel(month)} yet.
          </p>
        }
        actions={(p) => (
          <>
            <IconButton
              label={`Edit ${p.doctor_name}`}
              icon={Pencil}
              onClick={() => setEditing({ id: p.id, draft: { ...p } })}
            />
            <IconButton
              danger
              label={`Remove ${p.doctor_name}`}
              icon={Trash2}
              onClick={() => del.mutate(p.id, { onSuccess: () => toast('Removed') })}
            />
          </>
        )}
      />
    </>
  )
}

// ── New converted doctors, with their ROI ──

function ConvertedTab({ who, managerId }: { who: string; managerId?: string }) {
  const plans = useConversionPlans(managerId)
  const roiData = useRoiData()
  const locations = useLocations()
  const asOf = currentMonthKey()
  const fy = financialYear(asOf)
  const converted = (plans.data ?? []).filter(
    (p) => p.converted_on && p.converted_on >= `${fy.from}-01`,
  )
  const roi = useMemo(
    () =>
      buildRoi(roiData.data?.services ?? [], roiData.data?.revenue ?? [], {
        fyFrom: fy.from,
        asOf,
        managerId: who,
      }),
    [roiData.data, fy.from, asOf, who],
  )
  const byDoctor = new Map(roi.doctors.map((d) => [d.key, d]))
  const columns: Column<ConversionPlan>[] = [
    { key: 'date', header: 'Converted on', cell: (p) => p.converted_on },
    {
      key: 'doctor',
      header: 'Doctor',
      primary: true,
      cell: (p) => (
        <div>
          <div className="font-semibold">{p.doctor_name}</div>
          <div className="text-xs text-muted">
            {[p.speciality, p.hospital, locations.data?.find((l) => l.id === p.location_id)?.name]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      ),
    },
    {
      key: 'amt',
      header: 'Service amount',
      cell: (p) => (
        <span className="mono">
          {p.doctor_id && byDoctor.get(p.doctor_id)
            ? inr(byDoctor.get(p.doctor_id)!.serviceAmount)
            : '—'}
        </span>
      ),
    },
    {
      key: 'ret',
      header: 'Return to date',
      cell: (p) => (
        <span className="mono">
          {p.doctor_id && byDoctor.get(p.doctor_id)
            ? inr(byDoctor.get(p.doctor_id)!.totalReturn)
            : '—'}
        </span>
      ),
    },
    {
      key: 'roi',
      header: 'ROI',
      cell: (p) => {
        const d = p.doctor_id ? byDoctor.get(p.doctor_id) : undefined
        return d ? (
          <b className={`mono ${d.achieved ? 'text-ok' : ''}`}>{d.roi.toFixed(1)}×</b>
        ) : (
          '—'
        )
      },
    },
    {
      key: 'ok',
      header: `${ROI_TARGET}× achieved`,
      cell: (p) =>
        p.doctor_id && byDoctor.get(p.doctor_id)?.achieved ? (
          <span className="text-ok">Yes</span>
        ) : (
          'Not yet'
        ),
    },
  ]
  return (
    <>
      <p className="mb-3 text-sm text-muted">
        Doctors marked converted in the Conversion Plan this financial year. Their ROI comes from
        the services and revenue recorded on their requests.
      </p>
      <DataTable
        rows={converted}
        columns={columns}
        rowKey={(p) => p.id}
        loading={plans.isLoading}
        empty={
          <p className="p-6 text-center text-muted">
            No converted doctors yet. Set “Converted on” in the Conversion Plan.
          </p>
        }
      />
    </>
  )
}

// ── Core doctor coverage ──

function CoreCoverageTab({ who, managerId }: { who: string; managerId?: string }) {
  const toast = useToast()
  const core = useCoreDoctors(managerId)
  const doctors = useDoctors()
  const add = useAddCoreDoctor()
  const remove = useRemoveCoreDoctor()
  const setCell = useSetCoverage()
  const [month, setMonth] = useState(currentMonthKey())
  const list = core.data ?? []
  const coverage = useCoreCoverage(
    month,
    list.map((d) => d.id),
  )
  const covered = list.filter((d) => Object.keys(coverage.data?.[d.id] ?? {}).length > 0).length

  return (
    <>
      <div className="toolbar">
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
        <div className="w-64">
          <SearchSelect
            value=""
            title="Add a core doctor"
            placeholder="+ Add a core doctor"
            allowOther
            options={doctorOptions(
              (doctors.data ?? []).filter((d) => !list.some((c) => c.doctor_id === d.id)),
            )}
            onChange={(v, label) => {
              const d = doctors.data?.find((x) => x.id === v)
              add.mutate(
                {
                  managerId: who,
                  doctor: {
                    doctor_id: d?.id ?? null,
                    doctor_name: d?.name ?? label,
                    speciality: d?.speciality ?? null,
                    area: d?.area ?? null,
                    location_id: d?.location_id ?? null,
                  },
                },
                { onError: (e) => toast(e.message, 'error') },
              )
            }}
          />
        </div>
      </div>
      <p className="mb-3 text-sm text-muted">
        {list.length ? (
          <>
            Covered in {monthLabel(month)}: <b className="mono text-ink">{covered}</b> of{' '}
            <b className="mono text-ink">{list.length}</b> core doctors
            {list.length ? ` (${Math.round((covered / list.length) * 100)}%)` : ''}. Type the name
            of who visited, under their role.
          </>
        ) : (
          'No core doctors yet. Add the doctors you want covered every month.'
        )}
      </p>
      {list.length > 0 && (
        <section className="glass overflow-x-auto p-3" aria-label="Core doctor coverage">
          <table className="dt" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Doctor</th>
                {COVERAGE_ROLES.map((r) => (
                  <th key={r}>{r}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="font-semibold">{d.doctor_name}</div>
                    <div className="text-xs text-muted">
                      {[d.speciality, d.area].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  {COVERAGE_ROLES.map((r) => (
                    <td key={r}>
                      <CoverageInput
                        key={`${month}|${coverage.dataUpdatedAt}`}
                        label={`${r} — ${d.doctor_name}`}
                        value={coverage.data?.[d.id]?.[r] ?? ''}
                        onSave={(name) =>
                          setCell.mutate(
                            { coreDoctorId: d.id, month, role: r as CoverageRole, name },
                            { onError: (e) => toast(e.message, 'error') },
                          )
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <IconButton
                      danger
                      label={`Remove ${d.doctor_name}`}
                      icon={X}
                      onClick={() => remove.mutate(d.id, { onSuccess: () => toast('Removed') })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}

/** Saves when you leave the box, and only if the text changed. */
function CoverageInput({
  label,
  value,
  onSave,
}: {
  label: string
  value: string
  onSave: (v: string) => void
}) {
  const [v, setV] = useState(value)
  return (
    <input
      className="input !h-9 !w-28"
      aria-label={label}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== value && onSave(v)}
    />
  )
}
