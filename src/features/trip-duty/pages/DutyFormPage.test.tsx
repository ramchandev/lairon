import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { DutyFormPage } from './DutyFormPage'

vi.mock('@/features/vehicles/api', () => ({
  useVehicles: () => ({
    data: [{ id: 'v1', name: 'CRYSTA', vehicle_number: 'TN09AB6435', is_active: true }],
  }),
}))
vi.mock('@/features/lookups/hooks', () => ({ useLookup: () => ({ data: [] }) }))
vi.mock('../api', () => ({
  useEntry: () => ({ data: undefined, isLoading: false }),
  useEditWindow: () => ({ data: 7, isLoading: false }),
  useLastKm: () => ({ data: 1520 }),
  useSaveDuty: () => ({ mutate: vi.fn(), isPending: false }),
}))

const setup = () =>
  render(<RouterProvider router={createMemoryRouter([{ path: '/', element: <DutyFormPage /> }])} />)
const pickVehicle = (label: string) =>
  userEvent.selectOptions(screen.getByLabelText(/^Vehicle/), label)

describe('Start duty form', () => {
  it('shows KM fields only for fleet vehicles, plus a details box for Others', async () => {
    setup()
    expect(screen.queryByLabelText(/Starting KM/)).toBeNull()
    await pickVehicle('CRYSTA 6435')
    expect(screen.getByLabelText(/Starting KM/)).toBeInTheDocument()
    expect(screen.getByText(/Last closing KM on this vehicle: 1,520/)).toBeInTheDocument()
    await pickVehicle('Own (guest’s vehicle)')
    expect(screen.queryByLabelText(/Starting KM/)).toBeNull()
    await pickVehicle('Others')
    expect(screen.getByLabelText(/Vehicle details/)).toBeInTheDocument()
  })

  it('warns (without blocking) when starting KM is lower than the last closing KM', async () => {
    setup()
    await pickVehicle('CRYSTA 6435')
    await userEvent.type(screen.getByLabelText(/Starting KM/), '1400')
    expect(screen.getByRole('status')).toHaveTextContent(/lower than the last closing KM \(1520\)/)
  })

  it('reveals end details when the duty is already finished and shows live totals, including past midnight', async () => {
    setup()
    await pickVehicle('CRYSTA 6435')
    expect(screen.queryByLabelText(/Ending KM/)).toBeNull()
    await userEvent.click(screen.getByRole('switch', { name: /Duty already finished/ }))
    await userEvent.type(screen.getByLabelText(/Starting KM/), '100')
    await userEvent.type(screen.getByLabelText(/Ending KM/), '152')
    const start = screen.getByLabelText(/Starting time/)
    const end = screen.getByLabelText(/Closing time/)
    await userEvent.clear(start)
    await userEvent.type(start, '22:00')
    await userEvent.clear(end)
    await userEvent.type(end, '07:15')
    expect(await screen.findByText('52 km · 9h 15m · Ends next day')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit duty' })).toBeInTheDocument()
  })
})
