import { useDraftBatch } from '@/features/service-requests/api'
import { MobileLayout } from './MobileLayout'
import { DRIVER_TABS, MANAGER_TABS, STAFF_TABS } from './roleNav'

export const DriverLayout = () => (
  <MobileLayout roleLabel="Driver" profilePath="/driver/profile" tabs={DRIVER_TABS} />
)
export const StaffLayout = () => (
  <MobileLayout roleLabel="Staff" profilePath="/staff/profile" tabs={STAFF_TABS} />
)

/** Doctor's Manager: the "New Request" tab shows how many services are in the draft. */
export function ManagerLayout() {
  const draft = useDraftBatch()
  const n = draft.data?.services.length
  return (
    <MobileLayout
      roleLabel="Doctor's Manager"
      profilePath="/m/profile"
      tabs={MANAGER_TABS.map((t) => (t.to === '/m/request' ? { ...t, badge: n } : t))}
    />
  )
}
