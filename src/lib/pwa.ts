import { registerSW } from 'virtual:pwa-register'

const CHECK_EVERY = 5 * 60_000

/**
 * Keeps an open or installed app current. The browser only looks for a new service worker on navigation (and at most
 * daily in the background), so a tab left open or a phone app resumed from the background would keep serving the old
 * build. Here we ask for updates every 5 minutes and whenever the app comes back to the foreground; when a new version
 * has downloaded the page reloads onto it by itself (registerType: 'autoUpdate' + skipWaiting + clientsClaim).
 */
export function startAutoUpdate() {
  if (!import.meta.env.PROD) return
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => void registration.update().catch(() => undefined)
      setInterval(check, CHECK_EVERY)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('online', check)
    },
  })
}
