import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmailLogPage } from './EmailLogPage'

const retry = vi.fn()
const save = vi.fn()
const log = [
  {
    id: '1',
    to: 'boss@x.in',
    template: 'leave_applied',
    subject: 'Leave request: RAVI',
    status: 'sent',
    error: null,
    attempts: 1,
    created_at: '2026-10-18T05:00:00Z',
    sent_at: '2026-10-18T05:00:01Z',
  },
  {
    id: '2',
    to: 'ops@x.in',
    template: 'service_request_submitted',
    subject: 'Service request SR-1',
    status: 'failed',
    error: 'Resend 422: domain not verified',
    attempts: 1,
    created_at: '2026-10-18T06:00:00Z',
    sent_at: null,
  },
  {
    id: '3',
    to: 'a@x.in',
    template: 'welcome',
    subject: 'Welcome',
    status: 'failed',
    error: 'x',
    attempts: 1,
    created_at: '2026-10-18T07:00:00Z',
    sent_at: null,
  },
  {
    id: '4',
    to: '(none)',
    template: 'leave.applied',
    subject: null,
    status: 'skipped',
    error: 'No recipients for this event',
    attempts: 0,
    created_at: '2026-10-18T08:00:00Z',
    sent_at: null,
  },
]
vi.mock('../api', () => ({
  useEmailLog: () => ({ data: log, isLoading: false }),
  useRetryEmail: () => ({ mutate: retry }),
  useNotifyEmails: () => ({ data: ['ops@x.in'], isLoading: false }),
  useSaveNotifyEmails: () => ({ mutate: save, isPending: false }),
}))

describe('Email log', () => {
  beforeEach(() => {
    retry.mockReset()
    save.mockReset()
  })

  it('shows outcomes with counts, and the Failed tab narrows the list', async () => {
    render(<EmailLogPage />)
    expect(screen.getByRole('tab', { name: /Failed/ })).toHaveTextContent('2')
    expect(screen.getAllByText('Resend 422: domain not verified').length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('tab', { name: /Failed/ }))
    expect(screen.queryByText('Leave request: RAVI')).toBeNull()
    expect(screen.getAllByText('Service request SR-1').length).toBeGreaterThan(0)
  })

  it('offers Retry only where it can work (not for sent, welcome links or "(none)")', () => {
    render(<EmailLogPage />)
    expect(screen.getAllByRole('button', { name: /Retry/ })).toHaveLength(1)
  })

  it('retries the chosen email', async () => {
    render(<EmailLogPage />)
    await userEvent.click(screen.getAllByRole('button', { name: /Retry/ })[0])
    expect(retry).toHaveBeenCalledWith('2', expect.anything())
  })

  it('searches by recipient or error', async () => {
    render(<EmailLogPage />)
    await userEvent.type(screen.getByRole('searchbox', { name: /Search/ }), 'domain not verified')
    expect(screen.queryByText('Leave request: RAVI')).toBeNull()
  })

  it('validates and saves notification recipients', async () => {
    render(<EmailLogPage />)
    const box = screen.getByLabelText('Email addresses')
    await userEvent.clear(box)
    await userEvent.type(box, 'new@x.in, nope')
    expect(screen.getByRole('alert')).toHaveTextContent('nope')
    const saveBtn = screen.getByRole('button', { name: 'Save recipients' })
    expect(saveBtn).toBeDisabled()
    await userEvent.clear(box)
    await userEvent.type(box, 'new@x.in, other@x.in')
    await userEvent.click(saveBtn)
    expect(save).toHaveBeenCalledWith(['new@x.in', 'other@x.in'], expect.anything())
    void within
  })
})
