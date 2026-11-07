import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, rowBtn, type Column } from '@/components/DataTable'
import { useToast } from '@/components/Toast'
import { monthLabel } from '@/lib/time'
import { useDeleteUpload, useUploads, type Upload } from '../api'

/** Every statement uploaded so far, newest month first; replaced ones stay as history. */
export function UploadsTab({ month }: { month?: string }) {
  const uploads = useUploads()
  const del = useDeleteUpload()
  const toast = useToast()
  const [gone, setGone] = useState<Upload | null>(null)
  const columns: Column<Upload>[] = [
    ...(month
      ? []
      : [
          {
            key: 'm',
            header: 'Month',
            cell: (u: Upload) => <b>{monthLabel(u.month.slice(0, 7))}</b>,
          },
        ]),
    { key: 's', header: 'Stockist', primary: true, cell: (u) => u.stockist?.name ?? '—' },
    { key: 'd', header: 'Division', cell: (u) => u.division?.name ?? 'All of Lairon' },
    { key: 'f', header: 'File', cell: (u) => <span className="text-[13px]">{u.file_name}</span> },
    {
      key: 'l',
      header: 'Products',
      cell: (u) => <span className="mono">{u.lines[0]?.count ?? 0}</span>,
    },
    {
      key: 'st',
      header: 'Status',
      cell: (u) =>
        u.status === 'active' ? (
          <span className="text-ok">Current</span>
        ) : (
          <span className="text-muted">Replaced</span>
        ),
    },
    {
      key: 'u',
      header: 'Uploaded',
      cell: (u) => new Date(u.uploaded_at).toLocaleDateString('en-IN'),
    },
  ]
  return (
    <>
      <DataTable
        rows={(uploads.data ?? []).filter((u) => !month || u.month.slice(0, 7) === month)}
        columns={columns}
        rowKey={(u) => u.id}
        loading={uploads.isLoading}
        empty={<div className="p-6 text-center text-muted">No statements uploaded yet.</div>}
        pageSize={50}
        actions={(u) => (
          <button
            className={rowBtn}
            aria-label={`Delete ${u.file_name}`}
            onClick={() => setGone(u)}
          >
            <Trash2 aria-hidden />
          </button>
        )}
      />
      <ConfirmDialog
        open={!!gone}
        title="Delete this upload?"
        description={
          gone
            ? `${gone.stockist?.name ?? 'This stockist'} — ${monthLabel(gone.month.slice(0, 7))} (${gone.file_name}). Its figures are removed from the reports.`
            : ''
        }
        confirmLabel="Delete"
        busy={del.isPending}
        onCancel={() => setGone(null)}
        onConfirm={async () => {
          if (!gone) return
          try {
            await del.mutateAsync(gone.id)
            toast('Upload deleted')
          } catch (e) {
            toast((e as Error).message, 'error')
          }
          setGone(null)
        }}
      />
    </>
  )
}
