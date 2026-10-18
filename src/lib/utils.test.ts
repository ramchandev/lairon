import { cn } from './utils'
import { inr } from './format'

describe('helpers', () => {
  it('merges tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
  it('formats rupees with Indian grouping', () => {
    expect(inr(1250000)).toContain('12,50,000')
  })
})

import { formatVehicleNumber, normalizeVehicleNumber, slugify, vehicleLabel } from './format'

describe('vehicle + slug helpers', () => {
  it('formats and normalises vehicle numbers', () => {
    expect(formatVehicleNumber('TN09AB6435')).toBe('TN 09 AB 6435')
    expect(normalizeVehicleNumber('tn 09 ab 6435')).toBe('TN09AB6435')
    expect(vehicleLabel('CRYSTA', 'TN09AB6435')).toBe('CRYSTA 6435')
  })
  it('slugifies dropdown names', () => {
    expect(slugify('  Offer / Netrate ')).toBe('offer_netrate')
  })
})
