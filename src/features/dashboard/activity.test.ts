import { buildFeed, type ActivityRow } from './activity'

let n = 0
const row = (
  entity: string,
  action: string,
  o: Record<string, unknown> | null,
  nw: Record<string, unknown>,
  extra: Partial<ActivityRow> = {},
): ActivityRow => ({
  id: String(++n),
  actor_id: 'a1',
  entity,
  entity_id: 'e1',
  action,
  diff: { ...(o ? { old: o } : {}), new: nw },
  created_at: '2026-10-18T05:00:00.000Z',
  ...extra,
})
const actors = { a1: 'Priya (admin)' }

describe('activity feed', () => {
  it('describes service request submissions and decisions, ignoring non-status edits', () => {
    const feed = buildFeed(
      [
        row(
          'service_request_batches',
          'update',
          { status: 'draft' },
          { status: 'submitted', ref_no: 'SR-2610-0001', manager_name: 'Mgr One' },
          { actor_id: 'm1' },
        ),
        row(
          'service_request_batches',
          'update',
          { status: 'submitted', admin_note: null },
          { status: 'submitted', admin_note: 'edited', ref_no: 'SR-2610-0001' },
        ),
        row(
          'service_request_batches',
          'update',
          { status: 'submitted' },
          { status: 'rejected', ref_no: 'SR-2610-0001' },
        ),
        row('service_request_batches', 'insert', null, { status: 'draft' }),
      ],
      actors,
    )
    expect(feed.map((f) => f.text)).toEqual([
      'Mgr One submitted service request SR-2610-0001',
      'Priya (admin) rejected service request SR-2610-0001',
    ])
    expect(feed[0].to).toBe('/admin/service-requests/e1')
  })

  it('describes starter packs raised and moved along', () => {
    const feed = buildFeed(
      [
        row('starter_pack_requests', 'insert', null, {
          ref_no: 'SP-2610-0002',
          staff_name: 'Staff One',
          doctor_name: 'Dr A',
        }),
        row(
          'starter_pack_requests',
          'update',
          { status: 'submitted' },
          { status: 'fulfilled', ref_no: 'SP-2610-0001' },
        ),
        row(
          'starter_pack_requests',
          'update',
          { status: 'submitted', admin_note: null },
          { status: 'submitted', admin_note: 'x', ref_no: 'SP-2610-0001' },
        ),
      ],
      actors,
    )
    expect(feed.map((f) => f.text)).toEqual([
      'Staff One requested starter pack SP-2610-0002 for Dr A',
      'Priya (admin) marked fulfilled starter pack SP-2610-0001',
    ])
  })

  it('collapses a multi-day leave request (one log row per day) into one line', () => {
    const day = (d: string) =>
      row(
        'driver_day_entries',
        'insert',
        null,
        { entry_type: 'leave', leave_status: 'pending', driver_name: 'RAVIKUMAR.N', entry_date: d },
        { actor_id: 'd1' },
      )
    const feed = buildFeed([day('2026-10-20'), day('2026-10-21'), day('2026-10-22')], actors)
    expect(feed).toHaveLength(1)
    expect(feed[0].text).toBe('RAVIKUMAR.N requested 3 days of leave')
    expect(buildFeed([day('2026-10-20')], actors)[0].text).toBe('RAVIKUMAR.N requested leave')
  })

  it('describes leave decisions and closed duties; ignores duty starts, imports and plain edits', () => {
    const decided = (s: string) =>
      row(
        'driver_day_entries',
        'update',
        { entry_type: 'leave', leave_status: 'pending' },
        { entry_type: 'leave', leave_status: s, driver_name: 'VIGNESH.P' },
      )
    const feed = buildFeed(
      [
        decided('approved'),
        decided('approved'),
        row(
          'driver_day_entries',
          'update',
          { entry_type: 'duty', duty_status: 'open' },
          {
            entry_type: 'duty',
            duty_status: 'closed',
            driver_name: 'ELUMALAI.G',
            total_km: 52,
            driver_id: 'd9',
            entry_date: '2026-10-18',
          },
          { actor_id: 'd9' },
        ),
        row('driver_day_entries', 'insert', null, {
          entry_type: 'duty',
          duty_status: 'open',
          driver_name: 'ELUMALAI.G',
        }),
        row(
          'driver_day_entries',
          'update',
          { entry_type: 'duty', duty_status: 'closed' },
          { entry_type: 'duty', duty_status: 'closed', driver_name: 'X' },
        ),
      ],
      actors,
    )
    expect(feed.map((f) => f.text)).toEqual([
      'Priya (admin) approved 2 days of leave for VIGNESH.P',
      'ELUMALAI.G closed a duty (52 km)',
    ])
    expect(feed[1].to).toBe('/admin/trip-duty?tab=month&driver=d9&m=2026-10')
  })

  it('falls back to a generic actor name and respects the limit', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      row(
        'starter_pack_requests',
        'update',
        { status: 'submitted' },
        { status: 'processing', ref_no: `SP-${i}` },
        { actor_id: 'unknown' },
      ),
    )
    const feed = buildFeed(many, actors, 5)
    expect(feed).toHaveLength(5)
    expect(feed[0].text).toBe('An admin started processing starter pack SP-0')
  })
})
