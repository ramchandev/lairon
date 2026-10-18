import { Search, type LucideIcon } from 'lucide-react'
import { inputCls } from './form-styles'

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="search">
      <Search aria-hidden />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number; icon?: LucideIcon }[]
  value: T
  onChange: (k: T) => void
}) {
  return (
    <div role="tablist" className="tabs glass">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className="tab"
        >
          {t.icon && <t.icon aria-hidden size={18} />}
          {t.label}
          {t.count !== undefined && <span className="count tabular">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function ChipFilter<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (k: T) => void
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className="chip"
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
