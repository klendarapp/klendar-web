# Iconos y imagen OG de klendar.app a partir del símbolo «Pulso» (misma geometría
# que tool/brand/make_brand.py de la app).
# Ejecutar: python tools/build_brand.py   (desde la raíz de klendar-web)
import math
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
FONTS = os.path.join(ROOT, 'tools', 'fonts')

INK = (0x0B, 0x0F, 0x1A, 255)
CORAL = (0xFF, 0x4D, 0x6D, 255)
WHITE = (255, 255, 255, 255)
INK2 = (0xA7, 0xAE, 0xC0, 255)
SS = 4


def symbol(size, *, box=None, bg=INK, corner=True):
    box = box or size
    S = size * SS
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = box * SS / 64
    ox = oy = (S - box * SS) / 2
    if bg is not None:
        if corner:
            d.rounded_rectangle([ox, oy, ox + 64 * u, oy + 64 * u], radius=16 * u, fill=bg)
        else:
            d.rectangle([0, 0, S, S], fill=bg)
    cx, cy = ox + 32 * u, oy + 32 * u
    r, w = 17 * u, 7 * u
    ro = r + w / 2
    d.arc([cx - ro, cy - ro, cx + ro, cy + ro], start=-90, end=-90 + 360 * 0.82, fill=CORAL, width=int(round(w)))
    for ang in (-90, -90 + 360 * 0.82):
        ex, ey = cx + r * math.cos(math.radians(ang)), cy + r * math.sin(math.radians(ang))
        d.ellipse([ex - w / 2, ey - w / 2, ex + w / 2, ey + w / 2], fill=CORAL)
    hw = 4 * u
    d.line([(cx, cy), (cx, cy - 15 * u)], fill=WHITE, width=int(round(hw)))
    d.ellipse([cx - hw / 2, cy - 15 * u - hw / 2, cx + hw / 2, cy - 15 * u + hw / 2], fill=WHITE)
    d.ellipse([cx - 5 * u, cy - 5 * u, cx + 5 * u, cy + 5 * u], fill=WHITE)
    return im.resize((size, size), Image.LANCZOS)


def og():
    W, H = 1200, 630
    im = Image.new('RGBA', (W, H), INK)
    d = ImageDraw.Draw(im)
    # Anillo decorativo grande arriba a la derecha, como en la portada.
    big = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
    bd = ImageDraw.Draw(big)
    cx, cy, r, w = 1080 * SS, 60 * SS, 300 * SS, 60 * SS
    bd.arc([cx - r, cy - r, cx + r, cy + r], start=-30, end=200, fill=(0xFF, 0x4D, 0x6D, 60), width=w)
    big = big.resize((W, H), Image.LANCZOS)
    im.alpha_composite(big)
    im.alpha_composite(symbol(120), (84, 84))
    sora = ImageFont.truetype(os.path.join(FONTS, 'Sora-ExtraBold.ttf'), 60)
    d.text((222, 96), 'Klendar', font=sora, fill=WHITE)
    h1 = ImageFont.truetype(os.path.join(FONTS, 'Sora-ExtraBold.ttf'), 68)
    d.text((84, 290), 'Ofertas que se acaban.', font=h1, fill=WHITE)
    d.text((84, 372), 'Planes que empiezan.', font=h1, fill=CORAL)
    body = ImageFont.truetype(os.path.join(FONTS, 'Manrope-Regular.ttf'), 30)
    d.text((84, 490), 'Lo que pasa cerca de ti, ahora mismo · klendar.app', font=body, fill=INK2)
    return im.convert('RGB')


if __name__ == '__main__':
    symbol(1024).save(os.path.join(ASSETS, 'symbol.png'))
    symbol(512).save(os.path.join(ASSETS, 'icon-512.png'))
    symbol(64).save(os.path.join(ASSETS, 'favicon.png'))
    # apple-touch-icon: a sangre, el sistema redondea.
    symbol(180, box=180 * 1.18, corner=False).save(os.path.join(ASSETS, 'apple-touch-icon.png'))
    og().save(os.path.join(ASSETS, 'og.png'), optimize=True)
    print('ok', ASSETS)
