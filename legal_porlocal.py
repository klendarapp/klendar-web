# -*- coding: utf-8 -*-
"""Cada local paga lo suyo: las condiciones para negocios sin precio por
volumen (Iván, 18-11-2026: «sí, cada local paga lo suyo, es más fácil, si hay
que cambiarlo en app y web»).

Cambia SOLO lo que dice cómo se paga con varios locales, en ES y EN, apartados
3 bis, 4 y 5; nada más cambia de fondo:

  · apartado 4 («Precio»): fuera «con varios locales, el primero paga la cuota
    entera y, a partir del segundo, la de cada local es menor». Ahora cada
    local tiene su propia suscripción (forma de pago y factura) y paga la cuota
    entera; Klendar puede dar descuentos puntuales con un código promocional;
  · apartado 5: la pausa, el traspaso y eliminar el Negocio hablan de la
    suscripción de ese local (fuera «si incluye otros locales…»);
  · apartado 3 bis (párrafo de la versión 2026-11-18-b): fuera «si incluye
    otros locales, deja de incluir este y se cobra uno menos».

Recoge lo que hace la app desde la migración 20261285700000_cobro_por_local
(RUNBOOK §4zzd de la app). Hoy nadie paga con varios locales en una
suscripción (en prod no hay ninguna suscripción de Stripe), así que no hace
falta una regla de transición.

Cómo funciona, igual que `legal_entidad.py`: `build_legal.py` genera los
textos de siempre y, si `PORLOCAL_DESDE` tiene fecha, este módulo cambia las
frases (si una no está, o está dos veces, para y dice cuál), apunta la línea
del historial y «Última actualización» de las condiciones para negocios y una
versión nueva que se aplica 15 días después (Reglamento (UE) 2019/1150, art.
3.2; migración 20261285700010 de la app). Las demás páginas legales no cambian.

  · PORLOCAL_DESDE = None          → los textos de antes.
  · PORLOCAL_DESDE = 'AAAA-MM-DD'  → con los cambios.
"""
import legal_entidad
from legal_ia import _aplica_lista, aplica, fecha, fechas

# ════════════════════════════════════════════════════════════════════════════
# LA FECHA DEL DÍA EN QUE SE PUBLICÓ (AAAA-MM-DD). Tiene que coincidir con la
# versión de las condiciones de la migración 20261285700010 de la app.
# ════════════════════════════════════════════════════════════════════════════
PORLOCAL_DESDE = '2026-11-18'

CAMBIOS = {
    'es': [
        # Apartado 4, «Precio».
        ('Con varios locales, el primero paga la cuota entera y, a partir del segundo, la de cada local es menor, '
         'según la tabla de <a href="/precios">klendar.app/precios</a>.',
         'Cada local tiene <strong>su propia suscripción</strong>, con su forma de pago y su factura, y paga la cuota '
         'entera: no hay descuento por número de locales. Contratarla, cambiar la forma de pago, pausarla, cancelarla '
         'o traspasar el local afecta solo a ese local. Klendar puede ofrecer descuentos puntuales con un '
         '<strong>código promocional</strong>, que se introduce al pagar y se aplica en las condiciones que indique '
         'el propio código.'),
        # Apartado 5, «Pausa por cierre».
        ('Si la suscripción incluye varios locales, se pausan todos.',
         'Se pausa la suscripción de ese local; los demás locales no cambian.'),
        # Apartado 5, «Traspaso».
        ('(la suscripción de quien lo tenía deja de incluirlo y no se le vuelve a cobrar por él)',
         '(la suscripción de ese local que pagaba quien lo tenía no se renueva y no se le vuelve a cobrar por él)'),
        # Apartado 5, «Eliminar el Negocio».
        ('La suscripción se cancela en ese momento (si incluye otros locales, deja de incluir este).',
         'La suscripción de ese local se cancela en ese momento.'),
        # Apartado 3 bis (versión 2026-11-18-b).
        (' (si incluye otros locales, deja de incluir este y desde la factura siguiente se cobra uno menos)', ''),
    ],
    'en': [
        ('With several venues, the first one pays the full fee and, from the second one on, the fee for each venue '
         'is lower, according to the table at <a href="/en/pricing">klendar.app/en/pricing</a>.',
         'Each venue has <strong>its own subscription</strong>, with its own payment method and invoice, and pays the '
         'full fee: there is no discount for the number of venues. Taking it out, changing the payment method, '
         'pausing it, cancelling it or transferring the venue only affects that venue. Klendar may offer one-off '
         'discounts with a <strong>promotion code</strong>, entered when paying and applied on the terms stated by '
         'the code itself.'),
        ("If the subscription covers several venues, they're all paused.",
         "That venue's subscription is paused; the other venues don't change."),
        ("(the previous holder's subscription stops covering it and they're no longer charged for it)",
         "(the subscription for that venue that the previous holder paid doesn't renew and they're no longer "
         "charged for it)"),
        ('The subscription is cancelled at that moment (if it covers other venues, it stops covering this one).',
         "That venue's subscription is cancelled at that moment."),
        (' (if it covers other venues, it stops covering this one and one fewer is charged from the next invoice)', ''),
    ],
}


def activo():
    return bool(PORLOCAL_DESDE)


def version():
    """La versión de las condiciones (la letra siguiente si ese día ya hay la de la entidad)."""
    e = legal_entidad.version()
    if PORLOCAL_DESDE != legal_entidad.ENTIDAD_DESDE:
        return PORLOCAL_DESDE
    return PORLOCAL_DESDE + ('-b' if e == PORLOCAL_DESDE else '-' + chr(ord(e[-1]) + 1))


def _negocios(lang):
    desde = aplica(PORLOCAL_DESDE)
    e = legal_entidad.ENTIDAD_DESDE
    if lang == 'es':
        antes = (f'Lo de un Negocio que ya paga y pasa a tener cuenta de entidad (apartado 3 bis), publicado el mismo '
                 f'día, también se aplica desde el <strong>{fecha(aplica(e), "es")}</strong>. ')
        aviso = (f'Que cada local tenga su propia suscripción y pague la cuota entera, sin descuento por número de '
                 f'locales (apartados 3 bis, 4 y 5), publicado el mismo día, también se aplica desde el '
                 f'<strong>{fecha(desde, "es")}</strong>. ')
    else:
        antes = (f'What happens when a Business that already pays gets an organisation account (section 3a), published '
                 f'the same day, also applies from <strong>{fecha(aplica(e), "en")}</strong>. ')
        aviso = (f'Each venue having its own subscription and paying the full fee, with no discount for the number of '
                 f'venues (sections 3a, 4 and 5), published the same day, also applies from '
                 f'<strong>{fecha(desde, "en")}</strong>. ')
    return [(antes, antes + aviso)] + CAMBIOS[lang]


def versiones_negocios():
    """Fila nueva de VERSIONES_NEGOCIOS (versión, publicada, se aplica desde)."""
    if not activo():
        return []
    return [(version(), PORLOCAL_DESDE, aplica(PORLOCAL_DESDE))]


def aplicar(ES, EN, E):
    """Cambia las condiciones para negocios (si PORLOCAL_DESDE tiene fecha), detrás de la entidad."""
    if not activo():
        return
    _aplica_lista(ES, 'negocios', 'es', _negocios('es'))
    _aplica_lista(EN, 'negocios', 'en', _negocios('en'))


# ════════════════════════════════════════════════════════════════════════════
# HISTORIAL DE CAMBIOS: (slug, fecha, ES, EN)
# ════════════════════════════════════════════════════════════════════════════
def cambios():
    if not activo():
        return []
    f = fechas(PORLOCAL_DESDE)
    desde = fechas(aplica(PORLOCAL_DESDE))
    return [
        ('negocios', f,
         'Cada local paga lo suyo (apartados 3 bis, 4 y 5): cada local tiene su propia suscripción, con su forma de '
         'pago y su factura, y paga la cuota entera; deja de haber un precio menor a partir del segundo local. '
         'Klendar puede ofrecer descuentos puntuales con un código promocional. La pausa, el traspaso, eliminar el '
         'Negocio y pasar a cuenta de entidad afectan solo a la suscripción de ese local. '
         f'Se aplica desde el {desde["es"]}, 15 días después de publicarlo y avisar.',
         'Each venue pays its own way (sections 3a, 4 and 5): each venue has its own subscription, with its own '
         'payment method and invoice, and pays the full fee; there is no longer a lower price from the second venue '
         'on. Klendar may offer one-off discounts with a promotion code. Pausing, transferring, deleting the '
         'Business and switching to an organisation account only affect that venue\'s subscription. '
         f'It applies from {desde["en"]}, 15 days after publishing it and notifying you.'),
    ]
