import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Section } from '@/components/FormPage'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useProducts } from '@/features/products/api'
import { useStockists } from '@/features/performance/stockists'
import {
  useAliases,
  useDeleteAlias,
  useDeleteImportField,
  useImportFields,
  useSaveImportField,
} from '../api'
import type { FieldDef } from '../parse/statement'

const slug = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

/** The headings the importer knows (and the other spellings it recognises), and the product spellings it has learnt. */
export function HeadingsTab() {
  const fields = useImportFields().data ?? []
  const save = useSaveImportField()
  const del = useDeleteImportField()
  const toast = useToast()
  const [label, setLabel] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const aliases = useAliases().data ?? []
  const delAlias = useDeleteAlias()
  const products = useProducts().data ?? []
  const stockists = useStockists().data ?? []

  const text = (f: FieldDef) => drafts[f.key] ?? f.synonyms.join(', ')
  async function saveSyn(f: FieldDef) {
    try {
      await save.mutateAsync({
        key: f.key,
        label: f.label,
        synonyms: text(f)
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      })
      setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== f.key)))
      toast('Saved')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  async function add() {
    const key = slug(label)
    if (!key || fields.some((f) => f.key === key))
      return toast('That heading already exists', 'error')
    try {
      await save.mutateAsync({
        key,
        label: label.trim(),
        role: 'extra',
        synonyms: [label.trim().toLowerCase()],
      })
      setLabel('')
      toast('Heading added — it is stored and shown with each statement')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  return (
    <div className="space-y-4">
      <Section title="Headings the importer understands" stack>
        <div className="text-[13px] text-muted">
          Core headings feed the reports. Other spellings are separated by commas; when you correct
          a column during an upload, its heading is added here automatically.
        </div>
        {fields.map((f) => (
          <div key={f.key} className="grid gap-2 sm:grid-cols-[180px_1fr_auto] sm:items-center">
            <div>
              <b>{f.label}</b>{' '}
              <span className="text-[12px] text-muted">{f.role === 'core' ? 'core' : 'extra'}</span>
            </div>
            <input
              className={inputCls}
              aria-label={`Spellings for ${f.label}`}
              value={text(f)}
              onChange={(e) => setDrafts({ ...drafts, [f.key]: e.target.value })}
            />
            <div className="flex gap-1">
              <button
                className="btn btn-ghost btn-sm"
                disabled={drafts[f.key] === undefined}
                onClick={() => void saveSyn(f)}
              >
                Save
              </button>
              {f.role === 'extra' && (
                <button
                  className="btn btn-ghost btn-sm"
                  aria-label={`Remove ${f.label}`}
                  onClick={() => del.mutate(f.key)}
                >
                  <Trash2 aria-hidden />
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <label className="block text-sm font-semibold">
            Add a heading
            <input
              className={inputCls}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Damaged qty"
            />
          </label>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void add()}
            disabled={!label.trim()}
          >
            <Plus aria-hidden /> Add
          </button>
        </div>
      </Section>

      <Section title="Product spellings learnt" stack>
        {aliases.length === 0 && (
          <div className="text-[13px] text-muted">
            None yet — they appear as you match products during uploads.
          </div>
        )}
        {aliases.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-sm">
            <span className="mono min-w-0 flex-1 truncate">{a.alias}</span>
            <span aria-hidden>→</span>
            <b className="min-w-0 flex-1 truncate">
              {products.find((p) => p.id === a.product_id)?.name ?? '—'}
            </b>
            <span className="text-[12px] text-muted">
              {a.stockist_id ? stockists.find((s) => s.id === a.stockist_id)?.name : 'everyone'}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              aria-label={`Forget ${a.alias}`}
              onClick={() => delAlias.mutate(a.id)}
            >
              <Trash2 aria-hidden />
            </button>
          </div>
        ))}
      </Section>
    </div>
  )
}
