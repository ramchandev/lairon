import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders on <body>, outside any (backdrop-filter) card that contains it', () => {
    render(
      <section data-testid="card" className="glass">
        <ConfirmDialog
          open
          title="Sure?"
          confirmLabel="Yes"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </section>,
    )
    expect(screen.getByRole('dialog').closest('[data-testid="card"]')).toBeNull()
    expect(document.body.contains(screen.getByRole('dialog'))).toBe(true)
  })

  it('focuses Cancel, closes on Escape, confirms on click', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Sign out?"
        confirmLabel="Sign out"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('requires a reason when reasonLabel is set', async () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Reject?"
        reasonLabel="Reason"
        confirmLabel="Reject"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    )
    const btn = screen.getByRole('button', { name: 'Reject' })
    expect(btn).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Reason'), 'Duplicate')
    await userEvent.click(btn)
    expect(onConfirm).toHaveBeenCalledWith('Duplicate')
  })

  it('renders nothing when closed', () => {
    render(<ConfirmDialog open={false} title="x" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
