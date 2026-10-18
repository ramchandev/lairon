import { cn } from '@/lib/utils'

/** Segmented control for two- or three-option choices (Duty type, Offer/Netrate, …). */
export function Segmented({
  options,
  value,
  onChange,
  label,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-control bg-muted-bg p-1"
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            'min-h-10 flex-1 rounded-[10px] px-3 text-sm font-semibold text-muted',
            value === o && 'bg-white text-primary shadow-sm',
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
