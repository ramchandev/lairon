import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StockistsPage } from './StockistsPage'

const save = vi.fn().mockResolvedValue(undefined)
const add = vi.fn()
const month = () => new Date().toISOString().slice(0, 7)

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'm1', role: 'manager', full_name: 'Ram' } }),
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
vi.mock('../stockists', async (orig) => ({
  ...(await orig<typeof import('../stockists')>()),
  useStockists: () => ({
    isLoading: false,
    data: [
      { id: 's1', name: 'Vaccine Park', location_id: 'l1', is_active: true },
      { id: 's2', name: 'Other Place', location_id: 'l2', is_active: true },
    ],
  }),
  useStockistEntries: () => ({
    isLoading: false,
    data: [
      {
        stockist_id: 's1',
        month: `${month()}-01`,
        sales_value: 5.25,
        closing_value: 4.11,
        return_value: 0,
      },
    ],
  }),
  useSaveStockistEntry: () => ({ mutateAsync: save, isPending: false }),
  useAddStockist: () => ({ mutate: add, isPending: false }),
  useSetStockistActive: () => ({ mutate: vi.fn() }),
}))

describe('Stockists', () => {
  beforeEach(() => {
    save.mockClear()
    add.mockClear()
  })
  it('shows only the stockists of a location the manager covers', () => {
    render(<StockistsPage />)
    expect(screen.queryByRole('button', { name: 'Nagercoil' })).toBeNull()
    expect(screen.getByLabelText('Sales value — Vaccine Park')).toHaveValue('5.25')
    expect(screen.queryByLabelText('Sales value — Other Place')).toBeNull()
  })
  it('saves only the changed stockist', async () => {
    render(<StockistsPage />)
    const sales = screen.getByLabelText('Sales value — Vaccine Park')
    await userEvent.clear(sales)
    await userEvent.type(sales, '5.5')
    await userEvent.click(screen.getByRole('button', { name: 'Save 1 changed' }))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0]).toMatchObject({
      stockistId: 's1',
      values: { sales_value: 5.5, closing_value: 4.11, return_value: 0 },
    })
  })
  it('adds a stockist to the chosen location', async () => {
    render(<StockistsPage />)
    await userEvent.type(screen.getByLabelText('New stockist name'), 'PALEPU')
    await userEvent.click(screen.getByRole('button', { name: /Add stockist/ }))
    expect(add.mock.calls[0][0]).toMatchObject({ name: 'PALEPU', locationId: 'l1', userId: 'm1' })
  })
})
