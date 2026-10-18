import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { batchTotal, type Batch } from '@/features/service-requests/api'
import { isNetrate, isOffer } from '@/features/service-requests/schemas'
import { STATUS_LABEL } from '@/features/service-requests/status'

// The built-in PDF fonts have no ₹ glyph, so amounts print as "Rs." with Indian digit grouping.
const rs = (n: number) =>
  `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`
const d = (v: string) => format(new Date(v), 'dd MMM yyyy')

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 8.5, fontFamily: 'Helvetica', color: '#142033' },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottom: '2 solid #2b5cc6',
    paddingBottom: 8,
    marginBottom: 10,
  },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#2b5cc6' },
  muted: { color: '#586579' },
  meta: { flexDirection: 'row', gap: 24, marginBottom: 10 },
  label: { fontSize: 7, color: '#586579', textTransform: 'uppercase', marginBottom: 1 },
  value: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  th: {
    flexDirection: 'row',
    backgroundColor: '#eaf0fb',
    borderBottom: '1 solid #c6d3ea',
    fontFamily: 'Helvetica-Bold',
  },
  tr: { flexDirection: 'row', borderBottom: '0.5 solid #dde3ee' },
  cell: { padding: 4 },
  total: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  note: { marginTop: 10, padding: 6, backgroundColor: '#f4f6fa' },
  sign: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 },
  line: {
    width: 160,
    borderTop: '1 solid #142033',
    paddingTop: 3,
    textAlign: 'center',
    fontSize: 8,
  },
})

// [header, flex, getter]
const COLS: [string, number, (x: Batch['services'][number]) => string][] = [
  ['#', 0.4, () => ''],
  ['Date', 1.1, (x) => d(x.request_date)],
  ['Doctor / Hospital', 2.4, (x) => `${x.doctor_name}\n${x.hospital_name}, ${x.area}`],
  ['Division / HQ', 1, (x) => `${x.division} / ${x.hq}`],
  ['Qualification / Speciality', 2, (x) => `${x.qualification}\n${x.speciality}`],
  ['Service type', 1.3, (x) => x.service_type],
  ['Amount', 1.3, (x) => rs(Number(x.service_amount))],
  [
    'Expected / Current',
    1.9,
    (x) => `${rs(Number(x.expected_business_value))}\n${rs(Number(x.current_business_value))}`,
  ],
  [
    'Terms',
    1.1,
    (x) =>
      isOffer(x.offer_type)
        ? `Offer ${x.offer_percent}%`
        : isNetrate(x.offer_type)
          ? `Netrate ${rs(Number(x.netrate_amount))}`
          : x.offer_type,
  ],
]

export function ServiceRequestPdf({
  batch,
  company = 'LAIRON',
}: {
  batch: Batch
  company?: string
}) {
  return (
    <Document title={`Service request ${batch.ref_no ?? ''}`} author="LAIRON EZ">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.brand}>{company}</Text>
            <Text style={s.muted}>Service Request</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.value}>{batch.ref_no ?? 'Draft'}</Text>
            <Text style={s.muted}>{STATUS_LABEL[batch.status]}</Text>
          </View>
        </View>
        <View style={s.meta}>
          {[
            ['Manager', batch.manager_name ?? '—'],
            ['Accountability', batch.accountability_staff_name ?? '—'],
            ['Submitted', batch.submitted_at ? d(batch.submitted_at) : '—'],
            ['Services', String(batch.services.length)],
          ].map(([k, v]) => (
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
        {batch.services.map((x, i) => (
          <View key={x.id} style={s.tr} wrap={false}>
            {COLS.map(([h, f, get], c) => (
              <Text key={h} style={[s.cell, { flex: f }]}>
                {c === 0 ? String(i + 1) : get(x)}
              </Text>
            ))}
          </View>
        ))}
        <View style={s.total}>
          <Text>Total service amount: {rs(batchTotal(batch))}</Text>
        </View>
        {batch.admin_note && (
          <View style={s.note}>
            <Text>Admin note: {batch.admin_note}</Text>
          </View>
        )}
        <View style={s.sign}>
          <Text style={s.line}>Manager</Text>
          <Text style={s.line}>Accountability staff</Text>
          <Text style={s.line}>Approved by</Text>
        </View>
      </Page>
    </Document>
  )
}
