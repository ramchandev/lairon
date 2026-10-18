// Classic JSX (React in scope) so no per-function deno.json is needed to bundle these.
// @ts-types="npm:@types/react@19.1.8"
import React, { type ReactElement } from 'npm:react@19.1.0'
import { Badge, Cta, DataTable, Facts, Layout, P, Rule } from './layout.tsx'
import { dateRange, fmtDate, inr, plural } from './format.ts'
import type {
  LeaveData,
  ServiceRequestData,
  StarterPackData,
  Template,
  TemplateData,
  WelcomeData,
} from './types.ts'

const STATUS_TONE = {
  submitted: 'info',
  approved: 'ok',
  rejected: 'danger',
  fulfilled: 'ok',
} as const
const STATUS_WORD = {
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  fulfilled: 'Fulfilled',
} as const

function Welcome({ name, link }: WelcomeData) {
  return (
    <Layout preview="Set your password to start using LAIRON EZ" title="Welcome to LAIRON EZ">
      <P>Hi {name}, your account is ready. Set your password to sign in.</P>
      <Cta href={link}>Set your password</Cta>
      <P muted>This link works once. If you weren’t expecting this email, you can ignore it.</P>
    </Layout>
  )
}

function ServiceRequestSubmitted(d: ServiceRequestData) {
  return (
    <Layout
      preview={`${d.refNo}: ${plural(d.services.length, 'service')}, ${inr(d.total)}`}
      title={`Service request ${d.refNo}`}
    >
      <P>
        {d.managerName} submitted {plural(d.services.length, 'service')} totalling{' '}
        <b>{inr(d.total)}</b>.
      </P>
      <Facts
        rows={[
          ['Manager', d.managerName],
          ['Accountability', d.accountabilityName],
        ]}
      />
      <DataTable
        head={['Doctor', 'Service', 'Amount', 'Terms']}
        widths={['40%', '22%', '18%', '20%']}
        rows={d.services.map((s) => [
          `${s.doctor} — ${s.hospital}, ${s.area}`,
          s.serviceType,
          inr(s.amount),
          s.terms,
        ])}
      />
      {d.link ? (
        <Cta href={d.link}>Review request</Cta>
      ) : (
        <P muted>You are listed as the accountable staff member for these services.</P>
      )}
    </Layout>
  )
}

function ServiceRequestDecided(d: ServiceRequestData) {
  return (
    <Layout
      preview={`${d.refNo} was ${STATUS_WORD[d.status].toLowerCase()}`}
      title={`${d.refNo}: ${STATUS_WORD[d.status]}`}
    >
      <P>
        <Badge tone={STATUS_TONE[d.status]}>{STATUS_WORD[d.status]}</Badge>
      </P>
      <Facts
        rows={[
          ['Manager', d.managerName],
          ['Accountability', d.accountabilityName],
          ['Services', `${d.services.length} · ${inr(d.total)}`],
        ]}
      />
      {d.note && (
        <>
          <Rule />
          <P>
            <b>Note from admin:</b> {d.note}
          </P>
        </>
      )}
      {d.link && <Cta href={d.link}>View request</Cta>}
    </Layout>
  )
}

const packFacts = (d: StarterPackData): [string, string][] => [
  ['Date', fmtDate(d.date)],
  ['Doctor', `${d.doctor} (${d.qualification})`],
  ['Doctor area', d.doctorArea],
  ['Requested by', `${d.staffName} · ${d.staffArea}`],
  ['Division', d.division],
]

function StarterPackSubmitted(d: StarterPackData) {
  return (
    <Layout
      preview={`${d.refNo} from ${d.staffName} for ${d.doctor}`}
      title={`Starter pack ${d.refNo}`}
    >
      <P>
        {d.staffName} requested a starter pack for {d.doctor}.
      </P>
      <Facts rows={packFacts(d)} />
      <DataTable
        head={['#', 'Product', 'Quantity']}
        widths={['10%', '60%', '30%']}
        rows={d.items.map((i, n) => [String(n + 1), i.name, i.quantity])}
      />
      {d.link && <Cta href={d.link}>Open request</Cta>}
    </Layout>
  )
}

function StarterPackFulfilled(d: StarterPackData) {
  return (
    <Layout preview={`${d.refNo} has been fulfilled`} title={`${d.refNo}: Fulfilled`}>
      <P>
        <Badge tone="ok">Fulfilled</Badge>
      </P>
      <P>Your starter pack request for {d.doctor} has been fulfilled.</P>
      <DataTable
        head={['#', 'Product', 'Quantity']}
        widths={['10%', '60%', '30%']}
        rows={d.items.map((i, n) => [String(n + 1), i.name, i.quantity])}
      />
      {d.note && (
        <P>
          <b>Note:</b> {d.note}
        </P>
      )}
      {d.link && <Cta href={d.link}>View request</Cta>}
    </Layout>
  )
}

function LeaveApplied(d: LeaveData) {
  return (
    <Layout
      preview={`${d.driverName} applied for ${plural(d.days, 'day')} of leave`}
      title="Leave request"
    >
      <P>{d.driverName} applied for leave and is waiting for your decision.</P>
      <Facts
        rows={[
          ['Dates', dateRange(d.from, d.to)],
          ['Days', String(d.days)],
          ['Type', d.type],
          ['Reason', d.reason || '—'],
        ]}
      />
      {d.link && <Cta href={d.link}>Review leave requests</Cta>}
    </Layout>
  )
}

function LeaveDecided(d: LeaveData) {
  const ok = d.status === 'approved'
  return (
    <Layout
      preview={`Your leave was ${ok ? 'approved' : 'rejected'}`}
      title={`Leave ${ok ? 'approved' : 'rejected'}`}
    >
      <P>
        <Badge tone={ok ? 'ok' : 'danger'}>{ok ? 'Approved' : 'Rejected'}</Badge>
      </P>
      <Facts
        rows={[
          ['Dates', dateRange(d.from, d.to)],
          ['Days', String(d.days)],
          ['Type', d.type],
        ]}
      />
      {d.note && (
        <P>
          <b>Note from admin:</b> {d.note}
        </P>
      )}
      {d.link && <Cta href={d.link}>Open LAIRON EZ</Cta>}
    </Layout>
  )
}

interface Def<T extends Template> {
  subject: (d: TemplateData[T]) => string
  element: (d: TemplateData[T]) => ReactElement
}
type Registry = { [K in Template]: Def<K> }

export const TEMPLATES: Registry = {
  welcome: {
    subject: () => 'Welcome to LAIRON EZ — set your password',
    element: (d) => <Welcome {...d} />,
  },
  service_request_submitted: {
    subject: (d) => `Service request ${d.refNo} submitted (${inr(d.total)})`,
    element: (d) => <ServiceRequestSubmitted {...d} />,
  },
  service_request_decided: {
    subject: (d) => `Service request ${d.refNo} ${STATUS_WORD[d.status].toLowerCase()}`,
    element: (d) => <ServiceRequestDecided {...d} />,
  },
  starter_pack_submitted: {
    subject: (d) => `Starter pack ${d.refNo}: ${d.staffName} for ${d.doctor}`,
    element: (d) => <StarterPackSubmitted {...d} />,
  },
  starter_pack_fulfilled: {
    subject: (d) => `Starter pack ${d.refNo} fulfilled`,
    element: (d) => <StarterPackFulfilled {...d} />,
  },
  leave_applied: {
    subject: (d) => `Leave request: ${d.driverName}, ${dateRange(d.from, d.to)}`,
    element: (d) => <LeaveApplied {...d} />,
  },
  leave_decided: {
    subject: (d) =>
      `Your leave ${d.status === 'approved' ? 'was approved' : 'was rejected'}: ${dateRange(d.from, d.to)}`,
    element: (d) => <LeaveDecided {...d} />,
  },
}
