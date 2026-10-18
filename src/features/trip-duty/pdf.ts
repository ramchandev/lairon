import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { fetchCompanyName } from '@/features/settings/api'
import { saveBlob } from '@/lib/pdf/download'
import type { BetaSummaryRow } from './admin-api'
import type { DayEntry, MonthStats } from './logic'

async function render(
  build: (mods: {
    createElement: typeof import('react').createElement
  }) => Promise<ReactElement<DocumentProps>>,
  filename: string,
) {
  const [{ pdf }, { createElement }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('react'),
  ])
  saveBlob(await pdf(await build({ createElement })).toBlob(), filename)
}

export const downloadDriverMonthPdf = (a: {
  driverName: string
  month: string
  entries: DayEntry[]
  stats: MonthStats
  beta?: { total: number; local: number; outstation: number } | null
}) =>
  render(
    async ({ createElement }) => {
      const { DriverMonthPdf } = await import('@/lib/pdf/DriverMonthPdf')
      return createElement(DriverMonthPdf, {
        ...a,
        company: await fetchCompanyName(),
      }) as unknown as ReactElement<DocumentProps>
    },
    `duty-sheet-${a.driverName.replace(/\W+/g, '-')}-${a.month}.pdf`,
  )

export const downloadBetaPdf = (a: {
  month: string
  rows: BetaSummaryRow[]
  rates: { local: number; outstation: number } | null
  finalised: boolean
}) =>
  render(async ({ createElement }) => {
    const { BetaPdf } = await import('@/lib/pdf/BetaPdf')
    return createElement(BetaPdf, {
      ...a,
      company: await fetchCompanyName(),
    }) as unknown as ReactElement<DocumentProps>
  }, `chauffeur-beta-${a.month}.pdf`)
