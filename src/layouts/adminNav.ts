import {
  BriefcaseMedical,
  CarFront,
  IdCard,
  ShieldCheck,
  ClipboardList,
  Grid2x2,
  LayoutDashboard,
  ListChecks,
  Layers,
  IndianRupee,
  MapPin,
  ChartColumn,
  Footprints,
  Percent,
  Store,
  Award,
  Target,
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
 *
 * One deliberate change from the HTML (requested by the owner): the single "Users" link under People is replaced by separate
 * links — Drivers, Staffs, Managers, Doctors and Super Admins — each opening its own list. A second change (owner's request):
 * a "Locations" master (Masters) and a "Reports" section holding the "Revenue Report" (revenue by doctor) and "Sales Performance" (manager sales) "Field Activity" (manager calls, coverage, tour plan), "ROI Report" and "Doctor Plans" (conversion, core coverage) "Stockists" and "Appraisal" (admin-only manager scoring) links. Everything else is as approved.
 */
export interface AdminNavItem {
  key: string
  root: string
  label: string
  icon: LucideIcon
  count?: 'requests' | 'starter' | 'leave'
  /** Still being tested: shown only to PREVIEW_EMAIL until released. */
  preview?: boolean
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
    group: 'Reports',
    items: [
      { key: 'reports', root: 'reports', label: 'Revenue Report', icon: IndianRupee },
      {
        key: 'performance',
        root: 'performance',
        label: 'Sales Performance',
        icon: ChartColumn,
        preview: true,
      },
      {
        key: 'field-activity',
        root: 'field-activity',
        label: 'Field Activity',
        icon: Footprints,
        preview: true,
      },
      { key: 'roi', root: 'roi', label: 'ROI Report', icon: Percent, preview: true },
      {
        key: 'doctor-plans',
        root: 'doctor-plans',
        label: 'Doctor Plans',
        icon: Target,
        preview: true,
      },
      { key: 'stockists', root: 'stockists', label: 'Stockists', icon: Store, preview: true },
      { key: 'appraisal', root: 'appraisal', label: 'Appraisal', icon: Award, preview: true },
    ],
  },
  {
    group: 'People',
    items: [
      { key: 'drivers', root: 'drivers', label: 'Drivers', icon: IdCard },
      { key: 'staff', root: 'staff', label: 'Staffs', icon: Users },
      { key: 'managers', root: 'managers', label: 'Managers', icon: BriefcaseMedical },
      { key: 'doctors', root: 'doctors', label: 'Doctors', icon: Stethoscope },
      { key: 'super-admins', root: 'super-admins', label: 'Super Admins', icon: ShieldCheck },
    ],
  },
  {
    group: 'Masters',
    items: [
      { key: 'vehicles', root: 'vehicles', label: 'Vehicles', icon: Truck },
      { key: 'divisions', root: 'divisions', label: 'Divisions', icon: Layers },
      { key: 'locations', root: 'locations', label: 'Locations', icon: MapPin },
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
  'drivers',
  'staff',
  'managers',
  'super-admins',
  'doctors',
  'vehicles',
  'divisions',
  'locations',
  'products',
  'dropdowns',
  'reports',
  'performance',
  'field-activity',
  'roi',
  'doctor-plans',
  'stockists',
  'appraisal',
  'settings',
  'email-log',
  'profile',
]

export const adminHref = (root: string) => (root ? `/admin/${root}` : '/admin')
/** First path segment after /admin ('' for the dashboard). User forms (/users/new?role=…) belong to that role's link. */
export const adminRoot = (pathname: string, search = '') => {
  const seg = pathname.replace(/^\/admin\/?/, '').split('/')[0] ?? ''
  if (seg !== 'users') return seg
  const role = new URLSearchParams(search).get('role')
  return (
    ({ driver: 'drivers', manager: 'managers', admin: 'super-admins' } as Record<string, string>)[
      role ?? ''
    ] ?? 'staff'
  )
}

/** The one account that sees the performance modules while they are tested. Remove the `preview` flags to release them to every admin. */
export const PREVIEW_EMAIL = 'ramchandev@gmail.com'
export const canPreview = (email?: string | null) => email?.toLowerCase() === PREVIEW_EMAIL
export const previewRoots = ADMIN_NAV.flatMap((g) => g.items)
  .filter((i) => i.preview)
  .map((i) => i.root)

/** The admin sidebar for this user (groups left empty are dropped). */
export const navFor = (email?: string | null) =>
  ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.preview || canPreview(email)),
  })).filter((g) => g.items.length)
