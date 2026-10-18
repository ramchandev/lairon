export type UserRole = 'admin' | 'staff' | 'driver' | 'manager'

export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/admin',
  staff: '/staff',
  driver: '/driver',
  manager: '/m',
}

export const TIMEZONE = 'Asia/Kolkata'
