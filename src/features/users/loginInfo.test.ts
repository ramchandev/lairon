import { loginInfoText } from './loginInfo'

describe('loginInfoText', () => {
  it('has the login URL, username (email) and password on their own lines', () => {
    const t = loginInfoText({
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
  it('copes with a missing name', () => {
    expect(loginInfoText({ name: ' ', url: 'u', email: 'e', password: 'p' })).toMatch(/^Hi there,/)
  })
})
