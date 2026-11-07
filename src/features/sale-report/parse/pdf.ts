import { suggestField, type FieldDef } from './statement'

/** One piece of text on a PDF page, as the PDF library reports it (y grows upward). */
export interface PdfItem {
  str: string
  x: number
  y: number
  w: number
  page: number
}
interface Word {
  s: string
  x0: number
  x1: number
}
interface Line {
  page: number
  y: number
  words: Word[]
}
interface PdfLib {
  getDocument: (src: { data: Uint8Array; [k: string]: unknown }) => {
    promise: Promise<{
      numPages: number
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{
          items: { str?: string; width?: number; transform?: number[] }[]
        }>
      }>
    }>
  }
}

/** The PDF's text with positions. The library loads on demand (and a Node build can be passed in for scripts). */
export async function readPdfItems(data: ArrayBuffer, lib?: PdfLib): Promise<PdfItem[]> {
  let pdfjs = lib
  if (!pdfjs) {
    const mod = await import('pdfjs-dist')
    mod.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).href
    pdfjs = mod as unknown as PdfLib
  }
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
    verbosity: 0,
  }).promise
  const out: PdfItem[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent()
    for (const i of tc.items) {
      if (i.str?.trim() && i.transform)
        out.push({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width ?? 0, page: p })
    }
  }
  return out
}

const NUM = /^(?:[-–]?\(?[\d,]*\.?\d+\)?|[-–]+|\d+\+\d+)$/
const isNum = (s: string) => NUM.test(s)
const isRule = (s: string) => /^[-=_*.]{3,}$/.test(s)
const overlap = (a0: number, a1: number, b0: number, b1: number) =>
  Math.min(a1, b1) - Math.max(a0, b0)

/** Splits each item into words; a word's position is its share of the item's width (the font is the same across it). */
function toLines(items: PdfItem[]): Line[] {
  const sorted = [...items].sort((a, b) => a.page - b.page || b.y - a.y)
  const lines: Line[] = []
  for (const it of sorted) {
    let line = lines[lines.length - 1]
    if (!line || line.page !== it.page || Math.abs(line.y - it.y) > 2.5) {
      line = { page: it.page, y: it.y, words: [] }
      lines.push(line)
    }
    const total = it.str.length || 1
    for (const m of it.str.matchAll(/\S+/g)) {
      const at = m.index ?? 0
      line.words.push({
        s: m[0],
        x0: it.x + (it.w * at) / total,
        x1: it.x + (it.w * (at + m[0].length)) / total,
      })
    }
  }
  for (const l of lines) l.words.sort((a, b) => a.x0 - b.x0)
  return lines
}

interface Parsed {
  line: Line
  name: Word[]
  rest: Word[]
}
/** A product line: [serial no] name … then at least two numbers. */
function parseDataLine(line: Line): Parsed | null {
  let w = line.words
  if (!w.length || w.every((x) => isNum(x.s) || isRule(x.s))) return null
  if (w.length > 1 && /^\d+$/.test(w[0].s) && /^[A-Za-z]/.test(w[1].s)) w = w.slice(1) // serial number or item code
  if (!w.length || isNum(w[0].s) || /^(grand|sub|page|total)/i.test(w[0].s)) return null
  let end = 1
  while (end < w.length && w[end].x0 - w[end - 1].x1 <= 6) end++
  const rest = w.slice(end)
  const figures = rest.filter((x) => isNum(x.s)).length
  if (figures < 2 || figures < rest.length * 0.5) return null // an address or a note, not a product line
  return { line, name: w.slice(0, end), rest }
}

/** Turns positioned PDF text into the same rows-of-cells an Excel sheet gives, so one analyser reads both. */
export function itemsToRows(items: PdfItem[], fields: FieldDef[]): unknown[][] {
  const lines = toLines(items)
  // a "Summary" block (totals by group) ends the product list on its page
  let summaryPage = -1
  const raw = lines.map((l) => {
    if (/^summary/i.test(l.words[0]?.s ?? '') && l.words.length < 3) summaryPage = l.page
    return l.page === summaryPage ? null : parseDataLine(l)
  })
  // a product line has about as many figures as the typical one; shorter lines are totals or notes
  const counts = raw
    .filter((d): d is Parsed => !!d)
    .map((d) => d.rest.length)
    .sort((a, b) => a - b)
  const median = counts[Math.floor(counts.length / 2)] ?? 0
  // product lines start at the same x: drop other tables on later pages (purchase details, summaries)
  const starts = raw.filter((d): d is Parsed => !!d).map((d) => Math.round(d.name[0].x0 / 8))
  const mode = [...new Set(starts)].sort(
    (x, y) => starts.filter((v) => v === y).length - starts.filter((v) => v === x).length,
  )[0]
  const data = raw.map((d) =>
    d && d.rest.length >= median * 0.5 && Math.abs(Math.round(d.name[0].x0 / 8) - mode) <= 1
      ? d
      : null,
  )
  const firstData = data.findIndex(Boolean)
  if (firstData < 0) return lines.map((l) => [l.words.map((w) => w.s).join(' ')])
  const parsed = data.filter((d): d is Parsed => !!d)

  // columns = where the figures sit: figures that line up on their right edge (numbers) or left edge (text) share a column
  const toks = parsed.flatMap((p) => p.rest)
  const parent = toks.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (const edge of ['x0', 'x1'] as const) {
    const order = toks.map((_, i) => i).sort((i, j) => toks[i][edge] - toks[j][edge])
    for (let k = 1; k < order.length; k++) {
      if (toks[order[k]][edge] - toks[order[k - 1]][edge] <= 4)
        parent[find(order[k])] = find(order[k - 1])
    }
  }
  const groups = new Map<number, { x0: number; x1: number; n: number }>()
  toks.forEach((t, i) => {
    const g = groups.get(find(i))
    if (g) {
      g.x0 = Math.min(g.x0, t.x0)
      g.x1 = Math.max(g.x1, t.x1)
      g.n++
    } else groups.set(find(i), { x0: t.x0, x1: t.x1, n: 1 })
  })
  const cols = [...groups.values()]
    .filter((c) => c.n >= Math.max(2, parsed.length * 0.25))
    .sort((a, b) => a.x0 - b.x0)
  const nameSpan = {
    x0: Math.min(...parsed.map((p) => p.name[0].x0)),
    x1: Math.max(...parsed.map((p) => p.name[p.name.length - 1].x1)),
  }

  // header = from the first line that names two of our fields, down to the first product line (skipping rules and company lines)
  const hits = (l: Line) => {
    const keys = new Set<string>()
    l.words.forEach((w, i) => {
      for (const t of [w.s, i + 1 < l.words.length ? `${w.s} ${l.words[i + 1].s}` : '']) {
        const f = t ? suggestField(t, fields) : null
        if (f?.key && f.confidence >= 0.8) keys.add(f.key)
      }
    })
    return keys.size
  }
  let anchor = -1
  for (let i = 0; i < firstData; i++)
    if (hits(lines[i]) >= 2) {
      anchor = i
      break
    }
  if (anchor < 0) return lines.map((l) => [l.words.map((w) => w.s).join(' ')])
  const headerLines: Line[] = []
  for (let i = anchor; i < firstData; i++) {
    const l = lines[i]
    const first = l.words[0]?.s.toLowerCase() ?? ''
    if (
      l.words.every((w) => isRule(w.s)) ||
      /^(company|manufactur|mfr|mfac|division|group)/.test(first)
    )
      continue
    headerLines.push(l)
  }

  // give each header word to the column(s) it sits over
  const heading: string[][] = cols.map(() => [])
  let nameHead: string[] = []
  headerLines.forEach((hl0) => {
    // "PackOpStk" is two or three headings run together: split unknown glued words at their capitals
    const hl: Line = {
      ...hl0,
      words: hl0.words.flatMap((w) => {
        if (suggestField(w.s, fields).key || !/[a-z][A-Z]/.test(w.s)) return [w]
        const parts = w.s.split(/(?<=[a-z])(?=[A-Z])/)
        let at = w.x0
        return parts.map((p) => {
          const x1 = at + ((w.x1 - w.x0) * p.length) / w.s.length
          const out = { s: p, x0: at, x1 }
          at = x1
          return out
        })
      }),
    }
    const assigned: (number[] | 'name' | null)[] = hl.words.map((w) => {
      if (
        overlap(w.x0, w.x1, nameSpan.x0, nameSpan.x1) > 0 &&
        cols.every((c) => overlap(w.x0, w.x1, c.x0, c.x1) <= 0)
      )
        return 'name'
      const over = cols
        .map((c, i) => (overlap(w.x0, w.x1, c.x0, c.x1) > 0 ? i : -1))
        .filter((i) => i >= 0)
      return over.length ? over : null
    })
    // A word over no column belongs to the neighbour it reads with: the closer one that touches it (not an overlapping one), else the nearest column.
    for (let guard = 0; guard < 40; guard++) {
      let changed = false
      hl.words.forEach((w, i) => {
        if (assigned[i]) return
        const prev = hl.words[i - 1]
        const next = hl.words[i + 1]
        const gp = prev && assigned[i - 1] ? w.x0 - prev.x1 : Infinity
        const gn = next && assigned[i + 1] ? next.x0 - w.x1 : Infinity
        const okP = gp >= 1 && gp <= 4
        const okN = gn >= 1 && gn <= 4
        if (okN && (!okP || gn <= gp)) assigned[i] = assigned[i + 1]
        else if (okP) assigned[i] = assigned[i - 1]
        if (assigned[i]) changed = true
      })
      if (changed) continue
      // nothing joins a neighbour any more: give the closest unplaced word to its nearest column
      let pick = -1
      let col = -1
      let best = 12
      hl.words.forEach((w, i) => {
        if (assigned[i]) return
        cols.forEach((c, k) => {
          const d = Math.max(c.x0 - w.x1, w.x0 - c.x1)
          if (d < best) {
            best = d
            pick = i
            col = k
          }
        })
      })
      if (pick < 0) break
      assigned[pick] = [col]
    }
    hl.words.forEach((w, i) => {
      const a = assigned[i]
      if (a === 'name') nameHead.push(w.s)
      else if (a) a.forEach((k) => heading[k].push(w.s))
    })
  })
  if (!nameHead.length) nameHead = ['Product']

  // Headings that sit left of their figures (centred over wide columns) can't be matched by position over them:
  // when a single header line has as many phrases as there are columns, read them in order instead.
  if (headerLines.length === 1) {
    const phrases: Word[][] = []
    const key = (ws: Word[]) => {
      const f = suggestField(ws.map((w) => w.s).join(' '), fields)
      return f.key && f.confidence >= 0.8 ? f.key : null
    }
    for (const w of headerLines[0].words) {
      const last = phrases[phrases.length - 1]
      const gap = last ? w.x0 - last[last.length - 1].x1 : Infinity
      // touching words read together ("Op. Stock") unless each already names a heading of its own ("OpStk Rcpt")
      const together =
        last && gap >= 1 && gap <= 4 && (key([...last, w]) !== null || !(key(last) && key([w])))
      if (together) last.push(w)
      else phrases.push([w])
    }
    const dataPhrases = phrases.filter((p) => p[0].x0 >= nameSpan.x1 - 5)
    if (dataPhrases.length === cols.length)
      dataPhrases.forEach((p, k) => (heading[k] = p.map((w) => w.s)))
  }

  // "QTY." under a group heading that sits over its neighbour only ("ISSUE" over QTY. and VALUE): borrow the neighbour's group
  heading.forEach((h, k) => {
    const bare = /^(qty|quantity|value|val)\.?$/i
    if (h.length === 1 && bare.test(h[0])) {
      const nb = heading[k + 1] ?? []
      if (nb.length >= 2 && bare.test(nb[nb.length - 1])) heading[k] = [...nb.slice(0, -1), h[0]]
    }
  })

  const meta = lines
    .slice(0, anchor)
    .filter((l) => !l.words.every((w) => isRule(w.s)))
    .map((l) => [l.words.map((w) => w.s).join(' ')])
  const header: unknown[] = [nameHead.join(' '), ...heading.map((h) => h.join(' '))]
  const rows = parsed.map((p) => {
    const cells: unknown[] = cols.map(() => '')
    for (const w of p.rest) {
      let k = cols.findIndex((c) => overlap(w.x0, w.x1, c.x0, c.x1) > 0)
      if (k < 0) {
        let best = 8
        cols.forEach((c, i) => {
          const d = Math.max(c.x0 - w.x1, w.x0 - c.x1)
          if (d < best) {
            best = d
            k = i
          }
        })
      }
      if (k >= 0 && cells[k] === '') cells[k] = w.s
    }
    return [p.name.map((w) => w.s).join(' '), ...cells]
  })
  return [...meta, header, ...rows]
}
