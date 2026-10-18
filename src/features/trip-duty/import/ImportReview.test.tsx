import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportReview } from './ImportReview'
import { parseSheet } from './parse'
import { withFileName } from './readFile'

let existing: { entry_date: string; entry_type: string; leave_status: string | null }[] = []
vi.mock('@/features/users/api', () => ({
  useUsers: () => ({
    data: [
      { id: 'd1', full_name: 'PRAKALATHAN.M' },
      { id: 'd2', full_name: 'VIGNESH.P' },
    ],
  }),
}))
vi.mock('../admin-api', () => ({
  useAdminEntries: () => ({ data: existing }),
  useBetaMonth: () => ({ data: null }),
  useBetaRates: () => ({
    data: [{ effective_from: '2026-04-01', local_rate: 250, outstation_rate: 300 }],
  }),
}))

const sheet = (rows: unknown[][]) =>
  withFileName(
    'PRAKALATHAN.M — September_2026.xlsx',
    parseSheet([['Date', 'Vehicle', 'Guest'], ...rows]),
  )
const GOOD = [
  ['01/09/2026', 'Own', 'Dr A'],
  ['02/09/2026', 'Own', 'Dr B'],
  ['03/09/2026', '-', 'Week off'],
]
const onImport = vi.fn()
const setup = (rows = GOOD) =>
  render(<ImportReview file={sheet(rows)} busy={false} onBack={() => {}} onImport={onImport} />)
const importBtn = () => screen.getByRole('button', { name: /^Import \d+ rows$/ })

describe('Import review', () => {
  beforeEach(() => {
    existing = []
    onImport.mockReset()
  })

  it('matches the driver and month from the file name, shows counters and the beta preview', () => {
    setup()
    expect(screen.getByLabelText(/Driver/)).toHaveValue('d1')
    expect(screen.getByLabelText(/Month/)).toHaveValue('2026-09')
    expect(screen.getByLabelText('Beta preview')).toHaveTextContent('2 duties → 2 payable days')
    expect(screen.getByLabelText('Beta preview')).toHaveTextContent('₹500')
    expect(importBtn()).toBeEnabled()
    expect(importBtn()).toHaveTextContent('Import 3 rows')
  })

  it('sends the chosen driver, month and mode when importing', async () => {
    setup()
    await userEvent.click(importBtn())
    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ willImport: 3 }), {
      driverId: 'd1',
      month: '2026-09',
      mode: 'replace',
    })
  })

  it('blocks the import while there are errors', () => {
    setup([...GOOD, ['not a date', 'Own', 'Dr C']])
    expect(importBtn()).toBeDisabled()
    expect(screen.getByText(/Unreadable date/)).toBeInTheDocument()
  })

  it('needs a driver and a month', async () => {
    render(
      <ImportReview
        file={withFileName(
          'Driver-data.xlsx',
          parseSheet([
            ['Date', 'Vehicle', 'Guest'],
            ['01/09/2026', 'Own', 'Dr A'],
          ]),
        )}
        busy={false}
        onBack={() => {}}
        onImport={onImport}
      />,
    )
    expect(importBtn()).toBeDisabled() // no driver detected
    await userEvent.selectOptions(screen.getByLabelText(/Driver/), 'd2')
    expect(importBtn()).toBeEnabled() // month comes from the dates in the file
  })

  it('offers Fill vs Replace when entries already exist, defaulting to the safe Fill, and confirms before replacing', async () => {
    existing = [{ entry_date: '2026-09-02', entry_type: 'duty', leave_status: null }]
    setup()
    expect(screen.getByRole('radio', { name: /Fill empty days only/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(importBtn()).toHaveTextContent('Import 2 rows') // the 2 Sep row would be skipped
    await userEvent.click(screen.getByRole('radio', { name: /Replace the month/ }))
    await userEvent.click(importBtn())
    expect(onImport).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: 'Replace the month?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace and import' }))
    expect(onImport).toHaveBeenCalledWith(expect.anything(), {
      driverId: 'd1',
      month: '2026-09',
      mode: 'replace',
    })
  })
})
