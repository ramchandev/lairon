import { csvToObjects, parseCsv } from './csv'

describe('csv', () => {
  it('handles quotes, commas, newlines and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"'],
    ])
  })
  it('skips blank lines and BOM, maps headers', () => {
    expect(csvToObjects('\uFEFFName,Divisions\nLairobon,OL|CC\n\n')).toEqual([
      { name: 'Lairobon', divisions: 'OL|CC' },
    ])
  })
})
