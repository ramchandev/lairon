// @vitest-environment node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { DEFAULT_FIELDS } from '../src/features/sale-report/fields'
import { itemsToRows, readPdfItems } from '../src/features/sale-report/parse/pdf'
import {
  analyse,
  buildLines,
  mapOf,
  stockMismatches,
} from '../src/features/sale-report/parse/statement'

/** Reads every PDF in a folder and prints what the importer made of it: SALES_DIR=… npx vitest run scripts/sale-pdf-harness */
const dir = process.env.SALES_DIR
describe.skipIf(!dir)('sales-folder PDF harness', () => {
  it('reads every PDF statement', { timeout: 120000 }, async () => {
    const out: string[] = []
    for (const f of readdirSync(dir!)
      .filter((n: string) => /\.pdf$/i.test(n))
      .sort()) {
      try {
        const buf = readFileSync(join(dir!, f))
        const items = await readPdfItems(
          buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
          pdfjs as never,
        )
        const a = analyse(itemsToRows(items, DEFAULT_FIELDS), DEFAULT_FIELDS, f)
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
          `${f.padEnd(34)} ${String(a.meta.period?.month ?? '?').padEnd(8)} ${String(a.meta.divisionHint ?? '-').padEnd(3)} rows=${String(a.rows.length).padEnd(3)} mm=${mm.bad.length}/${mm.checked} [${fields}] ${a.problems.join(' ')}`,
        )
      } catch (e) {
        out.push(`${f.padEnd(34)} ERROR ${(e as Error).message}`)
      }
    }
    writeFileSync(process.env.HARNESS_OUT ?? '/tmp/pdf-harness.txt', out.join('\n'))
  })
})
