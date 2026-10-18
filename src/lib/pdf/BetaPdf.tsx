import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { BetaSummaryRow } from '@/features/trip-duty/admin-api'
import { monthLabel } from '@/lib/time'
import { rs } from './money'

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#142033' },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottom: '2 solid #2b5cc6',
    paddingBottom: 10,
    marginBottom: 14,
  },
  brand: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#2b5cc6' },
  muted: { color: '#586579' },
  th: {
    flexDirection: 'row',
    backgroundColor: '#eaf0fb',
    borderBottom: '1 solid #c6d3ea',
    fontFamily: 'Helvetica-Bold',
  },
  tr: { flexDirection: 'row', borderBottom: '0.5 solid #dde3ee' },
  total: {
    flexDirection: 'row',
    backgroundColor: '#f4f6fa',
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },
  cell: { padding: 6 },
  note: { marginTop: 16, color: '#586579', fontSize: 8.5 },
})
const W = [3, 1.2, 1.4, 1.6, 1.6]

/** Monthly Chauffeur Beta Summary — numbers come straight from the beta_summary() database function. */
export function BetaPdf({
  month,
  rows,
  rates,
  finalised,
  company = 'LAIRON',
}: {
  month: string
  rows: BetaSummaryRow[]
  rates: { local: number; outstation: number } | null
  finalised: boolean
  company?: string
}) {
  const sum = (k: 'local_days' | 'outstation_days' | 'payable_days' | 'total_amount') =>
    rows.reduce((n, r) => n + Number(r[k]), 0)
  const head = ['Driver', 'Local days', 'Outstation days', 'Payable duties', 'Total beta']
  return (
    <Document title={`Chauffeur beta ${month}`} author="LAIRON EZ">
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.brand}>{company}</Text>
            <Text style={s.muted}>Monthly Chauffeur Beta Summary</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 13 }}>{monthLabel(month)}</Text>
            <Text style={s.muted}>{finalised ? 'Finalised' : 'Draft (not finalised)'}</Text>
          </View>
        </View>
        <View style={s.th}>
          {head.map((h, i) => (
            <Text key={h} style={[s.cell, { flex: W[i], textAlign: i ? 'right' : 'left' }]}>
              {h}
            </Text>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r.driver_id} style={s.tr} wrap={false}>
            {[
              r.driver_name,
              String(r.local_days),
              String(r.outstation_days),
              String(r.payable_days),
              rs(r.total_amount),
            ].map((v, i) => (
              <Text key={i} style={[s.cell, { flex: W[i], textAlign: i ? 'right' : 'left' }]}>
                {v}
              </Text>
            ))}
          </View>
        ))}
        <View style={s.total}>
          {[
            'All drivers',
            String(sum('local_days')),
            String(sum('outstation_days')),
            String(sum('payable_days')),
            rs(sum('total_amount')),
          ].map((v, i) => (
            <Text key={i} style={[s.cell, { flex: W[i], textAlign: i ? 'right' : 'left' }]}>
              {v}
            </Text>
          ))}
        </View>
        <Text style={s.note}>
          One payable day per driver per date; if any duty that day is Outstation the whole day
          counts as Outstation. Only closed duties count.
          {rates
            ? ` Rates: Local ${rs(rates.local)}, Outstation ${rs(rates.outstation)} per payable day.`
            : ''}
        </Text>
      </Page>
    </Document>
  )
}
