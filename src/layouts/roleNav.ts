import {
  CalendarDays,
  ClipboardList,
  ClipboardPlus,
  Contact,
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
  { to: '/m', label: 'My Doctors', icon: Stethoscope, end: true },
  { to: '/m/request', label: 'New Request', icon: ClipboardPlus },
  { to: '/m/requests', label: 'My Requests', icon: ClipboardList },
  { to: '/m/profile', label: 'Profile', icon: UserRound },
]

/** Staff has no screens in the approved HTML yet (plan §8); it follows the same role-app pattern. */
export const STAFF_TABS = [
  { to: '/staff', label: 'Home', icon: House, end: true },
  { to: '/staff/new', label: 'New Pack', icon: PackagePlus },
  { to: '/staff/requests', label: 'Requests', icon: ClipboardList },
  { to: '/staff/directory', label: 'Directory', icon: Contact },
  { to: '/staff/profile', label: 'Profile', icon: UserRound },
]
