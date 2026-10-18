import { useEffect, useState } from 'react'

/** A Date that refreshes every `ms` (default 30 s) — for live "elapsed" clocks without re-fetching. */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}
