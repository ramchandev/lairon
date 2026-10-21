import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Copy, Eye, EyeOff, FileText, UserRound, Wand2 } from 'lucide-react'
import { generatePassword } from '@/lib/password'
import { loginInfoText } from '../loginInfo'
import { Field, FormPage, Section } from '@/components/FormPage'
import { PhotoField } from '@/components/PhotoField'
import { useToast } from '@/components/Toast'
import { saveAvatar } from '@/lib/avatar'
import { inputCls } from '@/components/form-styles'
import { useLookup } from '@/features/lookups/hooks'
import { formatPhone } from '@/lib/phone'
import { useCreateUser, useUpdateUser, useUser } from '../api'
import { visibleEmail } from '../components'
import { useSubTitle } from '@/layouts/chrome'
import {
  MIN_PASSWORD,
  ROLE_META,
  roleListUrl,
  userSchema,
  type ManagedRole,
  type UserForm,
} from '../schemas'

export function UserFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const user = useUser(id)
  if (id && user.isLoading) return <p className="text-muted">Loading…</p>
  if (id && !user.data) return <p className="glass p-5">User not found.</p>

  const role = (id ? user.data!.role : (params.get('role') as ManagedRole)) as ManagedRole
  if (!ROLE_META[role]) return <p className="glass p-5">Unknown role.</p>
  const u = user.data
  const defaults: UserForm = {
    full_name: u?.full_name ?? '',
    phone: u ? formatPhone(u.phone).replace('+91 ', '') : '',
    email: visibleEmail(u?.email ?? null) ?? '',
    area: u?.area ?? '',
    hq: u?.hq ?? '',
    bio: u?.bio ?? '',
    password: '',
  }
  return <Inner id={id} role={role} defaults={defaults} avatarUrl={u?.avatar_url ?? null} />
}

function Inner({
  id,
  role,
  defaults,
  avatarUrl,
}: {
  id?: string
  role: ManagedRole
  defaults: UserForm
  avatarUrl: string | null
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const hqs = useLookup('hq')
  const create = useCreateUser(role)
  const update = useUpdateUser(id ?? '', role)
  const [link, setLink] = useState<string | null>(null)
  const meta = ROLE_META[role]
  useSubTitle(`${id ? 'Edit' : 'Add'} ${meta.label}`) // "Add Staff", "Edit Driver" … as in the approved HTML
  const emailLocked = !!id && role !== 'manager' // login identity
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isDirty },
  } = useForm<UserForm>({ resolver: zodResolver(userSchema(role, !!id)), defaultValues: defaults })
  const fullName = useWatch({ control, name: 'full_name' })
  const passwordValue = useWatch({ control, name: 'password' })
  const emailValue = useWatch({ control, name: 'email' })
  // A locked (disabled) email field drops out of the form values, so fall back to the saved one.
  const loginEmail = (emailValue || defaults.email || '').trim()
  const back = () => navigate(roleListUrl(role), { replace: true })

  const [showPw, setShowPw] = useState(false)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const photoChanged = !!photo || photoRemoved
  // Photo is saved after the profile itself; a failure only warns, the user is already saved.
  async function savePhoto(userId: string) {
    if (!photoChanged) return
    try {
      await saveAvatar(userId, photo)
      await qc.invalidateQueries({ queryKey: ['users'] })
    } catch {
      toast('Saved, but the photo could not be uploaded', 'error')
    }
  }

  const onSubmit = handleSubmit((v) => {
    if (id) {
      update.mutate(v, {
        onSuccess: async () => {
          await savePhoto(id)
          toast('User updated')
          back()
        },
        onError: (e) => toast(e.message, 'error'),
      })
    } else {
      create.mutate(v, {
        onSuccess: async (r) => {
          await savePhoto(r.id)
          if (r.invite_link) setLink(r.invite_link)
          else {
            toast(
              role === 'manager'
                ? 'Doctor’s Manager added'
                : role === 'driver'
                  ? 'Driver added — they can sign in with the password you set'
                  : 'User added — invite email sent',
            )
            back()
          }
        },
        onError: (e) => toast(e.message, 'error'),
      })
    }
  })

  return (
    <FormPage
      title={id ? `Edit ${meta.label.toLowerCase()}` : `Add ${meta.label.toLowerCase()}`}
      saveLabel={id ? 'Save changes' : `Save ${meta.label.toLowerCase()}`}
      dirty={(isDirty || photoChanged) && !link}
      saving={create.isPending || update.isPending}
      onSubmit={onSubmit}
    >
      <Section title="Profile" icon={UserRound}>
        {role !== 'manager' && (
          <PhotoField
            name={fullName}
            current={avatarUrl}
            blob={photo}
            removed={photoRemoved}
            onPick={(b) => {
              setPhoto(b)
              setPhotoRemoved(false)
            }}
            onRemove={() => {
              setPhoto(null)
              setPhotoRemoved(true)
            }}
            onError={(m) => toast(m, 'error')}
          />
        )}
        <Field label="Full name" required error={errors.full_name?.message}>
          <input className={inputCls} placeholder="e.g. Karthik Raman" {...register('full_name')} />
        </Field>
        <Field
          label="Phone"
          required
          error={errors.phone?.message}
          hint={role === 'manager' ? 'Managers sign in with this number only.' : undefined}
        >
          <div className="input-group">
            <span className="prefix">+91</span>
            <input
              className={`${inputCls} mono`}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              autoComplete="off"
              placeholder="10-digit mobile"
              {...register('phone')}
            />
          </div>
        </Field>
        <Field
          label="Email"
          required={role !== 'manager'}
          error={errors.email?.message}
          hint={
            emailLocked
              ? 'Email is the login identity and can’t be changed here.'
              : role !== 'manager'
                ? role === 'driver'
                  ? 'The driver signs in with this email and the password below. No email is sent.'
                  : 'Login invite will be sent to this email.'
                : undefined
          }
        >
          <input
            className={inputCls}
            type="email"
            autoComplete="email"
            placeholder="name@lairon.in"
            disabled={emailLocked}
            {...register('email')}
          />
        </Field>
        {role === 'driver' && (
          <Field
            full
            label={id ? 'New password' : 'Password'}
            required={!id}
            error={errors.password?.message}
            hint={
              id
                ? 'Leave blank to keep the current password. Setting one signs the driver out of other devices.'
                : `At least ${MIN_PASSWORD} characters. Tell the driver; they can’t see it again.`
            }
          >
            <div className="flex gap-2">
              <div className="input-group min-w-0 flex-1">
                <input
                  className={`${inputCls} mono !rounded-r-none`}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="btn btn-ghost !rounded-l-none"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPw((s) => !s)}
                >
                  {showPw ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </button>
              </div>
              <button
                type="button"
                className="btn btn-ghost shrink-0"
                onClick={() => {
                  setValue('password', generatePassword(), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                  setShowPw(true)
                }}
              >
                <Wand2 aria-hidden /> Generate
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost mt-2 w-full sm:w-auto"
              disabled={!passwordValue || !loginEmail}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    loginInfoText({
                      name: fullName,
                      url: window.location.origin,
                      email: loginEmail,
                      password: passwordValue,
                    }),
                  )
                  toast('Login info copied — paste it into a message')
                } catch {
                  toast('Could not copy to the clipboard', 'error')
                }
              }}
            >
              <Copy aria-hidden /> Copy Full Login Info
            </button>
          </Field>
        )}
        {meta.hasArea && (
          <Field label="Area">
            <input className={inputCls} placeholder="e.g. Velachery" {...register('area')} />
          </Field>
        )}
        {role === 'manager' && (
          <Field label="HQ">
            <select className={inputCls} {...register('hq')}>
              <option value="">Select hq</option>
              {defaults.hq && !hqs.data?.some((h) => h.value === defaults.hq) && (
                <option value={defaults.hq}>{defaults.hq}</option>
              )}
              {hqs.data?.map((h) => (
                <option key={h.id} value={h.value}>
                  {h.value}
                </option>
              ))}
            </select>
          </Field>
        )}
      </Section>
      {meta.hasBio && (
        <Section title="About" icon={FileText}>
          <Field label="Bio" full error={errors.bio?.message}>
            <textarea
              rows={4}
              className={inputCls}
              placeholder="Short introduction, experience, divisions handled…"
              {...register('bio')}
            />
          </Field>
        </Section>
      )}

      {link && (
        <ConfirmDialog
          open
          tone="primary"
          title="User created — email couldn’t be sent"
          confirmLabel="Copy link"
          description={
            <>
              <p>Share this one-time link so they can set their password:</p>
              <p className="mt-2 break-all rounded-lg bg-muted-bg p-2 text-xs">{link}</p>
            </>
          }
          onCancel={back}
          onConfirm={() => {
            void navigator.clipboard?.writeText(link)
            toast('Link copied')
            back()
          }}
        />
      )}
    </FormPage>
  )
}
