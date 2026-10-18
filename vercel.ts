import { routes, type VercelConfig } from '@vercel/config/v1'
import { CACHE_RULES, SECURITY_HEADERS } from './deploy/headers.ts'

/** Vercel project config. Compiled to vercel.json by the Vercel CLI at build time. */
export const config: VercelConfig = {
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',

  // Single-page app: any path that isn't a real file serves the shell, and React Router takes over.
  // (Vercel serves real files first, so /assets/*, /sw.js etc. are unaffected.)
  rewrites: [routes.rewrite('/(.*)', '/index.html')],

  headers: [
    routes.header('/(.*)', SECURITY_HEADERS),
    ...CACHE_RULES.map((r) => routes.header(r.source, [{ key: 'Cache-Control', value: r.value }])),
  ],
}
