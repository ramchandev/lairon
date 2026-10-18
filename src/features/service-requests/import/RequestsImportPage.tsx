import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BulkImport, type BulkConfig } from '@/features/bulk-import/BulkImport'
import { StatusBadge } from '@/components/StatusBadge'
import { useDivisions } from '@/features/divisions/api'
import { useDoctors } from '@/features/doctors/api'
import { useLookup } from '@/features/lookups/hooks'
import { useUsers } from '@/features/users/api'
import { inr } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { useBatches } from '../api'
import {
  parseRequests,
  SR_FIELDS,
  SR_TEMPLATE_HEADER,
  SR_TEMPLATE_ROWS,
  toRequestsPayload,
  type SrRow,
} from './parseRequests'

const TONE = { submitted: 'info', approved: 'ok', rejected: 'danger', fulfilled: 'teal' } as const

/** Import Service Requests (one sheet row per service; rows with the same Request No become one request). */
export function RequestsImportPage() {
  const qc = useQueryClient()
  const managers = useUsers('manager')
  const staff = useUsers('staff')
  const doctors = useDoctors()
  const batches = useBatches()
  const divisions = useDivisions()
  const hqs = useLookup('hq')
  const serviceTypes = useLookup('service_type')
  const offerTypes = useLookup('offer_type')

  const ready = [managers, staff, doctors, batches, divisions, hqs, serviceTypes, offerTypes].every(
    (q) => !q.isLoading,
  )
  const cfg = useMemo<BulkConfig<SrRow>>(
    () => ({
      intro:
        'Upload service requests (for example past months). Each sheet row is one service; rows sharing a Request No — or the same manager, staff, status and date — become one request. Imported requests keep the status you give and send no emails.',
      fields: SR_FIELDS,
      templateFile: 'service-requests-import-template.xlsx',
      templateHeader: SR_TEMPLATE_HEADER,
      templateRows: SR_TEMPLATE_ROWS,
      ready,
      formats: (
        <div className="formats">
          <div>
            <b>Request</b>
            <p className="muted text-[13px]">
              Request No (blank = new number) · Doctor’s Manager · Accountability · Status · Admin
              Note · Submitted On
            </p>
            <ul className="text-[13px]">
              <li>Manager and staff by exact name or mobile number</li>
              <li>Status: Submitted, Approved, Rejected (needs a note) or Fulfilled</li>
              <li>A Request No that already exists is rejected</li>
            </ul>
          </div>
          <div>
            <b>Service (one row each)</b>
            <p className="muted text-[13px]">
              Service Date · Doctor Name · Area · Hospital · Pharmacy · HQ · Division ·
              Qualification · Speciality · Service Amount · Service Type · Expected / Current
              Business Value · Offer / Netrate · Offer % · Netrate Amount
            </p>
            <ul className="text-[13px]">
              <li>Offer needs Offer %; Netrate needs a Netrate Amount</li>
              <li>Everything is checked first; one error blocks the import</li>
            </ul>
          </div>
        </div>
      ),
      parse: (records) =>
        parseRequests(records, {
          managers: managers.data ?? [],
          staff: staff.data ?? [],
          doctors: (doctors.data ?? []).map((d) => ({
            id: d.id,
            name: d.name,
            manager_id: d.manager_id,
          })),
          existingRefs: new Set(
            (batches.data ?? []).map((b) => (b.ref_no ?? '').toUpperCase()).filter(Boolean),
          ),
          hqs: (hqs.data ?? []).map((h) => h.value),
          serviceTypes: (serviceTypes.data ?? []).map((h) => h.value),
          offerTypes: (offerTypes.data ?? []).map((h) => h.value),
          divisions: (divisions.data ?? []).map((d) => d.name),
        }),
      columns: [
        {
          key: 'req',
          header: 'Request',
          primary: true,
          cell: (r) => (
            <div>
              <div className="pn mono font-bold">{r.ref_no || 'New number'}</div>
              <div className="ps">{r.manager_name || '—'}</div>
            </div>
          ),
        },
        { key: 'doc', header: 'Doctor', cell: (r) => r.service?.doctor_name ?? '—' },
        { key: 'type', header: 'Service', cell: (r) => r.service?.service_type ?? '—' },
        {
          key: 'amt',
          header: 'Amount',
          cell: (r) => (
            <span className="mono">{r.service ? inr(r.service.service_amount) : '—'}</span>
          ),
        },
        { key: 'staff', header: 'Staff', cell: (r) => r.staff_name || '—' },
        {
          key: 'st',
          header: 'Status',
          cell: (r) => <StatusBadge tone={TONE[r.status]}>{r.status}</StatusBadge>,
        },
      ],
      importLabel: (n) => `Import ${n} service${n === 1 ? '' : 's'}`,
      commit: async (rows) => {
        const { data, error } = await supabase.rpc('import_service_requests', {
          batch: toRequestsPayload(rows, 'import'),
        })
        if (error) throw new Error(error.message)
        await qc.invalidateQueries({ queryKey: ['batches'] })
        const r = data as { requests: number; services: number }
        return {
          message: `${r.requests} request${r.requests === 1 ? '' : 's'} with ${r.services} services imported.`,
        }
      },
      doneTo: '/admin/service-requests',
      doneLabel: 'View service requests',
    }),
    [
      ready,
      managers.data,
      staff.data,
      doctors.data,
      batches.data,
      hqs.data,
      serviceTypes.data,
      offerTypes.data,
      divisions.data,
      qc,
    ],
  )
  return <BulkImport cfg={cfg} />
}
