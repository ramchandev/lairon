import { useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/app/AuthProvider'
import { Inbox, KeyRound, LogOut, Mail, Pencil, Upload, UserCheck, UserX } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type Column } from '@/components/DataTable'
import { AddButton, Fab, IconButton, IconLink, Person, Tag } from '@/components/ListParts'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/FormPage'
import { ChipFilter, SearchInput } from '@/components/ListControls'
import { ActiveBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { useUserAction, useUsers, type UserRow } from '../api'
import { Avatar, CallLink, visibleEmail } from '../components'
import { ROLE_META, ROLE_PATH, roleListUrl, type ManagedRole } from '../schemas'

type Pending = {
  user: UserRow
  action: 'deactivate' | 'reactivate' | 'force_logout' | 'resend_invite'
}
const COPY: Record<
  Pending['action'],
  { title: string; confirm: string; body: string; tone: 'danger' | 'primary' }
> = {
  deactivate: {
    title: 'Deactivate this user?',
    confirm: 'Deactivate',
    tone: 'danger',
    body: 'They are signed out and cannot sign in until reactivated. Their records are kept.',
  },
  reactivate: {
    title: 'Reactivate this user?',
    confirm: 'Reactivate',
    tone: 'primary',
    body: 'They can sign in again.',
  },
  force_logout: {
    title: 'Sign this user out everywhere?',
    confirm: 'Sign out',
    tone: 'danger',
    body: 'All their devices are signed out. They can sign in again.',
  },
  resend_invite: {
    title: 'Resend the invite email?',
    confirm: 'Send',
    tone: 'primary',
    body: 'They get a fresh link to set a new password.',
  },
}

const SUBTITLE: Record<ManagedRole, string> = {
  staff: 'Field staff who raise starter packs',
  driver: 'Chauffeurs who log duties, week offs and leave',
  manager: 'Doctor’s managers who raise service requests',
  admin: 'People who can manage everything in LAIRON EZ',
}

export const StaffPage = () => <UsersPage role="staff" />
export const DriversPage = () => <UsersPage role="driver" />
export const ManagersPage = () => <UsersPage role="manager" />
export const SuperAdminsPage = () => <UsersPage role="admin" />
/** Old /admin/users?tab=… links land on the matching role page. */
export function UsersRedirect() {
  const [params] = useSearchParams()
  const t = params.get('tab') ?? params.get('role') ?? 'staff'
  const role = (t in ROLE_PATH ? t : 'staff') as ManagedRole
  return <Navigate to={roleListUrl(role)} replace />
}

/** One page per role, each reached from its own link under People (no tabs). */
export function UsersPage({ role }: { role: ManagedRole }) {
  const { profile } = useAuth()
  const { data, isLoading } = useUsers(role)
  const act = useUserAction()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [pending, setPending] = useState<Pending | null>(null)
  const [link, setLink] = useState<string | null>(null)

  const rows = useMemo(
    () =>
      (data ?? []).filter((u) => {
        if (status !== 'all' && u.is_active !== (status === 'active')) return false
        return `${u.full_name} ${u.phone} ${u.email ?? ''} ${u.area ?? ''}`
          .toLowerCase()
          .includes(q.trim().toLowerCase())
      }),
    [data, q, status],
  )

  const meta = ROLE_META[role]
  const addTo = `/admin/users/new?role=${role}`
  const addLabel = `Add ${role === 'manager' ? 'Manager' : meta.label}`
  const columns: Column<UserRow>[] = [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      cell: (u) => (
        <Person
          lead={<Avatar name={u.full_name} url={u.avatar_url} />}
          name={u.full_name}
          sub={visibleEmail(u.email) ?? 'No email'}
        />
      ),
    },
    { key: 'phone', header: 'Phone', cell: (u) => <CallLink phone={u.phone} /> },
    ...(meta.hasArea ? [{ key: 'area', header: 'Area', cell: (u: UserRow) => u.area || '—' }] : []),
    ...(role === 'manager'
      ? [{ key: 'hq', header: 'HQ', cell: (u: UserRow) => (u.hq ? <Tag>{u.hq}</Tag> : '—') }]
      : []),
    { key: 'status', header: 'Status', cell: (u) => <ActiveBadge active={u.is_active} /> },
  ]

  function confirm() {
    if (!pending) return
    act.mutate(
      { action: pending.action, id: pending.user.id },
      {
        onSuccess: (r) => {
          setPending(null)
          if (pending.action === 'resend_invite' && r.invite_link) setLink(r.invite_link)
          else toast(pending.action === 'resend_invite' ? 'Invite sent' : 'Done')
        },
        onError: (e) => {
          setPending(null)
          toast(e.message, 'error')
        },
      },
    )
  }

  return (
    <>
      <PageHeader
        title={meta.plural}
        subtitle={SUBTITLE[role]}
        action={
          <div className="flex gap-2">
            {role !== 'admin' && (
              <Link to={`/admin/users/import?role=${role}`} className="btn btn-ghost">
                <Upload aria-hidden /> <span className="hidden sm:inline">Import</span>
              </Link>
            )}
            <AddButton to={addTo} label={addLabel} />
          </div>
        }
      />
      <div className="toolbar">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder={`Search ${meta.plural.toLowerCase()}…`}
        />
        <ChipFilter
          value={status}
          onChange={setStatus}
          options={[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'inactive', label: 'Inactive' },
          ]}
        />
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(u) => u.id}
        loading={isLoading}
        empty={
          <EmptyState
            icon={Inbox}
            title={q ? 'No results' : 'Nothing here yet'}
            hint={
              q
                ? `Nothing matches “${q}”. Try a different search.`
                : `Tap “${addLabel}” to create the first one.`
            }
          />
        }
        actions={(u) => (
          <>
            <IconLink
              to={`/admin/users/${u.id}/edit?role=${role}`}
              label={`Edit ${u.full_name}`}
              icon={Pencil}
            />
            {role !== 'manager' && u.is_active && u.id !== profile?.id && (
              <IconButton
                label={`Resend invite to ${u.full_name}`}
                icon={Mail}
                onClick={() => setPending({ user: u, action: 'resend_invite' })}
              />
            )}
            {u.is_active && u.id !== profile?.id && (
              <IconButton
                label={`Sign out ${u.full_name}`}
                icon={LogOut}
                onClick={() => setPending({ user: u, action: 'force_logout' })}
              />
            )}
            {u.id === profile?.id ? null : u.is_active ? (
              <IconButton
                danger
                label={`Deactivate ${u.full_name}`}
                icon={UserX}
                onClick={() => setPending({ user: u, action: 'deactivate' })}
              />
            ) : (
              <IconButton
                label={`Reactivate ${u.full_name}`}
                icon={UserCheck}
                onClick={() => setPending({ user: u, action: 'reactivate' })}
              />
            )}
          </>
        )}
      />
      <Fab to={addTo} label={addLabel} />

      {pending && (
        <ConfirmDialog
          open
          title={COPY[pending.action].title}
          confirmLabel={COPY[pending.action].confirm}
          tone={COPY[pending.action].tone}
          busy={act.isPending}
          description={
            <>
              <b>{pending.user.full_name}</b>. {COPY[pending.action].body}
            </>
          }
          onCancel={() => setPending(null)}
          onConfirm={confirm}
        />
      )}
      {link && (
        <ConfirmDialog
          open
          tone="primary"
          title="Email couldn’t be sent"
          confirmLabel="Copy link"
          description={
            <>
              <p>Share this one-time link with the user yourself:</p>
              <p className="mt-2 flex items-center gap-2 break-all rounded-lg bg-muted-bg p-2 text-xs">
                <KeyRound className="size-4 shrink-0" />
                {link}
              </p>
            </>
          }
          onCancel={() => setLink(null)}
          onConfirm={() => {
            void navigator.clipboard?.writeText(link)
            toast('Link copied')
            setLink(null)
          }}
        />
      )}
    </>
  )
}
