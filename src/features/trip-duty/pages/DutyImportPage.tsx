import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubTitle } from '@/layouts/chrome'
import { useToast } from '@/components/Toast'
import { useVehicles } from '@/features/vehicles/api'
import { useRunImport } from '../import/api'
import { ImportReview } from '../import/ImportReview'
import { ImportUpload } from '../import/ImportUpload'
import { toPayload } from '../import/plan'
import { readImportFile, type ReadResult } from '../import/readFile'

/** Import duties from Excel/CSV: upload → review (nothing saved yet) → one transaction in Postgres. */
export function DutyImportPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const vehicles = useVehicles()
  const run = useRunImport()
  const [file, setFile] = useState<ReadResult | null>(null)
  useSubTitle(file ? 'Review import' : undefined)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onFile(f: File) {
    setReading(true)
    setError(null)
    try {
      const r = await readImportFile(f, vehicles.data ?? [])
      if (r.fatal) setError(r.fatal)
      else setFile(r)
    } catch {
      setError('This file couldn’t be read. Use .xlsx, .xls or .csv, or download the template.')
    } finally {
      setReading(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-4 flex items-center gap-3">
        <div>
          <p className="text-sm text-muted">
            {file
              ? 'Nothing is saved until you press Import.'
              : 'Load past months or a driver’s existing sheet.'}
          </p>
        </div>
      </div>
      {file ? (
        <ImportReview
          file={file}
          busy={run.isPending}
          onBack={() => setFile(null)}
          onImport={(plan, s) =>
            run.mutate(toPayload(plan, { fileName: file.fileName, ...s }), {
              onSuccess: (r) => {
                toast(
                  `Imported ${r.rows_read} rows${r.replaced ? ` (replaced ${r.replaced})` : ''}`,
                )
                navigate(`/admin/trip-duty?tab=month&driver=${s.driverId}&m=${s.month}`, {
                  replace: true,
                })
              },
              onError: (e) => toast(e.message, 'error'),
            })
          }
        />
      ) : (
        <ImportUpload onFile={onFile} busy={reading} error={error} />
      )}
    </div>
  )
}
