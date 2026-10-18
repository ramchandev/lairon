import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BetaTab } from './BetaTab'

const rows = [
  {
    driver_id: 'a',
    driver_name: 'RAVIKUMAR.N',
    local_days: 10,
    outstation_days: 2,
    payable_days: 12,
    local_amount: 2500,
    outstation_amount: 600,
    total_amount: 3100,
  },
  {
    driver_id: 'b',
    driver_name: 'ELUMALAI.G',
    local_days: 9,
    outstation_days: 3,
    payable_days: 12,
    local_amount: 2250,
    outstation_amount: 900,
    total_amount: 3150,
  },
]
let status: 'draft' | 'finalised' = 'draft'
const finalise = vi.fn()
const reopen = vi.fn()

vi.mock('@/features/users/api', () => ({
  useUsers: () => ({
    data: [
      { id: 'a', full_name: 'RAVIKUMAR.N' },
      { id: 'b', full_name: 'ELUMALAI.G' },
    ],
  }),
}))
vi.mock('../admin-api', () => ({
  useBetaSummary: () => ({ data: rows, isLoading: false }),
  useBetaDays: () => ({
    data: [{ entry_date: '2026-10-01', duties_logged: 2, day_type: 'Outstation', beta: 300 }],
    isLoading: false,
  }),
  useBetaMonth: () => ({ data: { month: '2026-10-01', status } }),
  useBetaRates: () => ({
    data: [
      { id: 'r', effective_from: '2026-04-01', local_rate: 250, outstation_rate: 300, note: null },
    ],
  }),
  useFinaliseMonth: () => ({ mutate: finalise, isPending: false }),
  useReopenMonth: () => ({ mutate: reopen, isPending: false }),
}))

/** The counter tile for `label` (the same words also appear in table headers). */
const counter = (label: string) =>
  screen
    .getAllByText(label)
    .find((el) => el.classList.contains('k-lbl'))!
    .closest('.kpi')! as HTMLElement

const setup = (driverId = '') =>
  render(
    <MemoryRouter>
      <BetaTab month="2026-10" driverId={driverId} onMonth={() => {}} onDriver={vi.fn()} />
    </MemoryRouter>,
  )

describe('Chauffeur beta tab', () => {
  beforeEach(() => {
    status = 'draft'
    finalise.mockReset()
    reopen.mockReset()
  })

  it('totals the counters across drivers and shows the rate card', () => {
    setup()
    expect(within(counter('Total beta')).getByText('₹6,250')).toBeInTheDocument()
    expect(within(counter('Local days')).getByText('19')).toBeInTheDocument()
    expect(within(counter('Total payable duties')).getByText('24')).toBeInTheDocument()
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'SPAN' && /Rates in force since 01 Apr 2026/.test(el.textContent ?? ''),
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/Local ₹250 · Outstation ₹300/)).toBeInTheDocument()
  })

  it('finalising asks for confirmation first', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /Finalise month/ }))
    expect(screen.getByRole('dialog', { name: 'Finalise this month?' })).toBeInTheDocument()
    expect(finalise).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Finalise' }))
    expect(finalise).toHaveBeenCalledWith('2026-10', expect.anything())
  })

  it('a finalised month shows the badge and reopening requires a reason', async () => {
    status = 'finalised'
    setup()
    expect(screen.getByText('Finalised')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Finalise month/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Reopen/ }))
    const dialog = screen.getByRole('dialog', { name: 'Reopen this month?' })
    const confirm = within(dialog).getByRole('button', { name: 'Reopen' })
    expect(confirm).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/Reason for reopening/), 'Missed a duty')
    await userEvent.click(confirm)
    expect(reopen).toHaveBeenCalledWith(
      { month: '2026-10', reason: 'Missed a duty' },
      expect.anything(),
    )
  })

  it('one driver shows the day-wise table and can’t finalise from there', () => {
    setup('a')
    expect(screen.getAllByText('→ counted once').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Outstation').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Finalise month/ })).toBeDisabled()
  })
})
