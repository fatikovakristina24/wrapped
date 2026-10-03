"""Label / sticker textures for Blender — same designs as the site (js/lib/kit.js)."""
import math
from PIL import Image, ImageDraw, ImageFont
F = 'tex/Unbounded.ttf'
def font(size, wght):
    f = ImageFont.truetype(F, size)
    try: f.set_variation_by_axes([wght])
    except Exception: pass
    return f
# record label (grayscale, tinted in the shader)
S = 1024; c = S / 2
im = Image.new('RGB', (S, S), 'white'); d = ImageDraw.Draw(im)
for k in (0.97, 0.9, 0.62):
    r = k * c; d.ellipse([c - r, c - r, c + r, c + r], outline=(140, 140, 140), width=3)
txt = 'SPOTIFY WRAPPED · 2026 · SIDE A · 33 1/3 RPM · ' * 2
f = font(34, 500); R = 0.78 * c; step = 2 * math.pi / len(txt)
for i, ch in enumerate(txt):
    a = -math.pi / 2 + i * step
    g = Image.new('RGBA', (70, 70), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
    gd.text((35, 35), ch, font=f, fill=(40, 40, 50, 255), anchor='mm')
    g = g.rotate(-math.degrees(a + math.pi / 2), resample=Image.BICUBIC)
    im.paste(g, (int(c + math.cos(a) * R - 35), int(c + math.sin(a) * R - 35)), g)
d.text((c, c - 150), 'WRAPPED', font=font(78, 900), fill=(25, 25, 35), anchor='mm')
d.text((c, c + 150), '2026', font=font(64, 300), fill=(25, 25, 35), anchor='mm')
d.text((c, c + 230), 'ФАТИКОВА КРИСТИНА', font=font(26, 500), fill=(100, 100, 110), anchor='mm')
im.save('tex/label.png')
# cassette stickers
W, H = 2048, 270
im = Image.new('RGB', (W, H), (243, 243, 240)); d = ImageDraw.Draw(im)
d.text((60, H / 2), 'A', font=font(120, 900), fill=(10, 10, 11), anchor='lm')
d.text((W / 2, H / 2 - 10), 'WRAPPED 2026', font=font(92, 700), fill=(10, 10, 11), anchor='mm')
d.text((W - 60, H / 2), '90 MIN', font=font(56, 500), fill=(80, 80, 85), anchor='rm')
d.rectangle([260, H - 40, W - 260, H - 36], fill=(190, 190, 190))
im.save('tex/sticker.png')
im = Image.new('RGB', (W, 160), (243, 243, 240)); d = ImageDraw.Draw(im)
d.text((W / 2, 80), 'CHROME · TYPE II · HIGH BIAS · 90', font=font(60, 500), fill=(80, 80, 85), anchor='mm')
im.save('tex/sticker_low.png')
print('ok')
