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

  it('offers only the selected division’s products', async () => {
    setup()
    await userEvent.click(screen.getByRole('radio', { name: 'OL' }))
    await userEvent.click(screen.getByRole('button', { name: /Product 1/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Lairobon')).toBeInTheDocument()
    expect(within(dialog).queryByText('Elvion-S')).toBeNull()
  })

  it('asks before clearing filled rows when the division changes', async () => {
    setup()
    await userEvent.click(screen.getByRole('radio', { name: 'OL' }))
    await userEvent.type(screen.getByLabelText(/^Quantity/), '2 boxes')
    await userEvent.click(screen.getByRole('radio', { name: 'CC' }))
    expect(screen.getByRole('dialog', { name: 'Switch division?' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'OL' })).toHaveAttribute('aria-checked', 'true') // not switched yet
    await userEvent.click(screen.getByRole('button', { name: 'Switch and clear' }))
    expect(screen.getByRole('radio', { name: 'CC' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue('')
  })

  it('switches without asking when nothing was entered', async () => {
    setup()
    await userEvent.click(screen.getByRole('radio', { name: 'CC' }))
    expect(screen.queryByRole('dialog', { name: 'Switch division?' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'CC' })).toHaveAttribute('aria-checked', 'true')
  })
})
