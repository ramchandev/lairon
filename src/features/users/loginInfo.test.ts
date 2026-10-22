import { loginInfoText } from './loginInfo'

describe('loginInfoText', () => {
  it('has the login URL, username (email) and password on their own lines', () => {
    const t = loginInfoText({
      role: 'driver',
      name: 'Ravikumar N',
      url: 'https://lairon-omega.vercel.app',
      email: 'ravikumar@lairon.in',
      password: 'Ab3$kLm9xQ2@',
    })
    expect(t).toContain('Hi Ravikumar,')
    expect(t).toContain('Login URL: https://lairon-omega.vercel.app\n')
    expect(t).toContain('Username: ravikumar@lairon.in\n')
    expect(t).toContain('Password: Ab3$kLm9xQ2@\n')
  })
  it('is worded for the staff role', () => {
    const t = loginInfoText({ role: 'staff', name: 'Karthik', url: 'u', email: 'e', password: 'p' })
    expect(t).toContain('staff account')
    expect(t).toContain('New Pack')
  })
  it('copes with a missing name', () => {
    expect(
      loginInfoText({ role: 'staff', name: ' ', url: 'u', email: 'e', password: 'p' }),
    ).toMatch(/^Hi there,/)
  })
})
