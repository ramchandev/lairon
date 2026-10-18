import { parseUsers, USER_FIELDS, type UserCtx } from '@/features/users/import/parseUsers'
import {
  parseRequests,
  SR_FIELDS,
  toRequestsPayload,
  type SrCtx,
} from '@/features/service-requests/import/parseRequests'
import {
  parsePacks,
  SP_FIELDS,
  toPacksPayload,
  type SpCtx,
} from '@/features/starter-packs/import/parsePacks'
import { toRecords } from './sheet'

const sheet = (fields: Parameters<typeof toRecords>[1], aoa: unknown[][]) => toRecords(aoa, fields)

describe('sheet reading', () => {
  it('matches headers by label, key or alias (case/space/punctuation-insensitive) and lists the rest', () => {
    const { records, unknown, missing } = sheet(USER_FIELDS, [
      ['FULL NAME', 'Mobile No.', 'e-mail id', 'Remarks'],
      ['A', '9840122345', 'a@x.in', 'x'],
      [null, null, null, null],
    ])
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      full_name: 'A',
      phone: '9840122345',
      email: 'a@x.in',
      __line: 2,
    })
    expect(unknown).toEqual(['Remarks'])
    expect(missing).toContain('role')
  })
})

describe('users import', () => {
  const ctx: UserCtx = {
    defaultRole: 'staff',
    existingPhones: new Set(['+919000000001']),
    existingEmails: new Set(['taken@x.in']),
    hqs: ['CHN', 'CBE'],
  }
  const run = (rows: unknown[][], c = ctx) =>
    parseUsers(
      sheet(USER_FIELDS, [['Role', 'Full Name', 'Phone', 'Email', 'HQ'], ...rows]).records,
      c,
    ).rows
  const errs = (r: { issues: { severity: string; message: string }[] }) =>
    r.issues.filter((i) => i.severity === 'error').map((i) => i.message)

  it('accepts good rows, defaults the role, normalises the phone and the HQ spelling', () => {
    const [a, b] = run([
      ['', 'Karthik', 9840122345, 'k@x.in', 'chn'],
      ['Driver', 'Ravi', '+91 98840 33456', 'r@x.in', ''],
    ])
    expect(errs(a)).toEqual([])
    expect(a).toMatchObject({ role: 'staff', phone: '+919840122345', hq: 'CHN' })
    expect(b).toMatchObject({ role: 'driver', phone: '+919884033456' })
  })
  it('rejects bad phones, duplicates (file and existing), missing email, Super Admin and unknown roles', () => {
    const rows = run([
      ['Staff', 'A', '12345', 'a@x.in', ''],
      ['Staff', 'B', '9000000001', 'b@x.in', ''],
      ['Staff', 'C', '9840122345', 'taken@x.in', ''],
      ['Staff', 'D', '9840122345', 'd@x.in', ''],
      ['Staff', 'E', '9840122346', '', ''],
      ['Super Admin', 'F', '9840122347', 'f@x.in', ''],
      ['Pilot', 'G', '9840122348', 'g@x.in', ''],
    ])
    expect(errs(rows[0])[0]).toMatch(/not a valid 10-digit/)
    expect(errs(rows[1])[0]).toMatch(/already belongs/)
    expect(errs(rows[2])[0]).toMatch(/taken@x.in already belongs/)
    expect(errs(rows[3])[0]).toMatch(/Same phone as row 4/)
    expect(errs(rows[4])[0]).toMatch(/Email is required/)
    expect(errs(rows[5])[0]).toMatch(/Super Admins can’t be imported/)
    expect(errs(rows[6])[0]).toMatch(/Unknown role/)
  })
  it('a Manager needs no email; an unknown HQ is only a warning', () => {
    const [m] = run([['Manager', 'Anitha', '9790011223', '', 'XYZ']])
    expect(errs(m)).toEqual([])
    expect(m.issues.map((i) => i.severity)).toEqual(['warning'])
  })
  it('without a default role the Role column is required', () => {
    const [r] = run([['', 'A', '9840122345', 'a@x.in', '']], { ...ctx, defaultRole: null })
    expect(errs(r)[0]).toMatch(/Role is missing/)
  })
})

describe('service request import', () => {
  const ctx: SrCtx = {
    managers: [{ id: 'm1', full_name: 'Anitha Rao', phone: '+919790011223' }],
    staff: [{ id: 's1', full_name: 'Karthik Raman', phone: '+919840122345' }],
    doctors: [{ id: 'd1', name: 'Dr. Rakshana', manager_id: 'm1' }],
    existingRefs: new Set(['SR-2609-0001']),
    hqs: ['CHN'],
    serviceTypes: ['CME', 'Camp'],
    offerTypes: ['Offer', 'Netrate'],
    divisions: ['OL'],
  }
  const head = [
    'Request No',
    'Manager',
    'Accountability',
    'Status',
    'Admin Note',
    'Service Date',
    'Doctor Name',
    'Area',
    'Hospital',
    'HQ',
    'Division',
    'Qualification',
    'Speciality',
    'Service Amount',
    'Service Type',
    'Expected Business Value',
    'Current Business Value',
    'Offer / Netrate',
    'Offer %',
    'Netrate Amount',
  ]
  const line = (o: Record<string, unknown> = {}) => {
    const base: Record<string, unknown> = {
      'Request No': '',
      Manager: 'Anitha Rao',
      Accountability: '9840122345',
      Status: 'Fulfilled',
      'Admin Note': '',
      'Service Date': '10/09/2026',
      'Doctor Name': 'Dr. Rakshana',
      Area: 'T. Nagar',
      Hospital: 'Apollo',
      HQ: 'chn',
      Division: 'OL',
      Qualification: 'MD',
      Speciality: 'Cardiology',
      'Service Amount': 5000,
      'Service Type': 'cme',
      'Expected Business Value': 20000,
      'Current Business Value': 10000,
      'Offer / Netrate': 'Offer',
      'Offer %': 10,
      'Netrate Amount': '',
    }
    return head.map((h) => ({ ...base, ...o })[h])
  }
  const run = (...rows: unknown[][]) =>
    parseRequests(sheet(SR_FIELDS, [head, ...rows]).records, ctx).rows
  const errs = (r: { issues: { severity: string; message: string }[] }) =>
    r.issues.filter((i) => i.severity === 'error').map((i) => i.message)

  it('reads a valid row, links the doctor and canonicalises HQ and service type', () => {
    const [r] = run(line())
    expect(errs(r)).toEqual([])
    expect(r).toMatchObject({ manager_id: 'm1', staff_id: 's1', status: 'fulfilled' })
    expect(r.service).toMatchObject({
      doctor_id: 'd1',
      hq: 'CHN',
      service_type: 'CME',
      offer_percent: 10,
    })
  })
  it('checks people, status, offer rules, amounts and existing numbers', () => {
    const rows = run(
      line({ Manager: 'Nobody' }),
      line({ Accountability: 'Nobody' }),
      line({ Status: 'Rejected' }),
      line({ 'Offer % ': 0, 'Offer %': '' }),
      line({ 'Offer / Netrate': 'Netrate', 'Netrate Amount': '' }),
      line({ 'Service Amount': 'abc' }),
      line({ 'Request No': 'sr-2609-0001' }),
    )
    expect(errs(rows[0])[0]).toMatch(/Manager “Nobody” not found/)
    expect(errs(rows[1])[0]).toMatch(/Staff “Nobody” not found/)
    expect(errs(rows[2])[0]).toMatch(/needs an Admin Note/)
    expect(errs(rows[3])[0]).toMatch(/Offer %/)
    expect(errs(rows[4])[0]).toMatch(/Netrate amount is required/)
    expect(errs(rows[5])[0]).toMatch(/Service amount/)
    expect(errs(rows[6])[0]).toMatch(/already exists/)
  })
  it('groups rows into requests (same Request No, or same manager/staff/status/date) for the payload', () => {
    const rows = run(
      line({ 'Request No': 'SR-2609-0100' }),
      line({ 'Request No': 'SR-2609-0100', 'Service Type': 'Camp' }),
      line(),
      line(),
      line({ 'Service Date': '12/09/2026' }),
    )
    const p = toRequestsPayload(rows, 'f.xlsx')
    expect(p.requests.map((r) => r.services.length)).toEqual([2, 2, 1])
    expect(p.requests[0]).toMatchObject({
      ref_no: 'SR-2609-0100',
      manager_id: 'm1',
      status: 'fulfilled',
    })
  })
  it('rows sharing a Request No must agree on manager, staff and status', () => {
    const rows = run(
      line({ 'Request No': 'SR-1' }),
      line({ 'Request No': 'SR-1', Status: 'Approved' }),
    )
    expect(errs(rows[1])[0]).toMatch(/Same Request No as row 2/)
  })
})

describe('starter pack import', () => {
  const ctx: SpCtx = {
    staff: [{ id: 's1', full_name: 'Karthik Raman', phone: '+919840122345', area: 'Velachery' }],
    doctors: [{ id: 'd1', name: 'Dr. Anitha Rao' }],
    products: [{ id: 'p1', name: 'Rosvalar-10' }],
    divisions: ['OL'],
    existingRefs: new Set(['SP-2609-0001']),
  }
  const head = [
    'Request No',
    'Date',
    'Doctor Name',
    'Qualification',
    'Doctor Area',
    'Staff',
    'Staff Area',
    'Division',
    'Status',
    'Admin Note',
    'Product',
    'Quantity',
  ]
  const line = (o: Record<string, unknown> = {}) => {
    const base: Record<string, unknown> = {
      'Request No': '',
      Date: '11/09/2026',
      'Doctor Name': 'dr. anitha rao',
      Qualification: 'MD',
      'Doctor Area': 'Anna Nagar',
      Staff: 'Karthik Raman',
      'Staff Area': '',
      Division: 'ol',
      Status: 'Fulfilled',
      'Admin Note': '',
      Product: 'rosvalar-10',
      Quantity: '2 boxes',
    }
    return head.map((h) => ({ ...base, ...o })[h])
  }
  const run = (...rows: unknown[][]) =>
    parsePacks(sheet(SP_FIELDS, [head, ...rows]).records, ctx).rows
  const errs = (r: { issues: { severity: string; message: string }[] }) =>
    r.issues.filter((i) => i.severity === 'error').map((i) => i.message)

  it('links doctor, staff and product, defaults the staff area and canonicalises division', () => {
    const [r] = run(line())
    expect(errs(r)).toEqual([])
    expect(r).toMatchObject({
      doctor_id: 'd1',
      staff_id: 's1',
      staff_area: 'Velachery',
      division: 'OL',
      product_id: 'p1',
      product_name: 'Rosvalar-10',
      status: 'fulfilled',
    })
  })
  it('an unknown product is a warning, not an error; missing quantity and cancelled-without-note are errors', () => {
    const rows = run(
      line({ Product: 'Mystery' }),
      line({ Quantity: '' }),
      line({ Status: 'Cancelled' }),
      line({ 'Request No': 'SP-2609-0001' }),
    )
    expect(errs(rows[0])).toEqual([])
    expect(rows[0].issues[0].severity).toBe('warning')
    expect(errs(rows[1])[0]).toMatch(/Quantity is missing/)
    expect(errs(rows[2])[0]).toMatch(/needs an Admin Note/)
    expect(errs(rows[3])[0]).toMatch(/already exists/)
  })
  it('groups product rows into one pack', () => {
    const p = toPacksPayload(
      run(line(), line({ Product: 'Rosvalar-20', Quantity: '1' }), line({ Date: '12/09/2026' })),
      'f',
    )
    expect(p.packs.map((x) => x.items.length)).toEqual([2, 1])
    expect(p.packs[0]).toMatchObject({
      staff_id: 's1',
      status: 'fulfilled',
      request_date: '2026-09-11',
    })
  })
})
