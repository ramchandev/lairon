import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DEFAULT_FIELDS } from '../fields'
import { UploadTab } from './UploadTab'

const commit = vi.fn().mockResolvedValue(undefined)
vi.mock('@/app/AuthProvider', () => ({ useAuth: () => ({ profile: { id: 'admin1' } }) }))
vi.mock('@/components/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('@/features/divisions/api', () => ({
  useDivisions: () => ({ data: [{ id: 'd-cc', name: 'Critical Care', is_active: true }] }),
}))
vi.mock('@/features/locations/api', () => ({
  useLocations: () => ({ data: [{ id: 'l1', name: 'Madurai' }] }),
}))
vi.mock('@/features/products/api', () => ({
  useProducts: () => ({
    data: [
      { id: 'p1', name: 'Elvion XT', is_active: true },
      { id: 'p2', name: 'Lairocef 1.5G', is_active: true },
    ],
  }),
}))
vi.mock('@/features/performance/stockists', () => ({
  useStockists: () => ({
    data: [{ id: 's1', name: 'Akash Agencies', location_id: 'l1', is_active: true }],
  }),
  useAddStockist: () => ({ mutateAsync: vi.fn() }),
}))
const saveAliases = vi.hoisted(() => vi.fn())
const sheet = vi.hoisted(() => ({ extra: [] as unknown[][] }))
vi.mock('../parse/sheet', () => ({
  fileHash: async () => 'hash1',
  readRows: async () => [
    ['AKASH AGENCIES'],
    ['Stock and Sales - LAIRON LIFE SCIENCES-CRITICAL - 01-05-2026 to 30-05-2026.'],
    [
      'Sl.No',
      'Product',
      'Packing',
      'Rate',
      'LM-Sales',
      'Open',
      'Pur',
      'P.Free',
      'CM-Sales',
      'S.Free',
      'Dif.',
      'Clo.',
      'OrderQty.',
      'OrderValue.',
    ],
    [1, 'ELVION XT', '10S', 64.25, 44, 92, 0, 0, 44, 8, 0, 40, 0, 0],
    [2, 'LAIROCEF 1.5G INJ', 'VIAL', 203.57, 269, 281, 200, 80, 362, 116, 17, 100, 0, 0],
    ...sheet.extra,
  ],
}))
vi.mock('../parse/pdf', () => ({
  readPdfItems: async () => [{ s: 'x' }],
  itemsToRows: () => [
    ['Kasi Agencies'],
    ['Stock & Sales Statement 01-05-2026 to 31-05-2026'],
    ['Product Name', 'Op. Stock', 'Pur. Qty', 'Sales Qty', 'Cl.Stock'],
    ['ELVION XT', 92, 0, 52, 40],
  ],
}))
vi.mock('../api', () => ({
  useImportFields: () => ({ data: DEFAULT_FIELDS }),
  useAliases: () => ({ data: [] }),
  useUploads: () => ({ data: [] }),
  useTemplates: () => ({ data: undefined }),
  useCommitUpload: () => ({ mutateAsync: commit, isPending: false }),
  useSaveAliases: () => ({ mutateAsync: saveAliases }),
  useSaveTemplate: () => ({ mutateAsync: vi.fn() }),
  useSaveImportField: () => ({ mutateAsync: vi.fn() }),
}))

const wrap = (forMonth?: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <UploadTab forMonth={forMonth} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
const file = (name: string) => new File(['x'], name)

describe('UploadTab', () => {
  it('reads a statement, guesses stockist/division/month and saves it', async () => {
    wrap()
    await userEvent.upload(screen.getByLabelText('Choose files'), file('AKASH CC SALES.xlsx'))
    await screen.findByText(/File says: AKASH AGENCIES/)
    expect(screen.getByRole('button', { name: 'Stockist' })).toHaveTextContent('Akash Agencies')
    expect(screen.getByRole('button', { name: 'Division' })).toHaveTextContent('Critical')
    expect(screen.getByLabelText('Month')).toHaveValue('2026-05')
    // Elvion XT matches itself; "Lairocef 1.5G inj" matches too
    expect(screen.getByText(/2 of 2 matched automatically/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save statement' }))
    await waitFor(() => expect(commit).toHaveBeenCalled())
    const call = commit.mock.calls[0][0]
    expect(call).toMatchObject({
      stockistId: 's1',
      divisionId: 'd-cc',
      month: '2026-05',
      replace: false,
    })
    expect(call.lines).toHaveLength(2)
    expect(call.lines[1]).toMatchObject({
      product_id: 'p2',
      sales: 362,
      free: 116,
      closing: 100,
      extra: { purchase_free: 80, adjustment: 17 },
    })
  })

  it('lets the admin change what a column means (searchable picker)', async () => {
    wrap()
    await userEvent.upload(screen.getByLabelText('Choose files'), file('AKASH CC SALES.xlsx'))
    const btn = await screen.findByRole('button', { name: 'Meaning of LM-Sales' })
    expect(btn).toHaveTextContent('Last-month sales')
    await userEvent.click(btn)
    await userEvent.type(screen.getByLabelText('Search options'), 'closing')
    await userEvent.click(screen.getByRole('button', { name: 'Closing' }))
    expect(screen.getByRole('button', { name: 'Meaning of LM-Sales' })).toHaveTextContent('Closing')
  })

  it('reads a PDF through the same mapping screen', async () => {
    wrap()
    await userEvent.upload(screen.getByLabelText('Choose files'), file('KASI CD SALES.pdf'))
    expect(await screen.findByRole('button', { name: 'Meaning of Sales Qty' })).toHaveTextContent(
      'Sales',
    )
    expect(screen.getByRole('button', { name: 'Meaning of Cl.Stock' })).toHaveTextContent('Closing')
  })

  it('asks before saving a sheet into a different month than the one opened', async () => {
    wrap('2026-04')
    await userEvent.upload(screen.getByLabelText('Choose files'), file('AKASH CC SALES.xlsx'))
    expect(await screen.findByText('This is not the right month.')).toBeInTheDocument()
    expect(screen.getByText(/this sheet is for May 2026/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Upload for May 2026' }))
    expect(await screen.findByLabelText('Month')).toHaveValue('2026-05')
  })

  it('asks "Is it …?" for a suggested product; Yes assigns it', async () => {
    sheet.extra = [[3, 'ELVN XT', '10S', 64.25, 10, 40, 0, 0, 10, 0, 0, 30, 0, 0]]
    try {
      wrap()
      await userEvent.upload(screen.getByLabelText('Choose files'), file('AKASH CC SALES.xlsx'))
      expect(await screen.findByText('Elvion XT', { selector: 'b' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /^Yes, ELVN XT/ }))
      expect(screen.getByText('Assigned')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Product for ELVN XT' })).toHaveTextContent(
        'Elvion XT',
      )
    } finally {
      sheet.extra = []
    }
  })

  it('No opens the full searchable list', async () => {
    sheet.extra = [[3, 'ELVN XT', '10S', 64.25, 10, 40, 0, 0, 10, 0, 0, 30, 0, 0]]
    try {
      wrap()
      await userEvent.upload(screen.getByLabelText('Choose files'), file('AKASH CC SALES.xlsx'))
      await userEvent.click(await screen.findByRole('button', { name: /^No, ELVN XT/ }))
      expect(screen.getByRole('button', { name: 'Product for ELVN XT' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Yes, / })).toBeNull()
    } finally {
      sheet.extra = []
    }
  })

  it('Skip leaves the row out of the saved statement', async () => {
    sheet.extra = [[3, 'ELVN XT', '10S', 64.25, 10, 40, 0, 0, 10, 0, 0, 30, 0, 0]]
    try {
      wrap()
      await userEvent.upload(screen.getByLabelText('Choose files'), file('AKASH CC SALES.xlsx'))
      await userEvent.click(await screen.findByRole('button', { name: 'Skip ELVN XT' }))
      expect(screen.getByText('Skipped')).toBeInTheDocument()
      commit.mockClear()
      await userEvent.click(screen.getByRole('button', { name: 'Save statement' }))
      await waitFor(() => expect(commit).toHaveBeenCalled())
      expect(commit.mock.calls[0][0].lines).toHaveLength(2) // the two matched rows only
    } finally {
      sheet.extra = []
    }
  })

  it('a row that is not found can be skipped too, and the statement saves', async () => {
    sheet.extra = [[3, 'ZZZ UNKNOWN', '10S', 10, 10, 40, 0, 0, 10, 0, 0, 30, 0, 0]]
    try {
      wrap()
      await userEvent.upload(screen.getByLabelText('Choose files'), file('AKASH CC SALES.xlsx'))
      const save = await screen.findByRole('button', { name: 'Save statement' })
      expect(save).toBeDisabled()
      await userEvent.click(screen.getByRole('button', { name: 'Skip ZZZ UNKNOWN' }))
      expect(screen.getByText('Skipped')).toBeInTheDocument()
      expect(save).toBeEnabled()
    } finally {
      sheet.extra = []
    }
  })

  it('lists an 80%+ match as auto-matched so it can be re-adjusted, and learns it', async () => {
    sheet.extra = [[3, 'LARICEF 1.5G', '10S', 64.25, 10, 40, 0, 0, 10, 0, 0, 30, 0, 0]]
    saveAliases.mockClear()
    try {
      wrap()
      await userEvent.upload(screen.getByLabelText('Choose files'), file('AKASH CC SALES.xlsx'))
      expect(await screen.findByText(/Auto-matched \(88%\)/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Product for LARICEF 1.5G' })).toHaveTextContent(
        'Lairocef 1.5G',
      )
      await userEvent.click(screen.getByRole('button', { name: 'Save statement' }))
      await waitFor(() => expect(saveAliases).toHaveBeenCalled())
      expect(saveAliases.mock.calls[0][0]).toEqual([
        expect.objectContaining({ alias: 'LARICEF 1.5', product_id: 'p2', stockist_id: 's1' }),
      ])
    } finally {
      sheet.extra = []
    }
  })

  it('what was chosen is remembered for this stockist and for everyone', async () => {
    sheet.extra = [[3, 'ELVN XT', '10S', 64.25, 10, 40, 0, 0, 10, 0, 0, 30, 0, 0]]
    saveAliases.mockClear()
    try {
      wrap()
      await userEvent.upload(screen.getByLabelText('Choose files'), file('AKASH CC SALES.xlsx'))
      await userEvent.click(await screen.findByRole('button', { name: /^Yes, ELVN XT/ }))
      await userEvent.click(screen.getByRole('button', { name: 'Save statement' }))
      await waitFor(() => expect(saveAliases).toHaveBeenCalled())
      expect(
        saveAliases.mock.calls[0][0].map((a: { stockist_id: string | null }) => a.stockist_id),
      ).toEqual(['s1', null])
    } finally {
      sheet.extra = []
    }
  })
})
