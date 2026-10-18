import { readFileSync } from 'node:fs'
import { ADMIN_BOTTOM, ADMIN_NAV, MORE_ROOTS } from '../src/layouts/adminNav'
import { DRIVER_TABS, MANAGER_TABS } from '../src/layouts/roleNav'

/**
 * The approved design (design/lairon-ez-prototype.html) is the source of truth for navigation. This test reads the HTML's own
 * NAV / BOTTOM / MORE_ROOTS / role-app arrays and compares them with the app: group names, labels, ORDER and icons.
 * If someone edits either side, this fails until they match again.
 */
const html = readFileSync('design/lairon-ez-prototype.html', 'utf8')

const evalArray = <T>(src: string, args: Record<string, unknown> = {}): T =>
  new Function(...Object.keys(args), `return ${src}`)(...Object.values(args)) as T

const block = (name: string) => {
  // multi-line arrays end with "\n];"; MORE_ROOTS is a one-liner
  const m =
    new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\]);`).exec(html) ??
    new RegExp(`const ${name} = (\\[[^\\n]*\\]);`).exec(html)
  if (!m) throw new Error(`Could not find "${name}" in the prototype`)
  return m[1]
}
/** lucide's kebab-case name ('layout-dashboard', 'grid-2x2') -> the React component's displayName. */
const pascal = (kebab: string) =>
  kebab
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('')

interface ProtoItem {
  r: string
  label: string
  icon: string
  count?: () => number
}

describe('admin navigation matches the approved HTML', () => {
  const db = { requests: [], starter: [], leaves: [] }
  const protoNav = evalArray<{ group: string; items: ProtoItem[] }[]>(block('NAV'), { db })
  const protoBottom = evalArray<ProtoItem[]>(block('BOTTOM'))
  const protoMore = evalArray<string[]>(block('MORE_ROOTS'))

  it('has the same groups, in the same order', () => {
    expect(ADMIN_NAV.map((g) => g.group)).toEqual(protoNav.map((g) => g.group))
    expect(ADMIN_NAV.map((g) => g.group)).toEqual(['Overview', 'Operations', 'People', 'Masters'])
  })

  it('has the same items in each group: label, order and icon', () => {
    expect(ADMIN_NAV.map((g) => g.items.map((i) => [i.key, i.label, i.icon.displayName]))).toEqual(
      protoNav.map((g) => g.items.map((i) => [i.r, i.label, pascal(i.icon)])),
    )
  })

  it('shows pending counts on exactly the same three items', () => {
    const counted = (items: { count?: unknown; key?: string; r?: string }[]) =>
      items.filter((i) => i.count).map((i) => i.key ?? i.r)
    expect(counted(ADMIN_NAV.flatMap((g) => g.items))).toEqual(
      counted(protoNav.flatMap((g) => g.items)),
    )
  })

  it('has the same 5-tab bottom bar (Home · Requests · Starter · Duties · More) with the same icons', () => {
    expect(ADMIN_BOTTOM.map((b) => [b.key, b.label, b.icon.displayName])).toEqual(
      protoBottom.map((b) => [b.r, b.label, pascal(b.icon)]),
    )
  })

  it('makes "More" active on the same pages (plus the two admin pages this app adds under it)', () => {
    for (const r of protoMore)
      expect(MORE_ROOTS).toContain(
        r === 'more' ? 'more' : ADMIN_NAV.flatMap((g) => g.items).find((i) => i.key === r)!.root,
      )
  })
})

describe('driver and doctor’s-manager apps match the approved HTML', () => {
  const m = /const items = app === 'driver'\s*\?\s*(\[[^\n]*\])\s*:\s*(\[[^\n]*\]);/.exec(html)
  if (!m) throw new Error('Could not find the role-app items in the prototype')
  const driver = evalArray<{ label: string; icon: string }[]>(m[1])
  const manager = evalArray<{ label: string; icon: string; n?: number }[]>(m[2], { draftN: 1 })

  it('driver bottom bar: same tabs, order and icons', () => {
    expect(DRIVER_TABS.map((t) => [t.label, t.icon.displayName])).toEqual(
      driver.map((t) => [t.label, pascal(t.icon)]),
    )
  })
  it('manager bottom bar: same tabs, order and icons', () => {
    expect(MANAGER_TABS.map((t) => [t.label, t.icon.displayName])).toEqual(
      manager.map((t) => [t.label, pascal(t.icon)]),
    )
  })
  it('role labels under the brand are worded exactly as in the HTML', () => {
    expect(html).toContain(`app === 'driver' ? 'Driver' : "Doctor's Manager"`)
  })
})
