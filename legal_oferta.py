# -*- coding: utf-8 -*-
"""«Oferta flash» pasa a llamarse «Oferta» también en los textos legales
(Iván, 18-11-2026).

Solo cambia el nombre: ninguna frase cambia de sentido. En la app y en el
resto de la web ya no se dice «oferta flash» (RUNBOOK §4zza de la app); aquí
se cambian las frases exactas que lo decían:

  · aviso legal: «ofertas de duración limitada ("ofertas flash")» → «ofertas
    de duración limitada» (EN: «time-limited deals ("flash deals")» →
    «time-limited deals»);
  · privacidad, fila de «Avísame si…»: «Ofertas flash cerca de ti» → «Ofertas
    cerca de ti», el nombre nuevo del ajuste (EN: “Flash offers near you” →
    “Offers near you”);
  · términos, el código QR: «unos minutos en una oferta flash» → «unos minutos
    en una oferta» (EN: «for a flash offer» → «for an offer»);
  · condiciones para negocios, apartado 2: «publicar ofertas flash y eventos»
    → «publicar ofertas y eventos» (EN: «publish flash deals and events» →
    «publish offers and events»).

Cómo funciona, igual que `legal_preguntas.py`: `build_legal.py` genera los
textos de siempre y, si `OFERTA_DESDE` tiene fecha, este módulo sustituye las
frases exactas (si una no está, o está dos veces, para y dice cuál), apunta
la línea del historial y «Última actualización» de cada página y una versión
nueva de las condiciones para negocios que se aplica 15 días después
(Reglamento (UE) 2019/1150, art. 3.2; migración 20261285100010 de la app).
VERSION de los términos no se sube (informativo para las personas usuarias).

  · OFERTA_DESDE = None          → los textos de antes.
  · OFERTA_DESDE = 'AAAA-MM-DD'  → los textos nuevos.
"""
import legal_preguntas
from legal_ia import _aplica_lista, aplica, fecha, fechas

# ════════════════════════════════════════════════════════════════════════════
# LA FECHA DEL DÍA EN QUE SE PUBLICARON (AAAA-MM-DD). Tiene que coincidir con
# la versión de las condiciones de la migración 20261285100010 de la app.
# ════════════════════════════════════════════════════════════════════════════
OFERTA_DESDE = '2026-11-18'


def activo():
    return bool(OFERTA_DESDE)


def version():
    """La versión de las condiciones (con «-b» si ese día ya hay la de «Preguntas al reservar»)."""
    return OFERTA_DESDE + ('-b' if OFERTA_DESDE == legal_preguntas.PREGUNTAS_DESDE else '')


def _aviso_legal(lang):
    if lang == 'es':
        return [('publicar ofertas de duración limitada ("ofertas flash") y eventos',
                 'publicar ofertas de duración limitada y eventos')]
    return [('publish time-limited deals ("flash deals") and events',
             'publish time-limited deals and events')]


def _privacidad(lang):
    if lang == 'es':
        return [('la distancia de «Ofertas flash cerca de ti»', 'la distancia de «Ofertas cerca de ti»')]
    return [('your “Flash offers near you” distance', 'your “Offers near you” distance')]


def _terminos(lang):
    if lang == 'es':
        return [('unos minutos en una oferta flash;', 'unos minutos en una oferta;')]
    return [('a few minutes for a flash offer;', 'a few minutes for an offer;')]


def _negocios(lang):
    d, desde = OFERTA_DESDE, aplica(OFERTA_DESDE)
    p = legal_preguntas.PREGUNTAS_DESDE
    if lang == 'es':
        antes = (f'«Preguntas al reservar» (apartado 3 quaterdecies), publicado el mismo día, también se aplica desde '
                 f'el <strong>{fecha(aplica(p), "es")}</strong>. ')
        aviso = (f'Los del {fecha(d, "es")} (apartado 2: «oferta flash» pasa a llamarse «oferta», sin ningún otro '
                 f'cambio) se aplican desde el <strong>{fecha(desde, "es")}</strong>, también 15 días después. ')
        return [
            (antes, antes + aviso),
            ('Klendar permite al Negocio publicar ofertas flash y eventos',
             'Klendar permite al Negocio publicar ofertas y eventos'),
        ]
    antes = (f'“Booking questions” (section 3m), published the same day, also applies from '
             f'<strong>{fecha(aplica(p), "en")}</strong>. ')
    aviso = (f'Those of {fecha(d, "en")} (section 2: “flash deals” are now called “offers”, with no other change) '
             f'apply from <strong>{fecha(desde, "en")}</strong>, also 15 days later. ')
    return [
        (antes, antes + aviso),
        ('Klendar lets the Business publish flash deals and events',
         'Klendar lets the Business publish offers and events'),
    ]


def versiones_negocios():
    """Fila nueva de VERSIONES_NEGOCIOS (versión, publicada, se aplica desde)."""
    if not activo():
        return []
    return [(version(), OFERTA_DESDE, aplica(OFERTA_DESDE))]


def aplicar(ES, EN, E):
    """Cambia los cuerpos de las páginas de build_legal.py (si OFERTA_DESDE tiene fecha), al final de todo."""
    if not activo():
        return
    for slug, f in (('aviso-legal', _aviso_legal), ('privacidad', _privacidad),
                    ('terminos', _terminos), ('negocios', _negocios)):
        _aplica_lista(ES, slug, 'es', f('es'))
        _aplica_lista(EN, slug, 'en', f('en'))


# ════════════════════════════════════════════════════════════════════════════
# HISTORIAL DE CAMBIOS: (slug, fecha, ES, EN)
# ════════════════════════════════════════════════════════════════════════════
def cambios():
    if not activo():
        return []
    f = fechas(OFERTA_DESDE)
    desde = fechas(aplica(OFERTA_DESDE))
    es = '«Oferta flash» pasa a llamarse «oferta», como en la app y en la web. Solo cambia el nombre.'
    en = '“Flash offer” (“flash deal”) is now called “offer”, as in the app and on the website. Only the name changes.'
    return [
        ('aviso-legal', f, es, en),
        ('privacidad', f,
         'El ajuste «Ofertas flash cerca de ti» se llama ahora «Ofertas cerca de ti». Solo cambia el nombre.',
         'The “Flash offers near you” setting is now called “Offers near you”. Only the name changes.'),
        ('terminos', f, es, en),
        ('negocios', f,
         '«Oferta flash» pasa a llamarse «oferta» (apartado 2), como en la app y en la web. Solo cambia el nombre. '
         f'Se aplica desde el {desde["es"]}, 15 días después de publicarlo y avisar.',
         '“Flash deal” is now called “offer” (section 2), as in the app and on the website. Only the name changes. '
         f'It applies from {desde["en"]}, 15 days after publishing it and notifying you.'),
    ]
