import { format } from 'date-fns'

// The built-in PDF fonts have no ₹ glyph, so PDFs print amounts as "Rs." with Indian digit grouping.
export const rs = (n: number) =>
  `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`
export const pdfDate = (v: string) => format(new Date(v), 'dd MMM yyyy')
