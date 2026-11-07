import {
  ChartColumn,
  TrendingUp,
  NotebookPen,
  Footprints,
  Percent,
  Store,
  Target,
  CalendarDays,
  ClipboardList,
  ClipboardPlus,
  House,
  PackagePlus,
  Stethoscope,
  UserRound,
} from 'lucide-react'

/** Bottom-bar tabs per role app. Driver and manager are copied from design/lairon-ez-prototype.html (a test compares them). */
export const DRIVER_TABS = [
  { to: '/driver', label: 'Today', icon: House, end: true },
  { to: '/driver/month', label: 'My Duties', icon: CalendarDays },
  { to: '/driver/profile', label: 'Profile', icon: UserRound },
]

export const MANAGER_TABS = [
  { to: '/m', label: 'Doctors', icon: Stethoscope, end: true }, // HTML says "My Doctors"; managers now see every doctor
  { to: '/m/request', label: 'New Request', icon: ClipboardPlus },
  { to: '/m/requests', label: 'My Requests', icon: ClipboardList },
  { to: '/m/profile', label: 'Profile', icon: UserRound },
]

/** Added to the manager's sidebar on a computer only (the phone bar keeps the approved four tabs). */
export const MANAGER_PERFORMANCE_TABS = [
  { to: '/m/performance/sales', label: 'Sales Entry', icon: TrendingUp },
  { to: '/m/performance/report', label: 'Sales Report', icon: ChartColumn },
  { to: '/m/performance/daily', label: 'Daily Log', icon: NotebookPen },
  { to: '/m/performance/activity', label: 'Field Activity', icon: Footprints },
  { to: '/m/performance/roi', label: 'ROI', icon: Percent },
  { to: '/m/performance/plans', label: 'Doctor Plans', icon: Target },
  { to: '/m/performance/stockists', label: 'Stockists', icon: Store },
]

/** Staff has no screens in the approved HTML yet (plan §8); it follows the same role-app pattern. */
export const STAFF_TABS = [
  { to: '/staff', label: 'Home', icon: House, end: true },
  { to: '/staff/new', label: 'New Pack', icon: PackagePlus },
  { to: '/staff/requests', label: 'Requests', icon: ClipboardList },
  { to: '/staff/profile', label: 'Profile', icon: UserRound },
]
