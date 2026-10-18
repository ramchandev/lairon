import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  BriefcaseMedical,
  CalendarX,
  CarFront,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileDown,
  Fuel,
  IdCard,
  IndianRupee,
  ListChecks,
  Package,
  Pill,
  Truck,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { Avatar } from '@/components/Avatar'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { downloadCsv } from '@/lib/csvExport'
import { inr } from '@/lib/format'
import { monthLabel } from '@/lib/time'
import { useActivity, useDashboard, type AttentionItem, type Dashboard } from '../api'

type Tone = 'info' | 'warn' | 'ok' | 'teal' | 'danger' | 'violet'

interface Card {
  key: string
  label: string
  icon: LucideIcon
  tone: Tone
  value: (d: Dashboard) => string
  sub: (d: Dashboard) => string
  to: (d: Dashboard) => string
}

const month3 = (m: string) => monthLabel(m).split(' ')[0]

const CARDS: Card[] = [
  {
    key: 'sr',
    label: 'Pending service requests',
    icon: ClipboardList,
    tone: 'info',
    value: (d) => String(d.pending_service_requests),
    sub: () => 'Awaiting review',
    to: () => '/admin/service-requests?status=submitted',
  },
  {
    key: 'sp',
    label: 'Pending starter packs',
    icon: Package,
    tone: 'violet',
    value: (d) => String(d.pending_starter_packs),
    sub: () => 'To be fulfilled',
    to: () => '/admin/starter-packs?status=pending',
  },
  {
    key: 'duty',
    label: 'Drivers on duty',
    icon: CarFront,
    tone: 'teal',
    value: (d) => `${d.drivers_with_duty_today}/${d.drivers_total}`,
    sub: (d) =>
      d.drivers_on_duty_now > 0 ? `Today · ${d.drivers_on_duty_now} on the road now` : 'Today',
    to: () => '/admin/trip-duty?tab=all',
  },
  {
    key: 'leave',
    label: 'Leave requests',
    icon: CalendarX,
    tone: 'warn',
    value: (d) => String(d.pending_leave_requests),
    sub: (d) =>
      d.pending_leave_requests
        ? `Need approval · ${d.pending_leave_days} ${d.pending_leave_days === 1 ? 'day' : 'days'}`
        : 'Need approval',
    to: () => '/admin/trip-duty?tab=leave',
  },
  {
    key: 'beta',
    label: 'Chauffeur beta',
    icon: IndianRupee,
    tone: 'ok',
    value: (d) => inr(d.beta_total),
    sub: (d) => `${month3(d.month)} · ${d.total_km.toLocaleString('en-IN')} km`,
    to: (d) => `/admin/trip-duty?tab=beta&m=${d.month}`,
  },
  {
    key: 'fuel',
    label: 'Fuel spend',
    icon: Fuel,
    tone: 'danger',
    value: (d) => inr(d.fuel_amount),
    sub: (d) => monthLabel(d.month),
    to: (d) => `/admin/trip-duty?tab=all&m=${d.month}`,
  },
]

const QUICK: { label: string; to: string; icon: LucideIcon; tone: Tone }[] = [
  { label: 'Add Staff', to: '/admin/users/new?role=staff', icon: UserPlus, tone: 'teal' },
  { label: 'Add Driver', to: '/admin/users/new?role=driver', icon: IdCard, tone: 'info' },
  {
    label: 'Add Manager',
    to: '/admin/users/new?role=manager',
    icon: BriefcaseMedical,
    tone: 'violet',
  },
  { label: 'Add Product', to: '/admin/products/new', icon: Pill, tone: 'ok' },
  { label: 'Add Vehicle', to: '/admin/vehicles/new', icon: Truck, tone: 'warn' },
  { label: 'Dropdowns', to: '/admin/dropdowns', icon: ListChecks, tone: 'danger' },
]

const ATTN_ICON = { request: ClipboardList, pack: Package, leave: CalendarX } as const
const ATTN_TONE: Record<AttentionItem['kind'], Tone> = {
  request: 'info',
  pack: 'violet',
  leave: 'warn',
}
const ATTN_LINK = (a: AttentionItem) =>
  a.kind === 'request'
    ? `/admin/service-requests/${a.id}`
    : a.kind === 'pack'
      ? `/admin/starter-packs/${a.id}`
      : '/admin/trip-duty?tab=leave'
const STATUS_TONE = { submitted: 'info', processing: 'warn', pending: 'warn' } as const

const KIND_ICON = {
  request: ClipboardList,
  pack: Package,
  leave: CalendarX,
  duty: CarFront,
} as const
const KIND_TONE = { request: 'info', pack: 'violet', leave: 'warn', duty: 'teal' } as const

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function exportReport(d: Dashboard) {
  downloadCsv(
    `lairon-dashboard-${d.month}.csv`,
    ['Measure', 'Value', 'Note'],
    [
      ['Month', monthLabel(d.month), ''],
      ['Pending service requests', d.pending_service_requests, ''],
      ['Pending starter packs', d.pending_starter_packs, ''],
      ['Drivers with a duty today', d.drivers_with_duty_today, `of ${d.drivers_total} drivers`],
      ['Pending leave requests', d.pending_leave_requests, `${d.pending_leave_days} days`],
      ['Chauffeur beta (₹)', d.beta_total, `${d.beta_payable_days} payable days`],
      ['Total km', d.total_km, ''],
      ['Fuel spend (₹)', d.fuel_amount, `${d.fuel_litres} litres`],
      ...d.sr_value_by_month.map((x): (string | number)[] => [
        `Service request value ${monthLabel(x.m)} (₹)`,
        x.v,
        '',
      ]),
    ],
  )
}

export function DashboardPage() {
  const { profile } = useAuth()
  const kpi = useDashboard()
  const activity = useActivity()
  const d = kpi.data
  const first = profile?.full_name.split(' ')[0] ?? 'there'
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const chart = d?.sr_value_by_month ?? []
  const max = Math.max(1, ...chart.map((c) => c.v))

  return (
    <>
      <div className="hello">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>
            {greeting()}, {first}
          </h1>
          <p className="muted">
            {d
              ? `${monthLabel(d.month)} so far. Here's what needs your attention today.`
              : 'Loading…'}
          </p>
        </div>
        <button
          className="btn btn-ghost hidden lg:inline-flex"
          disabled={!d}
          onClick={() => d && exportReport(d)}
        >
          <FileDown /> Export report
        </button>
      </div>

      <section aria-label="Key numbers" className="kpis">
        {kpi.isLoading || !d
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="glass h-32 animate-pulse" aria-busy="true" />
            ))
          : CARDS.map((c) => (
              <Link key={c.key} to={c.to(d)} className="kpi glass">
                <span className={`k-ic t-${c.tone}`}>
                  <c.icon size={20} />
                </span>
                <span className="k-val mono">{c.value(d)}</span>
                <span>
                  <span className="k-lbl">{c.label}</span>
                  <br />
                  <span className="k-sub">{c.sub(d)}</span>
                </span>
              </Link>
            ))}
      </section>
      {kpi.isError && (
        <p role="alert" className="mt-3 rounded-control bg-danger-bg p-3 text-sm text-danger">
          Couldn’t load the numbers. They refresh automatically; check your connection.
        </p>
      )}

      <h2 className="sec-h">Quick actions</h2>
      <div className="qa-row">
        {QUICK.map((a) => (
          <Link key={a.label} to={a.to} className="qa glass">
            <span className={`k-ic t-${a.tone}`}>
              <a.icon size={20} />
            </span>
            {a.label}
          </Link>
        ))}
      </div>

      <div className="dash-grid">
        <section className="glass card" aria-labelledby="h-attn">
          <div className="card-h">
            <h2 id="h-attn">Needs attention</h2>
            <span className="badge b-warn">{d?.attention_total ?? 0} open</span>
          </div>
          {d && d.attention.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All caught up"
              hint="Nothing needs your attention right now."
            />
          ) : (
            <ul className="attn">
              {(d?.attention ?? []).map((a) => {
                const Icon = ATTN_ICON[a.kind]
                return (
                  <li key={`${a.kind}-${a.id}`}>
                    <Link to={ATTN_LINK(a)}>
                      <span className={`a-ic t-${ATTN_TONE[a.kind]}`}>
                        <Icon size={19} />
                      </span>
                      <span className="a-body">
                        <span className="a-t block">{a.title}</span>
                        <span className="a-s">{a.sub}</span>
                      </span>
                      <StatusBadge
                        tone={STATUS_TONE[a.status as keyof typeof STATUS_TONE] ?? 'muted'}
                      >
                        {a.status === 'pending'
                          ? 'Pending'
                          : a.status === 'processing'
                            ? 'Processing'
                            : 'Submitted'}
                      </StatusBadge>
                      <ChevronRight className="chev" size={18} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="glass card" aria-labelledby="h-chart">
          <div className="card-h">
            <h2 id="h-chart">Service request value</h2>
            <span className="muted text-[13px]">₹ thousands · last 6 months</span>
          </div>
          <div className="bars" role="img" aria-label="Service request value by month">
            {chart.map((c, i) => (
              <div key={c.m} className={`bar ${i < chart.length - 1 ? 'dim' : ''}`}>
                <b className="mono">{Math.round(c.v / 1000)}</b>
                <i style={{ height: `${Math.round((c.v / max) * 100)}%` }} />
                <span>{month3(c.m)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass card" aria-labelledby="h-drv">
          <div className="card-h">
            <h2 id="h-drv">Drivers today</h2>
            <Link className="link text-[13px]" to="/admin/trip-duty">
              Open Trip Duty
            </Link>
          </div>
          {d && d.drivers_today.length === 0 ? (
            <p className="muted">No active drivers yet.</p>
          ) : (
            <ul className="drv-list">
              {(d?.drivers_today ?? []).map((x) => (
                <li key={x.id}>
                  <div className="person">
                    <Avatar name={x.name} url={x.avatar_url} />
                    <div className="min-w-0">
                      <div className="pn">{x.name}</div>
                      <div className="ps">
                        {x.state === 'duty'
                          ? `${x.vehicle ?? 'Vehicle'} · ${x.pickup ?? '—'} → ${x.drop ?? '—'}`
                          : 'No duty logged'}
                      </div>
                    </div>
                  </div>
                  {x.state === 'duty' ? (
                    <span className="badge b-info">{x.duty_type}</span>
                  ) : x.state === 'week_off' ? (
                    <span className="badge b-muted">Week off</span>
                  ) : x.state === 'leave' ? (
                    <span className="badge b-warn">On leave</span>
                  ) : (
                    <span className="badge b-muted">Not started</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass card" aria-labelledby="h-act">
          <div className="card-h">
            <h2 id="h-act">Recent activity</h2>
          </div>
          {activity.isLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-white/50" aria-busy="true" />
          ) : !activity.data?.length ? (
            <p className="muted">
              Nothing yet. Requests, leave and finished duties will show up here.
            </p>
          ) : (
            <ul className="timeline">
              {activity.data.map((a) => {
                const Icon = KIND_ICON[a.kind]
                const body = (
                  <>
                    <span className={`a-ic t-${KIND_TONE[a.kind]}`}>
                      <Icon />
                    </span>
                    <div>
                      <p>{a.text}</p>
                      <time dateTime={a.at}>
                        {formatDistanceToNowStrict(new Date(a.at), { addSuffix: true })}
                      </time>
                    </div>
                  </>
                )
                return (
                  <li key={a.id} className="!p-0">
                    {a.to ? (
                      <Link to={a.to} className="flex gap-3 py-2.5 no-underline">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex gap-3 py-2.5">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
