import type { RouteObject } from 'react-router-dom'
import type { RouteHandle } from '@/layouts/chrome'
import { router } from './router'

type Found = { path: string; handle?: RouteHandle }
function leaves(routes: RouteObject[], base = ''): Found[] {
  return routes.flatMap((r) => {
    const p = r.index ? base : `${base}/${(r.path ?? '').replace(/^\//, '')}`.replace(/\/+/g, '/')
    return r.children
      ? leaves(r.children, r.path?.startsWith('/') ? r.path : p)
      : [{ path: p || '/', handle: r.handle as RouteHandle | undefined }]
  })
}
const all = leaves(router.routes)
const by = (prefix: string) =>
  all.filter((f) => f.path === prefix || f.path.startsWith(`${prefix}/`))
const title = (path: string) => all.find((f) => f.path === path)?.handle

describe('every screen declares its top-bar chrome', () => {
  it.each(['/admin', '/driver', '/m', '/staff'])(
    '%s: every page has a title, and every sub-page a back target',
    (area) => {
      for (const f of by(area)) {
        expect(f.handle?.title, `${f.path} needs a title`).toBeTruthy()
        if (f.handle?.sub)
          expect(f.handle.back, `${f.path} is a sub-page and needs a back target`).toBeTruthy()
      }
    },
  )

  it('uses the approved wording for sub-pages (admin, as in the HTML: "Add Vehicle", "Edit Division" …)', () => {
    expect(title('/admin/vehicles/new')).toMatchObject({ title: 'Add Vehicle', sub: true })
    expect(title('/admin/vehicles/:id/edit')).toMatchObject({ title: 'Edit Vehicle', sub: true })
    expect(title('/admin/divisions/new')?.title).toBe('Add Division')
    expect(title('/admin/products/:id/edit')?.title).toBe('Edit Product')
    expect(title('/admin/doctors/new')?.title).toBe('Add Doctor')
    expect(title('/admin/service-requests/:id')?.title).toBe('Service Request')
    expect(title('/admin/starter-packs/:id')?.title).toBe('Starter Pack')
    expect(title('/admin/trip-duty/beta-rates')?.title).toBe('Beta rates')
    expect(title('/admin/trip-duty/import')?.title).toBe('Import duties')
    expect(title('/admin/dropdowns/new-list')?.title).toBe('New dropdown list')
  })

  it('uses the approved wording in the driver and manager apps', () => {
    expect(title('/driver/duty/new')?.title).toBe('Start duty')
    expect(title('/driver/duty/edit/:id')?.title).toBe('Edit duty')
    expect(title('/driver/duty/close/:id')?.title).toBe('Close duty')
    expect(title('/driver/weekoff')?.title).toBe('Week off')
    expect(title('/driver/leave')?.title).toBe('Apply leave')
    expect(title('/m/doctors/new')?.title).toBe('Add doctor')
    expect(title('/m/doctors/:id/edit')?.title).toBe('Edit doctor')
    expect(title('/m/request/add')?.title).toBe('Add service')
    expect(title('/m/request/edit/:id')?.title).toBe('Edit service')
    expect(title('/m/requests/view/:id')?.title).toBe('Service request')
    expect(title('/m/requests/done/:id')).toMatchObject({ title: 'Submitted' })
    expect(title('/m/requests/done/:id')?.sub).toBeUndefined() // the confirmation keeps the bottom bar, like the HTML
  })
})
