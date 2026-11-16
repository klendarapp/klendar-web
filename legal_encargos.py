# -*- coding: utf-8 -*-
"""Textos legales de «Encargos» (Iván, 17-11-2026).

El cliente encarga en la app o en la web un producto de un negocio y lo
recoge y lo paga en el local; Klendar no cobra. En la app: migraciones
20261284000000 (`preorders`, `preorder_items`) y 20261284000010 (los 14
alérgenos por producto, obligatorios en comida), y la versión de las
condiciones 20261284100000; RUNBOOK §3a-octies. El interruptor
`app_config.preorders` sigue apagado: lo enciende Iván.

Cómo funciona, igual que `legal_contacto.py` y `legal_ia.py`:
`build_legal.py` genera los textos de siempre (ya con los de IA y los del
contacto) y, si `ENCARGOS_DESDE` tiene fecha, este módulo los cambia:
sustituye frases exactas (si una no está, o está dos veces, para y dice cuál)
y añade lo nuevo.

  · ENCARGOS_DESDE = None          → los textos de antes.
  · ENCARGOS_DESDE = 'AAAA-MM-DD'  → la privacidad (fila nueva «Encargos» y
    el párrafo «Los negocios ven tu nombre mostrado…»), los términos
    (apartado 3 octies, «Encargos») y las condiciones para negocios
    (apartado 3 terdecies, «Encargos»), con esa fecha en «Última
    actualización» y en el historial, y una versión nueva de las condiciones
    que se aplica 15 días después (Reglamento (UE) 2019/1150, art. 3.2).

Iván aprobó el paquete el 17-11 tal cual; después de escribirlo, la app
pidió los 14 alérgenos en comida y puso bajo la nota «No escribas datos de
salud…»: por eso la privacidad pide no poner datos de salud en la nota, los
términos dicen que los alérgenos se ven antes de encargar y las condiciones,
que en comida el negocio los marca. Se publicó el 16-11-2026 (la fecha del
servidor), el mismo día que el contacto de quien reserva: la versión de las
condiciones es `2026-11-16-b`.
"""
import legal_contacto
from legal_ia import _aplica_lista, aplica, fecha, fechas

# ════════════════════════════════════════════════════════════════════════════
# LA FECHA DEL DÍA EN QUE SE PUBLICARON (AAAA-MM-DD). Tiene que coincidir con
# la versión de las condiciones de la migración 20261284100000 de la app (se
# aplica el 1-12-2026).
# ════════════════════════════════════════════════════════════════════════════
ENCARGOS_DESDE = '2026-11-16'


def activo():
    return bool(ENCARGOS_DESDE)


def version():
    """La versión de las condiciones: con «-b» si ese día ya hay otra (la del contacto)."""
    return ENCARGOS_DESDE + '-b' if ENCARGOS_DESDE == legal_contacto.CONTACTO_DESDE else ENCARGOS_DESDE


# ════════════════════════════════════════════════════════════════════════════
# PRIVACIDAD
# ════════════════════════════════════════════════════════════════════════════
FILA_ES = (
    '<tr><td>Encargos</td>'
    '<td>Si haces un encargo, guardamos qué encargas (producto, cantidad y opciones), el día y la franja de recogida, tu '
    'nota si la escribes, cómo va el encargo y, si lo das, una copia de tu teléfono. En la nota no escribas datos de '
    'salud: los alérgenos del producto los ves antes de encargar. Si el producto es para mayores de 18, miramos la fecha '
    'de nacimiento de tu perfil</td>'
    '<td>Hacer llegar tu encargo al negocio y avisarte de cómo va. <strong>Qué ve el negocio:</strong> tu nombre '
    'mostrado, lo encargado y tu nota. Con el contacto activado, ve también tu correo y ese teléfono, solo para avisarte '
    'de ese encargo</td>'
    '<td>Ejecución del servicio (art. 6.1.b RGPD)</td>'
    '<td>La nota y el teléfono se borran 7 días después del día de recogida. El resto queda en «Tus códigos» mientras '
    'tengas la cuenta, puedes quitarlo de tu lista y sale en «Descargar mis datos». Si eliminas la cuenta, el encargo '
    'se queda en las cifras del negocio sin nadie detrás</td></tr>\n')

FILA_EN = (
    '<tr><td>Pre-orders</td>'
    "<td>If you place a pre-order, we keep what you've ordered (product, quantity and options), the pick-up day and time "
    "slot, your note if you write one, how the pre-order is going and, if you give it, a copy of your phone number. "
    "Please don't put any health details in the note: you can see the product's allergens before you order. If the "
    'product is for over-18s, we check the date of birth in your profile</td>'
    '<td>Getting your pre-order to the business and keeping you posted on it. <strong>What the business sees:</strong> '
    'your display name, what you ordered and your note. With contact details turned on, it also sees your email and '
    'that phone number, only to let you know about that pre-order</td>'
    '<td>Performance of the service (art. 6(1)(b) GDPR)</td>'
    '<td>The note and the phone number are deleted 7 days after the pick-up day. The rest stays in “Your codes” for as '
    "long as you have your account; you can remove it from your list and it's included in “Download my data”. If you "
    "delete your account, the pre-order stays in the business's figures with no one behind it</td></tr>\n")


def _privacidad(lang, E):
    if lang == 'es':
        return [
            # La fila, detrás de la de «Te aviso cuando esté listo».
            ('<tr><td>Peticiones de grupo (Grupos y empresas)</td>',
             FILA_ES + '<tr><td>Peticiones de grupo (Grupos y empresas)</td>'),
            # «Los negocios ven tu nombre mostrado…» (ya con el contacto de quien reserva).
            ('cuando coges número en su cola (tu turno), ',
             'cuando coges número en su cola (tu turno), cuando les haces un encargo (tu nombre mostrado, sin tu foto, lo '
             'que encargas y tu nota), '),
            ('te apuntas a su lista de espera o coges número en su cola, tu correo y el teléfono',
             'te apuntas a su lista de espera, coges número en su cola o le haces un encargo, tu correo y el teléfono'),
            ('deja de verlo 7 días después del evento (en la cola, al acabar el día).',
             'deja de verlo 7 días después del evento o del día de recogida del encargo (en la cola, al acabar el día).'),
        ]
    return [
        ('<tr><td>Group requests (Groups and companies)</td>',
         FILA_EN + '<tr><td>Group requests (Groups and companies)</td>'),
        ('when you get a number in their queue (your turn), ',
         'when you get a number in their queue (your turn), when you place a pre-order with them (your display name, '
         'without your photo, what you order and your note), '),
        ('join their waiting list or get a number in their queue, your email and the phone number',
         'join their waiting list, get a number in their queue or place a pre-order with them, your email and the phone '
         'number'),
        ('stops seeing them 7 days after the event (in the queue, at the end of the day).',
         "stops seeing them 7 days after the event or the pre-order's pick-up day (in the queue, at the end of the day)."),
    ]


# ════════════════════════════════════════════════════════════════════════════
# TÉRMINOS (personas usuarias)
# ════════════════════════════════════════════════════════════════════════════
def _terminos(lang, E):
    if lang == 'es':
        return [
            ('\n<h2>4. Reseñas y contenido de usuarios</h2>',
             '\n<h2>3 octies. Encargos</h2>\n'
             '<p>Algunos negocios te dejan encargarles productos desde Klendar para recogerlos en su local. Al encargar, el '
             'contrato es con el negocio; Klendar no cobra ni responde del pedido. El precio es orientativo y pagas en el '
             'local al recoger. Antes de encargar ves los alérgenos que ha marcado el negocio: si tienes una alergia, '
             'consúltalos o pregunta al negocio, y no escribas datos de salud en la nota. Puedes anular hasta el plazo que '
             'fije el negocio; si no vas a recoger, anúlalo.</p>\n'
             '\n<h2>4. Reseñas y contenido de usuarios</h2>'),
        ]
    return [
        ('\n<h2>4. Reviews and user content</h2>',
         '\n<h2>3g. Pre-orders</h2>\n'
         '<p>Some businesses let you pre-order products from them through Klendar and collect them at their premises. '
         "When you place a pre-order, your contract is with the business; Klendar doesn't take payment and isn't "
         'responsible for the order. The price is a guide and you pay at the premises when you collect. Before you '
         "order, you can see the allergens the business has marked: if you have an allergy, check them or ask the "
         "business, and don't put health details in the note. You can cancel up to the deadline the business sets; if "
         "you're not going to collect it, please cancel.</p>\n"
         '\n<h2>4. Reviews and user content</h2>'),
    ]


# ════════════════════════════════════════════════════════════════════════════
# CONDICIONES PARA NEGOCIOS
# ════════════════════════════════════════════════════════════════════════════
def _negocios(lang, E):
    d, desde = ENCARGOS_DESDE, aplica(ENCARGOS_DESDE)
    c, desde_c = legal_contacto.CONTACTO_DESDE, aplica(legal_contacto.CONTACTO_DESDE)
    mismo_dia = d == c
    if lang == 'es':
        aviso = (f'«Encargos» (apartado 3 terdecies), publicado el mismo día, también se aplica desde el '
                 f'<strong>{fecha(desde, "es")}</strong>. ' if mismo_dia else
                 f'Los del {fecha(d, "es")} (apartado 3 terdecies, «Encargos») se aplican desde el '
                 f'<strong>{fecha(desde, "es")}</strong>, también 15 días después. ')
        return [
            # El aviso de arriba: una frase más, detrás de la del contacto de quien reserva.
            (f'(apartado 3, «Contacto de quien reserva») se aplican desde el <strong>{fecha(desde_c, "es")}</strong>, '
             'también 15 días después. ',
             f'(apartado 3, «Contacto de quien reserva») se aplican desde el <strong>{fecha(desde_c, "es")}</strong>, '
             'también 15 días después. ' + aviso),
            ('\n<h2>4. Prueba gratuita, precio y facturación</h2>',
             '\n<h2>3 terdecies. Encargos</h2>\n'
             '<p>Si activas Encargos, tus clientes pueden encargarte productos desde Klendar para recogerlos y pagarlos en '
             'tu local. El encargo es un acuerdo directo entre tu negocio y el cliente. Klendar solo transmite el encargo y '
             'sus avisos: no cobra ni recibe pagos, no es parte del contrato y no responde de la preparación, calidad, '
             'precio, entrega ni anulación. El precio en Klendar es orientativo y el final lo fijas tú. Cumples la '
             'normativa que te aplique, en especial la de alimentos (higiene e información alimentaria, incluidos los '
             'alérgenos), la de consumo y la de venta de alcohol a menores. En comida, Klendar te pide marcar en cada '
             'producto cuáles de los 14 alérgenos del Reglamento (UE) 1169/2011 lleva, y el cliente los ve antes de '
             'encargar: lo que marcas es responsabilidad tuya, tiene que ser correcto y lo mantendrás al día. Usarás los '
             'datos de contacto del cliente solo para gestionar ese encargo.</p>\n'
             '\n<h2>4. Prueba gratuita, precio y facturación</h2>'),
        ]
    aviso = (f'“Pre-orders” (section 3l), published the same day, also applies from '
             f'<strong>{fecha(desde, "en")}</strong>. ' if mismo_dia else
             f'Those of {fecha(d, "en")} (section 3l, “Pre-orders”) apply from <strong>{fecha(desde, "en")}</strong>, '
             'also 15 days later. ')
    return [
        (f'(section 3, “Contact details of people who book”) apply from <strong>{fecha(desde_c, "en")}</strong>, '
         'also 15 days later. ',
         f'(section 3, “Contact details of people who book”) apply from <strong>{fecha(desde_c, "en")}</strong>, '
         'also 15 days later. ' + aviso),
        ('\n<h2>4. Free trial, pricing and invoicing</h2>',
         '\n<h2>3l. Pre-orders</h2>\n'
         '<p>If you turn on Pre-orders, your customers can pre-order products from you through Klendar, then collect and '
         'pay for them at your premises. A pre-order is an agreement directly between your business and the customer. '
         "Klendar only passes on the pre-order and its notifications: it doesn't take or receive any payment, isn't a "
         "party to the contract and isn't responsible for how the order is prepared, its quality, price or handover, or "
         'its cancellation. The price shown on Klendar is a guide; you set the final one. You comply with the rules that '
         'apply to you, in particular food law (hygiene and food information, allergens included), consumer law and the '
         'rules on selling alcohol to minors. For food, Klendar asks you to mark on each product which of the 14 '
         'allergens listed in Regulation (EU) 1169/2011 it contains, and the customer sees them before ordering: what '
         "you mark is your responsibility, it must be accurate and you'll keep it up to date. You'll use the customer's "
         'contact details only to handle that pre-order.</p>\n'
         '\n<h2>4. Free trial, pricing and invoicing</h2>'),
    ]


def versiones_negocios():
    """Fila nueva de VERSIONES_NEGOCIOS (versión, publicada, se aplica desde)."""
    if not activo():
        return []
    return [(version(), ENCARGOS_DESDE, aplica(ENCARGOS_DESDE))]


def aplicar(ES, EN, E):
    """Cambia los cuerpos de las páginas de build_legal.py (si ENCARGOS_DESDE tiene fecha), después de legal_contacto."""
    if not activo():
        return
    for slug, f in (('privacidad', _privacidad), ('terminos', _terminos), ('negocios', _negocios)):
        _aplica_lista(ES, slug, 'es', f('es', E))
        _aplica_lista(EN, slug, 'en', f('en', E))


# ════════════════════════════════════════════════════════════════════════════
# HISTORIAL DE CAMBIOS: (slug, fecha, ES, EN)
# ════════════════════════════════════════════════════════════════════════════
def cambios():
    if not activo():
        return []
    f = fechas(ENCARGOS_DESDE)
    desde = fechas(aplica(ENCARGOS_DESDE))
    return [
        ('privacidad', f,
         'Encargos: fila nueva con lo que guardamos cuando encargas algo a un negocio, lo que ve el negocio (tu nombre, '
         'lo encargado y tu nota y, para avisarte de ese encargo, tu correo y el teléfono que des), que la nota y el '
         'teléfono se borran 7 días después de la recogida y que en la nota no hay que poner datos de salud.',
         "Pre-orders: new row with what we keep when you pre-order something from a business, what the business sees "
         '(your name, what you ordered and your note and, to let you know about that pre-order, your email and the phone '
         "number you give), that the note and the phone number are deleted 7 days after pick-up and that the note "
         "shouldn't include health details."),
        ('terminos', f,
         'Encargos (apartado 3 octies nuevo): el encargo es con el negocio, Klendar no cobra ni responde del pedido, el '
         'precio es orientativo y se paga al recoger, los alérgenos se ven antes de encargar y se puede anular hasta el '
         'plazo del negocio. Informa de una función nueva y no recorta tus derechos, así que no hace falta volver a '
         'aceptarlos.',
         "Pre-orders (new section 3g): the pre-order is with the business, Klendar doesn't take payment and isn't "
         'responsible for the order, the price is a guide and you pay when you collect, you see the allergens before '
         "ordering and you can cancel up to the business's deadline. It tells you about a new feature and doesn't limit "
         "your rights, so there's no need to accept the terms again."),
        ('negocios', f,
         'Apartado 3 terdecies nuevo, «Encargos»: el encargo es un acuerdo directo entre el Negocio y el cliente; Klendar '
         'solo lo transmite, no cobra ni es parte del contrato; el precio es orientativo; la normativa de alimentos, con '
         f'los 14 alérgenos marcados en comida, la de consumo y la del alcohol; el contacto del cliente, solo para ese '
         f'encargo. Se aplica desde el {desde["es"]}, 15 días después de publicarlo y avisar.',
         "New section 3l, “Pre-orders”: a pre-order is an agreement directly between the Business and the customer; "
         "Klendar only passes it on, doesn't take payment and isn't a party to the contract; the price is a guide; food "
         'law, with the 14 allergens marked on food, consumer law and the rules on alcohol; the customer\'s contact '
         f'details, only for that pre-order. It applies from {desde["en"]}, 15 days after publishing it and notifying '
         'you.'),
    ]
