import { useState, type MouseEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
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
  /** Makes the whole row clickable: where it leads (or null for a row that isn't). The action buttons keep working on their own. */
  rowTo?: (row: T) => string | null
  /** Same, for rows that open something other than a page (a dialog, a tab…). */
  onRowClick?: (row: T) => void
}

const INTERACTIVE =
  'a, button, input, select, textarea, label, summary, [role="switch"], [role="button"]'

/** A table row you can click anywhere on (clicks on links/buttons inside it are left alone). */
function ClickableRow({
  to,
  onOpen,
  children,
}: {
  to: string | null
  onOpen?: () => void
  children: ReactNode
}) {
  const navigate = useNavigate()
  const live = !!to || !!onOpen
  return (
    <tr
      className={live ? 'row-link' : undefined}
      onClick={
        live
          ? (e: MouseEvent<HTMLTableRowElement>) => {
              if ((e.target as HTMLElement).closest(INTERACTIVE)) return
              if (window.getSelection()?.toString()) return // the user is selecting text
              if (onOpen) onOpen()
              else if (to) navigate(to)
            }
          : undefined
      }
    >
      {children}
    </tr>
  )
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
  rowTo,
  onRowClick,
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
            {visible.map((r) => {
              const cells = (
                <>
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
                </>
              )
              return rowTo || onRowClick ? (
                <ClickableRow
                  key={rowKey(r)}
                  to={rowTo?.(r) ?? null}
                  onOpen={onRowClick ? () => onRowClick(r) : undefined}
                >
                  {cells}
                </ClickableRow>
              ) : (
                <tr key={rowKey(r)}>{cells}</tr>
              )
            })}
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
