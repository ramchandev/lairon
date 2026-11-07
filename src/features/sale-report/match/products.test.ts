import { matchProduct, normalizeProduct } from './products'

const P = [
  { id: 'a', name: 'Elvion XT' },
  { id: 'b', name: 'Lairocef 1.5G' },
  { id: 'c', name: 'Lairocef 1G' },
  { id: 'd', name: 'Laiglar 1' },
  { id: 'e', name: 'Laiglar M1' },
  { id: 'f', name: 'Clopilart 75' },
  { id: 'g', name: 'Labound Plus' },
  { id: 'h', name: 'Labound' },
]

describe('normalizeProduct', () => {
  it('drops pack, form words and units but keeps strength', () => {
    expect(normalizeProduct("ELVION-XT TAB                 10'S")).toBe('ELVION XT')
    expect(normalizeProduct('CLOPILART-75MG TAB 10X10S')).toBe('CLOPILART 75')
    expect(normalizeProduct('LAIROCEF 1.5G INJ')).toBe('LAIROCEF 1.5')
    expect(normalizeProduct('LABOUND SYP 200ML')).toBe('LABOUND')
  })
})

describe('matchProduct', () => {
  it('matches different spellings of the same product', () => {
    expect(matchProduct('ELVION XT TAB 10S', P)).toMatchObject({ productId: 'a', state: 'exact' })
    expect(matchProduct('ELION XT TABS', P)).toMatchObject({ productId: 'a', state: 'auto' })
    expect(matchProduct('CLOPILAR 75MG TAB', P)).toMatchObject({ productId: 'f' })
  })
  it('never confuses different strengths or variants', () => {
    expect(matchProduct('LAIROCEF 1G INJ', P).productId).toBe('c')
    expect(matchProduct('LAIROCEF-1.5G', P).productId).toBe('b')
    expect(matchProduct('LAIGLAR-M1 TAB', P).productId).toBe('e')
    expect(matchProduct('LAIGLAR-1 TAB', P).productId).toBe('d')
    expect(matchProduct('LABOUND PLUS CAPS', P).productId).toBe('g')
    expect(matchProduct('LABOUND TAB 30S', P).productId).toBe('h')
  })
  it('suggests, but does not pick, a loose match; unknown products stay unmatched', () => {
    const m = matchProduct('ELVN XT', P) // 50–80%: only asked
    expect(m.productId).toBeNull()
    expect(m.state).toBe('suggest')
    expect(m.options[0].id).toBe('a')
    expect(matchProduct('SOMETHING ELSE', P)).toMatchObject({ productId: null, state: 'none' })
  })
  it('accepts 80% and above on its own (shown for review)', () => {
    expect(matchProduct('LARICEF 1.5G', P)).toMatchObject({ productId: 'b', state: 'auto' })
  })
  it('a saved alias wins', () => {
    expect(matchProduct('LARICEF 1.5G', P, new Map([['LARICEF 1.5', 'b']]))).toMatchObject({
      productId: 'b',
      state: 'remembered',
    })
  })
})
