import { findPeriod } from './period'

describe('findPeriod', () => {
  it.each([
    ['Stock And Sales Statement - For the Period 01/05/2026 To 31/05/2026', '2026-05', false],
    ['Stock and Sales - LAIRON - 01-05-2026 to 30-05-2026.', '2026-05', false],
    ['From date 01-May-26 to 31-May-26', '2026-05', false],
    ['SALES & STOCK REPORT FOR THE PERIOD OF 01/05/2026 TO 31/05/2026', '2026-05', false],
    ['Stock And Sales Report(Month)            05/2026', '2026-05', false],
    ['Stock And Sales Report(Month) of May2026 for LAIRON', '2026-05', false],
    [' For the Month Of May-2026 Run Date : 01/06/2026', '2026-05', false],
    ['STOCK & SALES ANALYSIS (LAIRION) 01/05/2026 - 31/05/2026', '2026-05', false],
    ['01/04/2026 To 31/05/2026', '2026-05', true],
  ])('%s', (text, month, spans) => {
    expect(findPeriod(text)).toMatchObject({ month, spansMonths: spans })
  })
  it('does not mistake a run date for the period', () => {
    expect(findPeriod('Run Date : 01/06/2026')).toBeNull()
  })
})
