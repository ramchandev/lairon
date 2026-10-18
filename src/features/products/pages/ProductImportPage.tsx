import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileUp } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { primaryBtn, ghostBtn } from '@/components/form-styles'
import { useDivisions } from '@/features/divisions/api'
import { useImportProducts, useProducts } from '../api'
import { planProductImport } from '../importPlan'

const TEMPLATE = 'name,description,divisions\nLairobon,Vitamin D3,OL|CC\n'

export function ProductImportPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const divisions = useDivisions()
  const products = useProducts()
  const run = useImportProducts()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')

  const rows = useMemo(
    () => (text ? planProductImport(text, divisions.data ?? [], products.data ?? []) : []),
    [text, divisions.data, products.data],
  )
  const count = (s: string) => rows.filter((r) => r.status === s).length
  const importable = count('new') + count('update')

  async function onFile(f?: File) {
    if (!f) return
    setFileName(f.name)
    setText(await f.text())
  }
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: 'products-template.csv',
    })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-[880px] pb-28">
      <section className="glass space-y-3 p-4">
        <p className="text-sm text-ink-2">
          CSV with columns <code>name</code>, <code>description</code>, <code>divisions</code>{' '}
          (separate divisions with <code>|</code>, e.g. <code>OL|CC</code>). Existing products are
          matched by name: their description is updated and divisions are added, never removed.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={`${ghostBtn} gap-2`} onClick={() => fileRef.current?.click()}>
            <FileUp className="size-5" /> {fileName || 'Choose CSV file'}
          </button>
          <button className={`${ghostBtn} gap-2`} onClick={downloadTemplate}>
            <Download className="size-5" /> Template
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      </section>

      {rows.length > 0 && (
        <section className="glass mt-4 p-4">
          <p className="mb-3 flex flex-wrap gap-2 text-sm font-semibold">
            <StatusBadge tone="ok">{count('new')} new</StatusBadge>
            <StatusBadge tone="info">{count('update')} existing</StatusBadge>
            <StatusBadge tone={count('error') ? 'danger' : 'muted'}>
              {count('error')} skipped
            </StatusBadge>
          </p>
          <ul className="divide-y divide-line text-sm">
            {rows.map((r) => (
              <li key={r.line} className="flex items-start justify-between gap-3 py-2">
                <span>
                  <span className="tabular text-muted">Line {r.line}</span> ·{' '}
                  <b>{r.name || '(blank)'}</b>
                </span>
                {r.status === 'error' ? (
                  <span className="text-right text-danger">{r.error}</span>
                ) : (
                  <StatusBadge tone={r.status === 'new' ? 'ok' : 'info'}>
                    {r.status === 'new' ? 'New' : 'Update'}
                  </StatusBadge>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="glass fixed inset-x-0 bottom-0 z-40 rounded-b-none border-x-0 border-b-0 p-3 pb-[calc(12px+var(--safe-b))]">
        <div className="mx-auto flex max-w-[880px] gap-3">
          <button
            className={`${ghostBtn} flex-1 sm:flex-none sm:px-6`}
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button
            className={`${primaryBtn} flex-[2] sm:w-auto! sm:flex-none sm:px-8`}
            disabled={importable === 0 || run.isPending}
            onClick={() =>
              run.mutate(rows, {
                onSuccess: (r) => {
                  toast(`Imported: ${r.created} new, ${r.updated} updated`)
                  navigate('/admin/products', { replace: true })
                },
                onError: (e) => toast(e.message, 'error'),
              })
            }
          >
            {run.isPending ? 'Importing…' : `Import ${importable} products`}
          </button>
        </div>
      </div>
    </div>
  )
}
