# Genera las páginas legales en ES (versión que prevalece) y su traducción
# informativa en EN bajo /en/.
# Ejecutar (desde la raíz de klendar-web):
#   python build_legal.py                → páginas publicadas, con los datos de TITULAR_DATOS
#   python build_legal.py --vista-previa → tools/legal_preview/index.html: todas las páginas
#       con una SL de EJEMPLO (datos falsos) para revisarlas con la gestoría. No se
#       publica: functions/_middleware.js da 404 a todo /tools/.
# Qué hacer el día que la SL pase a ser la titular: docs/LEGAL_SL.md (repo de la app).
import html, io, os, re, sys
from types import SimpleNamespace

from build_site import head, footer, T, ALT

# ════════════════════════════════════════════════════════════════════════════
# DATOS DEL TITULAR — el único sitio que se toca cuando cambia quién está
# detrás de Klendar. De aquí salen: el aviso legal (LSSI-CE art. 10), el
# responsable del tratamiento (privacidad), el titular en los términos de uso,
# la parte que contrata en las condiciones para negocios, el fuero y los
# correos de contacto de todas las páginas legales, en ES y en EN.
#
#  · tipo 'persona' (hoy): persona física. Lo que falte (NIF, domicilio) sale
#    marcado en amarillo con el aviso «Pendiente de completar», como siempre.
#  · tipo 'empresa' (la SL): si falta un dato obligatorio NO se genera nada y
#    el script dice qué falta. Tampoco deja publicar los datos de EJEMPLO.
# ════════════════════════════════════════════════════════════════════════════
TITULAR_DATOS = {
    'tipo': 'persona',                  # 'persona' | 'empresa'

    # persona: nombre y apellidos. empresa: denominación EXACTA de la escritura,
    # con su forma social (LSC art. 6: «S.L.», «Sociedad Limitada»…). Si Iván es
    # el único socio es unipersonal y tiene que constar (LSC art. 13): «S.L.U.».
    'razon_social': 'Iván Hijano Pérez',
    'nombre_comercial': 'Klendar',      # sale junto a la razón social (solo 'empresa')

    'nif': '',                          # empresa: NIF de la sociedad (B + 7 cifras + control)
    'domicilio': '',                    # empresa: domicilio social completo (calle, n.º, CP, municipio, provincia)
    'municipio': '',                    # municipio de ese domicilio: fuero de las condiciones para negocios

    'registro': {                       # solo 'empresa' (LSSI-CE art. 10.1.b). Salen de la nota
        'registro': '',                 #   de inscripción de la escritura: «Registro Mercantil de Madrid»
        'tomo': '',
        'folio': '',
        'seccion': '',                  #   opcional: solo si la inscripción la lleva (p. ej. Madrid: «8»)
        'hoja': '',                     #   «M-000000»
        'inscripcion': '',              #   número: «1» → «inscripción 1.ª»
    },

    'email': 'info@klendar.app',        # contacto general: aviso legal, soporte, bajas, recursos, punto de contacto DSA
    'email_privacidad': 'info@klendar.app',  # derechos RGPD y eliminar la cuenta por correo
    'telefono': '',                     # opcional: la LSSI pide un medio de contacto directo y efectivo,
                                        # y el correo lo es si se contesta (STJUE C-298/07)

    # Delegado de Protección de Datos (DPD). None = no hay, y no se menciona.
    # No es obligatorio para una SL pequeña: el art. 37 RGPD lo exige solo si la
    # actividad principal es observar de forma habitual y sistemática a personas
    # a gran escala o tratar a gran escala categorías especiales de datos, y el
    # art. 34 LOPDGDD añade una lista cerrada (entre otros, prestadores de la
    # sociedad de la información que elaboren perfiles a gran escala, y quien
    # haga publicidad o prospección comercial basada en preferencias o perfiles).
    # Klendar no trata categorías especiales, no perfila ni hace publicidad
    # segmentada y usa la ubicación solo para ordenar por cercanía (última
    # posición, se descarta a los 7 días). Pero los avisos de ofertas por
    # favoritos y cercanía rozan el art. 34.1.j: que lo confirme el abogado
    # (docs/LEGAL_SL.md) y revisarlo si Klendar crece mucho o llegan
    # recomendaciones personalizadas. Si se nombra, se comunica a la AEPD en 10
    # días (art. 34.3 LOPDGDD) y aquí: {'nombre': '…', 'email': 'dpd@klendar.app'}.
    'dpd': None,
}

# ════════════════════════════════════════════════════════════════════════════
# DÓNDE ESTÁN LOS SERVIDORES de la base de datos (Supabase). Sale en la
# política de privacidad (ES y EN).
#
#  · 'londres' (hoy): la web y todo lo que se usa en vivo van contra el
#    proyecto de DESARROLLO, que está en Londres (Reino Unido, AWS eu-west-2).
#    No es la UE, pero el Reino Unido tiene decisión de adecuación de la
#    Comisión Europea (art. 45 RGPD; renovada el 19-12-2025, vale hasta el
#    27-12-2031): los datos pueden ir allí sin más garantías.
#  · 'irlanda': el proyecto de PRODUCCIÓN, en Irlanda (UE, AWS eu-west-1).
#
# El día que la web y la app pasen a producción: poner 'irlanda', subir DATE
# (y VERSION si se quiere volver a pedir la aceptación) y regenerar con
# `python build_legal.py`. Está en docs/RUNBOOK.md (§0b) y docs/LEGAL_SL.md.
# ════════════════════════════════════════════════════════════════════════════
SERVIDORES = 'londres'                  # 'londres' | 'irlanda'

UBICACION_SERVIDORES = {
    'londres': {
        'es': 'servidores en Londres (Reino Unido), país con decisión de adecuación de la Comisión Europea (art. 45 RGPD), por lo que tus datos pueden guardarse allí sin garantías adicionales',
        'en': 'servers in London (United Kingdom), a country covered by a European Commission adequacy decision (art. 45 GDPR), so your data can be stored there without additional safeguards',
    },
    'irlanda': {
        'es': 'servidores en Irlanda (Unión Europea)',
        'en': 'servers in Ireland (European Union)',
    },
}

# Fecha y versión que salen en la cabecera de cada texto. VERSION es la
# versión de los términos y la privacidad: tiene que ser la misma que
# `app_config.terms` en la base (la que usan la app y la web para volver a
# pedir la aceptación a quien aceptó una anterior). Si se sube: una migración
# que actualice esa fila (ver 20261013130000_terminos_vigentes.sql) y
# regenerar. Formato AAAA-MM-DD (se compara como texto). Ver docs/LEGAL_SL.md.
DATE = {'es': '29 de septiembre de 2026', 'en': '29 September 2026'}
VERSION = '2026-09-29'

# Documentos que han cambiado DESPUÉS de VERSION sin que haga falta volver a
# pedir la aceptación (cambios informativos: la privacidad y las normas
# informan, no obligan a nada nuevo). Cada uno lleva su propia fecha de
# «Última actualización»; la versión sigue siendo VERSION. Si un cambio sí
# tiene que volver a pedirse, se sube VERSION (y `app_config.terms`) y se
# vacía esta tabla. Clave: slug ES del documento.
ACTUALIZADO = {
    # 2026-10-01: denuncias sin cuenta, moderación automática, bloquear;
    # correcciones de la revisión legal (docs/AUDITORIA_LEGAL.md, «Revisión
    # 2026-10-01»).
    # 2026-10-02: edad para negocios y equipos, revisión tras cambiar de
    # nombre o de dirección, qué pasa con las reservas al retirar contenido o
    # suspender una cuenta (decisiones A–D). Informativo o a favor de quien
    # acepta, y la edad se comprueba al dar de alta, al entrar en un equipo y
    # al recibir un traspaso: sin re-aceptación.
    # 2026-10-05: dato al día (reseñas con hasta 6 fotos o vídeos, que se
    # denuncian una a una y se borran con la cuenta). Sin cambio de contenido.
    'normas': {'es': '5 de octubre de 2026', 'en': '5 October 2026'},
    # 2026-10-02 (decisiones E–G): cuentas inactivas (aviso a los 24 meses,
    # borrado a los 36), reclamar un negocio y duplicados, reseñas de
    # «Cliente verificado». Informativo: sin re-aceptación.
    'privacidad': {'es': '2 de octubre de 2026', 'en': '2 October 2026'},
    'cookies': {'es': '1 de octubre de 2026', 'en': '1 October 2026'},
    'eliminar-cuenta': {'es': '5 de octubre de 2026', 'en': '5 October 2026'},
    'soporte': {'es': '1 de octubre de 2026', 'en': '1 October 2026'},
    # 2026-10-01 (segunda tanda, R4 de la revisión legal): los términos
    # explican la moderación automática y las condiciones para negocios se
    # ponen al día. Informativo o a favor de quien acepta: sin re-aceptación
    # (criterio en docs/AUDITORIA_LEGAL.md, «Revisión 2026-10-01», R6).
    'terminos': {'es': '1 de octubre de 2026', 'en': '1 October 2026'},
    'negocios': {'es': '2 de octubre de 2026', 'en': '2 October 2026'},
}


def fecha(slug, lang):
    """Fecha de «Última actualización» de un documento (slug ES)."""
    return ACTUALIZADO.get(slug, DATE)[lang]


# Historial de cambios que sale al pie de cada documento legal, del más
# reciente al más antiguo. Al cambiar un documento: su fecha en ACTUALIZADO
# (o DATE/VERSION si hay que volver a pedir la aceptación) y una línea aquí.
_INICIO = ('29 de septiembre de 2026', 'Versión vigente de los términos (2026-09-29).',
           '29 September 2026', 'Current version of the terms (2026-09-29).')
CAMBIOS = {
    'aviso-legal': [_INICIO],
    'privacidad': [
        ('2 de octubre de 2026',
         'Fotos y vídeos en las reseñas: qué se publica, qué datos quitamos, denuncias y cuánto se conservan.',
         '2 October 2026',
         'Photos and videos in reviews: what is published, what data we remove, reports and how long they are kept.'),
        ('2 de octubre de 2026',
         'Planes de tus amigos: qué ven tus amigos de tus próximos planes, el aviso opcional y «Habéis ido juntos a N planes».',
         '2 October 2026',
         'Your friends\' plans: what your friends see of your upcoming plans, the optional notification and “You\'ve been to N plans together”.'),
        ('2 de octubre de 2026',
         'Correos que no llegan y cambio del correo de la cuenta; qué guardamos al traspasar, cancelar o eliminar un negocio.',
         '2 October 2026',
         'Emails that bounce and changing your account email; what we keep when a business is handed over, cancelled or deleted.'),
        ('2 de octubre de 2026',
         'Cuentas que no se usan: aviso por correo a los 24 meses y eliminación a los 36, con un recordatorio 30 días antes; tratamiento nuevo «Reclamar un negocio» (datos, prueba y plazos); la etiqueta «Cliente verificado» en las reseñas.',
         '2 October 2026',
         'Accounts that are not used: email warning at 24 months and deletion at 36, with a reminder 30 days before; new processing “Claiming a business” (data, evidence and retention periods); the “Verified customer” label on reviews.'),
        ('1 de octubre de 2026',
         'Denuncias sin cuenta; las estadísticas de uso de la app, con consentimiento y aparte de los informes de errores; tratamientos de avisos «Avísame si…», resúmenes por correo, mensajes de tus favoritos, sugerencias, seguridad e historial de consentimientos; encargados, transferencias y plazos al día; los iconos y las librerías de la web, desde klendar.app.',
         '1 October 2026',
         'Reports without an account; app usage statistics, based on consent and separate from crash reports; processing for “Tell me when…” alerts, email summaries, messages from your favourites, suggestions, security and consent history; processors, transfers and retention periods brought up to date; icons and libraries for the website, served from klendar.app.'),
        _INICIO],
    'terminos': [
        ('1 de octubre de 2026',
         'Se explica la moderación automática de los textos (apartado 4). No cambian tus derechos ni tus obligaciones, así que no hace falta volver a aceptarlos.',
         '1 October 2026',
         'Automatic moderation of text is explained (section 4). Your rights and obligations don\'t change, so there\'s no need to accept them again.'),
        _INICIO],
    'negocios': [
        ('2 de octubre de 2026',
         'Cancelar la suscripción desde el panel, cerrar hasta nuevo aviso, traspasar y eliminar el Negocio, y qué pasa con las reservas, los datos y lo ya pagado (apartado 5).',
         '2 October 2026',
         'Cancelling the subscription from the dashboard, closing until further notice, handing over and deleting the Business, and what happens to bookings, data and amounts already paid (section 5).'),
        ('2 de octubre de 2026',
         'Reclamar un negocio cuya ficha creó otra persona («¿Es tu negocio?») y fichas duplicadas (apartado 1).',
         '2 October 2026',
         'Claiming a business whose page someone else created (“Is this your business?”) and duplicate pages (section 1).'),
        ('2 de octubre de 2026',
         'Edad: 18 años para dar de alta un negocio y ser su propietario, 16 para estar en su equipo y 18 en un negocio +18 (apartado 1); revisión de la ficha tras un cambio notable de nombre, de ciudad o de dirección, sin dejar de publicarla (apartado 1); qué pasa con las reservas, los códigos, los premios y los regalos al retirar una publicación, desactivar la ficha o suspender la cuenta del propietario (apartado 6).',
         '2 October 2026',
         'Age: 18 to register a business and to own it, 16 to be on its team and 18 in an 18+ business (section 1); review of the business page after a significant change of name, city or address, while it stays published (section 1); what happens to bookings, codes, rewards and gifts when a publication is taken down, the business page is deactivated or the owner\'s account is suspended (section 6).'),
        ('1 de octubre de 2026',
         'Servicio al día (apartado 2); honrar los premios de sellos y el regalo de cumpleaños, precio final con IVA y precio anterior de 30 días en las rebajas (apartado 3); moderación automática y 6 meses para pedir la revisión (apartado 6).',
         '1 October 2026',
         'Service description brought up to date (section 2); honouring stamp rewards and the birthday gift, final price including VAT and the 30-day previous price in reductions (section 3); automatic moderation and 6 months to ask for a review (section 6).'),
        _INICIO],
    'cookies': [
        ('1 de octubre de 2026', 'Inventario al día de lo que se guarda en el navegador (también la sesión aparte de la administración y la comprobación PKCE al entrar con Google o Apple) y de los servicios de terceros; los iconos y las librerías ya se sirven desde klendar.app, sin Google Fonts ni jsDelivr.',
         '1 October 2026', 'Up-to-date list of what is stored in your browser (including the separate admin session and the PKCE check when logging in with Google or Apple) and of third-party services; icons and libraries are now served from klendar.app, without Google Fonts or jsDelivr.'),
        _INICIO],
    'normas': [
        ('5 de octubre de 2026',
         'Dato al día: las reseñas llevan hasta 6 fotos o vídeos, y cada foto o vídeo se puede denunciar por separado.',
         '5 October 2026',
         'Brought up to date: reviews can have up to 6 photos or videos, and each photo or video can be reported separately.'),
        ('2 de octubre de 2026',
         'Cómo funcionan las reseñas y qué significa «Cliente verificado».',
         '2 October 2026',
         'How reviews work and what “Verified customer” means.'),
        ('2 de octubre de 2026',
         'Edad para dar de alta un negocio y para estar en su equipo; al retirar una publicación o un negocio se anulan las reservas y los códigos afectados y se avisa a cada persona sin mencionar la denuncia; qué pasa con un negocio cuando se suspende la cuenta de su propietario.',
         '2 October 2026',
         'Age to register a business and to be on its team; when a publication or a business is taken down, the bookings and codes affected are cancelled and each person is told, without mentioning the report; what happens to a business when its owner\'s account is suspended.'),
        ('1 de octubre de 2026',
         'Denunciar sin cuenta, moderación automática, bloquear a alguien, idiomas del punto de contacto y 6 meses para pedir la revisión de una decisión.',
         '1 October 2026',
         'Reporting without an account, automatic moderation, blocking someone, languages of the point of contact and 6 months to ask for a decision to be reviewed.'),
        _INICIO],
    'eliminar-cuenta': [
        ('5 de octubre de 2026', 'Dato al día: las fotos y los vídeos de tus reseñas se eliminan con ellas.',
         '5 October 2026', 'Brought up to date: the photos and videos in your reviews are deleted with them.'),
        ('2 de octubre de 2026', 'Si eres propietario/a de un negocio, primero hay que darlo de baja o traspasarlo.',
         '2 October 2026', 'If you own a business, you first have to close it or hand it over.'),
        ('1 de octubre de 2026', 'Eliminar también desde la web, confirmar que eres tú y lista al día de lo que se borra.',
         '1 October 2026', 'Deleting from the website too, confirming it\'s you and an up-to-date list of what is deleted.'),
        _INICIO],
}
CAMBIOS_TITULO = {'es': 'Historial de cambios', 'en': 'Change history'}


def historial(slug, lang):
    filas = CAMBIOS.get(slug)
    if not filas:
        return ''
    i = 0 if lang == 'es' else 2
    items = ''.join(f'\n  <li><strong>{f[i]}</strong>: {html.escape(f[i + 1], quote=False)}</li>' for f in filas)
    return f'\n<h2 class="cambios">{CAMBIOS_TITULO[lang]}</h2>\n<ul>{items}\n</ul>\n'


# ════════════════════════════════════════════════════════════════════════════
# ENTRAR CON EL TELÉFONO (SMS). Mientras `PHONE_AUTH` esté apagado en la app
# (lib/core/config/env.dart), la privacidad no lo cuenta. El día que se
# encienda: poner el proveedor de SMS (también en la lista de encargados),
# ACCESO_TELEFONO = True, una fecha en ACTUALIZADO y regenerar. Si falta el
# proveedor, el script no genera nada.
# ════════════════════════════════════════════════════════════════════════════
ACCESO_TELEFONO = False
PROVEEDOR_SMS = ''                       # p. ej. 'Twilio Inc. (EE. UU.; DPF + CCT)'


def fila_telefono():
    if not ACCESO_TELEFONO:
        return {'es': '', 'en': ''}
    if not PROVEEDOR_SMS.strip():
        sys.exit('build_legal.py: ACCESO_TELEFONO = True pero falta PROVEEDOR_SMS.')
    prov = html.escape(PROVEEDOR_SMS.strip(), quote=False)
    return {
        'es': f'<tr><td>Entrar con tu teléfono</td><td>Número de teléfono y el código que te mandamos por SMS</td><td>Identificarte al entrar sin contraseña; el SMS lo envía {prov}</td><td>Ejecución del contrato</td><td>El número, mientras exista la cuenta; el código caduca a la hora</td></tr>\n',
        'en': f'<tr><td>Log in with your phone</td><td>Phone number and the code we text you</td><td>Identify you when you log in without a password; the text message is sent by {prov}</td><td>Performance of a contract</td><td>The number, while the account exists; the code expires after an hour</td></tr>\n',
    }

# Datos de EJEMPLO para la vista previa (--vista-previa). Claramente falsos:
# el script se niega a publicar nada que los contenga.
EJEMPLO_SL = dict(TITULAR_DATOS,
    tipo='empresa',
    razon_social='EJEMPLO APPS S.L.',
    nif='B00000000',
    domicilio='Calle de Ejemplo 0, 00000 Ciudad Ejemplo (Provincia Ejemplo)',
    municipio='Ciudad Ejemplo',
    registro={'registro': 'Registro Mercantil de Ejemplo', 'tomo': '0000', 'folio': '00',
              'seccion': '', 'hoja': 'EJ-000000', 'inscripcion': '1'},
    telefono='',
    dpd=None,
)
MARCAS_EJEMPLO = ('EJEMPLO', 'Ejemplo', 'B00000000', 'EJ-000000')

TODO = {
  'es': '''<p class="todo"><strong>Pendiente de completar antes del lanzamiento:</strong> los datos marcados en amarillo (NIF, domicilio) dependen de la forma jurídica que se elija. Este texto es un borrador profesional; conviene que lo revise un abogado antes de publicar la app.</p>''',
  'en': '''<p class="todo"><strong>To be completed before launch:</strong> the details highlighted in yellow (tax ID, address) depend on the legal form chosen. This text is a professional draft and should be reviewed by a lawyer before the app is published.</p>''',
}

COURTESY = '''<p class="notice">This is a courtesy translation provided for information only. In case of any discrepancy, the <a href="{es}">Spanish version</a> prevails.</p>'''

# Huecos de la persona física mientras no estén (salen en amarillo).
PENDIENTE = {
    'razon_social': {'es': '<mark class="tbd">[Titular]</mark>', 'en': '<mark class="tbd">[Owner]</mark>'},
    'nif': {'es': '<mark class="tbd">[NIF/CIF]</mark>', 'en': '<mark class="tbd">[Spanish tax ID (NIF/CIF)]</mark>'},
    'domicilio': {'es': '<mark class="tbd">[Domicilio completo, España]</mark>', 'en': '<mark class="tbd">[Full address, Spain]</mark>'},
}
META = {'es': 'Última actualización: {date} · Versión {v}', 'en': 'Last updated: {date} · Version {v}'}


# ── Comprobación de los datos ───────────────────────────────────────────────
FORMA_SOCIAL = re.compile(r'(\bS\.?\s?L\.?(\s?U\.?|\s?N\.?\s?E\.?)?|\bS\.?\s?R\.?\s?L\.?|Sociedad\s+(de\s+Responsabilidad\s+)?Limitada(\s+Unipersonal)?)\s*$', re.I)
EMAIL = re.compile(r'^[^@\s"<>]+@[^@\s"<>]+\.[a-z]{2,}$', re.I)


def nif_sociedad_valido(nif):
    """NIF de persona jurídica (antiguo CIF): letra + 7 cifras + control."""
    m = re.fullmatch(r'([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])', nif)
    if not m:
        return False
    letra, cifras, control = m.groups()
    suma = 0
    for i, c in enumerate(cifras):
        n = int(c)
        if i % 2 == 0:              # posiciones impares (1.ª, 3.ª…): se doblan
            n = n * 2
            n = n // 10 + n % 10
        suma += n
    d = (10 - suma % 10) % 10
    if letra in 'ABEH':
        return control == str(d)
    if letra in 'KPQSNW':
        return control == 'JABCDEFGHI'[d]
    return control in (str(d), 'JABCDEFGHI'[d])


def limpio(x):
    return str(x or '').strip()


def comprobar(D, publicar=True):
    """Devuelve los problemas que impiden generar (lista vacía = todo bien)."""
    p = []
    tipo = D.get('tipo')
    if tipo not in ('persona', 'empresa'):
        return [f"'tipo' tiene que ser 'persona' o 'empresa' (está puesto {tipo!r})"]
    for campo, que in (('email', 'correo de contacto'), ('email_privacidad', 'correo de privacidad')):
        if not EMAIL.match(limpio(D.get(campo))):
            p.append(f"{que} ('{campo}') vacío o no válido")
    if limpio(D.get('telefono')) and not re.fullmatch(r'\+?[\d ]{9,16}', limpio(D['telefono'])):
        p.append("el teléfono ('telefono') solo puede llevar cifras, espacios y un + delante")
    dpd = D.get('dpd')
    if dpd is not None and not (limpio(dpd.get('nombre')) and EMAIL.match(limpio(dpd.get('email')))):
        p.append("'dpd' tiene que ser None o {'nombre': ..., 'email': ...} con los dos rellenos")
    if tipo == 'empresa':
        r = D.get('registro') or {}
        for valor, que in (
            (D.get('razon_social'), "razón social de la SL, tal cual en la escritura ('razon_social')"),
            (D.get('nombre_comercial'), "nombre comercial ('nombre_comercial')"),
            (D.get('nif'), "NIF de la sociedad ('nif')"),
            (D.get('domicilio'), "domicilio social completo ('domicilio')"),
            (D.get('municipio'), "municipio del domicilio social, para el fuero ('municipio')"),
            (r.get('registro'), "Registro Mercantil donde está inscrita ('registro' → 'registro')"),
            (r.get('tomo'), "tomo de la inscripción ('registro' → 'tomo')"),
            (r.get('folio'), "folio de la inscripción ('registro' → 'folio')"),
            (r.get('hoja'), "hoja registral ('registro' → 'hoja')"),
            (r.get('inscripcion'), "número de inscripción ('registro' → 'inscripcion')"),
        ):
            if not limpio(valor):
                p.append(f'falta: {que}')
        razon = limpio(D.get('razon_social'))
        if razon and 'Hijano' in razon:
            p.append("la razón social sigue siendo la de la persona física: pon la de la SL")
        elif razon and not FORMA_SOCIAL.search(razon):
            p.append(f"la razón social {razon!r} no acaba en la forma social (LSC art. 6: «S.L.», «S.L.U.», «Sociedad Limitada»…)")
        nif = limpio(D.get('nif')).upper().replace('-', '').replace(' ', '')
        if nif and not nif_sociedad_valido(nif):
            p.append(f"el NIF {D.get('nif')!r} no es un NIF de sociedad válido (letra + 7 cifras + control; el de una SL empieza por B)")
        if limpio(r.get('inscripcion')) and not re.search(r'\d', limpio(r.get('inscripcion'))):
            p.append("'inscripcion' tiene que ser un número («1» para la 1.ª)")
    if publicar:
        texto = repr(D)
        if any(m in texto for m in MARCAS_EJEMPLO):
            p.append('hay datos de EJEMPLO en TITULAR_DATOS: son solo para la vista previa')
    return p


# ── Datos listos para los textos, por idioma ────────────────────────────────
def por_idioma(D, lang, resaltar=False):
    """Trozos de texto que dependen del titular. `resaltar` (vista previa)
    envuelve los datos en <span class="dato"> para verlos de un vistazo."""
    empresa = D['tipo'] == 'empresa'
    en = lang == 'en'

    def dato(campo, valor=None):
        v = limpio(D.get(campo) if valor is None else valor)
        if not v:
            return PENDIENTE[campo][lang] if campo in PENDIENTE else ''
        v = html.escape(v, quote=False)
        return f'<span class="dato">{v}</span>' if resaltar else v

    E, EP = limpio(D['email']), limpio(D['email_privacidad'])
    razon, nif, dom = dato('razon_social'), dato('nif', limpio(D.get('nif')).upper()), dato('domicilio')
    nc = dato('nombre_comercial')
    tel = dato('telefono')
    r = D.get('registro') or {}
    reg = ''
    if empresa:
        n = re.sub(r'\D', '', limpio(r.get('inscripcion')))
        sec = limpio(r.get('seccion'))
        reg_txt = (f"{limpio(r['registro'])} (Commercial Registry), volume {limpio(r['tomo'])}, folio {limpio(r['folio'])}"
                   + (f', section {sec}' if sec else '') + f", sheet {limpio(r['hoja'])}, entry {n}") if en else \
                  (f"{limpio(r['registro'])}, tomo {limpio(r['tomo'])}, folio {limpio(r['folio'])}"
                   + (f', sección {sec}' if sec else '') + f", hoja {limpio(r['hoja'])}, inscripción {n}.ª")
        reg = dato('registro', reg_txt)
    # Fuero de las condiciones para negocios: el municipio; mientras sea una
    # persona física sin municipio, el domicilio (o su hueco en amarillo).
    fuero = dato('municipio') or dom

    li = lambda s: f'  <li>{s}</li>'
    mail = lambda m: f'<a href="mailto:{m}">{m}</a>'
    dpd = D.get('dpd')

    if not en:
        aviso = [li(f'Titular: {razon} (nombre comercial: {nc})' if empresa else f'Titular: {razon}'),
                 li(f'NIF/CIF: {nif}'),
                 li(f'Domicilio social: {dom}' if empresa else f'Domicilio: {dom}')]
        if empresa:
            aviso.append(li(f'Datos registrales: inscrita en el {reg}'))
        aviso.append(li(f'Correo electrónico: {mail(E)}'))
        if tel:
            aviso.append(li(f'Teléfono: {tel}'))
        resp = [li(f'Responsable: {razon} ({nc})' if empresa else f'Responsable: {razon}')]
        if empresa:
            resp += [li(f'NIF/CIF: {nif}'), li(f'Domicilio social: {dom}')]
        resp.append(li(f'Contacto para protección de datos: {mail(EP)}'))
        if dpd:
            resp.append(li(f"Delegado de Protección de Datos: {html.escape(limpio(dpd['nombre']), quote=False)}, {mail(limpio(dpd['email']))}"))
        titular_frase = (f'{razon} (NIF/CIF {nif}; el resto de sus datos están en el <a href="/aviso-legal/">aviso legal</a>)'
                         if empresa else razon)
        parte = (f'{razon}, con NIF/CIF {nif}, domicilio social en {dom} e inscrita en el {reg}'
                 if empresa else razon)
    else:
        aviso = [li(f'Owner: {razon}, a Spanish private limited company (sociedad limitada) trading as {nc}' if empresa else f'Owner: {razon}'),
                 li(f'Tax ID: {nif}'),
                 li(f'Registered office: {dom}' if empresa else f'Address: {dom}')]
        if empresa:
            aviso.append(li(f'Registration: registered in the {reg}'))
        aviso.append(li(f'Email: {mail(E)}'))
        if tel:
            aviso.append(li(f'Phone: {tel}'))
        resp = [li(f'Controller: {razon} ({nc})' if empresa else f'Controller: {razon}')]
        if empresa:
            resp += [li(f'Tax ID: {nif}'), li(f'Registered office: {dom}')]
        resp.append(li(f'Data protection contact: {mail(EP)}'))
        if dpd:
            resp.append(li(f"Data Protection Officer: {html.escape(limpio(dpd['nombre']), quote=False)}, {mail(limpio(dpd['email']))}"))
        titular_frase = (f'{razon} (tax ID {nif}; full details in the <a href="/en/legal-notice/">legal notice</a>)'
                         if empresa else razon)
        parte = (f'{razon}, a Spanish private limited company with tax ID {nif}, registered office at {dom}, registered in the {reg}'
                 if empresa else razon)

    return SimpleNamespace(aviso='\n'.join(aviso), responsable='\n'.join(resp),
                           titular_frase=titular_frase, parte=parte, fuero=fuero)


# ── Textos ──────────────────────────────────────────────────────────────────
def textos(D, resaltar=False):
    """ES: slug ES → (título, descripción, cuerpo).
    EN: slug ES → (slug EN, título, descripción, cuerpo)."""
    es, en = por_idioma(D, 'es', resaltar), por_idioma(D, 'en', resaltar)
    E, EP = limpio(D['email']), limpio(D['email_privacidad'])
    SRV = UBICACION_SERVIDORES[SERVIDORES]
    TEL = fila_telefono()
    ES, EN = {}, {}

    # ── Aviso legal ─────────────────────────────────────────────────────────────
    ES['aviso-legal'] = ('Aviso legal', 'Identificación del titular de klendar.app y de la app Klendar (LSSI-CE).', f'''
<h2>1. Identificación del titular</h2>
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de que el sitio web <strong>klendar.app</strong> y la aplicación móvil <strong>Klendar</strong> (en adelante, "la Plataforma") son titularidad de:</p>
<ul>
{es.aviso}
</ul>
<h2>2. Objeto</h2>
<p>Klendar es una plataforma que permite a negocios locales publicar ofertas de duración limitada ("ofertas flash") y eventos, y a las personas usuarias descubrirlos por cercanía, guardarlos, valorarlos y canjearlos mediante un código QR. Klendar actúa como intermediario técnico: las ofertas y eventos son publicados y honrados por cada negocio bajo su exclusiva responsabilidad.</p>
<h2>3. Condiciones de uso</h2>
<p>El acceso y uso de la Plataforma se rige por los <a href="/terminos/">Términos de uso</a> y, para los negocios, por las <a href="/negocios/">Condiciones para negocios</a>. El tratamiento de datos personales se describe en la <a href="/privacidad/">Política de privacidad</a>.</p>
<h2>4. Propiedad intelectual e industrial</h2>
<p>La marca Klendar, el logotipo, el diseño de la Plataforma y su código son titularidad del titular o de sus licenciantes. Los contenidos publicados por los negocios (textos, imágenes, cartas) son responsabilidad y propiedad de quien los publica, que concede a Klendar una licencia no exclusiva para mostrarlos en la Plataforma.</p>
<h2>5. Exclusión de responsabilidad</h2>
<p>El titular no garantiza la disponibilidad ininterrumpida de la Plataforma ni responde de la veracidad, vigencia o cumplimiento de las ofertas publicadas por los negocios, sin perjuicio de los mecanismos de denuncia y moderación descritos en las <a href="/normas/">Normas de la comunidad</a>.</p>
<h2>6. Legislación aplicable</h2>
<p>Estas condiciones se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales del domicilio de la persona consumidora, cuando así lo establezca la normativa de consumo, o en su defecto a los del domicilio del titular.</p>
''')

    EN['aviso-legal'] = ('legal-notice', 'Legal notice', 'Who owns klendar.app and the Klendar app (Spanish LSSI-CE).', f'''
<h2>1. Owner</h2>
<p>In accordance with article 10 of Spanish Law 34/2002 of 11 July on Information Society Services and Electronic Commerce (LSSI-CE), the website <strong>klendar.app</strong> and the mobile app <strong>Klendar</strong> (together, "the Platform") are owned by:</p>
<ul>
{en.aviso}
</ul>
<h2>2. Purpose</h2>
<p>Klendar is a platform that lets local businesses publish time-limited deals ("flash deals") and events, and lets users discover them by proximity, save them, review them and redeem them with a QR code. Klendar acts as a technical intermediary: deals and events are published and honoured by each business under its sole responsibility.</p>
<h2>3. Terms of use</h2>
<p>Access to and use of the Platform are governed by the <a href="/en/terms/">Terms of use</a> and, for businesses, by the <a href="/en/business-terms/">Business terms</a>. How we process personal data is described in the <a href="/en/privacy/">Privacy policy</a>.</p>
<h2>4. Intellectual and industrial property</h2>
<p>The Klendar brand, logo, the design of the Platform and its code belong to the owner or its licensors. Content published by businesses (text, images, menus) is the responsibility and property of whoever publishes it, who grants Klendar a non-exclusive licence to display it on the Platform.</p>
<h2>5. Disclaimer</h2>
<p>The owner does not guarantee uninterrupted availability of the Platform and is not liable for the accuracy, validity or fulfilment of deals published by businesses, without prejudice to the reporting and moderation mechanisms described in the <a href="/en/community-guidelines/">Community guidelines</a>.</p>
<h2>6. Governing law</h2>
<p>These terms are governed by Spanish law. For any dispute, the parties submit to the courts of the consumer's place of residence where consumer law so provides, or otherwise to the courts of the owner's registered address.</p>
''')

    # ── Privacidad ──────────────────────────────────────────────────────────────
    ES['privacidad'] = ('Política de privacidad', 'Cómo trata Klendar tus datos personales (RGPD y LOPDGDD).', f'''
<p>Esta política explica qué datos personales tratamos en la app Klendar y en klendar.app, para qué, con qué base legal, cuánto tiempo los conservamos y qué derechos tienes. Cumple el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).</p>

<h2>1. Responsable del tratamiento</h2>
<ul>
{es.responsable}
</ul>

<h2>2. Qué datos tratamos y para qué</h2>
<table>
<tr><th>Tratamiento</th><th>Datos</th><th>Finalidad</th><th>Base jurídica</th><th>Conservación</th></tr>
<tr><td>Cuenta de usuario</td><td>Email, nombre mostrado, contraseña (cifrada), fecha de nacimiento, idioma, foto de perfil (opcional), fecha y versión de aceptación de los términos</td><td>Crear y gestionar tu cuenta; verificar la edad mínima (14 años) y el acceso a contenidos para mayores de 18; y, si un negocio de tus favoritos ofrece regalo de cumpleaños y no lo apagas en Ajustes → Notificaciones, dártelo el día de tu cumpleaños (el negocio no ve tu fecha: solo recibe el código cuando lo canjeas)</td><td>Ejecución del contrato (art. 6.1.b RGPD); obligación legal para la edad (art. 6.1.c; art. 7 LOPDGDD)</td><td>Mientras la cuenta esté activa. Si no la usas durante 24 meses (no entras ni abres la app o la web), te avisamos por correo de que se eliminará al cumplirse 36 meses y te lo recordamos 30 días antes; basta con entrar para conservarla. Si eres propietario de un negocio, no la eliminamos de forma automática: lo revisamos antes y nos ponemos en contacto contigo. Al eliminarla (tú, o nosotros por inactividad) se borra al momento (si lo pides por correo, en un máximo de 30 días) y las copias de seguridad se sobrescriben en un máximo de 7 días. Se conservan, sin vincularlos a ti, los datos de facturación de los negocios (6 años) y las denuncias resueltas (2 años)</td></tr>
<tr><td>Inicio de sesión con Google / Apple</td><td>Identificador del proveedor, email, nombre</td><td>Autenticación sin contraseña</td><td>Ejecución del contrato</td><td>Igual que la cuenta</td></tr>
<tr><td>Ubicación</td><td>Coordenadas aproximadas o precisas del dispositivo (según el permiso que concedas) o la ciudad que elijas manualmente</td><td>Ordenar el feed y el mapa por cercanía; "ofertas cerca de ti" si activas esa opción; y, de forma agregada y sin identificar a nadie, las cifras de distancia del «Informe» de cada negocio (desde qué distancia llega su clientela)</td><td>Consentimiento (art. 6.1.a), revocable en los ajustes del dispositivo y de la app</td><td>No se guarda un historial. Solo se conserva la última ubicación conocida (para "cerca de ti") y se descarta a los 7 días</td></tr>
<tr><td>Favoritos, reseñas, canjes y sellos</td><td>Negocios guardados, valoraciones y comentarios, códigos de canje y su estado, vistas de ofertas, tarjetas de sellos (sellos, premios y sus códigos)</td><td>Prestar el servicio: tus favoritos, tus reseñas públicas, el historial de canjes, las tarjetas de sellos de los negocios y estadísticas agregadas para los negocios</td><td>Ejecución del contrato</td><td>Mientras exista la cuenta. Las reseñas se muestran con tu nombre mostrado y, si has canjeado algo en ese negocio con Klendar, con la etiqueta «Cliente verificado» (sin decir qué ni cuándo)</td></tr>
<tr><td>Fotos y vídeos en las reseñas</td><td>Las fotos y los vídeos que añades a una reseña (hasta 6), con su orden, tamaño y duración</td><td>Publicarlos junto a tu reseña, en la app y en klendar.app, con tu nombre visible y tu foto de perfil. Antes de subirlos quitamos los datos que llevan dentro: en las fotos, la ubicación, la fecha y el modelo del móvil (EXIF); en los vídeos, la ubicación y el modelo del móvil. Lo que se ve en la imagen o se oye en el vídeo sí se publica, así que no incluyas a otras personas sin su permiso. Una reseña que va a revisión por su texto no se publica, con sus fotos y vídeos, hasta que la revisa una persona de Klendar. Cualquiera puede denunciar una foto o un vídeo; si incumple las Normas de la comunidad lo retiramos y te avisamos del motivo. Más adelante podremos analizar automáticamente las fotos y los vídeos (Google Cloud Vision) para detectar desnudos o violencia antes de publicarlos; te avisaremos antes de activarlo</td><td>Ejecución del contrato (publicar lo que tú decides publicar); obligación legal para las denuncias (Reglamento (UE) 2022/2065)</td><td>Hasta que los quites, borres la reseña o elimines tu cuenta; los ficheros desaparecen de nuestros servidores en unos días. Si alguien los ha denunciado, guardamos una copia como prueba mientras dure la denuncia y el plazo para reclamar</td></tr>
<tr><td>Amigos y planes</td><td>Tu enlace de amigo (y su QR), tus amigos y desde cuándo lo sois, las publicaciones a las que marcas «Voy», las invitaciones que mandas y recibes (y lo que contestas), tus opciones «Que mis amigos vean mis planes» y «Mostrar los planes a los que he ido con cada amigo» y las personas que bloqueas</td><td>Que puedas hacerte amigo de quien tenga tu enlace, ver a qué planes van tus amigos, invitarles y que ellos vean a qué vas tú. Si tienes encendido «Que mis amigos vean mis planes», tus amigos ven a qué publicaciones próximas vas (porque has marcado «Voy», tienes una plaza reservada o un código): en cada publicación, en tu ficha de amigo y, si lo han pedido, en una notificación. Lo que ya ha pasado no aparece en tu ficha, con una sola excepción: en la ficha de cada amigo puede salir «Habéis ido juntos a N planes», el número de publicaciones en las que cada uno de los dos ha validado un canje; solo lo ve ese amigo, no dice cuáles ni cuándo y no se guarda aparte (se calcula en el momento a partir de los canjes que ya conservamos). Sale solo si las dos opciones están encendidas en las dos cuentas; si cualquiera de los dos lo apaga, deja de verse para ambos. Nunca se muestra con personas bloqueadas ni con cuentas suspendidas, y al eliminar tu cuenta tus canjes se anonimizan y dejan de contar. Las personas que bloqueas no pueden ser tus amigas ni invitarte (no se les avisa). No hay buscador de personas: solo te encuentra quien tiene tu enlace o tu QR</td><td>Ejecución del contrato. Que tus amigos vean tus planes y los planes a los que habéis ido juntos se apaga en Ajustes → Privacidad; las invitaciones y los avisos de planes de tus amigos, en Ajustes → Notificaciones</td><td>Mientras exista la cuenta. Si quitas a alguien de tus amigos, deja de ver tus planes al momento (no le avisamos)</td></tr>
<tr><td>Notificaciones push</td><td>Token del dispositivo, preferencias (favoritos, cercanía, mensajes de tus favoritos, invitaciones de amigos, sellos y premios, cumpleaños, horas de silencio)</td><td>Avisarte de novedades y mensajes de tus favoritos (como mucho uno por semana y negocio), ofertas cercanas, invitaciones de tus amigos, los sellos y premios de tus tarjetas y tu regalo de cumpleaños. Cada tipo se apaga por separado en Ajustes → Notificaciones</td><td>Consentimiento, revocable en cualquier momento</td><td>Hasta que revoques el permiso, cierres sesión o elimines la cuenta</td></tr>
<tr><td>Cuenta de negocio</td><td>Datos del negocio (nombre, dirección, NIF/CIF, teléfono, email de contacto, horarios), miembros del equipo (email y rol), plan contratado y pagos</td><td>Dar de alta, verificar y gestionar el negocio; facturar la cuota</td><td>Ejecución del contrato; obligación legal (facturación)</td><td>Durante la relación y después el plazo legal (fiscal: 4 años; mercantil: 6 años). Si se traspasa el negocio, la nueva persona titular accede a sus datos, incluidos los de facturación. Al cancelar la suscripción guardamos la petición y su motivo, si se da. Al eliminar un negocio conservamos 6 años un registro mínimo (nombre del negocio, fecha, quién lo eliminó y cifras sin datos personales)</td></tr>
<tr><td>Reclamar un negocio («¿Es tu negocio?»)</td><td>Tu cuenta, el cargo que dices tener, el teléfono o el correo del negocio que nos das, la prueba que subes (una foto o un documento) o lo que nos cuentas, tu declaración de que es cierto, la fecha y lo que decidimos (y por qué)</td><td>Comprobar que llevas ese negocio y, si es así, darte su propiedad; avisar a quien era su propietario de que ha cambiado; evitar que alguien se haga con un negocio que no es suyo. Solo lo ve el equipo de Klendar, y la prueba se guarda en un almacenamiento privado</td><td>Ejecución del contrato (art. 6.1.b RGPD: lo pides tú) e interés legítimo (art. 6.1.f) en evitar suplantaciones y proteger a los negocios</td><td>La prueba, hasta 6 meses después de resolver la reclamación; la reclamación (quién, cuándo y qué se decidió), 2 años</td></tr>
<tr><td>Denuncias de contenido (también sin cuenta)</td><td>Si denuncias sin cuenta: tu nombre, tu correo (opcionales si se trata de abuso sexual infantil) y tu idioma; si denuncias con tu cuenta, la cuenta. En los dos casos: el motivo, el texto de la denuncia, una copia del contenido denunciado y la fecha. Para frenar abusos en las denuncias sin cuenta, un resumen de la conexión calculado con una clave que cambia cada día; nunca la dirección IP</td><td>Tramitar la denuncia y contestarte: confirmarte que la hemos recibido y decirte qué hemos decidido y por qué. Quien publicó el contenido no sabe quién lo denunció</td><td>Obligación legal (art. 6.1.c RGPD; Reglamento (UE) 2022/2065, art. 16)</td><td>Hasta 2 años desde que se cierra la denuncia. El resumen de la conexión se borra en 24 horas</td></tr>
<tr><td>Informes de errores</td><td>Identificador de instalación, modelo y sistema del dispositivo, versión de la app, informe técnico del fallo (sin tu nombre ni tu correo)</td><td>Detectar y arreglar fallos de la app (Firebase Crashlytics)</td><td>Interés legítimo (art. 6.1.f): que la app funcione</td><td>90 días</td></tr>
<tr><td>Estadísticas de uso de la app (opcional)</td><td>Identificador de instalación, pantallas y acciones (ver una oferta, guardar, canjear, compartir, buscar —sin el texto que buscas—), modelo y sistema del dispositivo</td><td>Saber qué se usa para mejorar la app (Firebase Analytics)</td><td>Consentimiento (art. 6.1.a): casilla sin marcar al crear la cuenta o en Ajustes → Privacidad y datos; se retira igual</td><td>14 meses</td></tr>
<tr><td>Comunicaciones comerciales</td><td>Email</td><td>Enviarte novedades de Klendar (nunca de terceros)</td><td>Consentimiento específico marcado en el registro; revocable en cada email o en el perfil</td><td>Hasta que lo revoques</td></tr>
<tr><td>Avisos «Avísame si…»</td><td>La zona que eliges (punto y radio), categorías, precio máximo</td><td>Avisarte cuando aparece algo que encaja</td><td>Ejecución del contrato</td><td>Hasta que borres el aviso o la cuenta</td></tr>
<tr><td>Resúmenes por correo</td><td>Email, idioma, ciudad, tus favoritos y planes</td><td>Mandarte el resumen semanal con ofertas y planes de negocios (si lo activas en Ajustes → Notificaciones; empieza apagado)</td><td>Consentimiento; baja en un clic en cada correo</td><td>Hasta que lo apagues</td></tr>
<tr><td>Correos que no llegan y cambio de correo</td><td>Tu email, la fecha, el motivo (rebote o marcado como spam) y el detalle técnico que nos da nuestro proveedor de correo (Resend); al cambiar el correo, la dirección anterior y la nueva</td><td>Dejar de mandarte resúmenes y otros correos que no sean imprescindibles mientras tu correo nos devuelva los mensajes (los de acceso a tu cuenta se mandan siempre) y avisarte en la app y en la web; confirmar un cambio de correo con un código a la dirección actual y otro a la nueva. Si lo cambiamos nosotros porque has perdido el acceso a tu correo, el registro de administración guarda la dirección anterior, la nueva y cómo comprobamos tu identidad</td><td>Interés legítimo en no enviar correos que no llegan o que no quieres (art. 6.1.f RGPD); ejecución del contrato para el cambio de correo</td><td>Hasta que cambies de correo, nos digas que ya funciona o elimines tu cuenta; el registro de administración, 2 años</td></tr>
<tr><td>Mensajes de tus favoritos</td><td>Que tienes el negocio en favoritos o sellos en una de sus tarjetas</td><td>Que el negocio te mande un aviso (como mucho uno por semana y local), revisado por Klendar; el negocio no ve quién lo recibe</td><td>Consentimiento (notificaciones); se apaga en Ajustes → Notificaciones</td><td>La bandeja, 90 días</td></tr>
<tr><td>Sugerencias «Quizá te interese»</td><td>Tus últimas búsquedas y las categorías que más miras, guardadas en tu móvil</td><td>Sugerirte algo cuando cerca no hay nada; se envían con esa consulta y no se guardan en nuestros servidores</td><td>Ejecución del contrato</td><td>En tu móvil, hasta que las borres o elimines la cuenta</td></tr>
<tr><td>Seguridad</td><td>Resumen cifrado de tu conexión (cambia cada día, nunca la IP), dispositivos de confianza para entrar con huella o Face ID, códigos para confirmar que eres tú, errores técnicos de la web (sin datos personales)</td><td>Frenar abusos, entrar sin contraseña en tus dispositivos, proteger los cambios de contraseña y la eliminación de la cuenta, detectar fallos</td><td>Interés legítimo (art. 6.1.f)</td><td>Resumen 24 h; dispositivos 90 días sin uso; códigos 1 h; errores 30 días</td></tr>
<tr><td>Historial de consentimientos</td><td>Qué has aceptado o retirado y cuándo</td><td>Poder demostrarlo (art. 7.1 RGPD)</td><td>Obligación legal (art. 6.1.c)</td><td>Mientras exista la cuenta</td></tr>
{TEL['es']}<tr><td>Soporte</td><td>Email y contenido de tu mensaje</td><td>Atender tus consultas</td><td>Ejecución del contrato / interés legítimo</td><td>1 año desde el cierre</td></tr>
</table>
<p>Para crear la cuenta son obligatorios el correo (o tu cuenta de Google o Apple), la fecha de nacimiento y aceptar los términos; sin ellos no se puede usar la cuenta. Todo lo demás es opcional.</p>

<h2>3. Destinatarios y encargados del tratamiento</h2>
<p>No vendemos ni cedemos tus datos. Para prestar el servicio usamos proveedores que actúan como encargados del tratamiento con contratos conforme al art. 28 RGPD:</p>
<ul>
  <li><strong>Supabase</strong> (base de datos, autenticación y almacenamiento; {SRV['es']}).</li>
  <li><strong>Google Firebase</strong> (notificaciones push, informes de errores y, solo si lo aceptas, estadísticas de uso de la app; Google Ireland Ltd.; transferencias internacionales amparadas en el Marco de Privacidad de Datos UE-EE. UU. y cláusulas contractuales tipo).</li>
  <li><strong>Mapbox</strong> (Mapbox, Inc., EE. UU.: mapas y rutas a pie; recibe las coordenadas del área que consultas para pintar el mapa y, si pides la ruta a pie hasta un local, tu posición y la del local, sin tu nombre ni tu correo; transferencia internacional amparada en el Marco de Privacidad de Datos UE-EE. UU., al que Mapbox está adherida, y en cláusulas contractuales tipo).</li>
  <li><strong>Cloudflare</strong> (Cloudflare, Inc.: alojamiento y red de entrega de klendar.app; procesa la dirección IP de las visitas para servir la web y protegerla, cuenta las visitas de forma agregada con Cloudflare Web Analytics, sin cookies ni identificarte, y, cuando está activada, hace la comprobación anti-robots (Turnstile) al entrar y al denunciar sin cuenta; transferencias internacionales amparadas en el Marco de Privacidad de Datos UE-EE. UU. y cláusulas contractuales tipo).</li>
  <li><strong>IONOS</strong> (IONOS SE, Alemania: nuestro buzón de correo; recibe lo que nos escribes).</li>
  <li><strong>Resend</strong> (envío de correos: los de tu cuenta, los avisos, los resúmenes por correo y las respuestas a quien denuncia sin cuenta; recibe tu dirección de correo y el contenido del mensaje; Plus Five Five, Inc., EE. UU.; transferencia internacional amparada en el Marco de Privacidad de Datos UE-EE. UU., al que Resend está adherido, y en las cláusulas contractuales tipo de la Comisión Europea que incluye su contrato de encargo).</li>
</ul>
<p>Si entras con tu cuenta de <strong>Apple</strong> («Continuar con Apple»), Apple (Apple Distribution International Ltd., Irlanda) comprueba tu identidad y nos comunica un identificador, tu nombre y tu correo, o una dirección de reenvío privada de Apple si eliges ocultar el tuyo. Apple trata esos datos como responsable independiente, según su propia política de privacidad; nosotros solo recibimos lo indicado. Lo mismo ocurre con <strong>Google</strong> si entras con tu cuenta de Google (más abajo).</p>
<p>Si añades un canje a <strong>Google Wallet</strong>, Google recibe los datos del pase (oferta, negocio y código) como responsable independiente. Los iconos, las fuentes y las librerías de la web se sirven desde klendar.app: tu navegador no los pide a Google Fonts ni a ningún otro servicio (más detalle en la <a href="/cookies/">política de cookies</a>).</p>
<p>Las <strong>denuncias</strong> solo las ve el equipo de Klendar. No se las damos a quien publicó el contenido denunciado; solo las comunicamos a las autoridades si hay indicios de un delito (art. 18 del Reglamento (UE) 2022/2065) o si nos lo pide un juez o la autoridad competente.</p>
<p>Los <strong>negocios</strong> ven tu nombre mostrado cuando canjeas una oferta o publicas una reseña, y estadísticas agregadas (nunca tu email ni tu ubicación).</p>
<p>Tus <strong>amigos</strong> en Klendar (solo las personas con las que te has hecho amigo con un enlace de amigo) ven tu nombre mostrado y tu foto y, si no lo apagas, a qué planes vas («Voy», una plaza reservada o un código). Nadie más lo ve: ni otras personas ni los negocios, que tampoco saben quién es amigo de quién.</p>

<h2 id="google">Si entras con tu cuenta de Google</h2>
<p>Si eliges «Continuar con Google», Google nos comparte, con tu permiso, solo lo básico de tu cuenta: tu <strong>nombre</strong>, tu <strong>dirección de correo</strong> y tu <strong>foto de perfil</strong> (permisos <em>openid</em>, <em>email</em> y <em>profile</em>). No pedimos acceso a tus contactos, a tu calendario, a Gmail, a Drive ni a ningún otro dato de Google.</p>
<ul>
  <li><strong>Para qué:</strong> solo para crear tu cuenta de Klendar e identificarte al entrar. El nombre y la foto se usan como nombre y foto de tu perfil (puedes cambiarlos cuando quieras) y el correo, para los avisos de tu cuenta.</li>
  <li><strong>Con quién:</strong> con nadie. No vendemos estos datos, no los usamos para publicidad ni para perfiles publicitarios y no se los pasamos a terceros, salvo a Supabase, que guarda las cuentas por nosotros como encargado del tratamiento.</li>
  <li><strong>Cuánto tiempo:</strong> mientras tengas la cuenta. Si la eliminas, se borran con ella.</li>
  <li><strong>Cómo quitar el acceso:</strong> en cualquier momento desde <a href="https://myaccount.google.com/permissions" rel="noopener">myaccount.google.com/permissions</a>. Tu cuenta de Klendar sigue funcionando si le pones una contraseña.</li>
</ul>
<p>El uso que Klendar hace de la información recibida de las API de Google se ajusta a la <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">Política de datos de usuario de los servicios de API de Google</a>, incluidos los requisitos de uso limitado.</p>

<h2>4. Menores</h2>
<p>La edad mínima para usar Klendar es de <strong>14 años</strong>. Los contenidos marcados como "+18" (locales de ocio nocturno, alcohol) solo se muestran a personas que han indicado con su fecha de nacimiento que son mayores de 18 años. Si detectamos una cuenta de un menor de 14 años, la eliminaremos.</p>

<h2>5. Tus derechos</h2>
<p>Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, y retirar el consentimiento en cualquier momento, escribiendo a <a href="mailto:{EP}">{EP}</a> desde el email de tu cuenta. Además, desde la app o desde «Tu cuenta» en la web (Cuenta → Ajustes → Privacidad y datos) puedes: ver qué has consentido y cuándo, retirar por separado el consentimiento de ubicación, notificaciones push, estadísticas de uso y comunicaciones comerciales, dejar de enseñar tus planes a tus amigos, ver y desbloquear a las personas que has bloqueado, descargar todos tus datos en un archivo (acceso y portabilidad), y <a href="/eliminar-cuenta/">eliminar tu cuenta</a> por completo. Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" rel="noopener">www.aepd.es</a>).</p>

<h2>6. Seguridad</h2>
<p>Los datos se transmiten cifrados (TLS), las contraseñas se almacenan con hash, el acceso a la base de datos está restringido por políticas de seguridad a nivel de fila (cada persona solo accede a lo suyo) y los proveedores citados cuentan con certificaciones de seguridad reconocidas.</p>

<h2>7. Cambios</h2>
<p>Si cambiamos esta política de forma relevante te lo comunicaremos en la app. La versión vigente está siempre en <a href="https://klendar.app/privacidad/">klendar.app/privacidad</a>.</p>
''')

    EN['privacidad'] = ('privacy', 'Privacy policy', 'How Klendar handles your personal data (GDPR).', f'''
<p>This policy explains which personal data we process in the Klendar app and on klendar.app, why, on what legal basis, for how long, and what your rights are. It complies with Regulation (EU) 2016/679 (GDPR) and Spanish Organic Law 3/2018 (LOPDGDD).</p>

<h2>1. Data controller</h2>
<ul>
{en.responsable}
</ul>

<h2>2. What we process and why</h2>
<table>
<tr><th>Processing</th><th>Data</th><th>Purpose</th><th>Legal basis</th><th>Retention</th></tr>
<tr><td>User account</td><td>Email, display name, password (hashed), date of birth, language, profile photo (optional), date and version of the terms you accepted</td><td>Create and manage your account; verify the minimum age (14) and access to 18+ content; and, if one of your favourite businesses offers a birthday gift and you don't turn it off in Settings → Notifications, give it to you on your birthday (the business never sees your date: it only gets the code when you redeem it)</td><td>Performance of a contract (art. 6(1)(b) GDPR); legal obligation for age (art. 6(1)(c); art. 7 LOPDGDD)</td><td>While the account is active. If you don't use it for 24 months (you don't log in or open the app or the website), we email you that it will be deleted when it reaches 36 months and remind you 30 days before; logging in is enough to keep it. If you own a business, we don't delete it automatically: we review it first and get in touch with you. When it is deleted (by you, or by us for inactivity), it is erased immediately (within 30 days at most if you ask by email) and backups are overwritten within 7 days. Businesses' invoicing data (6 years) and resolved reports (2 years) are kept, no longer linked to you</td></tr>
<tr><td>Sign in with Google / Apple</td><td>Provider identifier, email, name</td><td>Passwordless authentication</td><td>Performance of a contract</td><td>Same as the account</td></tr>
<tr><td>Location</td><td>Approximate or precise device coordinates (depending on the permission you grant) or the city you pick manually</td><td>Sort the feed and the map by distance; "deals near you" if you enable it; and, in aggregate and without identifying anyone, the distance figures in each business's “Report” (how far its customers come from)</td><td>Consent (art. 6(1)(a)), revocable in your device and app settings</td><td>No history is kept. Only the last known location is stored (for "near you") and discarded after 7 days</td></tr>
<tr><td>Favourites, reviews, redemptions and stamps</td><td>Saved businesses, ratings and comments, redemption codes and their status, deal views, stamp cards (stamps, rewards and their codes)</td><td>Provide the service: your favourites, your public reviews, your redemption history, businesses' stamp cards and aggregate statistics for businesses</td><td>Performance of a contract</td><td>While the account exists. Reviews are shown with your display name and, if you have redeemed something at that business with Klendar, with the “Verified customer” label (without saying what or when)</td></tr>
<tr><td>Photos and videos in reviews</td><td>The photos and videos you add to a review (up to 6), with their order, size and length</td><td>Publish them with your review, in the app and on klendar.app, with your name and profile photo visible. Before uploading them we remove the data inside them: for photos, the location, date and phone model (EXIF); for videos, the location and phone model. What can be seen in the image or heard in the video is published, so don't include other people without their permission. A review that goes to review because of its text isn't published, with its photos and videos, until someone at Klendar has reviewed it. Anyone can report a photo or a video; if it breaks the Community guidelines we take it down and tell you why. In the future we may analyse photos and videos automatically (Google Cloud Vision) to detect nudity or violence before they're published; we'll let you know before turning it on</td><td>Performance of a contract (publishing what you choose to publish); legal obligation for reports (Regulation (EU) 2022/2065)</td><td>Until you remove them, delete the review or delete your account; the files disappear from our servers within a few days. If someone has reported them, we keep a copy as evidence for as long as the report and the time to appeal last</td></tr>
<tr><td>Friends and plans</td><td>Your friend link (and its QR code), your friends and since when, the publications you mark as “I'm going”, the invitations you send and receive (and your answers), your “Let my friends see my plans” and “Show the plans I've been to with each friend” settings and the people you block</td><td>Let you become friends with people who have your link, see which plans your friends are going to, invite them and let them see what you're going to. If “Let my friends see my plans” is on, your friends see which upcoming publications you're going to (because you've marked “I'm going”, have a reserved place or a code): on each publication, on your friend page and, if they've asked for it, in a notification. Things that have already happened don't appear on your page, with one exception: a friend's page can show “You've been to N plans together”, the number of publications where you both have a validated redemption; only that friend sees it, it doesn't say which or when and it isn't stored separately (it's worked out on the spot from the redemptions we already keep). It only shows if you both have both settings on; if either of you turns it off, neither of you sees it. It's never shown with people you've blocked or suspended accounts, and when you delete your account your redemptions are anonymised and stop counting. The people you block can't be your friends or invite you (they aren't told). There is no people search: only people with your link or your QR code can find you</td><td>Performance of a contract. Showing your plans and the plans you've been to together can be turned off in Settings → Privacy; invitations and notifications about your friends' plans, in Settings → Notifications</td><td>While the account exists. If you remove someone from your friends, they stop seeing your plans straight away (we don't tell them)</td></tr>
<tr><td>Push notifications</td><td>Device token, preferences (favourites, nearby, messages from your favourites, friend invitations, stamps and rewards, birthday, quiet hours)</td><td>Tell you about news and messages from your favourites (at most one a week per business), nearby offers, invitations from your friends, the stamps and rewards on your cards and your birthday gift. Each kind can be turned off separately in Settings → Notifications</td><td>Consent, revocable at any time</td><td>Until you revoke the permission, log out or delete the account</td></tr>
<tr><td>Business account</td><td>Business details (name, address, tax ID, phone, contact email, opening hours), team members (email and role), plan and payments</td><td>Register, verify and manage the business; invoice the subscription</td><td>Performance of a contract; legal obligation (invoicing)</td><td>During the relationship and afterwards for the statutory period (tax: 4 years; commercial: 6 years). If the business is handed over, the new holder gets access to its data, including billing data. When the subscription is cancelled we keep the request and its reason, if given. When a business is deleted we keep a minimal record (business name, date, who deleted it and figures without personal data) for 6 years</td></tr>
<tr><td>Claiming a business (“Is this your business?”)</td><td>Your account, the role you say you have, the business phone number or email you give us, the evidence you upload (a photo or a document) or what you tell us, your declaration that it is true, the date and what we decide (and why)</td><td>Check that you run that business and, if so, make you its owner; tell whoever was its owner that it has changed; prevent someone from taking over a business that isn't theirs. Only the Klendar team sees it, and the evidence is kept in private storage</td><td>Performance of a contract (art. 6(1)(b) GDPR: you ask for it) and legitimate interest (art. 6(1)(f)) in preventing impersonation and protecting businesses</td><td>The evidence, up to 6 months after the claim is resolved; the claim (who, when and what was decided), 2 years</td></tr>
<tr><td>Content reports (also without an account)</td><td>If you report without an account: your name, your email (optional if it concerns child sexual abuse) and your language; if you report with your account, the account. In both cases: the reason, the text of the report, a copy of the reported content and the date. To stop abuse of reports made without an account, a digest of the connection calculated with a key that changes every day; never the IP address</td><td>Handle the report and reply to you: confirm we've received it and tell you what we've decided and why. The person who posted the content doesn't know who reported it</td><td>Legal obligation (art. 6(1)(c) GDPR; Regulation (EU) 2022/2065, art. 16)</td><td>Up to 2 years after the report is closed. The connection digest is deleted within 24 hours</td></tr>
<tr><td>Crash reports</td><td>Installation identifier, device model and OS, app version, technical crash report (without your name or email)</td><td>Detect and fix app crashes (Firebase Crashlytics)</td><td>Legitimate interest (art. 6(1)(f)): keeping the app working</td><td>90 days</td></tr>
<tr><td>App usage statistics (optional)</td><td>Installation identifier, screens and actions (viewing a deal, saving, redeeming, sharing, searching —without what you type—), device model and OS</td><td>Know what is used in order to improve the app (Firebase Analytics)</td><td>Consent (art. 6(1)(a)): unticked box at sign-up or in Settings → Privacy and data; withdrawn the same way</td><td>14 months</td></tr>
<tr><td>Marketing emails</td><td>Email</td><td>Send you Klendar news (never from third parties)</td><td>Specific consent ticked at sign-up; revocable in every email or in your profile</td><td>Until you withdraw it</td></tr>
<tr><td>“Tell me when…” alerts</td><td>The area you choose (point and radius), categories, maximum price</td><td>Tell you when something matching appears</td><td>Performance of a contract</td><td>Until you delete the alert or the account</td></tr>
<tr><td>Email summaries</td><td>Email, language, city, your favourites and plans</td><td>Send you the weekly summary with deals and plans from businesses (if you turn it on in Settings → Notifications; it starts off)</td><td>Consent; one-click unsubscribe in every email</td><td>Until you turn it off</td></tr>
<tr><td>Emails that bounce and changing your email</td><td>Your email, the date, the reason (bounce or marked as spam) and the technical details our email provider (Resend) gives us; when you change your email, the old and the new address</td><td>Stop sending you summaries and other non-essential emails while your address keeps bouncing our messages (account access emails are always sent) and let you know in the app and on the web; confirm an email change with a code to your current address and another to the new one. If we change it for you because you've lost access to your email, our admin log keeps the old address, the new one and how we verified your identity</td><td>Legitimate interest in not sending emails that don't arrive or that you don't want (Art. 6(1)(f) GDPR); performance of a contract for the email change</td><td>Until you change your email, tell us it works again or delete your account; the admin log, 2 years</td></tr>
<tr><td>Messages from your favourites</td><td>That you have the business in your favourites or stamps on one of its cards</td><td>Let the business send you an alert (at most one a week per venue), reviewed by Klendar; the business doesn't see who receives it</td><td>Consent (notifications); turn it off in Settings → Notifications</td><td>Inbox, 90 days</td></tr>
<tr><td>“You might like” suggestions</td><td>Your latest searches and the categories you look at most, stored on your phone</td><td>Suggest something when there's nothing nearby; they're sent with that request and not stored on our servers</td><td>Performance of a contract</td><td>On your phone, until you delete them or the account</td></tr>
<tr><td>Security</td><td>Encrypted digest of your connection (changes daily, never the IP address), trusted devices for fingerprint or Face ID login, codes to confirm it's you, technical website errors (no personal data)</td><td>Stop abuse, log in without a password on your devices, protect password changes and account deletion, detect failures</td><td>Legitimate interest (art. 6(1)(f))</td><td>Digest 24 h; devices 90 days unused; codes 1 h; errors 30 days</td></tr>
<tr><td>Consent history</td><td>What you have accepted or withdrawn and when</td><td>Being able to prove it (art. 7(1) GDPR)</td><td>Legal obligation (art. 6(1)(c))</td><td>While the account exists</td></tr>
{TEL['en']}<tr><td>Support</td><td>Email and the content of your message</td><td>Answer your enquiries</td><td>Performance of a contract / legitimate interest</td><td>1 year after closure</td></tr>
</table>
<p>To create an account, your email (or your Google or Apple account), your date of birth and accepting the terms are required; without them the account cannot be used. Everything else is optional.</p>

<h2>3. Recipients and processors</h2>
<p>We never sell or share your data. To provide the service we rely on providers acting as processors under contracts compliant with art. 28 GDPR:</p>
<ul>
  <li><strong>Supabase</strong> (database, authentication and storage; {SRV['en']}).</li>
  <li><strong>Google Firebase</strong> (push notifications, crash reports and, only if you agree, app usage statistics; Google Ireland Ltd.; international transfers covered by the EU-US Data Privacy Framework and standard contractual clauses).</li>
  <li><strong>Mapbox</strong> (Mapbox, Inc., USA: maps and walking directions; it receives the coordinates of the area you look at in order to render the map and, if you ask for walking directions to a venue, your position and the venue's, without your name or email; international transfer covered by the EU-US Data Privacy Framework, to which Mapbox has self-certified, and by standard contractual clauses).</li>
  <li><strong>Cloudflare</strong> (Cloudflare, Inc.: hosting and content delivery for klendar.app; it processes visitors' IP addresses to serve and protect the website, counts visits in aggregate with Cloudflare Web Analytics, without cookies or identifying you, and, when enabled, runs the anti-bot check (Turnstile) when you log in and when you report without an account; international transfers covered by the EU-US Data Privacy Framework and standard contractual clauses).</li>
  <li><strong>IONOS</strong> (IONOS SE, Germany: our mailbox; it receives what you write to us).</li>
  <li><strong>Resend</strong> (sending emails: your account emails, alerts, email summaries and replies to people who report without an account; it receives your email address and the content of the message; Plus Five Five, Inc., USA; international transfer covered by the EU-US Data Privacy Framework, to which Resend has self-certified, and by the European Commission's standard contractual clauses included in its data processing agreement).</li>
</ul>
<p>If you log in with your <strong>Apple</strong> account (“Continue with Apple”), Apple (Apple Distribution International Ltd., Ireland) verifies your identity and gives us an identifier, your name and your email, or a private Apple relay address if you choose to hide yours. Apple processes that data as an independent controller, under its own privacy policy; we only receive what is listed here. The same applies to <strong>Google</strong> if you log in with your Google account (see below).</p>
<p>If you add a redemption to <strong>Google Wallet</strong>, Google receives the pass data (deal, business and code) as an independent controller. The website's icons, fonts and libraries are served from klendar.app: your browser does not request them from Google Fonts or any other service (more detail in the <a href="/en/cookies/">cookie policy</a>).</p>
<p><strong>Reports</strong> are only seen by the Klendar team. We never give them to the person who posted the reported content; we only pass them on to the authorities if there are signs of a criminal offence (art. 18 of Regulation (EU) 2022/2065) or if a court or the competent authority requires it.</p>
<p><strong>Businesses</strong> see your display name when you redeem a deal or post a review, plus aggregate statistics (never your email or your location).</p>
<p>Your <strong>friends</strong> on Klendar (only the people you have become friends with through a friend link) see your display name and photo and, unless you turn it off, which plans you're going to (“I'm going”, a reserved place or a code). Nobody else sees it: not other people and not businesses, who don't know who is friends with whom either.</p>

<h2 id="google">If you log in with your Google account</h2>
<p>If you choose “Continue with Google”, Google shares with us, with your permission, only the basics of your account: your <strong>name</strong>, your <strong>email address</strong> and your <strong>profile picture</strong> (the <em>openid</em>, <em>email</em> and <em>profile</em> scopes). We do not ask for access to your contacts, calendar, Gmail, Drive or any other Google data.</p>
<ul>
  <li><strong>What for:</strong> only to create your Klendar account and identify you when you log in. Your name and picture become your profile name and picture (you can change them at any time) and your email is used for account emails.</li>
  <li><strong>Who with:</strong> nobody. We do not sell this data, we do not use it for advertising or advertising profiles and we do not pass it on to third parties, except Supabase, which stores accounts on our behalf as a processor.</li>
  <li><strong>How long:</strong> for as long as you have the account. If you delete it, they are deleted with it.</li>
  <li><strong>How to remove access:</strong> at any time from <a href="https://myaccount.google.com/permissions" rel="noopener">myaccount.google.com/permissions</a>. Your Klendar account keeps working if you set a password.</li>
</ul>
<p>Klendar's use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

<h2>4. Minors</h2>
<p>The minimum age to use Klendar is <strong>14</strong>. Content marked "18+" (nightlife venues, alcohol) is only shown to people who have stated through their date of birth that they are over 18. If we detect an account belonging to someone under 14, we will delete it.</p>

<h2>5. Your rights</h2>
<p>You may exercise your rights of access, rectification, erasure, objection, restriction and portability, and withdraw consent at any time, by writing to <a href="mailto:{EP}">{EP}</a> from your account email. From the app or from “Your account” on the website (Account → Settings → Privacy and data) you can also see what you have consented to and when, withdraw location, push, usage statistics and marketing consent separately, stop showing your plans to your friends, see and unblock the people you have blocked, download all your data as a file (access and portability), and <a href="/en/delete-account/">delete your account</a> entirely. If you believe we have not handled your request properly, you may lodge a complaint with the Spanish Data Protection Agency (<a href="https://www.aepd.es" rel="noopener">www.aepd.es</a>).</p>

<h2>6. Security</h2>
<p>Data is transmitted encrypted (TLS), passwords are stored hashed, database access is restricted by row-level security policies (each person only reaches their own data), and the providers listed hold recognised security certifications.</p>

<h2>7. Changes</h2>
<p>If we change this policy in a material way we will let you know in the app. The current version is always at <a href="https://klendar.app/privacidad/">klendar.app/privacidad</a> (Spanish, governing) and <a href="https://klendar.app/en/privacy/">klendar.app/en/privacy</a>.</p>
''')

    # ── Términos de uso ─────────────────────────────────────────────────────────
    ES['terminos'] = ('Términos de uso', 'Condiciones de uso de la app Klendar para personas usuarias.', f'''
<h2>1. Quiénes somos y qué es Klendar</h2>
<p>Klendar es una plataforma titularidad de {es.titular_frase} que permite descubrir ofertas de duración limitada y eventos de negocios locales, guardarlos, valorarlos y canjearlos con un código QR. Al crear una cuenta o usar la app aceptas estos términos y la <a href="/privacidad/">Política de privacidad</a>.</p>

<h2>2. Cuenta</h2>
<ul>
  <li>Debes tener al menos <strong>14 años</strong>. Los contenidos "+18" solo se muestran a mayores de 18.</li>
  <li>Los datos de tu cuenta deben ser veraces. Eres responsable de mantener tu contraseña en secreto.</li>
  <li>Puedes usar la app sin cuenta ("invitado") para ver ofertas; canjear, guardar favoritos y reseñar requiere cuenta.</li>
  <li>Puedes eliminar tu cuenta en cualquier momento desde Cuenta → Ajustes (en la app o en «Tu cuenta» de la web) o en <a href="/eliminar-cuenta/">klendar.app/eliminar-cuenta</a>.</li>
</ul>

<h2>3. Ofertas y canjes</h2>
<ul>
  <li>Las ofertas y eventos los publican los negocios, que son los únicos responsables de su contenido, condiciones, disponibilidad y cumplimiento. Klendar no vende productos ni servicios ni cobra por los canjes.</li>
  <li>Cada código QR es <strong>personal y de un solo uso</strong>, válido durante el tiempo que indica la pantalla del código (lo fija cada negocio: unos minutos en una oferta flash; en un evento, hasta que termina) y solo dentro de la ventana de la oferta. Cada persona puede canjear cada oferta una vez, salvo que el negocio permita más.</li>
  <li>El negocio puede exigir que la persona que canjea sea la titular de la cuenta y que se cumplan las condiciones publicadas (consumo mínimo, aforo, horario).</li>
  <li>Si un negocio no honra una oferta publicada, denúncialo desde la app; podremos suspender al negocio.</li>
</ul>

<h2>4. Reseñas y contenido de usuarios</h2>
<ul>
  <li>Puedes publicar una reseña por negocio (editable). Debe basarse en tu experiencia real y respetar las <a href="/normas/">Normas de la comunidad</a>.</li>
  <li>Concedes a Klendar una licencia no exclusiva, gratuita y mundial para mostrar tus reseñas en la Plataforma mientras estén publicadas.</li>
  <li>Podemos retirar contenido que incumpla las normas y suspender cuentas reincidentes, con la motivación y vías de recurso previstas en el Reglamento de Servicios Digitales (DSA). Antes de publicarse, los textos pasan por una moderación automática que puede dejarlos en revisión hasta que los mire una persona; cómo funciona está en las <a href="/normas/">Normas de la comunidad</a>.</li>
</ul>

<h2>5. Uso permitido</h2>
<p>No está permitido: usar la app para fines ilegales; intentar acceder a datos de otras personas o negocios; manipular canjes, reseñas o valoraciones; extraer datos de forma automatizada; ni interferir con el funcionamiento del servicio.</p>

<h2>6. Disponibilidad y cambios</h2>
<p>Trabajamos para que Klendar esté disponible siempre, pero no garantizamos ausencia de interrupciones. Podemos modificar o retirar funciones. Si un cambio en estos términos es relevante, te avisaremos en la app con antelación razonable y te pediremos que los aceptes de nuevo; si no estás de acuerdo, puedes eliminar tu cuenta en cualquier momento.</p>

<h2>7. Responsabilidad</h2>
<p>En la medida permitida por la ley, Klendar no responde de los daños derivados de ofertas o eventos publicados por los negocios, ni de decisiones tomadas en base a la información de la Plataforma. Nada en estos términos limita los derechos que te reconoce la normativa de consumo.</p>

<h2>8. Legislación y jurisdicción</h2>
<p>Se aplica la legislación española, sin perjuicio de las normas de protección de las personas consumidoras de tu país de residencia que te sean más favorables. Si tienes un problema, escríbenos antes a <a href="mailto:{E}">{E}</a> e intentaremos resolverlo. Como persona consumidora, también puedes dirigirte a los servicios de consumo de tu comunidad autónoma o de tu ayuntamiento, acudir al arbitraje de consumo si las dos partes lo aceptan, o presentar tu reclamación ante los juzgados de tu domicilio.</p>
''')

    EN['terminos'] = ('terms', 'Terms of use', 'Terms of use of the Klendar app for users.', f'''
<h2>1. Who we are and what Klendar is</h2>
<p>Klendar is a platform owned by {en.titular_frase} that lets you discover time-limited deals and events from local businesses, save them, review them and redeem them with a QR code. By creating an account or using the app you accept these terms and the <a href="/en/privacy/">Privacy policy</a>.</p>

<h2>2. Account</h2>
<ul>
  <li>You must be at least <strong>14 years old</strong>. "18+" content is only shown to people over 18.</li>
  <li>Your account details must be accurate. You are responsible for keeping your password secret.</li>
  <li>You can use the app without an account ("guest") to browse deals; redeeming, saving favourites and reviewing require an account.</li>
  <li>You can delete your account at any time from Account → Settings (in the app or in “Your account” on the website) or at <a href="/en/delete-account/">klendar.app/en/delete-account</a>.</li>
</ul>

<h2>3. Deals and redemptions</h2>
<ul>
  <li>Deals and events are published by businesses, which are solely responsible for their content, conditions, availability and fulfilment. Klendar does not sell products or services and does not charge for redemptions.</li>
  <li>Each QR code is <strong>personal and single-use</strong>, valid for the time shown on the code screen (each business sets it: a few minutes for a flash offer; for an event, until it ends) and only within the offer's time window. Each person may redeem each offer once, unless the business allows more.</li>
  <li>The business may require that the person redeeming is the account holder and that the published conditions are met (minimum spend, capacity, opening hours).</li>
  <li>If a business does not honour a published deal, report it from the app; we may suspend the business.</li>
</ul>

<h2>4. Reviews and user content</h2>
<ul>
  <li>You may post one review per business (editable). It must be based on your real experience and follow the <a href="/en/community-guidelines/">Community guidelines</a>.</li>
  <li>You grant Klendar a non-exclusive, royalty-free, worldwide licence to display your reviews on the Platform while they are published.</li>
  <li>We may remove content that breaches the guidelines and suspend repeat offenders, with the statement of reasons and appeal routes provided by the Digital Services Act (DSA). Before going live, text goes through automatic moderation that may hold it for review until a person has looked at it; how it works is explained in the <a href="/en/community-guidelines/">Community guidelines</a>.</li>
</ul>

<h2>5. Acceptable use</h2>
<p>You may not: use the app for unlawful purposes; attempt to access other people's or businesses' data; manipulate redemptions, reviews or ratings; scrape data automatically; or interfere with the operation of the service.</p>

<h2>6. Availability and changes</h2>
<p>We work to keep Klendar available at all times but cannot guarantee it will be free of interruptions. We may change or withdraw features. If a change to these terms is material, we will notify you in the app with reasonable notice and ask you to accept them again; if you do not agree, you can delete your account at any time.</p>

<h2>7. Liability</h2>
<p>To the extent permitted by law, Klendar is not liable for damages arising from deals or events published by businesses, or from decisions made on the basis of information on the Platform. Nothing in these terms limits the rights granted to you by consumer law.</p>

<h2>8. Governing law and jurisdiction</h2>
<p>Spanish law applies, without prejudice to any more favourable consumer protection rules of your country of residence. If you have a problem, write to us first at <a href="mailto:{E}">{E}</a> and we will try to solve it. As a consumer, you may also contact the consumer affairs services of your region or local council, use consumer arbitration if both parties agree to it, or bring your claim before the courts of your place of residence.</p>
''')

    # ── Condiciones para negocios ───────────────────────────────────────────────
    ES['negocios'] = ('Condiciones para negocios', 'Condiciones de contratación del servicio Klendar para negocios.', f'''
<p>Estas condiciones regulan la relación entre {es.parte} ("Klendar") y el negocio que se da de alta en la Plataforma ("el Negocio"). Al enviar la solicitud de alta, la persona que la envía declara tener poder para obligar al Negocio.</p>

<h2>1. Alta y verificación</h2>
<ul>
  <li>El Negocio facilita datos veraces (nombre, categoría, dirección, NIF/CIF, contacto). Klendar verifica el alta antes de hacerlo público y puede rechazarlo motivadamente.</li>
  <li>El Negocio designa un propietario de la cuenta y puede añadir encargados y empleados. El propietario responde de las acciones de su equipo.</li>
  <li>Para dar de alta un negocio y para ser su propietario (también al recibirlo en un traspaso) hay que tener <strong>18 años</strong> o más. Para formar parte de su equipo hay que tener <strong>16 años</strong> o más, y 18 si el negocio está marcado como "+18". Klendar lo comprueba con la fecha de nacimiento del perfil, y un negocio no puede marcarse como "+18" mientras haya en su equipo alguien menor de 18 años.</li>
  <li>Si el Negocio cambia de nombre de forma notable, de ciudad o de dirección (más de 1 km), Klendar puede revisarlo de nuevo. Mientras tanto la ficha sigue publicada y verificada, y lo que el Negocio tenga publicado y en vigor pasa a la dirección nueva. Si la revisión muestra que ya no se cumplen las condiciones del alta, Klendar podrá actuar conforme al apartado 6.</li>
  <li><strong>Reclamar un negocio.</strong> Si la ficha de un negocio la creó otra persona, quien lo lleva puede pedir su propiedad desde la propia ficha («¿Es tu negocio?»): con cuenta, 18 años o más, su cargo, un teléfono o un correo del negocio y una prueba (un documento, una foto o una explicación que se pueda comprobar). Klendar lo revisa a mano y, si lo aprueba, le traspasa la propiedad; quien era propietario recibe un aviso con el motivo, puede seguir en el equipo si Klendar lo considera oportuno y puede pedir que se revise la decisión en un plazo de 6 meses escribiendo a <a href="mailto:{E}">{E}</a>. Reclamar con datos falsos puede suponer la suspensión de la cuenta.</li>
  <li><strong>Fichas duplicadas.</strong> No se puede dar de alta un negocio que ya está en Klendar: si es el suyo, el Negocio debe reclamar la ficha que existe. Si Klendar detecta dos fichas del mismo negocio (el mismo nombre en la misma ciudad, o casi en la misma dirección), puede unirlas en una: la que sobra se elimina, quien la tenía en favoritos y sus enlaces pasan a la que se queda y su propietario recibe un aviso. Si las dos tienen contenido (publicaciones, reseñas, tarjetas de sellos…), Klendar lo resuelve con los propietarios antes de unirlas.</li>
</ul>

<h2>2. Servicio</h2>
<p>Klendar permite al Negocio publicar ofertas flash y eventos (con reserva de plazas y lista de espera si lo activa), novedades, su carta y horarios, gestionar su ficha, ofrecer tarjetas de sellos y un regalo de cumpleaños, avisar a sus clientes (como mucho una vez por semana y local, con revisión de Klendar), validar canjes mediante QR y consultar estadísticas. Klendar no interviene en la venta ni cobra a las personas usuarias.</p>

<h2>3. Obligaciones del Negocio</h2>
<ul>
  <li><strong>Honrar las ofertas publicadas</strong> en las condiciones indicadas durante su vigencia y hasta agotar el aforo declarado.</li>
  <li>Honrar los premios de sus tarjetas de sellos y el regalo de cumpleaños mientras los ofrezca.</li>
  <li>Publicar el precio final que pagará la persona, con el IVA y cualquier otro cargo incluidos.</li>
  <li>Si anuncia una rebaja, indicar como precio anterior el más bajo que haya aplicado en los 30 días anteriores.</li>
  <li>Publicar solo contenido veraz, lícito, del que tenga derechos (fotos, textos) y conforme a las <a href="/normas/">Normas de la comunidad</a>.</li>
  <li>Cumplir la normativa aplicable a su actividad, incluida la de publicidad de bebidas alcohólicas (Ley 34/1988 y normativa autonómica) y la protección de menores: los negocios de ocio nocturno o cuyas ofertas incluyan alcohol deben marcarse como "+18".</li>
  <li>Tratar los datos de las personas usuarias que conozca (nombre al canjear) solo para prestar el servicio, sin fines propios ni cesiones.</li>
</ul>

<h2>4. Prueba gratuita, precio y facturación</h2>
<ul>
  <li>Al darse de alta, el Negocio disfruta de un <strong>periodo de prueba gratuito de 30 días</strong> con todas las funciones, sin tarjeta y sin renovación automática. Además, mientras Klendar esté arrancando en la ciudad del Negocio, el servicio sigue siendo gratuito aunque haya terminado la prueba.</li>
  <li>Después, el servicio se presta con un <strong>plan único</strong>: una <strong>cuota fija de 19,90 € al mes por local</strong> (o 199 € al año), sin límite de publicaciones ni de canjes y <strong>sin comisiones por canje</strong>. Con varios locales, la cuota de cada uno es menor según la tabla de <a href="/precios/">klendar.app/precios</a>. Los precios se muestran sin IVA.</li>
  <li>Klendar avisará al Negocio con al menos <strong>un mes de antelación</strong> antes de empezar a cobrarle y antes de cualquier cambio de precio. Si no está de acuerdo, puede darse de baja antes de que se aplique, sin penalización.</li>
  <li>Hoy el pago se hace por <strong>transferencia bancaria</strong>: el Negocio lo solicita en <a href="mailto:{E}">{E}</a> y Klendar le indica los datos. Si más adelante se ofrecen otros medios (tarjeta o domiciliación), se comunicarán antes. Klendar emite factura de cada cobro.</li>
  <li>En caso de impago, tras un aviso y un plazo de 15 días, Klendar puede suspender la publicación de nuevas ofertas y eventos hasta que se regularice. La ficha y los datos del Negocio no se borran.</li>
</ul>

<h2>5. Duración, pausa, traspaso y baja</h2>
<p>El plan es mensual (o anual, si se elige así) y se renueva automáticamente, <strong>sin permanencia</strong>.</p>
<ul>
  <li><strong>Cancelar la suscripción.</strong> El Negocio puede cancelarla en cualquier momento, sin penalización, desde el panel («Dar de baja el negocio», en la app o en klendar.app/panel) o escribiendo a <a href="mailto:{E}">{E}</a>. La cancelación tiene efecto al final del periodo ya pagado (o de la prueba gratuita): hasta entonces todo sigue igual y no se cobra ningún periodo posterior. Klendar la confirma por correo y el Negocio puede deshacerla antes de esa fecha. Cancelar no borra la ficha, las publicaciones ni los datos.</li>
  <li><strong>Cerrar hasta nuevo aviso.</strong> El Negocio puede dejar de mostrarse cuando quiera: su ficha y sus publicaciones dejan de aparecer en la Plataforma (quien tenga el enlace verá «Cerrado temporalmente») hasta que lo abra de nuevo desde el panel. Cerrar no cancela la suscripción (para dejar de pagar hay que cancelarla) ni anula las reservas y los códigos ya entregados, que el Negocio debe respetar o cancelar desde el panel, que avisa a cada persona.</li>
  <li><strong>Traspaso.</strong> La persona propietaria puede traspasar el Negocio a alguien mayor de edad de su equipo, que debe aceptarlo (la propuesta caduca a los 14 días). Desde que lo acepta, es la titular a efectos de estas condiciones: asume la suscripción en curso y debe revisar y actualizar los datos de facturación. Klendar no interviene en la operación que haya detrás (venta, cesión…).</li>
  <li><strong>Eliminar el Negocio.</strong> La persona propietaria puede eliminarlo desde el panel tras confirmar su identidad, y antes puede descargar sus datos (ficha, publicaciones con sus cifras, informe y tarjetas de sellos sin datos de clientes). Al eliminarlo, Klendar anula las reservas y los códigos sin usar y avisa a cada persona afectada (también a quien tenga sellos, premios o regalos pendientes) y al equipo; la ficha, las publicaciones, las reseñas, las tarjetas de sellos y el equipo se borran definitivamente. Lo ya pagado no se devuelve. Los datos de facturación se conservan el plazo legal (fiscal 4 años, mercantil 6 años). La cuenta personal no se puede eliminar mientras sea propietaria de un negocio.</li>
</ul>
<p>Klendar puede resolver el contrato por incumplimiento grave (no honrar ofertas, contenido ilícito, fraude en canjes) con comunicación motivada.</p>

<h2>6. Moderación, suspensión y recurso</h2>
<p>Klendar puede retirar contenido o suspender temporalmente la ficha ante denuncias fundadas o incumplimientos. El Negocio recibirá la motivación y podrá pedir que se revise la decisión en un plazo de 6 meses escribiendo a <a href="mailto:{E}">{E}</a> (Reglamento (UE) 2022/2065). Los textos del Negocio pasan por una moderación automática que puede dejarlos en revisión hasta que los revise una persona de Klendar (ver «Cómo moderamos» en las <a href="/normas/">Normas de la comunidad</a>); la ficha y la carta siguen a la vista mientras tanto.</p>
<p>Si Klendar retira una publicación, se anulan sus reservas y códigos sin usar. Si desactiva la ficha del Negocio, se anulan las reservas y los códigos sin usar de todas sus publicaciones, los premios de sellos sin canjear (los sellos se devuelven a cada persona) y los regalos de cumpleaños pendientes. En los dos casos Klendar avisa a cada persona afectada con un motivo genérico, sin mencionar denuncias ni a quien las presentó.</p>
<p>Si se suspende la cuenta de la persona propietaria, Klendar pausa sus negocios ("Cerrado hasta nuevo aviso"): dejan de mostrarse y se avisa a su equipo, pero las reservas y los códigos ya emitidos siguen siendo válidos y el resto del equipo puede validarlos. Una cuenta suspendida no puede publicar, cambiar la ficha, validar códigos, invitar ni entrar en un equipo. Al levantar la suspensión, Klendar decide si reabre el negocio o deja que lo reabra la persona propietaria.</p>

<h2>7. Propiedad intelectual y datos</h2>
<p>El Negocio conserva la propiedad de sus contenidos y concede a Klendar licencia para mostrarlos en la Plataforma y en materiales promocionales de Klendar (con posibilidad de oponerse). Klendar y el Negocio actúan como responsables independientes respecto de los datos personales que cada uno trata.</p>

<h2>8. Responsabilidad</h2>
<p>Klendar responde de la prestación diligente del servicio técnico. No responde de la actividad del Negocio ni de reclamaciones de las personas usuarias derivadas de ofertas no honradas, que serán a cargo del Negocio. La responsabilidad máxima de Klendar se limita a las cuotas pagadas en los 12 meses anteriores, salvo dolo o negligencia grave.</p>

<h2>9. Legislación y fuero</h2>
<p>Legislación española. Para negocios, las partes se someten a los juzgados de {es.fuero}.</p>
''')

    EN['negocios'] = ('business-terms', 'Business terms', 'Terms of service of Klendar for businesses.', f'''
<p>These terms govern the relationship between {en.parte} ("Klendar") and the business that registers on the Platform ("the Business"). By submitting the registration, the person submitting it declares they are authorised to bind the Business.</p>

<h2>1. Registration and verification</h2>
<ul>
  <li>The Business provides accurate details (name, category, address, tax ID, contact). Klendar verifies the registration before making it public and may reject it with reasons.</li>
  <li>The Business designates an account owner and may add managers and staff. The owner is responsible for the actions of their team.</li>
  <li>To register a business and to own it (including when receiving it in a handover) you must be <strong>18 or over</strong>. To be part of its team you must be <strong>16 or over</strong>, and 18 if the business is marked "18+". Klendar checks this with the date of birth in the profile, and a business cannot be marked "18+" while anyone on its team is under 18.</li>
  <li>If the Business significantly changes its name, or changes its city or address (by more than 1 km), Klendar may review it again. In the meantime the business page stays published and verified, and what the Business has published and still running moves to the new address. If the review shows that the registration conditions are no longer met, Klendar may act under section 6.</li>
  <li><strong>Claiming a business.</strong> If someone else created a business's page, whoever runs the business can ask for ownership from the page itself (“Is this your business?”): with an account, aged 18 or over, giving their role, a business phone number or email and evidence (a document, a photo or an explanation that can be checked). Klendar reviews it by hand and, if it approves it, hands ownership over to them; whoever was the owner is notified with the reason, may stay on the team if Klendar considers it appropriate and may ask for the decision to be reviewed within 6 months by writing to <a href="mailto:{E}">{E}</a>. Claiming with false information may lead to the account being suspended.</li>
  <li><strong>Duplicate pages.</strong> A business that is already on Klendar cannot be registered again: if it is theirs, the Business must claim the existing page. If Klendar detects two pages for the same business (the same name in the same city, or almost the same address), it may merge them into one: the one that goes is deleted, the people who had it in their favourites and its links move to the one that stays, and its owner is notified. If both have content (publications, reviews, stamp cards…), Klendar sorts it out with the owners before merging them.</li>
</ul>

<h2>2. Service</h2>
<p>Klendar lets the Business publish flash deals and events (with place reservations and a waiting list if it turns them on), news, its menu and opening hours, manage its profile, offer stamp cards and a birthday gift, message its customers (at most once a week per venue, reviewed by Klendar), validate redemptions via QR and view statistics. Klendar does not take part in the sale and does not charge users.</p>

<h2>3. Obligations of the Business</h2>
<ul>
  <li><strong>Honour published deals</strong> under the stated conditions for as long as they are valid and until the declared capacity runs out.</li>
  <li>Honour the rewards on its stamp cards and the birthday gift for as long as it offers them.</li>
  <li>Publish the final price the person will pay, including VAT and any other charges.</li>
  <li>If it announces a price reduction, give as the previous price the lowest price it applied in the previous 30 days.</li>
  <li>Publish only accurate, lawful content it holds the rights to (photos, text), in line with the <a href="/en/community-guidelines/">Community guidelines</a>.</li>
  <li>Comply with the rules applicable to its activity, including those on advertising alcoholic beverages (Spanish Law 34/1988 and regional regulations) and the protection of minors: nightlife venues, or deals that include alcohol, must be marked "18+".</li>
  <li>Use the user data it learns (name on redemption) only to provide the service, with no purposes of its own and no disclosure.</li>
</ul>

<h2>4. Free trial, pricing and invoicing</h2>
<ul>
  <li>On registration, the Business enjoys a <strong>30-day free trial</strong> with every feature, with no card and no automatic renewal. In addition, while Klendar is starting in the Business's city, the service remains free even after the trial has ended.</li>
  <li>After that, the service is provided under a <strong>single plan</strong>: a <strong>flat fee of €19.90 a month per venue</strong> (or €199 a year), with no limit on publications or redemptions and <strong>no commission on redemptions</strong>. With several venues, the fee per venue is lower according to the table at <a href="/en/pricing/">klendar.app/en/pricing</a>. Prices are shown excluding VAT.</li>
  <li>Klendar will notify the Business at least <strong>one month in advance</strong> before it starts charging and before any price change. If the Business does not agree, it may cancel before the change applies, without penalty.</li>
  <li>Payment is currently made by <strong>bank transfer</strong>: the Business requests it at <a href="mailto:{E}">{E}</a> and Klendar sends the details. If other methods (card or direct debit) are offered later, they will be announced beforehand. Klendar issues an invoice for each payment.</li>
  <li>In case of non-payment, after a reminder and a 15-day period, Klendar may suspend the publication of new deals and events until payment is made. The Business's profile and data are not deleted.</li>
</ul>

<h2>5. Term, pausing, handover and termination</h2>
<p>The plan is monthly (or yearly, if chosen) and renews automatically, <strong>with no minimum term</strong>.</p>
<ul>
  <li><strong>Cancelling the subscription.</strong> The Business may cancel it at any time, without penalty, from the dashboard (“Leave Klendar”, in the app or at klendar.app/panel) or by writing to <a href="mailto:{E}">{E}</a>. Cancellation takes effect at the end of the period already paid (or of the free trial): until then everything carries on as before and no later period is charged. Klendar confirms it by email and the Business can undo it before that date. Cancelling does not delete the business page, publications or data.</li>
  <li><strong>Closing until further notice.</strong> The Business can stop being shown whenever it wants: its page and publications stop appearing on the Platform (anyone with the link will see “Temporarily closed”) until it reopens from the dashboard. Closing does not cancel the subscription (to stop paying, it has to be cancelled) and does not cancel bookings and codes already issued, which the Business must honour or cancel from the dashboard, which tells each person.</li>
  <li><strong>Handover.</strong> The owner can hand the Business over to an adult member of its team, who must accept it (the offer expires after 14 days). Once accepted, that person is the holder for the purposes of these terms: they take over the current subscription and must check and update the billing details. Klendar takes no part in any underlying transaction (sale, transfer…).</li>
  <li><strong>Deleting the Business.</strong> The owner can delete it from the dashboard after confirming their identity, and can first download its data (business page, publications with their figures, report and stamp cards without customer data). When it is deleted, Klendar cancels unused bookings and codes and tells each person affected (including anyone with pending stamps, rewards or gifts) and the team; the business page, publications, reviews, stamp cards and team are permanently deleted. Amounts already paid are not refunded. Billing data is kept for the statutory period (tax 4 years, commercial 6 years). A personal account cannot be deleted while it owns a business.</li>
</ul>
<p>Klendar may terminate the contract for serious breach (not honouring deals, unlawful content, redemption fraud) with a reasoned notice.</p>

<h2>6. Moderation, suspension and appeal</h2>
<p>Klendar may remove content or temporarily suspend the profile in response to substantiated reports or breaches. The Business will receive the reasons and may ask for the decision to be reviewed within 6 months by writing to <a href="mailto:{E}">{E}</a> (Regulation (EU) 2022/2065). The Business's text goes through automatic moderation that may hold it for review until someone at Klendar has reviewed it (see “How we moderate” in the <a href="/en/community-guidelines/">Community guidelines</a>); the business page and menu stay visible in the meantime.</p>
<p>If Klendar takes down a publication, its unused bookings and codes are cancelled. If it deactivates the Business's page, the unused bookings and codes of all its publications, unredeemed stamp-card rewards (each person gets their stamps back) and pending birthday gifts are cancelled. In both cases Klendar tells each person affected with a generic reason, without mentioning reports or who made them.</p>
<p>If the owner's account is suspended, Klendar pauses their businesses ("Closed until further notice"): they stop being shown and their team is told, but bookings and codes already issued remain valid and the rest of the team can validate them. A suspended account cannot publish, change the business page, validate codes, invite people or join a team. When the suspension is lifted, Klendar decides whether to reopen the business or let the owner reopen it.</p>

<h2>7. Intellectual property and data</h2>
<p>The Business retains ownership of its content and grants Klendar a licence to display it on the Platform and in Klendar's promotional materials (with the option to object). Klendar and the Business act as independent controllers with regard to the personal data each of them processes.</p>

<h2>8. Liability</h2>
<p>Klendar is responsible for diligently providing the technical service. It is not liable for the Business's activity or for users' claims arising from deals not honoured, which are borne by the Business. Klendar's maximum liability is limited to the fees paid in the preceding 12 months, except in cases of wilful misconduct or gross negligence.</p>

<h2>9. Governing law and jurisdiction</h2>
<p>Spanish law. For businesses, the parties submit to the courts of {en.fuero}.</p>
''')

    # ── Cookies ─────────────────────────────────────────────────────────────────
    ES['cookies'] = ('Política de cookies', 'Klendar no usa cookies: qué guarda en tu navegador para que funcione, cómo contamos las visitas sin identificarte y qué servicios de terceros se cargan.', '''
<p><strong>En resumen.</strong> klendar.app no usa cookies. Guarda en tu navegador solo lo imprescindible para que funcione lo que pides (tu sesión, tu idioma, los códigos que un negocio valida sin conexión) y cuenta las visitas sin cookies ni identificarte. Nada de esto sirve para publicidad ni para seguirte por otras webs, así que no te pedimos consentimiento (art. 22.2 de la LSSI-CE). Si algún día añadimos algo que lo necesite, te lo pediremos antes.</p>
<h2>Qué se guarda en tu navegador</h2>
<table>
<tr><th>Nombre</th><th>Dónde</th><th>Para qué</th><th>Cuánto dura</th><th>Tipo</th></tr>
<tr><td><code>klendar_lang</code></td><td>Todo klendar.app (almacenamiento local)</td><td>Recordar el idioma que eliges con ES/EN</td><td>Hasta que lo borres</td><td>Preferencia elegida por ti</td></tr>
<tr><td><code>sb-…-auth-token</code></td><td>«Tu cuenta» y panel (almacenamiento local)</td><td>Mantener tu sesión iniciada</td><td>Hasta que cierres sesión</td><td>Técnica (autenticación)</td></tr>
<tr><td><code>sb-…-auth-token-…code-verifier</code></td><td>«Tu cuenta» y panel (almacenamiento local)</td><td>Un secreto de un solo uso que comprueba que la vuelta de Google o Apple llega al mismo navegador en el que empezaste a entrar (PKCE)</td><td>Hasta terminar de entrar o cerrar sesión</td><td>Técnica (seguridad)</td></tr>
<tr><td><code>sb-…-admin-auth-token</code></td><td>Administración (almacenamiento local)</td><td>Mantener la sesión de administración, aparte de la de «Tu cuenta»</td><td>Hasta que cierres sesión, tras 30 minutos sin actividad o a las 12 horas</td><td>Técnica (autenticación)</td></tr>
<tr><td><code>klendar.admin.actividad</code>, <code>klendar.admin.cierre</code></td><td>Administración (almacenamiento local)</td><td>Cuándo hubo actividad por última vez (para cerrar la sesión tras 30 minutos sin ella) y por qué se cerró, para decírtelo</td><td>Hasta la siguiente vez que entres</td><td>Técnica (seguridad)</td></tr>
<tr><td><code>klendar.acceso.aviso</code></td><td>«Tu cuenta» y panel (almacenamiento de sesión)</td><td>Avisarte si un enlace del correo ha caducado o ya se usó</td><td>Hasta enseñar el aviso o cerrar la pestaña</td><td>Técnica</td></tr>
<tr><td><code>klendar.intencion</code></td><td>Fichas y «Tu cuenta» (almacenamiento de sesión)</td><td>Recordar el botón que acabas de pulsar (guardar, reservar, conseguir el código…) para hacerlo al volver de entrar, y no hacerlo nunca si llegas por un enlace de fuera</td><td>Hasta usarlo, 15 minutos como mucho o cerrar la pestaña</td><td>Técnica (seguridad)</td></tr>
<tr><td><code>klendar.biz</code></td><td>Panel del negocio</td><td>Recordar qué negocio estabas gestionando</td><td>Hasta que cierres sesión</td><td>Técnica</td></tr>
<tr><td><code>klendar.cola.…</code></td><td>Panel del negocio</td><td>Guardar los códigos validados sin conexión hasta que vuelva la red</td><td>Hasta que se envían o cierras sesión</td><td>Técnica</td></tr>
<tr><td>marca de verificación en dos pasos</td><td>Administración (almacenamiento de sesión)</td><td>No volver a preguntar en esa pestaña</td><td>Hasta cerrar la pestaña</td><td>Técnica (seguridad)</td></tr>
<tr><td><code>mapbox.eventData…</code> (si aparece)</td><td>Mapas de Explorar y del panel (almacenamiento local, lo pone Mapbox)</td><td>Un identificador aleatorio que cambia cada 24 horas y que Mapbox usa para contar cuántos mapas se cargan (facturación)</td><td>24 horas</td><td>Técnica del servicio de mapas</td></tr>
</table>
<h2>Estadísticas de visitas</h2>
<p>Usamos <strong>Cloudflare Web Analytics</strong>, que no usa cookies ni guarda nada en tu navegador: un pequeño script envía a Cloudflare, por encargo nuestro, la página vista, la web de la que vienes, el tipo de navegador y dispositivo, el país y los tiempos de carga. Solo vemos cifras agregadas, sin identificarte ni seguirte entre sitios, y Cloudflare no las usa para nada más. No se usa en «Tu cuenta», en el panel ni en la administración, ni en las direcciones de baja de los correos o los enlaces de amigo.</p>
<h2>Servicios de terceros que se cargan en algunas páginas</h2>
<p>Reciben tu dirección IP, como cualquier web que visitas, y no guardan cookies:</p>
<ul>
  <li><strong>Mapbox</strong>: los mapas de Explorar y del panel. Al cargar un mapa, Mapbox recibe el aviso de «mapa cargado» con el que factura.</li>
  <li><strong>Cloudflare Turnstile</strong>: cuando está activada, la comprobación anti-robots al entrar y al denunciar sin cuenta.</li>
</ul>
<p>Las fuentes, los iconos y las librerías (también la que conecta «Tu cuenta», el panel y la administración con nuestra base de datos) se sirven desde klendar.app, sin pasar por Google Fonts ni por otros servicios.</p>
<h2>Cómo borrarlo</h2>
<p>Al cerrar sesión se borran la sesión y lo del panel. Todo lo demás lo puedes borrar desde la configuración de tu navegador («Borrar datos de navegación» o «Datos de sitios»).</p>
<h2>La app</h2>
<p>La <strong>app móvil</strong> no usa cookies. Usa identificadores del dispositivo para las notificaciones (solo si las activas) y para los informes de errores y, solo si lo aceptas (al crear la cuenta o en Cuenta → Ajustes → Privacidad y datos), para estadísticas de uso de la app. Puedes retirarlo cuando quieras desde la app o desde «Tu cuenta» en la web. Más detalle en la <a href="/privacidad/">Política de privacidad</a>.</p>
''')

    EN['cookies'] = ('cookies', 'Cookie policy', 'Klendar uses no cookies: what it stores in your browser so things work, how we count visits without identifying you, and which third-party services load.', '''
<p><strong>In short.</strong> klendar.app does not use cookies. It only stores in your browser what is essential for what you ask it to do (your session, your language, codes a business validates offline) and it counts visits without cookies and without identifying you. None of this is used for advertising or to follow you across other sites, so we don't ask for your consent (art. 22.2 of the Spanish LSSI-CE). If we ever add anything that needs it, we will ask you first.</p>
<h2>What is stored in your browser</h2>
<table>
<tr><th>Name</th><th>Where</th><th>Purpose</th><th>How long</th><th>Type</th></tr>
<tr><td><code>klendar_lang</code></td><td>All of klendar.app (local storage)</td><td>Remember the language you pick with ES/EN</td><td>Until you delete it</td><td>Preference you chose</td></tr>
<tr><td><code>sb-…-auth-token</code></td><td>“Your account” and business dashboard (local storage)</td><td>Keep you logged in</td><td>Until you log out</td><td>Technical (authentication)</td></tr>
<tr><td><code>sb-…-auth-token-…code-verifier</code></td><td>“Your account” and business dashboard (local storage)</td><td>A one-time secret that checks that the return from Google or Apple reaches the same browser where you started logging in (PKCE)</td><td>Until you finish logging in or log out</td><td>Technical (security)</td></tr>
<tr><td><code>sb-…-admin-auth-token</code></td><td>Admin (local storage)</td><td>Keep the admin session, separate from the “Your account” one</td><td>Until you log out, after 30 minutes of inactivity or after 12 hours</td><td>Technical (authentication)</td></tr>
<tr><td><code>klendar.admin.actividad</code>, <code>klendar.admin.cierre</code></td><td>Admin (local storage)</td><td>When there was last activity (to log out after 30 minutes without any) and why the session was closed, so we can tell you</td><td>Until the next time you log in</td><td>Technical (security)</td></tr>
<tr><td><code>klendar.acceso.aviso</code></td><td>“Your account” and business dashboard (session storage)</td><td>Tell you if an email link has expired or was already used</td><td>Until the notice is shown or the tab is closed</td><td>Technical</td></tr>
<tr><td><code>klendar.intencion</code></td><td>Publication and business pages and “Your account” (session storage)</td><td>Remember the button you just pressed (save, reserve, get the code…) so it's done once you've logged in, and never done if you arrive through an outside link</td><td>Until it's used, 15 minutes at most or until the tab is closed</td><td>Technical (security)</td></tr>
<tr><td><code>klendar.biz</code></td><td>Business dashboard</td><td>Remember which business you were managing</td><td>Until you log out</td><td>Technical</td></tr>
<tr><td><code>klendar.cola.…</code></td><td>Business dashboard</td><td>Keep codes validated offline until the connection is back</td><td>Until they are sent or you log out</td><td>Technical</td></tr>
<tr><td>two-step verification flag</td><td>Admin (session storage)</td><td>Not asking again in that tab</td><td>Until the tab is closed</td><td>Technical (security)</td></tr>
<tr><td><code>mapbox.eventData…</code> (if present)</td><td>Maps in Explore and the dashboard (local storage, set by Mapbox)</td><td>A random identifier that changes every 24 hours, used by Mapbox to count map loads (billing)</td><td>24 hours</td><td>Technical, for the map service</td></tr>
</table>
<h2>Visit statistics</h2>
<p>We use <strong>Cloudflare Web Analytics</strong>, which uses no cookies and stores nothing in your browser: a small script sends Cloudflare, on our behalf, the page viewed, the site you came from, your browser and device type, your country and load times. We only see aggregate figures, without identifying you or tracking you across sites, and Cloudflare does not use them for anything else. It isn't used in “Your account”, the business dashboard or admin, or on email unsubscribe links and friend links.</p>
<h2>Third-party services loaded on some pages</h2>
<p>They receive your IP address, like any website you visit, and set no cookies:</p>
<ul>
  <li><strong>Mapbox</strong>: the maps in Explore and in the business dashboard. When a map loads, Mapbox receives the “map loaded” event it uses for billing.</li>
  <li><strong>Cloudflare Turnstile</strong>: when enabled, the anti-bot check when you log in and when you report without an account.</li>
</ul>
<p>Fonts, icons and libraries (including the one that connects “Your account”, the business dashboard and admin to our database) are served from klendar.app, without going through Google Fonts or any other service.</p>
<h2>How to delete it</h2>
<p>Logging out deletes the session and the dashboard data. You can delete everything else in your browser settings (“Clear browsing data” or “Site data”).</p>
<h2>The app</h2>
<p>The <strong>mobile app</strong> does not use cookies. It uses device identifiers for notifications (only if you turn them on) and for crash reports and, only if you agree (when signing up or in Account → Settings → Privacy and data), for app usage statistics. You can withdraw it at any time from the app or from “Your account” on the website. More detail in the <a href="/en/privacy/">Privacy policy</a>.</p>
''')

    # ── Normas de la comunidad ──────────────────────────────────────────────────
    ES['normas'] = ('Normas de la comunidad', 'Qué se puede y qué no se puede publicar en Klendar, y cómo se modera.', f'''
<h2>Para todo el mundo</h2>
<ul>
  <li>Respeto: nada de insultos, acoso, discriminación ni amenazas.</li>
  <li>Verdad: reseñas basadas en experiencias reales; ofertas que se cumplen.</li>
  <li>Legalidad: nada de contenido ilegal, que infrinja derechos de terceros o que promueva actividades ilícitas.</li>
  <li>Sin spam: ni publicidad ajena, ni enlaces engañosos, ni cuentas falsas.</li>
</ul>
<h2>Para negocios</h2>
<ul>
  <li>Publica solo ofertas que vayas a honrar, con condiciones claras (horario, aforo, requisitos).</li>
  <li>Fotos reales de tu local y productos, de las que tengas derechos.</li>
  <li>Alcohol y ocio nocturno: marca el negocio o la oferta como "+18". No se permite incitar al consumo excesivo ni dirigirse a menores (Ley 34/1988). Las publicaciones que mencionan bebidas alcohólicas se marcan +18 automáticamente y pasan por la moderación automática (más abajo).</li>
  <li>No se admite publicidad de tabaco, productos de vapeo ni juegos de azar o apuestas.</li>
  <li>No manipules reseñas ni canjes (cuentas propias, incentivos por valoraciones).</li>
  <li>Para dar de alta un negocio hace falta tener 18 años; para estar en su equipo, 16 (18 si el negocio es "+18").</li>
</ul>
<h2 id="resenas">Reseñas</h2>
<ul>
  <li>Cualquiera con cuenta en Klendar puede escribir una reseña de un negocio: una por persona y negocio, con una nota de 1 a 5 y, si quiere, un comentario y hasta 6 fotos o vídeos. Se puede editar cuando se quiera. Quien trabaja en un negocio no puede reseñarlo.</li>
  <li>Se muestran todas, las buenas y las malas, de la más reciente a la más antigua. Nadie paga por publicar, ordenar ni quitar reseñas, y un negocio no puede borrar una reseña: puede responderla o denunciarla si incumple estas normas.</li>
  <li>Antes de publicarse pasan por la moderación automática (más abajo), y se retiran las que incumplen estas normas.</li>
  <li><strong>«Cliente verificado»</strong>: una reseña lleva esta etiqueta si quien la escribe tiene al menos un canje validado en ese negocio con Klendar (el código de una oferta o de un evento, un premio de una tarjeta de sellos o un regalo de cumpleaños). Lo comprobamos de forma automática con los canjes que el propio negocio ha validado en el local. La etiqueta no comprueba que la reseña hable de esa visita ni lo que cuenta. Las demás reseñas también son de personas con cuenta, pero no comprobamos que hayan sido clientes. En la ficha de cada negocio puedes ver solo las de clientes verificados.</li>
</ul>
<h2>Cómo denunciar</h2>
<p>Cualquiera puede denunciar, tenga cuenta o no. En cada negocio, publicación, reseña o novedad, y en cada foto o vídeo de una reseña, hay un enlace "Denunciar", y en el pie de la web, "<a href="/app/#/denunciar">Denunciar contenido ilegal</a>". Indica qué contenido es, el motivo y por qué crees que es ilegal o incumple estas normas. Sin cuenta te pediremos tu nombre y tu correo (opcionales si se trata de abuso sexual infantil) y que declares que actúas de buena fe. Te confirmaremos que la hemos recibido y te diremos qué hemos decidido y por qué (en la app o por correo). Si no estás de acuerdo, puedes pedirnos que lo revisemos en un plazo de 6 meses. Quien publicó el contenido no sabrá quién lo denunció. Las decisiones las toma una persona, no un sistema automático.</p>
<h2>Bloquear a alguien</h2>
<p>Puedes bloquear a una persona desde su reseña, desde tu lista de amigos o desde una invitación suya. Dejas de ver sus reseñas, dejáis de ser amigos y no puede invitarte ni volver a añadirte. No se le avisa. Lo deshaces en Cuenta → Ajustes → Privacidad y datos → «Personas bloqueadas». Bloquear no retira nada para los demás: si el contenido incumple estas normas, denúncialo.</p>
<h2>Cómo moderamos</h2>
<ul>
  <li>Revisamos las denuncias en un plazo máximo de <strong>72 horas</strong> (24 horas si afectan a menores o contenido claramente ilegal).</li>
  <li>Moderación automática: revisamos de forma automática los textos que se publican (publicaciones, novedades, reseñas y sus respuestas, mensajes a clientes, ficha y carta del negocio, regalo de cumpleaños y tarjetas de sellos) en busca de insultos, palabras malsonantes, contenido sexual explícito, odio o discriminación y amenazas, además de alcohol, tabaco y apuestas. Lo que se marca no se publica hasta que lo revisa una persona de Klendar, normalmente en menos de 24 horas; la ficha y la carta del negocio siguen a la vista mientras tanto. No se admite un nombre de perfil con insultos o palabras malsonantes.</li>
  <li>Las medidas posibles son: retirar el contenido, avisar, suspender temporalmente o dar de baja la cuenta o el negocio.</li>
  <li>Si retiramos una publicación o un negocio, anulamos las reservas y los códigos sin usar afectados (y, si es un negocio, sus premios de sellos y regalos pendientes) y avisamos a cada persona sin mencionar la denuncia. Si suspendemos la cuenta del propietario de un negocio, el negocio queda en pausa, pero las reservas y los códigos que ya tiene la gente siguen valiendo.</li>
  <li>Quien publicó el contenido recibe una notificación motivada y puede pedirnos que lo revisemos en un plazo de 6 meses escribiendo a <a href="mailto:{E}">{E}</a>.</li>
  <li>Punto de contacto para autoridades, para quienes usan Klendar y para el Reglamento de Servicios Digitales (DSA): <a href="mailto:{E}">{E}</a> (en español o en inglés).</li>
</ul>
''')

    EN['normas'] = ('community-guidelines', 'Community guidelines', 'What you can and cannot post on Klendar, and how we moderate.', f'''
<h2>For everyone</h2>
<ul>
  <li>Respect: no insults, harassment, discrimination or threats.</li>
  <li>Honesty: reviews based on real experiences; deals that are honoured.</li>
  <li>Legality: no unlawful content, nothing that infringes third-party rights or promotes illegal activities.</li>
  <li>No spam: no third-party advertising, misleading links or fake accounts.</li>
</ul>
<h2>For businesses</h2>
<ul>
  <li>Only publish deals you will honour, with clear conditions (hours, capacity, requirements).</li>
  <li>Real photos of your venue and products that you hold the rights to.</li>
  <li>Alcohol and nightlife: mark the business or the deal as "18+". Encouraging excessive drinking or targeting minors is not allowed (Spanish Law 34/1988). Publications that mention alcoholic drinks are marked 18+ automatically and go through automatic moderation (see below).</li>
  <li>Advertising of tobacco, vaping products, gambling or betting is not accepted.</li>
  <li>Do not manipulate reviews or redemptions (own accounts, incentives for ratings).</li>
  <li>You must be 18 to register a business, and 16 to be on its team (18 if the business is "18+").</li>
</ul>
<h2 id="resenas">Reviews</h2>
<ul>
  <li>Anyone with a Klendar account can write a review of a business: one per person and business, with a rating from 1 to 5 and, if they like, a comment and up to 6 photos or videos. It can be edited at any time. People who work at a business cannot review it.</li>
  <li>All reviews are shown, good and bad, from newest to oldest. Nobody pays to publish, rank or remove reviews, and a business cannot delete a review: it can reply to it or report it if it breaks these guidelines.</li>
  <li>Before going live they go through automatic moderation (see below), and those that break these guidelines are removed.</li>
  <li><strong>“Verified customer”</strong>: a review has this label if the person who wrote it has at least one validated redemption at that business with Klendar (the code for an offer or an event, a stamp-card reward or a birthday gift). We check this automatically against the redemptions the business itself has validated at the venue. The label doesn't check that the review is about that visit or what it says. Other reviews are also from people with an account, but we don't check that they were customers. On each business page you can show only the ones from verified customers.</li>
</ul>
<h2>How to report</h2>
<p>Anyone can report, with or without an account. Every business, publication, review and news post, and every photo or video in a review, has a "Report" link, and the website footer has "<a href="/app/?lang=en#/denunciar">Report illegal content</a>". Tell us which content it is, the reason and why you believe it is illegal or breaks these guidelines. Without an account, we'll ask for your name and email (optional if it concerns child sexual abuse) and for you to declare that you are acting in good faith. We'll confirm we've received your report and tell you what we've decided and why (in the app or by email). If you disagree, you can ask us to review it within 6 months. The person who posted the content won't know who reported it. Decisions are made by a person, not by an automated system.</p>
<h2>Blocking someone</h2>
<p>You can block someone from their review, from your friends list or from an invitation they sent you. You stop seeing their reviews, you are no longer friends and they can't invite you or add you again. They aren't told. You can undo it in Account → Settings → Privacy and data → “Blocked people”. Blocking doesn't remove anything for anyone else: if the content breaks these guidelines, report it.</p>
<h2>How we moderate</h2>
<ul>
  <li>We review reports within <strong>72 hours</strong> at most (24 hours if they involve minors or clearly illegal content).</li>
  <li>Automatic moderation: we automatically check the text people publish (publications, news, reviews and replies, customer messages, business page and menu, birthday gift and stamp cards) for insults, swear words, explicit sexual content, hate or discrimination and threats, as well as alcohol, tobacco and gambling. Anything flagged isn't published until someone at Klendar has reviewed it, usually within 24 hours; the business page and menu stay visible in the meantime. Profile names with insults or swear words aren't accepted.</li>
  <li>Possible measures: remove the content, issue a warning, temporarily suspend, or close the account or business.</li>
  <li>If we take down a publication or a business, we cancel the unused bookings and codes affected (and, for a business, its pending stamp-card rewards and gifts) and tell each person without mentioning the report. If we suspend the account of a business owner, the business is paused, but the bookings and codes people already have remain valid.</li>
  <li>Whoever posted the content receives a reasoned notification and can ask us to review it within 6 months by writing to <a href="mailto:{E}">{E}</a>.</li>
  <li>Point of contact for authorities, for people using Klendar and for the Digital Services Act (DSA): <a href="mailto:{E}">{E}</a> (in Spanish or English).</li>
</ul>
''')

    # ── Eliminar cuenta ─────────────────────────────────────────────────────────
    ES['eliminar-cuenta'] = ('Eliminar tu cuenta', 'Cómo eliminar tu cuenta de Klendar y qué datos se borran.', f'''
<h2>Desde la app o desde la web (recomendado)</h2>
<ol>
  <li>Abre Klendar, o <a href="/app/">«Tu cuenta»</a> en klendar.app, y entra con tu cuenta.</li>
  <li>Ve a <strong>Cuenta</strong> → <strong>Ajustes</strong> → <strong>Eliminar mi cuenta</strong> (al final de la pantalla).</li>
  <li>Confirma que eres tú, con tu contraseña actual o con un código que te mandamos al correo, y confirma la eliminación. La cuenta se elimina al momento.</li>
</ol>
<h2>Por correo</h2>
<p>Si no puedes entrar en tu cuenta, escribe a <a href="mailto:{EP}?subject=Eliminar%20mi%20cuenta">{EP}</a> desde el email de tu cuenta con el asunto "Eliminar mi cuenta". La eliminaremos en un máximo de 30 días y te lo confirmaremos.</p>
<h2>Qué se elimina</h2>
<ul>
  <li>Tu perfil (nombre, email, fecha de nacimiento, foto), tus favoritos, tus planes, tus avisos «Avísame si…», tus preferencias y tokens de notificaciones, tus dispositivos de confianza, tu ubicación, tus tarjetas de sellos y tu historial de canjes.</li>
  <li>Tu enlace de amigo, tus amigos, tus «Voy», las invitaciones que has mandado y recibido y las personas que has bloqueado.</li>
  <li>Tus reseñas, con sus fotos y vídeos, se eliminan junto con tu cuenta.</li>
  <li>Si eres propietario/a de un negocio, primero tienes que darlo de baja o traspasarlo a alguien de tu equipo desde «Dar de baja el negocio» (en la app o en el panel web): mientras seas propietario/a, la cuenta no se elimina. Al eliminar el negocio avisamos a quien tenga reservas, códigos, sellos o premios pendientes.</li>
</ul>
<h2>Qué se conserva y por qué</h2>
<ul>
  <li>Estadísticas <strong>anónimas</strong> de los negocios (número de canjes o vistas), que ya no se vinculan a ti.</li>
  <li>Si eres propietario/a de un negocio con cuota facturada, los datos de facturación se conservan el plazo legal (fiscal 4 años, mercantil 6 años).</li>
  <li>Denuncias resueltas, 2 años, para cumplir el Reglamento de Servicios Digitales.</li>
</ul>
''')

    EN['eliminar-cuenta'] = ('delete-account', 'Delete your account', 'How to delete your Klendar account and what data is erased.', f'''
<h2>From the app or the website (recommended)</h2>
<ol>
  <li>Open Klendar, or <a href="/app/?lang=en">“Your account”</a> on klendar.app, and log in.</li>
  <li>Go to <strong>Account</strong> → <strong>Settings</strong> → <strong>Delete my account</strong> (at the bottom of the screen).</li>
  <li>Confirm it's you, with your current password or with a code we email you, and confirm the deletion. The account is deleted immediately.</li>
</ol>
<h2>By email</h2>
<p>If you can't log in to your account, write to <a href="mailto:{EP}?subject=Delete%20my%20account">{EP}</a> from your account email with the subject "Delete my account". We will delete it within 30 days at most and confirm it to you.</p>
<h2>What is deleted</h2>
<ul>
  <li>Your profile (name, email, date of birth, photo), your favourites, your plans, your “Tell me when…” alerts, your preferences and notification tokens, your trusted devices, your location, your stamp cards and your redemption history.</li>
  <li>Your friend link, your friends, your “I'm going” marks, the invitations you have sent and received and the people you have blocked.</li>
  <li>Your reviews, with their photos and videos, are deleted together with your account.</li>
  <li>If you own a business, you first have to close it or hand it over to someone on your team from “Leave Klendar” (in the app or on the web dashboard): while you own a business, the account isn't deleted. When the business is deleted we tell anyone with pending bookings, codes, stamps or rewards.</li>
</ul>
<h2>What is kept and why</h2>
<ul>
  <li><strong>Anonymous</strong> business statistics (number of redemptions or views), no longer linked to you.</li>
  <li>If you own a business with invoiced fees, invoicing data is kept for the statutory period (tax 4 years, commercial 6 years).</li>
  <li>Resolved reports, 2 years, to comply with the Digital Services Act.</li>
</ul>
''')

    # ── Soporte (ES; la versión EN vive en build_site.py como /en/support/) ─────
    ES['soporte'] = ('Soporte', 'Ayuda de Klendar: cómo canjear una oferta, dar de alta tu negocio, recuperar la cuenta o denunciar contenido. Respondemos en 2 días laborables.', f'''
<h2>Contacto</h2>
<p>Escríbenos a <a href="mailto:{E}">{E}</a>. Respondemos en un máximo de 2 días laborables.</p>
<h2>Preguntas frecuentes</h2>
<h3>No me deja canjear una oferta</h3>
<p>Comprueba que la oferta sigue activa (tiene una ventana horaria y un aforo), que has entrado en tu cuenta y que no has gastado los canjes por persona que permite el negocio.</p>
<h3>El código QR ha caducado</h3>
<p>Los códigos caducan al cabo de un rato (normalmente pocos minutos; lo elige cada negocio). Pulsa "Generar otro código" en la misma pantalla.</p>
<h3>Un negocio no ha respetado su oferta</h3>
<p>Denúncialo desde su ficha (icono de bandera) con el motivo "La oferta no es como se anuncia". Lo revisamos y, si se repite, el negocio queda suspendido.</p>
<h3>Denunciar contenido ilegal</h3>
<p>Si ves algo ilegal o que incumple las <a href="/normas/">Normas de la comunidad</a>, pulsa «Denunciar» en ese negocio, publicación, reseña o novedad, o usa el <a href="/app/#/denunciar">formulario de denuncias</a> (también en el pie de cada página: «Denunciar contenido ilegal»). No hace falta tener cuenta. Te confirmamos que la hemos recibido y te contamos qué hemos decidido y por qué. Si alguien está en peligro ahora mismo, llama al 112.</p>
<h3>No recibo notificaciones</h3>
<p>Revisa Cuenta → Ajustes → Notificaciones y los permisos de notificaciones del sistema. "Cerca de ti" solo avisa de ofertas flash dentro del radio elegido y como máximo 3 veces al día.</p>
<h3>No puedo entrar en mi cuenta</h3>
<p>En «Entrar», pulsa «¿Has olvidado la contraseña?» y te mandamos un enlace para crear una nueva, o elige «Entrar con un código por correo» y entra sin contraseña. Si creaste la cuenta con Google o con Apple, entra con ese mismo botón. Si ya no puedes abrir ese correo, escríbenos a <a href="mailto:{E}">{E}</a> desde otra dirección y dinos con qué correo creaste la cuenta.</p>
<h3>Soy un negocio y quiero darme de alta</h3>
<p>En la app: Cuenta → «¿Quieres registrar tu negocio?», o en la web desde el <a href="/panel/">panel</a>. Lo revisamos en 24-48 h. También puedes escribirnos.</p>
''')
    return ES, EN


LEGAL_SLUGS = ('aviso-legal', 'privacidad', 'terminos', 'negocios')


def render(lang, path, title, desc, body, es_path=None):
    t = T[lang]
    todo = TODO[lang] if (es_path or path).strip('/') in LEGAL_SLUGS and 'class="tbd"' in body else ''
    courtesy = COURTESY.format(es=es_path) if lang == 'en' else ''
    meta = META[lang].format(date=fecha((es_path or path).strip('/'), lang), v=VERSION)
    return (head(t, path, f'{title} · Klendar', desc)
            + '<main class="doc" id="contenido">\n<h1>' + title + '</h1>\n'
            + f'<div class="meta">{meta}</div>\n' + courtesy + todo + '\n'
            + body + historial((es_path or path).strip('/'), lang) + '\n</main>\n' + footer(t))


def parar_si_faltan_datos(D, publicar):
    problemas = comprobar(D, publicar)
    if SERVIDORES not in UBICACION_SERVIDORES:
        problemas.append(f"SERVIDORES tiene que ser 'londres' o 'irlanda' (está puesto {SERVIDORES!r})")
    if problemas:
        print('build_legal.py: NO se ha generado ninguna página.', file=sys.stderr)
        print(f"Revisa TITULAR_DATOS (tipo = {D.get('tipo')!r}) al principio de build_legal.py:", file=sys.stderr)
        for p in problemas:
            print(f'  - {p}', file=sys.stderr)
        print('Qué es cada dato y de dónde sale: docs/LEGAL_SL.md en el repo de la app.', file=sys.stderr)
        sys.exit(1)


def paginas(ES, EN):
    """(ruta del archivo, html) de todas las páginas legales."""
    out = []
    for slug, (title, desc, body) in ES.items():
        out.append((f'{slug}/index.html', render('es', f'/{slug}/', title, desc, body)))
    for es_slug, (en_slug, title, desc, body) in EN.items():
        assert ALT[f'/{es_slug}/'] == f'/en/{en_slug}/', es_slug
        out.append((f'en/{en_slug}/index.html', render('en', f'/en/{en_slug}/', title, desc, body, es_path=f'/{es_slug}/')))
    return out


def generar():
    parar_si_faltan_datos(TITULAR_DATOS, publicar=True)
    ES, EN = textos(TITULAR_DATOS)
    # Todo se genera antes de escribir nada: o salen todas o ninguna.
    for ruta, contenido in paginas(ES, EN):
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        io.open(ruta, 'w', encoding='utf-8', newline='\n').write(contenido)
    print('ok', TITULAR_DATOS['tipo'], list(ES), [v[0] for v in EN.values()])


PREVIA_CSS = '''
:root { --tinta: #1b1b1f; --gris: #55555f; --linea: #dcdce2; --fondo: #ffffff; --dato: #d9f2e0; --borde-dato: #6fbf87; --alerta: #a3231b; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--fondo); color: var(--tinta); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.wrap { max-width: 880px; margin: 0 auto; padding: 24px 16px 96px; }
.banner { background: var(--alerta); color: #fff; padding: 14px 16px; border-radius: 8px; font-weight: 600; }
.dato { background: var(--dato); box-shadow: 0 0 0 1px var(--borde-dato); border-radius: 3px; padding: 0 2px; }
mark.tbd { background: #ffe27a; }
h1 { font-size: 28px; line-height: 1.2; margin: 24px 0 8px; }
section.doc { border-top: 3px solid var(--tinta); margin-top: 56px; padding-top: 4px; }
section.doc > h1 { font-size: 24px; }
h2 { font-size: 19px; margin-top: 28px; }
table { border-collapse: collapse; width: 100%; font-size: 14px; display: block; overflow-x: auto; }
th, td { border: 1px solid var(--linea); padding: 6px 8px; text-align: left; vertical-align: top; }
.meta, .nota { color: var(--gris); font-size: 14px; }
nav ol { padding-left: 20px; }
a { color: inherit; }
@media print { .banner { color: #000; background: none; border: 3px solid #000; } section.doc { break-before: page; } }
'''


def vista_previa(dest=os.path.join('tools', 'legal_preview')):
    D = EJEMPLO_SL
    parar_si_faltan_datos(D, publicar=False)
    ES, EN = textos(D, resaltar=True)
    secciones, indice = [], []
    for lang, docs in (('es', [(s, s) + v for s, v in ES.items()]), ('en', [(s,) + v for s, v in EN.items()])):
        for s, slug, title, desc, body in docs:
            ancla = f'{lang}-{slug}'
            url = f'https://klendar.app/{slug}/' if lang == 'es' else f'https://klendar.app/en/{slug}/'
            indice.append(f'<li><a href="#{ancla}">{title}</a> <span class="nota">({"ES, la que vale" if lang == "es" else "EN, traducción informativa"} · {url})</span></li>')
            meta = META[lang].format(date=fecha(s, lang), v=VERSION)
            cuerpo = body.replace('href="/', 'href="https://klendar.app/')
            secciones.append(f'<section class="doc" id="{ancla}" lang="{lang}">\n<h1>{title}</h1>\n'
                             f'<div class="meta">{meta} · {url}</div>\n{cuerpo}{historial(s, lang)}\n</section>')
    doc = f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Textos legales con SL (vista previa)</title>
<style>{PREVIA_CSS}</style>
</head>
<body>
<div class="wrap">
<p class="banner">VISTA PREVIA CON DATOS DE EJEMPLO FALSOS («{EJEMPLO_SL['razon_social']}», NIF {EJEMPLO_SL['nif']}). No es un texto publicado ni se puede publicar así.</p>
<h1>Textos legales de Klendar cuando la titular sea la SL</h1>
<p>Así quedarán las páginas legales de klendar.app el día que la sociedad sustituya a la persona física. <span class="dato">En verde</span>, lo que sale de los datos de la sociedad; todo lo demás es el texto que ya está publicado. La versión en español es la que vale; la inglesa es una traducción informativa.</p>
<p class="nota">Generado con <code>python build_legal.py --vista-previa</code> (klendar-web). Qué datos hacen falta y cómo se rellenan: <code>docs/LEGAL_SL.md</code> en el repo de la app.</p>
<nav><h2>Índice</h2><ol>
{chr(10).join(indice)}
</ol></nav>
{chr(10).join(secciones)}
</div>
</body>
</html>
'''
    os.makedirs(dest, exist_ok=True)
    ruta = os.path.join(dest, 'index.html')
    io.open(ruta, 'w', encoding='utf-8', newline='\n').write(doc)
    print('vista previa:', ruta)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--vista-previa']:
        vista_previa()
    elif not args:
        generar()
    else:
        sys.exit('Uso: python build_legal.py [--vista-previa]')
