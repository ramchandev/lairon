import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
})
