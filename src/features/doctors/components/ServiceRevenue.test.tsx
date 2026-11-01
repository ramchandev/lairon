import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ServiceRevenue } from './ServiceRevenue'

const mutate = vi.fn()
let role = 'manager'
vi.mock('@/app/AuthProvider', () => ({ useAuth: () => ({ profile: { role, id: 'm1' } }) }))
vi.mock('@/components/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('../revenue', async (orig) => ({
  ...(await orig<typeof import('../revenue')>()),
  useSetServiceRevenue: () => ({ mutate, isPending: false }),
}))

const row = (month: string, amount: number) => ({
  id: month,
  service_id: 's1',
  month: `${month}-01`,
  amount,
  entered_by_name: 'Ram',
  updated_at: '',
})
const setup = (rows = [row('2026-10', 40000)], canEnter = true) =>
  render(
    <ServiceRevenue
      serviceId="s1"
      doctorName="Dr One"
      startDate="2026-09-12"
      rows={rows}
      canEnter={canEnter}
    />,
  )

describe('ServiceRevenue (month on month)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-01T06:00:00Z')) // 1 Nov
    mutate.mockClear()
    role = 'manager'
  })
  afterEach(() => vi.useRealTimers())

  it('lists every month from the service start to now, newest first', () => {
    setup()
    const months = screen.getAllByRole('listitem').map((li) => li.querySelector('p')?.textContent)
    expect(months).toEqual(['November 2026', 'October 2026', 'September 2026'])
  })

  it('October (entered) is locked on 1 Nov; November and the empty September can be entered', () => {
    setup()
    const li = (m: string) => screen.getByText(m).closest('li')!
    expect(within(li('October 2026')).getByText('Locked')).toBeInTheDocument()
    expect(
      within(li('November 2026')).getByRole('button', { name: /Enter revenue for November 2026/ }),
    ).toBeInTheDocument()
    expect(
      within(li('September 2026')).getByRole('button', {
        name: /Enter revenue for September 2026/,
      }),
    ).toBeInTheDocument()
  })

  it('asks "Save … ? You can edit this until the month ends" and saves only on Yes', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /Enter revenue for November 2026/ }))
    await userEvent.type(screen.getByLabelText('Revenue for November 2026'), '1,25,000')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const dialog = screen.getByRole('dialog', { name: 'Save this revenue?' })
    expect(dialog).toHaveTextContent(/₹1,25,000/)
    expect(dialog).toHaveTextContent(/You can edit this until the month ends \(30 Nov 2026\)/)
    await userEvent.click(within(dialog).getByRole('button', { name: 'No' }))
    expect(mutate).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, save' }))
    expect(mutate).toHaveBeenCalledWith(
      { serviceId: 's1', month: '2026-11', amount: 125000 },
      expect.anything(),
    )
  })

  it('an admin can still edit a locked month', () => {
    role = 'admin'
    setup()
    expect(
      screen.getByRole('button', { name: /Edit revenue for October 2026/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Locked')).toBeNull()
  })

  it('shows figures read-only when the viewer cannot enter revenue', () => {
    setup([row('2026-10', 40000)], false)
    expect(screen.queryByRole('button', { name: /revenue for/ })).toBeNull()
    expect(screen.getByText('₹40,000')).toBeInTheDocument()
  })
})
