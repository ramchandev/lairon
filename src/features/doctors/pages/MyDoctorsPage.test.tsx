import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MyDoctorsPage } from './MyDoctorsPage'

const desk = vi.hoisted(() => ({ on: true }))
vi.mock('@/lib/useMediaQuery', () => ({ useIsDesktop: () => desk.on }))
vi.mock('@/app/AuthProvider', () => ({ useAuth: () => ({ profile: { id: 'm1' } }) }))
vi.mock('../api', () => ({
  useDoctors: () => ({
    isLoading: false,
    data: [
      {
        id: 'd1',
        name: 'Dr Rao',
        is_active: true,
        manager_id: 'm1',
        hospital_name: 'City',
        area: 'Anna Nagar',
        phone: '9876543210',
        division: 'CC',
        qualification: 'MD',
        speciality: 'Cardio',
      },
      {
        id: 'd2',
        name: 'Dr Iyer',
        is_active: true,
        manager_id: 'm2',
        hospital_name: 'Apollo',
        area: 'Adyar',
        phone: null,
        division: null,
        qualification: null,
        speciality: null,
      },
    ],
  }),
}))

const wrap = () =>
  render(
    <MemoryRouter>
      <MyDoctorsPage />
    </MemoryRouter>,
  )

describe('MyDoctorsPage', () => {
  it('on a computer shows a table with a request action on every doctor and Edit only on the manager’s own', () => {
    wrap()
    const table = screen.getByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(expect.arrayContaining(['Doctor', 'Hospital', 'Area', 'Phone', 'Status']))
    expect(screen.getByRole('link', { name: 'Request service for Dr Iyer' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit Dr Rao' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit Dr Iyer' })).toBeNull()
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeEnabled()
  })

  it('on a phone keeps the doctor cards', () => {
    desk.on = false
    try {
      wrap()
      expect(screen.queryByRole('table')).toBeNull()
      expect(screen.getAllByRole('link', { name: /Request service/ })).toHaveLength(2)
    } finally {
      desk.on = true
    }
  })
})
