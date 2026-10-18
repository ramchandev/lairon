import { productsForDivision } from './products'

const divisions = [
  { id: 'ol', name: 'OL' },
  { id: 'cc', name: 'CC' },
]
const products = [
  { id: '1', name: 'Lairobon', is_active: true, division_ids: ['ol'] },
  { id: '2', name: 'Elvion-S', is_active: true, division_ids: ['cc'] },
  { id: '3', name: 'Both', is_active: true, division_ids: ['ol', 'cc'] },
  { id: '4', name: 'Retired', is_active: false, division_ids: ['ol'] },
]

describe('productsForDivision', () => {
  it('filters by division and hides inactive products', () => {
    expect(productsForDivision(products, divisions, 'OL').map((p) => p.name)).toEqual([
      'Both',
      'Lairobon',
    ])
    expect(productsForDivision(products, divisions, 'CC').map((p) => p.name)).toEqual([
      'Both',
      'Elvion-S',
    ])
  })
  it('All Division shows every active product', () => {
    expect(productsForDivision(products, divisions, 'All Division')).toHaveLength(3)
  })
})
