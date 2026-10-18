import { Outlet } from 'react-router-dom'

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-[#3b74e0] to-[#1f47a3] text-base font-extrabold text-white shadow-[0_6px_14px_rgba(43,92,198,.28)]">
        L
      </div>
      <div className="text-base leading-tight font-extrabold tracking-tight">
        LAIRON EZ
        <small className="block text-xs font-medium text-muted">Field operations</small>
      </div>
    </div>
  )
}

export function AuthLayout() {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        <Outlet />
      </div>
    </main>
  )
}
