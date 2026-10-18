import { Outlet, useNavigation } from 'react-router-dom'
import { ChromeProvider } from '@/layouts/chrome'

/** Thin progress bar while a lazily-loaded page is being fetched; also hosts the shared chrome title context. */
export function AppRoot() {
  const loading = useNavigation().state === 'loading'
  return (
    <ChromeProvider>
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] origin-left bg-primary transition-opacity ${loading ? 'route-progress opacity-100' : 'opacity-0'}`}
      />
      <Outlet />
    </ChromeProvider>
  )
}
