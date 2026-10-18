import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BatchStatus } from './status'
import { parseAmount, isOffer, isNetrate } from './helpers'
import type { ServiceForm } from './schemas'

export interface Service {
  id: string
  batch_id: string
  request_date: string
  doctor_id: string | null
  doctor_name: string
  area: string
  hospital_name: string
  pharmacy_name: string | null
  hq: string
  division: string
  qualification: string
  speciality: string
  service_amount: number
  service_type: string
  expected_business_value: number
  current_business_value: number
  offer_type: string
  offer_percent: number | null
  netrate_amount: number | null
}
export interface Batch {
  id: string
  ref_no: string | null
  manager_id: string | null
  manager_name: string | null
  accountability_staff_id: string | null
  accountability_staff_name: string | null
  status: BatchStatus
  submitted_at: string | null
  decided_at: string | null
  admin_note: string | null
  created_at: string
  services: Service[]
}

const KEY = ['batches']
const COLS = '*, services:service_requests(*)'
export const batchTotal = (b: Pick<Batch, 'services'>) =>
  b.services.reduce((n, s) => n + Number(s.service_amount), 0)

/** Visible batches. RLS: a manager sees their own, staff the ones they're accountable for, admin everything. */
export const useBatches = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_request_batches')
        .select(COLS)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as Batch[]
    },
  })

export const useBatch = (id?: string) =>
  useQuery({
    queryKey: [...KEY, id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_request_batches')
        .select(COLS)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as unknown as Batch | null
    },
  })

/** The manager's open draft (null until one is started). */
export const useDraftBatch = (enabled = true) =>
  useQuery({
    queryKey: [...KEY, 'draft'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_request_batches')
        .select(COLS)
        .eq('status', 'draft')
        .maybeSingle()
      if (error) throw error
      return data as unknown as Batch | null
    },
  })

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: KEY })
    qc.invalidateQueries({ queryKey: ['doctor-history'] })
    qc.invalidateQueries({ queryKey: ['doctors'] })
  }
}

export function useEnsureDraft() {
  const done = useInvalidate()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('get_or_create_draft_batch')
      if (error) throw error
      return data as string
    },
    onSuccess: done,
  })
}

export function useSetAccountability() {
  const done = useInvalidate()
  return useMutation({
    mutationFn: async ({ batchId, staffId }: { batchId: string; staffId: string }) => {
      const { error } = await supabase
        .from('service_request_batches')
        .update({ accountability_staff_id: staffId })
        .eq('id', batchId)
      if (error) throw error
    },
    onSuccess: done,
  })
}

export function useSaveService(batchId: string, id?: string) {
  const done = useInvalidate()
  return useMutation({
    mutationFn: async (v: ServiceForm) => {
      let doctorId = v.doctor_id || null
      // "Also save to My Doctors": create the doctor first so this service links to it.
      if (!doctorId && v.save_as_doctor) {
        const { data: me } = await supabase.auth.getUser()
        const { data, error } = await supabase
          .from('doctors')
          .insert({
            manager_id: me.user!.id,
            name: v.doctor_name.trim(),
            area: v.area.trim() || null,
            hospital_name: v.hospital_name.trim() || null,
            pharmacy_name: v.pharmacy_name.trim() || null,
            hq: v.hq || null,
            division: v.division || null,
            qualification: v.qualification || null,
            speciality: v.speciality || null,
          })
          .select('id')
          .single()
        if (error) throw new Error(error.message)
        doctorId = data.id
      }
      const row = {
        batch_id: batchId,
        request_date: v.request_date,
        doctor_id: doctorId,
        doctor_name: v.doctor_name.trim(),
        area: v.area.trim(),
        hospital_name: v.hospital_name.trim(),
        pharmacy_name: v.pharmacy_name.trim() || null,
        hq: v.hq,
        division: v.division,
        qualification: v.qualification,
        speciality: v.speciality,
        service_amount: parseAmount(v.service_amount),
        service_type: v.service_type.trim(),
        expected_business_value: parseAmount(v.expected_business_value),
        current_business_value: parseAmount(v.current_business_value),
        offer_type: v.offer_type, // saved as text, like every dropdown value
        offer_percent: isOffer(v.offer_type) ? parseAmount(v.offer_percent) : null,
        netrate_amount: isNetrate(v.offer_type) ? parseAmount(v.netrate_amount) : null,
      }
      const { error } = await (id
        ? supabase.from('service_requests').update(row).eq('id', id)
        : supabase.from('service_requests').insert(row))
      if (error) throw new Error(error.message)
    },
    onSuccess: done,
  })
}

export function useDeleteService() {
  const done = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_requests').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: done,
  })
}

export function useSubmitBatch() {
  const done = useInvalidate()
  return useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase.rpc('submit_service_batch', { p_batch: batchId })
      if (error) throw new Error(error.message)
      return data as string // ref no
    },
    onSuccess: done,
  })
}

/** Admin decision. Rejecting requires a reason (enforced in Postgres too). */
export function useDecideBatch() {
  const done = useInvalidate()
  return useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string
      status: 'approved' | 'rejected' | 'fulfilled'
      note?: string
    }) => {
      const patch: { status: string; admin_note?: string } = { status }
      if (note) patch.admin_note = note
      const { error } = await supabase.from('service_request_batches').update(patch).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: done,
  })
}
