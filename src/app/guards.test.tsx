import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthState, type Profile } from './AuthProvider'
import { RequireRole } from './guards'

const base: AuthState = {
  session: null,
  profile: null,
  loading: false,
  blocked: false,
  signOut: async () => {},
  refreshProfile: async () => {},
}
const prof = (role: Profile['role'], is_active = true) =>
  ({
    id: '1',
    role,
    full_name: 'T',
    phone: '+919876543210',
    email: null,
    area: null,
    hq: null,
    bio: null,
    avatar_url: null,
    is_active,
  }) as Profile

function renderAt(state: AuthState, path: string) {
  return render(
    <AuthContext.Provider value={state}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<div>login</div>} />
          <Route path="/driver" element={<div>driver home</div>} />
          <Route path="/admin" element={<RequireRole role="admin" />}>
            <Route index element={<div>admin home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
const session = { user: { id: '1' } } as AuthState['session']

describe('RequireRole', () => {
  it('sends anonymous users to login', () => {
    renderAt(base, '/admin')
    expect(screen.getByText('login')).toBeInTheDocument()
  })
  it('lets the right role in', () => {
    renderAt({ ...base, session, profile: prof('admin') }, '/admin')
    expect(screen.getByText('admin home')).toBeInTheDocument()
  })
  it('redirects a driver away from admin to their own home', () => {
    renderAt({ ...base, session, profile: prof('driver') }, '/admin')
    expect(screen.getByText('driver home')).toBeInTheDocument()
  })
  it('blocks deactivated users', () => {
    renderAt({ ...base, session, profile: prof('admin', false) }, '/admin')
    expect(screen.getByText('login')).toBeInTheDocument()
  })
})
