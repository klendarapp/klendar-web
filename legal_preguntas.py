# -*- coding: utf-8 -*-
"""Textos legales de «Preguntas al reservar» (Iván, 17-11-2026).

Un evento con reserva puede hacer preguntas a quien reserva («¿Menú
infantil?», «¿Talla de camiseta?»). Las de salud (alergias, intolerancias…)
solo se responden con consentimiento expreso (casilla sin marcar por
pregunta), se pueden retirar cuando se quiera y se borran al día siguiente
del evento; las demás, 7 días después. En la app: migraciones
20261284300000, 20261284300010, 20261284350000 (salud) y 20261284350010
(tipos), y la versión de las condiciones 20261284360000; RUNBOOK §4zq. El
interruptor `app_config.booking_questions` sigue apagado: lo enciende Iván.

Cómo funciona, igual que `legal_encargos.py`: `build_legal.py` genera los
textos de siempre (ya con los de Encargos) y, si `PREGUNTAS_DESDE` tiene
fecha, este módulo los cambia: sustituye frases exactas (si una no está, o
está dos veces, para y dice cuál) y añade lo nuevo.

  · PREGUNTAS_DESDE = None          → los textos de antes.
  · PREGUNTAS_DESDE = 'AAAA-MM-DD'  → la privacidad (fila nueva «Preguntas al
    reservar», detrás de «Encargos») y las condiciones para negocios
    (apartado 3 quaterdecies, «Preguntas al reservar»), con esa fecha en
    «Última actualización» y en el historial, y una versión nueva de las
    condiciones que se aplica 15 días después (Reglamento (UE) 2019/1150,
    art. 3.2). Los términos de las personas usuarias no cambian.

Iván aprobó los borradores el 17-11 tal cual (privacidad, RAT, condiciones y
las preguntas al abogado). La privacidad es el texto aprobado repartido en
las columnas de la tabla.
"""
import legal_encargos
from legal_ia import _aplica_lista, aplica, fecha, fechas

# ════════════════════════════════════════════════════════════════════════════
# LA FECHA DEL DÍA EN QUE SE PUBLICARON (AAAA-MM-DD). Tiene que coincidir con
# la versión de las condiciones de la migración 20261284360000 de la app.
# ════════════════════════════════════════════════════════════════════════════
PREGUNTAS_DESDE = '2026-11-16'


def activo():
    return bool(PREGUNTAS_DESDE)


def version():
    """La versión de las condiciones: «-c» si ese día ya están la del contacto y la de Encargos («-b»)."""
    if PREGUNTAS_DESDE == legal_encargos.ENCARGOS_DESDE:
        return PREGUNTAS_DESDE + ('-c' if legal_encargos.version().endswith('-b') else '-b')
    return PREGUNTAS_DESDE


# ════════════════════════════════════════════════════════════════════════════
# PRIVACIDAD
# ════════════════════════════════════════════════════════════════════════════
FILA_ES = (
    '<tr><td>Preguntas al reservar</td>'
    '<td>Si un negocio hace preguntas al reservar un evento (por ejemplo, «¿Menú infantil?» o «¿Talla de camiseta?»), '
    'guardamos tus respuestas con tu reserva. Puedes verlas y cambiarlas mientras tu reserva siga en pie. Si una '
    'pregunta es sobre salud (por ejemplo, alergias o intolerancias), solo la respondes si marcas su casilla de '
    'consentimiento; puedes retirarlo cuando quieras desde tu código y borramos esa respuesta</td>'
    '<td>Se las enseñamos al negocio y a su equipo solo para organizar ese evento</td>'
    '<td>Ejecución del servicio que pides (art. 6.1.b RGPD) y, para las respuestas de salud, tu consentimiento expreso '
    '(art. 9.2.a RGPD)</td>'
    '<td>Las respuestas de salud las borramos al día siguiente del evento; las demás, 7 días después, o esa misma noche '
    'si anulas la reserva</td></tr>\n')

FILA_EN = (
    '<tr><td>Booking questions</td>'
    '<td>If a business asks questions when you book an event (e.g. “Kids’ menu?” or “T-shirt size?”), we store your '
    'answers with your booking. You can see and change them while your booking stands. If a question is about health '
    '(e.g. allergies or intolerances), you only answer it if you tick its consent box; you can withdraw consent at any '
    'time from your code and we delete that answer</td>'
    '<td>We show them to the business and its team only to organise that event</td>'
    '<td>Performance of the service you request (Art. 6(1)(b) GDPR) and, for health answers, your explicit consent '
    '(Art. 9(2)(a) GDPR)</td>'
    '<td>We delete health answers the day after the event; the others 7 days after it, or the same night if you '
    'cancel</td></tr>\n')


def _privacidad(lang, E):
    if lang == 'es':
        return [('<tr><td>Peticiones de grupo (Grupos y empresas)</td>',
                 FILA_ES + '<tr><td>Peticiones de grupo (Grupos y empresas)</td>')]
    return [('<tr><td>Group requests (Groups and companies)</td>',
             FILA_EN + '<tr><td>Group requests (Groups and companies)</td>')]


# ════════════════════════════════════════════════════════════════════════════
# CONDICIONES PARA NEGOCIOS
# ════════════════════════════════════════════════════════════════════════════
APARTADO_ES = (
    '<p>Puedes hacer las preguntas que quieras a quien reserva un evento. Pregunta solo lo que necesites para ese '
    'evento. Puedes preguntar por salud (alergias, intolerancias…) solo si lo necesitas para preparar el evento y '
    'marcando la pregunta como de salud (Klendar la marca sola si detecta palabras de salud): esas preguntas no pueden '
    'ser obligatorias y quien reserva solo las responde si da su consentimiento. No pidas otras categorías especiales '
    'de datos (religión, ideología, orientación sexual…). Usa las respuestas solo para organizar ese evento: no las '
    'guardes fuera de Klendar más de lo necesario ni las uses para publicidad; las de salud, bórralas de tus copias '
    '(también del CSV) en cuanto pase el evento. Eres responsable de lo que preguntas y de cómo usas las respuestas, '
    'también de las que exportas en el CSV. Klendar puede retirar preguntas que incumplan estas normas.</p>\n')

APARTADO_EN = (
    '<p>You may ask the questions you want to people booking an event. Only ask what you need for that event. You may '
    'ask about health (allergies, intolerances…) only if you need it to prepare the event and by marking the question '
    'as a health question (Klendar marks it automatically if it detects health words): those questions can’t be '
    'required and people booking only answer them if they give their consent. Don’t ask for other special categories '
    'of data (religion, beliefs, sexual orientation…). Use the answers only to organise that event: don’t keep them '
    'outside Klendar longer than needed or use them for advertising; delete health answers from your copies (CSV '
    'included) as soon as the event is over. You are responsible for what you ask and how you use the answers, '
    'including those you export to CSV. Klendar may remove questions that breach these rules.</p>\n')


def _negocios(lang, E):
    d, desde = PREGUNTAS_DESDE, aplica(PREGUNTAS_DESDE)
    e, desde_e = legal_encargos.ENCARGOS_DESDE, aplica(legal_encargos.ENCARGOS_DESDE)
    mismo_dia = d == e
    if lang == 'es':
        antes_aviso = (f'«Encargos» (apartado 3 terdecies), publicado el mismo día, también se aplica desde el '
                       f'<strong>{fecha(desde_e, "es")}</strong>. ')
        aviso = (f'«Preguntas al reservar» (apartado 3 quaterdecies), publicado el mismo día, también se aplica desde '
                 f'el <strong>{fecha(desde, "es")}</strong>. ' if mismo_dia else
                 f'Los del {fecha(d, "es")} (apartado 3 quaterdecies, «Preguntas al reservar») se aplican desde el '
                 f'<strong>{fecha(desde, "es")}</strong>, también 15 días después. ')
        return [
            (antes_aviso, antes_aviso + aviso),
            ('\n<h2>4. Prueba gratuita, precio y facturación</h2>',
             '\n<h2>3 quaterdecies. Preguntas al reservar</h2>\n' + APARTADO_ES
             + '\n<h2>4. Prueba gratuita, precio y facturación</h2>'),
        ]
    antes_aviso = (f'“Pre-orders” (section 3l), published the same day, also applies from '
                   f'<strong>{fecha(desde_e, "en")}</strong>. ')
    aviso = (f'“Booking questions” (section 3m), published the same day, also applies from '
             f'<strong>{fecha(desde, "en")}</strong>. ' if mismo_dia else
             f'Those of {fecha(d, "en")} (section 3m, “Booking questions”) apply from '
             f'<strong>{fecha(desde, "en")}</strong>, also 15 days later. ')
    return [
        (antes_aviso, antes_aviso + aviso),
        ('\n<h2>4. Free trial, pricing and invoicing</h2>',
         '\n<h2>3m. Booking questions</h2>\n' + APARTADO_EN + '\n<h2>4. Free trial, pricing and invoicing</h2>'),
    ]


def versiones_negocios():
    """Fila nueva de VERSIONES_NEGOCIOS (versión, publicada, se aplica desde)."""
    if not activo():
        return []
    return [(version(), PREGUNTAS_DESDE, aplica(PREGUNTAS_DESDE))]


def aplicar(ES, EN, E):
    """Cambia los cuerpos de las páginas de build_legal.py (si PREGUNTAS_DESDE tiene fecha), después de Encargos."""
    if not activo():
        return
    for slug, f in (('privacidad', _privacidad), ('negocios', _negocios)):
        _aplica_lista(ES, slug, 'es', f('es', E))
        _aplica_lista(EN, slug, 'en', f('en', E))


# ════════════════════════════════════════════════════════════════════════════
# HISTORIAL DE CAMBIOS: (slug, fecha, ES, EN)
# ════════════════════════════════════════════════════════════════════════════
def cambios():
    if not activo():
        return []
    f = fechas(PREGUNTAS_DESDE)
    desde = fechas(aplica(PREGUNTAS_DESDE))
    return [
        ('privacidad', f,
         'Preguntas al reservar: fila nueva con lo que guardamos cuando respondes a las preguntas de un negocio al '
         'reservar un evento, que solo las ve el negocio para organizarlo, que las de salud solo se responden con tu '
         'consentimiento expreso (art. 9.2.a RGPD), que lo puedes retirar cuando quieras y que se borran al día '
         'siguiente del evento (las demás, 7 días después).',
         'Booking questions: new row with what we keep when you answer a business’s questions when booking an event, '
         'that only the business sees them to organise it, that health questions are only answered with your explicit '
         'consent (Art. 9(2)(a) GDPR), that you can withdraw it at any time and that they are deleted the day after the '
         'event (the others, 7 days after it).'),
        ('negocios', f,
         'Apartado 3 quaterdecies nuevo, «Preguntas al reservar»: las preguntas que quieras, solo lo que necesites; '
         'sobre salud, solo si hace falta para el evento y marcándola como tal, nunca obligatoria y con el '
         'consentimiento de quien responde; ninguna otra categoría especial de datos; las respuestas, solo para ese '
         'evento (las de salud, borradas de tus copias al pasar), y la responsabilidad del Negocio, también por el CSV. '
         f'Se aplica desde el {desde["es"]}, 15 días después de publicarlo y avisar.',
         'New section 3m, “Booking questions”: the questions you want, only what you need; about health, only if '
         'needed for the event and marked as such, never required and with the consent of the person answering; no '
         'other special categories of data; the answers, only for that event (health ones deleted from your copies '
         'afterwards), and the Business’s responsibility, CSV included. '
         f'It applies from {desde["en"]}, 15 days after publishing it and notifying you.'),
    ]
