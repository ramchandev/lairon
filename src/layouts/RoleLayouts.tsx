import { useDraftBatch } from '@/features/service-requests/api'
import { MobileLayout } from './MobileLayout'
import { ResponsiveRoleLayout } from './ResponsiveRoleLayout'
import { DRIVER_TABS, MANAGER_TABS, STAFF_TABS } from './roleNav'

export const DriverLayout = () => (
  <MobileLayout roleLabel="Driver" profilePath="/driver/profile" tabs={DRIVER_TABS} />
)
/** Staff: the phone app on a phone, the desktop shell on a computer. */
export const StaffLayout = () => (
  <ResponsiveRoleLayout roleLabel="Staff" profilePath="/staff/profile" tabs={STAFF_TABS} />
)

/** Manager: phone app on a phone, desktop shell on a computer; the "New Request" tab shows how many services are in the draft. */
export function ManagerLayout() {
  const draft = useDraftBatch()
  const n = draft.data?.services.length
  return (
    <ResponsiveRoleLayout
      roleLabel="Manager"
      profilePath="/m/profile"
      tabs={MANAGER_TABS.map((t) => (t.to === '/m/request' ? { ...t, badge: n } : t))}
    />
  )
}
