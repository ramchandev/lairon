import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/Toast'
import { AuthProvider } from '@/app/AuthProvider'
import { router } from '@/app/router'
import '@fontsource-variable/plus-jakarta-sans/wght.css' // self-hosted: no third-party font request
import './index.css'

// DEV ONLY: `?preview=admin|driver|manager|staff` fakes a signed-in user for visual comparison (tree-shaken from production).
const previewRole = import.meta.env.DEV
  ? (() => {
      const q = new URLSearchParams(location.search).get('preview')
      if (q) sessionStorage.setItem('lairon-preview', q)
      return sessionStorage.getItem('lairon-preview')
    })()
  : null
const dev = previewRole ? await import('./dev/preview') : null

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

dev?.seedPreview(queryClient)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {dev && previewRole ? (
        <dev.PreviewAuth role={previewRole as import('./dev/preview').PreviewRole}>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </dev.PreviewAuth>
      ) : (
        <AuthProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </AuthProvider>
      )}
    </QueryClientProvider>
  </StrictMode>,
)
