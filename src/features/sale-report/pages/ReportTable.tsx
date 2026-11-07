import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { SearchInput } from '@/components/ListControls'
import type { Cell } from '@/lib/csvExport'
import { cn } from '@/lib/utils'
import type { Kind, Table } from '../reports'

const n0 = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
const n2 = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
export const show = (v: Cell, kind: Kind) => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v !== 'number') return String(v)
  if (kind === 'money') return `₹${n0(v)}`
  if (kind === 'pct') return `${n2(v)}%`
  return n2(v)
}

export type Sort = { col: number; dir: 1 | -1 } | null

/** The rows as shown: searched across every cell, then sorted by the clicked heading (empty values last). */
export function arrange(rows: Cell[][], q: string, sort: Sort) {
  const needle = q.trim().toLowerCase()
  const kept = needle
    ? rows.filter((r) =>
        r.some((c) =>
          String(c ?? '')
            .toLowerCase()
            .includes(needle),
        ),
      )
    : rows
  if (!sort) return kept
  return [...kept].sort((a, b) => {
    const x = a[sort.col]
    const y = b[sort.col]
    const xe = x === null || x === undefined || x === ''
    const ye = y === null || y === undefined || y === ''
    if (xe || ye) return xe === ye ? 0 : xe ? 1 : -1
    return (
      sort.dir *
      (typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'en', { numeric: true }))
    )
  })
}

/** A report as a table you can search and sort; numbers are right-aligned under right-aligned headings. */
export function ReportTable({
  table,
  rows,
  loading,
  q,
  onQ,
  sort,
  onSort,
}: {
  table: Table | null
  /** The rows to show: `arrange(table.rows, q, sort)`. */
  rows: Cell[][]
  loading?: boolean
  q: string
  onQ: (q: string) => void
  sort: Sort
  onSort: (s: Sort) => void
}) {
  const [shown, setShown] = useState(100)

  if (loading)
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass h-16 animate-pulse" />
        ))}
      </div>
    )
  const cols = table?.columns ?? []
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={onQ} placeholder="Search this report" />
        <span className="text-[13px] text-muted">
          {rows.length === (table?.rows.length ?? 0)
            ? `${rows.length} rows`
            : `${rows.length} of ${table?.rows.length} rows`}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="glass p-6 text-center text-muted">Nothing to show for these filters.</div>
      ) : (
        <div className="glass table-wrap">
          <table className="dt">
            <thead>
              <tr>
                {cols.map((c, i) => {
                  const on = sort?.col === i
                  const Icon = !on ? ChevronsUpDown : sort.dir === 1 ? ArrowUp : ArrowDown
                  return (
                    <th
                      key={c.label}
                      className={c.kind === 'text' ? undefined : 'ta-r'}
                      aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                    >
                      <button
                        type="button"
                        className={cn(
                          'inline-flex items-center gap-1 font-[inherit] uppercase tracking-[inherit]',
                          c.kind !== 'text' && 'flex-row-reverse',
                          on ? 'text-ink' : 'text-muted',
                        )}
                        onClick={() =>
                          onSort(
                            !on
                              ? { col: i, dir: c.kind === 'text' ? 1 : -1 }
                              : sort.dir === (c.kind === 'text' ? 1 : -1)
                                ? { col: i, dir: -sort.dir as 1 | -1 }
                                : null,
                          )
                        }
                      >
                        {c.label}
                        <Icon aria-hidden className="size-3.5 shrink-0 opacity-70" />
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((r, ri) => (
                <tr key={ri}>
                  {cols.map((c, i) => (
                    <td
                      key={c.label}
                      data-label={c.label}
                      className={cn(
                        i === 0 && 'primary font-bold',
                        c.kind !== 'text' && 'ta-r tabular',
                      )}
                    >
                      {show(r[i], c.kind)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > shown && (
        <div className="list-foot">
          <span className="muted text-[13px]">
            Showing {shown} of {rows.length}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setShown((n) => n + 100)}>
            Show more
          </button>
        </div>
      )}
    </div>
  )
}
