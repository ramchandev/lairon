import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SaleUploadPage } from './SaleUploadPage'

const who = vi.hoisted(() => ({ email: 'other@lairon.in' }))
vi.mock('@/app/AuthProvider', () => ({ useAuth: () => ({ profile: { email: who.email } }) }))
vi.mock('./HeadingsTab', () => ({ HeadingsTab: () => <div>headings body</div> }))
vi.mock('./UploadTab', () => ({
  UploadTab: ({ forMonth }: { forMonth?: string }) => <div>new upload for {forMonth}</div>,
}))
vi.mock('./UploadsTab', () => ({
  UploadsTab: ({ month }: { month?: string }) => <div>uploaded in {month}</div>,
}))
const up = (id: string, stockist: string, month: string) => ({
  id,
  stockist_id: stockist,
  month,
  status: 'active',
})
vi.mock('../api', () => ({
  useUploads: () => ({
    isLoading: false,
    data: [up('1', 's1', '2026-05-01'), up('2', 's2', '2026-05-01'), up('3', 's1', '2026-04-01')],
  }),
}))

const wrap = () =>
  render(
    <MemoryRouter>
      <SaleUploadPage />
    </MemoryRouter>,
  )

describe('SaleUploadPage', () => {
  it('lists months with their upload counts, and opens one with Uploaded and New upload', async () => {
    wrap()
    const may = screen.getByRole('row', { name: /May 2026/ })
    expect(may).toHaveTextContent('2')
    await userEvent.click(screen.getByText('May 2026'))
    expect(screen.getByText('uploaded in 2026-05')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'New upload' }))
    expect(screen.getByText('new upload for 2026-05')).toBeInTheDocument()
  })

  it('shows Headings only to the preview account', async () => {
    wrap()
    expect(screen.queryByRole('tab', { name: 'Headings' })).toBeNull()
  })

  it('the preview account gets the Headings tab', async () => {
    who.email = 'Ramchandev@gmail.com'
    try {
      wrap()
      await userEvent.click(screen.getByRole('tab', { name: 'Headings' }))
      expect(screen.getByText('headings body')).toBeInTheDocument()
    } finally {
      who.email = 'other@lairon.in'
    }
  })
})
