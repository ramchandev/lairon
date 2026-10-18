import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BulkImport, type BulkConfig } from '@/features/bulk-import/BulkImport'
import { adminCreateUser } from '@/features/auth/api'
import { useLookup } from '@/features/lookups/hooks'
import { StatusBadge } from '@/components/StatusBadge'
import { supabase } from '@/lib/supabase'
import { ROLE_META, roleListUrl, type ManagedRole } from '../schemas'
import {
  parseUsers,
  USER_FIELDS,
  USER_TEMPLATE_HEADER,
  USER_TEMPLATE_ROWS,
  type UserRow,
} from './parseUsers'

const ROLES: ManagedRole[] = ['staff', 'driver', 'manager']

/** Import Staffs, Drivers and Doctor's Managers from a sheet (Super Admins are added one by one). */
export function UsersImportPage() {
  const [params] = useSearchParams()
  const asked = params.get('role') as ManagedRole | null
  const defaultRole = asked && ROLES.includes(asked) ? asked : null
  const qc = useQueryClient()
  const hqs = useLookup('hq')
  const existing = useQuery({
    queryKey: ['users', 'contacts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('phone, email')
      if (error) throw error
      return data as { phone: string; email: string | null }[]
    },
  })

  const cfg = useMemo<BulkConfig<UserRow>>(
    () => ({
      intro: `Upload a sheet of ${defaultRole ? ROLE_META[defaultRole].plural.toLowerCase() : 'staffs, drivers and doctor’s managers'}. Staffs get a login invite by email; Drivers are created with the Password you give (no email is sent); Doctor’s Managers sign in with their phone. You review every row before anything is created.`,
      fields: USER_FIELDS,
      templateFile: 'users-import-template.xlsx',
      templateHeader: USER_TEMPLATE_HEADER,
      templateRows: USER_TEMPLATE_ROWS,
      ready: !!existing.data && !hqs.isLoading,
      partial: true,
      formats: (
        <div className="formats">
          <div>
            <b>Columns</b>
            <p className="muted text-[13px]">
              Role · Full Name · Phone · Email · Area · HQ · Bio · Password
            </p>
            <ul className="text-[13px]">
              <li>
                Role: Staff, Driver or Manager
                {defaultRole ? ` (blank = ${ROLE_META[defaultRole].label})` : ''}
              </li>
              <li>Phone: 10-digit mobile (+91 optional); must be new</li>
              <li>
                Email: required for Staff and Drivers (Staff get the invite there; it is the
                Driver’s login)
              </li>
              <li>Password: required for Drivers (8+ characters), ignored for others</li>
            </ul>
          </div>
          <div>
            <b>Good to know</b>
            <ul className="text-[13px]">
              <li>Rows with a problem are skipped; the rest are created</li>
              <li>Duplicate phones/emails (in the file or already used) are rejected</li>
              <li>Super Admins are added one by one under Super Admins</li>
            </ul>
          </div>
        </div>
      ),
      parse: (records) =>
        parseUsers(records, {
          defaultRole,
          existingPhones: new Set((existing.data ?? []).map((u) => u.phone)),
          existingEmails: new Set(
            (existing.data ?? []).map((u) => (u.email ?? '').toLowerCase()).filter(Boolean),
          ),
          hqs: (hqs.data ?? []).map((h) => h.value),
        }),
      columns: [
        { key: 'name', header: 'Name', primary: true, cell: (r) => <b>{r.full_name || '—'}</b> },
        { key: 'role', header: 'Role', cell: (r) => (r.role ? ROLE_META[r.role].label : '—') },
        {
          key: 'phone',
          header: 'Phone',
          cell: (r) => <span className="mono">{r.phone ?? '—'}</span>,
        },
        { key: 'email', header: 'Email', cell: (r) => r.email || '—' },
        {
          key: 'area',
          header: 'Area · HQ',
          cell: (r) => [r.area, r.hq].filter(Boolean).join(' · ') || '—',
        },
        {
          key: 'st',
          header: 'Check',
          cell: (r) =>
            r.issues.some((i) => i.severity === 'error') ? (
              <StatusBadge tone="danger">Skipped</StatusBadge>
            ) : r.issues.length ? (
              <StatusBadge tone="warn">Warning</StatusBadge>
            ) : (
              <StatusBadge tone="ok">Ready</StatusBadge>
            ),
        },
      ],
      importLabel: (n) => `Create ${n} user${n === 1 ? '' : 's'}`,
      commit: async (rows, progress) => {
        const failures: { line: number; message: string }[] = []
        const links: (string | number)[][] = []
        let made = 0
        for (const [i, r] of rows.entries()) {
          progress(i, rows.length)
          try {
            const res = await adminCreateUser({
              role: r.role!,
              full_name: r.full_name,
              phone: r.phone!,
              email: r.email || undefined,
              area: r.area || undefined,
              hq: r.hq || undefined,
              bio: r.bio || undefined,
              password: r.role === 'driver' ? r.password : undefined,
            })
            made++
            if (res.invite_link) links.push([r.full_name, r.email, res.invite_link])
          } catch (e) {
            failures.push({
              line: r.line,
              message: e instanceof Error ? e.message : 'Could not create',
            })
          }
        }
        progress(rows.length, rows.length)
        await qc.invalidateQueries({ queryKey: ['users'] })
        return {
          message: `${made} user${made === 1 ? '' : 's'} created${failures.length ? `, ${failures.length} failed` : ''}.${links.length ? ` ${links.length} invite email${links.length === 1 ? '' : 's'} couldn’t be sent — download the links and share them yourself.` : ''}`,
          failures,
          download: links.length
            ? {
                name: 'invite-links.csv',
                header: ['Name', 'Email', 'Invite link'],
                rows: links,
                label: 'Download invite links',
              }
            : undefined,
        }
      },
      doneTo: roleListUrl(defaultRole ?? 'staff'),
      doneLabel: 'View users',
    }),
    [defaultRole, existing.data, hqs.data, hqs.isLoading, qc],
  )
  return <BulkImport cfg={cfg} />
}
