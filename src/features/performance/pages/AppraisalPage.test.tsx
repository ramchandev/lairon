import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppraisalPage } from './AppraisalPage'

vi.mock('@/features/users/api', () => ({
  useUsers: () => ({ data: [{ id: 'm1', full_name: 'Jeeva', is_active: true }] }),
}))
vi.mock('../appraisal', async (orig) => ({
  ...(await orig<typeof import('../appraisal')>()),
  useAppraisalConfig: () => ({ data: undefined }),
  useSaveAppraisalConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/components/Toast', () => ({ useToast: () => vi.fn() }))

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppraisalPage />
    </QueryClientProvider>,
  )

describe('AppraisalPage', () => {
  it('asks for a manager first', () => {
    wrap()
    expect(screen.getByText('Select a manager to see their appraisal.')).toBeInTheDocument()
  })
  it('setup shows the 100-point total and warns when it changes', async () => {
    wrap()
    await userEvent.click(screen.getByRole('tab', { name: 'Setup' }))
    expect(screen.getByRole('status')).toHaveTextContent('Total 100 points')
    const sales = screen.getByLabelText('Total sales')
    await userEvent.clear(sales)
    await userEvent.type(sales, '40')
    expect(screen.getByRole('status')).toHaveTextContent('Total 105 points — usually 100')
    expect(screen.getByRole('button', { name: 'Save setup' })).toBeEnabled()
  })
})
