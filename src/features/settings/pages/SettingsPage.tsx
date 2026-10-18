import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { PageHeader } from '@/components/FormPage'
import { useToast } from '@/components/Toast'
import { inputCls } from '@/components/form-styles'
import { AdminsSection } from '../components/AdminsSection'
import { useAppSettings, useSaveSetting, type AppSettings } from '../api'
import { MAX_WINDOW, MIN_WINDOW, validateCompany, validateWindow } from '../validation'

function Card({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="glass form-card space-y-3.5">
      <div>
        <h2 className="sec-t !mb-1">{title}</h2>
        {hint && <p className="muted text-sm">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

export function SettingsPage() {
  const { data, isLoading } = useAppSettings()
  return (
    <div className="mx-auto max-w-[824px]">
      <PageHeader title="Settings" subtitle="Company details, driver rules and admin accounts." />
      {isLoading || !data ? (
        <div className="glass h-40 animate-pulse" aria-busy="true" />
      ) : (
        <Form settings={data} />
      )}
      <Card
        title="Notification emails"
        hint="Who receives new-request emails, and a log of everything sent."
      >
        <Link to="/admin/email-log" className="btn btn-ghost">
          <Mail aria-hidden /> Open Email log &amp; recipients
        </Link>
      </Card>
      <AdminsSection />
    </div>
  )
}

function Form({ settings }: { settings: AppSettings }) {
  const toast = useToast()
  const save = useSaveSetting()
  const [company, setCompany] = useState(settings.company_name)
  const [days, setDays] = useState(String(settings.driver_edit_window_days))
  const companyErr = validateCompany(company)
  const daysErr = validateWindow(days)

  function submit(e: FormEvent, key: keyof AppSettings, value: string | number, ok: string) {
    e.preventDefault()
    save.mutate(
      { key, value },
      { onSuccess: () => toast(ok), onError: () => toast('Could not save', 'error') },
    )
  }

  return (
    <>
      <form
        onSubmit={(e) => submit(e, 'company_name', company.trim(), 'Company name saved')}
        noValidate
      >
        <Card
          title="Company"
          hint="Printed at the top of PDFs (starter packs, service requests, duty sheets, beta summary)."
        >
          <label className="field">
            <span className="lbl">Company name</span>
            <input
              className={inputCls}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            {companyErr && (
              <span role="alert" className="err">
                {companyErr}
              </span>
            )}
          </label>
          <button
            className="btn btn-primary"
            disabled={!!companyErr || company.trim() === settings.company_name || save.isPending}
          >
            Save company
          </button>
        </Card>
      </form>

      <form
        onSubmit={(e) => submit(e, 'driver_edit_window_days', Number(days), 'Edit window saved')}
        noValidate
      >
        <Card
          title="Driver app"
          hint="How many days back a driver can add or change their own duties, week offs and leave. After that only an admin can."
        >
          <label className="field">
            <span className="lbl">Driver edit window (days)</span>
            <input
              className={`${inputCls} mono !w-32`}
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
            {daysErr ? (
              <span role="alert" className="err">
                {daysErr}
              </span>
            ) : (
              <span className="hint">
                {MIN_WINDOW}–{MAX_WINDOW} days. Currently {settings.driver_edit_window_days}.
              </span>
            )}
          </label>
          <button
            className="btn btn-primary"
            disabled={
              !!daysErr || Number(days) === settings.driver_edit_window_days || save.isPending
            }
          >
            Save edit window
          </button>
        </Card>
      </form>
    </>
  )
}
