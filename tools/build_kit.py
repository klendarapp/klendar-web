# Kit para negocios: guía de 1 página + cartel A4 con QR.
# Ejecutar: python tools/build_kit.py   (desde la raíz de klendar-web)
# Requiere: pip install reportlab qrcode[pil]   y las fuentes Sora/Manrope en tools/fonts/ (copiadas de la app)
import io, os
import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, 'tools', 'fonts')
OUT = os.path.join(ROOT, 'assets', 'kit')
os.makedirs(OUT, exist_ok=True)

# «Onest» = texto (Manrope); «Onest-Bold» = negrita (Manrope Bold); «Onest-Black» = titulares (Sora ExtraBold).
pdfmetrics.registerFont(TTFont('Onest', os.path.join(FONTS, 'Manrope-Regular.ttf')))
pdfmetrics.registerFont(TTFont('Onest-Bold', os.path.join(FONTS, 'Manrope-Bold.ttf')))
pdfmetrics.registerFont(TTFont('Onest-Black', os.path.join(FONTS, 'Sora-ExtraBold.ttf')))
pdfmetrics.registerFontFamily('Onest', normal='Onest', bold='Onest-Bold', italic='Onest', boldItalic='Onest-Bold')

BG = HexColor('#0A0A0A'); CARD = HexColor('#171717'); ACCENT = HexColor('#FF4D6D')
INK = white; INK2 = HexColor('#A3A3A3'); LINE = HexColor('#2A2A2A')
W, H = A4
SYMBOL = os.path.join(ROOT, 'assets', 'symbol.png')


def brand(c, x, y, size=9 * mm, text_size=20):
    c.drawImage(SYMBOL, x, y, size, size, mask='auto')
    c.setFillColor(INK); c.setFont('Onest-Black', text_size)
    c.drawString(x + size + 3 * mm, y + size * 0.22, 'Klendar')


def qr_image(url):
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q, box_size=10, border=1)
    q.add_data(url); q.make(fit=True)
    img = q.make_image(fill_color='#0A0A0A', back_color='white').convert('RGB')
    buf = io.BytesIO(); img.save(buf, format='PNG'); buf.seek(0)
    return ImageReader(buf)


def para(c, text, x, y, w, size=10.5, leading=15, color=INK2, font='Onest'):
    st = ParagraphStyle('p', fontName=font, fontSize=size, leading=leading, textColor=color)
    p = Paragraph(text, st)
    _, h = p.wrap(w, 1000)
    p.drawOn(c, x, y - h)
    return h


# ── Guía de 1 página ─────────────────────────────────────────────────────────
def guide():
    path = os.path.join(OUT, 'klendar-guia-negocios.pdf')
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle('Klendar · Guía para negocios'); c.setAuthor('Klendar')
    c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
    M = 16 * mm
    brand(c, M, H - M - 9 * mm)
    c.setFillColor(INK2); c.setFont('Onest', 10)
    c.drawRightString(W - M, H - M - 5 * mm, 'klendar.app · info@klendar.app')

    y = H - M - 26 * mm
    c.setFillColor(INK); c.setFont('Onest-Black', 26)
    c.drawString(M, y, 'Tu primera oferta flash en 5 minutos')
    y -= 8 * mm
    para(c, 'Klendar enseña lo que pasa <b>cerca y ahora mismo</b>: ofertas con cuenta atrás y eventos de negocios como el tuyo, '
            'ordenados por cercanía. La gente canjea con un código QR de un solo uso que tú validas con el móvil. '
            '<b>Sin comisiones por venta.</b>', M, y, W - 2 * M, size=11.5, leading=17, color=INK)
    y -= 22 * mm

    steps = [
        ('1', 'Descarga Klendar y crea tu cuenta', 'Google Play o App Store. Entra con tu correo o con Google.'),
        ('2', 'Da de alta tu negocio', 'En la app, Cuenta → «¿Quieres registrar tu negocio?», o en klendar.app/panel. Nombre, categoría, ubicación en el mapa, contacto y NIF. Lo verificamos en 24–48 h.'),
        ('3', 'Completa tu ficha', 'Portada, logo, horarios, carta y redes. Es lo que ve la gente al tocar tu nombre.'),
        ('4', 'Publica tu primera oferta flash', 'Mi negocio → «Crear» → «Nueva oferta flash» (o en el panel web). Título claro, una foto real, ventana horaria, descuento y aforo. Publica y ya está en el feed de quien esté cerca.'),
        ('5', 'Valida los canjes', 'Cuando alguien te enseñe el QR: Mi negocio → «Validar códigos» y escanéalo (o escribe el código). Verás qué aplicar y el nombre del cliente.'),
    ]
    for n, title, body in steps:
        c.setFillColor(CARD); c.roundRect(M, y - 19 * mm, W - 2 * M, 21 * mm, 4 * mm, fill=1, stroke=0)
        c.setFillColor(ACCENT); c.circle(M + 9 * mm, y - 8.5 * mm, 5 * mm, fill=1, stroke=0)
        c.setFillColor(BG); c.setFont('Onest-Black', 13); c.drawCentredString(M + 9 * mm, y - 10.2 * mm, n)
        c.setFillColor(INK); c.setFont('Onest-Bold', 12.5); c.drawString(M + 19 * mm, y - 6.5 * mm, title)
        para(c, body, M + 19 * mm, y - 9 * mm, W - 2 * M - 24 * mm, size=9.8, leading=13)
        y -= 24 * mm

    y -= 3 * mm
    # Dos columnas: consejos y plan
    colw = (W - 2 * M - 6 * mm) / 2
    c.setFillColor(INK); c.setFont('Onest-Bold', 12.5); c.drawString(M, y, 'Ofertas que funcionan')
    tips = ['Ventanas cortas (2–4 h) en tus horas flojas: la cuenta atrás mueve a la gente.',
            'Un beneficio concreto: «-30 %», «2x1», «café + tostada 2,50 €».',
            'Aforo limitado («20 plazas»): lo que se agota, se canjea antes.',
            'Foto real del producto o del local, con luz. Nada de bancos de imágenes.',
            'Marca «+18» si hay alcohol o es ocio nocturno: es obligatorio.']
    yy = y - 6 * mm
    for t in tips:
        c.setFillColor(ACCENT); c.circle(M + 1.5 * mm, yy - 1.2 * mm, 1.1 * mm, fill=1, stroke=0)
        h = para(c, t, M + 5 * mm, yy + 2.6 * mm, colw - 5 * mm, size=9.8, leading=13)
        yy -= h + 1.5 * mm

    x2 = M + colw + 6 * mm
    c.setFillColor(CARD); c.roundRect(x2, y - 52 * mm, colw, 58 * mm, 4 * mm, fill=1, stroke=0)
    c.setFillColor(INK); c.setFont('Onest-Bold', 12.5); c.drawString(x2 + 6 * mm, y - 2 * mm, 'Planes y precio')
    para(c, '<b><font color="#FF4D6D">Prueba gratis de 30 días</font></b> con todo incluido al darte de alta. '
            'Después, plan <b>Gratis</b> (hasta 2 publicaciones activas) o un plan de pago con <b>cuota mensual fija</b> y sin comisiones. '
            'Cambias o te das de baja cuando quieras.<br/><br/>'
            'Condiciones completas en <b>klendar.app/negocios</b>.',
         x2 + 6 * mm, y - 7 * mm, colw - 12 * mm, size=9.8, leading=13.5)

    # Pie
    c.setStrokeColor(LINE); c.setLineWidth(0.6); c.line(M, 22 * mm, W - M, 22 * mm)
    c.setFillColor(INK2); c.setFont('Onest', 9.5)
    c.drawString(M, 15 * mm, '¿Dudas? Escríbenos a info@klendar.app · Respondemos en menos de 2 días laborables.')
    c.drawRightString(W - M, 15 * mm, 'klendar.app')
    c.showPage(); c.save()
    return path


# ── Cartel A4 ────────────────────────────────────────────────────────────────
def poster():
    path = os.path.join(OUT, 'klendar-cartel.pdf')
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle('Klendar · Cartel para el local'); c.setAuthor('Klendar')
    c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
    # Resplandor de acento arriba
    c.setFillColor(HexColor('#3A1B2A')); c.circle(W * 0.85, H * 0.95, 70 * mm, fill=1, stroke=0)
    c.setFillColor(BG); c.circle(W * 0.85, H * 0.95, 40 * mm, fill=1, stroke=0)
    M = 18 * mm
    brand(c, M, H - M - 12 * mm, size=12 * mm, text_size=28)

    c.setFillColor(ACCENT); c.setFont('Onest-Black', 15)
    c.drawString(M, H - 62 * mm, 'AQUÍ HAY OFERTAS FLASH')
    c.setFillColor(INK); c.setFont('Onest-Black', 40)
    c.drawString(M, H - 80 * mm, 'Lo que pasa cerca,')
    c.drawString(M, H - 96 * mm, 'ahora mismo.')
    para(c, 'Descarga <b>Klendar</b>, activa la ubicación y entérate de nuestras ofertas con cuenta atrás y eventos. '
            'Enseña el código QR en la barra y listo.', M, H - 106 * mm, W - 2 * M, size=15, leading=21, color=INK2)

    # Tarjeta con QR
    cw = W - 2 * M; ch = 96 * mm; cy = 48 * mm
    c.setFillColor(CARD); c.roundRect(M, cy, cw, ch, 8 * mm, fill=1, stroke=0)
    qs = 70 * mm
    c.setFillColor(white); c.roundRect(M + 13 * mm, cy + (ch - qs) / 2, qs, qs, 5 * mm, fill=1, stroke=0)
    c.drawImage(qr_image('https://klendar.app/?utm_source=cartel'), M + 16 * mm, cy + (ch - qs) / 2 + 3 * mm, qs - 6 * mm, qs - 6 * mm)
    tx = M + 13 * mm + qs + 12 * mm
    c.setFillColor(INK); c.setFont('Onest-Black', 22); c.drawString(tx, cy + ch - 26 * mm, 'Escanea y descarga')
    para(c, 'Gratis, sin anuncios.<br/>Google Play y App Store.<br/><br/>'
            '<font color="#FF4D6D"><b>klendar.app</b></font>', tx, cy + ch - 32 * mm, cw - (tx - M) - 10 * mm, size=14, leading=20, color=INK2)

    c.setFillColor(INK2); c.setFont('Onest', 11)
    c.drawString(M, 30 * mm, 'Cada oferta se canjea una vez por persona con un código de un solo uso, válido 5 minutos.')
    c.drawString(M, 23 * mm, 'Este negocio publica sus ofertas y eventos en Klendar.')
    c.showPage(); c.save()
    return path


if __name__ == '__main__':
    print(guide()); print(poster())
