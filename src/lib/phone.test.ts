import { formatPhone, normalizePhone } from './phone'

describe('normalizePhone', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
  ])('accepts %s', (input, out) => expect(normalizePhone(input)).toBe(out))

  it.each(['', '12345', '5876543210', '98765432101', 'abcdefghij'])('rejects %s', (input) =>
    expect(normalizePhone(input)).toBeNull(),
  )
  it('formats for display', () => expect(formatPhone('+919876543210')).toBe('+91 98765 43210'))
})
