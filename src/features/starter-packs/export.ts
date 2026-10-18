import { downloadCsv, type Cell } from '@/lib/csvExport'
import { PACK_LABEL } from './status'
import type { Pack } from './api'

export const PACK_CSV_HEADER = [
  'Ref No',
  'Date',
  'Doctor Name',
  'Qualification',
  'Doctor Area',
  'Staff Name',
  'Staff Area',
  'Division',
  'Status',
  'Product',
  'Quantity',
]

/** One row per product. */
export const packsToRows = (packs: Pack[]): Cell[][] =>
  packs.flatMap((p) =>
    p.items.map((i): Cell[] => [
      p.ref_no,
      p.request_date,
      p.doctor_name,
      p.qualification,
      p.doctor_area,
      p.staff_name,
      p.staff_area,
      p.division,
      PACK_LABEL[p.status],
      i.product_name,
      i.quantity,
    ]),
  )

export const exportPacksCsv = (packs: Pack[], name: string) =>
  downloadCsv(`${name}.csv`, PACK_CSV_HEADER, packsToRows(packs))
