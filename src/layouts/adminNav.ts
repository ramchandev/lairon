import {
  CarFront,
  ClipboardList,
  Grid2x2,
  LayoutDashboard,
  ListChecks,
  Layers,
  Package,
  Pill,
  Stethoscope,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * The approved admin navigation, copied from design/lairon-ez-prototype.html (`NAV`, `BOTTOM`, `MORE_ROOTS`).
 * `key` is the prototype's route name; `root` is this app's URL segment. A test compares this file against the HTML,
 * so the two cannot drift apart unnoticed.
 */
export interface AdminNavItem {
  key: string
  root: string
  label: string
  icon: LucideIcon
  count?: 'requests' | 'starter' | 'leave'
}

export const ADMIN_NAV: { group: string; items: AdminNavItem[] }[] = [
  {
    group: 'Overview',
    items: [{ key: 'dashboard', root: '', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    group: 'Operations',
    items: [
      {
        key: 'requests',
        root: 'service-requests',
        label: 'Service Requests',
        icon: ClipboardList,
        count: 'requests',
      },
      {
        key: 'starter',
        root: 'starter-packs',
        label: 'Starter Packs',
        icon: Package,
        count: 'starter',
      },
      { key: 'duties', root: 'trip-duty', label: 'Trip Duty', icon: CarFront, count: 'leave' },
    ],
  },
  {
    group: 'People',
    items: [
      { key: 'users', root: 'users', label: 'Users', icon: Users },
      { key: 'doctors', root: 'doctors', label: 'Doctors', icon: Stethoscope },
    ],
  },
  {
    group: 'Masters',
    items: [
      { key: 'vehicles', root: 'vehicles', label: 'Vehicles', icon: Truck },
      { key: 'divisions', root: 'divisions', label: 'Divisions', icon: Layers },
      { key: 'products', root: 'products', label: 'Products', icon: Pill },
      { key: 'dropdowns', root: 'dropdowns', label: 'Dropdowns', icon: ListChecks },
    ],
  },
]

export const ADMIN_BOTTOM: { key: string; root: string; label: string; icon: LucideIcon }[] = [
  { key: 'dashboard', root: '', label: 'Home', icon: LayoutDashboard },
  { key: 'requests', root: 'service-requests', label: 'Requests', icon: ClipboardList },
  { key: 'starter', root: 'starter-packs', label: 'Starter', icon: Package },
  { key: 'duties', root: 'trip-duty', label: 'Duties', icon: CarFront },
  { key: 'more', root: 'more', label: 'More', icon: Grid2x2 },
]

/** Pages the "More" tab leads to (the prototype's list) — plus the two extra admin pages this app adds under More. */
export const MORE_ROOTS = [
  'more',
  'users',
  'doctors',
  'vehicles',
  'divisions',
  'products',
  'dropdowns',
  'settings',
  'email-log',
  'profile',
]

export const adminHref = (root: string) => (root ? `/admin/${root}` : '/admin')
/** First path segment after /admin ('' for the dashboard). */
export const adminRoot = (pathname: string) =>
  pathname.replace(/^\/admin\/?/, '').split('/')[0] ?? ''
