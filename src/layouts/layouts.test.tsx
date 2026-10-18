import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom'
import { ChromeProvider, type RouteHandle } from './chrome'
import { AdminLayout } from './AdminLayout'
import { DriverLayout, ManagerLayout } from './RoleLayouts'

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => ({
    profile: { full_name: 'Admin User', email: 'admin@lairon.in', avatar_url: null, role: 'admin' },
    signOut: vi.fn(),
  }),
}))
vi.mock('@/features/dashboard/api', () => ({
  useDashboard: () => ({
    data: { pending_service_requests: 3, pending_starter_packs: 2, pending_leave_requests: 1 },
  }),
}))
vi.mock('@/features/service-requests/api', () => ({
  useDraftBatch: () => ({ data: { services: [{}, {}] } }),
}))

const page = (title: string, extra: Partial<RouteHandle> = {}) => ({
  handle: { title, ...extra },
  element: <div>{title} body</div>,
})
function mount(layout: React.ReactNode, path: string, children: RouteObject[], at: string) {
  const router = createMemoryRouter(
    [{ path, element: <ChromeProvider>{layout}</ChromeProvider>, children }],
    { initialEntries: [at] },
  )
  return render(<RouterProvider router={router} />)
}
const adminRoutes: RouteObject[] = [
  { index: true, ...page('Dashboard') },
  { path: 'drivers', ...page('Drivers') },
  { path: 'staff', ...page('Staffs') },
  { path: 'vehicles/new', ...page('Add Vehicle', { sub: true, back: '/admin/vehicles' }) },
]

describe('AdminLayout', () => {
  it('shows the grouped sidebar with the approved labels, counts and the signed-in user', () => {
    mount(<AdminLayout />, '/admin', adminRoutes, '/admin')
    const side = screen.getByLabelText('Main navigation')
    expect(
      within(side)
        .getAllByRole('heading', { level: 6, hidden: true })
        .map((h) => h.textContent),
    ).toEqual(['Overview', 'Operations', 'People', 'Masters'])
    expect(
      within(side)
        .getAllByRole('link', { hidden: true })
        .map((a) => a.textContent),
    ).toEqual([
      'LLAIRON EZAdmin portal',
      'Dashboard',
      'Service Requests3',
      'Starter Packs2',
      'Trip Duty1',
      'Drivers',
      'Staffs',
      'Managers',
      'Doctors',
      'Super Admins',
      'Vehicles',
      'Divisions',
      'Products',
      'Dropdowns',
      'Admin Useradmin@lairon.in',
    ])
    expect(within(side).getByRole('link', { name: 'Dashboard', hidden: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('has a 5-tab bottom bar and marks "More" active on the pages it leads to', () => {
    mount(<AdminLayout />, '/admin', adminRoutes, '/admin/staff')
    const bar = screen.getByRole('navigation', { name: 'Primary' })
    expect(
      within(bar)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Home', 'Requests', 'Starter', 'Duties', 'More'])
    expect(within(bar).getByRole('link', { name: 'More' })).toHaveAttribute('aria-current', 'page')
    expect(within(bar).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('shows the breadcrumb "Admin › Section" on main pages', () => {
    mount(<AdminLayout />, '/admin', adminRoutes, '/admin/staff')
    expect(screen.getByText('Admin', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getAllByText('Staffs', { selector: 'b' })).toHaveLength(1)
  })

  it('on a sub-page: ← and the title replace the brand, and the bottom bar is hidden', () => {
    mount(<AdminLayout />, '/admin', adminRoutes, '/admin/vehicles/new')
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Add Vehicle' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
  })

  it('asks before signing out', async () => {
    mount(<AdminLayout />, '/admin', adminRoutes, '/admin')
    await userEvent.click(screen.getAllByRole('button', { name: 'Sign out', hidden: true })[0])
    expect(screen.getByRole('dialog', { name: 'Sign out?' })).toBeInTheDocument()
  })
})

describe('role apps', () => {
  const driverRoutes: RouteObject[] = [
    { index: true, ...page('Today') },
    { path: 'leave', ...page('Apply leave', { sub: true, back: '/driver' }) },
  ]
  it('driver: brand + "Driver", three tabs, no sidebar', () => {
    mount(<DriverLayout />, '/driver', driverRoutes, '/driver')
    expect(screen.getByText('Driver', { selector: 'small' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Primary' }))
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Today', 'My Duties', 'Profile'])
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
  })
  it('driver sub-page hides the bottom bar and shows ← + title', () => {
    mount(<DriverLayout />, '/driver', driverRoutes, '/driver/leave')
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Apply leave' })).toBeInTheDocument()
  })
  it('manager: four tabs and a draft badge on New Request', () => {
    mount(<ManagerLayout />, '/m', [{ index: true, ...page('My Doctors') }], '/m')
    expect(screen.getByText("Doctor's Manager", { selector: 'small' })).toBeInTheDocument()
    const bar = screen.getByRole('navigation', { name: 'Primary' })
    expect(
      within(bar)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['My Doctors', 'New Request2', 'My Requests', 'Profile'])
    expect(within(bar).getByLabelText('2 in draft')).toBeInTheDocument()
  })
})
