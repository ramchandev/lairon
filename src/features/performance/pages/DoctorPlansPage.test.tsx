import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { DoctorPlansPage } from './DoctorPlansPage'

const saveConversion = vi.fn()
const setCell = vi.fn()

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => ({ profile: { id: 'm1', role: 'manager', full_name: 'Ram' } }),
}))
vi.mock('@/features/locations/api', () => ({
  useLocations: () => ({ data: [{ id: 'l1', code: 'MDU', name: 'Madurai', is_active: true }] }),
}))
vi.mock('@/features/doctors/api', () => ({
  useDoctors: () => ({
    data: [
      {
        id: 'd1',
        name: 'Dr Surendran',
        speciality: 'MS',
        area: 'Madurai',
        hospital_name: 'MSMCH',
        location_id: 'l1',
        is_active: true,
      },
    ],
  }),
}))
vi.mock('../roi', async (orig) => ({
  ...(await orig<typeof import('../roi')>()),
  useRoiData: () => ({ isLoading: false, data: { services: [], revenue: [] } }),
}))
vi.mock('../plans', async (orig) => ({
  ...(await orig<typeof import('../plans')>()),
  useConversionPlans: () => ({ isLoading: false, data: [] }),
  useSaveConversion: () => ({ mutate: saveConversion, isPending: false }),
  useDeleteConversion: () => ({ mutate: vi.fn() }),
  useCoreDoctors: () => ({
    data: [
      {
        id: 'c1',
        doctor_id: 'd1',
        doctor_name: 'Dr Surendran',
        speciality: 'MS',
        area: 'Madurai',
        location_id: 'l1',
      },
    ],
  }),
  useCoreCoverage: () => ({ data: { c1: { MR: 'Nowfal' } }, dataUpdatedAt: 1 }),
  useAddCoreDoctor: () => ({ mutate: vi.fn() }),
  useRemoveCoreDoctor: () => ({ mutate: vi.fn() }),
  useSetCoverage: () => ({ mutate: setCell }),
}))

const page = () =>
  render(
    <MemoryRouter>
      <DoctorPlansPage />
    </MemoryRouter>,
  )

describe('Doctor plans', () => {
  beforeEach(() => {
    saveConversion.mockClear()
    setCell.mockClear()
  })

  it('adds a doctor to the conversion plan, filling the details from the doctor record', async () => {
    page()
    await userEvent.click(screen.getByRole('button', { name: /Add doctor to plan/ }))
    await userEvent.click(screen.getByRole('button', { name: /Select doctor/ }))
    await userEvent.click(await screen.findByText('Dr Surendran'))
    await userEvent.type(screen.getByLabelText('No. of visits'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(saveConversion).toHaveBeenCalledTimes(1)
    expect(saveConversion.mock.calls[0][0]).toMatchObject({
      managerId: 'm1',
      draft: {
        doctor_id: 'd1',
        doctor_name: 'Dr Surendran',
        hospital: 'MSMCH',
        speciality: 'MS',
        location_id: 'l1',
        visits: 2,
      },
    })
  })

  it('will not save a plan without a doctor', async () => {
    page()
    await userEvent.click(screen.getByRole('button', { name: /Add doctor to plan/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(saveConversion).not.toHaveBeenCalled()
  })

  it('core coverage saves a name when you leave the box, and only if it changed', async () => {
    page()
    await userEvent.click(screen.getByRole('tab', { name: 'Core Dr Coverage' }))
    expect(screen.getByLabelText('MR — Dr Surendran')).toHaveValue('Nowfal')
    const abm = screen.getByLabelText('ABM — Dr Surendran')
    await userEvent.click(abm)
    await userEvent.tab()
    expect(setCell).not.toHaveBeenCalled()
    await userEvent.type(abm, 'Priya')
    await userEvent.tab()
    expect(setCell).toHaveBeenCalledTimes(1)
    expect(setCell.mock.calls[0][0]).toMatchObject({
      coreDoctorId: 'c1',
      role: 'ABM',
      name: 'Priya',
    })
  })
})
