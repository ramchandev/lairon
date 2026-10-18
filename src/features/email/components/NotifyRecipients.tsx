import { useState } from 'react'
import { useToast } from '@/components/Toast'
import { inputCls, primaryBtn } from '@/components/form-styles'
import { parseEmails } from '../labels'
import { useNotifyEmails, useSaveNotifyEmails } from '../api'

/** Who receives "new request" emails. Left empty, every active admin gets them. */
export function NotifyRecipients() {
  const { data, isLoading } = useNotifyEmails()
  if (isLoading) return <div className="glass h-28 animate-pulse" aria-busy="true" />
  return <Form initial={(data ?? []).join(', ')} />
}

function Form({ initial }: { initial: string }) {
  const toast = useToast()
  const save = useSaveNotifyEmails()
  const [text, setText] = useState(initial)
  const { emails, invalid } = parseEmails(text)
  const dirty = text.trim() !== initial.trim()
  return (
    <section className="glass space-y-3 p-4">
      <div>
        <h2 className="font-extrabold">Notification recipients</h2>
        <p className="text-sm text-muted">
          These addresses get an email when a service request, starter pack or leave request needs
          attention. Leave empty to send to every active admin.
        </p>
      </div>
      <label className="block text-sm font-semibold">
        Email addresses
        <textarea
          rows={2}
          className={`${inputCls} mt-1`}
          placeholder="ops@lairon.in, boss@lairon.in"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {invalid.length > 0 && (
        <p role="alert" className="text-sm text-danger">
          These don’t look like email addresses: {invalid.join(', ')}
        </p>
      )}
      <button
        className={`${primaryBtn} w-auto! px-5`}
        disabled={!dirty || invalid.length > 0 || save.isPending}
        onClick={() =>
          save.mutate(emails, {
            onSuccess: () =>
              toast(
                emails.length
                  ? `Saved ${emails.length} recipients`
                  : 'Saved — all active admins will be notified',
              ),
            onError: () => toast('Could not save', 'error'),
          })
        }
      >
        {save.isPending ? 'Saving…' : 'Save recipients'}
      </button>
    </section>
  )
}
