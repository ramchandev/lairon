import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Bell, ChevronRight, LogOut } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { Avatar } from '@/components/Avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDashboard } from '@/features/dashboard/api'
import { cn } from '@/lib/utils'
import {
  ADMIN_BOTTOM,
  MORE_ROOTS,
  adminHref,
  adminRoot,
  canPreview,
  navFor,
  previewRoots,
} from './adminNav'
import { BottomNav, Brand, TopBar, iconBtn, useRouteChrome } from './chrome'

type Notif = { id: string; href: string; text: string }

function buildNotifs(counts: { requests: number; starter: number; leave: number }): Notif[] {
  const line = (n: number, singular: string) =>
    `${n} ${singular}${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} attention`
  return (
    [
      counts.requests > 0 && {
        id: 'requests',
        href: adminHref('service-requests'),
        text: line(counts.requests, 'service request'),
      },
      counts.starter > 0 && {
        id: 'starter',
        href: adminHref('starter-packs'),
        text: line(counts.starter, 'starter pack'),
      },
      counts.leave > 0 && {
        id: 'leave',
        href: adminHref('trip-duty'),
        text: line(counts.leave, 'leave request'),
      },
    ] as (Notif | false)[]
  ).filter(Boolean) as Notif[]
}

/**
 * Admin shell — matches design/lairon-ez-prototype.html: grouped sidebar with pending counts (≥1024px),
 * a top bar with breadcrumb + notifications + signed-in user, a 5-tab bottom bar with "More" (<1024px),
 * and sub-pages that swap the bottom bar for a back arrow + title.
 */
export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const { pathname, search } = useLocation()
  const { sub, title } = useRouteChrome()
  const kpi = useDashboard().data
  const [confirmOut, setConfirmOut] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [unread, setUnread] = useState(false)
  const seeded = useRef(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const root = adminRoot(pathname, search)
  const nav = navFor(profile?.email)
  const counts = {
    requests: kpi?.pending_service_requests ?? 0,
    starter: kpi?.pending_starter_packs ?? 0,
    leave: kpi?.pending_leave_requests ?? 0,
  }
  const name = profile?.full_name ?? 'Admin'
  const navLabel = nav.flatMap((g) => g.items).find((i) => i.root === root)?.label ?? title

  // Seed the bell once from the dashboard KPI; dismissed items stay gone for this session.
  useEffect(() => {
    if (seeded.current || kpi === undefined) return
    const list = buildNotifs({
      requests: kpi.pending_service_requests ?? 0,
      starter: kpi.pending_starter_packs ?? 0,
      leave: kpi.pending_leave_requests ?? 0,
    })
    setNotifs(list)
    setUnread(list.length > 0)
    seeded.current = true
  }, [kpi])

  function closeNotifs() {
    setNotifOpen(false)
    setNotifs([])
    setUnread(false)
  }

  useEffect(() => {
    if (!notifOpen) return
    const onPointer = (e: MouseEvent) => {
      if (!notifRef.current?.contains(e.target as Node)) closeNotifs()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNotifs()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [notifOpen])

  if (previewRoots.includes(root) && !canPreview(profile?.email))
    return <Navigate to="/admin" replace />

  return (
    <div className="flex min-h-screen">
      <aside
        aria-label="Main navigation"
        className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col overflow-y-auto border-r border-line bg-white/[.42] px-3.5 py-[18px] backdrop-blur-[18px] backdrop-saturate-[140%] lg:flex"
      >
        <Brand to="/admin" subtitle="Admin portal" className="px-2.5 pt-1 pb-[18px]" />
        {nav.map((g) => (
          <div key={g.group} className="mt-3.5">
            <h6 className="px-3 pb-1.5 text-[11.5px] font-bold tracking-[.08em] text-muted uppercase">
              {g.group}
            </h6>
            {g.items.map((i) => {
              const active = root === i.root
              const c = i.count ? counts[i.count] : 0
              return (
                <Link
                  key={i.key}
                  to={adminHref(i.root)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-semibold text-ink-2 no-underline hover:bg-white/60',
                    active && 'bg-white text-primary shadow-[0_2px_10px_rgba(30,50,90,.07)]',
                  )}
                >
                  <i.icon className="size-5 shrink-0" strokeWidth={1.9} />
                  <span>{i.label}</span>
                  {c ? (
                    <span className="ml-auto rounded-full bg-warn-bg px-2 py-px text-xs text-warn tabular">
                      {c}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        ))}
      </aside>

      <div className="min-w-0 flex-1">
        <TopBar
          left={
            <>
              <Brand to="/admin" className="lg:hidden" />
              <div className="hidden items-center gap-2 text-sm font-medium text-muted lg:flex">
                <span>Admin</span>
                <ChevronRight className="size-5" strokeWidth={1.9} />
                <b className="font-bold text-ink">{navLabel}</b>
              </div>
            </>
          }
          right={
            <>
              <div ref={notifRef} className="relative">
                <button
                  type="button"
                  className={iconBtn}
                  aria-label={`Notifications${unread ? `, ${notifs.length} new` : ''}`}
                  aria-expanded={notifOpen}
                  aria-haspopup="true"
                  onClick={() => {
                    if (notifOpen) {
                      closeNotifs()
                      return
                    }
                    setNotifOpen(true)
                    setUnread(false)
                  }}
                >
                  <Bell className="size-5" strokeWidth={1.9} />
                  {unread && (
                    <span className="absolute top-[9px] right-2.5 size-2 rounded-full border-2 border-[#eef2f8] bg-[#d9480f]" />
                  )}
                </button>
                {notifOpen && (
                  <div
                    role="menu"
                    aria-label="Notifications"
                    className="absolute top-[calc(100%+8px)] right-0 z-40 w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_16px_40px_rgba(20,32,51,.18)]"
                  >
                    <div className="border-b border-line px-3.5 py-2.5 text-[13px] font-bold">
                      Notifications
                    </div>
                    {notifs.length === 0 ? (
                      <p className="px-3.5 py-4 text-sm text-muted">You’re all caught up</p>
                    ) : (
                      <ul className="max-h-[320px] overflow-y-auto py-1">
                        {notifs.map((n) => (
                          <li key={n.id}>
                            <Link
                              role="menuitem"
                              to={n.href}
                              className="block px-3.5 py-2.5 text-sm font-medium text-ink-2 no-underline hover:bg-primary-soft"
                              onClick={closeNotifs}
                            >
                              {n.text}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <div className="hidden items-center gap-2 lg:flex">
                <Link
                  to="/admin/profile"
                  className="flex min-w-0 items-center gap-2.5 rounded-xl px-2 py-1.5 no-underline hover:bg-white/75"
                >
                  <Avatar name={name} url={profile?.avatar_url} size={36} />
                  <div className="min-w-0">
                    <div className="max-w-[140px] truncate text-sm font-bold">{name}</div>
                    <div className="max-w-[140px] truncate text-[12px] text-muted">
                      {profile?.email}
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  className={iconBtn}
                  aria-label="Sign out"
                  onClick={() => setConfirmOut(true)}
                >
                  <LogOut className="size-5" strokeWidth={1.9} />
                </button>
              </div>
              <Link to="/admin/more" className={cn(iconBtn, 'lg:hidden')} aria-label="Account">
                <Avatar name={name} url={profile?.avatar_url} />
              </Link>
            </>
          }
        />
        <main
          className={cn(
            'lg:pb-8',
            sub ? 'pb-[calc(96px+var(--safe-b))]' : 'pb-[calc(var(--nav-h)+28px+var(--safe-b))]',
          )}
        >
          <div className="mx-auto max-w-[1240px] p-4 lg:px-7 lg:py-6">
            <Outlet />
          </div>
        </main>
      </div>

      {!sub && (
        <BottomNav
          items={ADMIN_BOTTOM.map((b) => ({
            to: adminHref(b.root),
            label: b.label,
            icon: b.icon,
            end: b.root === '',
            active: b.key === 'more' ? MORE_ROOTS.includes(root) : root === b.root,
          }))}
        />
      )}

      <ConfirmDialog
        open={confirmOut}
        title="Sign out?"
        description="You’ll need to sign in again to use LAIRON EZ."
        confirmLabel="Sign out"
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false)
          void signOut()
        }}
      />
    </div>
  )
}
