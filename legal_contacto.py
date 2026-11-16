# -*- coding: utf-8 -*-
"""Textos legales de «Contacto de quien reserva» (Iván, 17-11-2026).

El equipo del negocio (todo: propietario, encargados y personal) ve el
nombre, sin foto, de quien está en la lista de espera de sus eventos y, de
quien reserva, se apunta a su lista de espera o coge número en su cola y ha
visto el aviso al hacerlo, el correo de la cuenta y el teléfono que decida
darle (opcional), para avisarle de cambios. Lo deja de ver 7 días después del
evento (en la cola, al acabar el día). En la app: migraciones
20261282900000 (`waitlist_names`), 20261283000000, 20261283000010 y
20261283000020 (`contact_details`, todo el equipo) y la versión de las
condiciones 20261283000030; RUNBOOK §3a-sexies y §3a-septies.

Cómo funciona, igual que `legal_ia.py`: `build_legal.py` y `ayuda.py` generan
los textos de siempre (ya con los de IA) y, si `CONTACTO_DESDE` tiene fecha,
este módulo los cambia: sustituye frases exactas (si una no está, o está dos
veces, para y dice cuál) y añade lo nuevo.

  · CONTACTO_DESDE = None          → los textos de antes.
  · CONTACTO_DESDE = 'AAAA-MM-DD'  → la privacidad (párrafo «Los negocios ven
    tu nombre mostrado…» y fila «Teléfono de contacto») y las condiciones
    para negocios (apartado 3, «Contacto de quien reserva»), con esa fecha en
    «Última actualización» y en el historial, y una versión nueva de las
    condiciones que se aplica 15 días después (Reglamento (UE) 2019/1150,
    art. 3.2), más dos preguntas de la ayuda.

Iván aprobó el paquete el 17-11 («el equipo del negocio» donde ponía «el
propietario y los encargados») y se publicó el 16-11-2026 (la fecha del
servidor). Ese día se encendieron en dev `waitlist_names` y
`contact_details`; prod lo enciende Iván.
"""
import legal_ia
from legal_ia import _aplica_lista, aplica, fecha, fechas

# ════════════════════════════════════════════════════════════════════════════
# LA FECHA DEL DÍA EN QUE SE PUBLICARON (AAAA-MM-DD). Tiene que coincidir con
# la versión de las condiciones de la migración 20261283000030 de la app (se
# aplica el 1-12-2026).
# ════════════════════════════════════════════════════════════════════════════
CONTACTO_DESDE = '2026-11-16'


def activo():
    return bool(CONTACTO_DESDE)


# ════════════════════════════════════════════════════════════════════════════
# PRIVACIDAD
# ════════════════════════════════════════════════════════════════════════════
def _privacidad(lang, E):
    if lang == 'es':
        return [
            ('(en su lista de asistentes, que pueden descargar, con el número de plazas, la hora y si has entrado), ',
             '(en su lista de asistentes, que pueden descargar, con el número de plazas, la hora y si has entrado), '
             'cuando te apuntas a la lista de espera de uno de sus eventos (tu nombre mostrado, sin tu foto, por orden y, '
             'si te hemos avisado de una plaza, hasta cuándo te la guardamos), '),
            ('Nunca tu correo, tu teléfono, tu fecha de nacimiento ni tu ubicación, salvo el contacto que tú elijas darle al aceptar su propuesta en «Grupos y empresas».',
             'Nunca tu fecha de nacimiento ni tu ubicación. Tu correo y tu teléfono, solo el contacto que elijas darle en '
             '«Grupos y empresas» y, cuando reservas en uno de sus eventos, te apuntas a su lista de espera o coges número en '
             'su cola, tu correo y el teléfono que decidas darle en ese momento (opcional): solo para avisarte de cambios en '
             'eso, nunca para publicidad. Lo ve el equipo del negocio y deja de verlo 7 días después del evento (en la cola, '
             'al acabar el día).'),
            ('<tr><td>Avisos de reseña («¿Qué tal?»)</td>',
             '<tr><td>Teléfono de contacto</td><td>El que guardas en tu perfil (opcional, no lo verificamos) y una copia del '
             'que das al reservar, apuntarte a una lista de espera o coger número</td><td>Que el negocio pueda avisarte de un '
             'cambio y rellenarte el campo la próxima vez</td><td>Consentimiento (art. 6.1.a): lo borras cuando quieras</td>'
             '<td>Perfil: hasta que lo borres o elimines la cuenta; copia: 7 días tras el evento (cola: hasta las 6:00)</td></tr>\n'
             '<tr><td>Avisos de reseña («¿Qué tal?»)</td>'),
        ]
    return [
        ('(on their attendee list, which they can download, with the number of places, the time and whether you got in), ',
         '(on their attendee list, which they can download, with the number of places, the time and whether you got in), '
         "when you join the waiting list for one of their events (your display name, without your photo, in order and, "
         "if we've told you about a free place, until when we're holding it for you), "),
        ('Never your email, phone number, date of birth or location, except the contact details you choose to give them when accepting their proposal in “Groups and companies”.',
         'Never your date of birth or location. Your email and phone number, only the contact details you choose to give '
         'them in “Groups and companies” and, when you book at one of their events, join their waiting list or get a '
         'number in their queue, your email and the phone number you decide to give them at that moment (optional): only '
         "to let you know about changes to that, never for advertising. The business's team sees them and stops seeing "
         'them 7 days after the event (in the queue, at the end of the day).'),
        ('<tr><td>Review reminders (“How was it?”)</td>',
         "<tr><td>Contact phone</td><td>The one you save in your profile (optional, we don't verify it) and a copy of the "
         'one you give when booking, joining a waiting list or getting a number</td><td>Letting the business tell you '
         'about a change, and filling in the field for you next time</td><td>Consent (art. 6(1)(a)): you can delete it '
         'whenever you like</td><td>Profile: until you delete it or delete your account; copy: 7 days after the event '
         '(queue: until 6:00)</td></tr>\n'
         '<tr><td>Review reminders (“How was it?”)</td>'),
    ]


# ════════════════════════════════════════════════════════════════════════════
# CONDICIONES PARA NEGOCIOS
# ════════════════════════════════════════════════════════════════════════════
def _negocios(lang, E):
    d, desde = CONTACTO_DESDE, aplica(CONTACTO_DESDE)
    ia = fecha(aplica(legal_ia.IA_DESDE), lang)
    if lang == 'es':
        return [
            # El aviso de arriba: una frase más, detrás de la de los textos de IA.
            (f'se aplican desde el <strong>{ia}</strong>, también 15 días después.',
             f'se aplican desde el <strong>{ia}</strong>, también 15 días después. Los del {fecha(d, "es")} (apartado 3, '
             f'«Contacto de quien reserva») se aplican desde el <strong>{fecha(desde, "es")}</strong>, también 15 días después. '),
            # 3. Detrás de «Tratar los datos de las personas usuarias…».
            ('solo para prestar el servicio, sin fines propios ni cesiones.</li>\n',
             'solo para prestar el servicio, sin fines propios ni cesiones.</li>\n'
             '  <li><strong>Contacto de quien reserva.</strong> El correo y el teléfono de quien tiene una reserva, está en '
             'su lista de espera o en su cola solo puede usarlos para avisarle de algo de esa reserva, lista o turno (un '
             'cambio de hora, una cancelación, que le toca). Nunca para publicidad ni para meterlo en sus listas. No puede '
             'copiarlos ni guardarlos fuera de Klendar: dejan de verse 7 días después del evento (en la cola, al acabar el '
             'día).</li>\n'),
        ]
    return [
        (f'apply from <strong>{ia}</strong>, also 15 days later.',
         f'apply from <strong>{ia}</strong>, also 15 days later. Those of {fecha(d, "en")} (section 3, “Contact details '
         f'of people who book”) apply from <strong>{fecha(desde, "en")}</strong>, also 15 days later. '),
        ('only to provide the service, with no purposes of its own and no disclosure.</li>\n',
         'only to provide the service, with no purposes of its own and no disclosure.</li>\n'
         '  <li><strong>Contact details of people who book.</strong> It may only use the email and phone number of anyone '
         'who has a booking, is on its waiting list or in its queue to tell them about something to do with that '
         "booking, list or turn (a change of time, a cancellation, that it's their turn). Never for advertising or to add "
         "them to its own lists. It mustn't copy or keep them outside Klendar: they stop showing 7 days after the event "
         '(in the queue, at the end of the day).</li>\n'),
    ]


def versiones_negocios():
    """Fila nueva de VERSIONES_NEGOCIOS (versión, publicada, se aplica desde)."""
    if not activo():
        return []
    return [(CONTACTO_DESDE, CONTACTO_DESDE, aplica(CONTACTO_DESDE))]


def aplicar(ES, EN, E):
    """Cambia los cuerpos de las páginas de build_legal.py (si CONTACTO_DESDE tiene fecha), después de legal_ia."""
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
    f = fechas(CONTACTO_DESDE)
    desde = fechas(aplica(CONTACTO_DESDE))
    return [
        ('privacidad', f,
         'Lo que ven los negocios: el nombre, sin foto, de quien está en la lista de espera de uno de sus eventos y, de quien '
         'reserva, se apunta a su lista de espera o coge número en su cola, el correo y el teléfono que decida darle '
         '(opcional), solo para avisarle de cambios y hasta 7 días después del evento (en la cola, al acabar el día). Lo ve '
         'el equipo del negocio. Fila nueva «Teléfono de contacto».',
         'What businesses see: the name, without a photo, of anyone on the waiting list for one of their events and, for '
         'anyone who books, joins their waiting list or gets a number in their queue, their email and the phone number '
         'they decide to give (optional), only to let them know about changes and until 7 days after the event (in the '
         "queue, at the end of the day). The business's team sees them. New “Contact phone” row."),
        ('negocios', f,
         'Apartado 3, «Contacto de quien reserva»: el correo y el teléfono de quien tiene una reserva, está en la lista de '
         'espera o en la cola del Negocio, solo para avisarle de esa reserva, lista o turno; nunca para publicidad ni para '
         f'copiarlos o guardarlos fuera de Klendar. Se aplica desde el {desde["es"]}, 15 días después de publicarlo y avisar.',
         'Section 3, “Contact details of people who book”: the email and phone number of anyone who has a booking, is on '
         "the Business's waiting list or in its queue, only to tell them about that booking, list or turn; never for "
         f'advertising or to copy or keep them outside Klendar. It applies from {desde["en"]}, 15 days after publishing '
         'it and notifying you.'),
    ]


# ════════════════════════════════════════════════════════════════════════════
# AYUDA (ayuda.py): qué ve el negocio al reservar, y cómo avisar desde el negocio
# ════════════════════════════════════════════════════════════════════════════
def ayuda(preguntas, P):
    if not activo():
        return preguntas
    ti = P('que-ve-el-negocio-reserva', 'ti',
           '¿Qué ve el negocio cuando reservo, me apunto a la lista de espera o cojo número?',
           'Tu nombre mostrado y tu foto (en la lista de espera, solo el nombre) y, para avisarte si hay algún cambio, tu '
           'correo y el teléfono que decidas darle (es opcional). Nunca para publicidad. Lo ve el equipo del negocio y '
           'deja de verlo 7 días después del evento (en la cola, al acabar el día). El teléfono que guardas en tu perfil '
           'lo cambias o lo borras en «Tus datos». Más en la <a href="/privacidad">política de privacidad</a>.',
           'What does the business see when I book, join the waiting list or get a number?',
           'Your display name and photo (on the waiting list, just your name) and, so they can let you know if anything '
           "changes, your email and the phone number you decide to give them (it's optional). Never for advertising. The "
           "business's team sees them and stops seeing them 7 days after the event (in the queue, at the end of the day). "
           'You can change or delete the phone number saved in your profile in “Your data”. More in the '
           '<a href="/en/privacy">privacy policy</a>.')
    negocio = P('avisar-a-quien-reserva', 'negocios',
                '¿Puedo avisar a quien ha reservado?',
                'Sí. En Asistentes, en la lista de espera y en la cola, cada persona tiene un botón para escribirle (su '
                'correo) y otro para llamarla, si dejó teléfono. Lo ve todo tu equipo. Úsalos solo para avisar de esa '
                'reserva, lista o turno (un cambio de hora, una cancelación, que le toca), nunca para publicidad, y no los '
                'copies fuera de Klendar: dejan de verse 7 días después del evento (en la cola, al acabar el día). Está en '
                'las <a href="/negocios">condiciones para negocios</a>.',
                'Can I let people who have booked know about something?',
                'Yes. In Attendees, on the waiting list and in the queue, each person has a button to email them and '
                'another to call them, if they left a phone number. Your whole team can see them. Use them only to let '
                'people know about that booking, list or turn (a change of time, a cancellation, that it\'s their turn), '
                "never for advertising, and don't copy them outside Klendar: they stop showing 7 days after the event (in "
                'the queue, at the end of the day). It\'s in the <a href="/en/business-terms">business terms</a>.')
    out = []
    for p in preguntas:
        out.append(p)
        if p['id'] == 'reservar-plaza':
            out.append(ti)
        if p['id'] == 'cola-virtual-negocio':
            out.append(negocio)
    if not any(p['id'] == ti['id'] for p in out) or not any(p['id'] == negocio['id'] for p in out):
        raise SystemExit('legal_contacto.py: no están «reservar-plaza» o «cola-virtual-negocio» en ayuda.py; '
                         'mira dónde poner las preguntas del contacto.')
    return out
