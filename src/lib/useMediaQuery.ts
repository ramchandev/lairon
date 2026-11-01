import { useSyncExternalStore } from 'react'

/** Live `matchMedia` result (re-renders when the window crosses the breakpoint, e.g. rotating a tablet or resizing a laptop window). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** ≥1024px — the same breakpoint the admin shell and every `lg:` style uses. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
