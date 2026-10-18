import { inr } from '@/lib/format'
import type { BetaRow } from '../api'
import type { MonthStats } from '../logic'

/** The prototype's stat tiles (+ beta with its local / outstation split). */
export function StatsGrid({
  stats,
  beta,
  compact,
}: {
  stats: MonthStats
  beta?: BetaRow | null
  /** Today's three-tile summary (duty days, km, beta) instead of the full month card. */
  compact?: boolean
}) {
  if (compact)
    return (
      <div className="stats">
        <div className="stat">
          <b className="mono">{stats.dutyDays}</b>
          <span>Duty days</span>
        </div>
        <div className="stat">
          <b className="mono">{stats.km.toLocaleString('en-IN')}</b>
          <span>KM driven</span>
        </div>
        <div className="stat">
          <b className="mono">{inr(Number(beta?.total_amount ?? 0))}</b>
          <span>Beta so far</span>
        </div>
      </div>
    )
  const tiles: [string, string][] = [
    ['Duty days', String(stats.dutyDays)],
    ['Week offs', String(stats.weekOffs)],
    ['Leaves', String(stats.leaveDays)],
    ['Total KM', stats.km.toLocaleString('en-IN')],
    [
      'Fuel',
      `${
        stats.fuelLitres
          ? stats.fuelLitres.toLocaleString('en-IN', { maximumFractionDigits: 1 })
          : '0'
      } L`,
    ],
    ['Fuel amount', inr(stats.fuelAmount)],
  ]
  return (
    <section className="glass card">
      <div className="stats">
        {tiles.map(([k, v]) => (
          <div key={k} className="stat">
            <b className="mono">{v}</b>
            <span>{k}</span>
          </div>
        ))}
        {beta && (
          <div className="stat">
            <b className="mono">{inr(Number(beta.total_amount))}</b>
            <span>Beta</span>
          </div>
        )}
      </div>
      {beta && (
        <p className="muted mt-3 text-[13px]">
          Beta: {beta.local_days} local + {beta.outstation_days} outstation days. Several duties on
          the same date count once.
        </p>
      )}
    </section>
  )
}
