import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { DayEntry, MonthStats } from '@/features/trip-duty/logic'
import { minutesText, monthLabel, time12 } from '@/lib/time'
import { pdfDate, rs } from './money'

const s = StyleSheet.create({
  page: { padding: 26, fontSize: 8, fontFamily: 'Helvetica', color: '#142033' },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottom: '2 solid #2b5cc6',
    paddingBottom: 8,
    marginBottom: 8,
  },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#2b5cc6' },
  muted: { color: '#586579' },
  stats: { flexDirection: 'row', gap: 18, marginBottom: 8 },
  label: { fontSize: 6.5, color: '#586579', textTransform: 'uppercase' },
  value: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  th: {
    flexDirection: 'row',
    backgroundColor: '#eaf0fb',
    borderBottom: '1 solid #c6d3ea',
    fontFamily: 'Helvetica-Bold',
  },
  tr: { flexDirection: 'row', borderBottom: '0.5 solid #dde3ee' },
  cell: { padding: 3 },
})

const COLS: [string, number, (e: DayEntry) => string][] = [
  ['Date', 1.1, (e) => pdfDate(e.entry_date)],
  [
    'Entry',
    1.1,
    (e) =>
      e.entry_type === 'duty'
        ? (e.duty_type ?? 'Duty')
        : e.entry_type === 'week_off'
          ? 'Week off'
          : `Leave (${e.leave_status})`,
  ],
  ['Vehicle', 1.3, (e) => e.vehicle_label ?? ''],
  [
    'Guest / route',
    2.4,
    (e) =>
      [e.guest_name, [e.pickup_point, e.drop_point].filter(Boolean).join(' > ')]
        .filter(Boolean)
        .join('\n'),
  ],
  [
    'Start',
    1.1,
    (e) =>
      e.entry_type === 'duty'
        ? `${time12(e.start_time)}${e.start_km !== null ? `\n${e.start_km} km` : ''}`
        : '',
  ],
  [
    'End',
    1.1,
    (e) =>
      e.entry_type === 'duty'
        ? `${time12(e.end_time)}${e.end_km !== null ? `\n${e.end_km} km` : ''}`
        : '',
  ],
  ['KM', 0.7, (e) => (e.total_km !== null ? String(e.total_km) : '')],
  ['Hours', 0.9, (e) => (e.total_minutes !== null ? minutesText(e.total_minutes) : '')],
  [
    'Fuel',
    1.2,
    (e) =>
      e.fuel_litres || e.fuel_amount
        ? `${e.fuel_litres ?? ''} L\n${e.fuel_amount ? rs(Number(e.fuel_amount)) : ''}`
        : '',
  ],
]

/** Driver monthly duty sheet (PLAN §10). */
export function DriverMonthPdf({
  driverName,
  month,
  entries,
  stats,
  beta,
  company = 'LAIRON',
}: {
  driverName: string
  month: string
  entries: DayEntry[]
  stats: MonthStats
  beta?: { total: number; local: number; outstation: number } | null
  company?: string
}) {
  const facts: [string, string][] = [
    ['Duty days', String(stats.dutyDays)],
    ['Week offs', String(stats.weekOffs)],
    ['Leave days', String(stats.leaveDays)],
    ['Total KM', String(stats.km)],
    ['Fuel (L)', stats.fuelLitres.toFixed(1)],
    ['Fuel amount', rs(stats.fuelAmount)],
    ...(beta
      ? ([['Beta', `${rs(beta.total)} (${beta.local}L + ${beta.outstation}O)`]] as [
          string,
          string,
        ][])
      : []),
  ]
  return (
    <Document title={`Duty sheet ${driverName} ${month}`} author="LAIRON EZ">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.brand}>{company}</Text>
            <Text style={s.muted}>Driver monthly duty sheet</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.value}>{driverName}</Text>
            <Text style={s.muted}>{monthLabel(month)}</Text>
          </View>
        </View>
        <View style={s.stats}>
          {facts.map(([k, v]) => (
            <View key={k}>
              <Text style={s.label}>{k}</Text>
              <Text style={s.value}>{v}</Text>
            </View>
          ))}
        </View>
        <View style={s.th} fixed>
          {COLS.map(([h, f]) => (
            <Text key={h} style={[s.cell, { flex: f }]}>
              {h}
            </Text>
          ))}
        </View>
        {entries.map((e) => (
          <View key={e.id} style={s.tr} wrap={false}>
            {COLS.map(([h, f, get]) => (
              <Text key={h} style={[s.cell, { flex: f }]}>
                {get(e)}
              </Text>
            ))}
          </View>
        ))}
        {entries.length === 0 && (
          <Text style={[s.muted, { marginTop: 12 }]}>No entries this month.</Text>
        )}
      </Page>
    </Document>
  )
}
