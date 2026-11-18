# -*- coding: utf-8 -*-
"""Un Negocio que ya paga y pasa a tener cuenta de entidad deja de pagar cuota:
una línea nueva en las condiciones para negocios (Iván, 18-11-2026: «sí a las
tres»).

Solo añade un párrafo al final del apartado 3 bis («Cuentas de entidad»), en ES
y EN, detrás del de «no pagan cuota»; nada más cambia de fondo. Recoge lo que
hace la app desde la migración 20261285400080_entidad_cancela_stripe (RUNBOOK
§4zza-bis de la app): la suscripción no se renueva al final del periodo pagado
(o, con más locales, se cobra uno menos), se avisa por correo y en la app, lo
pagado no se devuelve y, si deja de ser entidad, la suscripción no se reactiva
sola.

Cómo funciona, igual que `legal_oferta.py`: `build_legal.py` genera los textos
de siempre y, si `ENTIDAD_DESDE` tiene fecha, este módulo añade el párrafo (si
el ancla no está, o está dos veces, para y dice cuál), apunta la línea del
historial y «Última actualización» de las condiciones para negocios y una
versión nueva que se aplica 15 días después (Reglamento (UE) 2019/1150, art.
3.2; migración 20261285400090 de la app). Las demás páginas legales no cambian.

  · ENTIDAD_DESDE = None          → los textos de antes.
  · ENTIDAD_DESDE = 'AAAA-MM-DD'  → con el párrafo nuevo.
"""
import legal_oferta
from legal_ia import _aplica_lista, aplica, fecha, fechas

# ════════════════════════════════════════════════════════════════════════════
# LA FECHA DEL DÍA EN QUE SE PUBLICÓ (AAAA-MM-DD). Tiene que coincidir con la
# versión de las condiciones de la migración 20261285400090 de la app.
# ════════════════════════════════════════════════════════════════════════════
ENTIDAD_DESDE = '2026-11-18'

PARRAFO = {
    'es': ('<p>Si un Negocio que ya paga pasa a tener cuenta de entidad, desde ese momento deja de pagar cuota: su '
           'suscripción no se renueva al final del periodo ya pagado (si incluye otros locales, deja de incluir este y '
           'desde la factura siguiente se cobra uno menos) y se lo avisamos por correo y en la app. Lo ya pagado de ese '
           'periodo no se devuelve. Si deja de tener cuenta de entidad, la suscripción anterior no se reactiva '
           'sola.</p>'),
    'en': ("<p>If a Business that already pays gets an organisation account, from then on it stops paying the fee: its "
           "subscription doesn't renew at the end of the period already paid (if it covers other venues, it stops "
           "covering this one and one fewer is charged from the next invoice) and we let it know by email and in the "
           "app. What has already been paid for that period is not refunded. If it stops having an organisation "
           "account, the previous subscription doesn't restart on its own.</p>"),
}

# El final del párrafo de «no pagan cuota» (apartado 3 bis / 3a): el nuevo va detrás.
ANCLA = {
    'es': 'Si algún día hubiera funciones nuevas de pago, serían opcionales y la Entidad podría seguir usando gratis todo lo demás.</p>',
    'en': 'If paid features are ever added, they will be optional and the Organisation may keep using everything else for free.</p>',
}


def activo():
    return bool(ENTIDAD_DESDE)


def version():
    """La versión de las condiciones («-b» si ese día ya hay la de «oferta flash» → «oferta»)."""
    if ENTIDAD_DESDE != legal_oferta.OFERTA_DESDE:
        return ENTIDAD_DESDE
    o = legal_oferta.version()
    return ENTIDAD_DESDE + ('-b' if o == ENTIDAD_DESDE else '-' + chr(ord(o[-1]) + 1))


def _negocios(lang):
    desde = aplica(ENTIDAD_DESDE)
    o = legal_oferta.OFERTA_DESDE
    if lang == 'es':
        antes = (f'Los del {fecha(o, "es")} (apartado 2: «oferta flash» pasa a llamarse «oferta», sin ningún otro '
                 f'cambio) se aplican desde el <strong>{fecha(aplica(o), "es")}</strong>, también 15 días después. ')
        aviso = (f'Lo de un Negocio que ya paga y pasa a tener cuenta de entidad (apartado 3 bis), publicado el mismo '
                 f'día, también se aplica desde el <strong>{fecha(desde, "es")}</strong>. ')
    else:
        antes = (f'Those of {fecha(o, "en")} (section 2: “flash deals” are now called “offers”, with no other change) '
                 f'apply from <strong>{fecha(aplica(o), "en")}</strong>, also 15 days later. ')
        aviso = (f'What happens when a Business that already pays gets an organisation account (section 3a), published '
                 f'the same day, also applies from <strong>{fecha(desde, "en")}</strong>. ')
    return [
        (antes, antes + aviso),
        (ANCLA[lang], ANCLA[lang] + '\n' + PARRAFO[lang]),
    ]


def versiones_negocios():
    """Fila nueva de VERSIONES_NEGOCIOS (versión, publicada, se aplica desde)."""
    if not activo():
        return []
    return [(version(), ENTIDAD_DESDE, aplica(ENTIDAD_DESDE))]


def aplicar(ES, EN, E):
    """Añade el párrafo a las condiciones para negocios (si ENTIDAD_DESDE tiene fecha), al final de todo."""
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
    f = fechas(ENTIDAD_DESDE)
    desde = fechas(aplica(ENTIDAD_DESDE))
    return [
        ('negocios', f,
         'Cuentas de entidad (apartado 3 bis): si un Negocio que ya paga pasa a tener cuenta de entidad, deja de pagar '
         'cuota (su suscripción no se renueva al final del periodo pagado o, si incluye otros locales, se cobra uno '
         'menos), se lo avisamos y lo ya pagado no se devuelve; si deja de tener cuenta de entidad, la suscripción no '
         f'se reactiva sola. Se aplica desde el {desde["es"]}, 15 días después de publicarlo y avisar.',
         'Organisation accounts (section 3a): if a Business that already pays gets an organisation account, it stops '
         "paying the fee (its subscription doesn't renew at the end of the paid period or, if it covers other venues, "
         "one fewer is charged), we let it know and what has already been paid is not refunded; if it stops having an "
         "organisation account, the subscription doesn't restart on its own. "
         f'It applies from {desde["en"]}, 15 days after publishing it and notifying you.'),
    ]
