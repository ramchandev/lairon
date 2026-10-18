import { passwordSchema, profileSchema } from './schemas'

describe('auth schemas', () => {
  it('rejects short or mismatched passwords', () => {
    expect(passwordSchema.safeParse({ password: 'short', confirm: 'short' }).success).toBe(false)
    expect(
      passwordSchema.safeParse({ password: 'longenough1', confirm: 'different1' }).success,
    ).toBe(false)
    expect(
      passwordSchema.safeParse({ password: 'longenough1', confirm: 'longenough1' }).success,
    ).toBe(true)
  })
  it('requires a name on the profile', () => {
    expect(profileSchema.safeParse({ full_name: '  ' }).success).toBe(false)
    expect(profileSchema.safeParse({ full_name: 'Asha' }).success).toBe(true)
  })
})
