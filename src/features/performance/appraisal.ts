import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  deriveActivity,
  effectiveActivity,
  type DailyLog,
  type DoctorCall,
  type MonthlyActivity,
} from './activity'
import type { ConversionPlan } from './plans'
import type { SalesEntry } from './sales'

export interface AppraisalConfig {
  points: {
    sales: number
    kdp: number
    coverage: number
    new_customers: number
    cme: number
    new_products: number
    roi: number
  }
  targets: { coverage_pct: number; new_customers: number; cme: number; roi_doctors: number }
  sales_basis: 'primary' | 'secondary'
  bands: { min: number; label: string }[]
}

export const DEFAULT_CONFIG: AppraisalConfig = {
  points: { sales: 35, kdp: 35, coverage: 10, new_customers: 3, cme: 3, new_products: 10, roi: 4 },
  targets: { coverage_pct: 100, new_customers: 3, cme: 3, roi_doctors: 3 },
  sales_basis: 'primary',
  bands: [
    { min: 100, label: 'Outstanding' },
    { min: 95, label: 'Good' },
    { min: 92, label: 'Satisfactory' },
    { min: 0, label: 'Below par' },
  ],
}

export const totalPoints = (c: AppraisalConfig) =>
  Object.values(c.points).reduce((n, p) => n + p, 0)

/** The appraisal setup (admin only — RLS returns nothing to anyone else). */
export const useAppraisalConfig = () =>
  useQuery({
    queryKey: ['appraisal-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appraisal_settings')
        .select('config')
        .eq('id', 1)
        .maybeSingle()
      if (error) throw error
      const c = (data?.config ?? {}) as Partial<AppraisalConfig>
      return {
        ...DEFAULT_CONFIG,
        ...c,
        points: { ...DEFAULT_CONFIG.points, ...c.points },
        targets: { ...DEFAULT_CONFIG.targets, ...c.targets },
      } as AppraisalConfig
    },
  })

export function useSaveAppraisalConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: AppraisalConfig) => {
      const { error } = await supabase.from('appraisal_settings').upsert({ id: 1, config })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['appraisal-config'] }),
  })
}

// ── scoring ──

export interface ScoreLine {
  key: 'sales' | 'kdp' | 'coverage' | 'new_customers' | 'cme' | 'new_products' | 'roi'
  label: string
  target: number
  achieved: number
  /** achieved ÷ target × 100 */
  pct: number
  points: number
  max: number
}
export interface MonthScore {
  month: string
  hasData: boolean
  lines: ScoreLine[]
  total: number
  rating: string
}

export interface MonthInputs {
  month: string
  hasData: boolean
  /** Total sales (₹) and its target, on the chosen basis */
  sales: { target: number; achieved: number }
  /** One entry per KDP group: units target and achieved */
  kdp: { name: string; target: number; achieved: number }[]
  newProducts: { target: number; achieved: number }
  coveragePct: number
  newCustomers: number
  cmes: number
  roiDoctors: number
}

const ratio = (a: number, t: number) => (t ? a / t : 0) // Excel: IFERROR(…, 0)

export function ratingOf(total: number, bands: AppraisalConfig['bands']): string {
  const sorted = [...bands].sort((a, b) => b.min - a.min)
  return (sorted.find((b) => total >= b.min) ?? sorted.at(-1))?.label ?? ''
}

/** Points are achieved ÷ target × the points for that part — and are not capped, so doing more scores more. */
export function scoreMonth(i: MonthInputs, c: AppraisalConfig): MonthScore {
  const line = (
    key: ScoreLine['key'],
    label: string,
    target: number,
    achieved: number,
    max: number,
  ): ScoreLine => ({
    key,
    label,
    target,
    achieved,
    pct: ratio(achieved, target) * 100,
    points: ratio(achieved, target) * max,
    max,
  })

  const kdpTarget = i.kdp.reduce((n, g) => n + g.target, 0)
  const kdpAch = i.kdp.reduce((n, g) => n + g.achieved, 0)
  const weight = i.kdp.length ? c.points.kdp / i.kdp.length : 0
  const kdp: ScoreLine = {
    key: 'kdp',
    label: 'Core (KDP) products',
    target: kdpTarget,
    achieved: kdpAch,
    pct: ratio(kdpAch, kdpTarget) * 100,
    points: i.kdp.reduce((n, g) => n + ratio(g.achieved, g.target) * weight, 0),
    max: c.points.kdp,
  }
  const lines = [
    line('sales', 'Total sales', i.sales.target, i.sales.achieved, c.points.sales),
    kdp,
    line('coverage', 'Coverage %', c.targets.coverage_pct, i.coveragePct, c.points.coverage),
    line(
      'new_customers',
      'New customers',
      c.targets.new_customers,
      i.newCustomers,
      c.points.new_customers,
    ),
    line('cme', 'CME / meets', c.targets.cme, i.cmes, c.points.cme),
    line(
      'new_products',
      'New products',
      i.newProducts.target,
      i.newProducts.achieved,
      c.points.new_products,
    ),
    line('roi', 'ROI (doctors at 4×)', c.targets.roi_doctors, i.roiDoctors, c.points.roi),
  ]
  const total = lines.reduce((n, l) => n + l.points, 0)
  return { month: i.month, hasData: i.hasData, lines, total, rating: ratingOf(total, c.bands) }
}

/** The average of the months that have data (a month with nothing entered isn't counted). */
export function averageScore(scores: MonthScore[], c: AppraisalConfig) {
  const live = scores.filter((s) => s.hasData)
  const avg = live.length ? live.reduce((n, s) => n + s.total, 0) / live.length : 0
  return { months: live.length, total: avg, rating: live.length ? ratingOf(avg, c.bands) : '—' }
}

// ── gathering one manager's inputs for the months of a year ──

export interface Gathered {
  months: string[]
  entries: SalesEntry[]
  products: {
    id: string
    name: string
    tag: 'core' | 'new' | null
    pts: number | null
    kdp_group: string | null
  }[]
  logs: DailyLog[]
  calls: DoctorCall[]
  monthly: Record<string, MonthlyActivity | null>
  conversions: ConversionPlan[]
  roiByMonth: Record<string, number>
}

export function buildInputs(g: Gathered, c: AppraisalConfig): MonthInputs[] {
  const byProduct = new Map(g.products.map((p) => [p.id, p]))
  const groupName = (p: Gathered['products'][number]) => p.kdp_group?.trim() || p.name
  const coreGroups = [...new Set(g.products.filter((p) => p.tag === 'core').map(groupName))].sort()

  return g.months.map((month) => {
    const rows = g.entries.filter((e) => e.month.startsWith(month))
    let salesT = 0
    let salesA = 0
    let npT = 0
    let npA = 0
    const kdp = new Map(coreGroups.map((n) => [n, { name: n, target: 0, achieved: 0 }]))
    for (const e of rows) {
      const p = byProduct.get(e.product_id)
      if (!p) continue
      const achieved = c.sales_basis === 'secondary' ? e.secondary_ach : e.primary_ach
      const target = c.sales_basis === 'secondary' ? e.secondary_target : e.primary_target
      salesT += target * (p.pts ?? 0)
      salesA += achieved * (p.pts ?? 0)
      if (p.tag === 'new') {
        npT += e.primary_target
        npA += e.primary_ach
      }
      if (p.tag === 'core') {
        const k = kdp.get(groupName(p))!
        k.target += e.primary_target
        k.achieved += e.primary_ach
      }
    }
    const derived = deriveActivity(g.logs, g.calls, month)
    const saved = g.monthly[month] ?? null
    const eff = effectiveActivity(derived, saved, saved?.mcl_total ?? 0)
    const newCustomers = g.conversions.filter((p) => p.converted_on?.startsWith(month)).length
    const hasActivity = g.logs.some((l) => l.day.startsWith(month)) || !!saved
    return {
      month,
      hasData: rows.length > 0 || hasActivity || newCustomers > 0,
      sales: { target: salesT, achieved: salesA },
      kdp: [...kdp.values()],
      newProducts: { target: npT, achieved: npA },
      coveragePct: eff.coverage,
      newCustomers,
      cmes: eff.cmes,
      roiDoctors: g.roiByMonth[month] ?? 0,
    }
  })
}
