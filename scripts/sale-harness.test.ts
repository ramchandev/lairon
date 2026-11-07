// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_FIELDS } from '../src/features/sale-report/fields'
import {
  analyse,
  buildLines,
  mapOf,
  stockMismatches,
} from '../src/features/sale-report/parse/statement'
import { readRows } from '../src/features/sale-report/parse/sheet'

/** Reads every Excel file in a folder and prints what the importer made of it: SALES_DIR=… npx vitest run harness */
const dir = process.env.SALES_DIR
describe.skipIf(!dir)('sales-folder harness', () => {
  it('reads every Excel statement', async () => {
    const out: string[] = []
    for (const f of readdirSync(dir!)
      .filter((n) => /\.xlsx?$/i.test(n) && !n.startsWith('~$'))
      .sort()) {
      const buf = readFileSync(join(dir!, f))
      const rows = await readRows(
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      )
      const a = analyse(rows, DEFAULT_FIELDS, f)
      const lines = buildLines(a, mapOf(a))
      const mm = stockMismatches(
        lines,
        a.columns.some((c) => c.field === 'purchase'),
      )
      const fields = a.columns
        .filter((c) => c.field)
        .map((c) => c.field)
        .join(',')
      out.push(
        `${f.padEnd(34)} ${String(a.meta.period?.month ?? '?').padEnd(8)} ${String(a.meta.divisionHint ?? '-').padEnd(3)} rows=${String(a.rows.length).padEnd(3)} stock-mismatch=${mm.bad.length}/${mm.checked} [${fields}] ${a.problems.join(' ')}`,
      )
    }
    ;(await import('node:fs')).writeFileSync(
      process.env.HARNESS_OUT ?? '/tmp/harness.txt',
      out.join('\n'),
    )
  })
})
