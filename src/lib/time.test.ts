import {
  addDays,
  diffDays,
  istParts,
  minutesText,
  monthLabel,
  shiftMonth,
  time12,
  timeToMinutes,
} from './time'

describe('time helpers', () => {
  it('reads India date/time whatever the device zone', () => {
    // 2026-10-17 20:00 UTC is already 18 Oct 01:30 in India
    expect(istParts(new Date('2026-10-17T20:00:00Z'))).toEqual({
      date: '2026-10-18',
      time: '01:30',
    })
    expect(istParts(new Date('2026-10-18T18:29:00Z'))).toEqual({
      date: '2026-10-18',
      time: '23:59',
    })
  })
  it('does calendar arithmetic', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(diffDays('2026-10-01', '2026-10-08')).toBe(7)
  })
  it('formats durations and clock times', () => {
    expect(minutesText(555)).toBe('9h 15m')
    expect(minutesText(120)).toBe('2h')
    expect(minutesText(45)).toBe('45m')
    expect(minutesText(0)).toBe('0m')
    expect(time12('00:05:00')).toBe('12:05 AM')
    expect(time12('13:30')).toBe('1:30 PM')
    expect(time12(null)).toBe('—')
    expect(timeToMinutes('07:15')).toBe(435)
  })
  it('moves between months', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(monthLabel('2026-10')).toBe('October 2026')
  })
})
