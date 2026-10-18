import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BulkImport, type BulkConfig } from '@/features/bulk-import/BulkImport'
import { StatusBadge } from '@/components/StatusBadge'
import { useDivisions } from '@/features/divisions/api'
import { useDoctors } from '@/features/doctors/api'
import { useProducts } from '@/features/products/api'
import { useUsers } from '@/features/users/api'
import { fmtDate } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { usePacks } from '../api'
import {
  parsePacks,
  SP_FIELDS,
  SP_TEMPLATE_HEADER,
  SP_TEMPLATE_ROWS,
  toPacksPayload,
  type SpRow,
} from './parsePacks'

const TONE = {
  submitted: 'info',
  processing: 'warn',
  fulfilled: 'teal',
  cancelled: 'muted',
} as const

/** Import Starter Packs (one sheet row per product; rows with the same Request No become one pack). */
export function PacksImportPage() {
  const qc = useQueryClient()
  const staff = useUsers('staff')
  const doctors = useDoctors()
  const products = useProducts()
  const divisions = useDivisions()
  const packs = usePacks()
  const ready = [staff, doctors, products, divisions, packs].every((q) => !q.isLoading)

  const cfg = useMemo<BulkConfig<SpRow>>(
    () => ({
      intro:
        'Upload starter pack requests (for example past months). Each sheet row is one product; rows sharing a Request No — or the same date, doctor, staff, division and status — become one pack. Imported packs keep the status you give and send no emails.',
      fields: SP_FIELDS,
      templateFile: 'starter-packs-import-template.xlsx',
      templateHeader: SP_TEMPLATE_HEADER,
      templateRows: SP_TEMPLATE_ROWS,
      ready,
      formats: (
        <div className="formats">
          <div>
            <b>Pack</b>
            <p className="muted text-[13px]">
              Request No (blank = new number) · Date · Doctor Name · Qualification · Doctor Area ·
              Staff · Staff Area · Division · Status · Admin Note
            </p>
            <ul className="text-[13px]">
              <li>Staff by exact name or mobile number</li>
              <li>Status: Submitted, Processing, Fulfilled or Cancelled (needs a note)</li>
            </ul>
          </div>
          <div>
            <b>Product (one row each)</b>
            <p className="muted text-[13px]">Product · Quantity</p>
            <ul className="text-[13px]">
              <li>Products not in the catalogue are saved as typed (with a warning)</li>
              <li>Everything is checked first; one error blocks the import</li>
            </ul>
          </div>
        </div>
      ),
      parse: (records) =>
        parsePacks(records, {
          staff: staff.data ?? [],
          doctors: (doctors.data ?? []).map((d) => ({ id: d.id, name: d.name })),
          products: (products.data ?? []).map((p) => ({ id: p.id, name: p.name })),
          divisions: (divisions.data ?? []).map((d) => d.name),
          existingRefs: new Set(
            (packs.data ?? []).map((p) => (p.ref_no ?? '').toUpperCase()).filter(Boolean),
          ),
        }),
      columns: [
        {
          key: 'req',
          header: 'Request',
          primary: true,
          cell: (r) => (
            <div>
              <div className="pn mono font-bold">{r.ref_no || 'New number'}</div>
              <div className="ps">{r.request_date ? fmtDate(r.request_date) : '—'}</div>
            </div>
          ),
        },
        { key: 'doc', header: 'Doctor', cell: (r) => r.doctor_name || '—' },
        { key: 'staff', header: 'Staff', cell: (r) => r.staff_name || '—' },
        {
          key: 'prod',
          header: 'Product',
          cell: (r) => (r.product_name ? `${r.product_name} × ${r.quantity || '?'}` : '—'),
        },
        { key: 'div', header: 'Division', cell: (r) => r.division || '—' },
        {
          key: 'st',
          header: 'Status',
          cell: (r) => <StatusBadge tone={TONE[r.status]}>{r.status}</StatusBadge>,
        },
      ],
      importLabel: (n) => `Import ${n} product row${n === 1 ? '' : 's'}`,
      commit: async (rows) => {
        const { data, error } = await supabase.rpc('import_starter_packs', {
          batch: toPacksPayload(rows, 'import'),
        })
        if (error) throw new Error(error.message)
        await qc.invalidateQueries({ queryKey: ['packs'] })
        const r = data as { packs: number; products: number }
        return {
          message: `${r.packs} starter pack${r.packs === 1 ? '' : 's'} with ${r.products} products imported.`,
        }
      },
      doneTo: '/admin/starter-packs',
      doneLabel: 'View starter packs',
    }),
    [ready, staff.data, doctors.data, products.data, divisions.data, packs.data, qc],
  )
  return <BulkImport cfg={cfg} />
}
