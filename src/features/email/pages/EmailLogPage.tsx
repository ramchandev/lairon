import { useMemo, useState } from 'react'
import { MailCheck, RotateCw } from 'lucide-react'
import { DataTable, rowBtn, type Column } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/FormPage'
import { SearchInput, Tabs } from '@/components/ListControls'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { fmtDate, fmtTime } from '@/lib/format'
import { useEmailLog, useRetryEmail, type EmailLogRow } from '../api'
import { NotifyRecipients } from '../components/NotifyRecipients'
import { canRetry, STATUS_TONE, templateLabel } from '../labels'

type Tab = 'all' | 'sent' | 'failed' | 'skipped'

/** Every email the system tried to send, with its outcome. Failed ones can be retried. */
export function EmailLogPage() {
  const { data, isLoading } = useEmailLog()
  const retry = useRetryEmail()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const all = useMemo(() => data ?? [], [data])
  const failedCount = all.filter((e) => e.status === 'failed' || e.status === 'pending').length
  const rows = useMemo(
    () =>
      all.filter(
        (e) =>
          (tab === 'all'
            ? true
            : tab === 'failed'
              ? e.status === 'failed' || e.status === 'pending'
              : e.status === tab) &&
          `${e.to} ${templateLabel(e.template)} ${e.subject ?? ''} ${e.error ?? ''}`
            .toLowerCase()
            .includes(q.trim().toLowerCase()),
      ),
    [all, tab, q],
  )
  const count = (t: Tab) =>
    t === 'all'
      ? all.length
      : t === 'failed'
        ? failedCount
        : all.filter((e) => e.status === t).length

  const columns: Column<EmailLogRow>[] = [
    {
      key: 'when',
      header: 'When',
      primary: true,
      cell: (e) => (
        <span className="tabular">
          {fmtDate(e.created_at)} {fmtTime(e.created_at)}
        </span>
      ),
    },
    { key: 'to', header: 'To', cell: (e) => <span className="break-all">{e.to}</span> },
    {
      key: 'tpl',
      header: 'Email',
      cell: (e) => (
        <span>
          {templateLabel(e.template)}
          {e.subject && (
            <>
              <br />
              <span className="text-muted">{e.subject}</span>
            </>
          )}
        </span>
      ),
    },
    {
      key: 'st',
      header: 'Status',
      cell: (e) => <StatusBadge tone={STATUS_TONE[e.status]}>{e.status}</StatusBadge>,
    },
    { key: 'tries', header: 'Tries', cell: (e) => <span className="tabular">{e.attempts}</span> },
    {
      key: 'err',
      header: 'Detail',
      cell: (e) => (e.error ? <span className="text-sm text-danger">{e.error}</span> : ''),
    },
  ]

  function onRetry(e: EmailLogRow) {
    setBusyId(e.id)
    retry.mutate(e.id, {
      onSuccess: (r) =>
        r.status === 'sent'
          ? toast('Email sent')
          : toast(r.error ?? 'Still failing — see the detail column', 'error'),
      onError: (er) => toast(er.message, 'error'),
      onSettled: () => setBusyId(null),
    })
  }

  return (
    <>
      <PageHeader title="Email log" subtitle="Every email the system tried to send." />
      <div>
        <NotifyRecipients />
      </div>
      <div>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'all', label: 'All', count: count('all') },
            { key: 'sent', label: 'Sent', count: count('sent') },
            { key: 'failed', label: 'Failed', count: count('failed') },
            { key: 'skipped', label: 'Skipped', count: count('skipped') },
          ]}
        />
        <div className="toolbar">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search recipient, email type, error…"
          />
        </div>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(e) => e.id}
        loading={isLoading}
        pageSize={30}
        empty={
          <EmptyState
            icon={MailCheck}
            title={all.length ? 'No emails match' : 'No emails yet'}
            hint="Emails appear here as soon as requests are submitted or decided."
          />
        }
        actions={(e) =>
          canRetry(e) && (
            <button className={rowBtn} disabled={busyId === e.id} onClick={() => onRetry(e)}>
              <RotateCw className="size-4" /> {busyId === e.id ? 'Retrying…' : 'Retry'}
            </button>
          )
        }
      />
    </>
  )
}
