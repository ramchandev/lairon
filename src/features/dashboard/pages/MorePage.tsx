import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { Avatar } from '@/components/Avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ghostSm } from '@/components/form-styles'
import { ADMIN_NAV, adminHref } from '@/layouts/adminNav'
import { supabase } from '@/lib/supabase'

const count = async (table: string) => {
  const { count: n } = await supabase.from(table).select('id', { count: 'exact', head: true })
  return n ?? 0
}

export const useMoreCounts = () =>
  useQuery({
    queryKey: ['more-counts'],
    queryFn: async () => {
      const [roles, doctors, vehicles, divisions, products] = await Promise.all([
        supabase
          .from('profiles')
          .select('role')
          .then((r) => {
            const n: Record<string, number> = {}
            for (const p of r.data ?? []) n[p.role] = (n[p.role] ?? 0) + 1
            return n
          }),
        count('doctors'),
        count('vehicles'),
        count('divisions'),
        count('products'),
      ])
      return { roles, doctors, vehicles, divisions, products }
    },
  })

// Tile colours from the prototype (t-teal / t-info / t-warn / t-violet / t-ok / t-danger).
const TONE = {
  teal: 'bg-teal-bg text-teal',
  info: 'bg-info-bg text-info',
  warn: 'bg-warn-bg text-warn',
  violet: 'bg-[#e6e0f7] text-[#5b3fb0]',
  ok: 'bg-ok-bg text-ok',
  danger: 'bg-danger-bg text-danger',
  muted: 'bg-muted-bg text-ink-2',
} as const

/** Mobile "More" tab: account card + a tile for every page that isn't in the bottom bar. */
export function MorePage() {
  const { profile, signOut } = useAuth()
  const c = useMoreCounts().data
  const [confirm, setConfirm] = useState(false)
  const items = ADMIN_NAV.flatMap((g) => g.items)
  const icon = (key: string) => items.find((i) => i.key === key)!.icon
  const tiles: {
    key: string
    root: string
    label: string
    sub: string
    tone: keyof typeof TONE
  }[] = [
    {
      key: 'drivers',
      root: 'drivers',
      label: 'Drivers',
      sub: `${c?.roles.driver ?? '…'} drivers`,
      tone: 'info',
    },
    {
      key: 'staff',
      root: 'staff',
      label: 'Staffs',
      sub: `${c?.roles.staff ?? '…'} staffs`,
      tone: 'teal',
    },
    {
      key: 'managers',
      root: 'managers',
      label: 'Managers',
      sub: `${c?.roles.manager ?? '…'} doctor’s managers`,
      tone: 'violet',
    },
    {
      key: 'doctors',
      root: 'doctors',
      label: 'Doctors',
      sub: `${c?.doctors ?? '…'} doctors`,
      tone: 'info',
    },
    {
      key: 'vehicles',
      root: 'vehicles',
      label: 'Vehicles',
      sub: `${c?.vehicles ?? '…'} in fleet`,
      tone: 'warn',
    },
    {
      key: 'divisions',
      root: 'divisions',
      label: 'Divisions',
      sub: `${c?.divisions ?? '…'} divisions`,
      tone: 'violet',
    },
    {
      key: 'products',
      root: 'products',
      label: 'Products',
      sub: `${c?.products ?? '…'} products`,
      tone: 'ok',
    },
    {
      key: 'super-admins',
      root: 'super-admins',
      label: 'Super Admins',
      sub: `${c?.roles.admin ?? '…'} super admins`,
      tone: 'danger',
    },
    {
      key: 'dropdowns',
      root: 'dropdowns',
      label: 'Dropdowns',
      sub: 'Form options & mapping',
      tone: 'danger',
    },
  ]
  return (
    <div>
      <section className="glass mb-4 flex items-center gap-3.5 p-4">
        <Avatar name={profile?.full_name ?? 'Admin'} url={profile?.avatar_url} />
        <Link to="/admin/profile" className="min-w-0 flex-1 no-underline">
          <div className="truncate font-bold">{profile?.full_name}</div>
          <div className="truncate text-[13px] text-muted">{profile?.email}</div>
        </Link>
        <button className={ghostSm} onClick={() => setConfirm(true)}>
          <LogOut className="size-5" strokeWidth={1.9} /> Sign out
        </button>
      </section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map((t) => {
          const Icon = icon(t.key)
          return (
            <Link
              key={t.key}
              to={adminHref(t.root)}
              className="glass flex flex-col gap-3 border border-[rgba(255,255,255,.78)] p-4 no-underline"
            >
              <span className={`grid size-[42px] place-items-center rounded-xl ${TONE[t.tone]}`}>
                <Icon className="size-5" strokeWidth={1.9} />
              </span>
              <div>
                <b className="text-[15px]">{t.label}</b>
                <br />
                <span className="text-[13px] text-muted">{t.sub}</span>
              </div>
            </Link>
          )
        })}
        {/* Not in the approved HTML: the two admin pages added after it was designed. Reachable here and from the sidebar user block. */}
        <Link
          to="/admin/settings"
          className="glass flex flex-col gap-3 border border-[rgba(255,255,255,.78)] p-4 no-underline"
        >
          <span className={`grid size-[42px] place-items-center rounded-xl ${TONE.muted}`}>
            <Settings className="size-5" strokeWidth={1.9} />
          </span>
          <div>
            <b className="text-[15px]">Settings</b>
            <br />
            <span className="text-[13px] text-muted">Company, admins & email</span>
          </div>
        </Link>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Sign out?"
        description="You’ll need to sign in again to use LAIRON EZ."
        confirmLabel="Sign out"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false)
          void signOut()
        }}
      />
    </div>
  )
}
