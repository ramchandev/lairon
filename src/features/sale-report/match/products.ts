/** Product-name matching: stockists spell our products in many ways, so names are reduced to their meaningful words first. */

const FORM_WORDS = new Set([
  'TAB',
  'TABS',
  'TABLET',
  'TABLETS',
  'CAP',
  'CAPS',
  'CAPSULE',
  'CAPSULES',
  'INJ',
  'INJN',
  'INJECTION',
  'SYP',
  'SYRUP',
  'SUSP',
  'SUSPENSION',
  'EXP',
  'DROPS',
  'GEL',
  'OINT',
  'AMP',
  'VIAL',
  'LAIRON',
  'LARION',
])

/** "ELVION-XT TAB  10'S" → "ELVION XT"; strengths stay ("CLOPILART-75MG" → "CLOPILART 75"). */
export function normalizeProduct(name: string): string {
  let s = name.toUpperCase().replace(/[`’']/g, '')
  s = s.replace(/\b\d+\s*[X*]\s*\d+\s*S?\b/g, ' ') // 10X10S, 1*10S
  s = s.replace(/(^|\s)\d+\s*S\b/g, ' ') // 10S
  s = s.replace(/\b\d+(\.\d+)?\s*ML\b/g, ' ') // 200ML is a pack size
  s = s.replace(/(\d)\s*(MG|GM|MCG|G)\b/g, '$1 ') // 75MG → 75
  s = s.replace(/[^A-Z0-9.]+/g, ' ')
  return s
    .split(' ')
    .filter((w) => w && !FORM_WORDS.has(w))
    .join(' ')
    .trim()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}
const sim = (a: string, b: string) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1)

/** 0..1. Compares word by word, so "LAIGLAR M1" never looks like "LAIGLAR 1" and strengths must agree. */
export function nameScore(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const ta = a.split(' ')
  const tb = b.split(' ')
  const used = new Set<number>()
  let total = 0
  for (const x of ta) {
    let best = 0
    let at = -1
    tb.forEach((y, i) => {
      if (used.has(i)) return
      const isNum = /\d/.test(x) || /\d/.test(y)
      const s = x === y ? 1 : isNum || Math.min(x.length, y.length) < 5 ? 0 : sim(x, y)
      if (s > best && s >= 0.7) {
        best = s
        at = i
      }
    })
    if (at >= 0) used.add(at)
    total += best
  }
  return (2 * total) / (ta.length + tb.length)
}

export interface Candidate {
  id: string
  name: string
}
/** exact name · remembered from an earlier upload · auto (≥ AUTO, shown for review) · suggest (≥ SUGGEST, asked) · none */
export type MatchState = 'exact' | 'remembered' | 'auto' | 'suggest' | 'none'
export const AUTO = 0.8
export const SUGGEST = 0.5
export interface Match {
  productId: string | null
  state: MatchState
  score: number
  /** Best guesses, for the admin to choose from */
  options: { id: string; name: string; score: number }[]
}

/** exact → remembered alias → ≥ 80% auto (shown in the list for review) → 50–80% suggested (admin confirms) → none. Aliases: normalised spelling → product id. */
export function matchProduct(
  raw: string,
  products: Candidate[],
  aliases: Map<string, string> = new Map(),
): Match {
  const n = normalizeProduct(raw)
  const viaAlias = aliases.get(n) ?? aliases.get(raw.trim().toUpperCase())
  if (viaAlias) return { productId: viaAlias, state: 'remembered', score: 1, options: [] }
  const scored = products
    .map((p) => ({ id: p.id, name: p.name, score: nameScore(n, normalizeProduct(p.name)) }))
    .sort((x, y) => y.score - x.score)
  const best = scored[0]
  const options = scored.filter((s) => s.score >= 0.5).slice(0, 4)
  if (!best || best.score < SUGGEST)
    return { productId: null, state: 'none', score: best?.score ?? 0, options }
  const state: MatchState = best.score === 1 ? 'exact' : best.score >= AUTO ? 'auto' : 'suggest'
  return { productId: state === 'suggest' ? null : best.id, state, score: best.score, options }
}
