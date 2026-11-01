import { useMemo, useState } from 'react'
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputCls } from './form-styles'
import { Portal } from './Portal'

/** Searchable multi-choice picker: the field shows the chosen items as chips; the dialog has a search box and checkboxes. */
export function MultiSearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Select',
  title,
  allowOther,
}: {
  value: string[]
  onChange: (next: string[]) => void
  options: string[]
  placeholder?: string
  title?: string
  /** Lets the user add a value that is not in the list. */
  allowOther?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [other, setOther] = useState('')

  // Chosen values that are not (or no longer) in the list stay visible and removable.
  const all = useMemo(
    () => [...options, ...value.filter((v) => !options.includes(v))],
    [options, value],
  )
  const filtered = all.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()))
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])
  const close = () => {
    setOpen(false)
    setQ('')
    setOther('')
  }
  const addOther = () => {
    const v = other.trim()
    if (!v) return
    if (!value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v])
    setOther('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          inputCls,
          'flex min-h-12 h-auto items-center justify-between gap-2 py-2 text-left',
        )}
      >
        {value.length ? (
          <span className="flex min-w-0 flex-wrap gap-1.5">
            {value.map((v) => (
              <span key={v} className="tag">
                {v}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted">{placeholder}</span>
        )}
        <ChevronDown className="size-5 shrink-0 text-muted" />
      </button>

      {open && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-[#142033]/40 sm:items-center sm:p-4"
            onMouseDown={close}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={title ?? placeholder}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex max-h-[80vh] w-full flex-col rounded-t-[22px] border border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_24px_60px_rgba(20,32,51,.28)] sm:max-w-md sm:rounded-[22px]"
            >
              <div className="flex items-center justify-between gap-2 p-4 pb-2">
                <h2 className="font-extrabold">{title ?? placeholder}</h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="grid size-9 place-items-center rounded-lg"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="px-4 pb-2">
                <input
                  autoFocus
                  type="search"
                  placeholder="Search"
                  aria-label="Search options"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className={inputCls}
                />
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                {filtered.map((o) => {
                  const on = value.includes(o)
                  return (
                    <li key={o}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggle(o)}
                        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-primary-soft"
                      >
                        <span
                          className={cn(
                            'grid size-5 shrink-0 place-items-center rounded-md border',
                            on ? 'border-primary bg-primary text-white' : 'border-line-2 bg-white',
                          )}
                        >
                          {on && <Check className="size-3.5" />}
                        </span>
                        <span>{o}</span>
                      </button>
                    </li>
                  )
                })}
                {filtered.length === 0 && (
                  <li className="px-3 py-4 text-sm text-muted">No matches</li>
                )}
              </ul>
              {allowOther && (
                <div className="flex gap-2 border-t border-line px-4 pt-3">
                  <input
                    aria-label="Add another value"
                    placeholder="Not in the list? Type it"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addOther()
                      }
                    }}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={addOther}
                    disabled={!other.trim()}
                  >
                    <Plus aria-hidden /> Add
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 p-4">
                <span className="muted text-sm">{value.length} selected</span>
                <button type="button" className="btn btn-primary" onClick={close}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}
