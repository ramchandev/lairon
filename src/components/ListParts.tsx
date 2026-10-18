import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Plus, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Avatar/icon + name + secondary line, as in the prototype's table "primary" cells. */
export function Person({ name, sub, lead }: { name: ReactNode; sub?: ReactNode; lead: ReactNode }) {
  return (
    <div className="person">
      {lead}
      <div className="min-w-0">
        <div className="pn">{name}</div>
        {sub && <div className="ps">{sub}</div>}
      </div>
    </div>
  )
}

/** Rounded icon tile used instead of a photo (vehicles, products, divisions). */
export function IconTile({ icon: Icon, hue = 215 }: { icon: LucideIcon; hue?: number }) {
  return (
    <span
      className="av-icon"
      style={{ background: `hsl(${hue} 70% 94%)`, color: `hsl(${hue} 55% 38%)` }}
      aria-hidden
    >
      <Icon />
    </span>
  )
}

export const Tag = ({ children, mono }: { children: ReactNode; mono?: boolean }) => (
  <span className={cn('tag', mono && 'mono')}>{children}</span>
)

export const Tags = ({ items }: { items: string[] }) =>
  items.length ? (
    <div className="tags">
      {items.map((t) => (
        <Tag key={t}>{t}</Tag>
      ))}
    </div>
  ) : (
    <>—</>
  )

/** Row action: an icon button with an accessible name (prototype's pencil / eye / trash). */
export function IconLink({
  to,
  label,
  icon: Icon,
  danger,
}: {
  to: string
  label: string
  icon: LucideIcon
  danger?: boolean
}) {
  return (
    <Link to={to} className={cn('icon-btn', danger && 'danger')} aria-label={label} title={label}>
      <Icon aria-hidden />
    </Link>
  )
}

export function IconButton({
  label,
  icon: Icon,
  onClick,
  danger,
  disabled,
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={cn('icon-btn', danger && 'danger')}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon aria-hidden />
    </button>
  )
}

/** Desktop "Add X" button in the page header; phones get the floating button instead. */
export function AddButton({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="btn btn-primary hidden lg:inline-flex">
      <Plus aria-hidden /> {label}
    </Link>
  )
}

export function Fab({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="fab" aria-label={label}>
      <Plus aria-hidden />
    </Link>
  )
}
