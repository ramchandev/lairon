import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  Sparkles,
  SkipForward,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { DataTable, type Column } from '@/components/DataTable'
import { Section } from '@/components/FormPage'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { useDivisions } from '@/features/divisions/api'
import { useLocations } from '@/features/locations/api'
import { useProducts } from '@/features/products/api'
import { useAddStockist, useStockists } from '@/features/performance/stockists'
import { monthLabel } from '@/lib/time'
import {
  useAliases,
  useCommitUpload,
  useImportFields,
  useSaveAliases,
  useSaveImportField,
  useSaveTemplate,
  useTemplates,
  useUploads,
} from '../api'
import { Pick } from '../Pick'
import { learnedSynonyms, toCommitLine } from '../commit'
import { matchProduct, nameScore, normalizeProduct, type Match } from '../match/products'
import {
  analyse,
  buildLines,
  mapOf,
  stockMismatches,
  type Analysis,
  type ColumnMap,
} from '../parse/statement'
import { itemsToRows, readPdfItems, type PdfItem } from '../parse/pdf'
import { fileHash, readRows } from '../parse/sheet'

const IGNORE = 'ignore'
const NONE = '__none'
const n0 = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 })

/** Pick files; each is read, checked and saved one after another. */
export function UploadTab({ forMonth }: { forMonth?: string }) {
  const [queue, setQueue] = useState<File[]>([])
  const input = useRef<HTMLInputElement>(null)
  const current = queue[0]
  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center gap-3 p-4">
        <Upload aria-hidden className="size-5 text-muted" />
        <div className="min-w-0 flex-1">
          <b>Upload stockist statements</b>
          <div className="text-[13px] text-muted">
            Excel (.xls, .xlsx) or PDF stock & sales statements. You can choose many at once — they
            are checked one after another.
          </div>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept=".xls,.xlsx,.pdf"
          aria-label="Choose files"
          onChange={(e) => {
            setQueue(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <button className="btn btn-primary" onClick={() => input.current?.click()}>
          Choose files
        </button>
      </div>
      {current && (
        <FileImport
          key={`${current.name}-${current.size}-${queue.length}`}
          file={current}
          forMonth={forMonth}
          remaining={queue.length - 1}
          onDone={() => setQueue((q) => q.slice(1))}
        />
      )}
    </div>
  )
}

function FileImport({
  file,
  remaining,
  onDone,
  forMonth,
}: {
  file: File
  forMonth?: string
  remaining: number
  onDone: () => void
}) {
  const toast = useToast()
  const { profile } = useAuth()
  const fieldRows = useImportFields().data
  const fields = useMemo(() => fieldRows ?? [], [fieldRows])
  const stockistsQ = useStockists()
  const stockistRows = stockistsQ.data
  const stockists = useMemo(() => stockistRows ?? [], [stockistRows])
  const divisions = (useDivisions().data ?? []).filter((d) => d.is_active)
  const locations = useLocations().data ?? []
  const products = (useProducts().data ?? []).filter((p) => p.is_active)
  const aliasRows = useAliases().data
  const uploads = useUploads().data ?? []
  const commit = useCommitUpload()
  const saveAliases = useSaveAliases()
  const saveTemplate = useSaveTemplate()
  const saveField = useSaveImportField()
  const addStockist = useAddStockist()

  const [sheetRows, setSheetRows] = useState<unknown[][] | null>(null)
  const [pdfItems, setPdfItems] = useState<PdfItem[] | null>(null)
  const [hash, setHash] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const buf = await file.arrayBuffer()
        const h = await fileHash(buf)
        if (/\.pdf$/i.test(file.name)) {
          const items = await readPdfItems(buf)
          if (live) {
            setPdfItems(items)
            setHash(h)
          }
        } else {
          const r = await readRows(buf)
          if (live) {
            setSheetRows(r)
            setHash(h)
          }
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'The file could not be read.')
      }
    })()
    return () => {
      live = false
    }
  }, [file])

  // A PDF's columns are found with the same heading words the mapping uses, so wait for the fields.
  const rows = useMemo(
    () => sheetRows ?? (pdfItems && fields.length ? itemsToRows(pdfItems, fields) : null),
    [sheetRows, pdfItems, fields],
  )

  const analysis: Analysis | null = useMemo(
    () => (rows ? analyse(rows, fields, file.name) : null),
    [rows, fields, file.name],
  )

  const [stockistId, setStockistId] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [month, setMonth] = useState('')
  const [override, setOverride] = useState<ColumnMap | null>(null)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [replace, setReplace] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLoc, setNewLoc] = useState('')
  const [adding, setAdding] = useState(false)
  const [declined, setDeclined] = useState<Set<string>>(new Set())
  const [monthChoice, setMonthChoice] = useState<'' | 'sheet' | 'keep'>('')

  // Defaults from what the file says: the month, the division, the stockist that looks like its name.
  const guess = useMemo(() => {
    if (!analysis) return null
    const hint = analysis.meta.divisionHint
    const word = { cc: /critical|\bcc\b/i, cd: /cardia|\bcd\b/i, ol: /oral|\bol\b/i }[hint ?? 'cc']
    const div = hint ? divisions.find((d) => word.test(d.name)) : undefined
    const label = normalizeProduct(
      `${analysis.meta.stockist ?? ''} ${file.name.replace(/\.[a-z]+$/i, '').replace(/\b(cc|cd|ol|sales|lairon|larion)\b/gi, '')}`,
    )
    const best = stockists
      .map((s) => ({ id: s.id, score: nameScore(label, normalizeProduct(s.name)) }))
      .sort((a, b) => b.score - a.score)[0]
    return {
      month: analysis.meta.period?.month ?? forMonth ?? '',
      divisionId: div?.id ?? '',
      stockistId: best && best.score >= 0.5 ? best.id : '',
    }
  }, [analysis, divisions, stockists, file.name, forMonth])
  // Opened from a month: that month, unless the admin agrees the sheet belongs to the month it names.
  const sheetMonth = analysis?.meta.period?.month ?? ''
  const wrongMonth = !!forMonth && !!sheetMonth && sheetMonth !== forMonth
  const sheetName =
    analysis?.meta.stockist?.trim() ||
    file.name
      .replace(/\.[a-z]+$/i, '')
      .replace(/\b(cc|cd|ol|sales?|lairon|larion|stock|statement)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  const month_ =
    month ||
    (forMonth
      ? wrongMonth && monthChoice === 'sheet'
        ? sheetMonth
        : forMonth
      : (guess?.month ?? ''))
  const division_ = divisionId || guess?.divisionId || ''
  const stockist_ = stockistId || guess?.stockistId || ''

  const templates = useTemplates(stockist_).data
  const remembered = analysis && templates?.[analysis.signature]
  const map: ColumnMap = useMemo(
    () => override ?? remembered ?? (analysis ? mapOf(analysis) : {}),
    [override, remembered, analysis],
  )
  const lines = useMemo(() => (analysis ? buildLines(analysis, map) : []), [analysis, map])
  const check = useMemo(
    () => stockMismatches(lines, !!analysis?.columns.some((c) => map[c.index] === 'purchase')),
    [lines, analysis, map],
  )

  const aliasMap = useMemo(() => {
    const m = new Map<string, string>()
    const rows = aliasRows ?? []
    for (const a of rows.filter((x) => !x.stockist_id)) m.set(a.alias, a.product_id)
    for (const a of rows.filter((x) => x.stockist_id === stockist_)) m.set(a.alias, a.product_id)
    return m
  }, [aliasRows, stockist_])
  const names = useMemo(() => [...new Set(lines.map((l) => l.raw_name))], [lines])
  const matches = useMemo(() => {
    const cands = products.map((p) => ({ id: p.id, name: p.name }))
    return new Map<string, Match>(names.map((n) => [n, matchProduct(n, cands, aliasMap)]))
  }, [names, products, aliasMap])
  const allZero = (name: string) =>
    lines.filter((l) => l.raw_name === name).every((l) => Object.values(l.values).every((v) => !v))
  /** a product id, IGNORE, or '' while still unresolved */
  const resolve = (name: string): string => {
    const c = choices[name]
    if (c) return c
    const m = matches.get(name)!
    if (m.productId) return m.productId
    return m.state === 'none' && allZero(name) ? IGNORE : ''
  }
  const unresolved = names.filter((n) => !resolve(n))
  const auto = names.filter((n) => !choices[n] && matches.get(n)!.productId).length

  const existing = uploads.find(
    (u) =>
      u.status === 'active' &&
      u.stockist_id === stockist_ &&
      (u.division_id ?? '') === division_ &&
      u.month.slice(0, 7) === month_,
  )
  const duplicate = hash ? uploads.find((u) => u.file_hash === hash) : undefined
  const missingCore = analysis
    ? fields.filter(
        (f) =>
          f.role === 'core' &&
          ['sales', 'closing'].includes(f.key) &&
          !analysis.columns.some((c) => map[c.index] === f.key),
      )
    : []
  const included = lines.filter((l) => resolve(l.raw_name) !== IGNORE)
  const sum = (k: string) => included.reduce((n, l) => n + (l.values[k] ?? 0), 0)
  const blocked =
    !analysis ||
    analysis.problems.length > 0 ||
    !stockist_ ||
    !/^\d{4}-\d{2}$/.test(month_) ||
    unresolved.length > 0 ||
    missingCore.length > 0 ||
    !included.length ||
    (!!existing && !replace)

  async function addNewStockist() {
    if (!newName.trim() || !newLoc || !profile) return
    try {
      await addStockist.mutateAsync({ name: newName, locationId: newLoc, userId: profile.id })
      const fresh = (await stockistsQ.refetch()).data?.find(
        (s) => s.name.toLowerCase() === newName.trim().toLowerCase(),
      )
      if (fresh) setStockistId(fresh.id)
      setAdding(false)
      setNewName('')
      toast('Stockist added')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  async function save() {
    if (!analysis) return
    try {
      const out = included.map((l) =>
        toCommitLine(l, resolve(l.raw_name) === IGNORE ? null : resolve(l.raw_name)),
      )
      await commit.mutateAsync({
        stockistId: stockist_,
        divisionId: division_ || null,
        month: month_,
        fileName: file.name,
        fileHash: hash,
        from: analysis.meta.period?.from ?? null,
        to: analysis.meta.period?.to ?? null,
        mapping: map,
        lines: out,
        replace,
      })
      // what the admin taught the importer: this stockist's layout, its spellings, and new heading names
      await saveTemplate.mutateAsync({ stockistId: stockist_, signature: analysis.signature, map })
      // Spellings the importer learns: what was chosen (for this stockist, and for everyone), and the
      // automatic matches that were left as they were (for this stockist), so next time they are not asked.
      const globals = new Set((aliasRows ?? []).filter((x) => !x.stockist_id).map((x) => x.alias))
      const chosen = names.filter((n) => choices[n] && choices[n] !== IGNORE)
      const accepted = names.filter((n) => !choices[n] && matches.get(n)!.state === 'auto')
      const taught = [
        ...chosen.flatMap((n) => [
          { alias: normalizeProduct(n), product_id: choices[n], stockist_id: stockist_ },
          { alias: normalizeProduct(n), product_id: choices[n], stockist_id: null },
        ]),
        ...accepted.map((n) => ({
          alias: normalizeProduct(n),
          product_id: matches.get(n)!.productId!,
          stockist_id: stockist_,
        })),
      ].filter((a) => a.alias && (a.stockist_id ? !aliasMap.has(a.alias) : !globals.has(a.alias)))
      if (taught.length) await saveAliases.mutateAsync(taught)
      for (const l of learnedSynonyms(analysis, map)) {
        const f = fields.find((x) => x.key === l.field)
        if (f && !f.synonyms.includes(l.heading))
          await saveField.mutateAsync({
            key: f.key,
            label: f.label,
            synonyms: [...f.synonyms, l.heading],
          })
      }
      toast(`${file.name} saved`)
      onDone()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  if (error)
    return (
      <div className="glass flex items-start gap-3 p-4" role="alert">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
        <div className="flex-1">
          <b>{file.name}</b>
          <div className="text-[13px]">{error}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>
          {remaining ? 'Skip' : 'Close'}
        </button>
      </div>
    )
  if (!analysis) return <div className="glass p-4 text-muted">Reading {file.name}…</div>

  const fieldOptions = fields.map((f) => ({ value: f.key, label: f.label }))
  const colRows = analysis.columns.filter((c) => c.heading.trim() && c.index !== analysis.nameCol)
  const sample = (idx: number) =>
    analysis.rows
      .slice(0, 3)
      .map((r) => (r.cells[idx] === null || r.cells[idx] === undefined ? '' : String(r.cells[idx])))
      .join(' · ')
  const colCols: Column<(typeof colRows)[number]>[] = [
    {
      key: 'h',
      header: 'Heading in the file',
      primary: true,
      cell: (c) => <b>{c.heading.replace(/\s+/g, ' ')}</b>,
    },
    {
      key: 's',
      header: 'Sample values',
      cell: (c) => <span className="mono text-[13px]">{sample(c.index) || '—'}</span>,
    },
    {
      key: 'f',
      header: 'Means',
      cell: (c) => (
        <Pick
          ariaLabel={`Meaning of ${c.heading.replace(/\s+/g, ' ')}`}
          title={`What does “${c.heading.replace(/\s+/g, ' ')}” mean?`}
          value={map[c.index] || NONE}
          onChange={(v) => setOverride({ ...map, [c.index]: v === NONE ? null : v })}
          options={[{ value: NONE, label: 'Ignore this column' }, ...fieldOptions]}
        />
      ),
    },
  ]

  // Rows to look at are fixed once the file is read, so a row stays where it is after it is assigned:
  // first the ones that need a choice, then the ones accepted automatically (80%+) so they can be re-adjusted.
  const attention = [
    ...names.filter((n) => {
      const m = matches.get(n)!
      return !m.productId && !(m.state === 'none' && allZero(n))
    }),
    ...names.filter((n) => matches.get(n)!.state === 'auto'),
  ]
  const prodCols: Column<string>[] = [
    { key: 'n', header: 'Name in the file', primary: true, cell: (n) => <b>{n}</b> },
    {
      key: 'st',
      header: 'Match',
      cell: (n) => {
        const m = matches.get(n)!
        return (
          <span className="text-[13px] text-muted">
            {choices[n] === IGNORE ? (
              <span className="inline-flex items-center gap-1">
                <SkipForward aria-hidden className="size-4" /> Skipped
              </span>
            ) : choices[n] ? (
              <span className="inline-flex items-center gap-1 text-ok">
                <Check aria-hidden className="size-4" /> Assigned
              </span>
            ) : m.state === 'auto' ? (
              <span className="inline-flex items-center gap-1">
                <Sparkles aria-hidden className="size-4" /> Auto-matched (
                {Math.round(m.score * 100)}
                %)
              </span>
            ) : m.state === 'suggest' ? (
              `Suggested (${Math.round(m.score * 100)}%)`
            ) : (
              'Not found'
            )}
          </span>
        )
      },
    },
    {
      key: 'p',
      header: 'Our product',
      cell: (n) => {
        const m = matches.get(n)!
        const closest = new Set(m.options.map((o) => o.id))
        const best = m.state === 'suggest' ? m.options[0] : undefined
        // A suggestion is asked as a question first; "No" opens the full searchable list.
        if (best && !choices[n] && !declined.has(n))
          return (
            <div className="space-y-1.5">
              <div>
                Is it <b>{best.name}</b>?
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-primary btn-sm !h-8 !gap-1 !px-3"
                  aria-label={`Yes, ${n} is ${best.name}`}
                  onClick={() => setChoices({ ...choices, [n]: best.id })}
                >
                  <Check aria-hidden className="size-4" /> Yes
                </button>
                <button
                  className="btn btn-ghost btn-sm !h-8 !gap-1 !px-3"
                  aria-label={`No, ${n} is not ${best.name}`}
                  onClick={() => setDeclined(new Set(declined).add(n))}
                >
                  <Ban aria-hidden className="size-4" /> No
                </button>
                <button
                  className="btn btn-ghost btn-sm !h-8 !gap-1 !px-3"
                  aria-label={`Skip ${n}`}
                  onClick={() => setChoices({ ...choices, [n]: IGNORE })}
                >
                  <SkipForward aria-hidden className="size-4" /> Skip
                </button>
              </div>
            </div>
          )
        return (
          <div className="space-y-1.5">
            <Pick
              ariaLabel={`Product for ${n}`}
              title={`Which product is “${n}”?`}
              placeholder="Choose…"
              value={resolve(n)}
              onChange={(v) => setChoices({ ...choices, [n]: v })}
              options={[
                ...m.options.map((o) => ({ value: o.id, label: o.name, hint: 'Closest match' })),
                ...products
                  .filter((p) => !closest.has(p.id))
                  .map((p) => ({ value: p.id, label: p.name })),
                { value: IGNORE, label: 'Skip this row — leave it out' },
              ]}
            />
            {resolve(n) !== IGNORE && (
              <button
                className="btn btn-ghost btn-sm !h-8 !gap-1 !px-3"
                aria-label={`Skip ${n}`}
                onClick={() => setChoices({ ...choices, [n]: IGNORE })}
              >
                <SkipForward aria-hidden className="size-4" /> Skip this if the medicine is not
                matching
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center gap-3 p-4">
        <FileSpreadsheet aria-hidden className="size-5 text-muted" />
        <div className="min-w-0 flex-1">
          <b>{file.name}</b>
          <div className="text-[13px] text-muted">
            {analysis.rows.length} rows ·{' '}
            {remaining > 0
              ? `${remaining} more file${remaining > 1 ? 's' : ''} waiting`
              : 'last file'}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>
          Skip this file
        </button>
      </div>

      {analysis.problems.length > 0 && (
        <div className="glass flex items-start gap-3 p-4" role="alert">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
          <div>{analysis.problems.join(' ')}</div>
        </div>
      )}

      {analysis.problems.length === 0 && wrongMonth && !monthChoice && (
        <div className="glass space-y-3 p-4" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
            <div>
              <b>This is not the right month.</b>
              <div className="text-[13px]">
                You are uploading for {monthLabel(forMonth!)}, but this sheet is for{' '}
                {monthLabel(sheetMonth)}. Do you want to upload it for {monthLabel(sheetMonth)}{' '}
                instead?
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => setMonthChoice('sheet')}>
              Upload for {monthLabel(sheetMonth)}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setMonthChoice('keep')}>
              Keep {monthLabel(forMonth!)}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onDone}>
              Skip this file
            </button>
          </div>
        </div>
      )}

      {analysis.problems.length === 0 && !(wrongMonth && !monthChoice) && (
        <>
          <Section title="1 · Which statement is this?" stack>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm font-semibold">
                Stockist
                <Pick
                  ariaLabel="Stockist"
                  value={stockist_}
                  onChange={setStockistId}
                  placeholder="Choose a stockist…"
                  options={stockists.map((s) => ({
                    value: s.id,
                    label: s.name,
                    hint: locations.find((l) => l.id === s.location_id)?.name,
                  }))}
                />
              </label>
              <label className="block text-sm font-semibold">
                Division
                <Pick
                  ariaLabel="Division"
                  value={division_}
                  onChange={setDivisionId}
                  all="All of Lairon"
                  options={divisions.map((d) => ({ value: d.id, label: d.name }))}
                />
              </label>
              <label className="block text-sm font-semibold">
                Month
                <input
                  className={inputCls}
                  type="month"
                  value={month_}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </label>
            </div>
            <div className="text-[13px] text-muted">
              File says: {analysis.meta.stockist ?? 'no name found'} ·{' '}
              {analysis.meta.period ? monthLabel(analysis.meta.period.month) : 'no period found'}
              {analysis.meta.divisionHint
                ? ` · division “${analysis.meta.divisionHint.toUpperCase()}”`
                : ''}
            </div>
            {analysis.meta.period?.spansMonths && (
              <div className="text-[13px] text-warn">
                This statement covers more than one month ({analysis.meta.period.from} to{' '}
                {analysis.meta.period.to}). It will be saved as{' '}
                {month_ ? monthLabel(month_) : 'the month above'}.
              </div>
            )}
            {!adding ? (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (!newName) setNewName(sheetName)
                  setAdding(true)
                }}
              >
                <Plus aria-hidden /> Stockist not in the list
              </button>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <label className="block text-sm font-semibold">
                  New stockist
                  <input
                    className={inputCls}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Location
                  <Pick
                    ariaLabel="Location of the new stockist"
                    value={newLoc}
                    onChange={setNewLoc}
                    placeholder="Choose…"
                    options={locations.map((l) => ({ value: l.id, label: l.name }))}
                  />
                </label>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void addNewStockist()}
                  disabled={!newName.trim() || !newLoc}
                >
                  Add stockist
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            )}
            {duplicate && (
              <div className="text-[13px] text-warn">
                This exact file was already uploaded ({duplicate.file_name},{' '}
                {monthLabel(duplicate.month.slice(0, 7))}).
              </div>
            )}
            {existing && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(e) => setReplace(e.target.checked)}
                />
                A statement for this stockist, division and month is already saved (
                {existing.file_name}). Replace it — the old one is kept as history.
              </label>
            )}
          </Section>

          <Section title="2 · What do the columns mean?" stack>
            {remembered && (
              <div className="text-[13px] text-ok">
                This stockist’s column layout is remembered from the last upload.
              </div>
            )}
            <DataTable
              rows={colRows}
              columns={colCols}
              rowKey={(c) => String(c.index)}
              pageSize={100}
            />
            {missingCore.length > 0 && (
              <div className="text-[13px] text-warn" role="alert">
                Still needed: {missingCore.map((f) => f.label).join(', ')}.
              </div>
            )}
            {check.checked > 0 && (
              <div className={`text-[13px] ${check.bad.length ? 'text-warn' : 'text-ok'}`}>
                {check.bad.length
                  ? `${check.bad.length} of ${check.checked} rows don’t add up (opening + purchase − sales = closing). Stockists adjust stock, so this may be fine — otherwise check the columns above.`
                  : `All ${check.checked} rows add up (opening + purchase − sales = closing).`}
              </div>
            )}
          </Section>

          <Section title="3 · Which products are these?" stack>
            <div className="text-[13px] text-muted">
              <CheckCircle2 aria-hidden className="mr-1 inline size-4 text-ok" />
              {auto} of {names.length} matched automatically
              {names.some((n) => matches.get(n)!.state === 'auto')
                ? ' (the 80%+ ones are listed below to re-adjust)'
                : ''}
              .{' '}
              {unresolved.length
                ? `${unresolved.length} need your choice.`
                : 'Nothing left to choose.'}
            </div>
            {attention.length > 0 && (
              <DataTable
                rows={[...new Set(attention)]}
                columns={prodCols}
                rowKey={(n) => n}
                pageSize={200}
              />
            )}
          </Section>

          <Section title="4 · Check and save" stack>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat
                label="Products"
                value={n0(new Set(included.map((l) => resolve(l.raw_name))).size)}
              />
              <Stat label="Sales (paid)" value={n0(sum('sales'))} />
              <Stat label="Free" value={n0(sum('free'))} />
              <Stat label="Closing stock" value={n0(sum('closing'))} />
            </div>
            <div>
              <button
                className="btn btn-primary"
                onClick={() => void save()}
                disabled={blocked || commit.isPending}
              >
                {commit.isPending
                  ? 'Saving…'
                  : remaining
                    ? 'Save and go to next file'
                    : 'Save statement'}
              </button>
              {blocked && (
                <span className="ml-3 text-[13px] text-muted">
                  {!stockist_ ? 'Choose the stockist. ' : ''}
                  {!month_ ? 'Choose the month. ' : ''}
                  {unresolved.length ? 'Choose a product for every row. ' : ''}
                  {existing && !replace ? 'Tick replace to overwrite the earlier statement.' : ''}
                </span>
              )}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-line p-3">
    <div className="text-[12px] text-muted">{label}</div>
    <div className="mono text-lg font-bold">{value}</div>
  </div>
)
