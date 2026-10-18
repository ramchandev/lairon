import { useMemo, useState } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputCls } from './form-styles'

export interface Option {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string, label: string) => void
  options: Option[]
  placeholder?: string
  title?: string
  disabled?: boolean
  /** Adds an "Others" row that asks for free text; the typed text is what gets saved. */
  allowOther?: boolean
  /** Note shown in the picker, e.g. "Filtered by division". */
  note?: string
}

const SEARCH_THRESHOLD = 7

/** Button-styled field that opens a picker: bottom sheet on phones, centred dialog on larger screens. */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Select',
  title,
  disabled,
  allowOther,
  note,
}: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [otherMode, setOtherMode] = useState(false)
  const [otherText, setOtherText] = useState('')

  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())),
    [options, q],
  )
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value

  const close = () => {
    setOpen(false)
    setQ('')
    setOtherMode(false)
    setOtherText('')
  }
  const pick = (o: Option) => {
    onChange(o.value, o.label)
    close()
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          inputCls,
          'flex min-h-12 items-center justify-between gap-2 text-left',
          !value && 'text-muted',
        )}
      >
        <span className="truncate">{value ? selectedLabel : placeholder}</span>
        <ChevronDown className="size-5 shrink-0 text-muted" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#142033]/40 sm:items-center sm:p-4"
          onMouseDown={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title ?? placeholder}
            onMouseDown={(e) => e.stopPropagation()}
            className="glass flex max-h-[80vh] w-full flex-col rounded-b-none bg-white/95 sm:max-w-md sm:rounded-b-[18px]"
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
            {note && <p className="px-4 pb-2 text-xs text-muted">{note}</p>}
            {options.length > SEARCH_THRESHOLD && !otherMode && (
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
            )}
            <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {!otherMode &&
                filtered.map((o) => (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => pick(o)}
                      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left hover:bg-primary-soft"
                    >
                      <span>{o.label}</span>
                      {o.value === value && <Check className="size-4 text-primary" />}
                    </button>
                  </li>
                ))}
              {!otherMode && filtered.length === 0 && (
                <li className="px-3 py-4 text-sm text-muted">No matches</li>
              )}
              {allowOther && !otherMode && (
                <li>
                  <button
                    type="button"
                    onClick={() => setOtherMode(true)}
                    className="min-h-11 w-full rounded-lg px-3 text-left font-semibold text-primary hover:bg-primary-soft"
                  >
                    Others…
                  </button>
                </li>
              )}
              {otherMode && (
                <li className="space-y-3 px-2 pt-2">
                  <input
                    autoFocus
                    aria-label="Other value"
                    placeholder="Type the value"
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    disabled={!otherText.trim()}
                    onClick={() => pick({ value: otherText.trim(), label: otherText.trim() })}
                    className="min-h-11 w-full rounded-control bg-primary font-semibold text-white disabled:opacity-50"
                  >
                    Use this value
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
