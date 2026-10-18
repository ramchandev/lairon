import { readFileSync } from 'node:fs'
import { CACHE_RULES, CSP, SECURITY_HEADERS, toHeadersFile } from './headers'

describe('hosting headers', () => {
  it('has a strict CSP: no inline/eval scripts, no framing, only our origin plus Supabase for data', () => {
    const d = Object.fromEntries(
      CSP.split('; ').map((x) => [x.split(' ')[0], x.split(' ').slice(1)]),
    )
    // 'wasm-unsafe-eval' only lets WebAssembly compile (the PDF layout engine); string eval() stays blocked.
    expect(d['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'"])
    expect(CSP).not.toMatch(/'unsafe-eval'/)
    expect(d['default-src']).toEqual(["'self'"])
    expect(d['frame-ancestors']).toEqual(["'none'"])
    expect(d['object-src']).toEqual(["'none'"])
    expect(d['connect-src']).toEqual(expect.arrayContaining(["'self'", 'https://*.supabase.co']))
    expect(d['connect-src'].join(' ')).not.toMatch(/\*(?!\.supabase\.co)/)
    expect(CSP).not.toMatch(/googleapis|gstatic/) // fonts are self-hosted
  })

  it('sends the standard hardening headers', () => {
    const keys = SECURITY_HEADERS.map((h) => h.key)
    for (const k of [
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Content-Security-Policy',
    ])
      expect(keys).toContain(k)
  })

  it('caches hashed assets forever but always revalidates the shell and service worker', () => {
    const byPath = Object.fromEntries(CACHE_RULES.map((r) => [r.source, r.value]))
    expect(byPath['/assets/(.*)']).toMatch(/immutable/)
    expect(byPath['/(sw.js|registerSW.js|manifest.webmanifest|index.html)']).toMatch(
      /must-revalidate/,
    )
  })

  it('keeps the committed public/_headers and _redirects in sync with the source (run `npm run gen:hosting`)', () => {
    expect(readFileSync('public/_headers', 'utf8')).toBe(toHeadersFile())
    expect(readFileSync('public/_redirects', 'utf8')).toBe('/*  /index.html  200\n')
  })
})
