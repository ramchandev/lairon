import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppRoot } from './AppRoot'
import { HomeRedirect, RequireRole } from './guards'
import { RouteError } from './RouteError'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { DriverLayout, ManagerLayout, StaffLayout } from '@/layouts/RoleLayouts'
import type { RouteHandle } from '@/layouts/chrome'
import { LoginPage } from '@/features/auth/LoginPage'

/**
 * Route-level code splitting: a page's code is only downloaded when someone opens it, so the first load
 * (the login screen) stays small. `page(() => import('…'), 'ExportName')`.
 */
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) => ({
  lazy: async () => ({ Component: (await load())[name] }),
})

/**
 * Route chrome (see layouts/chrome.tsx), worded exactly as in design/lairon-ez-prototype.html:
 * `h` = a main page (its title feeds the breadcrumb); `sub` = a form/detail page (← and the title in the top bar, no bottom bar).
 */
const h = (title: string) => ({ handle: { title } as RouteHandle })
const sub = (title: string, back: string) => ({ handle: { title, sub: true, back } as RouteHandle })

export const router = createBrowserRouter([
  {
    element: <AppRoot />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <HomeRedirect /> },
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          {
            path: '/set-password',
            ...page(() => import('@/features/auth/SetPasswordPage'), 'SetPasswordPage'),
          },
        ],
      },
      {
        element: <RequireRole role="admin" />,
        children: [
          {
            path: '/admin',
            element: <AdminLayout />,
            children: [
              {
                index: true,
                ...h('Dashboard'),
                ...page(() => import('@/features/dashboard/pages/DashboardPage'), 'DashboardPage'),
              },
              {
                path: 'more',
                ...h('More'),
                ...page(() => import('@/features/dashboard/pages/MorePage'), 'MorePage'),
              },
              {
                path: 'service-requests',
                ...h('Service Requests'),
                ...page(
                  () => import('@/features/service-requests/pages/AdminRequestsPage'),
                  'AdminRequestsPage',
                ),
              },
              {
                path: 'service-requests/:id',
                ...sub('Service Request', '/admin/service-requests'),
                ...page(
                  () => import('@/features/service-requests/pages/AdminRequestDetailPage'),
                  'AdminRequestDetailPage',
                ),
              },
              {
                path: 'starter-packs',
                ...h('Starter Packs'),
                ...page(
                  () => import('@/features/starter-packs/pages/AdminPacksPage'),
                  'AdminPacksPage',
                ),
              },
              {
                path: 'starter-packs/new',
                ...sub('New Starter Pack', '/admin/starter-packs'),
                ...page(
                  () => import('@/features/starter-packs/pages/StarterPackFormPage'),
                  'StarterPackFormPage',
                ),
              },
              {
                path: 'starter-packs/:id',
                ...sub('Starter Pack', '/admin/starter-packs'),
                ...page(
                  () => import('@/features/starter-packs/pages/AdminPackDetailPage'),
                  'AdminPackDetailPage',
                ),
              },
              {
                path: 'trip-duty',
                ...h('Trip Duty'),
                ...page(
                  () => import('@/features/trip-duty/pages/AdminTripDutyPage'),
                  'AdminTripDutyPage',
                ),
              },
              {
                path: 'trip-duty/entries/new',
                ...sub('Add duty', '/admin/trip-duty'),
                ...page(
                  () => import('@/features/trip-duty/pages/AdminEntryFormPage'),
                  'AdminEntryFormPage',
                ),
              },
              {
                path: 'trip-duty/entries/:id/edit',
                ...sub('Edit duty', '/admin/trip-duty'),
                ...page(
                  () => import('@/features/trip-duty/pages/AdminEntryFormPage'),
                  'AdminEntryFormPage',
                ),
              },
              {
                path: 'trip-duty/beta-rates',
                ...sub('Beta rates', '/admin/trip-duty?tab=beta'),
                ...page(() => import('@/features/trip-duty/pages/BetaRatesPage'), 'BetaRatesPage'),
              },
              {
                path: 'trip-duty/import',
                ...sub('Import duties', '/admin/trip-duty'),
                ...page(
                  () => import('@/features/trip-duty/pages/DutyImportPage'),
                  'DutyImportPage',
                ),
              },
              {
                path: 'drivers',
                ...h('Drivers'),
                ...page(() => import('@/features/users/pages/UsersPage'), 'DriversPage'),
              },
              {
                path: 'staff',
                ...h('Staffs'),
                ...page(() => import('@/features/users/pages/UsersPage'), 'StaffPage'),
              },
              {
                path: 'managers',
                ...h('Managers'),
                ...page(() => import('@/features/users/pages/UsersPage'), 'ManagersPage'),
              },
              {
                path: 'super-admins',
                ...h('Super Admins'),
                ...page(() => import('@/features/users/pages/UsersPage'), 'SuperAdminsPage'),
              },
              // Old links (/admin/users?tab=driver) keep working.
              {
                path: 'users',
                ...h('Users'),
                ...page(() => import('@/features/users/pages/UsersPage'), 'UsersRedirect'),
              },
              {
                path: 'users/new',
                ...sub('Add User', '/admin/staff'),
                ...page(() => import('@/features/users/pages/UserFormPage'), 'UserFormPage'),
              },
              {
                path: 'users/:id/edit',
                ...sub('Edit User', '/admin/staff'),
                ...page(() => import('@/features/users/pages/UserFormPage'), 'UserFormPage'),
              },
              {
                path: 'doctors',
                ...h('Doctors'),
                ...page(
                  () => import('@/features/doctors/pages/AdminDoctorsPage'),
                  'AdminDoctorsPage',
                ),
              },
              {
                path: 'doctors/new',
                ...sub('Add Doctor', '/admin/doctors'),
                ...page(() => import('@/features/doctors/pages/DoctorFormPage'), 'DoctorFormPage'),
              },
              {
                path: 'doctors/:id',
                ...sub('Doctor', '/admin/doctors'),
                ...page(
                  () => import('@/features/doctors/pages/DoctorDetailPage'),
                  'DoctorDetailPage',
                ),
              },
              {
                path: 'doctors/:id/edit',
                ...sub('Edit Doctor', '/admin/doctors'),
                ...page(() => import('@/features/doctors/pages/DoctorFormPage'), 'DoctorFormPage'),
              },
              {
                path: 'vehicles',
                ...h('Vehicles'),
                ...page(() => import('@/features/vehicles/pages/VehiclesPage'), 'VehiclesPage'),
              },
              {
                path: 'vehicles/new',
                ...sub('Add Vehicle', '/admin/vehicles'),
                ...page(
                  () => import('@/features/vehicles/pages/VehicleFormPage'),
                  'VehicleFormPage',
                ),
              },
              {
                path: 'vehicles/:id/edit',
                ...sub('Edit Vehicle', '/admin/vehicles'),
                ...page(
                  () => import('@/features/vehicles/pages/VehicleFormPage'),
                  'VehicleFormPage',
                ),
              },
              {
                path: 'divisions',
                ...h('Divisions'),
                ...page(() => import('@/features/divisions/pages/DivisionsPage'), 'DivisionsPage'),
              },
              {
                path: 'divisions/new',
                ...sub('Add Division', '/admin/divisions'),
                ...page(
                  () => import('@/features/divisions/pages/DivisionFormPage'),
                  'DivisionFormPage',
                ),
              },
              {
                path: 'divisions/:id/edit',
                ...sub('Edit Division', '/admin/divisions'),
                ...page(
                  () => import('@/features/divisions/pages/DivisionFormPage'),
                  'DivisionFormPage',
                ),
              },
              {
                path: 'products',
                ...h('Products'),
                ...page(() => import('@/features/products/pages/ProductsPage'), 'ProductsPage'),
              },
              {
                path: 'products/new',
                ...sub('Add Product', '/admin/products'),
                ...page(
                  () => import('@/features/products/pages/ProductFormPage'),
                  'ProductFormPage',
                ),
              },
              {
                path: 'products/import',
                ...sub('Import products', '/admin/products'),
                ...page(
                  () => import('@/features/products/pages/ProductImportPage'),
                  'ProductImportPage',
                ),
              },
              {
                path: 'products/:id/edit',
                ...sub('Edit Product', '/admin/products'),
                ...page(
                  () => import('@/features/products/pages/ProductFormPage'),
                  'ProductFormPage',
                ),
              },
              {
                path: 'dropdowns',
                ...h('Dropdowns'),
                ...page(() => import('@/features/lookups/pages/DropdownsPage'), 'DropdownsPage'),
              },
              {
                path: 'dropdowns/new-list',
                ...sub('New dropdown list', '/admin/dropdowns'),
                ...page(() => import('@/features/lookups/pages/ListFormPage'), 'ListFormPage'),
              },
              {
                path: 'dropdowns/:key/settings',
                ...sub('List settings', '/admin/dropdowns'),
                ...page(() => import('@/features/lookups/pages/ListFormPage'), 'ListFormPage'),
              },
              {
                path: 'dropdowns/:key/items/new',
                ...sub('Add item', '/admin/dropdowns'),
                ...page(() => import('@/features/lookups/pages/ItemFormPage'), 'ItemFormPage'),
              },
              {
                path: 'dropdowns/:key/items/:id/edit',
                ...sub('Edit item', '/admin/dropdowns'),
                ...page(() => import('@/features/lookups/pages/ItemFormPage'), 'ItemFormPage'),
              },
              {
                path: 'settings',
                ...h('Settings'),
                ...page(() => import('@/features/settings/pages/SettingsPage'), 'SettingsPage'),
              },
              {
                path: 'email-log',
                ...h('Email Log'),
                ...page(() => import('@/features/email/pages/EmailLogPage'), 'EmailLogPage'),
              },
              {
                path: 'profile',
                ...h('Profile'),
                ...page(() => import('@/features/auth/ProfilePage'), 'ProfilePage'),
              },
            ],
          },
        ],
      },
      {
        element: <RequireRole role="staff" />,
        children: [
          {
            path: '/staff',
            element: <StaffLayout />,
            children: [
              {
                index: true,
                ...h('Home'),
                ...page(
                  () => import('@/features/starter-packs/pages/StaffHomePage'),
                  'StaffHomePage',
                ),
              },
              {
                path: 'new',
                ...sub('New starter pack', '/staff'),
                ...page(
                  () => import('@/features/starter-packs/pages/StarterPackFormPage'),
                  'StarterPackFormPage',
                ),
              },
              {
                path: 'requests',
                ...h('My Requests'),
                ...page(() => import('@/features/starter-packs/pages/MyPacksPage'), 'MyPacksPage'),
              },
              {
                path: 'requests/:id',
                ...sub('Starter pack', '/staff/requests'),
                ...page(
                  () => import('@/features/starter-packs/pages/PackDetailPage'),
                  'PackDetailPage',
                ),
              },
              {
                path: 'directory',
                ...h('Staff directory'),
                ...page(
                  () => import('@/features/users/pages/StaffDirectoryPage'),
                  'StaffDirectoryPage',
                ),
              },
              {
                path: 'profile',
                ...h('Profile'),
                ...page(() => import('@/features/auth/ProfilePage'), 'ProfilePage'),
              },
            ],
          },
        ],
      },
      {
        element: <RequireRole role="driver" />,
        children: [
          {
            path: '/driver',
            element: <DriverLayout />,
            children: [
              {
                index: true,
                ...h('Today'),
                ...page(() => import('@/features/trip-duty/pages/TodayPage'), 'TodayPage'),
              },
              {
                path: 'duty/new',
                ...sub('Start duty', '/driver'),
                ...page(() => import('@/features/trip-duty/pages/DutyFormPage'), 'DutyFormPage'),
              },
              {
                path: 'duty/edit/:id',
                ...sub('Edit duty', '/driver/month'),
                ...page(() => import('@/features/trip-duty/pages/DutyFormPage'), 'DutyFormPage'),
              },
              {
                path: 'duty/close/:id',
                ...sub('Close duty', '/driver'),
                ...page(() => import('@/features/trip-duty/pages/CloseDutyPage'), 'CloseDutyPage'),
              },
              {
                path: 'weekoff',
                ...sub('Week off', '/driver'),
                ...page(() => import('@/features/trip-duty/pages/WeekOffPage'), 'WeekOffPage'),
              },
              {
                path: 'leave',
                ...sub('Apply leave', '/driver'),
                ...page(() => import('@/features/trip-duty/pages/LeavePage'), 'LeavePage'),
              },
              {
                path: 'month',
                ...h('My Duties'),
                ...page(() => import('@/features/trip-duty/pages/MyDutiesPage'), 'MyDutiesPage'),
              },
              {
                path: 'profile',
                ...h('Profile'),
                ...page(() => import('@/features/auth/ProfilePage'), 'ProfilePage'),
              },
            ],
          },
        ],
      },
      {
        element: <RequireRole role="manager" />,
        children: [
          {
            path: '/m',
            element: <ManagerLayout />,
            children: [
              {
                index: true,
                ...h('My Doctors'),
                ...page(() => import('@/features/doctors/pages/MyDoctorsPage'), 'MyDoctorsPage'),
              },
              {
                path: 'doctors/new',
                ...sub('Add doctor', '/m'),
                ...page(() => import('@/features/doctors/pages/DoctorFormPage'), 'DoctorFormPage'),
              },
              {
                path: 'doctors/:id',
                ...sub('Doctor', '/m'),
                ...page(
                  () => import('@/features/doctors/pages/DoctorDetailPage'),
                  'DoctorDetailPage',
                ),
              },
              {
                path: 'doctors/:id/edit',
                ...sub('Edit doctor', '/m'),
                ...page(() => import('@/features/doctors/pages/DoctorFormPage'), 'DoctorFormPage'),
              },
              {
                path: 'request',
                ...h('New Request'),
                ...page(
                  () => import('@/features/service-requests/pages/DraftRequestPage'),
                  'DraftRequestPage',
                ),
              },
              {
                path: 'request/add',
                ...sub('Add service', '/m/request'),
                ...page(
                  () => import('@/features/service-requests/pages/ServiceFormPage'),
                  'ServiceFormPage',
                ),
              },
              {
                path: 'request/edit/:id',
                ...sub('Edit service', '/m/request'),
                ...page(
                  () => import('@/features/service-requests/pages/ServiceFormPage'),
                  'ServiceFormPage',
                ),
              },
              {
                path: 'requests',
                ...h('My Requests'),
                ...page(
                  () => import('@/features/service-requests/pages/MyRequestsPage'),
                  'MyRequestsPage',
                ),
              },
              {
                path: 'requests/view/:id',
                ...sub('Service request', '/m/requests'),
                ...page(
                  () => import('@/features/service-requests/pages/RequestViewPage'),
                  'RequestViewPage',
                ),
              },
              {
                path: 'requests/done/:id',
                ...h('Submitted'),
                ...page(
                  () => import('@/features/service-requests/pages/RequestDonePage'),
                  'RequestDonePage',
                ),
              },
              {
                path: 'profile',
                ...h('Profile'),
                ...page(() => import('@/features/auth/ProfilePage'), 'ProfilePage'),
              },
            ],
          },
        ],
      },
      { path: '*', element: <HomeRedirect /> },
    ],
  },
])
