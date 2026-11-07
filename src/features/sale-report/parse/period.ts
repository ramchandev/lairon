export interface Period {
  /** yyyy-mm — the month the statement is for */
  month: string
  from: string | null
  to: string | null
  /** The statement spans more than one calendar month */
  spansMonths: boolean
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n: number) => String(n).padStart(2, '0')
const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y))
const iso = (d: string, m: string | number, y: string) =>
  `${year(y)}-${pad(Number(m))}-${pad(Number(d))}`
const monthNo = (name: string) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1

const NUM = String.raw`(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})`
const NAMED = String.raw`(\d{1,2})[\/.\- ]([A-Za-z]{3,9})[\/.\- ,]*(\d{2,4})`
const SEP = String.raw`\s*(?:to|till|-|–|and)\s*`
const validMonth = (m: number) => m >= 1 && m <= 12

function result(from: string, to: string): Period {
  return { month: to.slice(0, 7), from, to, spansMonths: from.slice(0, 7) !== to.slice(0, 7) }
}

/** Finds the statement's period in header text: "01/05/2026 To 31/05/2026", "01-May-26 to 31-May-26", "05/2026", "of May2026". */
export function findPeriod(text: string): Period | null {
  const t = text.replace(/\s+/g, ' ')

  const a = new RegExp(`${NUM}${SEP}${NUM}`, 'i').exec(t)
  if (a && validMonth(Number(a[2])) && validMonth(Number(a[5]))) {
    return result(iso(a[1], a[2], a[3]), iso(a[4], a[5], a[6]))
  }
  const b = new RegExp(`${NAMED}${SEP}${NAMED}`, 'i').exec(t)
  if (b && monthNo(b[2]) && monthNo(b[5])) {
    return result(iso(b[1], monthNo(b[2]), b[3]), iso(b[4], monthNo(b[5]), b[6]))
  }
  const c = /(?<![\d/.-])(0?[1-9]|1[0-2])\/((?:19|20)\d{2})(?!\d)/.exec(t)
  if (c) return { month: `${c[2]}-${pad(Number(c[1]))}`, from: null, to: null, spansMonths: false }
  const d =
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,.-]*((?:19|20)?\d{2})\b/i.exec(t)
  if (d)
    return {
      month: `${year(d[2])}-${pad(monthNo(d[1]))}`,
      from: null,
      to: null,
      spansMonths: false,
    }
  return null
}
