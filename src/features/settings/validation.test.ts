import { validateCompany, validateWindow } from './validation'

describe('settings validation', () => {
  it('accepts whole days from 1 to 60 only', () => {
    expect(validateWindow('7')).toBeNull()
    expect(validateWindow(' 60 ')).toBeNull()
    expect(validateWindow('0')).toMatch(/between 1 and 60/)
    expect(validateWindow('61')).toMatch(/between 1 and 60/)
    expect(validateWindow('')).toMatch(/whole number/)
    expect(validateWindow('7.5')).toMatch(/whole number/)
    expect(validateWindow('-3')).toMatch(/whole number/)
  })
  it('requires a company name of sensible length', () => {
    expect(validateCompany('LAIRON')).toBeNull()
    expect(validateCompany('   ')).toMatch(/required/)
    expect(validateCompany('x'.repeat(81))).toMatch(/under 80/)
  })
})
