import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useMatches, useNavigate } from 'react-router-dom'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared app chrome, built to match design/lairon-ez-prototype.html exactly:
 * brand mark, top bar (sticky, blurred), bottom tab bar, and the sub-page behaviour (back arrow + title in the top bar,
 * bottom bar hidden). Routes declare their chrome with `handle: { title, sub?, back? }`.
 */

export interface RouteHandle {
  title?: string
  /** A sub-page (form / detail): top bar shows ← and the title; the bottom bar is hidden. */
  sub?: boolean
  /** Where ← goes when there is no history to go back to. */
  back?: string
}

// ───────────── dynamic title override (e.g. "Add Staff" depends on the chosen role, "Review import" on the step) ─────────────
const TitleCtx = createContext<{ title: string | null; setTitle: (t: string | null) => void }>({
  title: null,
  setTitle: () => {},
})

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null)
  return <TitleCtx.Provider value={{ title, setTitle }}>{children}</TitleCtx.Provider>
}

/** Lets a page set the top-bar title when the route alone can't know it. Cleared when the page unmounts. */
export function useSubTitle(title: string | null | undefined) {
  const { setTitle } = useContext(TitleCtx)
  useEffect(() => {
    setTitle(title ?? null)
    return () => setTitle(null)
  }, [title, setTitle])
}

export function useRouteChrome(): { sub: boolean; title: string; back?: string } {
  const matches = useMatches()
  const { title: override } = useContext(TitleCtx)
  const handle = [...matches]
    .reverse()
    .map((m) => m.handle as RouteHandle | undefined)
    .find((h) => h && (h.title || h.sub !== undefined))
  return { sub: !!handle?.sub, title: override ?? handle?.title ?? '', back: handle?.back }
}

// ───────────── brand ─────────────
export function BrandMark() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-[#3b74e0] to-[#1f47a3] text-base font-extrabold tracking-[-.02em] text-white shadow-[0_6px_14px_rgba(43,92,198,.28)]">
      L
    </span>
  )
}

export function Brand({
  to,
  subtitle,
  className,
}: {
  to?: string
  subtitle?: string
  className?: string
}) {
  const inner = (
    <>
      <BrandMark />
      <span className="text-base leading-[1.1] font-extrabold tracking-[-.01em]">
        LAIRON EZ
        {subtitle && (
          <small className="block text-xs font-medium tracking-normal text-muted">{subtitle}</small>
        )}
      </span>
    </>
  )
  const cls = cn('flex items-center gap-2.5 no-underline', className)
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

// ───────────── buttons ─────────────
export const iconBtn =
  'relative inline-grid size-[42px] cursor-pointer place-items-center rounded-xl border border-transparent bg-transparent text-ink-2 no-underline hover:border-line hover:bg-white/75'

// ───────────── top bar ─────────────
export function TopBar({
  left,
  right,
  roleApp,
}: {
  left: ReactNode
  right?: ReactNode
  roleApp?: boolean
}) {
  const { sub, title, back } = useRouteChrome()
  const navigate = useNavigate()
  // The prototype hides in-page h1s on sub-pages: the title already sits in the top bar.
  useEffect(() => {
    document.body.classList.toggle('subpage', sub)
    return () => document.body.classList.remove('subpage')
  }, [sub])
  const goBack = () => {
    // Real history keeps tabs and filters; a deep link falls back to the parent screen.
    if ((window.history.state as { idx?: number } | null)?.idx) navigate(-1)
    else navigate(back ?? '/', { replace: true })
  }
  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex min-h-[60px] items-center gap-2 border-b border-line bg-[rgba(236,241,248,.74)] py-2 pr-3 pl-4 backdrop-blur-[18px] backdrop-saturate-[140%] lg:py-2.5 lg:pr-5 lg:pl-7',
        roleApp && 'lg:pr-[max(20px,calc(50%-340px))] lg:pl-[max(20px,calc(50%-340px))]',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {sub ? (
          <>
            <button type="button" className={iconBtn} onClick={goBack} aria-label="Back">
              <ArrowLeft className="size-5" strokeWidth={1.9} />
            </button>
            <h1 className="truncate text-[17px] font-bold">{title}</h1>
          </>
        ) : (
          left
        )}
      </div>
      <div className="flex items-center gap-1">{right}</div>
    </header>
  )
}

// ───────────── bottom tab bar ─────────────
export interface TabItem {
  to: string
  label: string
  icon: LucideIcon
  /** NavLink `end` (exact) matching, for index routes. */
  end?: boolean
  /** Force the active state (e.g. "More" is active on the pages it leads to). */
  active?: boolean
  badge?: number
}

export function BottomNav({
  items,
  roleApp,
  label = 'Primary',
}: {
  items: TabItem[]
  roleApp?: boolean
  label?: string
}) {
  const { pathname } = useLocation()
  return (
    <nav
      aria-label={label}
      className={cn(
        'glass fixed inset-x-2.5 bottom-[calc(10px+var(--safe-b))] z-30 grid gap-0.5 rounded-[22px]! p-1.5',
        roleApp
          ? 'lg:right-auto lg:left-1/2 lg:w-[min(560px,calc(100%-20px))] lg:-translate-x-1/2'
          : 'lg:hidden',
      )}
      style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
    >
      {items.map(({ to, label: text, icon: Icon, end, active, badge }) => {
        // Computed here (not NavLink's own matching) so a tab can be "current" for pages it leads to, and screen readers hear it.
        const on =
          active ?? (end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`))
        return (
          <Link
            key={to}
            to={to}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'relative flex min-h-[54px] flex-col items-center justify-center gap-[3px] rounded-2xl text-[11.5px] font-semibold text-muted no-underline',
              on && 'bg-primary-soft text-primary',
            )}
          >
            <Icon className="size-5" strokeWidth={1.9} />
            <span>{text}</span>
            {badge ? (
              <span
                className="absolute top-[5px] left-[calc(50%+6px)] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-[5px] text-[11px] font-bold text-white tabular"
                aria-label={`${badge} in draft`}
              >
                {badge}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
