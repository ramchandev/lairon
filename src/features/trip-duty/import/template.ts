export const TEMPLATE_HEADER = [
  'Date',
  'Driver',
  'Entry Type',
  'Duty Type',
  'Vehicle',
  'Guest',
  'Guest Area',
  'Pickup Point',
  'Drop Point',
  'Starting KM',
  'Ending KM',
  'Starting Time',
  'Closing Time',
  'Trip End Date',
  'Total Hours',
  'Fuel in Liters',
  'Fuel Amount',
]

export const TEMPLATE_EXAMPLES: (string | number)[][] = [
  [
    '01/10/2026',
    'RAVIKUMAR.N',
    'Duty',
    'Local',
    'AMAZE 6960',
    'Dr. Jaswanth',
    'Adyar',
    'Airport',
    'Hotel',
    1450,
    1543,
    '09:00',
    '18:30',
    '01/10/2026',
    '9 hrs 30 mins',
    10,
    1000,
  ],
  [
    '02/10/2026',
    'RAVIKUMAR.N',
    'Duty',
    'Out Station',
    'Own car',
    'Dr. Rakshana',
    'Tambaram',
    'Home',
    'Pondicherry',
    '',
    '',
    '06:00',
    '07:15',
    '03/10/2026',
    '25:15',
    '',
    '',
  ],
  ['05/10/2026', 'RAVIKUMAR.N', 'Week off', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
]

/** Builds the downloadable .xlsx template. SheetJS is loaded only when asked for. */
export async function downloadTemplate() {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADER, ...TEMPLATE_EXAMPLES])
  ws['!cols'] = TEMPLATE_HEADER.map((h) => ({ wch: Math.max(12, h.length + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Duties')
  XLSX.writeFile(wb, 'duty-import-template.xlsx')
}
