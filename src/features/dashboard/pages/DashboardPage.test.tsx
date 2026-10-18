import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from './DashboardPage'

const kpi = {
  month: '2026-10',
  pending_service_requests: 3,
  pending_starter_packs: 5,
  drivers_on_duty_now: 2,
  drivers_with_duty_today: 4,
  pending_leave_requests: 1,
  pending_leave_days: 3,
  beta_total: 17600,
  beta_payable_days: 68,
  total_km: 12345,
  fuel_amount: 45000,
  fuel_litres: 410.5,
  drivers_total: 6,
  sr_value_by_month: [
    { m: '2026-05', v: 380000 },
    { m: '2026-06', v: 420000 },
    { m: '2026-07', v: 310000 },
    { m: '2026-08', v: 520000 },
    { m: '2026-09', v: 465000 },
    { m: '2026-10', v: 275000 },
  ],
  attention_total: 2,
  attention: [
    {
      kind: 'request',
      id: 'r1',
      title: 'SR-2610-0001 · Mgr One',
      sub: '2 service(s) · ₹40,000',
      status: 'submitted',
      at: '2026-10-18T05:00:00Z',
    },
    {
      kind: 'leave',
      id: 'l1',
      title: 'Ravi · Casual leave',
      sub: '20 Oct 2026',
      status: 'pending',
      at: '2026-10-17T05:00:00Z',
    },
  ],
  drivers_today: [
    {
      id: 'd1',
      name: 'Ravi Kumar',
      avatar_url: null,
      state: 'duty',
      duty_type: 'Local',
      vehicle: 'CRYSTA 6435',
      pickup: 'Office',
      drop: 'Airport',
    },
    {
      id: 'd2',
      name: 'Suresh Babu',
      avatar_url: null,
      state: 'none',
      duty_type: null,
      vehicle: null,
      pickup: null,
      drop: null,
    },
  ],
}
vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => ({ profile: { full_name: 'Priya Sharma' } }),
}))
vi.mock('../api', () => ({
  useDashboard: () => ({ data: kpi, isLoading: false, isError: false }),
  useActivity: () => ({
    isLoading: false,
    data: [
      {
        id: '1',
        at: new Date().toISOString(),
        kind: 'request',
        text: 'Mgr One submitted service request SR-2610-0001',
        to: '/admin/service-requests/abc',
      },
    ],
  }),
}))

const setup = () =>
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
const card = (label: string) => screen.getByRole('link', { name: new RegExp(label) })

describe('Admin dashboard', () => {
  it('shows every KPI with its number and subtext', () => {
    setup()
    expect(screen.getByText(/October 2026 so far/)).toBeInTheDocument()
    expect(within(card('Pending service requests')).getByText('3')).toBeInTheDocument()
    expect(within(card('Pending starter packs')).getByText('5')).toBeInTheDocument()
    expect(within(card('Drivers on duty')).getByText('4/6')).toBeInTheDocument()
    expect(within(card('Drivers on duty')).getByText(/2 on the road now/)).toBeInTheDocument()
    expect(within(card('Leave requests')).getByText('1')).toBeInTheDocument()
    expect(within(card('Leave requests')).getByText(/3 days/)).toBeInTheDocument()
    expect(within(card('Chauffeur beta')).getByText('₹17,600')).toBeInTheDocument()
    expect(within(card('Chauffeur beta')).getByText('October · 12,345 km')).toBeInTheDocument()
    expect(within(card('Fuel spend')).getByText('₹45,000')).toBeInTheDocument()
    expect(within(card('Fuel spend')).getByText('October 2026')).toBeInTheDocument()
  })

  it('lists what needs attention, the six-month chart and the drivers today', () => {
    setup()
    expect(screen.getByText('2 open')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /SR-2610-0001 · Mgr One/ })).toHaveAttribute(
      'href',
      '/admin/service-requests/r1',
    )
    expect(screen.getByRole('link', { name: /Ravi · Casual leave/ })).toHaveAttribute(
      'href',
      '/admin/trip-duty?tab=leave',
    )
    expect(screen.getByRole('img', { name: 'Service request value by month' })).toBeInTheDocument()
    expect(screen.getByText('520')).toBeInTheDocument()
    expect(screen.getByText('CRYSTA 6435 · Office → Airport')).toBeInTheDocument()
    expect(screen.getByText('Not started')).toBeInTheDocument()
  })

  it('each card opens the matching filtered list', () => {
    setup()
    expect(card('Pending service requests')).toHaveAttribute(
      'href',
      '/admin/service-requests?status=submitted',
    )
    expect(card('Pending starter packs')).toHaveAttribute(
      'href',
      '/admin/starter-packs?status=pending',
    )
    expect(card('Leave requests')).toHaveAttribute('href', '/admin/trip-duty?tab=leave')
    expect(card('Chauffeur beta')).toHaveAttribute('href', '/admin/trip-duty?tab=beta&m=2026-10')
    expect(card('Fuel spend')).toHaveAttribute('href', '/admin/trip-duty?tab=all&m=2026-10')
  })

  it('offers the quick actions and the activity feed links to the item', () => {
    setup()
    expect(screen.getByRole('link', { name: /Add Staff/ })).toHaveAttribute(
      'href',
      '/admin/users/new?role=staff',
    )
    expect(screen.getByRole('link', { name: /Add Driver/ })).toHaveAttribute(
      'href',
      '/admin/users/new?role=driver',
    )
    expect(screen.getByRole('link', { name: /Add Manager/ })).toHaveAttribute(
      'href',
      '/admin/users/new?role=manager',
    )
    expect(screen.getByRole('link', { name: /Add Product/ })).toHaveAttribute(
      'href',
      '/admin/products/new',
    )
    expect(
      screen.getByRole('link', { name: /Mgr One submitted service request SR-2610-0001/ }),
    ).toHaveAttribute('href', '/admin/service-requests/abc')
  })
})
