import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchSelect } from './SearchSelect'

const many = Array.from({ length: 10 }, (_, i) => ({ value: `v${i}`, label: `Item ${i}` }))

function Harness({ options, allowOther }: { options: typeof many; allowOther?: boolean }) {
  const [v, setV] = useState('')
  return (
    <>
      <SearchSelect
        value={v}
        onChange={setV}
        options={options}
        placeholder="Pick"
        allowOther={allowOther}
      />
      <output>{v}</output>
    </>
  )
}

describe('SearchSelect', () => {
  it('searches long lists and selects', async () => {
    render(<Harness options={many} />)
    await userEvent.click(screen.getByRole('button', { name: /Pick/ }))
    await userEvent.type(screen.getByLabelText('Search options'), 'Item 7')
    expect(screen.queryByText('Item 3')).toBeNull()
    await userEvent.click(screen.getByText('Item 7'))
    expect(screen.getByRole('status')).toHaveTextContent('v7')
  })
  it('hides the search box on short lists', async () => {
    render(<Harness options={many.slice(0, 3)} />)
    await userEvent.click(screen.getByRole('button', { name: /Pick/ }))
    expect(screen.queryByLabelText('Search options')).toBeNull()
  })
  it('saves the typed text for Others', async () => {
    render(<Harness options={many.slice(0, 3)} allowOther />)
    await userEvent.click(screen.getByRole('button', { name: /Pick/ }))
    await userEvent.click(screen.getByText('Others…'))
    await userEvent.type(screen.getByLabelText('Other value'), 'Podiatrist')
    await userEvent.click(screen.getByRole('button', { name: 'Use this value' }))
    expect(screen.getByRole('status')).toHaveTextContent('Podiatrist')
  })
})
