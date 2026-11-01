import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultiSearchSelect } from './MultiSearchSelect'

function Harness({ start = [] as string[] }) {
  const [v, setV] = useState(start)
  return (
    <MultiSearchSelect
      title="Speciality"
      allowOther
      value={v}
      options={['Cardiologist', 'Diabetologist', 'Neurologist']}
      onChange={setV}
    />
  )
}

describe('MultiSearchSelect', () => {
  it('lets you tick several, shows them as chips, and filters by search', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: /Speciality|Select/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Cardiologist' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Neurologist' }))
    await userEvent.type(screen.getByLabelText('Search options'), 'diab')
    expect(screen.queryByRole('checkbox', { name: 'Cardiologist' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Diabetologist' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByText('Cardiologist')).toBeInTheDocument()
    expect(screen.getByText('Neurologist')).toBeInTheDocument()
  })
  it('un-ticks, and adds a value that is not in the list', async () => {
    render(<Harness start={['Cardiologist']} />)
    await userEvent.click(screen.getByRole('button', { name: /Cardiologist/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Cardiologist' }))
    await userEvent.type(screen.getByLabelText('Add another value'), 'Rheumatologist{Enter}')
    expect(screen.getByRole('checkbox', { name: 'Rheumatologist' })).toBeChecked()
    expect(screen.getByText('1 selected')).toBeInTheDocument()
  })
})
