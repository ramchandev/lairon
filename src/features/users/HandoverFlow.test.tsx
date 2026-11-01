import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HandoverFlow } from './HandoverFlow'

const transfer = vi.fn()
let workload:
  { doctors: number; requests: number; open_requests: number; drafts: number } | undefined
vi.mock('@/components/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('./handover', () => ({
  useManagerWorkload: () => ({ data: workload }),
  useTransferWork: () => ({ mutate: transfer, isPending: false }),
}))
vi.mock('./api', () => ({
  useUsers: () => ({
    data: [
      { id: 'm1', full_name: 'Ram', is_active: true },
      { id: 'm2', full_name: 'Priya', is_active: true },
      { id: 'm3', full_name: 'Gone', is_active: false },
    ],
  }),
}))

const ram = { id: 'm1', full_name: 'Ram' } as never

describe('HandoverFlow', () => {
  beforeEach(() => {
    transfer.mockClear()
    workload = { doctors: 4, requests: 7, open_requests: 5, drafts: 0 }
  })

  it('shows what the manager holds and offers only the OTHER active managers', async () => {
    render(
      <HandoverFlow user={ram} thenDeactivate={false} onClose={vi.fn()} onDeactivate={vi.fn()} />,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(/4 doctors and 7 requests \(5 open\)/)
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['Choose manager', 'Priya'])
  })

  it('hands everything to the chosen manager, with the note', async () => {
    const onClose = vi.fn()
    render(
      <HandoverFlow user={ram} thenDeactivate={false} onClose={onClose} onDeactivate={vi.fn()} />,
    )
    await userEvent.selectOptions(screen.getByLabelText('New manager'), 'Priya')
    await userEvent.type(screen.getByLabelText(/Note/), 'Ram has left')
    await userEvent.click(screen.getByRole('button', { name: 'Hand over' }))
    expect(transfer).toHaveBeenCalledWith(
      { fromId: 'm1', toId: 'm2', note: 'Ram has left' },
      expect.anything(),
    )
  })

  it('when deactivating, offers to skip the hand-over', async () => {
    const onDeactivate = vi.fn()
    render(<HandoverFlow user={ram} thenDeactivate onClose={vi.fn()} onDeactivate={onDeactivate} />)
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate without handing over' }))
    expect(onDeactivate).toHaveBeenCalledWith(ram)
  })

  it('a manager with nothing to hand over goes straight to the deactivate confirmation', () => {
    workload = { doctors: 0, requests: 0, open_requests: 0, drafts: 0 }
    const onDeactivate = vi.fn()
    render(<HandoverFlow user={ram} thenDeactivate onClose={vi.fn()} onDeactivate={onDeactivate} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onDeactivate).toHaveBeenCalledWith(ram)
  })
})
