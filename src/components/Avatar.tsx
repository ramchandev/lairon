/** The prototype's avatar: initials on a soft colour chosen from the name (stable per person), or the photo. */
export function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string
  url?: string | null
  size?: number
}) {
  const clean = name.replace(/^Dr\.?\s*/i, '')
  const initials = clean
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const hue = [...clean].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const box = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.35)) }
  if (url)
    return (
      <span
        className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full"
        style={box}
      >
        <img src={url} alt="" className="size-full object-cover" />
      </span>
    )
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold"
      style={{ ...box, background: `hsl(${hue} 42% 88%)`, color: `hsl(${hue} 45% 26%)` }}
    >
      {initials}
    </span>
  )
}
