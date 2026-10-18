import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Pencil, Plus, UserCheck, UserX } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { StatusBadge, ActiveBadge } from '@/components/StatusBadge'
import { useToast } from '@/components/Toast'
import { IconButton, IconLink } from '@/components/ListParts'
import { useUserAction, useUsers, type UserRow } from '@/features/users/api'
import { Avatar, CallLink, visibleEmail } from '@/features/users/components'

type Pending = { user: UserRow; action: 'deactivate' | 'reactivate' | 'resend_invite' }
const COPY = {
  deactivate: {
    title: 'Deactivate this admin?',
    confirm: 'Deactivate',
    tone: 'danger' as const,
    body: 'They are signed out and can’t sign in until reactivated.',
  },
  reactivate: {
    title: 'Reactivate this admin?',
    confirm: 'Reactivate',
    tone: 'primary' as const,
    body: 'They can sign in again.',
  },
  resend_invite: {
    title: 'Resend the invite email?',
    confirm: 'Send',
    tone: 'primary' as const,
    body: 'They get a fresh link to set a new password.',
  },
}

/** Admin accounts (PLAN §6.1: admins live in Settings, not on the Users tabs). */
export function AdminsSection() {
  const { profile } = useAuth()
  const { data, isLoading } = useUsers('admin')
  const act = useUserAction()
  const toast = useToast()
  const [pending, setPending] = useState<Pending | null>(null)

  return (
    <section className="glass space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-extrabold">Admins</h2>
          <p className="text-sm text-muted">People who can manage everything in LAIRON EZ.</p>
        </div>
        <Link
          to="/admin/users/new?role=admin"
          className="inline-flex min-h-10 items-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-white"
        >
          <Plus className="size-4" /> Add admin
        </Link>
      </div>
      {isLoading ? (
        <div className="h-20 animate-pulse rounded-control bg-muted-bg/60" aria-busy="true" />
      ) : (
        <ul className="divide-y divide-line">
          {(data ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={u.full_name} url={u.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold">
                  <span className="truncate">{u.full_name}</span>
                  {u.id === profile?.id && <StatusBadge tone="info">You</StatusBadge>}
                  <ActiveBadge active={u.is_active} />
                </p>
                <p className="flex flex-wrap gap-x-4 text-sm text-muted">
                  <CallLink phone={u.phone} />
                  <span className="truncate">{visibleEmail(u.email)}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <IconLink
                  to={`/admin/users/${u.id}/edit`}
                  label={`Edit ${u.full_name}`}
                  icon={Pencil}
                />
                {u.is_active && u.id !== profile?.id && (
                  <IconButton
                    label={`Resend invite to ${u.full_name}`}
                    icon={Mail}
                    onClick={() => setPending({ user: u, action: 'resend_invite' })}
                  />
                )}
                {u.id !== profile?.id &&
                  (u.is_active ? (
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
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
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
          onConfirm={() =>
            act.mutate(
              { action: pending.action, id: pending.user.id },
              {
                onSuccess: () => {
                  toast(pending.action === 'resend_invite' ? 'Invite sent' : 'Done')
                  setPending(null)
                },
                onError: (e) => {
                  setPending(null)
                  toast(e.message, 'error')
                },
              },
            )
          }
        />
      )}
    </section>
  )
}
