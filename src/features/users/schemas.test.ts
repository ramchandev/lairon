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
  it('applies to staff and managers too, but not to super admins (they get an invite)', () => {
    for (const r of ['staff', 'manager'] as const) {
      expect(userSchema(r).safeParse(driver).success).toBe(false)
      expect(userSchema(r).safeParse({ ...driver, password: 'longenough' }).success).toBe(true)
    }
    expect(userSchema('admin').safeParse(driver).success).toBe(true)
  })
})

describe('userSchema', () => {
  it('requires email for staff and driver', () => {
    expect(userSchema('staff').safeParse(base).success).toBe(false)
    expect(userSchema('driver').safeParse(base).success).toBe(false)
    expect(
      userSchema('staff').safeParse({ ...base, email: 'a@b.in', password: 'longenough' }).success,
    ).toBe(true)
  })
  it('requires a valid email for managers too (they sign in like everyone else)', () => {
    const m = { ...base, password: 'longenough' }
    expect(userSchema('manager').safeParse(m).success).toBe(false)
    expect(userSchema('manager').safeParse({ ...m, email: 'nope' }).success).toBe(false)
    expect(userSchema('manager').safeParse({ ...m, email: 'm@lairon.in' }).success).toBe(true)
  })
  it('rejects a bad phone', () => {
    expect(userSchema('staff').safeParse({ ...base, phone: '12345' }).success).toBe(false)
  })
})
