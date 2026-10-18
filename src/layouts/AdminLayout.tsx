import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Bell, ChevronRight, LogOut } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { Avatar } from '@/components/Avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { useDashboard } from '@/features/dashboard/api'
import { cn } from '@/lib/utils'
import { ADMIN_BOTTOM, ADMIN_NAV, MORE_ROOTS, adminHref, adminRoot } from './adminNav'
import { BottomNav, Brand, TopBar, iconBtn, useRouteChrome } from './chrome'

/**
 * Admin shell — matches design/lairon-ez-prototype.html: grouped sidebar with pending counts and the signed-in user (≥1024px),
 * a top bar with breadcrumb + notifications, a 5-tab bottom bar with "More" (<1024px), and sub-pages that swap the bottom bar
 * for a back arrow + title.
 */
export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const toast = useToast()
  const { sub, title } = useRouteChrome()
  const kpi = useDashboard().data
  const [confirmOut, setConfirmOut] = useState(false)

  const root = adminRoot(pathname)
  const counts = {
    requests: kpi?.pending_service_requests ?? 0,
    starter: kpi?.pending_starter_packs ?? 0,
    leave: kpi?.pending_leave_requests ?? 0,
  }
  const name = profile?.full_name ?? 'Admin'
  const navLabel = ADMIN_NAV.flatMap((g) => g.items).find((i) => i.root === root)?.label ?? title

  function notify() {
    const parts = [
      [counts.requests, 'service requests'],
      [counts.starter, 'starter packs'],
      [counts.leave, 'leave requests'],
    ]
      .filter(([n]) => Number(n) > 0)
      .map(([n, l]) => `${n} ${l}`)
    toast(
      parts.length
        ? `${counts.requests + counts.starter + counts.leave} need attention: ${parts.join(', ')}`
        : 'You’re all caught up',
    )
  }

  return (
    <div className="flex min-h-screen">
      <aside
        aria-label="Main navigation"
        className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col overflow-y-auto border-r border-line bg-white/[.42] px-3.5 py-[18px] backdrop-blur-[18px] backdrop-saturate-[140%] lg:flex"
      >
        <Brand to="/admin" subtitle="Admin portal" className="px-2.5 pt-1 pb-[18px]" />
        {ADMIN_NAV.map((g) => (
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
        <div className="mt-auto flex items-center gap-2.5 rounded-[14px] bg-white/60 p-3">
          <Avatar name={name} url={profile?.avatar_url} />
          <Link to="/admin/profile" className="min-w-0 flex-1 no-underline">
            <div className="truncate text-sm font-bold">{name}</div>
            <div className="truncate text-[13px] text-muted">{profile?.email}</div>
          </Link>
          <button className={iconBtn} aria-label="Sign out" onClick={() => setConfirmOut(true)}>
            <LogOut className="size-5" strokeWidth={1.9} />
          </button>
        </div>
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
              <button
                className={iconBtn}
                aria-label={`Notifications${counts.requests + counts.starter + counts.leave ? `, ${counts.requests + counts.starter + counts.leave} new` : ''}`}
                onClick={notify}
              >
                <Bell className="size-5" strokeWidth={1.9} />
                {counts.requests + counts.starter + counts.leave > 0 && (
                  <span className="absolute top-[9px] right-2.5 size-2 rounded-full border-2 border-[#eef2f8] bg-[#d9480f]" />
                )}
              </button>
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
