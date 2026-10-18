import type { UserRole } from '@/lib/constants'

/** Where the doctor screens live for each role. */
export const doctorPaths = (role: UserRole) => {
  const admin = role === 'admin'
  return {
    list: admin ? '/admin/doctors' : '/m',
    detail: (id: string) => (admin ? `/admin/doctors/${id}` : `/m/doctors/${id}`),
    edit: (id: string) => (admin ? `/admin/doctors/${id}/edit` : `/m/doctors/${id}/edit`),
    create: admin ? '/admin/doctors/new' : '/m/doctors/new',
  }
}
