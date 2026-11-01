import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { DataTable, type Column } from './DataTable'

interface Row {
  id: string
  name: string
  area: string
}
const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', primary: true, cell: (r) => r.name },
  { key: 'area', header: 'Area', cell: (r) => r.area },
]
const rows: Row[] = Array.from({ length: 25 }, (_, i) => ({
  id: String(i),
  name: `Person ${i}`,
  area: `Area ${i}`,
}))

describe('DataTable', () => {
  it('renders both a table and cards, with actions, and pages with Show more', async () => {
    render(
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        pageSize={10}
        actions={(r) => <button>Edit {r.name}</button>}
      />,
    )
    expect(screen.getAllByText('Person 0')).toHaveLength(1)
    expect(screen.queryByText('Person 10')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Show more/ }))
    expect(screen.getAllByText('Person 10')).toHaveLength(1)
  })
  it('shows the empty state and a loading skeleton', () => {
    const { rerender } = render(
      <DataTable rows={[]} columns={columns} rowKey={(r) => r.id} empty={<p>Nothing here</p>} />,
    )
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    rerender(<DataTable rows={[]} columns={columns} rowKey={(r) => r.id} loading />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  describe('clickable rows', () => {
    const Where = () => <p data-testid="where">{useLocation().pathname}</p>
    const setup = (rowTo: (r: Row) => string | null) =>
      render(
        <MemoryRouter initialEntries={['/list']}>
          <Routes>
            <Route
              path="/list"
              element={
                <DataTable
                  rows={rows.slice(0, 2)}
                  columns={columns}
                  rowKey={(r) => r.id}
                  rowTo={rowTo}
                  actions={(r) => <button>Delete {r.name}</button>}
                />
              }
            />
            <Route path="/item/:id" element={<Where />} />
          </Routes>
        </MemoryRouter>,
      )

    it('opens the row when you click anywhere on it', async () => {
      setup((r) => `/item/${r.id}`)
      await userEvent.click(screen.getByText('Area 1'))
      expect(screen.getByTestId('where')).toHaveTextContent('/item/1')
    })
    it('leaves buttons and links inside the row alone', async () => {
      setup((r) => `/item/${r.id}`)
      await userEvent.click(screen.getByRole('button', { name: 'Delete Person 0' }))
      expect(screen.queryByTestId('where')).toBeNull()
    })
    it('a row whose target is null is not clickable', async () => {
      setup((r) => (r.id === '0' ? null : `/item/${r.id}`))
      await userEvent.click(screen.getByText('Area 0'))
      expect(screen.queryByTestId('where')).toBeNull()
    })
  })
})
