import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, LogOut, Phone, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/AuthProvider'
import { useLookup } from '@/features/lookups/hooks'
import { formatPhone } from '@/lib/phone'
import { prepareAvatar, saveAvatar } from '@/lib/avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Avatar } from '@/components/Avatar'
import { Field } from '@/components/FormPage'
import { inputCls, primaryBlock } from '@/components/form-styles'
import { LeaveRequests } from '@/features/trip-duty/components/LeaveRequests'
import { profileSchema, type ProfileForm } from './schemas'

const ROLE_LABEL = {
  admin: 'Super Admin',
  staff: 'Staff',
  driver: 'Driver',
  manager: 'Doctor’s Manager',
} as const

/** Shared by every role. Role, status and phone are read-only (enforced by a DB trigger too). */
export function ProfilePage() {
  const { profile, refreshProfile, signOut } = useAuth()
  const hqs = useLookup('hq')
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmOut, setConfirmOut] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      area: profile?.area ?? '',
      hq: profile?.hq ?? '',
      bio: profile?.bio ?? '',
    },
  })
  if (!profile) return null

  const showArea = profile.role === 'staff' || profile.role === 'manager'
  const showBio = profile.role === 'staff' || profile.role === 'driver'

  async function onSave(v: ProfileForm) {
    setMessage(null)
    const patch: Record<string, string | null> = { full_name: v.full_name }
    if (showArea) {
      patch.area = v.area || null
      patch.hq = v.hq || null
    }
    if (showBio) patch.bio = v.bio || null
    const { error } = await supabase.from('profiles').update(patch).eq('id', profile!.id)
    if (error) return setMessage({ kind: 'error', text: 'Could not save your changes.' })
    await refreshProfile()
    reset(v)
    setMessage({ kind: 'ok', text: 'Profile saved.' })
  }

  async function onPickAvatar(file: File | undefined) {
    if (!file) return
    setMessage(null)
    setUploading(true)
    try {
      await saveAvatar(profile!.id, await prepareAvatar(file))
      await refreshProfile()
      setMessage({ kind: 'ok', text: 'Photo updated.' })
    } catch (e) {
      setMessage({
        kind: 'error',
        text: e instanceof Error ? e.message : 'Could not upload the photo.',
      })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const email =
    profile.email && !profile.email.endsWith('@managers.lairon.internal') ? profile.email : null
  return (
    <div className="mx-auto max-w-[824px]">
      <section className="glass profile-card">
        <div className="relative">
          <Avatar name={profile.full_name} url={profile.avatar_url} size={64} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Change photo"
            className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full bg-primary text-white shadow"
          >
            <Camera className="size-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPickAvatar(e.target.files?.[0])}
          />
        </div>
        <div className="min-w-0">
          <h1 className="pf-name truncate">{profile.full_name}</h1>
          <span className="badge b-info">{ROLE_LABEL[profile.role]}</span>
        </div>
      </section>

      <section className="glass card">
        <ul className="kv">
          <li>
            <Phone size={20} aria-hidden />
            <div>
              <span className="k">{profile.role === 'manager' ? 'Phone (sign-in)' : 'Phone'}</span>
              <span className="mono">{formatPhone(profile.phone)}</span>
            </div>
          </li>
          <li>
            <Mail size={20} aria-hidden />
            <div>
              <span className="k">Email</span>
              {email ?? <span className="muted">Not added</span>}
            </div>
          </li>
        </ul>
        <p className="muted mt-1.5 text-[13px]">
          To change your phone or email, contact your LAIRON admin.
        </p>
      </section>

      <form onSubmit={handleSubmit(onSave)} className="glass form-card" noValidate>
        <h2 className="sec-t">Edit profile</h2>
        <div className="grid-2">
          <Field label="Name" full error={errors.full_name?.message}>
            <input className={inputCls} {...register('full_name')} />
          </Field>
          {showArea && (
            <>
              <Field label="Area">
                <input className={inputCls} {...register('area')} />
              </Field>
              <Field label="HQ">
                <select className={inputCls} {...register('hq')}>
                  <option value="">Not set</option>
                  {profile.hq && !hqs.data?.some((h) => h.value === profile.hq) && (
                    <option value={profile.hq}>{profile.hq}</option>
                  )}
                  {hqs.data?.map((h) => (
                    <option key={h.id} value={h.value}>
                      {h.value}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          {showBio && (
            <Field label="Bio" full error={errors.bio?.message}>
              <textarea rows={3} className={inputCls} {...register('bio')} />
            </Field>
          )}
        </div>
        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={
              message.kind === 'error' ? 'mt-3 text-sm text-danger' : 'mt-3 text-sm text-ok'
            }
          >
            {message.text}
          </p>
        )}
        <button className={`${primaryBlock} mt-4`} disabled={isSubmitting || !isDirty}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {profile.role === 'driver' && <LeaveRequests />}

      <button
        type="button"
        className="btn btn-ghost btn-block mt-4"
        onClick={() => setConfirmOut(true)}
      >
        <LogOut aria-hidden /> Sign out
      </button>
      <ConfirmDialog
        open={confirmOut}
        title="Sign out?"
        description="You’ll need to sign in again to use LAIRON EZ."
        confirmLabel="Sign out"
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false)
          void signOut()
        }}
      />
    </div>
  )
}
