import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/app/AuthProvider'
import { Avatar } from '@/components/Avatar'
import { cn } from '@/lib/utils'
import { BottomNav, Brand, TopBar, iconBtn, useRouteChrome, type TabItem } from './chrome'

export type { TabItem }

/**
 * Driver / Doctor's Manager / Staff shell — the prototype's "role app": no sidebar, brand + role label in the top bar,
 * avatar → profile on the right, a bottom tab bar that stays centred (560px) on desktop and disappears on sub-pages,
 * and a 680px content column.
 */
export function MobileLayout({
  roleLabel,
  profilePath,
  tabs,
}: {
  roleLabel: string
  profilePath: string
  tabs: TabItem[]
}) {
  const { profile } = useAuth()
  const { sub } = useRouteChrome()
  return (
    <div className="min-h-screen">
      <TopBar
        roleApp
        left={<Brand to={tabs[0].to} subtitle={roleLabel} />}
        right={
          <Link to={profilePath} className={iconBtn} aria-label="Profile">
            <Avatar name={profile?.full_name ?? ''} url={profile?.avatar_url} />
          </Link>
        }
      />
      <main
        className={cn(
          'lg:pb-8',
          sub
            ? 'pb-[calc(96px+var(--safe-b))]'
            : 'pb-[calc(var(--nav-h)+28px+var(--safe-b))] lg:pb-[calc(var(--nav-h)+40px)]',
        )}
      >
        <div className="mx-auto max-w-[680px] p-4 lg:px-7 lg:py-6">
          <Outlet />
        </div>
      </main>
      {!sub && <BottomNav roleApp items={tabs} />}
    </div>
  )
}
