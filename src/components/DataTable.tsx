import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** The cell shown as the card header on mobile. Exactly one column should set this. */
  primary?: boolean
  className?: string
}

interface Props<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  loading?: boolean
  empty?: ReactNode
  actions?: (row: T) => ReactNode
  pageSize?: number
}

/** One table; below 768px CSS turns each row into a glass card (primary cell as header, actions at the bottom). */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  empty,
  actions,
  pageSize = 20,
}: Props<T>) {
  const [shown, setShown] = useState(pageSize)
  const primary = columns.find((c) => c.primary) ?? columns[0]

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass h-16 animate-pulse" />
        ))}
      </div>
    )
  }
  if (rows.length === 0) return <div className="glass">{empty}</div>
  const visible = rows.slice(0, shown)

  return (
    <>
      <div className="glass table-wrap">
        <table className="dt">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.header}</th>
              ))}
              {actions && (
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    data-label={c.header}
                    className={cn(c === primary && 'primary font-bold', c.className)}
                  >
                    {c.cell(r)}
                  </td>
                ))}
                {actions && <td className="actions">{actions(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="list-foot">
        <span className="muted text-[13px]">
          Showing {visible.length} of {rows.length}
        </span>
        {rows.length > shown && (
          <button className="btn btn-ghost btn-sm" onClick={() => setShown((n) => n + pageSize)}>
            Show more
          </button>
        )}
      </div>
    </>
  )
}

export const rowBtn = 'btn btn-ghost btn-sm'
