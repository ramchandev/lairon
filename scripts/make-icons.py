"""Generates the PWA / app icons from the brand mark (blue gradient square with an L). Run: python3 scripts/make-icons.py"""
from PIL import Image, ImageDraw, ImageFont

TOP, BOTTOM = (59, 116, 224), (31, 71, 163)  # brand gradient (#3b74e0 -> #1f47a3)
FONTS = ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc', '/Library/Fonts/Arial Bold.ttf']


def font(size):
    for f in FONTS:
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    return ImageFont.load_default()


def icon(size, rounded=True, glyph_scale=0.62):
    s = size * 4  # draw 4x then downsample for smooth edges
    g = Image.new('RGB', (s, s))
    px = g.load()
    for y in range(s):
        for x in range(s):
            t = (x + y) / (2 * s)
            px[x, y] = tuple(int(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
    d = ImageDraw.Draw(g)
    f = font(int(s * glyph_scale))
    box = d.textbbox((0, 0), 'L', font=f)
    d.text(((s - (box[2] - box[0])) / 2 - box[0], (s - (box[3] - box[1])) / 2 - box[1]), 'L', font=f, fill='white')
    out = g.convert('RGBA')
    if rounded:
        mask = Image.new('L', (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=255)
        out.putalpha(mask)
    return out.resize((size, size), Image.LANCZOS)


icon(192).save('public/icon-192.png')
icon(512).save('public/icon-512.png')
icon(512, rounded=False, glyph_scale=0.44).save('public/icon-maskable-512.png')  # full-bleed, logo inside the 80% safe zone
icon(180, rounded=False, glyph_scale=0.56).save('public/apple-touch-icon.png')  # iOS rounds the corners itself
icon(32).save('public/favicon-32.png')
print('icons written')
