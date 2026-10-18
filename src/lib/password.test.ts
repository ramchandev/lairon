import { generatePassword } from './password'

describe('generatePassword', () => {
  it('is 12 characters by default and mixes all four kinds', () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword()
      expect(p).toHaveLength(12)
      expect(p).toMatch(/[a-z]/)
      expect(p).toMatch(/[A-Z]/)
      expect(p).toMatch(/\d/)
      expect(p).toMatch(/[@#$%&*]/)
      expect(p).not.toMatch(/[lIO01]/)
    }
  })
  it('honours a longer length and differs between calls', () => {
    expect(generatePassword(20)).toHaveLength(20)
    expect(new Set(Array.from({ length: 20 }, () => generatePassword())).size).toBe(20)
  })
})
