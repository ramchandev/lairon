import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { DailyLogPage } from './DailyLogPage'

const save = vi.fn()

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'm1', role: 'manager', full_name: 'Ram' } }),
}))
vi.mock('@/features/locations/api', () => ({
  useLocations: () => ({ data: [{ id: 'l1', code: 'MDU', name: 'Madurai', is_active: true }] }),
  useManagerLocations: () => ({ data: { m1: ['l1'] }, isSuccess: true }),
}))
vi.mock('@/features/doctors/api', () => ({
  useDoctors: () => ({
    data: [{ id: 'd1', name: 'Dr Surendran', speciality: 'MS', area: 'Madurai', is_active: true }],
  }),
}))
vi.mock('../activity', async (orig) => ({
  ...(await orig<typeof import('../activity')>()),
  useDailyLogs: () => ({ isLoading: false, data: [] }),
  useDoctorCalls: () => ({ isLoading: false, data: [] }),
  useSaveDay: () => ({ mutate: save, isPending: false }),
}))

describe('Daily log', () => {
  beforeEach(() => save.mockClear())

  it('works out the deviation from planned vs actual, and asks for a reason', async () => {
    render(
      <MemoryRouter>
        <DailyLogPage />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText('TP planned'), 'MDU')
    await userEvent.type(screen.getByLabelText('Actual work'), 'MDU')
    expect(screen.getByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.type(screen.getByLabelText('Actual work'), '/Theni')
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Reason')).toBeInTheDocument()
  })

  it('saves the day with its doctors, and refuses a doctor without a name', async () => {
    render(
      <MemoryRouter>
        <DailyLogPage />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText('TP planned'), 'MDU')
    await userEvent.click(screen.getByRole('button', { name: /Add doctor/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save day' }))
    expect(save).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /Select doctor/ }))
    await userEvent.click(await screen.findByText('Dr Surendran'))
    await userEvent.type(screen.getByLabelText('Amount 1'), '500')
    await userEvent.click(screen.getByRole('button', { name: 'Save day' }))
    expect(save).toHaveBeenCalledTimes(1)
    const arg = save.mock.calls[0][0]
    expect(arg.log).toMatchObject({ tp_planned: 'MDU', location_id: 'l1', day_type: 'field' })
    expect(arg.calls[0]).toMatchObject({
      doctor_id: 'd1',
      doctor_name: 'Dr Surendran',
      amount: 500,
      place: 'Madurai',
    })
  })
})
