import { toCsv } from './csvExport'

describe('toCsv', () => {
  it('quotes commas, quotes and newlines; blanks null', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['x, y', 'say "hi"'],
          [null, 'l1\nl2'],
        ],
      ),
    ).toBe('a,b\r\n"x, y","say ""hi"""\r\n,"l1\nl2"')
  })
  it('neutralises formula injection but keeps plain negatives', () => {
    expect(toCsv(['a'], [['=SUM(A1)'], ['@cmd'], ['-5'], ['+91 98765']])).toBe(
      "a\r\n'=SUM(A1)\r\n'@cmd\r\n-5\r\n'+91 98765",
    )
  })
})
