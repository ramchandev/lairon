import { userSchema } from './schemas'

const base = {
  full_name: 'Asha',
  phone: '98765 43210',
  email: '',
  area: '',
  hq: '',
  bio: '',
  password: '',
}

describe('driver password', () => {
  const driver = { ...base, email: 'd@x.in' }
  it('is required (8+ characters) when adding a driver', () => {
    expect(userSchema('driver').safeParse(driver).success).toBe(false)
    expect(userSchema('driver').safeParse({ ...driver, password: 'short' }).success).toBe(false)
    expect(userSchema('driver').safeParse({ ...driver, password: 'longenough' }).success).toBe(true)
  })
  it('is optional when editing, but still 8+ if filled', () => {
    expect(userSchema('driver', true).safeParse(driver).success).toBe(true)
    expect(userSchema('driver', true).safeParse({ ...driver, password: 'abc' }).success).toBe(false)
  })
  it('is not needed for other roles', () => {
    expect(userSchema('staff').safeParse({ ...driver }).success).toBe(true)
  })
})

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
