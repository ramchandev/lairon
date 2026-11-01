import { lastDayOf, parseAmount, revenueLocked } from './revenue'

describe('monthly revenue rules', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-01T06:00:00Z')) // 1 Nov, India time
  })
  afterEach(() => vi.useRealTimers())

  it('the current month is editable for a manager', () => {
    expect(revenueLocked('manager', '2026-11', true)).toBe(false)
    expect(revenueLocked('manager', '2026-11', false)).toBe(false)
  })
  it('on 1 Nov, October is frozen once it has an entry …', () => {
    expect(revenueLocked('manager', '2026-10', true)).toBe(true)
  })
  it('… but October can still be filled in once if nobody entered it', () => {
    expect(revenueLocked('manager', '2026-10', false)).toBe(false)
  })
  it('an admin can always edit, even a lapsed month with an entry', () => {
    expect(revenueLocked('admin', '2026-10', true)).toBe(false)
  })
  it('future months are open', () => {
    expect(revenueLocked('manager', '2026-12', true)).toBe(false)
  })
  it('knows the last day of a month', () => {
    expect(lastDayOf('2026-10')).toBe('2026-10-31')
    expect(lastDayOf('2026-12')).toBe('2026-12-31')
    expect(lastDayOf('2028-02')).toBe('2028-02-29')
  })
  it('reads amounts with commas and the rupee sign; rejects junk and negatives', () => {
    expect(parseAmount('1,25,000')).toBe(125000)
    expect(parseAmount('₹ 12500.50')).toBe(12500.5)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
    expect(parseAmount('12.345')).toBeNull()
  })
})
