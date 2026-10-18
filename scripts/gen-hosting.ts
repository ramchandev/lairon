// Writes the hosting files that other providers read: public/_headers and public/_redirects.
// Run: npm run gen:hosting   (a test fails if the committed files drift from deploy/headers.ts)
import { writeFileSync } from 'node:fs'
import { toHeadersFile } from '../deploy/headers.ts'

writeFileSync(new URL('../public/_headers', import.meta.url), toHeadersFile())
// Single-page app fallback (Cloudflare Pages / Netlify syntax).
writeFileSync(new URL('../public/_redirects', import.meta.url), '/*  /index.html  200\n')
console.log('wrote public/_headers and public/_redirects')
