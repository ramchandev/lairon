import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ConversionPlan {
  id: string
  manager_id: string
  /** yyyy-mm-01 */
  month: string
  doctor_id: string | null
  doctor_name: string
  hospital: string | null
  speciality: string | null
  location_id: string | null
  visits: number
  visited_date: string | null
  pob: number | null
  activities: string | null
  remarks: string | null
  converted_on: string | null
}
export type ConversionDraft = Omit<ConversionPlan, 'id' | 'manager_id'>

export interface CoreDoctor {
  id: string
  doctor_id: string | null
  doctor_name: string
  speciality: string | null
  area: string | null
  location_id: string | null
}
export const COVERAGE_ROLES = ['MR', 'ABM', 'RBM', 'ZSM', 'SH'] as const
export type CoverageRole = (typeof COVERAGE_ROLES)[number]

const PLAN_COLS =
  'id, manager_id, month, doctor_id, doctor_name, hospital, speciality, location_id, visits, visited_date, pob, activities, remarks, converted_on'
const who = (m?: string) => m ?? 'me'

export const useConversionPlans = (managerId?: string) =>
  useQuery({
    queryKey: ['conversion-plans', who(managerId)],
    queryFn: async () => {
      let q = supabase.from('conversion_plans').select(PLAN_COLS)
      if (managerId) q = q.eq('manager_id', managerId)
      const { data, error } = await q.order('month').order('doctor_name')
      if (error) throw error
      return (data as ConversionPlan[]).map((p) => ({
        ...p,
        month: p.month.slice(0, 10),
        pob: p.pob === null ? null : Number(p.pob),
      }))
    },
  })

export function useSaveConversion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { id?: string; managerId: string; draft: ConversionDraft }) => {
      const { error } = await (v.id
        ? supabase.from('conversion_plans').update(v.draft).eq('id', v.id)
        : supabase.from('conversion_plans').insert({ ...v.draft, manager_id: v.managerId }))
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['conversion-plans'] }),
  })
}

export function useDeleteConversion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('conversion_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['conversion-plans'] }),
  })
}

export const useCoreDoctors = (managerId?: string) =>
  useQuery({
    queryKey: ['core-doctors', who(managerId)],
    queryFn: async () => {
      let q = supabase
        .from('core_doctors')
        .select('id, doctor_id, doctor_name, speciality, area, location_id')
      if (managerId) q = q.eq('manager_id', managerId)
      const { data, error } = await q.order('doctor_name')
      if (error) throw error
      return data as CoreDoctor[]
    },
  })

export function useAddCoreDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { managerId: string; doctor: Omit<CoreDoctor, 'id'> }) => {
      const { error } = await supabase
        .from('core_doctors')
        .insert({ ...v.doctor, manager_id: v.managerId })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['core-doctors'] }),
  })
}

export function useRemoveCoreDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('core_doctors').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['core-doctors'] })
      void qc.invalidateQueries({ queryKey: ['core-coverage'] })
    },
  })
}

/** core_doctor_id -> role -> name, for one month. */
export const useCoreCoverage = (month: string, ids: string[]) =>
  useQuery({
    queryKey: ['core-coverage', month, [...ids].sort().join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('core_coverage')
        .select('core_doctor_id, role, covered_by')
        .eq('month', `${month}-01`)
        .in('core_doctor_id', ids)
      if (error) throw error
      const map: Record<string, Partial<Record<CoverageRole, string>>> = {}
      for (const r of data as { core_doctor_id: string; role: CoverageRole; covered_by: string }[])
        (map[r.core_doctor_id] ??= {})[r.role] = r.covered_by
      return map
    },
  })

/** A blank name clears that cell. */
export function useSetCoverage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      coreDoctorId: string
      month: string
      role: CoverageRole
      name: string
    }) => {
      const name = v.name.trim()
      const { error } = name
        ? await supabase.from('core_coverage').upsert(
            {
              core_doctor_id: v.coreDoctorId,
              month: `${v.month}-01`,
              role: v.role,
              covered_by: name,
            },
            { onConflict: 'core_doctor_id,month,role' },
          )
        : await supabase
            .from('core_coverage')
            .delete()
            .eq('core_doctor_id', v.coreDoctorId)
            .eq('month', `${v.month}-01`)
            .eq('role', v.role)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['core-coverage'] }),
  })
}
