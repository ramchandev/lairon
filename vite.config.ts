import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { asObject as securityHeaders } from './deploy/headers.ts'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // The PDF and Excel libraries are big and rarely used: don't make every first install download them.
        // They are cached the first time someone uses PDF export / import.
        globIgnores: ['**/react-pdf*.js', '**/xlsx*.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) =>
              /\/assets\/(react-pdf|xlsx)[^/]*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'heavy-libs',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
        ],
      },
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'LAIRON EZ',
        short_name: 'LAIRON EZ',
        description: 'LAIRON field operations portal',
        theme_color: '#ebf0f7',
        background_color: '#ebf0f7',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  // `vite preview` serves the production build with the same security headers production uses, to test the CSP locally.
  preview: { headers: securityHeaders() },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // supabase/functions/**/*.test.ts are Deno tests (run with `npm run test:functions`).
    exclude: [...configDefaults.exclude, 'supabase/**'],
  },
})
