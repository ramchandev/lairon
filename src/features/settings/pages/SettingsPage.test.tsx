import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SettingsPage } from './SettingsPage'

const save = vi.fn()
vi.mock('../api', () => ({
  useAppSettings: () => ({
    data: { company_name: 'LAIRON', driver_edit_window_days: 7 },
    isLoading: false,
  }),
  useSaveSetting: () => ({ mutate: save, isPending: false }),
}))
vi.mock('../components/AdminsSection', () => ({
  AdminsSection: () => <section>Admins list</section>,
}))

const setup = () =>
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )

describe('Settings', () => {
  beforeEach(() => save.mockReset())

  it('saves the driver edit window only when it is a valid, changed value', async () => {
    setup()
    const btn = screen.getByRole('button', { name: 'Save edit window' })
    expect(btn).toBeDisabled() // unchanged
    const box = screen.getByLabelText(/Driver edit window/)
    await userEvent.clear(box)
    await userEvent.type(box, '99')
    expect(screen.getByRole('alert')).toHaveTextContent('between 1 and 60')
    expect(btn).toBeDisabled()
    await userEvent.clear(box)
    await userEvent.type(box, '14')
    await userEvent.click(btn)
    expect(save).toHaveBeenCalledWith(
      { key: 'driver_edit_window_days', value: 14 },
      expect.anything(),
    )
  })

  it('saves a trimmed company name and refuses an empty one', async () => {
    setup()
    const box = screen.getByLabelText('Company name')
    await userEvent.clear(box)
    expect(screen.getByRole('alert')).toHaveTextContent('required')
    expect(screen.getByRole('button', { name: 'Save company' })).toBeDisabled()
    await userEvent.type(box, '  LAIRON Pharma ')
    await userEvent.click(screen.getByRole('button', { name: 'Save company' }))
    expect(save).toHaveBeenCalledWith(
      { key: 'company_name', value: 'LAIRON Pharma' },
      expect.anything(),
    )
  })

  it('links to the email log and shows the admins section', () => {
    setup()
    expect(screen.getByRole('link', { name: /Email log/ })).toHaveAttribute(
      'href',
      '/admin/email-log',
    )
    expect(screen.getByText('Admins list')).toBeInTheDocument()
  })
})
