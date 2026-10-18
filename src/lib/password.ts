const LOWER = 'abcdefghijkmnopqrstuvwxyz' // no l
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I, O
const DIGIT = '23456789' // no 0, 1
const SYMBOL = '@#$%&*'

/** Uniform random index without modulo bias. */
function pick(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % max
}

/**
 * A random, easy-to-read password (no look-alike characters): at least one lower, upper, digit and symbol.
 * Uses the browser's secure random source.
 */
export function generatePassword(length = 12): string {
  const all = LOWER + UPPER + DIGIT + SYMBOL
  const chars = [LOWER, UPPER, DIGIT, SYMBOL].map((set) => set[pick(set.length)])
  while (chars.length < length) chars.push(all[pick(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = pick(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
