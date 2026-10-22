/** Ready-to-send login details for a new driver (paste into WhatsApp / email). */
export function loginInfoText(i: {
  role: 'driver' | 'staff'
  name: string
  url: string
  email: string
  password: string
}): string {
  const first = i.name.trim().split(/\s+/)[0] || 'there'
  return [
    `Hi ${first},`,
    '',
    `Your LAIRON EZ ${i.role} account is ready. Sign in with these details:`,
    '',
    `Login URL: ${i.url}`,
    `Username: ${i.email}`,
    `Password: ${i.password}`,
    '',
    i.role === 'staff'
      ? 'After signing in, tap New Pack to raise a starter pack for a doctor. Please keep these details private. You can use the app on your phone from the same link.'
      : 'Please keep these details private. You can use the app on your phone from the same link.',
    '',
    'Thanks,',
    'LAIRON Admin',
  ].join('\n')
}
