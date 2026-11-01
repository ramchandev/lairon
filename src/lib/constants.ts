export type UserRole = 'admin' | 'staff' | 'driver' | 'manager'

export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/admin',
  staff: '/staff',
  driver: '/driver',
  manager: '/m/requests', // a manager lands on My Requests
}

export const TIMEZONE = 'Asia/Kolkata'
