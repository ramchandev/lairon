import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SalesEntryPage } from './SalesEntryPage'

const save = vi.fn().mockResolvedValue(undefined)
const month = () => new Date().toISOString().slice(0, 7)
let role = 'manager'

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'm1', role, full_name: 'Ram' } }),
}))
vi.mock('@/features/locations/api', () => ({
  useLocations: () => ({
    data: [
      { id: 'l1', code: 'MDU', name: 'Madurai', is_active: true },
      { id: 'l2', code: 'NGL', name: 'Nagercoil', is_active: true },
    ],
  }),
  useManagerLocations: () => ({ data: { m1: ['l1'] }, isSuccess: true }),
}))
vi.mock('@/features/products/api', () => ({
  useProducts: () => ({
    isLoading: false,
    data: [
      { id: 'p1', name: 'Lairobon', is_active: true, tag: 'core', pts: 100 },
      { id: 'p2', name: 'Rbplar', is_active: true, tag: null, pts: 60 },
    ],
  }),
}))
vi.mock('../sales', async (orig) => ({
  ...(await orig<typeof import('../sales')>()),
  useSalesEntries: () => ({
    isLoading: false,
    data: [
      {
        id: 'e1',
        manager_id: 'm1',
        location_id: 'l1',
        product_id: 'p1',
        month: `${month()}-01`,
        primary_target: 1700,
        secondary_target: 1700,
        primary_ach: 1500,
        secondary_ach: 0,
        sales_return: 0,
      },
    ],
  }),
  useSaveSalesEntry: () => ({ mutateAsync: save, isPending: false }),
}))

describe('Sales entry', () => {
  beforeEach(() => {
    save.mockClear()
    role = 'manager'
  })
  it('shows the locations the manager covers (and only those)', () => {
    render(<SalesEntryPage />)
    expect(screen.getByText('MDU')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nagercoil' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Madurai' })).toBeInTheDocument()
  })
  it('lists saved products and saves only the rows that changed', async () => {
    render(<SalesEntryPage />)
    const ach = screen.getByLabelText('Primary achieved — Lairobon')
    expect(ach).toHaveValue('1500')
    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled()
    await userEvent.clear(ach)
    await userEvent.type(ach, '1600')
    await userEvent.click(screen.getByRole('button', { name: 'Save 1 changed' }))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0]).toMatchObject({
      locationId: 'l1',
      productId: 'p1',
      figures: { primary_ach: 1600, primary_target: 1700 },
    })
  })
  it('shows Ach % from target and achieved', () => {
    render(<SalesEntryPage />)
    expect(screen.getByText('88%')).toBeInTheDocument()
  })
})
