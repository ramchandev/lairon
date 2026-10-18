import { planProductImport } from './importPlan'

const divs = [
  { id: 'd1', name: 'OL' },
  { id: 'd2', name: 'CC' },
]

describe('planProductImport', () => {
  it('classifies new, existing, unknown division, duplicate and blank rows', () => {
    const csv =
      'name,description,divisions\nLairobon,Vit D,OL|CC\nlairomox,,OL\nFoo,,ZZ\nLairobon,,OL\n,x,OL\n'
    const rows = planProductImport(csv, divs, [{ id: 'p9', name: 'Lairomox' }])
    expect(rows.map((r) => r.status)).toEqual(['new', 'update', 'error', 'error', 'error'])
    expect(rows[0].divisionIds).toEqual(['d1', 'd2'])
    expect(rows[1].existingId).toBe('p9')
    expect(rows[2].error).toMatch(/Unknown division: ZZ/)
    expect(rows[0].line).toBe(2)
  })
})
