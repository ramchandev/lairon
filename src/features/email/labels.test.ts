import { canRetry, parseEmails, templateLabel } from './labels'

describe('email log helpers', () => {
  it('labels known templates and falls back to the raw name for system events', () => {
    expect(templateLabel('leave_applied')).toBe('Leave applied')
    expect(templateLabel('leave.applied')).toBe('leave.applied')
  })
  it('only failed/pending emails with an address can be retried, never the welcome link', () => {
    expect(canRetry({ status: 'failed', template: 'leave_applied', to: 'a@x.in' })).toBe(true)
    expect(canRetry({ status: 'pending', template: 'leave_applied', to: 'a@x.in' })).toBe(true)
    expect(canRetry({ status: 'sent', template: 'leave_applied', to: 'a@x.in' })).toBe(false)
    expect(canRetry({ status: 'failed', template: 'welcome', to: 'a@x.in' })).toBe(false)
    expect(canRetry({ status: 'failed', template: 'leave.applied', to: '(none)' })).toBe(false)
  })
  it('parses a pasted list of emails', () => {
    expect(parseEmails('A@x.in, b@x.in;\n a@x.in  nope')).toEqual({
      emails: ['a@x.in', 'b@x.in'],
      invalid: ['nope'],
    })
    expect(parseEmails('')).toEqual({ emails: [], invalid: [] })
  })
})
