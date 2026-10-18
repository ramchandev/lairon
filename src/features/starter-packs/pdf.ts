import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { saveBlob } from '@/lib/pdf/download'
import { fetchCompanyName } from '@/features/settings/api'
import type { Pack } from './api'

/** react-pdf is only loaded when a PDF is actually requested. */
export async function downloadPacksPdf(packs: Pack[], filename: string) {
  const [{ pdf }, { StarterPackPdf }, { createElement }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/lib/pdf/StarterPackPdf'),
    import('react'),
  ])
  const doc = createElement(StarterPackPdf, {
    packs,
    company: await fetchCompanyName(),
  }) as unknown as ReactElement<DocumentProps>
  saveBlob(await pdf(doc).toBlob(), `${filename}.pdf`)
}
