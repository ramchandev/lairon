import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { normalizePhone } from '@/lib/phone'
import type { DoctorForm } from './schemas'

export interface Doctor {
  id: string
  manager_id: string | null
  manager_name: string | null
  name: string
  phone: string | null
  email: string | null
  qualification: string | null
  speciality: string | null
  division: string | null
  area: string | null
  hospital_name: string | null
  pharmacy_name: string | null
  hq: string | null
  notes: string | null
  is_active: boolean
}
const KEY = ['doctors']
const COLS =
  'id, manager_id, name, phone, email, qualification, speciality, division, area, hospital_name, pharmacy_name, hq, notes, is_active, manager:manager_id(full_name)'

type Raw = Omit<Doctor, 'manager_name'> & { manager: { full_name: string } | null }
const flat = ({ manager, ...d }: Raw): Doctor => ({
  ...d,
  manager_name: manager?.full_name ?? null,
})

/** RLS scopes this: a manager gets only their own doctors; admin gets everyone's. */
export const useDoctors = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('doctors').select(COLS).order('name')
      if (error) throw error
      return (data as unknown as Raw[]).map(flat)
    },
  })

export const useDoctor = (id?: string) =>
  useQuery({
    queryKey: [...KEY, id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select(COLS)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data ? flat(data as unknown as Raw) : null
    },
  })

const nul = (s: string) => s.trim() || null

export function useSaveDoctor(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: DoctorForm) => {
      const row = {
        name: v.name.trim(),
        phone: v.phone ? normalizePhone(v.phone) : null,
        email: nul(v.email),
        division: nul(v.division),
        qualification: nul(v.qualification),
        speciality: nul(v.speciality),
        area: nul(v.area),
        hospital_name: nul(v.hospital_name),
        pharmacy_name: nul(v.pharmacy_name),
        hq: nul(v.hq),
        notes: nul(v.notes),
        manager_id: v.manager_id,
        is_active: v.is_active,
      }
      const { error } = await (id
        ? supabase.from('doctors').update(row).eq('id', id)
        : supabase.from('doctors').insert(row))
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Requests keep the doctor's name as text, so deleting never changes history.
      const { error } = await supabase.from('doctors').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export interface DoctorService {
  id: string
  request_date: string
  service_type: string
  service_amount: number
  batch: { ref_no: string | null; status: string } | null
}

/** Service-request history for one doctor (matched by id; renamed/deleted doctors keep their text on the request). */
export const useDoctorHistory = (doctorId?: string) =>
  useQuery({
    queryKey: ['doctor-history', doctorId],
    enabled: !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_requests')
        .select('id, request_date, service_type, service_amount, batch:batch_id(ref_no, status)')
        .eq('doctor_id', doctorId!)
        .order('request_date', { ascending: false })
      if (error) throw error
      return data as unknown as DoctorService[]
    },
  })

export function useReassignDoctor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, manager_id }: { id: string; manager_id: string }) => {
      const { error } = await supabase.from('doctors').update({ manager_id }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
