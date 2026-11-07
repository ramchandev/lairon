import { arrange } from './ReportTable'

const rows = [
  ['Elvion', 30, 'a'],
  ['Lairocef', 120, 'b'],
  ['Clopilar', null, 'c'],
  ['Appellar', 5, 'd'],
]

describe('arrange (search and sort for report tables)', () => {
  it('searches every cell', () => {
    expect(arrange(rows, 'lair', null).map((r) => r[0])).toEqual(['Lairocef'])
  })
  it('sorts numbers as numbers and puts empty values last either way', () => {
    expect(arrange(rows, '', { col: 1, dir: -1 }).map((r) => r[1])).toEqual([120, 30, 5, null])
    expect(arrange(rows, '', { col: 1, dir: 1 }).map((r) => r[1])).toEqual([5, 30, 120, null])
  })
  it('sorts text', () => {
    expect(arrange(rows, '', { col: 0, dir: 1 }).map((r) => r[0])).toEqual([
      'Appellar',
      'Clopilar',
      'Elvion',
      'Lairocef',
    ])
  })
})
