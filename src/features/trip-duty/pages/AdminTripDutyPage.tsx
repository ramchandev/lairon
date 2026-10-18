import { Link, useSearchParams } from 'react-router-dom'
import { Calendar, CalendarX, IndianRupee, Upload, Users } from 'lucide-react'
import { PageHeader } from '@/components/FormPage'
import { Tabs } from '@/components/ListControls'
import { istParts, monthOf } from '@/lib/time'
import { AllDriversTab } from '../admin/AllDriversTab'
import { BetaTab } from '../admin/BetaTab'
import { DriverMonthTab } from '../admin/DriverMonthTab'
import { LeaveQueueTab } from '../admin/LeaveQueueTab'
import { usePendingLeaves } from '../admin-api'
import { groupLeaves } from '../logic'

type Tab = 'month' | 'all' | 'beta' | 'leave'

/** Trip Duty hub. State lives in the URL (?tab, ?m, ?driver) so a view can be shared or reloaded. */
export function AdminTripDutyPage() {
  const [params, setParams] = useSearchParams()
  const tab = (
    ['month', 'all', 'beta', 'leave'].includes(params.get('tab') ?? '')
      ? params.get('tab')
      : 'month'
  ) as Tab
  const month = /^\d{4}-\d{2}$/.test(params.get('m') ?? '')
    ? params.get('m')!
    : monthOf(istParts().date)
  const driver = params.get('driver') ?? ''
  const pending = groupLeaves(usePendingLeaves().data ?? []).length

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Trip Duty"
        subtitle="Driver duties, week offs, leave and chauffeur beta"
        action={
          <Link to="/admin/trip-duty/import" className="btn btn-ghost">
            <Upload aria-hidden /> <span className="hidden sm:inline">Import duties</span>
          </Link>
        }
      />
      <div>
        <Tabs
          value={tab}
          onChange={(t) => set({ tab: t })}
          tabs={[
            { key: 'month', label: 'Driver month', icon: Calendar },
            { key: 'all', label: 'All drivers', icon: Users },
            { key: 'beta', label: 'Chauffeur beta', icon: IndianRupee },
            { key: 'leave', label: 'Leave requests', icon: CalendarX, count: pending || undefined },
          ]}
        />
      </div>
      {tab === 'month' && (
        <DriverMonthTab
          month={month}
          driverId={driver}
          onMonth={(m) => set({ m })}
          onDriver={(d) => set({ driver: d })}
        />
      )}
      {tab === 'all' && (
        <AllDriversTab
          month={month}
          onMonth={(m) => set({ m })}
          onOpen={(d) => set({ tab: 'month', driver: d })}
        />
      )}
      {tab === 'beta' && (
        <BetaTab
          month={month}
          driverId={driver}
          onMonth={(m) => set({ m })}
          onDriver={(d) => set({ driver: d || null })}
        />
      )}
      {tab === 'leave' && <LeaveQueueTab />}
    </>
  )
}
