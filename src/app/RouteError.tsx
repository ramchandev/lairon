import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

/** Shown when a page fails to load (offline while fetching a chunk, or an unexpected crash). Never a blank screen. */
export function RouteError() {
  const error = useRouteError()
  const missing = isRouteErrorResponse(error) && error.status === 404
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="glass max-w-sm space-y-3 p-6 text-center">
        <h1 className="text-xl font-extrabold tracking-tight">
          {missing ? 'Page not found' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-muted">
          {missing
            ? 'That page doesn’t exist.'
            : 'The page couldn’t load. Check your connection and try again.'}
        </p>
        <div className="flex gap-2">
          <button
            className="min-h-11 flex-1 rounded-control bg-primary font-semibold text-white"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-control border border-line-2 bg-white/70 font-semibold"
          >
            Home
          </a>
        </div>
      </div>
    </main>
  )
}
