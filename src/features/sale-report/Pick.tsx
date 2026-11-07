import { SearchSelect, type Option } from '@/components/SearchSelect'

const ALL = '__all'

/** A searchable drop-down for the Sale Report screens; `all` adds a first "everything" choice that means ''. */
export function Pick({
  value,
  onChange,
  options,
  all,
  title,
  ariaLabel,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: Option[]
  all?: string
  title?: string
  ariaLabel?: string
  placeholder?: string
}) {
  const opts = all ? [{ value: ALL, label: all }, ...options] : options
  return (
    <SearchSelect
      value={all && !value ? ALL : value}
      onChange={(v) => onChange(v === ALL ? '' : v)}
      options={opts}
      title={title ?? ariaLabel ?? all ?? placeholder}
      ariaLabel={ariaLabel}
      placeholder={placeholder ?? all ?? 'Choose…'}
    />
  )
}
