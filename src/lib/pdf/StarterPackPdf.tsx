import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { format } from 'date-fns'
import type { Pack } from '@/features/starter-packs/api'
import { PACK_LABEL } from '@/features/starter-packs/status'

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
  right: { alignItems: 'flex-end' },
  ref: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  blocks: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  block: { flex: 1, padding: 10, backgroundColor: '#f4f6fa', borderRadius: 4 },
  title: {
    fontSize: 8,
    color: '#586579',
    textTransform: 'uppercase',
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold',
  },
  strong: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 2 },
  th: {
    flexDirection: 'row',
    backgroundColor: '#eaf0fb',
    borderBottom: '1 solid #c6d3ea',
    fontFamily: 'Helvetica-Bold',
  },
  tr: { flexDirection: 'row', borderBottom: '0.5 solid #dde3ee' },
  cell: { padding: 6 },
  note: { marginTop: 12, padding: 8, backgroundColor: '#f4f6fa' },
  sign: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 70 },
  line: {
    width: 170,
    borderTop: '1 solid #142033',
    paddingTop: 4,
    textAlign: 'center',
    fontSize: 9,
  },
})
const d = (v: string) => format(new Date(v), 'dd MMM yyyy')

function PackPage({ pack, company }: { pack: Pack; company: string }) {
  return (
    <Page size="A4" style={s.page}>
      <View style={s.head}>
        <View>
          <Text style={s.brand}>{company}</Text>
          <Text style={s.muted}>Starter Pack Request</Text>
        </View>
        <View style={s.right}>
          <Text style={s.ref}>{pack.ref_no}</Text>
          <Text style={s.muted}>Date: {d(pack.request_date)}</Text>
          <Text style={s.muted}>Status: {PACK_LABEL[pack.status]}</Text>
        </View>
      </View>
      <View style={s.blocks}>
        <View style={s.block}>
          <Text style={s.title}>Doctor</Text>
          <Text style={s.strong}>{pack.doctor_name}</Text>
          <Text>{pack.qualification}</Text>
          <Text style={s.muted}>{pack.doctor_area}</Text>
        </View>
        <View style={s.block}>
          <Text style={s.title}>Requested by</Text>
          <Text style={s.strong}>{pack.staff_name}</Text>
          <Text style={s.muted}>{pack.staff_area}</Text>
          <Text>Division: {pack.division}</Text>
        </View>
      </View>
      <View style={s.th}>
        <Text style={[s.cell, { width: 40 }]}>S.No</Text>
        <Text style={[s.cell, { flex: 1 }]}>Product</Text>
        <Text style={[s.cell, { width: 110 }]}>Qty</Text>
      </View>
      {pack.items.map((i, n) => (
        <View key={i.id} style={s.tr} wrap={false}>
          <Text style={[s.cell, { width: 40 }]}>{n + 1}</Text>
          <Text style={[s.cell, { flex: 1 }]}>{i.product_name}</Text>
          <Text style={[s.cell, { width: 110 }]}>{i.quantity}</Text>
        </View>
      ))}
      {pack.admin_note && (
        <View style={s.note}>
          <Text>Note: {pack.admin_note}</Text>
        </View>
      )}
      <View style={s.sign}>
        <Text style={s.line}>Requested by</Text>
        <Text style={s.line}>Issued by</Text>
        <Text style={s.line}>Received by</Text>
      </View>
    </Page>
  )
}

/** One page per request: a single PDF for one pack, or a bulk PDF for many. */
export function StarterPackPdf({ packs, company = 'LAIRON' }: { packs: Pack[]; company?: string }) {
  return (
    <Document title="Starter pack requests" author="LAIRON EZ">
      {packs.map((p) => (
        <PackPage key={p.id} pack={p} company={company} />
      ))}
    </Document>
  )
}
