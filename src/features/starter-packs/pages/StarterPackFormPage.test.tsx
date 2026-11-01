import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { StarterPackFormPage } from './StarterPackFormPage'

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 's1', role: 'staff', full_name: 'Staff One', area: 'Adyar' } }),
}))
vi.mock('@/features/divisions/api', () => ({
  useDivisions: () => ({
    data: [
      { id: 'ol', name: 'OL', is_active: true },
      { id: 'cc', name: 'CC', is_active: true },
    ],
  }),
}))
vi.mock('@/features/products/api', () => ({
  useProducts: () => ({
    data: [
      { id: 'p1', name: 'Lairobon', is_active: true, division_ids: ['ol'] },
      { id: 'p2', name: 'Elvion-S', is_active: true, division_ids: ['cc'] },
    ],
  }),
}))
vi.mock('@/features/doctors/api', () => ({ useDoctors: () => ({ data: [] }) }))
vi.mock('@/features/lookups/hooks', () => ({ useLookup: () => ({ data: [] }) }))
vi.mock('@/features/users/api', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('../api', () => ({
  useCreatePack: () => ({ mutate: vi.fn(), isPending: false }),
  usePack: () => ({ data: null }),
}))

// FormPage uses useBlocker (unsaved-changes guard), which needs a data router.
const setup = () =>
  render(
    <RouterProvider
      router={createMemoryRouter([{ path: '/', element: <StarterPackFormPage /> }])}
    />,
  )

describe('Starter pack form', () => {
  it('starts with one product row; Add product adds another and Remove keeps at least one', async () => {
    setup()
    expect(screen.getAllByLabelText(/^Quantity/)).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: /Add product/ }))
    expect(screen.getAllByLabelText(/^Quantity/)).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Remove product 2' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove product 1' }))
    expect(screen.getAllByLabelText(/^Quantity/)).toHaveLength(1)
  })

  it('each product line has its own Division, then Product, then Quantity', () => {
    setup()
    expect(screen.getByLabelText(/^Division 1/)).toHaveValue('All Division')
    expect(screen.getByRole('button', { name: /Product 1/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Quantity/)).toBeInTheDocument()
  })

  it('a line’s product list follows that line’s division', async () => {
    setup()
    await userEvent.selectOptions(screen.getByLabelText(/^Division 1/), 'OL')
    await userEvent.click(screen.getByRole('button', { name: /Product 1/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Lairobon')).toBeInTheDocument()
    expect(within(dialog).queryByText('Elvion-S')).toBeNull()
  })

  it('lines are independent, and a new line starts on the division of the line above', async () => {
    setup()
    await userEvent.selectOptions(screen.getByLabelText(/^Division 1/), 'OL')
    await userEvent.click(screen.getByRole('button', { name: /Add product/ }))
    expect(screen.getByLabelText(/^Division 2/)).toHaveValue('OL')
    await userEvent.selectOptions(screen.getByLabelText(/^Division 2/), 'CC')
    expect(screen.getByLabelText(/^Division 1/)).toHaveValue('OL')
    await userEvent.click(screen.getByRole('button', { name: /Product 2/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Elvion-S')).toBeInTheDocument()
    expect(within(dialog).queryByText('Lairobon')).toBeNull()
  })

  it('changing a line’s division clears a product that does not belong to the new one', async () => {
    setup()
    await userEvent.selectOptions(screen.getByLabelText(/^Division 1/), 'OL')
    await userEvent.click(screen.getByRole('button', { name: /Product 1/ }))
    await userEvent.click(within(screen.getByRole('dialog')).getByText('Lairobon'))
    const product = () => screen.getByRole('button', { name: /Product 1/ })
    expect(product()).toHaveTextContent('Lairobon')
    await userEvent.selectOptions(screen.getByLabelText(/^Division 1/), 'CC')
    expect(product()).toHaveTextContent('Select product')
  })
})
