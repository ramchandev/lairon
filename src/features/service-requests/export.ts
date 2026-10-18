import { downloadCsv, type Cell } from '@/lib/csvExport'
import { STATUS_LABEL } from './status'
import type { Batch } from './api'

export const CSV_HEADER = [
  'Ref No',
  'Status',
  'Submitted',
  'Manager',
  'Accountability Staff',
  'Date',
  'Doctor Name',
  'Area',
  'Hospital Name',
  'Pharmacy Name',
  'HQ',
  'Division',
  'Qualification',
  'Speciality',
  'Service Amount',
  'Service Type',
  'Expected Business Value',
  'Current Business Value',
  'Offer / Netrate',
  'Offer %',
  'Netrate Amount',
]

/** One row per line item, like the old Google Sheet. Batch details repeat on each row. */
export function batchesToRows(batches: Batch[]): Cell[][] {
  return batches.flatMap((b) =>
    b.services.map((s): Cell[] => [
      b.ref_no,
      STATUS_LABEL[b.status],
      b.submitted_at?.slice(0, 10),
      b.manager_name,
      b.accountability_staff_name,
      s.request_date,
      s.doctor_name,
      s.area,
      s.hospital_name,
      s.pharmacy_name,
      s.hq,
      s.division,
      s.qualification,
      s.speciality,
      s.service_amount,
      s.service_type,
      s.expected_business_value,
      s.current_business_value,
      s.offer_type,
      s.offer_percent,
      s.netrate_amount,
    ]),
  )
}

export const exportBatchesCsv = (batches: Batch[], name: string) =>
  downloadCsv(`${name}.csv`, CSV_HEADER, batchesToRows(batches))
