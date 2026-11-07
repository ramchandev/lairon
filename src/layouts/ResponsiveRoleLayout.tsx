import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ChevronRight, LogOut } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { Avatar } from '@/components/Avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { Brand, TopBar, iconBtn, useRouteChrome, type TabItem } from './chrome'
import { MobileLayout } from './MobileLayout'

interface Props {
  roleLabel: string
  profilePath: string
  tabs: TabItem[]
  /** Extra sidebar entries shown on a computer only. */
  desktopTabs?: TabItem[]
}

/**
 * Manager / Staff shell that follows the screen: the phone app (top bar + bottom tabs) below 1024px, and the normal
 * desktop shell (sidebar, breadcrumb, full-width pages — the same look as the admin portal) on a computer.
 */
export function ResponsiveRoleLayout(props: Props) {
  const { desktopTabs, ...phone } = props
  return useIsDesktop() ? (
    <DesktopRoleShell
      {...props}
      tabs={props.tabs.flatMap((t) =>
        t.to === props.profilePath ? [...(desktopTabs ?? []), t] : [t],
      )}
    />
  ) : (
    <MobileLayout {...phone} />
  )
}

function DesktopRoleShell({ roleLabel, profilePath, tabs }: Props) {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const { title } = useRouteChrome()
  const [confirmOut, setConfirmOut] = useState(false)
  const name = profile?.full_name ?? roleLabel
  const isOn = (t: TabItem) =>
    t.active ?? (t.end ? pathname === t.to : pathname === t.to || pathname.startsWith(`${t.to}/`))
  const current = tabs.find(isOn)?.label ?? title

  return (
    <div className="flex min-h-screen">
      <aside
        aria-label="Main navigation"
        className="sticky top-0 flex h-screen w-[268px] shrink-0 flex-col overflow-y-auto border-r border-line bg-white/[.42] px-3.5 py-[18px] backdrop-blur-[18px] backdrop-saturate-[140%]"
      >
        <Brand to={tabs[0].to} subtitle={roleLabel} className="px-2.5 pt-1 pb-[18px]" />
        <nav className="mt-2">
          {tabs.map((t) => {
            const on = isOn(t)
            return (
              <Link
                key={t.to}
                to={t.to}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-semibold text-ink-2 no-underline hover:bg-white/60',
                  on && 'bg-white text-primary shadow-[0_2px_10px_rgba(30,50,90,.07)]',
                )}
              >
                <t.icon className="size-5 shrink-0" strokeWidth={1.9} />
                <span>{t.label}</span>
                {t.badge ? (
                  <span className="ml-auto rounded-full bg-primary px-2 py-px text-xs font-bold text-white tabular">
                    {t.badge}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 rounded-[14px] bg-white/60 p-3">
          <Avatar name={name} url={profile?.avatar_url} />
          <Link to={profilePath} className="min-w-0 flex-1 no-underline">
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
            <div className="flex items-center gap-2 text-sm font-medium text-muted">
              <span>{roleLabel}</span>
              <ChevronRight className="size-5" strokeWidth={1.9} />
              <b className="font-bold text-ink">{current}</b>
            </div>
          }
        />
        <main className="pb-8">
          <div className="mx-auto max-w-[1240px] px-7 py-6">
            <Outlet />
          </div>
        </main>
      </div>

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
