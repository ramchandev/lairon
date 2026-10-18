import { userSchema } from './schemas'

const base = { full_name: 'Asha', phone: '98765 43210', email: '', area: '', hq: '', bio: '' }

describe('userSchema', () => {
  it('requires email for staff and driver', () => {
    expect(userSchema('staff').safeParse(base).success).toBe(false)
    expect(userSchema('driver').safeParse(base).success).toBe(false)
    expect(userSchema('staff').safeParse({ ...base, email: 'a@b.in' }).success).toBe(true)
  })
  it('makes email optional for managers but validates it when present', () => {
    expect(userSchema('manager').safeParse(base).success).toBe(true)
    expect(userSchema('manager').safeParse({ ...base, email: 'nope' }).success).toBe(false)
  })
  it('rejects a bad phone', () => {
    expect(userSchema('manager').safeParse({ ...base, phone: '12345' }).success).toBe(false)
  })
})
