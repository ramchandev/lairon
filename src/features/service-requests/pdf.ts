import { saveBlob } from '@/lib/pdf/download'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { fetchCompanyName } from '@/features/settings/api'
import type { Batch } from './api'

/** react-pdf is large, so it is only loaded when someone actually downloads a PDF. */
export async function downloadBatchPdf(batch: Batch) {
  const [{ pdf }, { ServiceRequestPdf }, { createElement }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/lib/pdf/ServiceRequestPdf'),
    import('react'),
  ])
  // ServiceRequestPdf renders a <Document> at its root, which is what pdf() expects.
  const doc = createElement(ServiceRequestPdf, {
    batch,
    company: await fetchCompanyName(),
  }) as unknown as ReactElement<DocumentProps>
  const blob = await pdf(doc).toBlob()
  saveBlob(blob, `${batch.ref_no ?? 'service-request'}.pdf`)
}
