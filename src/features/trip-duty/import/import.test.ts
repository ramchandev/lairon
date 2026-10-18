import { buildPlan, toPayload } from './plan'
import {
  parseSheet,
  parseDate,
  parseTime,
  parseMinutes,
  detectFromFileName,
  matchDriver,
  serialToDate,
  parseMonthCell,
} from './parse'
import { TEMPLATE_EXAMPLES, TEMPLATE_HEADER } from './template'
import { withFileName } from './readFile'

const vehicles = [
  { id: 'v-amaze', name: 'AMAZE', vehicle_number: 'TN00XX6960' },
  { id: 'v-crysta', name: 'CRYSTA', vehicle_number: 'TN09AB6435' },
]
const rates = [{ effective_from: '2026-04-01', local_rate: 250, outstation_rate: 300 }]

/** Excel serial for a yyyy-mm-dd date. */
const serial = (d: string) =>
  Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000 + 25569

/**
 * The real LAIRON sheet ("PRAKALATHAN.M — September_2026.xlsx", columns Date · Vehicle · Guest · Total KM · Total Hours · Month),
 * rebuilt from the plan's description: 30 rows = 27 duties + 3 week offs (6, 21, 22 Sep); 14 Sep has two duties
 * (Own / Dr. Rakshana and AMAZE 6960 / Dr. Jaswanth, 93 km); 24 Sep vehicle "Audi"; no entry on 23 Sep.
 */
function septemberSheet(): unknown[][] {
  const head = ['Date', 'Vehicle', 'Guest', 'Total KM', 'Total Hours', 'Month']
  const body: unknown[][] = []
  for (let day = 1; day <= 30; day++) {
    if (day === 23) continue
    const date = `2026-09-${String(day).padStart(2, '0')}`
    const m = 'September_2026'
    if ([6, 21, 22].includes(day)) {
      body.push([serial(date), '-', 'WEEKOFF', '-', '-', m])
      continue
    }
    if (day === 14) {
      body.push([serial(date), 'Own', 'Dr. Rakshana', '-', '8 hrs 15 mins', m])
      body.push([serial(date), 'AMAZE 6960', 'Dr. Jaswanth', 93, '9 hrs 30 mins', m])
      continue
    }
    body.push([
      serial(date),
      day === 24 ? 'Audi' : 'AMAZE 6960',
      `Dr. Guest ${day}`,
      40 + day,
      '9 hrs 30 mins',
      m,
    ])
  }
  return [head, ...body]
}

describe('cell parsers', () => {
  it('reads Excel serial dates in UTC without shifting the day', () => {
    expect(serialToDate(serial('2026-09-01'))).toBe('2026-09-01')
    expect(parseDate(serial('2026-12-31'))).toBe('2026-12-31')
    expect(parseDate(serial('2026-09-01') + 0.9)).toBe('2026-09-01')
  })
  it('reads text dates: dd/mm/yyyy, yyyy-mm-dd, d-Mon-yyyy; rejects junk and impossible dates', () => {
    expect(parseDate('01/09/2026')).toBe('2026-09-01')
    expect(parseDate('1-9-26')).toBe('2026-09-01')
    expect(parseDate('2026-09-01')).toBe('2026-09-01')
    expect(parseDate('1 Sep 2026')).toBe('2026-09-01')
    expect(parseDate('31/02/2026')).toBeNull()
    expect(parseDate('tomorrow')).toBeNull()
    expect(parseDate('-')).toBeNull()
  })
  it('reads durations in every supported shape', () => {
    expect(parseMinutes('9 hrs 30 mins')).toBe(570)
    expect(parseMinutes('9 hrs')).toBe(540)
    expect(parseMinutes('45 mins')).toBe(45)
    expect(parseMinutes('9:30')).toBe(570)
    expect(parseMinutes(0.3958333333)).toBe(570) // Excel time
    expect(parseMinutes(9.5)).toBe(570) // hours
    expect(parseMinutes('-')).toBeNull()
  })
  it('reads clock times', () => {
    expect(parseTime('09:30')).toBe('09:30')
    expect(parseTime('9:30 PM')).toBe('21:30')
    expect(parseTime('12:05 AM')).toBe('00:05')
    expect(parseTime(0.375)).toBe('09:00')
    expect(parseTime('25:00')).toBeNull()
  })
  it('detects driver and month from the file name and month cells', () => {
    expect(detectFromFileName('PRAKALATHAN.M — September_2026.xlsx')).toEqual({
      driverName: 'PRAKALATHAN.M',
      month: '2026-09',
    })
    expect(detectFromFileName('RAVIKUMAR.N - Oct 2026.csv')).toEqual({
      driverName: 'RAVIKUMAR.N',
      month: '2026-10',
    })
    expect(detectFromFileName('Driver-data.xlsx')).toEqual({ driverName: null, month: null })
    expect(parseMonthCell('September_2026')).toBe('2026-09')
    expect(parseMonthCell('2026-10')).toBe('2026-10')
    expect(
      matchDriver('prakalathan.m', [{ full_name: 'PRAKALATHAN.M' }, { full_name: 'VIGNESH.P' }])
        ?.full_name,
    ).toBe('PRAKALATHAN.M')
  })
})

describe('September 2026 sheet (PRAKALATHAN.M) — the plan’s import test', () => {
  const parsed = withFileName(
    'PRAKALATHAN.M — September_2026.xlsx',
    parseSheet(septemberSheet(), vehicles),
  )
  const plan = buildPlan({
    rows: parsed.rows,
    month: '2026-09',
    mode: 'replace',
    existing: [],
    rates,
    today: '2026-10-18',
  })

  it('detects month and driver and has no fatal problem', () => {
    expect(parsed.fatal).toBeNull()
    expect(parsed.detected).toEqual({ driverName: 'PRAKALATHAN.M', month: '2026-09' })
    expect(parsed.unknownColumns).toEqual([])
  })
  it('reads 30 rows: 27 duties + 3 week offs, no errors', () => {
    expect(plan.counts).toMatchObject({ read: 30, duties: 27, weekOffs: 3, leaves: 0, errors: 0 })
    expect(plan.willImport).toBe(30)
  })
  it('previews 26 payable days = ₹6,500 (all Local, two duties on 14 Sep count once)', () => {
    expect(plan.beta).toMatchObject({
      payableDays: 26,
      localDays: 26,
      outstationDays: 0,
      total: 6500,
    })
  })
  it('reports the gap on 23 Sep and the 14 Sep multiple-duty note, and a note that everything counts as Local', () => {
    expect(plan.gaps).toEqual(['2026-09-23'])
    expect(plan.issues.some((i) => i.message.includes('2 duties on 2026-09-14'))).toBe(true)
    expect(plan.issues.some((i) => i.message.includes('all 27 duties counted as Local'))).toBe(true)
  })
  it('classifies vehicles: Own, fleet (linked) and Audi as Others', () => {
    const byLine = (n: number) => parsed.rows.find((r) => r.line === n)!
    const own = parsed.rows.find((r) => r.guest === 'Dr. Rakshana')!
    expect(own.vehicleKind).toBe('own')
    expect(parsed.rows.find((r) => r.guest === 'Dr. Jaswanth')).toMatchObject({
      vehicleKind: 'fleet',
      totalKm: 93,
      totalMinutes: 570,
    })
    const audi = parsed.rows.find((r) => r.vehicle === 'Audi')!
    expect(audi.vehicleKind).toBe('other')
    expect(plan.issues.some((i) => i.severity === 'note' && i.message.includes('Audi'))).toBe(true)
    expect(byLine(2).date).toBe('2026-09-01')
  })
  it('builds the payload the database function takes', () => {
    const p = toPayload(plan, {
      fileName: 'x.xlsx',
      driverId: 'drv',
      month: '2026-09',
      mode: 'replace',
    })
    expect(p).toMatchObject({ driver_id: 'drv', month: '2026-09-01', mode: 'replace' })
    expect(p.rows).toHaveLength(30)
    expect(p.rows.filter((r) => r.entry_type === 'week_off').map((r) => r.entry_date)).toEqual([
      '2026-09-06',
      '2026-09-21',
      '2026-09-22',
    ])
    expect(p.rows.every((r) => r.entry_type !== 'duty' || r.duty_type === 'Local')).toBe(true)
  })
})

describe('row rules and checks', () => {
  const sheet = (rows: unknown[][], head: string[] = ['Date', 'Vehicle', 'Guest', 'Duty Type']) =>
    parseSheet([head, ...rows], vehicles)
  const plan = (
    rows: unknown[][],
    opts: Partial<Parameters<typeof buildPlan>[0]> = {},
    head?: string[],
  ) =>
    buildPlan({
      rows: sheet(rows, head).rows,
      month: '2026-10',
      mode: 'fill',
      existing: [],
      rates,
      today: '2026-11-30',
      ...opts,
    })

  it('week off / leave keywords in guest, vehicle or entry type', () => {
    const p = sheet([
      ['01/10/2026', '-', 'Week off', ''],
      ['02/10/2026', 'leave', '-', ''],
      ['03/10/2026', '-', 'Absent', ''],
      ['04/10/2026', 'AMAZE 6960', 'Dr. Leaveen', ''],
    ])
    expect(p.rows.map((r) => r.entryType)).toEqual(['week_off', 'leave', 'leave', 'duty'])
  })
  it('an unreadable date is an error and skips the row', () => {
    const p = plan([
      ['soon', 'Own', 'Dr A', 'Local'],
      ['02/10/2026', 'Own', 'Dr B', 'Local'],
    ])
    expect(p.counts.errors).toBe(1)
    expect(p.willImport).toBe(1)
  })
  it('a duty and a week off on the same date is an error', () => {
    const p = plan([
      ['05/10/2026', 'Own', 'Dr A', 'Local'],
      ['05/10/2026', '-', 'Week off', ''],
    ])
    expect(p.counts.errors).toBe(2)
    expect(p.willImport).toBe(0)
  })
  it('warns about dates outside the month and fleet duties without KM, and drops an invalid KM pair', () => {
    const p = plan([
      ['01/11/2026', 'Own', 'Dr A', 'Local'],
      ['02/10/2026', 'AMAZE 6960', 'Dr B', 'Local'],
    ])
    expect(p.issues.filter((i) => i.severity === 'warning').map((i) => i.message)).toEqual(
      expect.arrayContaining(['Date 2026-11-01 is outside 2026-10', 'Fleet vehicle without KM']),
    )
    const bad = sheet(
      [['02/10/2026', 'AMAZE 6960', 'Dr B', 'Local', 500, 400]],
      ['Date', 'Vehicle', 'Guest', 'Duty Type', 'Starting KM', 'Ending KM'],
    )
    expect(bad.rows[0]).toMatchObject({ startKm: null, endKm: null })
    expect(bad.rows[0].issues.some((i) => i.severity === 'warning')).toBe(true)
  })
  it('Outstation wins the day and rates apply from their effective date', () => {
    const r2 = [
      { effective_from: '2026-04-01', local_rate: 250, outstation_rate: 300 },
      { effective_from: '2026-10-15', local_rate: 300, outstation_rate: 350 },
    ]
    const p = plan(
      [
        ['01/10/2026', 'Own', 'A', 'Local'],
        ['01/10/2026', 'Own', 'B', 'Out Station'],
        ['20/10/2026', 'Own', 'C', 'Local'],
      ],
      { rates: r2 },
    )
    expect(p.beta).toMatchObject({
      payableDays: 2,
      outstationDays: 1,
      localDays: 1,
      total: 300 + 300,
    })
  })
  it('fill mode skips days that already have entries; replace mode counts what it will delete', () => {
    const existing = [
      { entry_date: '2026-10-02', entry_type: 'duty', leave_status: null },
      { entry_date: '2026-10-09', entry_type: 'leave', leave_status: 'rejected' },
    ]
    const rows = [
      ['02/10/2026', 'Own', 'A', 'Local'],
      ['03/10/2026', 'Own', 'B', 'Local'],
    ]
    const fill = plan(rows, { existing })
    expect([fill.skipped, fill.willImport]).toEqual([1, 1])
    const replace = plan(rows, { existing, mode: 'replace' })
    expect([replace.replaced, replace.willImport]).toEqual([1, 2]) // the rejected leave day isn't an active entry
  })
  it('stops at "today" when looking for gaps in the current month', () => {
    const p = plan([['01/10/2026', 'Own', 'A', 'Local']], { today: '2026-10-03' })
    expect(p.gaps).toEqual(['2026-10-02', '2026-10-03'])
  })
  it('accepts the sheet’s own template (header aliases) without unknown columns', () => {
    const p = parseSheet([TEMPLATE_HEADER, ...TEMPLATE_EXAMPLES], vehicles)
    expect(p.unknownColumns).toEqual([])
    expect(p.rows).toHaveLength(3)
    expect(p.rows[0]).toMatchObject({
      date: '2026-10-01',
      dutyType: 'Local',
      vehicleKind: 'fleet',
      startKm: 1450,
      endKm: 1543,
      totalKm: 93,
      startTime: '09:00',
      totalMinutes: 570,
      fuelLitres: 10,
    })
    expect(p.rows[1]).toMatchObject({
      dutyType: 'Out Station',
      vehicleKind: 'own',
      totalMinutes: 975,
    })
    expect(p.rows[2].entryType).toBe('week_off')
  })
  it('lists unknown columns and fails clearly without a Date column', () => {
    expect(
      parseSheet(
        [
          ['Date', 'Remarks'],
          ['01/10/2026', 'x'],
        ],
        vehicles,
      ).unknownColumns,
    ).toEqual(['Remarks'])
    expect(
      parseSheet(
        [
          ['Foo', 'Bar'],
          [1, 2],
        ],
        vehicles,
      ).fatal,
    ).toMatch(/No Date column/)
    expect(parseSheet([], vehicles).fatal).toMatch(/empty/)
  })
})
