import { PageHeader } from '@/components/FormPage'
import { ReportsTab } from './ReportsTab'

/** Admin: the monthly reports built from the uploaded stockist statements. Uploading is on its own screen (Sale Upload). */
export function SaleReportPage() {
  return (
    <>
      <PageHeader title="Sale Report" subtitle="What sold, who stocks it and what to order" />
      <ReportsTab />
    </>
  )
}
