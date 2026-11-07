import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportsTab } from './ReportsTab'

vi.mock('@/app/AuthProvider', () => ({ useAuth: () => ({ profile: { id: 'a1' } }) }))
vi.mock('@/components/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('@/features/locations/api', () => ({
  useLocations: () => ({ data: [{ id: 'l1', name: 'Madurai' }] }),
}))
vi.mock('@/features/divisions/api', () => ({
  useDivisions: () => ({ data: [{ id: 'd1', name: 'Critical Care' }] }),
}))
vi.mock('@/features/products/api', () => ({
  useProducts: () => ({ data: [{ id: 'p1', name: 'ELVION XT', pts: 64 }] }),
}))
vi.mock('@/features/performance/stockists', () => ({
  useStockists: () => ({ data: [{ id: 's1', name: 'Akash', location_id: 'l1', is_active: true }] }),
}))
vi.mock('@/features/performance/presets', () => ({
  useReportPresets: () => ({ data: [] }),
  useSavePreset: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePreset: () => ({ mutate: vi.fn() }),
}))
const line = (month: string, sales: number, closing: number) => ({
  product_id: 'p1',
  raw_name: 'ELVION XT',
  sales,
  free: 0,
  opening: 0,
  purchase: 0,
  closing,
  order_qty: 0,
  sale_return: 0,
  rate: null,
  stock_value: null,
  sales_value: null,
  upload: { stockist_id: 's1', division_id: 'd1', month },
})
vi.mock('../api', () => ({
  useUploads: () => ({
    isSuccess: true,
    data: [
      {
        id: 'u1',
        stockist_id: 's1',
        division_id: 'd1',
        month: '2026-05-01',
        status: 'active',
        stockist: { name: 'Akash' },
        division: { name: 'Critical Care' },
      },
    ],
  }),
  useSaleSettings: () => ({ data: { cover_months: 1.5, history_months: 3, slow_cover_months: 3 } }),
  useSaveSaleSettings: () => ({ mutate: vi.fn(), isPending: false }),
  useSaleLines: () => ({
    isLoading: false,
    data: [line('2026-04', 60, 0), line('2026-05', 90, 20)],
  }),
}))

describe('ReportsTab', () => {
  it('opens on “What to order” with the suggested quantity, and switches reports', async () => {
    render(<ReportsTab />)
    expect(await screen.findByRole('heading', { name: 'What to order' })).toBeInTheDocument()
    // average (60+90)/2 months of data = 75 × 1.5 − 20 = 93 (rounded up)
    expect(screen.getByText('93')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Report' }))
    await userEvent.click(screen.getByRole('button', { name: /Top products/ }))
    expect(screen.getByRole('heading', { name: 'Top products' })).toBeInTheDocument()
    expect(screen.getByText('₹5,760')).toBeInTheDocument() // 90 × PTS 64
    // headings sort, and the report can be searched
    await userEvent.click(screen.getByRole('button', { name: /^Sales .*₹/ }))
    expect(screen.getByRole('columnheader', { name: /^Sales .*₹/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    await userEvent.type(screen.getByLabelText('Search this report'), 'zzz')
    expect(screen.getByText('Nothing to show for these filters.')).toBeInTheDocument()
  })
})
