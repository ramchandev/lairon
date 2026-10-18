import { useEffect, type FormEventHandler, type ReactNode } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { ConfirmDialog } from './ConfirmDialog'
import { Check, CircleAlert, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Adds a "Discard changes?" modal when leaving a dirty form (in-app navigation) and a browser warning on reload/close. */
function useDirtyGuard(dirty: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])
  return blocker
}

interface Props {
  /** The title is shown in the top bar (route chrome); kept for the form's accessible name. */
  title?: string
  subtitle?: string
  dirty: boolean
  saving: boolean
  onSubmit: FormEventHandler<HTMLFormElement>
  saveLabel?: string
  children: ReactNode
}

/** Add/edit screens are ALWAYS full pages (never drawers): sections in glass cards + sticky Cancel/Save bar. */
export function FormPage({
  title,
  subtitle,
  dirty,
  saving,
  onSubmit,
  saveLabel = 'Save',
  children,
}: Props) {
  const navigate = useNavigate()
  const blocker = useDirtyGuard(dirty && !saving)
  return (
    <form onSubmit={onSubmit} noValidate aria-label={title} className="mx-auto max-w-[824px] pb-28">
      {title && <h1 className="sr-only">{title}</h1>}
      <p className="muted mb-3.5 px-0.5">
        Fields marked <span className="text-danger">*</span> are required.
        {subtitle && <> {subtitle}</>}
      </p>
      {children}

      <div className="actionbar">
        <span className="spacer" />
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={saving}>
          <Check /> {saving ? 'Saving…' : saveLabel}
        </button>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Discard changes?"
        description="You have unsaved changes on this page."
        confirmLabel="Discard"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </form>
  )
}

export function Section({
  title,
  icon: Icon,
  stack,
  children,
}: {
  title?: string
  icon?: LucideIcon
  /** Free-form content (rows, tables, nested grids) instead of the two-column field grid. */
  stack?: boolean
  children: ReactNode
}) {
  return (
    <section className="glass form-card">
      {title && (
        <h2 className="sec-t">
          {Icon && <Icon aria-hidden />}
          {title}
        </h2>
      )}
      <div className={stack ? 'space-y-4' : 'grid-2'}>{children}</div>
    </section>
  )
}

export function Field({
  label,
  error,
  hint,
  group,
  required,
  full,
  children,
}: {
  label: string
  error?: string
  hint?: string
  /** For composite controls (segmented, radio groups): a plain wrapper, not a <label>, so the first button isn't misnamed. */
  group?: boolean
  required?: boolean
  /** Span both columns on wide screens. */
  full?: boolean
  children: ReactNode
}) {
  const Wrapper = group ? 'div' : 'label'
  return (
    <Wrapper className={cn('field', full && 'full', error && 'invalid')}>
      <span className="lbl">
        {label}
        {required && <em aria-hidden="true">*</em>}
      </span>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && (
        <span role="alert" className="err">
          <CircleAlert aria-hidden />
          {error}
        </span>
      )}
    </Wrapper>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  /** The title is shown in the top bar (route chrome); kept for the form's accessible name. */
  title?: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="page-h">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
