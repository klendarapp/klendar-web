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
from ayuda import soporte_html

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
    # 2026-10-05 (textos aprobados por Iván, docs/LEGAL_PENDIENTE_2026-10.md):
    # series, según el tiempo (MET Norway), RRPP, historias, «El sitio»,
    # cookies, orden de las publicaciones (Reglamento P2B) y soporte. Sin
    # re-aceptación: informan de funciones nuevas y opcionales (lo de los
    # RRPP se avisa en el momento, antes de apuntarse) y lo que se pide a
    # quien usa Klendar ya lo pedían la ley y las normas (permiso de quien
    # sale en una foto); nada recorta derechos ni cuesta dinero. Las
    # condiciones para negocios no tienen re-aceptación: se aplican a los 15
    # días (P2B art. 3.2), el 20-10-2026. Lo de la traducción automática se
    # publica al dar de alta el proveedor.
    # 2026-10-06 (tanda A, aprobada por Iván, docs/LEGAL_PENDIENTE_2026-10.md):
    # tus gustos y tu ciudad (y el aviso de viaje), búsquedas y «Lo más
    # buscado», tus planes en tu calendario, el estado de WhatsApp en
    # historias, cuatro claves del navegador, el orden por gustos (P2B), el
    # carné, «Solidario» y «¿Hay sitio ahora?», y «Escúchalo antes».
    # Informativo, sin re-aceptación: funciones opcionales que solo informan,
    # y lo que se pide al negocio (comprobar el carné, marcar con verdad) ya
    # se le pedía. Las condiciones para negocios (apartados 2 bis y 3) se
    # aplican a los 15 días (P2B art. 3.2), el 21-10-2026.
    # 2026-10-06 (B1–B3, aprobados por Iván): importe del ticket en la
    # privacidad y «Antes de cerrar» en las normas. Informativo, sin
    # re-aceptación; no toca las condiciones para negocios.
    # 2026-10-07 (tanda B, TB1–TB21, aprobada por Iván el 7-10,
    # docs/LEGAL_PENDIENTE_2026-10.md): Klendar en la tele, visitas desde la
    # tele, el cartel o un RRPP, cuentas de entidad y agenda pública, «Dónde
    # ver el partido» y bonos pagados en el local. Informativo, sin
    # re-aceptación: funciones nuevas y opcionales que no recortan derechos.
    # Las condiciones para negocios (apartados 2 bis, 3, 3 bis y 3 ter) se
    # aplican a los 15 días (P2B art. 3.2), el 22-10-2026.
    # 2026-10-13 (tanda C, C1–C51, aprobada por Iván el 13-10,
    # docs/LEGAL_PENDIENTE_2026-10.md): widget, pantalla de bloqueo y reloj,
    # artistas y organizadores sin local fijo, cola virtual, grupos y
    # empresas, sorteos, «Esta noche se mueve», enlaces, alérgenos y carta de
    # la ficha, cupones, regalos y habituales, y dos claves del navegador.
    # Informativo, sin re-aceptación: funciones nuevas y opcionales que no
    # recortan derechos. Las condiciones para negocios (apartados 3, 3
    # quater, 3 quinquies y 3 sexies) se aplican a los 15 días (P2B art.
    # 3.2), el 28-10-2026.
    # 2026-10-14 (lote D, D1–D5, D15–D22 y D25–D27, aprobado por Iván el
    # 14-10, docs/LEGAL_PENDIENTE_2026-10.md): cómo se avisan los cambios de
    # las condiciones para negocios y qué se registra, varios locales, «Pedir
    # un local» y «Avísame cuando Klendar llegue», y el alta de entidades con
    # documento. Informativo, sin re-aceptación: funciones nuevas y
    # opcionales que no recortan derechos. Las condiciones para negocios
    # (apartados 3 bis, 4 y 10) se aplican a los 15 días (P2B art. 3.2), el
    # 29-10-2026. El cobro con tarjeta (D6–D14) y Turnstile (D29–D32), al
    # encenderlos (docs/RUNBOOK.md §2j y §0d).
    # 2026-10-15 (admin tanda C, AC1–AC4, aprobada por Iván el 15-10,
    # docs/LEGAL_PENDIENTE_2026-10.md): un negocio puede denunciar una
    # petición de grupo que recibe; qué pasa si se retira una petición o un
    # sorteo; la copia de la petición denunciada. Informativo, sin
    # re-aceptación; las condiciones para negocios no cambian.
    # 2026-10-16 («Dar en el momento», DM1–DM7, y Menú del día, horario de
    # cocina y QR de mesa, ME1–ME8, aprobados por Iván el 16-10,
    # docs/LEGAL_PENDIENTE_2026-10.md): términos (3 sexies y el wifi del QR
    # de mesa en el 3), privacidad (filas nuevas, cuenta de negocio y
    # «Descargar mis datos»), cookies (/m/ sin estadísticas), eliminar cuenta
    # y «Cliente verificado» en las normas. Informativo, sin re-aceptación.
    # Las condiciones para negocios (apartados 3, 3 septies, 3 octies y 3
    # nonies) se aplican a los 15 días (P2B art. 3.2), el 31-10-2026; versión
    # `2026-10-16` registrada en el sistema de avisos, sin lanzar el aviso.
    'normas': {'es': '16 de octubre de 2026', 'en': '16 October 2026'},
    # 2026-10-02 (decisiones E–G): cuentas inactivas (aviso a los 24 meses,
    # borrado a los 36), reclamar un negocio y duplicados, reseñas de
    # «Cliente verificado». Informativo: sin re-aceptación.
    'privacidad': {'es': '16 de octubre de 2026', 'en': '16 October 2026'},
    # 2026-10-14 (C52, aprobado por Iván el 14-10): dos claves de la
    # administración que faltaban en la tabla. Informativo.
    'cookies': {'es': '16 de octubre de 2026', 'en': '16 October 2026'},
    'eliminar-cuenta': {'es': '16 de octubre de 2026', 'en': '16 October 2026'},
    'soporte': {'es': '5 de octubre de 2026', 'en': '5 October 2026'},
    # 2026-10-01 (segunda tanda, R4 de la revisión legal): los términos
    # explican la moderación automática y las condiciones para negocios se
    # ponen al día. Informativo o a favor de quien acepta: sin re-aceptación
    # (criterio en docs/AUDITORIA_LEGAL.md, «Revisión 2026-10-01», R6).
    'terminos': {'es': '16 de octubre de 2026', 'en': '16 October 2026'},
    'negocios': {'es': '16 de octubre de 2026', 'en': '16 October 2026'},
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
        ('16 de octubre de 2026',
         'Dar en el momento: lo que te da un negocio con un QR suyo (qué guardamos, para qué, qué ve el negocio y cuánto tiempo), también en la cuenta de negocio y en «Descargar mis datos». Escaneos del QR de mesa de un local: solo contamos cuántos, sin saber quién (14 meses); en la cuenta de negocio, el horario de cocina y el wifi para sus clientes.',
         '16 October 2026',
         "Give on the spot: what a business gives you with a QR code of its own (what we keep, what for, what the business sees and for how long), also in the business account and in “Download my data”. Scans of a venue's table QR code: we only count how many, without knowing who (14 months); in the business account, kitchen hours and the customer Wi-Fi."),
        ('15 de octubre de 2026',
         'Peticiones de grupo («Grupos y empresas»): si un negocio denuncia tu petición, guardamos una copia de lo denunciado con la denuncia hasta 2 años desde que se cierra, aunque la petición se borre antes.',
         '15 October 2026',
         "Group requests (“Groups and companies”): if a business reports your request, we keep a copy of what was reported with the report for up to 2 years after it is closed, even if the request is deleted earlier."),
        ('14 de octubre de 2026',
         'Cobro del plan de los negocios: la región a efectos del IVA, las pausas por cierre y los avisos del cobro (qué guardamos, para qué y cuánto tiempo).',
         '14 October 2026',
         "Business plan billing: the VAT region, seasonal pauses and billing notices (what we keep, what for and for how long)."),
        ('14 de octubre de 2026',
         'Locales que pides y «Avísame cuando Klendar llegue» (qué guardamos, quién lo ve y cuánto tiempo), también en la ubicación, las notificaciones y «Descargar mis datos»; las condiciones que acepta un negocio y los avisos de sus cambios; la solicitud de cuenta de entidad (el documento, quién lo ve y cuánto se guarda).',
         '14 October 2026',
         "Places you ask for and “Tell me when Klendar arrives” (what we keep, who sees it and for how long), also in location, notifications and “Download my data”; the terms a business accepts and the notices of changes to them; the organisation account request (the document, who sees it and how long it is kept)."),
        ('13 de octubre de 2026',
         'Widget, pantalla de bloqueo y reloj (la copia de tus planes y tus códigos se queda en tu móvil y en tu reloj; Google la pasa a un reloj Wear OS); artistas que sigues y páginas de artistas; cola virtual; peticiones de grupo («Grupos y empresas»); sorteos; «Esta noche se mueve»; toques en los enlaces de la ficha; cupones, regalos y lo que has ahorrado (los cupones y regalos, 400 días); la lista mensual de habituales que ve un negocio; qué ve el negocio, «Descargar mis datos», las notificaciones y la cuenta de negocio, al día.',
         '13 October 2026',
         "Widget, lock screen and watch (the copy of your plans and codes stays on your phone and your watch; Google passes it to a Wear OS watch); artists you follow and artist pages; virtual queue; group requests (“Groups and companies”); giveaways; “Buzzing tonight”; taps on a business page's links; coupons, gifts and what you've saved (coupons and gifts, 400 days); the monthly list of regulars a business sees; what the business sees, “Download my data”, notifications and the business account, brought up to date."),
        ('7 de octubre de 2026',
         'Equipos que sigues y los avisos de sus partidos; bonos pagados en el local y el QR de cliente (qué ve el negocio y cuánto se guarda cada lectura), también en «Descargar mis datos» y en las notificaciones; las visitas contadas pueden llegar también desde la tele o el cartel de un local o desde el enlace de un RRPP; en la cuenta de negocio, la petición de ser entidad y qué hace cada persona del equipo.',
         '7 October 2026',
         "Teams you follow and notifications about their matches; passes paid for at the venue and the customer QR code (what the business sees and how long each reading is kept), also in “Download my data” and in notifications; counted visits can also come from a venue's TV or poster or from a promoter's link; in the business account, the request to be an organisation and what each team member does."),
        ('6 de octubre de 2026',
         'Importe del ticket: si el negocio apunta cuánto pagaste al validar tu código, qué guardamos, para qué, quién lo ve y cuánto tiempo.',
         '6 October 2026',
         'Receipt total: if the business enters how much you paid when validating your code, what we keep, what for, who sees it and for how long.'),
        ('6 de octubre de 2026',
         'Tus gustos y tu ciudad (y el aviso cuando estás de viaje); búsquedas recientes y «Lo más buscado», sin guardar quién buscó; tus planes en tu calendario con un enlace secreto; el estado de WhatsApp en «Compartir en historias»; «Quizá te interese» tiene en cuenta tus gustos; «Según el tiempo» se apaga en el menú de orden.',
         '6 October 2026',
         "Your interests and your city (and the notice when you're travelling); recent searches and “Most searched”, without storing who searched; your plans in your calendar through a secret link; WhatsApp status in “Share to stories”; “You might like” takes your interests into account; “Based on the weather” is turned off in the sort menu."),
        ('5 de octubre de 2026',
         'Series que sigues; «Según el tiempo» (MET Norway no recibe ningún dato tuyo); listas de RRPP y ser RRPP de un local; compartir en historias y las visitas que llegan desde ellas; la preferencia de traducción automática. La ubicación sirve también para el sello por visita con el QR del local y para el tiempo de tu zona, y en klendar.app «Cerca de mí» la pone en la dirección redondeada a unos 100 m. Qué ve el negocio (tu nombre y tu foto en su lista de asistentes), reservas, lista de espera y planes guardados, avisos de series y de la lista de espera, y el nombre es obligatorio al crear la cuenta.',
         '5 October 2026',
         "Series you follow; “Based on the weather” (MET Norway receives none of your data); promoter lists and being a venue promoter; sharing to stories and the visits that come from them; the automatic translation preference. Location is also used for the visit stamp with the venue's QR code and for the weather in your area, and on klendar.app “Near me” puts it in the address rounded to about 100 m. What the business sees (your name and photo on its attendee list), bookings, waiting list and saved plans, notifications about series and the waiting list, and your name is required to create an account."),
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
        ('16 de octubre de 2026',
         'Dar en el momento (apartado 3 sexies): un negocio puede darte sellos, un uso de tu bono o algo del momento con un QR suyo que tú escaneas y aceptas. El wifi que enseña la página del QR de mesa de un local es del local, no de Klendar (apartado 3). Informan de funciones nuevas y no recortan tus derechos, así que no hace falta volver a aceptarlos.',
         '16 October 2026',
         "Give on the spot (section 3e): a business can give you stamps, one use of your pass or something on the spot with a QR code of its own that you scan and accept. The Wi-Fi shown on a venue's table QR page belongs to the venue, not to Klendar (section 3). They describe new features and don't reduce your rights, so there's no need to accept them again."),
        ('15 de octubre de 2026',
         'Grupos y empresas (apartado 3 quater): el negocio que recibe tu petición puede denunciarla y, si la retiramos, se cierra para todos y te decimos el motivo y cómo pedir que lo revisemos. Sorteos de los negocios (apartado 3 quinquies): Klendar puede retirar un sorteo que incumpla las normas o la ley; no se sortea y, si participabas, lo ves como «Retirado» y te avisamos. Informan y no recortan tus derechos, así que no hace falta volver a aceptarlos.',
         '15 October 2026',
         "Groups and companies (section 3c): the business that receives your request can report it and, if we remove it, it is closed for everyone and we tell you the reason and how to ask for a review. Giveaways from businesses (section 3d): Klendar can remove a giveaway that breaks the guidelines or the law; it isn't drawn and, if you had entered, you see it as “Removed” and we let you know. They inform you and don't reduce your rights, so there's no need to accept them again."),
        ('14 de octubre de 2026',
         'Si un negocio deja de estar disponible (por ejemplo, porque no ha pagado o lo ha pausado por cierre), tus códigos, reservas, bonos, sellos y premios siguen valiendo (apartado 3). Es a tu favor, así que no hace falta volver a aceptarlos.',
         '14 October 2026',
         "If a business stops being available (for example, because it hasn't paid or has paused while closed), your codes, bookings, passes, stamps and rewards remain valid (section 3). It's in your favour, so there's no need to accept them again."),
        ('14 de octubre de 2026',
         'Pedir un local y «Avísame cuando llegue» (apartado 3): es una petición, no un compromiso. Informa de una función nueva y no recorta tus derechos, así que no hace falta volver a aceptarlos.',
         '14 October 2026',
         "Asking for a place and “Tell me when it arrives” (section 3): it's a request, not a commitment. It describes a new feature and doesn't reduce your rights, so there's no need to accept them again."),
        ('13 de octubre de 2026',
         'Eventos de organizadores sin local fijo (apartado 1); tu código en la pantalla de bloqueo, en el widget y en el reloj, «Esta noche se mueve» y cupones, regalos y lo que has ahorrado (apartado 3); apartados nuevos: cola virtual (3 ter), grupos y empresas (3 quater) y sorteos de los negocios (3 quinquies); los enlaces de la ficha a servicios de otros (apartado 7). Informan de funciones nuevas y no recortan tus derechos, así que no hace falta volver a aceptarlos.',
         '13 October 2026',
         "Events by organisers without a fixed venue (section 1); your code on the lock screen, in the widget and on your watch, “Buzzing tonight” and coupons, gifts and what you've saved (section 3); new sections: virtual queue (3b), groups and companies (3c) and giveaways from businesses (3d); links on a business page to other services (section 7). They describe new features and don't reduce your rights, so there's no need to accept them again."),
        ('7 de octubre de 2026',
         'Bonos de los negocios: los vende, los cobra y los cumple el negocio, y qué pasa si deja Klendar (apartado 3 bis); la agenda pública de los ayuntamientos y «Dónde ver el partido» (apartado 3). Informan de funciones nuevas y no recortan tus derechos, así que no hace falta volver a aceptarlos.',
         '7 October 2026',
         "Passes from businesses: the business sells them, takes payment and honours them, and what happens if it leaves Klendar (section 3a); councils' public listings and “Where to watch the match” (section 3). They describe new features and don't reduce your rights, so there's no need to accept them again."),
        ('6 de octubre de 2026',
         '«Escúchalo antes»: el enlace a un servicio de música se abre fuera de Klendar, con sus condiciones (apartado 3). Informa de una función nueva y no recorta tus derechos, así que no hace falta volver a aceptarlos.',
         '6 October 2026',
         "“Listen first”: the link to a music service opens outside Klendar, under its terms (section 3). It describes a new feature and doesn't reduce your rights, so there's no need to accept them again."),
        ('5 de octubre de 2026',
         'RRPP, series y «Según el tiempo» (apartado 3); las fotos y los vídeos de las reseñas y compartir fuera de Klendar (apartado 4). Informan de funciones nuevas y no recortan tus derechos, así que no hace falta volver a aceptarlos.',
         '5 October 2026',
         "Promoters, series and “Based on the weather” (section 3); photos and videos in reviews and sharing outside Klendar (section 4). They describe new features and don't reduce your rights, so there's no need to accept them again."),
        ('1 de octubre de 2026',
         'Se explica la moderación automática de los textos (apartado 4). No cambian tus derechos ni tus obligaciones, así que no hace falta volver a aceptarlos.',
         '1 October 2026',
         'Automatic moderation of text is explained (section 4). Your rights and obligations don\'t change, so there\'s no need to accept them again.'),
        _INICIO],
    'negocios': [
        ('16 de octubre de 2026',
         'Dar en el momento (apartado 3 septies nuevo): dar sellos, un uso de un bono o algo del momento con un QR del Negocio; darlo de verdad y solo a quien está en el local, sin usarlo para inflar reseñas o cifras; qué texto se puede poner y la edad con alcohol o tabaco; registro de quién lo da; qué se puede dar con el Negocio bloqueado o en pausa. Menú del día (apartado 3 octies nuevo): su precio no es una rebaja, se retira solo y «Todos los días» se mantiene al día. Wifi para clientes y QR de mesa (apartado 3 nonies nuevo). El horario de cocina tiene que ser el real (apartado 3). Se aplican desde el 31 de octubre de 2026.',
         '16 October 2026',
         "Give on the spot (new section 3f): giving stamps, one use of a pass or something on the spot with a QR code from the Business; giving it for real and only to people at the venue, without using it to inflate reviews or stats; what text can be entered and age with alcohol or tobacco; record of who gives it; what can be given while the Business is blocked or paused. Daily menu (new section 3g): its price isn't a discount, it is removed automatically and “Every day” must be kept up to date. Wi-Fi for customers and table QR (new section 3h). Kitchen hours must be accurate (section 3). They apply from 31 October 2026."),
        ('14 de octubre de 2026',
         'Pagos pendientes y bloqueo (apartado 4 bis nuevo): si se acaba la prueba, el «Gratis de lanzamiento» o lo pagado sin otro pago, o un impago pasa de 7 días, el Negocio queda bloqueado (no se borra nada y se puede seguir validando lo que ya tiene la gente); la prueba, el «Gratis de lanzamiento» con un mes de aviso, el IVA de Canarias, Ceuta y Melilla y el aviso de un mes solo para los cambios de precio (apartado 4); pausa por cierre, cancelar, traspasar y eliminar (apartado 5); el bloqueo se motiva en el aviso (apartado 6). Se aplican desde el 29 de octubre de 2026; la pausa por cierre, desde que se publica.',
         '14 October 2026',
         "Outstanding payments and blocking (new section 4a): if the trial, “Launch, free” or the paid period ends with no other payment, or a payment stays outstanding for more than 7 days, the Business is blocked (nothing is deleted and what people already have can still be validated); the trial, “Launch, free” with one month's notice, VAT in the Canary Islands, Ceuta and Melilla and one month's notice only for price changes (section 4); seasonal pause, cancelling, handing over and deleting (section 5); blocking is explained in the notice (section 6). They apply from 29 October 2026; the seasonal pause, from publication."),
        ('14 de octubre de 2026',
         'Cuentas de entidad: se piden con un documento y la entidad que se da de alta así no publica hasta que lo comprobamos (apartado 3 bis); con varios locales, el primero paga la cuota entera (apartado 4); cómo avisamos de los cambios y qué registramos (apartado 10). Se aplican desde el 29 de octubre de 2026.',
         '14 October 2026',
         "Organisation accounts: requested with a document, and an organisation that signs up this way cannot publish until we have checked it (section 3a); with several venues, the first one pays the full fee (section 4); how we notify changes and what we record (section 10). They apply from 29 October 2026."),
        ('13 de octubre de 2026',
         'Sin local fijo y «Quién actúa», alérgenos y dietas, enlaces y archivos de la carta, cupones y regalos, primera visita y habituales (apartado 3); cola virtual (apartado 3 quater nuevo); grupos y empresas (apartado 3 quinquies nuevo); sorteos (apartado 3 sexies nuevo). Se aplican desde el 28 de octubre de 2026.',
         '13 October 2026',
         "No fixed venue and “Who's performing”, allergens and diets, links and menu files, coupons and gifts, first visit and regulars (section 3); virtual queue (new section 3c); groups and companies (new section 3d); giveaways (new section 3e). They apply from 28 October 2026."),
        ('7 de octubre de 2026',
         'Lo importado de la agenda pública de los ayuntamientos sale como mucho uno de cada cinco (apartado 2 bis); «Poner en la tele» y «Lo ponemos» en los partidos (apartado 3); cuentas de entidad (apartado 3 bis nuevo); bonos (apartado 3 ter nuevo). Se aplican desde el 22 de octubre de 2026.',
         '7 October 2026',
         "Events imported from councils' public listings appear at most one in five (section 2a); “Show on TV” and “We're showing it” for matches (section 3); organisation accounts (new section 3a); passes (new section 3b). They apply from 22 October 2026."),
        ('6 de octubre de 2026',
         'Los gustos de la persona pesan dentro del orden que elige (apartado 2 bis); comprobar el carné de estudiante, el carné joven o ser mayor de 65 es cosa del Negocio (apartado 3). Se aplican desde el 21 de octubre de 2026.',
         '6 October 2026',
         "The person's interests weigh within the order they choose (section 2a); checking a student card, a youth card or being over 65 is up to the Business (section 3). They apply from 21 October 2026."),
        ('5 de octubre de 2026',
         'Cómo se ordena lo que se ve (apartado 2 bis, Reglamento (UE) 2019/1150); servicio al día con series, RRPP, «Cómo es tu local» e historias (apartado 2); obligaciones sobre «Cómo es tu local», RRPP y series (apartado 3); licencia para las imágenes de historias (apartado 7); cómo se avisan los cambios (apartado 10). Se aplican desde el 20 de octubre de 2026.',
         '5 October 2026',
         'How what people see is ordered (section 2a, Regulation (EU) 2019/1150); service brought up to date with series, promoters, “About your place” and stories (section 2); obligations on “About your place”, promoters and series (section 3); licence for stories images (section 7); how changes are notified (section 10). They apply from 20 October 2026.'),
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
        ('16 de octubre de 2026',
         'Las estadísticas de visitas tampoco se usan en la página del QR de mesa de un local (/m/).',
         '16 October 2026',
         "Visit statistics aren't used on a venue's table QR page (/m/) either."),
        ('14 de octubre de 2026',
         'La clave que recuerda el botón que acabas de pulsar se usa también en Descubre y Explorar (para «Pedir un local» y «Avísame cuando llegue»).',
         '14 October 2026',
         'The key that remembers the button you just pressed is also used in Discover and Explore (for “Ask for a place” and “Tell me when it arrives”).'),
        ('14 de octubre de 2026',
         'Dos claves más de la administración: recuerdan si dejaste abiertos el grupo «Sistema» del menú y «Más» del resumen.',
         '14 October 2026',
         'Two more admin keys: they remember whether you left the “System” menu group and “More” in the summary open.'),
        ('13 de octubre de 2026',
         'Una clave más: los negocios que eliges en «Grupos y empresas» para pedirles presupuesto (hasta cerrar la pestaña); el idioma que guardan «Tu cuenta» y el panel puede ser también catalán, gallego, euskera, francés, alemán o italiano.',
         '13 October 2026',
         "One more key: the places you pick in “Groups and companies” to ask them for a quote (until you close the tab); the language saved by “Your account” and the dashboard can also be Catalan, Galician, Basque, French, German or Italian."),
        ('7 de octubre de 2026',
         'Dos claves de Klendar en la tele, que guarda el navegador de la tele del local (no el tuyo): la llave que la une al local y lo último que enseñó; esa página no cuenta visitas.',
         '7 October 2026',
         "Two keys for Klendar on the TV, stored by the browser of the venue's TV (not yours): the key that links it to the venue and what it last showed; that page doesn't count visits."),
        ('6 de octubre de 2026',
         'Cuatro claves más: tus gustos y tu ciudad, tus búsquedas recientes, la fecha en que cerraste el aviso de viaje y la lista de ciudades; tus gustos también se borran al cerrar sesión.',
         '6 October 2026',
         'Four more keys: your interests and your city, your recent searches, the date you closed the travel notice and the list of cities; your interests are also deleted when you log out.'),
        ('5 de octubre de 2026', 'Siete claves más: tus filtros, tu posición de «Cerca de mí» (se borra a las 6 horas), el sonido de los vídeos, la traducción, la copia de tus códigos y la vista del panel; dónde no se cuentan visitas y qué se borra al cerrar sesión.',
         '5 October 2026', 'Seven more keys: your filters, your “Near me” position (deleted after 6 hours), video sound, translation, the copy of your codes and the dashboard view; where visits aren\'t counted and what is deleted when you log out.'),
        ('1 de octubre de 2026', 'Inventario al día de lo que se guarda en el navegador (también la sesión aparte de la administración y la comprobación PKCE al entrar con Google o Apple) y de los servicios de terceros; los iconos y las librerías ya se sirven desde klendar.app, sin Google Fonts ni jsDelivr.',
         '1 October 2026', 'Up-to-date list of what is stored in your browser (including the separate admin session and the PKCE check when logging in with Google or Apple) and of third-party services; icons and libraries are now served from klendar.app, without Google Fonts or jsDelivr.'),
        _INICIO],
    'normas': [
        ('16 de octubre de 2026',
         '«Cliente verificado» cuenta también lo recibido con «Dar en el momento».',
         '16 October 2026',
         '“Verified customer” also counts what was received with “Give on the spot”.'),
        ('15 de octubre de 2026',
         'Cómo denunciar: un negocio también puede denunciar una petición de «Grupos y empresas» que reciba.',
         '15 October 2026',
         'How to report: a business can also report a “Groups and companies” request it receives.'),
        ('13 de octubre de 2026',
         'Para todo el mundo: en la cola virtual, un número solo para ti y los tuyos. Para negocios: en «Quién actúa», solo artistas de verdad; nada de sorteos engañosos; en «Grupos y empresas», solo lo que puedes cumplir; cupones y regalos sin tabaco ni apuestas.',
         '13 October 2026',
         "For everyone: in a virtual queue, a number only for you and your group. For businesses: in “Who's performing”, only real artists; no misleading giveaways; in “Groups and companies”, only what you can deliver; coupons and gifts without tobacco or gambling."),
        ('7 de octubre de 2026',
         'Para negocios: una entidad publica actividades para el público, no propaganda electoral ni de partido; en «Partidos que pones», solo lo que vas a poner de verdad.',
         '7 October 2026',
         "For businesses: an organisation publishes activities for the public, not electoral or party propaganda; in “Matches you're showing”, only what you're really going to show."),
        ('6 de octubre de 2026',
         'Para negocios: en «Antes de cerrar», solo comida en buen estado y que se pueda comer ese día o el siguiente, nunca caducada.',
         '6 October 2026',
         'For businesses: in “Before closing”, only food in good condition that is fine to eat that day or the next, never past its use-by date.'),
        ('6 de octubre de 2026',
         'Para negocios: «Solidario» solo si es benéfico, «¿Hay sitio ahora?» al momento y el carné lo comprueba el negocio en la puerta.',
         '6 October 2026',
         'For businesses: “Charity” only if it is for charity, “Room right now?” kept up to date and ID is checked by the business at the door.'),
        ('5 de octubre de 2026',
         'Fotos y vídeos (personas y menores reconocibles), RRPP, «Cómo es tu local» y los nombres de las series.',
         '5 October 2026',
         'Photos and videos (recognisable people and minors), promoters, “About your place” and series names.'),
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
    'soporte': [
        ('5 de octubre de 2026', 'Dos preguntas nuevas: qué ve de ti un RRPP y cómo dejar de seguir una serie.',
         '5 October 2026', 'Two new questions: what a promoter sees about you and how to unfollow a series.'),
    ],
    'eliminar-cuenta': [
        ('16 de octubre de 2026',
         'Lista al día: lo que te han dado en el momento (el negocio conserva solo la cifra, sin tu nombre).',
         '16 October 2026',
         "Up-to-date list: what you've been given on the spot (the business only keeps the count, without your name)."),
        ('14 de octubre de 2026',
         'Lista al día: los locales que has pedido y tus avisos de «Avísame cuando Klendar llegue» (también los apuntados sin cuenta con el mismo correo).',
         '14 October 2026',
         "Up-to-date list: the places you've asked for and your “Tell me when Klendar arrives” sign-ups (including any made without an account with the same email)."),
        ('13 de octubre de 2026',
         'Lista al día: los artistas que sigues, tu turno en una cola, tus peticiones de grupo, tus participaciones en sorteos y tus cupones y regalos.',
         '13 October 2026',
         'Up-to-date list: the artists you follow, your turn in a queue, your group requests, your giveaway entries and your coupons and gifts.'),
        ('7 de octubre de 2026',
         'Lista al día: tus bonos y su historial (si te quedan usos, gástalos antes) y los equipos que sigues.',
         '7 October 2026',
         'Up-to-date list: your passes and their history (if you have uses left, use them first) and the teams you follow.'),
        ('6 de octubre de 2026',
         'Lista al día: tus gustos y tu ciudad, y el enlace de tu calendario, que deja de funcionar.',
         '6 October 2026',
         'Up-to-date list: your interests and your city, and your calendar link, which stops working.'),
        ('5 de octubre de 2026', 'Lista al día: las series que sigues, la preferencia de traducción, tu lugar en las listas de espera, con qué RRPP fuiste y qué pasa si eres RRPP de un local.',
         '5 October 2026', "Up-to-date list: the series you follow, the translation preference, your place on waiting lists, which promoter you went with and what happens if you're a venue promoter."),
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
    return f'\n<h2 class="cambios" id="historial">{CAMBIOS_TITULO[lang]}</h2>\n<ul>{items}\n</ul>\n'


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
<tr><td>Ubicación</td><td>Coordenadas aproximadas o precisas del dispositivo (según el permiso que concedas) o la ciudad que elijas manualmente</td><td>Ordenar el feed y el mapa por cercanía; "ofertas cerca de ti" si activas esa opción; comprobar que estás en el local cuando escaneas su QR para conseguir un sello por visita (se compara con la dirección del local y no se guarda); ordenar lo de hoy según el tiempo de tu zona (ver «Según el tiempo»); y, de forma agregada y sin identificar a nadie, las cifras de distancia del «Informe» de cada negocio (desde qué distancia llega su clientela). Si has elegido tu ciudad, comparar en el momento dónde estás con ella para avisarte de lo mejor de hoy cuando estás de viaje (a más de 50 km); no guardamos dónde estabas, solo la fecha en que cerraste el aviso. En klendar.app, al pulsar «Cerca de mí» o «Usar mi ubicación», tu navegador guarda tu posición 6 horas para enseñarte las distancias y la manda, redondeada a unos 100 m, en la dirección de la página que pides (no la guardamos ni pasa por el contador de visitas). Si en tu zona aún no hay Klendar, lo comprobamos en el momento con tu posición (sin guardarla) y, si pides que te avisemos, guardamos solo la zona redondeada (ver «Avísame cuando Klendar llegue»). Para poner nombre a esa zona, la app y la web preguntan a Mapbox por el nombre de la localidad con el punto redondeado</td><td>Consentimiento (art. 6.1.a), revocable en los ajustes del dispositivo y de la app</td><td>No se guarda un historial. Solo se conserva la última ubicación conocida (para "cerca de ti") y se descarta a los 7 días. En la web, tu navegador la borra a las 6 horas</td></tr>
<tr><td>Esta noche se mueve (zonas con ambiente en el mapa)</td><td>Ningún dato nuevo: cada 5 minutos contamos, por zonas de unos 300 m, cuántas <strong>personas distintas</strong> han canjeado algo, sellado una visita o enseñado su QR de cliente en un negocio en las últimas 2 horas. Solo guardamos la zona y un nivel (algo, bastante o mucho ambiente)</td><td>Enseñar en el mapa dónde hay ambiente ahora</td><td>Interés legítimo (art. 6.1.f RGPD) en ofrecer la función, con estas garantías: solo zonas con <strong>10 personas distintas o más</strong>, nunca un número, un nombre ni un negocio, el punto es el centro de la zona y no el del local, y se rehace entera cada 5 minutos</td><td>Las zonas, hasta el siguiente cálculo (5 minutos). Los canjes, sellos y lecturas de QR con los que se calcula ya tienen su propia fila y sus plazos</td></tr>
<tr><td>Según el tiempo</td><td>Una zona de unos 10 km alrededor de donde miras (tu posición o la ciudad elegida, redondeada a 0,1°), nunca tu posición exacta</td><td>Si hoy llueve, enseñar primero los planes bajo techo; si hace buen tiempo, las terrazas y el aire libre. No quita nada, solo ordena lo de hoy. Pedimos la previsión desde nuestro servidor a MET Norway (el instituto meteorológico de Noruega, en el Espacio Económico Europeo) solo con el centro de esa zona: no recibe tu dirección IP, tu cuenta ni tu posición. Se apaga en el menú de orden («Ordenar por») → «Según el tiempo»</td><td>Interés legítimo (art. 6.1.f RGPD) en ordenar lo que ves de forma útil; tu posición, con el consentimiento de ubicación que ya diste</td><td>No guardamos nada tuyo: la previsión de cada zona, como mucho 2 días</td></tr>
<tr><td>Favoritos, reseñas, canjes y sellos</td><td>Negocios guardados en favoritos, publicaciones guardadas en tus planes, valoraciones y comentarios, códigos de canje y reservas de plaza (con cuántas plazas) y su estado y, si el negocio lo apunta, el importe del ticket (ver «Importe del ticket»), tu lugar en la lista de espera y los avisos que te hemos mandado de ella, vistas de ofertas, tarjetas de sellos (sellos, premios y sus códigos)</td><td>Prestar el servicio: tus favoritos, tus reseñas públicas, el historial de canjes, las tarjetas de sellos de los negocios y estadísticas agregadas para los negocios. Si el negocio tiene activado «Agradecer a los habituales», una vez al mes ve a sus 10 clientes que más han ido el mes anterior: el nombre visible y cuántas visitas y canjes tuvieron en su local. Son datos que ya ve al validar, contados; nunca tu correo, tu teléfono ni tu fecha de nacimiento. Lo usa para mandarte, si quiere, un regalo con un mensaje. Las ofertas «solo para la primera visita» se comprueban en Klendar: el negocio solo sabe que no has podido sacar ese código</td><td>Ejecución del contrato; la lista mensual de habituales, interés legítimo (art. 6.1.f RGPD) del negocio y de Klendar en agradecer a sus clientes, con datos que el negocio ya tiene</td><td>Mientras exista la cuenta. Las reseñas se muestran con tu nombre mostrado y, si has canjeado algo en ese negocio con Klendar, con la etiqueta «Cliente verificado» (sin decir qué ni cuándo)</td></tr>
<tr><td>Importe del ticket</td><td>Si el negocio lo apunta al validar tu código (o en las 24 horas siguientes): cuánto pagaste en total en esa visita, en euros (solo el total; nunca qué compraste ni cómo pagaste), unido a ese canje</td><td>Que el negocio sepa cuánto le ha traído Klendar («Cuánto te ha traído Klendar», «al menos X €») y que tú lo veas en «Descargar mis datos». Si no lo apunta, se usa el precio de la oferta</td><td>Interés legítimo (art. 6.1.f RGPD) del negocio y de Klendar en medir lo que aporta el servicio; es opcional para el negocio, es solo un total y no se usa para nada más (ni para enseñarte cosas ni para perfiles)</td><td>Mientras exista tu cuenta, con el canje. El negocio ve el importe con tu nombre solo en «Últimos validados» (24 horas, para corregirlo); después, en sus cifras, sin tu nombre. Si eliminas la cuenta, el canje validado se queda en las cifras del negocio sin nadie detrás («Cuenta eliminada»)</td></tr>
<tr><td>Bonos y QR de cliente</td><td>Los bonos que compras en un negocio (nombre, usos, precio que puso el negocio, lo que incluye, caducidad y condiciones), cada uso (cuándo, si fue a mano y si se deshizo) y quién del equipo del negocio cargó el bono o descontó cada uso; la clave de tu QR de cliente; cada vez que un negocio lee tu QR (qué negocio y cuándo)</td><td>Llevar la cuenta de tus bonos, enseñártelos y avisarte cuando te quedan pocos usos o van a caducar; evitar fraudes (un QR que cambia cada 30 segundos, límites de usos por minuto, registro de quién hizo cada cosa). <strong>Qué ve el negocio:</strong> al leer tu QR, tu nombre visible, tu foto y tus bonos <strong>de ese negocio</strong>, nada más (ni tu correo, ni tu teléfono, ni tus bonos de otros sitios). Propietario y encargado ven también la lista de bonos vendidos con esos datos y cada uso</td><td>Ejecución del contrato (art. 6.1.b RGPD); la prevención del fraude, interés legítimo (art. 6.1.f)</td><td>Los bonos y sus usos, mientras tengas la cuenta (si la eliminas, se borran; el negocio solo conserva lo que haya descargado antes). Cada lectura de tu QR, 30 días. La clave del QR se guarda también en tu móvil, en el almacenamiento seguro de la app; en la web solo mientras tienes la página abierta</td></tr>
<tr><td>Dar en el momento</td><td>Lo que te ha dado un negocio con un QR suyo (qué: sellos, un uso de tu bono o el texto de «algo del momento»; de qué negocio; cuándo y en qué día; quién del equipo abrió el QR); que has escaneado un QR y aún no lo has aceptado; del lado del negocio, el QR (una clave, un secreto, quién lo abrió y cuándo se cerró)</td><td>Darte lo que aceptas, enseñártelo en «Tus códigos», en tus tarjetas de sellos o en tu bono, y que el negocio vea en el momento que lo has recibido; evitar fraudes (un QR que cambia cada 30 segundos, una vez por persona y QR, 5 al día por negocio, registro de quién lo dio); contarlo en las cifras del negocio como visita y en «Cliente verificado». <strong>Qué ve el negocio:</strong> en el momento, tu nombre visible («Lucía lo ha recibido»); después, en «Últimos validados», «Canjes validados» y su descarga de datos, tu nombre visible, qué te dio, cuándo y quién de su equipo. Nada más (ni tu correo, ni tu teléfono, ni lo que recibes en otros sitios). Un empleado no ve quién de sus compañeros lo dio</td><td>Ejecución del contrato (art. 6.1.b RGPD), que pides al pulsar «Aceptar»; la prevención del fraude y las cifras del negocio, interés legítimo (art. 6.1.f)</td><td>Lo que te dieron, 400 días; después se queda en las cifras del negocio sin tu nombre. Que has escaneado sin aceptar, 1 día. El QR del negocio, 30 días después de cerrarse. Si eliminas la cuenta, lo que te dieron deja de estar unido a ti (el negocio conserva solo la cifra)</td></tr>
<tr><td>Cola virtual</td><td>Si coges número en la cola de un local: el número, cuántos sois, cuándo te apuntaste, cuándo te avisaron y hasta cuándo tenías para presentarte, y cómo acabó (atendido, no vino, te saliste o te quitó el local). Si el equipo del local apunta a alguien que no tiene la app, solo el nombre que escribe. Para frenar abusos, cuántas veces lo intentas por minuto (por cuenta y por conexión; la conexión, con una huella que no guarda tu IP)</td><td>Darte tu turno, decirte cuántos tienes delante y una espera aproximada (con el ritmo al que avisa el local), avisarte cuando te toca y llevar la cola del local; evitar abusos (una entrada por persona y cola, topes por minuto). <strong>Qué ve el local:</strong> tu nombre visible, tu foto, tu número, cuántos sois y en qué estado está tu turno. Nada más (ni tu correo ni tu teléfono)</td><td>Ejecución del contrato (art. 6.1.b RGPD); los topes contra abusos, interés legítimo (art. 6.1.f)</td><td><strong>Todo se borra al acabar el día</strong> (a las 6:00 hora del local) o cuando el local termina la cola, lo que antes pase. Los intentos por conexión, a las 24 horas. Los avisos que te llegaron se quedan en tus Notificaciones como el resto</td></tr>
<tr><td>Peticiones de grupo (Grupos y empresas)</td><td>Lo que pides (para qué, fecha, número de personas, presupuesto aproximado por persona y nota), a qué negocios (como mucho 3), lo que contesta cada uno (propuesta, precio orientativo, condiciones o que no puede) y, si aceptas una propuesta, el contacto que eliges compartir con ese negocio: el correo de tu cuenta o el teléfono que escribas</td><td>Hacer llegar tu petición a los negocios que eliges, enseñarte sus respuestas, avisarte y, cuando aceptas una, darle tu contacto a ese negocio para que cierre contigo la reserva; evitar abusos (3 peticiones cada 24 horas). <strong>Qué ve el negocio:</strong> lo que pides, sin tu nombre ni tu contacto, hasta que aceptas su propuesta; entonces, tu nombre visible y el contacto que hayas elegido, <strong>solo ese negocio</strong>. Los demás negocios a los que lo pediste solo saben que has elegido otra propuesta. Desde ese momento, el negocio es responsable de lo que haga con tu contacto (lo usa para cerrar contigo el plan)</td><td>Ejecución del contrato (art. 6.1.b RGPD): lo pides tú; compartir el contacto, a petición tuya al aceptar</td><td>El contacto compartido, hasta 30 días después de la fecha del plan (después se borra de Klendar; el negocio conserva lo que haya apuntado por su cuenta). La petición y las respuestas, 12 meses después de la fecha. Si un negocio denuncia tu petición, guardamos una copia de lo denunciado con la denuncia hasta 2 años desde que se cierra (obligación legal, Reglamento (UE) 2022/2065), aunque la petición se borre antes</td></tr>
<tr><td>Sorteos</td><td>Que participas en un sorteo, tu número de participación, cuándo entraste o lo dejaste, si ya tenías el negocio en favoritos y, si ganas, tu premio (si lo aceptas, cuándo y si te lo han entregado). Para comprobar la edad usamos la fecha de nacimiento de tu perfil</td><td>Gestionar tu participación, comprobar que cumples los requisitos (18 años, no ser del equipo del negocio, tenerlo en favoritos si lo pide), hacer el sorteo de forma verificable, avisarte del resultado y que el organizador te entregue el premio. <strong>Quién organiza:</strong> el negocio que hace el sorteo, que es el <strong>responsable del sorteo</strong> y de la entrega del premio (sus datos están en las bases); Klendar trata tus datos para gestionar el sorteo en la app. <strong>Qué ve el organizador:</strong> cuántas personas participan y cuántas son favoritos nuevos; de quien gana, su nombre visible y su foto (y, si el premio pasa de 300 €, los datos fiscales que esa persona le dé, para cumplir con Hacienda). Nadie más ve quién participa</td><td>Ejecución del contrato (art. 6.1.b RGPD): participas tú, con las bases del sorteo</td><td>Las participaciones, 6 meses después del sorteo; los datos de quien gana, 12 meses. El número, la semilla y los números que salieron se quedan (sin datos de nadie: son la prueba del sorteo)</td></tr>
<tr><td>Cupones, regalos y lo que has ahorrado</td><td>Los cupones para la próxima visita y los regalos de agradecimiento que te dan los negocios: qué es, de qué negocio, el mensaje, cuándo llegó, desde y hasta cuándo vale y si se usó. «Lo que has ahorrado» es una cuenta hecha con tus canjes validados (precio de antes − lo que pagaste)</td><td>Dártelos y que el negocio los valide; enseñarte en «Tu cuenta» lo que has ahorrado</td><td>Ejecución del contrato (art. 6.1.b RGPD)</td><td>Los cupones y regalos, 400 días desde que te llegan (es lo que ves en la app). Después, y también si eliminas antes la cuenta, los que no usaste se borran y los ya usados se quedan en las cifras del negocio sin tu nombre, como los canjes. «Lo que has ahorrado» no se guarda: se calcula cada vez que lo abres</td></tr>
<tr><td>Listas de RRPP</td><td>Si entras por el enlace o el QR de un RRPP (relaciones públicas) de un local: con qué RRPP y qué noche (de 6:00 a 6:00, hora del local), la oferta que consigues, las plazas, cuándo te apuntaste y si has entrado y a qué hora</td><td>Apuntarte a la lista de ese RRPP, darte las ofertas de su lista (con sus plazas y su hora límite) y que el local sepa quién viene con cada RRPP. Antes de conseguir nada te avisamos: «Te apuntas a la lista de Marta (Sala X). Marta verá tu nombre y si has entrado.». El RRPP ve tu nombre mostrado y tu foto, cuándo te apuntaste, qué oferta, cuántas plazas y si has entrado y a qué hora; <strong>nunca</strong> tu correo, tu teléfono ni tu fecha de nacimiento. El local ve lo mismo en su panel y lo puede descargar. Si no entras por un enlace, no cuentas para ningún RRPP</td><td>Ejecución del contrato (eliges entrar por ese enlace y conseguir la oferta, después del aviso)</td><td>Con qué RRPP vas esa noche, 7 días. Con qué RRPP se consiguió cada código, mientras exista el canje (si eliminas la cuenta, se anonimiza)</td></tr>
<tr><td>Ser RRPP de un local</td><td>La invitación (el correo al que te invitó el local y cuándo caduca), si la aceptas, tu estado (activo, en pausa), tus enlaces y QR (nombre, caducidad, pausa y cuántas veces se han abierto, sin saber quién), las ofertas y plazas que te asigna el local y tus cifras (apuntados, han entrado, conversión, por noche)</td><td>Que puedas ser RRPP de uno o varios locales con tu cuenta de Klendar, darte tu enlace y tu lista, y que el local vea tus cifras. El local ve tu nombre mostrado y tu foto, tu estado, tus enlaces y tus cifras; no puede editar tu cuenta ni tú nada del local. No formas parte de su equipo</td><td>Ejecución del contrato (aceptas la invitación); hace falta tener 16 años (18 si el local es +18)</td><td>Mientras seas RRPP de ese local. Si el local te quita o lo dejas, desaparecen tus enlaces; el correo de una invitación que no aceptas se borra al caducar (14 días). Las cifras pasadas del local quedan sin tus datos de contacto</td></tr>
<tr><td>Fotos y vídeos en las reseñas</td><td>Las fotos y los vídeos que añades a una reseña (hasta 6), con su orden, tamaño y duración</td><td>Publicarlos junto a tu reseña, en la app y en klendar.app, con tu nombre visible y tu foto de perfil. Antes de subirlos quitamos los datos que llevan dentro: en las fotos, la ubicación, la fecha y el modelo del móvil (EXIF); en los vídeos, la ubicación y el modelo del móvil. Lo que se ve en la imagen o se oye en el vídeo sí se publica, así que no incluyas a otras personas sin su permiso. Una reseña que va a revisión por su texto no se publica, con sus fotos y vídeos, hasta que la revisa una persona de Klendar. Cualquiera puede denunciar una foto o un vídeo; si incumple las Normas de la comunidad lo retiramos y te avisamos del motivo. Más adelante podremos analizar automáticamente las fotos y los vídeos (Google Cloud Vision) para detectar desnudos o violencia antes de publicarlos; te avisaremos antes de activarlo</td><td>Ejecución del contrato (publicar lo que tú decides publicar); obligación legal para las denuncias (Reglamento (UE) 2022/2065)</td><td>Hasta que los quites, borres la reseña o elimines tu cuenta; los ficheros desaparecen de nuestros servidores en unos días. Si alguien los ha denunciado, guardamos una copia como prueba mientras dure la denuncia y el plazo para reclamar</td></tr>
<tr><td>Amigos y planes</td><td>Tu enlace de amigo (y su QR), tus amigos y desde cuándo lo sois, las publicaciones a las que marcas «Voy», las invitaciones que mandas y recibes (y lo que contestas), tus opciones «Que mis amigos vean mis planes» y «Mostrar los planes a los que he ido con cada amigo» y las personas que bloqueas</td><td>Que puedas hacerte amigo de quien tenga tu enlace, ver a qué planes van tus amigos, invitarles y que ellos vean a qué vas tú. Si tienes encendido «Que mis amigos vean mis planes», tus amigos ven a qué publicaciones próximas vas (porque has marcado «Voy», tienes una plaza reservada o un código): en cada publicación, en tu ficha de amigo y, si lo han pedido, en una notificación. Lo que ya ha pasado no aparece en tu ficha, con una sola excepción: en la ficha de cada amigo puede salir «Habéis ido juntos a N planes», el número de publicaciones en las que cada uno de los dos ha validado un canje; solo lo ve ese amigo, no dice cuáles ni cuándo y no se guarda aparte (se calcula en el momento a partir de los canjes que ya conservamos). Sale solo si las dos opciones están encendidas en las dos cuentas; si cualquiera de los dos lo apaga, deja de verse para ambos. Nunca se muestra con personas bloqueadas ni con cuentas suspendidas, y al eliminar tu cuenta tus canjes se anonimizan y dejan de contar. Las personas que bloqueas no pueden ser tus amigas ni invitarte (no se les avisa). No hay buscador de personas: solo te encuentra quien tiene tu enlace o tu QR</td><td>Ejecución del contrato. Que tus amigos vean tus planes y los planes a los que habéis ido juntos se apaga en Ajustes → Privacidad; las invitaciones y los avisos de planes de tus amigos, en Ajustes → Notificaciones</td><td>Mientras exista la cuenta. Si quitas a alguien de tus amigos, deja de ver tus planes al momento (no le avisamos)</td></tr>
<tr><td>Series que sigues</td><td>Las series que sigues («Micro abierto de los jueves»), desde cuándo, si has pedido «Añadir cada fecha a mis planes» y qué fechas te hemos avisado ya</td><td>Avisarte de cada fecha nueva de una serie que sigues (una notificación por fecha, y ninguna si ya te ha llegado otra de esa publicación), guardarla en tus planes si lo pides y decirte si el negocio la termina o la cancela. Solo te avisamos de lo que puedes ver (+18, exclusivas) y nunca si has bloqueado a quien lleva el negocio. El negocio solo ve cuántas personas siguen cada serie, nunca quiénes</td><td>Ejecución del contrato (lo pides tú al pulsar «Seguir la serie»); las notificaciones, con el permiso de notificaciones (se apagan en Ajustes → Notificaciones → «Series que sigues»)</td><td>Hasta que dejes de seguirla, el negocio la termine o la cancele, o elimines la cuenta; el registro de fechas avisadas, lo mismo</td></tr>
<tr><td>Equipos que sigues</td><td>Los equipos o participantes que sigues («Real Madrid», «Fernando Alonso»), desde cuándo, de qué partidos te hemos avisado ya y, mientras sigas alguno, la zona de tus filtros (la distancia y, si la eliges, la ciudad)</td><td>Avisarte unas horas antes de un partido de tu equipo con los bares de tu zona que lo ponen (como mucho dos avisos al día, uno por partido y nunca si con tus horas de silencio llegaría con el partido empezado). Para saber qué bares están en tu zona usamos la distancia de tus filtros alrededor de la ciudad que hayas elegido o, si no, de tu última ubicación (de los últimos 30 días) o tu ciudad; si no hay ninguna, no te avisamos. Los bares no saben quién sigue a qué equipo</td><td>Ejecución del contrato (lo pides tú al pulsar «Seguir a…»); las notificaciones, con el permiso de notificaciones (se apagan en Ajustes → Notificaciones → «Partidos de tus equipos»); la ubicación, con el consentimiento de ubicación que ya diste</td><td>Hasta que dejes de seguirlo o elimines la cuenta (la zona, hasta que dejes de seguir a todos); el registro de avisos, 30 días</td></tr>
<tr><td>Artistas que sigues</td><td>Si pulsas «Seguir» en la página de un artista: que lo sigues y desde cuándo, y los avisos que te hemos mandado sobre sus fechas; para saber qué fechas están cerca, la misma zona que la de «Equipos que sigues» (la distancia de tus filtros y la ciudad elegida o tu última ubicación)</td><td>Avisarte cuando tiene una fecha nueva cerca (como mucho dos avisos al día, y nunca de lo que no puedes ver: +18, exclusivas). <strong>Es privado:</strong> ni el artista, ni los negocios, ni nadie más ve que lo sigues; solo el equipo de Klendar ve cuántas personas siguen a cada artista, sin nombres; los negocios, ni eso</td><td>Ejecución del contrato (art. 6.1.b RGPD): lo pides tú al seguirlo; las notificaciones, con el permiso de notificaciones (se apagan en Ajustes → Notificaciones → «Artistas que sigues»)</td><td>Hasta que lo dejes de seguir (Cuenta → Artistas que sigues) o elimines la cuenta; los avisos mandados, 120 días. Cuando ya no sigues ningún artista ni equipo, borramos tu zona</td></tr>
<tr><td>Locales que pides</td><td>El nombre del sitio que pides, la ciudad o zona que escribes y, si los pones, la dirección aproximada del local o el punto del mapa que marques; la fecha; si el local llega a Klendar, cuándo te avisamos</td><td>Juntar tu petición con las de otras personas que piden el mismo sitio (por el nombre y la zona), para saber qué locales quiere la gente y proponérselo a esos negocios; decirte si ese sitio ya está en Klendar; y avisarte cuando llegue (como mucho dos avisos de este tipo al día; se apaga en Ajustes → Notificaciones → «Locales que has pedido»). Para evitar abusos, como mucho 5 peticiones al día y 30 abiertas a la vez, y no se admiten textos ofensivos. <strong>Nadie ve quién lo ha pedido</strong>: el equipo de Klendar ve el sitio, cuántas personas lo piden y con qué nombres, direcciones y zonas lo escribieron; al negocio solo le contamos el número («X personas han pedido verte en Klendar»), nunca quiénes</td><td>Ejecución del contrato (art. 6.1.b RGPD): lo pides tú; el aviso, con el permiso de notificaciones</td><td>Hasta que la retires (en «Lo que has pedido») o elimines la cuenta; si el local llega y te avisamos, o la descartamos, 90 días más; si no llega, 24 meses. En los sitios que llegan a Klendar o descartamos, se queda solo el número de personas que lo pidieron, sin datos de nadie</td></tr>
<tr><td>Avísame cuando Klendar llegue</td><td>La zona en la que lo pides: el nombre de la localidad y un punto redondeado a unos 10 km (nunca tu posición exacta); tu idioma; tu cuenta o, si no tienes cuenta, tu correo; cuándo te apuntaste, cuándo lo confirmaste y cuándo te avisamos. Para confirmar y para borrarte, enlaces de un solo uso, que no guardamos: solo un resumen (hash)</td><td>Avisarte <strong>una sola vez</strong>, cuando Klendar llegue a tu zona: por correo y, si tienes cuenta, también con una notificación; y saber, contando cuántas personas lo piden en cada zona, a qué ciudades ir antes (el equipo de Klendar solo ve cuántas personas por zona). Sin cuenta, antes te mandamos un correo para que confirmes que la dirección es tuya (<strong>doble confirmación</strong>): hasta que no lo confirmas no te apuntamos. Para evitar abusos, sin cuenta pasa antes, cuando está activada, la comprobación anti-robots de Cloudflare Turnstile (como las denuncias sin cuenta) y hay un tope de peticiones por conexión, calculado sin guardar la dirección IP</td><td>Consentimiento (art. 6.1.a RGPD), que das al pulsar «Avísame cuando llegue» y, sin cuenta, al confirmar en el correo. Lo retiras cuando quieras con el enlace del correo de confirmación o, con cuenta, en «Lo que has pedido»</td><td>Sin confirmar, 7 días. Una vez avisado, 30 días. Si Klendar no llega, 24 meses. Al eliminar la cuenta se borra, también lo que hubieras apuntado sin cuenta con el mismo correo</td></tr>
<tr><td>Tus planes en tu calendario</td><td>Si lo activas (Ajustes → «Tus planes en tu calendario», en la app o en «Tu cuenta»): un enlace secreto y aleatorio y cuándo lo consultó tu calendario por última vez. Por ese enlace tu calendario (Google Calendar, Apple, Outlook…) recibe lo que tienes en Planes: título, día y hora, lugar y enlace de los eventos a los que vas, tus reservas (y cuántas plazas), los códigos con hora y las fechas que añaden las series que sigues</td><td>Que tus planes salgan en tu calendario y se actualicen solos</td><td>Ejecución del contrato (art. 6.1.b): es una función que pides tú</td><td>Hasta que lo desactivas, lo cambias (el enlace de antes deja de funcionar al momento) o eliminas tu cuenta. Lo que tu calendario guarde lo trata quien te da ese calendario (por ejemplo Google o Apple) con sus propias condiciones. <strong>Quien tenga el enlace ve esos planes</strong>: no lo compartas; si se te escapa, cámbialo</td></tr>
<tr><td>Notificaciones push</td><td>Token del dispositivo, preferencias (favoritos, cercanía, mensajes de tus favoritos, invitaciones y planes de tus amigos, series que sigues, partidos de tus equipos, artistas que sigues, tus bonos, sellos y premios, cupones y regalos, cumpleaños, grupos y empresas, sorteos, locales que has pedido, horas de silencio)</td><td>Avisarte de novedades y mensajes de tus favoritos (como mucho uno por semana y negocio), ofertas cercanas, invitaciones y planes de tus amigos, fechas nuevas de las series que sigues, los partidos de tus equipos (con los bares de tu zona que los ponen), las fechas nuevas cerca de los artistas que sigues, tus bonos (pocos usos, caducidad y usos a mano), los cupones y regalos que te dan los negocios, las respuestas a tus peticiones de grupo y, si tienes un negocio, peticiones nuevas, los resultados de los sorteos (si ganas, te avisamos siempre), una plaza libre de la lista de espera, cambios o anulaciones de lo que tienes reservado, los sellos y premios de tus tarjetas, tu regalo de cumpleaños y los locales que pediste, cuando llegan a Klendar. Cada tipo se apaga por separado en Ajustes → Notificaciones (los avisos de tus reservas y de la lista de espera van siempre, porque son de algo que has pedido). También tu turno en una cola virtual (te toca, se pasó tu turno, la cola terminó, el local te quitó); son avisos de servicio, sin interruptor, como los de un código. Lo mismo el aviso de que Klendar ha llegado a tu zona, si lo pediste (una sola vez; se quita en «Lo que has pedido»). <strong>«¡Te toca!» llega aunque tengas horas de silencio</strong>: lo has pedido tú y solo tienes unos minutos para presentarte</td><td>Consentimiento, revocable en cualquier momento</td><td>Hasta que revoques el permiso, cierres sesión o elimines la cuenta</td></tr>
<tr><td>Widget, pantalla de bloqueo y reloj</td><td>Una copia de tus planes de hoy (título, negocio y horas) y de tus códigos pendientes (el código, su publicación, el negocio, las plazas y cuándo caduca o empieza), guardada en tu móvil y, si tienes Klendar en un reloj Wear OS, la del código que toca en ese momento también en tu reloj</td><td>Enseñarte tus planes de hoy en el widget si lo añades, y tu código con su cuenta atrás en la pantalla de bloqueo y en el reloj para usarlo sin buscar la app</td><td>Ejecución del contrato (art. 6.1.b RGPD): es una función de la app que tú eliges usar; se apaga en Ajustes → Notificaciones → «Pantalla de bloqueo» (también para el reloj)</td><td>En tu móvil y en tu reloj, hasta el siguiente cambio de tus planes o tus códigos; se borra al usarse o caducar el código, al cerrar sesión o al desinstalar la app. No se envía a Klendar. Al reloj Wear OS llega por los servicios de Google Play del móvil (ver «3. Destinatarios y encargados del tratamiento»); en Apple Watch lo enseña iOS a partir de la actividad en directo del iPhone</td></tr>
<tr><td>Cuenta de negocio</td><td>Datos del negocio (nombre, dirección, NIF/CIF, teléfono, email de contacto, horarios), miembros del equipo (email y rol) y qué hace cada uno en las herramientas del negocio (quién validó, vendió o descontó, apuntó a alguien en la cola o dio algo en el momento) y, si aceptas grupos o haces sorteos, lo que contestas a cada petición (y quién de tu equipo lo hizo) y quién entregó cada premio; los ajustes de la cola (tope y minutos para presentarse) y su código; plan contratado y pagos y, si es una entidad, su tipo (lo que se pide para comprobarlo está en «Cuenta de entidad (la solicitud)»), y, si los pone, el horario de cocina y la red y la contraseña del wifi para sus clientes (que enseña la página de su QR de mesa)</td><td>Dar de alta, verificar y gestionar el negocio; facturar la cuota</td><td>Ejecución del contrato; obligación legal (facturación)</td><td>Durante la relación y después el plazo legal (fiscal: 4 años; mercantil: 6 años). Si se traspasa el negocio, la nueva persona titular accede a sus datos, incluidos los de facturación. Al cancelar la suscripción guardamos la petición y su motivo, si se da. Al eliminar un negocio conservamos 6 años un registro mínimo (nombre del negocio, fecha, quién lo eliminó y cifras sin datos personales)</td></tr>
<tr><td>Condiciones del negocio</td><td>Si das de alta un negocio: qué versión de las condiciones para negocios aceptaste, cuándo y con qué cuenta, y, cuando cambian, cuándo te enviamos el aviso por correo y cuándo lo viste o marcaste como leído en la app o en el panel</td><td>Poder demostrar que el negocio aceptó las condiciones y que se le avisó de cada cambio con la antelación que exige el Reglamento (UE) 2019/1150. El aviso de un cambio en las condiciones para negocios llega al propietario de cada negocio; es obligatorio y no se puede desactivar. Si tu dirección nos devuelve los correos, no lo mandamos y el aviso sigue en la app y en el panel</td><td>Ejecución del contrato con el negocio (art. 6.1.b RGPD) y cumplimiento de una obligación legal (art. 6.1.c RGPD; Reglamento (UE) 2019/1150, art. 3)</td><td>Mientras exista el negocio en Klendar; se borra al eliminarlo. Lo puedes descargar en «Descargar los datos del negocio»; en «Descargar mis datos» sale qué versiones aceptaste</td></tr>
<tr><td>Cobro del plan: avisos, pausa e IVA (negocios)</td><td>La <strong>región a efectos del IVA</strong> (península y Baleares, Canarias, Ceuta o Melilla), que deducimos de la dirección del local; las <strong>pausas por cierre</strong> (fechas, quién la pidió, días pagados que se guardan y cómo terminó); los desbloqueos que hagamos a mano (hasta qué día); y los <strong>avisos del cobro</strong> (qué aviso, para qué día y si se mandó el correo)</td><td>Aplicar el IVA que toca; avisar antes de bloquear un negocio y al poner fecha de fin a su «Gratis de lanzamiento»; llevar la pausa. Los avisos del cobro (fin del «Gratis de lanzamiento», 7 días y 1 día antes del bloqueo, el bloqueo y el fin de una pausa) llegan por correo al propietario y en la app al propietario y a los encargados; son del servicio y no se pueden desactivar</td><td>Ejecución del contrato con el negocio (art. 6.1.b RGPD) y cumplimiento de una obligación legal (IVA, art. 6.1.c RGPD)</td><td>Los avisos, 400 días; lo demás, como la cuenta de negocio</td></tr>
<tr><td>Reclamar un negocio («¿Es tu negocio?»)</td><td>Tu cuenta, el cargo que dices tener, el teléfono o el correo del negocio que nos das, la prueba que subes (una foto o un documento) o lo que nos cuentas, tu declaración de que es cierto, la fecha y lo que decidimos (y por qué)</td><td>Comprobar que llevas ese negocio y, si es así, darte su propiedad; avisar a quien era su propietario de que ha cambiado; evitar que alguien se haga con un negocio que no es suyo. Solo lo ve el equipo de Klendar, y la prueba se guarda en un almacenamiento privado</td><td>Ejecución del contrato (art. 6.1.b RGPD: lo pides tú) e interés legítimo (art. 6.1.f) en evitar suplantaciones y proteger a los negocios</td><td>La prueba, hasta 6 meses después de resolver la reclamación; la reclamación (quién, cuándo y qué se decidió), 2 años</td></tr>
<tr><td>Cuenta de entidad (la solicitud)</td><td>Tu cuenta; el tipo de entidad, su nombre oficial, su CIF, su web oficial y la zona donde actúa; tu nombre y apellidos y tu cargo; el documento que subes para acreditarlo (por ejemplo, tu nombramiento, un certificado de la secretaría, el acta de la junta o la inscripción en un registro), tu declaración de que es cierto, la fecha y lo que decidimos (y por qué)</td><td>Comprobar que representas a esa entidad antes de ponerle el sello de entidad y, si te diste de alta como entidad, antes de que su ficha y lo que publique se vean; evitar que alguien se haga pasar por un ayuntamiento, una asociación o una ONG. Lo ven el equipo de Klendar y las personas del equipo del negocio; el documento, solo tú y Klendar, en un almacenamiento privado. Si te das de alta como entidad, el nombre oficial y la web salen en la ficha pública; el CIF, tu nombre, tu cargo y el documento, no</td><td>Ejecución del contrato (art. 6.1.b RGPD: lo pides tú) e interés legítimo (art. 6.1.f) en evitar suplantaciones y en que la gente sepa quién publica</td><td>El documento, hasta 6 meses después de decidir (si retiras la solicitud, unos días); la solicitud (quién, cuándo y qué se decidió), 2 años</td></tr>
<tr><td>Denuncias de contenido (también sin cuenta)</td><td>Si denuncias sin cuenta: tu nombre, tu correo (opcionales si se trata de abuso sexual infantil) y tu idioma; si denuncias con tu cuenta, la cuenta. En los dos casos: el motivo, el texto de la denuncia, una copia del contenido denunciado y la fecha. Para frenar abusos en las denuncias sin cuenta, un resumen de la conexión calculado con una clave que cambia cada día; nunca la dirección IP</td><td>Tramitar la denuncia y contestarte: confirmarte que la hemos recibido y decirte qué hemos decidido y por qué. Quien publicó el contenido no sabe quién lo denunció</td><td>Obligación legal (art. 6.1.c RGPD; Reglamento (UE) 2022/2065, art. 16)</td><td>Hasta 2 años desde que se cierra la denuncia. El resumen de la conexión se borra en 24 horas</td></tr>
<tr><td>Informes de errores</td><td>Identificador de instalación, modelo y sistema del dispositivo, versión de la app, informe técnico del fallo (sin tu nombre ni tu correo)</td><td>Detectar y arreglar fallos de la app (Firebase Crashlytics)</td><td>Interés legítimo (art. 6.1.f): que la app funcione</td><td>90 días</td></tr>
<tr><td>Estadísticas de uso de la app (opcional)</td><td>Identificador de instalación, pantallas y acciones (ver una oferta, guardar, canjear, compartir, buscar —sin el texto que buscas—), modelo y sistema del dispositivo</td><td>Saber qué se usa para mejorar la app (Firebase Analytics)</td><td>Consentimiento (art. 6.1.a): casilla sin marcar al crear la cuenta o en Ajustes → Privacidad y datos; se retira igual</td><td>14 meses</td></tr>
<tr><td>Comunicaciones comerciales</td><td>Email</td><td>Enviarte novedades de Klendar (nunca de terceros)</td><td>Consentimiento específico marcado en el registro; revocable en cada email o en el perfil</td><td>Hasta que lo revoques</td></tr>
<tr><td>Avisos «Avísame si…»</td><td>La zona que eliges (punto y radio), categorías, precio máximo</td><td>Avisarte cuando aparece algo que encaja</td><td>Ejecución del contrato</td><td>Hasta que borres el aviso o la cuenta</td></tr>
<tr><td>Resúmenes por correo</td><td>Email, idioma, ciudad, tus favoritos y planes</td><td>Mandarte el resumen semanal con ofertas y planes de negocios (si lo activas en Ajustes → Notificaciones; empieza apagado)</td><td>Consentimiento; baja en un clic en cada correo</td><td>Hasta que lo apagues</td></tr>
<tr><td>Correos que no llegan y cambio de correo</td><td>Tu email, la fecha, el motivo (rebote o marcado como spam) y el detalle técnico que nos da nuestro proveedor de correo (Resend); al cambiar el correo, la dirección anterior y la nueva</td><td>Dejar de mandarte resúmenes y otros correos que no sean imprescindibles mientras tu correo nos devuelva los mensajes (los de acceso a tu cuenta se mandan siempre) y avisarte en la app y en la web; confirmar un cambio de correo con un código a la dirección actual y otro a la nueva. Si lo cambiamos nosotros porque has perdido el acceso a tu correo, el registro de administración guarda la dirección anterior, la nueva y cómo comprobamos tu identidad</td><td>Interés legítimo en no enviar correos que no llegan o que no quieres (art. 6.1.f RGPD); ejecución del contrato para el cambio de correo</td><td>Hasta que cambies de correo, nos digas que ya funciona o elimines tu cuenta; el registro de administración, 2 años</td></tr>
<tr><td>Mensajes de tus favoritos</td><td>Que tienes el negocio en favoritos o sellos en una de sus tarjetas</td><td>Que el negocio te mande un aviso (como mucho uno por semana y local), revisado por Klendar; el negocio no ve quién lo recibe</td><td>Consentimiento (notificaciones); se apaga en Ajustes → Notificaciones</td><td>La bandeja, 90 días</td></tr>
<tr><td>Sugerencias «Quizá te interese»</td><td>Tus gustos (ver «Tus gustos y tu ciudad»), tus últimas búsquedas y las categorías que más miras, guardadas en tu móvil</td><td>Sugerirte algo cuando cerca no hay nada; se envían con esa consulta y no se guardan en nuestros servidores</td><td>Ejecución del contrato</td><td>En tu móvil, hasta que las borres o elimines la cuenta</td></tr>
<tr><td>Tus gustos y tu ciudad</td><td>De 3 a 5 categorías que eliges («Bares», «Música en directo»…) y, si quieres, tu ciudad habitual (una de las ciudades de Klendar, nunca tu dirección ni tu posición). Cuándo los elegiste o si dijiste «Ahora no»</td><td>Enseñarte antes en Descubre y en Explorar lo de esas categorías, sin esconder nada (pesan dentro del orden que eliges: con «Novedades» cuentan como si fueran dos días más nuevas, con «Más pronto» como si empezaran seis horas antes y con «Cercanía» como si estuvieran a la mitad de distancia); tenerlas en cuenta en «Quizá te interese»; y, con tu ciudad, avisarte de lo mejor de hoy cuando abres Klendar a más de 50 km de ella. Sin cuenta, se guardan solo en tu móvil; con cuenta, también en ella, para que valgan en la web y en otro móvil</td><td>Ejecución del contrato (lo pides tú al elegirlos; el paso se puede saltar)</td><td>Hasta que los cambies o los borres (Ajustes → Lo que ves → Tus gustos) o elimines la cuenta. En la web, la copia del navegador se borra al cerrar sesión</td></tr>
<tr><td>Búsquedas</td><td><strong>Lo que buscaste:</strong> tus últimas 10 búsquedas, guardadas solo en tu móvil o en tu navegador; no nos llegan. <strong>Lo más buscado:</strong> cada búsqueda (el texto, en minúsculas y sin tildes) se suma a un contador de su ciudad y su día. No guardamos quién buscó ni tu dirección IP: para que la misma persona cuente una vez al día usamos un resumen con una clave secreta que cambia y se tira cada día, y ese resumen se borra al día siguiente. No contamos textos que parezcan datos personales (correos, enlaces, números de 4 cifras o más) ni palabras ofensivas</td><td>Que veas tus búsquedas recientes al tocar el buscador; y enseñar a todo el mundo «Lo más buscado en (ciudad)»: solo términos que algún día buscaron al menos 5 personas distintas, nunca los de hoy y sin números</td><td>Lo que buscaste: no lo tratamos nosotros (está en tu dispositivo). Lo más buscado: interés legítimo (art. 6.1.f RGPD) en sugerir búsquedas útiles; lo que se guarda es anónimo</td><td>Lo que buscaste: hasta que lo borres (una o todas, en el buscador) o desinstales la app / borres los datos del navegador. Lo más buscado: 30 días; el resumen para no contar dos veces, hasta el día siguiente</td></tr>
<tr><td>Traducción automática</td><td>Si has encendido «Traducir publicaciones a mi idioma» (con cuenta, en tu perfil; sin ella, en tu móvil o tu navegador)</td><td>Enseñarte traducidos los textos de los negocios cuando el servicio esté disponible</td><td>Ejecución del contrato (lo eliges tú; empieza apagado)</td><td>Hasta que lo cambies o elimines la cuenta</td></tr>
<tr><td>Compartir en historias</td><td>Nada tuyo: la imagen (1080 × 1920, con la foto, el diseño y un QR de la publicación, el negocio o la selección) se hace en tu móvil, o la descarga tu navegador desde klendar.app. Quien abre ese QR o enlace (<code>?ref=stories</code>, o <code>?ref=whatsapp</code> si es la imagen para el estado de WhatsApp) deja una visita contada, igual que quien llega desde el QR de la tele de un local, desde el QR del cartel del local o desde el enlace de un RRPP: qué se abrió y cuándo, con una clave que cambia cada día y que solo sirve para no contar dos veces a la misma persona en 30 minutos (nunca la IP ni la cuenta)</td><td>Que puedas compartir algo en Instagram, en tu estado de WhatsApp u otra red y que el negocio vea cuántas visitas llegan desde ahí, y cuántas de ellas desde WhatsApp (solo el número)</td><td>Interés legítimo (art. 6.1.f) en contar, sin identificar a nadie, si compartir sirve</td><td>La visita contada, 14 meses. Lo que publiques en otra red lo trata esa red (por ejemplo Meta, para Instagram y WhatsApp) con sus propias condiciones</td></tr>
<tr><td>Toques en los enlaces de la ficha</td><td>Qué enlace de una ficha se ha tocado (tipo, dominio y cuándo); una clave temporal para no contarlo dos veces, hecha con un secreto que cambia cada día y que se borra a los 30 minutos</td><td>Dar al negocio la cifra de cuántas veces se abren sus enlaces y su carta. Al tocar «Reservar», «Pedir a domicilio» u otro enlace de un negocio sales de Klendar: lo que hagas allí lo trata ese servicio con su propia política de privacidad</td><td>Interés legítimo (art. 6.1.f RGPD) en dar cifras al negocio, sin saber quién toca</td><td>14 meses; la clave temporal, 30 minutos. No se guarda ni la cuenta ni la IP</td></tr>
<tr><td>Escaneos del QR de mesa</td><td>Cuántas veces se escanea el QR de mesa de un local cada día (solo el número); para no contar dos veces la misma conexión en 30 minutos, un resumen cifrado de tu conexión hecho con un secreto que cambia cada día (nunca la IP ni tu cuenta)</td><td>Dar al negocio la cifra de escaneos de sus carteles. La red y la contraseña que ves las pone el negocio</td><td>Interés legítimo (art. 6.1.f RGPD) en dar cifras al negocio, sin saber quién escanea</td><td>La cifra, 14 meses; el resumen, 24 horas. No se guarda ni la cuenta ni la IP</td></tr>
<tr><td>Seguridad</td><td>Resumen cifrado de tu conexión (cambia cada día, nunca la IP), dispositivos de confianza para entrar con huella o Face ID, códigos para confirmar que eres tú, errores técnicos de la web (sin datos personales)</td><td>Frenar abusos, entrar sin contraseña en tus dispositivos, proteger los cambios de contraseña y la eliminación de la cuenta, detectar fallos</td><td>Interés legítimo (art. 6.1.f)</td><td>Resumen 24 h; dispositivos 90 días sin uso; códigos 1 h; errores 30 días</td></tr>
<tr><td>Historial de consentimientos</td><td>Qué has aceptado o retirado y cuándo</td><td>Poder demostrarlo (art. 7.1 RGPD)</td><td>Obligación legal (art. 6.1.c)</td><td>Mientras exista la cuenta</td></tr>
{TEL['es']}<tr><td>Soporte</td><td>Email y contenido de tu mensaje</td><td>Atender tus consultas</td><td>Ejecución del contrato / interés legítimo</td><td>1 año desde el cierre</td></tr>
</table>
<p>Para crear la cuenta son obligatorios el correo (o tu cuenta de Google o Apple), tu nombre (el que verán los negocios y tus amigos; puede ser un apodo), la fecha de nacimiento y aceptar los términos; sin ellos no se puede usar la cuenta. Todo lo demás es opcional.</p>
<p><strong>Ojo con la pantalla de bloqueo:</strong> mientras se ve el código, cualquiera que tenga tu móvil en la mano puede leerlo sin desbloquearlo. Si tienes puesto que el móvil oculte el contenido de las notificaciones en la pantalla de bloqueo, en Android solo se ve «Tienes un código listo» y la cuenta atrás; en iPhone el número del código se oculta mientras el móvil está bloqueado si así lo tienes configurado.</p>
<p><strong>Páginas de artistas.</strong> Para que la gente pueda seguir a un artista, publicamos su <strong>nombre artístico</strong> (el que usa en público y aparece en los carteles), sus próximas fechas y, si los tenemos, una foto, una descripción breve y enlaces a sus perfiles públicos (Spotify, Instagram…). Lo hacemos por interés legítimo (art. 6.1.f RGPD: informar de eventos públicos que el propio artista anuncia), con datos que ya son públicos y sin datos de contacto ni personales más allá de su nombre artístico. Las fotos solo las ponemos si tenemos derecho a usarlas (las que nos da el artista o su representante, o con licencia que lo permita) y citamos al autor si hace falta. <strong>Si eres el artista</strong> (o le representas) y quieres que cambiemos algo, que quitemos la foto o la página, o ejercer tus derechos (acceso, rectificación, oposición, supresión), escríbenos a <a href="mailto:{E}">{E}</a>: lo revisamos en un plazo máximo de un mes. Una página que se quita deja de verse y no vuelve a salir aunque un negocio vuelva a escribir el nombre (queda oculta).</p>

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
<p><strong>Google (solo si usas Klendar en un reloj Wear OS):</strong> el código que toca enseñar (título, negocio, código, plazas y horas) pasa de tu móvil a tu reloj con los servicios de Google Play, cifrado; si el reloj no está cerca del móvil puede pasar por los servidores de Google. Google actúa según sus propias condiciones de Wear OS, que aceptaste al emparejar el reloj.</p>
<p>Para «Según el tiempo», nuestro servidor pide la previsión a <strong>MET Norway</strong> (Instituto Meteorológico de Noruega) solo con el centro de una zona de unos 10 km: no le llega ningún dato tuyo. Si compartes algo en <strong>Instagram</strong>, <strong>WhatsApp</strong> u otra red desde «Compartir en historias», la imagen la pasa tu móvil a esa app y desde ahí la trata esa red como responsable independiente, con sus propias condiciones.</p>
<p>Las <strong>denuncias</strong> solo las ve el equipo de Klendar. No se las damos a quien publicó el contenido denunciado; solo las comunicamos a las autoridades si hay indicios de un delito (art. 18 del Reglamento (UE) 2022/2065) o si nos lo pide un juez o la autoridad competente.</p>
<p>Los <strong>negocios</strong> ven tu nombre mostrado y tu foto de perfil cuando consigues un código o reservas plaza en una de sus publicaciones (en su lista de asistentes, que pueden descargar, con el número de plazas, la hora y si has entrado), cuando tienes sellos en una de sus tarjetas, cuando leen tu QR de cliente (tus bonos de ese negocio), cuando coges número en su cola (tu turno), cuando ganas uno de sus sorteos, cuando estás entre sus 10 clientes que más fueron el mes anterior (si tiene «Agradecer a los habituales») y cuando publicas una reseña, y estadísticas agregadas. Nunca tu correo, tu teléfono, tu fecha de nacimiento ni tu ubicación, salvo el contacto que tú elijas darle al aceptar su propuesta en «Grupos y empresas».</p>
<p>Los <strong>RRPP</strong> (relaciones públicas de un local) solo ven a las personas que han entrado por su enlace o su QR: su nombre mostrado y su foto, cuándo se apuntaron, qué oferta, cuántas plazas y si entraron y a qué hora. Nunca su correo, su teléfono ni su fecha de nacimiento. Lo que el local pague a sus RRPP lo gestiona el local, fuera de Klendar.</p>
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
<p>Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, y retirar el consentimiento en cualquier momento, escribiendo a <a href="mailto:{EP}">{EP}</a> desde el email de tu cuenta. Además, desde la app o desde «Tu cuenta» en la web (Cuenta → Ajustes → Privacidad y datos) puedes: ver qué has consentido y cuándo, retirar por separado el consentimiento de ubicación, notificaciones push, estadísticas de uso y comunicaciones comerciales, dejar de enseñar tus planes a tus amigos, ver y desbloquear a las personas que has bloqueado, descargar todos tus datos en un archivo, también tus bonos y cada uso, tu turno de hoy en una cola, tus peticiones de grupo (con lo que contestó cada negocio y el contacto que compartiste), tus participaciones y premios en sorteos, los artistas que sigues, tus cupones y regalos, lo que te han dado en el momento, los locales que has pedido y tus avisos de «Avísame cuando Klendar llegue» (también los apuntados sin cuenta con el correo de tu cuenta) (acceso y portabilidad), y <a href="/eliminar-cuenta/">eliminar tu cuenta</a> por completo. Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" rel="noopener">www.aepd.es</a>).</p>

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
<tr><td>Location</td><td>Approximate or precise device coordinates (depending on the permission you grant) or the city you pick manually</td><td>Sort the feed and the map by distance; "deals near you" if you enable it; check that you're at the venue when you scan its QR code to get a visit stamp (it's compared with the venue's address and not stored); order today's plans according to the weather in your area (see “Based on the weather”); and, in aggregate and without identifying anyone, the distance figures in each business's “Report” (how far its customers come from). If you've chosen your city, compare where you are with it at that moment to tell you about today's best when you're travelling (more than 50 km away); we don't store where you were, only the date you closed the notice. On klendar.app, when you tap “Near me” or “Use my location”, your browser keeps your position for 6 hours to show you distances and sends it, rounded to about 100 m, in the address of the page you request (we don't store it and it doesn't go through the visit counter). If Klendar isn't in your area yet, we check it there and then with your position (without storing it) and, if you ask us to tell you, we only store the rounded area (see “Tell me when Klendar arrives”). To name that area, the app and the website ask Mapbox for the name of the town using the rounded point</td><td>Consent (art. 6(1)(a)), revocable in your device and app settings</td><td>No history is kept. Only the last known location is stored (for "near you") and discarded after 7 days. On the website, your browser deletes it after 6 hours</td></tr>
<tr><td>Buzzing tonight (busy areas on the map)</td><td>No new data: every 5 minutes we count, by areas of about 300 m, how many <strong>different people</strong> have redeemed something, stamped a visit or shown their customer QR code at a business in the last 2 hours. We only keep the area and a level (a bit, busy or buzzing)</td><td>Showing on the map where it's busy right now</td><td>Legitimate interest (art. 6(1)(f) GDPR) in offering the feature, with these safeguards: only areas with <strong>10 or more different people</strong>, never a number, a name or a business, the point is the centre of the area and not the venue, and it's rebuilt from scratch every 5 minutes</td><td>The areas, until the next calculation (5 minutes). The redemptions, stamps and QR readings used already have their own row and retention</td></tr>
<tr><td>Based on the weather</td><td>An area of about 10 km around where you're looking (your position or the city you picked, rounded to 0.1°), never your exact position</td><td>If it's raining today, show indoor plans first; if the weather is nice, terraces and outdoor plans. Nothing is removed, it only reorders today's plans. Our server asks MET Norway (the Norwegian Meteorological Institute, in the European Economic Area) for the forecast using only the centre of that area: it doesn't receive your IP address, your account or your position. Turn it off in the sort menu (“Sort by”) → “Based on the weather”</td><td>Legitimate interest (art. 6(1)(f) GDPR) in ordering what you see in a useful way; your position, with the location consent you have already given</td><td>We don't keep anything of yours: each area's forecast, for 2 days at most</td></tr>
<tr><td>Favourites, reviews, redemptions and stamps</td><td>Businesses saved to your favourites, publications saved to your plans, ratings and comments, redemption codes and place reservations (with how many places) and their status and, if the business enters it, the receipt total (see “Receipt total”), your place on the waiting list and the notices we've sent you from it, deal views, stamp cards (stamps, rewards and their codes)</td><td>Provide the service: your favourites, your public reviews, your redemption history, businesses' stamp cards and aggregate statistics for businesses. If the business has turned on “Thank your regulars”, once a month it sees its 10 customers who came most the previous month: their display name and how many visits and redemptions they had at its venue. This is information it already sees when validating, just counted; never your email, phone number or date of birth. It uses it to send you a gift with a message, if it wants. “First visit only” offers are checked by Klendar: the business only knows you couldn't get that code</td><td>Performance of a contract; the monthly list of regulars, legitimate interest (art. 6(1)(f) GDPR) of the business and of Klendar in thanking its customers, with data the business already has</td><td>While the account exists. Reviews are shown with your display name and, if you have redeemed something at that business with Klendar, with the “Verified customer” label (without saying what or when)</td></tr>
<tr><td>Receipt total</td><td>If the business enters it when validating your code (or within the next 24 hours): how much you paid in total on that visit, in euros (only the total; never what you bought or how you paid), linked to that redemption</td><td>So the business knows how much Klendar has brought it (“What Klendar has brought you”, “at least X €”) and so you can see it in “Download my data”. If it isn't entered, the offer's price is used</td><td>Legitimate interest (art. 6(1)(f) GDPR) of the business and of Klendar in measuring what the service brings; it's optional for the business, it's only a total and it isn't used for anything else (not to choose what you see, not for profiles)</td><td>While your account exists, with the redemption. The business sees the total with your name only in “Recently validated” (24 hours, to correct it); after that, in its stats, without your name. If you delete your account, the validated redemption stays in the business's stats with no one behind it (“Deleted account”)</td></tr>
<tr><td>Passes and customer QR code</td><td>The passes you buy from a business (name, uses, price set by the business, what it includes, expiry and conditions), each use (when, whether it was manual and whether it was undone) and who on the business's team added the pass or recorded each use; the key of your customer QR code; each time a business reads your QR code (which business and when)</td><td>Keeping count of your passes, showing them to you and telling you when you have few uses left or they're about to expire; preventing fraud (a QR code that changes every 30 seconds, limits on uses per minute, a record of who did what). <strong>What the business sees:</strong> when it reads your QR code, your public name, your photo and your passes <strong>from that business</strong>, nothing else (not your email, phone or passes from other places). The owner and managers also see the list of passes sold with that data and each use</td><td>Performance of the contract (art. 6(1)(b) GDPR); fraud prevention, legitimate interest (art. 6(1)(f))</td><td>Passes and their uses, while you have the account (if you delete it, they're erased; the business only keeps what it has downloaded before). Each reading of your QR code, 30 days. The QR key is also stored on your phone, in the app's secure storage; on the web only while the page is open</td></tr>
<tr><td>Give on the spot</td><td>What a business has given you with a QR code of its own (what: stamps, one use of your pass or the text of “something on the spot”; which business; when and on what day; who on the team opened the QR code); that you've scanned a QR code but not accepted it yet; on the business side, the QR code (a key, a secret, who opened it and when it was closed)</td><td>Giving you what you accept, showing it to you in “Your codes”, on your stamp cards or on your pass, and letting the business see right away that you've received it; preventing fraud (a QR code that changes every 30 seconds, once per person and QR code, 5 a day per business, a record of who gave it); counting it in the business's stats as a visit and towards “Verified customer”. <strong>What the business sees:</strong> at the time, your public name (“Lucía has received it”); afterwards, in “Recently validated”, “Validated redemptions” and its data download, your public name, what it gave you, when and who on its team. Nothing else (not your email, phone or what you get elsewhere). An employee doesn't see which colleague gave it</td><td>Performance of the contract (art. 6(1)(b) GDPR), which you request by tapping “Accept”; fraud prevention and the business's stats, legitimate interest (art. 6(1)(f))</td><td>What you were given, 400 days; after that it stays in the business's stats without your name. That you scanned without accepting, 1 day. The business's QR code, 30 days after it's closed. If you delete your account, what you were given is no longer linked to you (the business only keeps the count)</td></tr>
<tr><td>Virtual queue</td><td>If you get a number in a venue's queue: the number, how many of you there are, when you joined, when you were called and how long you had to get there, and how it ended (served, didn't come, you left or the venue removed you). If the venue's team adds someone without the app, only the name they type. To prevent abuse, how many times you try per minute (per account and per connection; the connection as a fingerprint that doesn't store your IP)</td><td>Giving you your turn, telling you how many people are ahead and an approximate wait (based on how fast the venue calls people), telling you when it's your turn and running the venue's queue; preventing abuse (one entry per person and queue, limits per minute). <strong>What the venue sees:</strong> your public name, your photo, your number, how many of you there are and the state of your turn. Nothing else (not your email or phone)</td><td>Performance of the contract (art. 6(1)(b) GDPR); the abuse limits, legitimate interest (art. 6(1)(f))</td><td><strong>Everything is deleted at the end of the day</strong> (at 6:00 venue time) or when the venue ends the queue, whichever comes first. The per-connection attempts, after 24 hours. The notifications you received stay in your Notifications like the rest</td></tr>
<tr><td>Group requests (Groups and companies)</td><td>What you ask for (what it's for, date, number of people, approximate budget per person and note), which places (up to 3), what each one replies (proposal, indicative price, conditions or that it can't) and, if you accept a proposal, the contact details you choose to share with that place: your account email or the phone number you enter</td><td>Getting your request to the places you choose, showing you their replies, notifying you and, when you accept one, giving that place your contact details so it can confirm the booking with you; preventing abuse (3 requests every 24 hours). <strong>What the place sees:</strong> what you ask for, without your name or contact details, until you accept its proposal; then your public name and the contact details you chose, <strong>that place only</strong>. The other places only know you chose another proposal. From then on, the place is responsible for what it does with your contact details (it uses them to confirm the plan with you)</td><td>Performance of the contract (art. 6(1)(b) GDPR): you ask for it; sharing your contact details, at your request when you accept</td><td>Shared contact details, until 30 days after the date of the plan (then they're deleted from Klendar; the place keeps whatever it has noted down itself). The request and the replies, 12 months after the date. If a business reports your request, we keep a copy of what was reported with the report for up to 2 years after it is closed (legal obligation, Regulation (EU) 2022/2065), even if the request is deleted earlier</td></tr>
<tr><td>Giveaways</td><td>That you've entered a giveaway, your entry number, when you entered or left, whether you already had the business in your favourites and, if you win, your prize (whether you accepted it, when, and whether it was handed over). To check your age we use the date of birth in your profile</td><td>Managing your entry, checking you meet the requirements (18 or over, not on the business's team, having it in your favourites if required), running the draw in a verifiable way, telling you the result and letting the organiser hand over the prize. <strong>Who runs it:</strong> the business running the giveaway, which is <strong>responsible for the giveaway</strong> and for handing over the prize (its details are in the rules); Klendar processes your data to run the giveaway in the app. <strong>What the organiser sees:</strong> how many people have entered and how many are new favourites; of the winner, their public name and photo (and, if the prize is over €300, the tax details that person gives them, to comply with the tax authority). Nobody else sees who has entered</td><td>Performance of the contract (art. 6(1)(b) GDPR): you enter, under the giveaway's rules</td><td>Entries, 6 months after the draw; the winners' details, 12 months. The number, the seed and the numbers drawn remain (no one's data: they're the proof of the draw)</td></tr>
<tr><td>Coupons, gifts and what you've saved</td><td>The next-visit coupons and thank-you gifts businesses give you: what it is, which business, the message, when it arrived, when it's valid and whether it was used. “What you've saved” is a figure worked out from your validated redemptions (previous price − what you paid)</td><td>To give them to you and let the business validate them; to show you what you've saved in “Your account”</td><td>Performance of the contract (art. 6(1)(b) GDPR)</td><td>Coupons and gifts, 400 days from when they reach you (that's what you see in the app). After that, and also if you delete your account sooner, unused ones are deleted and used ones stay in the business's figures without your name, like redemptions. “What you've saved” isn't stored: it's worked out each time you open it</td></tr>
<tr><td>Promoter lists</td><td>If you come in through a venue promoter's link or QR code: which promoter and which night (6:00 to 6:00, venue time), the offer you get, the number of places, when you signed up and whether and when you got in</td><td>Put you on that promoter's list, give you the offers on their list (with their places and time limit) and let the venue know who comes with each promoter. Before you get anything, we tell you: “You're joining Marta's list (Sala X). Marta will see your name and whether you got in.” The promoter sees your display name and photo, when you signed up, which offer, how many places and whether and when you got in; <strong>never</strong> your email, phone number or date of birth. The venue sees the same in its dashboard and can download it. If you don't come in through a link, you don't count for any promoter</td><td>Performance of a contract (you choose to come in through that link and get the offer, after the notice)</td><td>Which promoter you're with that night, 7 days. Which promoter each code was obtained with, while the redemption exists (anonymised if you delete your account)</td></tr>
<tr><td>Being a venue promoter</td><td>The invitation (the email the venue invited and when it expires), whether you accept it, your status (active, paused), your links and QR codes (name, expiry, pause and how many times they've been opened, without knowing who), the offers and places the venue assigns you and your figures (signed up, got in, conversion, by night)</td><td>Let you be a promoter for one or more venues with your Klendar account, give you your link and your list, and let the venue see your figures. The venue sees your display name and photo, your status, your links and your figures; it can't edit your account and you can't change anything of the venue's. You're not part of its team</td><td>Performance of a contract (you accept the invitation); you must be 16 (18 if the venue is 18+)</td><td>While you are that venue's promoter. If the venue removes you or you leave, your links disappear; the email of an invitation you don't accept is deleted when it expires (14 days). The venue's past figures stay, without your contact details</td></tr>
<tr><td>Photos and videos in reviews</td><td>The photos and videos you add to a review (up to 6), with their order, size and length</td><td>Publish them with your review, in the app and on klendar.app, with your name and profile photo visible. Before uploading them we remove the data inside them: for photos, the location, date and phone model (EXIF); for videos, the location and phone model. What can be seen in the image or heard in the video is published, so don't include other people without their permission. A review that goes to review because of its text isn't published, with its photos and videos, until someone at Klendar has reviewed it. Anyone can report a photo or a video; if it breaks the Community guidelines we take it down and tell you why. In the future we may analyse photos and videos automatically (Google Cloud Vision) to detect nudity or violence before they're published; we'll let you know before turning it on</td><td>Performance of a contract (publishing what you choose to publish); legal obligation for reports (Regulation (EU) 2022/2065)</td><td>Until you remove them, delete the review or delete your account; the files disappear from our servers within a few days. If someone has reported them, we keep a copy as evidence for as long as the report and the time to appeal last</td></tr>
<tr><td>Friends and plans</td><td>Your friend link (and its QR code), your friends and since when, the publications you mark as “I'm going”, the invitations you send and receive (and your answers), your “Let my friends see my plans” and “Show the plans I've been to with each friend” settings and the people you block</td><td>Let you become friends with people who have your link, see which plans your friends are going to, invite them and let them see what you're going to. If “Let my friends see my plans” is on, your friends see which upcoming publications you're going to (because you've marked “I'm going”, have a reserved place or a code): on each publication, on your friend page and, if they've asked for it, in a notification. Things that have already happened don't appear on your page, with one exception: a friend's page can show “You've been to N plans together”, the number of publications where you both have a validated redemption; only that friend sees it, it doesn't say which or when and it isn't stored separately (it's worked out on the spot from the redemptions we already keep). It only shows if you both have both settings on; if either of you turns it off, neither of you sees it. It's never shown with people you've blocked or suspended accounts, and when you delete your account your redemptions are anonymised and stop counting. The people you block can't be your friends or invite you (they aren't told). There is no people search: only people with your link or your QR code can find you</td><td>Performance of a contract. Showing your plans and the plans you've been to together can be turned off in Settings → Privacy; invitations and notifications about your friends' plans, in Settings → Notifications</td><td>While the account exists. If you remove someone from your friends, they stop seeing your plans straight away (we don't tell them)</td></tr>
<tr><td>Series you follow</td><td>The series you follow (“Open mic on Thursdays”), since when, whether you've asked to “Add each date to my plans” and which dates we've already told you about</td><td>Tell you about each new date of a series you follow (one notification per date, and none if another one about that publication has already reached you), save it to your plans if you ask, and tell you if the business ends or cancels it. We only tell you about things you can see (18+, exclusives) and never if you've blocked whoever runs the business. The business only sees how many people follow each series, never who</td><td>Performance of a contract (you ask for it by tapping “Follow the series”); notifications, with your notification permission (turn them off in Settings → Notifications → “Series you follow”)</td><td>Until you unfollow it, the business ends or cancels it, or you delete your account; the record of dates notified, the same</td></tr>
<tr><td>Teams you follow</td><td>The teams or competitors you follow (“Real Madrid”, “Fernando Alonso”), since when, which matches we've already told you about and, while you follow any, your filters' area (the distance and, if you pick one, the city)</td><td>Let you know a few hours before your team's match which bars in your area are showing it (two notifications a day at most, one per match, and never if your quiet hours would deliver it after kick-off). To know which bars are in your area we use your filters' distance around the city you picked or, otherwise, your last location (from the last 30 days) or your city; if there's none, we don't notify you. Bars don't know who follows which team</td><td>Performance of a contract (you ask for it by tapping “Follow…”); notifications, with your notification permission (turn them off in Settings → Notifications → “Your teams' matches”); location, with the location consent you have already given</td><td>Until you unfollow it or delete your account (the area, until you unfollow them all); the record of notifications, 30 days</td></tr>
<tr><td>Artists you follow</td><td>If you tap “Follow” on an artist's page: that you follow them and since when, and the alerts we've sent you about their dates; to know which dates are near you, the same area as for “Teams you follow” (your filters' distance and the chosen city or your last location)</td><td>Let you know when they have a new date near you (two alerts a day at most, and never about something you can't see: 18+, exclusives). <strong>It's private:</strong> neither the artist, nor businesses, nor anyone else can see that you follow them; only Klendar's team sees how many people follow each artist, without names; businesses don't see even that</td><td>Performance of a contract (art. 6(1)(b) GDPR): you ask for it by following them; notifications, with your notification permission (turn them off in Settings → Notifications → “Artists you follow”)</td><td>Until you unfollow them (Account → Artists you follow) or delete your account; the alerts sent, 120 days. When you stop following all artists and teams, we delete your area</td></tr>
<tr><td>Places you ask for</td><td>The name of the place you ask for, the city or area you type and, if you add them, the venue's approximate address or the map point you set; the date; if the venue joins Klendar, when we told you</td><td>Grouping your request with other people's requests for the same place (by name and area), so we know which venues people want and can suggest it to those businesses; telling you if the place is already on Klendar; and letting you know when it joins (at most two notifications of this kind a day; switch it off in Settings → Notifications → “Places you've asked for”). To prevent abuse, at most 5 requests a day and 30 open at once, and no offensive text. <strong>Nobody sees who asked</strong>: the Klendar team sees the place, how many people ask for it and the names, addresses and areas they typed; the business is only told the number (“X people have asked to see you on Klendar”), never who</td><td>Performance of the contract (art. 6(1)(b) GDPR): you ask for it; the notification, with your notification permission</td><td>Until you withdraw it (in “What you've asked for”) or delete your account; if the venue joins and we tell you, or we dismiss it, 90 more days; if it doesn't join, 24 months. For places that join Klendar or that we dismiss, only the number of people who asked is kept, with nobody's data</td></tr>
<tr><td>Tell me when Klendar arrives</td><td>The area where you ask: the name of the town and a point rounded to about 10 km (never your exact position); your language; your account or, if you don't have one, your email; when you signed up, when you confirmed and when we told you. To confirm and to unsubscribe, single-use links, which we don't store: only a digest (hash)</td><td>Telling you <strong>once only</strong> when Klendar reaches your area: by email and, if you have an account, also with a notification; and knowing, by counting how many people ask in each area, which cities to go to first (the Klendar team only sees how many people per area). Without an account, we first send you an email so you can confirm the address is yours (<strong>double opt-in</strong>): until you confirm, you're not on the list. To prevent abuse, without an account it first goes, when enabled, through Cloudflare Turnstile's anti-bot check (as with reports without an account) and there's a cap on requests per connection, worked out without storing the IP address</td><td>Consent (art. 6(1)(a) GDPR), which you give by tapping “Tell me when it arrives” and, without an account, by confirming in the email. Withdraw it whenever you like with the link in the confirmation email or, with an account, in “What you've asked for”</td><td>Unconfirmed, 7 days. Once we've told you, 30 days. If Klendar doesn't arrive, 24 months. When you delete your account it's deleted, including anything you signed up for without an account with the same email</td></tr>
<tr><td>Your plans in your calendar</td><td>If you turn it on (Settings → “Your plans in your calendar”, in the app or in “Your account”): a secret random link and when your calendar last checked it. Through that link your calendar (Google Calendar, Apple, Outlook…) receives what you have in Plans: title, date and time, place and link of the events you're going to, your reservations (and how many places), codes with a time and the dates added by the series you follow</td><td>So your plans appear in your calendar and update themselves</td><td>Performance of the contract (art. 6(1)(b)): it's a feature you ask for</td><td>Until you turn it off, change it (the old link stops working straight away) or delete your account. Whatever your calendar stores is handled by whoever provides that calendar (for example Google or Apple) under their own terms. <strong>Anyone with the link can see those plans</strong>: don't share it; if it gets out, change it</td></tr>
<tr><td>Push notifications</td><td>Device token, preferences (favourites, nearby, messages from your favourites, friend invitations and plans, series you follow, your teams' matches, artists you follow, your passes, stamps and rewards, coupons and gifts, birthday, groups and companies, giveaways, places you've asked for, quiet hours)</td><td>Tell you about news and messages from your favourites (at most one a week per business), nearby offers, your friends' invitations and plans, new dates of the series you follow, your teams' matches (with the bars in your area that are showing them), new dates near you of the artists you follow, your passes (few uses left, expiry and manual uses), the coupons and gifts businesses give you, replies to your group requests and, if you have a business, new requests, giveaway results (if you win, we always tell you), a free place from the waiting list, changes to or cancellations of what you've booked, the stamps and rewards on your cards, your birthday gift and places you asked for, when they join Klendar. Each kind can be turned off separately in Settings → Notifications (notices about your bookings and the waiting list are always sent, because they're about something you asked for). Also your turn in a virtual queue (it's your turn, you missed your turn, the queue has finished, the venue removed you); these are service notifications, with no switch, like those for a code. The same goes for the notice that Klendar has reached your area, if you asked (once only; remove it in “What you've asked for”). <strong>“It's your turn!” arrives even during your quiet hours</strong>: you asked for it and you only have a few minutes to get there</td><td>Consent, revocable at any time</td><td>Until you revoke the permission, log out or delete the account</td></tr>
<tr><td>Widget, lock screen and watch</td><td>A copy of today's plans (title, business and times) and of your pending codes (the code, its publication, the business, the places and when it expires or starts), stored on your phone and, if you have Klendar on a Wear OS watch, the code that's due at that moment also on your watch</td><td>Showing today's plans in the widget if you add it, and your code with its countdown on the lock screen and on your watch so you can use it without looking for the app</td><td>Performance of the contract (art. 6(1)(b) GDPR): it's an app feature you choose to use; it can be turned off in Settings → Notifications → “Lock screen” (for the watch too)</td><td>On your phone and watch, until your plans or codes next change; it's deleted when the code is used or expires, when you log out or when you uninstall the app. It isn't sent to Klendar. It reaches a Wear OS watch through Google Play services on your phone (see “3. Recipients and processors”); on Apple Watch, iOS shows it from the iPhone's Live Activity</td></tr>
<tr><td>Business account</td><td>Business details (name, address, tax ID, phone, contact email, opening hours), team members (email and role) and what each of them does in the business tools (who validated, sold or recorded a use, added someone to the queue or gave something on the spot) and, if you take groups or run giveaways, what you reply to each request (and who on your team did it) and who handed over each prize; the queue settings (limit and minutes to turn up) and its code; plan and payments and, if it is an organisation, its type (what we ask to check it is under “Organisation account (the request)”), and, if it sets them, its kitchen hours and the name and password of its customer Wi-Fi (shown on its table QR page)</td><td>Register, verify and manage the business; invoice the subscription</td><td>Performance of a contract; legal obligation (invoicing)</td><td>During the relationship and afterwards for the statutory period (tax: 4 years; commercial: 6 years). If the business is handed over, the new holder gets access to its data, including billing data. When the subscription is cancelled we keep the request and its reason, if given. When a business is deleted we keep a minimal record (business name, date, who deleted it and figures without personal data) for 6 years</td></tr>
<tr><td>Business terms</td><td>If you register a business: which version of the business terms you accepted, when and with which account, and, when they change, when we sent you the notice by email and when you saw it or marked it as read in the app or in the dashboard</td><td>To be able to show that the business accepted the terms and was notified of each change with the notice period required by Regulation (EU) 2019/1150. The notice of a change to the business terms goes to the owner of each business; it is mandatory and cannot be turned off. If your address bounces our emails, we don't send it and the notice stays in the app and the dashboard</td><td>Performance of the contract with the business (art. 6(1)(b) GDPR) and compliance with a legal obligation (art. 6(1)(c) GDPR; Regulation (EU) 2019/1150, art. 3)</td><td>While the business exists on Klendar; it is deleted when the business is deleted. You can download it in “Download the business data”; “Download my data” shows which versions you accepted</td></tr>
<tr><td>Plan billing: notices, pause and VAT (businesses)</td><td>The <strong>VAT region</strong> (mainland Spain and Balearic Islands, Canary Islands, Ceuta or Melilla), which we work out from the venue's address; <strong>seasonal pauses</strong> (dates, who asked for it, paid days kept and how it ended); any manual unblocking we do (until which day); and the <strong>billing notices</strong> (which notice, for which day and whether the email was sent)</td><td>To apply the right VAT; to give notice before blocking a business and when its “Launch, free” period gets an end date; to run the pause. Billing notices (end of “Launch, free”, 7 days and 1 day before blocking, blocking and the end of a pause) go by email to the owner and in the app to the owner and managers; they're part of the service and can't be turned off</td><td>Performance of the contract with the business (art. 6(1)(b) GDPR) and compliance with a legal obligation (VAT, art. 6(1)(c) GDPR)</td><td>Notices, 400 days; the rest, like the business account</td></tr>
<tr><td>Claiming a business (“Is this your business?”)</td><td>Your account, the role you say you have, the business phone number or email you give us, the evidence you upload (a photo or a document) or what you tell us, your declaration that it is true, the date and what we decide (and why)</td><td>Check that you run that business and, if so, make you its owner; tell whoever was its owner that it has changed; prevent someone from taking over a business that isn't theirs. Only the Klendar team sees it, and the evidence is kept in private storage</td><td>Performance of a contract (art. 6(1)(b) GDPR: you ask for it) and legitimate interest (art. 6(1)(f)) in preventing impersonation and protecting businesses</td><td>The evidence, up to 6 months after the claim is resolved; the claim (who, when and what was decided), 2 years</td></tr>
<tr><td>Organisation account (the request)</td><td>Your account; the type of organisation, its official name, its tax ID (CIF), its official website and the area where it operates; your full name and your role; the document you upload to prove it (for example, your appointment, a certificate from the secretary, the board minutes or the entry in a register), your declaration that it is true, the date and what we decided (and why)</td><td>Checking that you represent that organisation before giving it the organisation badge and, if you signed up as an organisation, before its page and what it publishes are visible; preventing anyone from impersonating a council, an association or an NGO. The Klendar team and the business's team members can see it; the document, only you and Klendar, in private storage. If you sign up as an organisation, the official name and website appear on the public page; the CIF, your name, your role and the document do not</td><td>Performance of the contract (art. 6(1)(b) GDPR: you ask for it) and legitimate interest (art. 6(1)(f)) in preventing impersonation and in people knowing who publishes</td><td>The document, until 6 months after we decide (if you withdraw the request, a few days); the request (who, when and what was decided), 2 years</td></tr>
<tr><td>Content reports (also without an account)</td><td>If you report without an account: your name, your email (optional if it concerns child sexual abuse) and your language; if you report with your account, the account. In both cases: the reason, the text of the report, a copy of the reported content and the date. To stop abuse of reports made without an account, a digest of the connection calculated with a key that changes every day; never the IP address</td><td>Handle the report and reply to you: confirm we've received it and tell you what we've decided and why. The person who posted the content doesn't know who reported it</td><td>Legal obligation (art. 6(1)(c) GDPR; Regulation (EU) 2022/2065, art. 16)</td><td>Up to 2 years after the report is closed. The connection digest is deleted within 24 hours</td></tr>
<tr><td>Crash reports</td><td>Installation identifier, device model and OS, app version, technical crash report (without your name or email)</td><td>Detect and fix app crashes (Firebase Crashlytics)</td><td>Legitimate interest (art. 6(1)(f)): keeping the app working</td><td>90 days</td></tr>
<tr><td>App usage statistics (optional)</td><td>Installation identifier, screens and actions (viewing a deal, saving, redeeming, sharing, searching —without what you type—), device model and OS</td><td>Know what is used in order to improve the app (Firebase Analytics)</td><td>Consent (art. 6(1)(a)): unticked box at sign-up or in Settings → Privacy and data; withdrawn the same way</td><td>14 months</td></tr>
<tr><td>Marketing emails</td><td>Email</td><td>Send you Klendar news (never from third parties)</td><td>Specific consent ticked at sign-up; revocable in every email or in your profile</td><td>Until you withdraw it</td></tr>
<tr><td>“Tell me when…” alerts</td><td>The area you choose (point and radius), categories, maximum price</td><td>Tell you when something matching appears</td><td>Performance of a contract</td><td>Until you delete the alert or the account</td></tr>
<tr><td>Email summaries</td><td>Email, language, city, your favourites and plans</td><td>Send you the weekly summary with deals and plans from businesses (if you turn it on in Settings → Notifications; it starts off)</td><td>Consent; one-click unsubscribe in every email</td><td>Until you turn it off</td></tr>
<tr><td>Emails that bounce and changing your email</td><td>Your email, the date, the reason (bounce or marked as spam) and the technical details our email provider (Resend) gives us; when you change your email, the old and the new address</td><td>Stop sending you summaries and other non-essential emails while your address keeps bouncing our messages (account access emails are always sent) and let you know in the app and on the web; confirm an email change with a code to your current address and another to the new one. If we change it for you because you've lost access to your email, our admin log keeps the old address, the new one and how we verified your identity</td><td>Legitimate interest in not sending emails that don't arrive or that you don't want (Art. 6(1)(f) GDPR); performance of a contract for the email change</td><td>Until you change your email, tell us it works again or delete your account; the admin log, 2 years</td></tr>
<tr><td>Messages from your favourites</td><td>That you have the business in your favourites or stamps on one of its cards</td><td>Let the business send you an alert (at most one a week per venue), reviewed by Klendar; the business doesn't see who receives it</td><td>Consent (notifications); turn it off in Settings → Notifications</td><td>Inbox, 90 days</td></tr>
<tr><td>“You might like” suggestions</td><td>Your interests (see “Your interests and your city”), your latest searches and the categories you look at most, stored on your phone</td><td>Suggest something when there's nothing nearby; they're sent with that request and not stored on our servers</td><td>Performance of a contract</td><td>On your phone, until you delete them or the account</td></tr>
<tr><td>Your interests and your city</td><td>3 to 5 categories you choose (“Bars”, “Live music”…) and, if you want, your usual city (one of Klendar's cities, never your address or your position). When you chose them or whether you said “Not now”</td><td>Show you plans in those categories first in Discover and Explore, without hiding anything (they weigh within the order you choose: with “Newest” they count as if they were two days newer, with “Soonest” as if they started six hours earlier and with “Nearest” as if they were half as far away); take them into account in “You might like”; and, with your city, tell you about today's best when you open Klendar more than 50 km away from it. Without an account they're stored only on your phone; with an account, in it too, so they also work on the web and on another phone</td><td>Performance of a contract (you ask for it by choosing them; the step can be skipped)</td><td>Until you change or clear them (Settings → What you see → Your interests) or delete your account. On the web, the browser copy is deleted when you log out</td></tr>
<tr><td>Searches</td><td><strong>What you searched for:</strong> your last 10 searches, stored only on your phone or in your browser; they never reach us. <strong>Most searched:</strong> each search (the text, lower-case and without accents) is added to a counter for its city and day. We don't store who searched or your IP address: so that the same person counts once a day we use a digest with a secret key that changes and is thrown away every day, and that digest is deleted the next day. We don't count text that looks like personal data (emails, links, numbers of 4 digits or more) or offensive words</td><td>Show your recent searches when you tap the search box; and show everyone “Most searched in (city)”: only terms that at least 5 different people searched on some day, never today's, and without numbers</td><td>What you searched for: we don't process it (it's on your device). Most searched: legitimate interest (art. 6(1)(f) GDPR) in suggesting useful searches; what's stored is anonymous</td><td>What you searched for: until you clear it (one or all, in the search box) or uninstall the app / clear your browser data. Most searched: 30 days; the digest used to avoid counting twice, until the next day</td></tr>
<tr><td>Automatic translation</td><td>Whether you've turned on “Translate publications into my language” (with an account, in your profile; without one, on your phone or browser)</td><td>Show you businesses' text translated when the service is available</td><td>Performance of a contract (you choose it; it starts off)</td><td>Until you change it or delete your account</td></tr>
<tr><td>Share to stories</td><td>Nothing of yours: the image (1080 × 1920, with the photo, design and a QR code of the publication, business or collection) is made on your phone, or your browser downloads it from klendar.app. Whoever opens that QR code or link (<code>?ref=stories</code>, or <code>?ref=whatsapp</code> for the WhatsApp status image) leaves a counted visit, as does anyone arriving from the QR code on a venue's TV, from the venue poster's QR code or from a promoter's link: what was opened and when, with a key that changes every day and only serves to avoid counting the same person twice within 30 minutes (never the IP address or the account)</td><td>Let you share something on Instagram, in your WhatsApp status or on another network and let the business see how many visits come from there, and how many of those from WhatsApp (only the number)</td><td>Legitimate interest (art. 6(1)(f)) in counting, without identifying anyone, whether sharing works</td><td>The counted visit, 14 months. Whatever you post on another network is handled by that network (for example Meta, for Instagram and WhatsApp) under its own terms</td></tr>
<tr><td>Taps on a business page's links</td><td>Which link on a business page was tapped (type, domain and time); a temporary key so it isn't counted twice, made with a secret that changes every day and deleted after 30 minutes</td><td>Telling the business how often its links and menu are opened. When you tap “Book”, “Order delivery” or another link on a business page you leave Klendar: whatever you do there is handled by that service under its own privacy policy</td><td>Legitimate interest (art. 6(1)(f) GDPR) in giving the business figures, without knowing who taps</td><td>14 months; the temporary key, 30 minutes. Neither the account nor the IP is stored</td></tr>
<tr><td>Table QR scans</td><td>How many times a venue's table QR code is scanned each day (just the number); so the same connection isn't counted twice within 30 minutes, an encrypted summary of your connection made with a secret that changes every day (never the IP address or your account)</td><td>Giving the business the number of scans of its cards. The network and password you see are entered by the business</td><td>Legitimate interest (art. 6(1)(f) GDPR) in giving the business figures, without knowing who scans</td><td>The figure, 14 months; the summary, 24 hours. Neither the account nor the IP address is stored</td></tr>
<tr><td>Security</td><td>Encrypted digest of your connection (changes daily, never the IP address), trusted devices for fingerprint or Face ID login, codes to confirm it's you, technical website errors (no personal data)</td><td>Stop abuse, log in without a password on your devices, protect password changes and account deletion, detect failures</td><td>Legitimate interest (art. 6(1)(f))</td><td>Digest 24 h; devices 90 days unused; codes 1 h; errors 30 days</td></tr>
<tr><td>Consent history</td><td>What you have accepted or withdrawn and when</td><td>Being able to prove it (art. 7(1) GDPR)</td><td>Legal obligation (art. 6(1)(c))</td><td>While the account exists</td></tr>
{TEL['en']}<tr><td>Support</td><td>Email and the content of your message</td><td>Answer your enquiries</td><td>Performance of a contract / legitimate interest</td><td>1 year after closure</td></tr>
</table>
<p>To create an account you must give your email (or use your Google or Apple account), your name (the one businesses and your friends will see; it can be a nickname), your date of birth and accept the terms; without them the account can't be used. Everything else is optional.</p>
<p><strong>About the lock screen:</strong> while your code is showing, anyone holding your phone can read it without unlocking it. If your phone hides notification content on the lock screen, on Android you'll only see “You have a code ready” and the countdown; on iPhone the code number is hidden while the phone is locked if you've set it up that way.</p>
<p><strong>Artist pages.</strong> So people can follow an artist, we publish their <strong>stage name</strong> (the one they use publicly and which appears on posters), their upcoming dates and, where we have them, a photo, a short description and links to their public profiles (Spotify, Instagram…). We do this on the basis of legitimate interest (art. 6(1)(f) GDPR: informing about public events the artist announces), using data that is already public and no contact or personal details beyond their stage name. We only use photos we have the right to use (provided by the artist or their representative, or under a licence that allows it) and credit the author where required. <strong>If you are the artist</strong> (or represent them) and want us to change something, remove the photo or the page, or exercise your rights (access, rectification, objection, erasure), email <a href="mailto:{E}">{E}</a>: we'll review it within one month at most. A removed page stops being shown and won't come back even if a business types the name again (it stays hidden).</p>

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
<p><strong>Google (only if you use Klendar on a Wear OS watch):</strong> the code that's due (title, business, code, places and times) goes from your phone to your watch through Google Play services, encrypted; if the watch isn't near the phone it may go through Google's servers. Google acts under its own Wear OS terms, which you accepted when pairing the watch.</p>
<p>For “Based on the weather”, our server asks <strong>MET Norway</strong> (the Norwegian Meteorological Institute) for the forecast using only the centre of an area of about 10 km: none of your data reaches it. If you share something on <strong>Instagram</strong>, <strong>WhatsApp</strong> or another network from “Share to stories”, your phone hands the image to that app and from then on that network handles it as an independent controller, under its own terms.</p>
<p><strong>Reports</strong> are only seen by the Klendar team. We never give them to the person who posted the reported content; we only pass them on to the authorities if there are signs of a criminal offence (art. 18 of Regulation (EU) 2022/2065) or if a court or the competent authority requires it.</p>
<p><strong>Businesses</strong> see your display name and profile photo when you get a code or reserve a place in one of their publications (on their attendee list, which they can download, with the number of places, the time and whether you got in), when you have stamps on one of their cards, when they read your customer QR code (your passes from that business), when you get a number in their queue (your turn), when you win one of their giveaways, when you're among their 10 customers who came most the previous month (if they have “Thank your regulars” on) and when you post a review, as well as aggregate statistics. Never your email, phone number, date of birth or location, except the contact details you choose to give them when accepting their proposal in “Groups and companies”.</p>
<p><strong>Promoters</strong> (a venue's PR people) only see the people who came in through their link or QR code: their display name and photo, when they signed up, which offer, how many places and whether and when they got in. Never their email, phone number or date of birth. Whatever the venue pays its promoters is handled by the venue, outside Klendar.</p>
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
<p>You may exercise your rights of access, rectification, erasure, objection, restriction and portability, and withdraw consent at any time, by writing to <a href="mailto:{EP}">{EP}</a> from your account email. From the app or from “Your account” on the website (Account → Settings → Privacy and data) you can also see what you have consented to and when, withdraw location, push, usage statistics and marketing consent separately, stop showing your plans to your friends, see and unblock the people you have blocked, download all your data as a file, including your passes and each use, today's turn in a queue, your group requests (with each place's reply and the contact details you shared), your giveaway entries and prizes, the artists you follow, your coupons and gifts, what you've been given on the spot, the places you've asked for and your “Tell me when Klendar arrives” sign-ups (including any made without an account with your account's email) (access and portability), and <a href="/en/delete-account/">delete your account</a> entirely. If you believe we have not handled your request properly, you may lodge a complaint with the Spanish Data Protection Agency (<a href="https://www.aepd.es" rel="noopener">www.aepd.es</a>).</p>

<h2>6. Security</h2>
<p>Data is transmitted encrypted (TLS), passwords are stored hashed, database access is restricted by row-level security policies (each person only reaches their own data), and the providers listed hold recognised security certifications.</p>

<h2>7. Changes</h2>
<p>If we change this policy in a material way we will let you know in the app. The current version is always at <a href="https://klendar.app/privacidad/">klendar.app/privacidad</a> (Spanish, governing) and <a href="https://klendar.app/en/privacy/">klendar.app/en/privacy</a>.</p>
''')

    # ── Términos de uso ─────────────────────────────────────────────────────────
    ES['terminos'] = ('Términos de uso', 'Condiciones de uso de la app Klendar para personas usuarias.', f'''
<h2>1. Quiénes somos y qué es Klendar</h2>
<p>Klendar es una plataforma titularidad de {es.titular_frase} que permite descubrir ofertas de duración limitada y eventos de negocios locales, guardarlos, valorarlos y canjearlos con un código QR. Al crear una cuenta o usar la app aceptas estos términos y la <a href="/privacidad/">Política de privacidad</a>.</p>
<p><strong>Eventos de organizadores.</strong> Algunos negocios no tienen local: organizan fiestas o eventos en distintos sitios (salas, terrazas, espacios). En sus publicaciones, <strong>el organizador es quien responde del evento</strong>: de que se celebre, del precio, del aforo, de las condiciones, de la entrada y de lo que pase en él, aunque el sitio sea de otro. La sala que aparece como sitio solo es el lugar, salvo que el evento diga otra cosa. Si algo va mal, escribe primero al organizador (sus datos de contacto están en su ficha); si no te responde, cuéntanoslo en <a href="mailto:{E}">{E}</a>.</p>

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
  <li>Tu código puede verse en la pantalla de bloqueo de tu móvil, en su widget y en tu reloj. Quien lo enseñe en el local lo canjea: cuida quién tiene tu móvil o tu reloj, o apaga esta opción en Ajustes → Notificaciones → «Pantalla de bloqueo».</li>
  <li>El negocio puede exigir que la persona que canjea sea la titular de la cuenta y que se cumplan las condiciones publicadas (consumo mínimo, aforo, horario).</li>
  <li>Si un negocio no honra una oferta publicada, denúncialo desde la app; podremos suspender al negocio.</li>
  <li>Si un negocio deja de estar disponible en Klendar (por ejemplo, porque no ha pagado su plan o lo ha pausado por cierre), sus publicaciones dejan de verse, pero <strong>los códigos, reservas, bonos, sellos y premios que ya tienes siguen valiendo</strong> y el negocio debe atenderlos.</li>
  <li>Si entras por el enlace o el QR de un RRPP (relaciones públicas) de un local, te apuntas a su lista para esa noche: el RRPP verá tu nombre y si has entrado, y te lo decimos antes de conseguir nada. Las ofertas de RRPP solo se ven con ese enlace, tienen las plazas y la hora límite que fija el local y las honra el local como cualquier otra. Lo que haya entre el local y sus RRPP (pagos, comisiones) no tiene que ver con Klendar ni contigo.</li>
  <li>Si sigues una serie, te avisamos de cada fecha nueva que publique el negocio. El negocio puede terminarla o cancelarla; si cancela una fecha que tenías reservada, te avisamos y se anula tu reserva.</li>
  <li>«Según el tiempo» solo cambia el orden de lo que ves hoy, con la previsión de MET Norway; no garantiza el tiempo que hará. Puedes apagarlo cuando quieras.</li>
  <li>Algunos eventos traen «Escúchalo antes»: un enlace a Spotify, YouTube, SoundCloud, Apple Music o Bandcamp que pone el negocio. Se abre fuera de Klendar, en ese servicio y con sus condiciones y su privacidad.</li>
  <li>Agenda pública: en algunas ciudades enseñamos actividades que los ayuntamientos publican como datos abiertos, con su fuente y su licencia (ver <a href="/fuentes/">Fuentes y licencias</a>). Klendar no las organiza ni responde de cambios o cancelaciones: confirma la hora, el precio y las condiciones en la fuente. Si algo está mal, avísanos o díselo a quien lo organiza.</li>
  <li><strong>Dónde ver el partido:</strong> los partidos y sus horarios vienen de fuentes externas y de lo que dicen los bares; pueden cambiar o estar mal. Klendar no garantiza que un bar ponga un partido ni con sonido o en una pantalla concreta: es el bar quien lo dice y quien responde de ello.</li>
  <li>«Esta noche se mueve» enseña en el mapa zonas con ambiente según la actividad de las últimas 2 horas, de forma agregada y aproximada: es orientativo y no dice qué hay en cada local ni quién está.</li>
  <li><strong>Cupones, regalos y lo que has ahorrado.</strong> Algunos negocios te dan un cupón para la próxima visita al canjear o un regalo por ser de sus clientes más fieles. Los da y los cumple el negocio; valen una vez, en las fechas que dicen, y no se cambian por dinero. «Lo que has ahorrado» es una cuenta aproximada hecha con los precios que indican los negocios.</li>
  <li><strong>Pedir un local y «Avísame cuando llegue».</strong> Puedes pedir que un sitio esté en Klendar y que te avisemos cuando lleguemos a tu zona. Es una petición, no un compromiso: ni el local ni Klendar están obligados a nada. Escribe el nombre del sitio tal cual (no nombres de personas, datos de contacto ni textos ofensivos); juntamos las peticiones iguales y al negocio solo le decimos cuántas personas lo piden.</li>
  <li>La página del QR de mesa de un local enseña la red y la contraseña de su wifi tal como las escribe el negocio. Klendar no da ese wifi ni responde de él: es del local.</li>
</ul>

<h2>3 bis. Bonos de los negocios</h2>
<p>Algunos negocios venden bonos en su local (por ejemplo, «10 cafés por 12 €»). El bono lo vende, lo cobra y lo cumple el negocio: lo pagas allí, por los medios que acepte el negocio, y Klendar no cobra nada ni interviene en el pago. Klendar solo lleva la cuenta de los usos en tu cuenta y te los enseña en «Tus códigos». Lo que incluye el bono, su precio, su caducidad y sus condiciones los pone el negocio, que es quien responde de ellos y del servicio. Si tienes un problema con un bono (no te lo respetan, el servicio no es el prometido, quieres que te devuelvan el dinero), la reclamación va al negocio; te ayudamos con el historial de usos que tienes en la app.</p>
<p>Para cargar o usar un bono, enseña tu «QR de cliente». Cambia cada pocos segundos para que nadie pueda usar una captura; no lo compartas. Si ves un uso que no has hecho, escríbenos a <a href="mailto:{E}">{E}</a>.</p>
<p>Si un negocio deja Klendar (cierra o se da de baja), conservas tu bono y su historial en la app, pero Klendar ya no puede registrar usos nuevos: lo que te quede se lo reclamas directamente al negocio, que sigue obligado a cumplirlo.</p>

<h2>3 ter. Cola virtual</h2>
<p>Algunos locales tienen cola virtual en Klendar. La lleva el local:</p>
<ul>
  <li>Klendar te da el turno; quién entra y cuándo lo decide el local. La espera que ves es aproximada (sale del ritmo al que avisa el local) y puede cambiar.</li>
  <li>Para coger número necesitas una cuenta. Una entrada por persona en cada cola; si te sales, no puedes volver a cogerla ese día. Cuando te avisan tienes los minutos que marca el local para presentarte; si no llegas, pasa el siguiente.</li>
  <li>Klendar no responde de que el local te atienda; las reclamaciones, al local.</li>
</ul>

<h2>3 quater. Grupos y empresas</h2>
<p>Puedes pedir presupuesto para un grupo (una cena de empresa, un afterwork, una actividad de equipo, una celebración) a los negocios que aceptan grupos, a tres como mucho a la vez. Lo que te contesten es una <strong>propuesta orientativa</strong>: el precio, el menú, las condiciones y la reserva los cierras directamente con el negocio, y es el negocio quien responde de ellos. Klendar no reserva, no cobra nada y no es parte de ese acuerdo. Hasta que aceptas una propuesta, los negocios no ven quién eres; al aceptarla, compartimos con <strong>ese</strong> negocio el contacto que elijas (el correo de tu cuenta o un teléfono). Usa esta función para planes de verdad: como mucho 3 peticiones cada 24 horas, y las peticiones falsas o repetidas para molestar pueden suponer la suspensión de la cuenta. El negocio que recibe tu petición puede denunciarla si incumple las Normas de la comunidad. Si la retiramos, se cierra para todos los negocios a los que la mandaste y se borra tu nota, y te decimos el motivo y cómo pedirnos que lo revisemos (en un plazo de 6 meses).</p>

<h2>3 quinquies. Sorteos de los negocios</h2>
<p>Algunos negocios organizan sorteos en Klendar. Participar es <strong>gratis y sin compra</strong>, y solo pueden hacerlo personas mayores de 18 años con la fecha de nacimiento en su perfil (nunca el equipo del negocio). Cada sorteo tiene sus <strong>bases</strong>, siempre a la vista en su página, y participar supone aceptarlas. <strong>El organizador es el negocio</strong>: él pone el premio, lo entrega y responde de él y de las bases; Klendar solo pone la herramienta, hace el sorteo de forma automática y verificable y te avisa. Si ganas, tienes que aceptar el premio en la app dentro del plazo de las bases; si no, pasa al suplente. Si el premio vale más de 300 €, el organizador te pedirá tus datos fiscales (lo exige Hacienda). Hacer trampas (varias cuentas, cuentas falsas) anula la participación y puede suponer la suspensión de la cuenta. Klendar puede retirar un sorteo que incumpla las Normas de la comunidad o la ley: deja de verse y no se sortea. Si participabas, lo sigues viendo en tus sorteos como «Retirado» y te avisamos; el premio y las bases son cosa del negocio, que recibe el motivo. Si ves un sorteo engañoso, denúncialo.</p>

<h2>3 sexies. Dar en el momento</h2>
<p>Un negocio puede darte algo en su local sin que enseñes tu QR: te enseña un QR suyo, que tú escaneas con la app o con la cámara del móvil, y decides si lo aceptas. Puede ser uno o varios sellos de una de sus tarjetas, un uso de un bono que ya tienes de ese negocio (cuenta como un uso más, igual que si enseñaras tu QR de cliente) o algo que el negocio pone en ese momento (por ejemplo, «Postre invitado»). Lo que te da, cómo y sus condiciones los decide el negocio, que es quien lo cumple y responde de ello; Klendar solo lo apunta en tu cuenta. Si te dan algo del momento, lo verás en «Tus códigos» como ya canjeado. Puedes recibir lo de cada QR una vez, y como mucho 5 cosas al día en cada negocio. Si habla de alcohol o tabaco, solo pueden aceptarlo los mayores de 18. El QR cambia cada 30 segundos y una foto vieja no sirve; si ves algo en tu cuenta que no has aceptado, escríbenos a <a href="mailto:{E}">{E}</a>.</p>

<h2>4. Reseñas y contenido de usuarios</h2>
<ul>
  <li>Puedes publicar una reseña por negocio (editable). Debe basarse en tu experiencia real y respetar las <a href="/normas/">Normas de la comunidad</a>.</li>
  <li>Concedes a Klendar una licencia no exclusiva, gratuita y mundial para mostrar tus reseñas, con sus fotos y vídeos, en la Plataforma mientras estén publicadas. Eres responsable de tener permiso de las personas que salgan en ellas.</li>
  <li>Puedes compartir publicaciones, negocios y selecciones fuera de Klendar (enlace o imagen para historias). Lo que publiques en otras redes se rige por sus condiciones; no cambies la imagen de forma que engañe sobre la oferta.</li>
  <li>Podemos retirar contenido que incumpla las normas y suspender cuentas reincidentes, con la motivación y vías de recurso previstas en el Reglamento de Servicios Digitales (DSA). Antes de publicarse, los textos pasan por una moderación automática que puede dejarlos en revisión hasta que los mire una persona; cómo funciona está en las <a href="/normas/">Normas de la comunidad</a>.</li>
</ul>

<h2>5. Uso permitido</h2>
<p>No está permitido: usar la app para fines ilegales; intentar acceder a datos de otras personas o negocios; manipular canjes, reseñas o valoraciones; extraer datos de forma automatizada; ni interferir con el funcionamiento del servicio.</p>

<h2>6. Disponibilidad y cambios</h2>
<p>Trabajamos para que Klendar esté disponible siempre, pero no garantizamos ausencia de interrupciones. Podemos modificar o retirar funciones. Si un cambio en estos términos es relevante, te avisaremos en la app con antelación razonable y te pediremos que los aceptes de nuevo; si no estás de acuerdo, puedes eliminar tu cuenta en cualquier momento.</p>

<h2>7. Responsabilidad</h2>
<p>En la medida permitida por la ley, Klendar no responde de los daños derivados de ofertas o eventos publicados por los negocios, ni de decisiones tomadas en base a la información de la Plataforma. Algunos negocios ponen en su ficha enlaces a otros servicios para reservar o pedir (TheFork, Glovo…). Esos servicios no son de Klendar: la reserva, el pedido y el pago son entre tú, el negocio y ese servicio, con sus condiciones. Nada en estos términos limita los derechos que te reconoce la normativa de consumo.</p>

<h2>8. Legislación y jurisdicción</h2>
<p>Se aplica la legislación española, sin perjuicio de las normas de protección de las personas consumidoras de tu país de residencia que te sean más favorables. Si tienes un problema, escríbenos antes a <a href="mailto:{E}">{E}</a> e intentaremos resolverlo. Como persona consumidora, también puedes dirigirte a los servicios de consumo de tu comunidad autónoma o de tu ayuntamiento, acudir al arbitraje de consumo si las dos partes lo aceptan, o presentar tu reclamación ante los juzgados de tu domicilio.</p>
''')

    EN['terminos'] = ('terms', 'Terms of use', 'Terms of use of the Klendar app for users.', f'''
<h2>1. Who we are and what Klendar is</h2>
<p>Klendar is a platform owned by {en.titular_frase} that lets you discover time-limited deals and events from local businesses, save them, review them and redeem them with a QR code. By creating an account or using the app you accept these terms and the <a href="/en/privacy/">Privacy policy</a>.</p>
<p><strong>Events by organisers.</strong> Some businesses don't have a venue: they run parties or events in different places (clubs, terraces, spaces). In their publications, <strong>the organiser is responsible for the event</strong>: that it takes place, the price, capacity, conditions, entry and what happens there, even if the place belongs to someone else. The venue shown is just the place, unless the event says otherwise. If something goes wrong, contact the organiser first (their contact details are on their page); if they don't reply, tell us at <a href="mailto:{E}">{E}</a>.</p>

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
  <li>Your code can show on your phone's lock screen, in its widget and on your watch. Whoever shows it at the venue redeems it: be careful who has your phone or watch, or turn this off in Settings → Notifications → “Lock screen”.</li>
  <li>The business may require that the person redeeming is the account holder and that the published conditions are met (minimum spend, capacity, opening hours).</li>
  <li>If a business does not honour a published deal, report it from the app; we may suspend the business.</li>
  <li>If a business stops being available on Klendar (for example, because it hasn't paid for its plan or has paused it while closed), its publications are hidden, but <strong>the codes, bookings, passes, stamps and rewards you already have remain valid</strong> and the business must honour them.</li>
  <li>If you come in through a venue promoter's link or QR code, you join their list for that night: the promoter will see your name and whether you got in, and we tell you before you get anything. Promoter offers can only be seen through that link, have the places and time limit set by the venue and are honoured by the venue like any other. Whatever happens between the venue and its promoters (payments, commissions) has nothing to do with Klendar or with you.</li>
  <li>If you follow a series, we tell you about each new date the business publishes. The business can end or cancel it; if it cancels a date you had booked, we let you know and your booking is cancelled.</li>
  <li>“Based on the weather” only changes the order of what you see today, using MET Norway's forecast; it doesn't guarantee the weather. You can turn it off whenever you like.</li>
  <li>Some events have “Listen first”: a Spotify, YouTube, SoundCloud, Apple Music or Bandcamp link added by the business. It opens outside Klendar, in that service and under its terms and privacy policy.</li>
  <li>Public listings: in some cities we show activities that councils publish as open data, with their source and licence (see <a href="/en/sources/">Sources and licences</a>). Klendar doesn't organise them and isn't responsible for changes or cancellations: check the time, price and conditions at the source. If something is wrong, let us know or tell the organiser.</li>
  <li><strong>Where to watch the match:</strong> matches and their times come from external sources and from what bars say; they can change or be wrong. Klendar doesn't guarantee that a bar will show a match, nor with sound or on a particular screen: the bar says so and is responsible for it.</li>
  <li>“Buzzing tonight” shows busy areas on the map based on activity in the last 2 hours, in an aggregated and approximate way: it's a guide and doesn't say what's on at each venue or who is there.</li>
  <li><strong>Coupons, gifts and what you've saved.</strong> Some businesses give you a coupon for your next visit when you redeem, or a gift for being one of their most loyal customers. The business gives them and honours them; they can be used once, on the dates shown, and can't be exchanged for money. “What you've saved” is an approximate figure based on the prices businesses give.</li>
  <li><strong>Asking for a place and “Tell me when it arrives”.</strong> You can ask for a place to be on Klendar and for us to tell you when we reach your area. It's a request, not a commitment: neither the venue nor Klendar is bound by it. Type the place's name as it is (no people's names, contact details or offensive text); we group identical requests and only tell the business how many people ask for it.</li>
  <li>A venue's table QR page shows its Wi-Fi network and password exactly as the business writes them. Klendar does not provide that Wi-Fi and is not responsible for it: it belongs to the venue.</li>
</ul>

<h2>3a. Passes from businesses</h2>
<p>Some businesses sell passes at their venue (for example, “10 coffees for €12”). The business sells the pass, takes payment for it and honours it: you pay there, by whatever means the business accepts, and Klendar doesn't charge anything or take part in the payment. Klendar only keeps count of the uses in your account and shows them to you in “Your codes”. What the pass includes, its price, its expiry and its conditions are set by the business, which is responsible for them and for the service. If you have a problem with a pass (it isn't honoured, the service isn't what was promised, you want a refund), the claim is against the business; we can help with the history of uses in the app.</p>
<p>To add or use a pass, show your “customer QR code”. It changes every few seconds so nobody can use a screenshot; don't share it. If you see a use you didn't make, write to us at <a href="mailto:{E}">{E}</a>.</p>
<p>If a business leaves Klendar (it closes or deletes its account), you keep your pass and its history in the app, but Klendar can no longer record new uses: anything left is a matter for the business, which is still bound to honour it.</p>

<h2>3b. Virtual queue</h2>
<p>Some venues have a virtual queue on Klendar. It's run by the venue:</p>
<ul>
  <li>Klendar gives you your turn; who goes in and when is the venue's decision. The wait you see is approximate (based on how fast the venue calls people) and may change.</li>
  <li>You need an account to get a number. One entry per person in each queue; if you leave, you can't get it back that day. When you're called you have the minutes set by the venue to get there; if you don't arrive, the next person goes.</li>
  <li>Klendar doesn't guarantee that the venue serves you; complaints go to the venue.</li>
</ul>

<h2>3c. Groups and companies</h2>
<p>You can ask places that take groups for a quote for a group (a company dinner, an afterwork, a team activity, a celebration), up to three at a time. What they reply is an <strong>indicative proposal</strong>: you agree the price, menu, conditions and booking directly with the place, and the place is responsible for them. Klendar doesn't book, doesn't charge anything and isn't a party to that agreement. Until you accept a proposal, the places can't see who you are; when you accept it, we share with <strong>that</strong> place the contact details you choose (your account email or a phone number). Use this feature for real plans: up to 3 requests every 24 hours, and fake or repeated requests to cause a nuisance may lead to the account being suspended. A business that receives your request can report it if it breaks the Community guidelines. If we remove it, it is closed for every business you sent it to and your note is deleted, and we tell you the reason and how to ask us to review it (within 6 months).</p>

<h2>3d. Giveaways from businesses</h2>
<p>Some businesses run giveaways on Klendar. Entering is <strong>free with no purchase</strong>, and only people aged 18 or over with their date of birth in their profile can enter (never the business's team). Each giveaway has its <strong>rules</strong>, always visible on its page, and entering means accepting them. <strong>The organiser is the business</strong>: it provides the prize, hands it over and is responsible for it and for the rules; Klendar only provides the tool, runs the draw automatically and verifiably, and notifies you. If you win, you must accept the prize in the app within the time set in the rules; otherwise it goes to the reserve. If the prize is worth more than €300, the organiser will ask for your tax details (the tax authority requires it). Cheating (several accounts, fake accounts) voids the entry and may lead to the account being suspended. Klendar can remove a giveaway that breaks the Community guidelines or the law: it stops being visible and isn't drawn. If you had entered, you'll still see it in your giveaways as “Removed” and we'll let you know; the prize and the rules are the business's responsibility, and it receives the reason. If you see a misleading giveaway, report it.</p>

<h2>3e. Give on the spot</h2>
<p>A business can give you something at its venue without you showing your QR code: it shows you a QR code of its own, which you scan with the app or your phone's camera, and you decide whether to accept it. It can be one or more stamps on one of its cards, one use of a pass you already have from that business (it counts as one more use, just as if you had shown your customer QR code) or something the business sets there and then (for example, “Free dessert”). What it gives you, how and on what conditions are up to the business, which honours it and is responsible for it; Klendar only records it in your account. If you're given something on the spot, you'll see it in “Your codes” as already redeemed. You can receive what each QR code gives once, and at most 5 things a day at each business. If it mentions alcohol or tobacco, only over-18s can accept it. The QR code changes every 30 seconds and an old photo won't work; if you see something in your account that you didn't accept, write to us at <a href="mailto:{E}">{E}</a>.</p>

<h2>4. Reviews and user content</h2>
<ul>
  <li>You may post one review per business (editable). It must be based on your real experience and follow the <a href="/en/community-guidelines/">Community guidelines</a>.</li>
  <li>You grant Klendar a non-exclusive, royalty-free, worldwide licence to display your reviews, with their photos and videos, on the Platform while they are published. You are responsible for having permission from anyone who appears in them.</li>
  <li>You can share publications, businesses and collections outside Klendar (a link or a stories image). What you post on other networks is governed by their terms; don't alter the image in a way that misleads about the offer.</li>
  <li>We may remove content that breaches the guidelines and suspend repeat offenders, with the statement of reasons and appeal routes provided by the Digital Services Act (DSA). Before going live, text goes through automatic moderation that may hold it for review until a person has looked at it; how it works is explained in the <a href="/en/community-guidelines/">Community guidelines</a>.</li>
</ul>

<h2>5. Acceptable use</h2>
<p>You may not: use the app for unlawful purposes; attempt to access other people's or businesses' data; manipulate redemptions, reviews or ratings; scrape data automatically; or interfere with the operation of the service.</p>

<h2>6. Availability and changes</h2>
<p>We work to keep Klendar available at all times but cannot guarantee it will be free of interruptions. We may change or withdraw features. If a change to these terms is material, we will notify you in the app with reasonable notice and ask you to accept them again; if you do not agree, you can delete your account at any time.</p>

<h2>7. Liability</h2>
<p>To the extent permitted by law, Klendar is not liable for damages arising from deals or events published by businesses, or from decisions made on the basis of information on the Platform. Some businesses add links to other services on their page to book or order (TheFork, Glovo…). Those services aren't Klendar's: the booking, the order and the payment are between you, the business and that service, under their terms. Nothing in these terms limits the rights granted to you by consumer law.</p>

<h2>8. Governing law and jurisdiction</h2>
<p>Spanish law applies, without prejudice to any more favourable consumer protection rules of your country of residence. If you have a problem, write to us first at <a href="mailto:{E}">{E}</a> and we will try to solve it. As a consumer, you may also contact the consumer affairs services of your region or local council, use consumer arbitration if both parties agree to it, or bring your claim before the courts of your place of residence.</p>
''')

    # ── Condiciones para negocios ───────────────────────────────────────────────
    ES['negocios'] = ('Condiciones para negocios', 'Condiciones de contratación del servicio Klendar para negocios.', f'''
<p class="notice">Los cambios del 5 de octubre de 2026 (apartados 2, 2 bis, 3, 7 y 10) se aplican desde el <strong>20 de octubre de 2026</strong>, los del 6 de octubre de 2026 (apartados 2 bis y 3), desde el <strong>21 de octubre de 2026</strong>, los del 7 de octubre de 2026 (apartados 2 bis, 3, 3 bis y 3 ter), desde el <strong>22 de octubre de 2026</strong>, los del 13 de octubre de 2026 (apartados 3, 3 quater, 3 quinquies y 3 sexies), desde el <strong>28 de octubre de 2026</strong>, los del 14 de octubre de 2026 (apartados 3 bis, 4, 4 bis, 5, 6 y 10), desde el <strong>29 de octubre de 2026</strong>, y los del 16 de octubre de 2026 (apartados 3, 3 septies, 3 octies y 3 nonies), desde el <strong>31 de octubre de 2026</strong>: 15 días después de publicarlos y avisar al Negocio (Reglamento (UE) 2019/1150, art. 3.2). La «Pausa por cierre» (apartado 5) se aplica desde que se publica, porque solo añade una opción a favor del Negocio. Si no está de acuerdo, puede darse de baja antes de esas fechas, sin penalización.</p>
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
<p>Klendar permite al Negocio publicar ofertas flash y eventos (con reserva de plazas y lista de espera si lo activa, y en series de fechas que la gente puede seguir), novedades, su carta y horarios, describir cómo es su local («Cómo es tu local»), gestionar su ficha, ofrecer tarjetas de sellos y un regalo de cumpleaños, avisar a sus clientes (como mucho una vez por semana y local, con revisión de Klendar), trabajar con relaciones públicas (RRPP) con sus enlaces, listas y ofertas propias, validar canjes mediante QR y consultar estadísticas. Las personas pueden compartir sus publicaciones y su ficha fuera de Klendar (enlace e imagen para historias). Klendar no interviene en la venta ni cobra a las personas usuarias.</p>

<h2>2 bis. Cómo se ordena lo que se ve</h2>
<p>En Descubre, Explorar, el mapa y la agenda las publicaciones se ordenan con estos criterios, por este orden de importancia: (1) en Descubre y en la agenda, lo destacado de pago («Destacado»), que siempre sale con esa etiqueta, y en las selecciones que prepara Klendar (por ejemplo, «Con niños»), el orden que Klendar les da; (2) con «Según el tiempo» encendido (lo está de serie), si hoy llueve, lo de hoy bajo techo primero y lo de hoy al aire libre al final, y si hace buen tiempo, lo de hoy en terraza o al aire libre primero, según lo que el Negocio marca en «Cómo es tu local» o en cada publicación; (3) el orden que elige la persona en «Ordenar» (más cerca, más pronto o novedades); (4) si la persona ha elegido sus gustos (de 3 a 5 categorías), lo de esas categorías pesa más dentro del orden que ha elegido, sin esconder lo demás: con «Novedades» cuenta como si fuera dos días más nuevo, con «Más pronto» como si empezara seis horas antes y con «Cercanía» como si estuviera a la mitad de distancia; (5) los eventos que Klendar importa de la agenda pública de los ayuntamientos (datos abiertos, marcados con su fuente) salen como mucho uno de cada cinco, intercalados en el mismo orden, mientras haya publicaciones de negocios y entidades (en el mapa, como mucho la cuarta parte de los puntos; en las selecciones que Klendar ordena a mano, manda su orden); no se esconde nada. Lo que publica una entidad por sí misma cuenta como cualquier publicación. Los filtros de la persona (distancia, categoría, precio, «¿Cuándo?», «El sitio», «Abierto ahora», solo con descuento) deciden qué se ve, no el orden. «Tendencia» es una etiqueta (muchas personas distintas lo han conseguido hoy) y no cambia el orden. La valoración del Negocio, la cuota o el número de publicaciones no influyen en el orden. Si cerca no hay nada, se sugieren publicaciones de fuera del radio según los gustos, las búsquedas y las categorías que la persona mira, guardados en su móvil o en su cuenta.</p>

<h2>3. Obligaciones del Negocio</h2>
<ul>
  <li><strong>Honrar las ofertas publicadas</strong> en las condiciones indicadas durante su vigencia y hasta agotar el aforo declarado.</li>
  <li>Honrar los premios de sus tarjetas de sellos y el regalo de cumpleaños mientras los ofrezca.</li>
  <li>Publicar el precio final que pagará la persona, con el IVA y cualquier otro cargo incluidos.</li>
  <li>Si anuncia una rebaja, indicar como precio anterior el más bajo que haya aplicado en los 30 días anteriores.</li>
  <li>Publicar solo contenido veraz, lícito, del que tenga derechos (fotos, textos) y conforme a las <a href="/normas/">Normas de la comunidad</a>.</li>
  <li>Cumplir la normativa aplicable a su actividad, incluida la de publicidad de bebidas alcohólicas (Ley 34/1988 y normativa autonómica) y la protección de menores: los negocios de ocio nocturno o cuyas ofertas incluyan alcohol deben marcarse como "+18".</li>
  <li>Describir su local y cada publicación con verdad en «Cómo es tu local» y en «¿Para niños?» / «¿Bajo techo o al aire libre?»: en especial, «Accesible en silla de ruedas», «Apto para niños» y «Zona infantil», en los que la gente confía para decidir.</li>
  <li>Si pone un horario de cocina, tiene que ser el real: Klendar lo usa para decir «Cocina: hasta las …», para el filtro «Se puede comer ahora» y para retirar el menú del día.</li>
  <li>Si trabaja con RRPP: elegirlos, darles de alta y de baja en Klendar y responder de lo que hagan en su nombre; acordar y pagar fuera de Klendar lo que les corresponda; usar los datos de sus listas solo para gestionar la entrada de esa noche y sus cifras, y no invitar como RRPP a menores de 16 años (ni de 18 si el Negocio es "+18"). Klendar no es parte de la relación entre el Negocio y sus RRPP.</li>
  <li>Honrar las ofertas de RRPP con las plazas y la hora límite que haya fijado, como cualquier otra oferta.</li>
  <li>Respetar las fechas que publique en una serie; si cancela una fecha con reservas, Klendar avisa a cada persona y anula sus reservas.</li>
  <li>Tratar los datos de las personas usuarias que conozca (nombre y foto al conseguir un código o reservar, la lista de asistentes y la de sus RRPP) solo para prestar el servicio, sin fines propios ni cesiones.</li>
  <li>Si una publicación pide carné de estudiante, carné joven o ser mayor de 65, comprobarlo él mismo. Klendar no verifica la identidad ni la edad de nadie para estos descuentos; el escáner solo le recuerda que lo pida.</li>
  <li>Si pone Klendar en una tele de su local («Poner en la tele»), responder de dónde está y de quién la ve, y desvincularla desde «Poner en la tele» si la cambia de sitio, la vende o deja de ser suya.</li>
  <li>Si marca que pone un partido o un evento («Lo ponemos»), tener los derechos para emitirlo en su local (por ejemplo, la suscripción para hostelería de la plataforma que lo emite) y ponerlo de verdad. Klendar no lo comprueba y puede quitar la marca si recibe quejas.</li>
  <li><strong>Sin local fijo.</strong> Si marca «No tengo local fijo», cada publicación debe decir dónde es (nombre y dirección del sitio) y tiene que contar con el permiso del sitio para anunciarlo. Responde del evento ante la gente como organizador (precio, aforo, seguridad, licencias y seguros que pida la normativa de espectáculos públicos de su comunidad autónoma), aunque el local sea de otro.</li>
  <li><strong>Quién actúa.</strong> Si pone artistas en un evento, que de verdad actúen y con su nombre artístico tal cual. Klendar crea con ese nombre una página pública del artista con sus próximas fechas en cualquier local; el Negocio solo pone el nombre: la foto, la descripción y los enlaces los revisa y decide Klendar. No puede poner como artista a una persona particular, ni nombres ofensivos o que lleven a engaño (anunciar a alguien que no va).</li>
  <li><strong>Alérgenos y dietas.</strong> Si marca en su ficha «Opciones sin gluten», «Apto para celíacos», «Opciones veganas», «Opciones vegetarianas», «Opciones sin lactosa» o «Halal», lo declara él y bajo su responsabilidad: debe marcar solo lo que ofrece siempre y puede garantizar. «Sin gluten» es una mención regulada (Reglamento de Ejecución (UE) 828/2014) y la información sobre alérgenos de lo que sirve es suya (Reglamento (UE) 1169/2011 y Real Decreto 126/2015); lo que ponga en Klendar no la sustituye: tiene que tenerla también en el local. Klendar no comprueba estas marcas y puede quitarlas si recibe quejas fundadas.</li>
  <li><strong>Enlaces y carta.</strong> Los enlaces que ponga en su ficha («Reservar», «Pedir a domicilio», «Pedir en el local» u otros) tienen que llevar a páginas suyas o de servicios que use de verdad para su negocio, sin engañar sobre a dónde llevan ni pedir datos o pagos con otra identidad. Lo que pase en esas páginas (reservas, pedidos, pagos, sus condiciones y su privacidad) es cosa del Negocio y de ese servicio, no de Klendar. Los archivos de su carta (fotos y PDF) tienen que ser su carta, con precios y alérgenos al día, y sin datos de personas. Klendar puede quitar un enlace o un archivo que no cumpla esto.</li>
  <li><strong>Cupones y regalos.</strong> Si activa el cupón para la próxima visita o manda un regalo a sus habituales, se compromete a darlo tal y como lo describe mientras el código valga, igual que una oferta. Si deja Klendar o se desactiva su ficha, los que no se hayan usado se anulan y Klendar avisa a cada persona.</li>
  <li><strong>Primera visita.</strong> Una oferta «solo para quien viene por primera vez» tiene que serlo de verdad: no puede usarla para atraer con algo que luego no da. Klendar comprueba que la persona no haya canjeado antes en el Negocio; su equipo no puede usarla.</li>
  <li><strong>Habituales.</strong> La lista de sus clientes más fieles es solo para agradecérselo dentro de Klendar. No puede copiarla, cruzarla con otros datos ni usarla para contactar por otras vías.</li>
</ul>

<h2>3 bis. Cuentas de entidad</h2>
<p>Un ayuntamiento, una junta municipal de distrito, una asociación de comerciantes, una asociación vecinal, una ONG u otra entidad sin ánimo de lucro (la «Entidad») puede tener una cuenta de entidad. Se pide al darse de alta en Klendar («Un ayuntamiento, asociación u ONG») o, si ya tiene ficha, desde «Tu ficha › Cuenta de entidad», con el nombre oficial, el CIF y la web oficial de la Entidad, el nombre y el cargo de quien la pide y un documento que acredite que la representa. Klendar la concede después de comprobarlo (ver «Cómo lo comprobamos»). Una Entidad que se da de alta así no puede publicar hasta que Klendar lo haya comprobado. Con la cuenta de entidad, la ficha y las publicaciones llevan un sello con el tipo de entidad («Ayuntamiento», «Asociación de comerciantes»…) y aparecen en el filtro «Agenda pública».</p>
<p>Una Entidad publica como cualquier Negocio y se compromete además a: a) publicar solo actividades abiertas al público o de interés para el barrio o la ciudad (fiestas, mercadillos, campañas de comercio local, actividades culturales, deportivas o solidarias); b) no usar la cuenta para propaganda electoral o de partido, ni para publicidad institucional prohibida en periodo electoral; c) mantener al día quién gestiona la cuenta y avisarnos si deja de representar a la Entidad.</p>
<p>Cómo lo comprobamos: revisamos el documento (por ejemplo, el nombramiento, un certificado de la secretaría con el sello o el código seguro de verificación, el acta de la junta o la inscripción en el registro de asociaciones o de entidades que corresponda) y lo contrastamos con la información pública de la Entidad: su web oficial, su sede electrónica o el registro correspondiente. Podemos pedir más información, escribir al correo o llamar al teléfono que figuran en la web oficial de la Entidad (nunca a uno que nos dé quien lo pide), denegar la cuenta explicando el motivo y retirar el sello si los datos dejan de ser ciertos, sin perjuicio de lo previsto en el apartado 6. Pedir una cuenta de entidad con datos o documentos falsos puede suponer la suspensión de la cuenta.</p>
<p>Mientras Klendar no diga otra cosa, las cuentas de entidad no pagan cuota. Si eso cambia, se avisará con al menos 15 días de antelación y la Entidad podrá darse de baja sin coste.</p>

<h2>3 ter. Bonos</h2>
<p>El Negocio puede vender bonos de su local y llevar con Klendar la cuenta de los usos. Al hacerlo:</p>
<ul>
  <li>El bono lo vende y lo cobra el Negocio, en su local y por sus medios. Klendar no cobra nada a la persona, no recibe ese dinero y no es parte del contrato entre el Negocio y ella. El precio que el Negocio pone en Klendar es informativo (para sus cifras y para que la persona sepa qué compró) y tiene que ser el que cobra.</li>
  <li>El Negocio tiene que cumplir cada bono vendido en sus términos (usos, lo que incluye, caducidad y condiciones) aunque luego lo pause, lo quite o lo cambie: lo que cambie vale solo para las ventas siguientes. El Negocio responde ante la persona del servicio, de las devoluciones y de las reclamaciones, según la normativa de consumo.</li>
  <li>Las condiciones y la caducidad tienen que ser claras y legales. El Negocio no puede poner condiciones que la ley de consumo considere abusivas (por ejemplo, una caducidad desproporcionada o perder lo pagado si el Negocio cierra).</li>
  <li>El Negocio solo carga un bono cuando la persona lo haya pagado y solo descuenta un uso cuando lo disfrute. Cada venta y cada uso quedan registrados con quién del equipo lo hizo y la persona lo ve en su historial. El Negocio responde de lo que haga su equipo.</li>
  <li>Las obligaciones fiscales de la venta (factura o ticket e IVA) son del Negocio.</li>
  <li>Si el Negocio va a cerrar, a dejar de dar el servicio o a darse de baja en Klendar con bonos sin gastar, tiene que avisar a esas personas con tiempo y cumplir o devolver lo que corresponda. Tras la baja, la persona conserva su historial en Klendar, pero la obligación del Negocio sigue: Klendar no la asume.</li>
</ul>

<h2>3 quater. Cola virtual</h2>
<p>Es opcional. Si el Negocio la abre, avisará por orden de llegada, no quitará a nadie sin motivo y dará un tiempo razonable para presentarse. A quien apunte a mano (sin la app), con su permiso y solo con el nombre que necesite para llamarle. Responde de lo que haga su equipo con la cola; Klendar puede desactivarla en un negocio que la use mal, según el apartado 6.</p>

<h2>3 quinquies. Grupos y empresas</h2>
<p>Si el Negocio marca «Aceptamos grupos», le pueden pedir presupuesto para grupos. Al hacerlo:</p>
<ul>
  <li>Lo que diga (hasta cuántas personas, para qué, su nota y cada propuesta) tiene que ser verdad y poder cumplirse. El precio por persona de una propuesta es orientativo: si cambia, tiene que decírselo a la persona antes de cerrar nada.</li>
  <li>Tiene que contestar en el plazo (72 horas o hasta el día del plan, lo que llegue antes; lo ve en cada petición) o decir que no puede. Las peticiones que no contesta caducan solas.</li>
  <li>El contacto que le da la persona al aceptar su propuesta es solo para cerrar con ella ese plan. No puede usarlo para publicidad, cederlo ni guardarlo más de lo necesario; desde que lo recibe es responsable de él (RGPD). Klendar lo borra de su panel 30 días después de la fecha.</li>
  <li>La reserva, el pago, las señales y las cancelaciones los acuerda el Negocio con la persona, fuera de Klendar, y responde de ellos según la normativa de consumo. Klendar no es parte de ese acuerdo.</li>
  <li>Solo el propietario y los encargados ven y contestan las peticiones.</li>
</ul>

<h2>3 sexies. Sorteos</h2>
<p>El Negocio puede organizar sorteos en Klendar. Al crear uno <strong>el Negocio es el organizador</strong> (con la razón social y el NIF que declare, que salen en las bases) y acepta:</p>
<ul>
  <li><strong>Gratis y sin compra.</strong> Participar no puede exigir comprar, pagar ni nada más que lo que permite Klendar (tener el negocio en favoritos). No puede pedir fuera de Klendar condiciones distintas (compartir, etiquetar, comprar).</li>
  <li><strong>Bases.</strong> Las genera Klendar con sus datos y se publican antes de empezar. Sus condiciones (el campo «Condiciones») no pueden contradecirlas ni recortar lo que dicen. Con alguien dentro, el sorteo no se cambia; solo se cancela por una causa justificada, con el motivo, que se envía a quienes participan. Cancelar sin causa o repetidamente se considera engañoso.</li>
  <li><strong>El premio.</strong> Tiene que existir, ser el que describe y tener el valor aproximado que pone. Lo entrega el Negocio, gratis, a quien gane (o al suplente que le toque) en un plazo razonable y como digan las bases o sus condiciones, y lo marca en Klendar cuando lo entregue. No puede cambiarlo por otro de menor valor ni cobrar nada por entregarlo. No se pueden sortear tabaco, productos de vapeo ni apuestas; un premio con alcohol, solo para mayores de 18.</li>
  <li><strong>Impuestos.</strong> Si el premio vale más de 300 €, el Negocio practica la retención o el ingreso a cuenta del 19 % del IRPF y lo declara (modelos 111 y 190, o los que correspondan), y pide a quien gane los datos que necesite para ello. Si las normas de su comunidad autónoma piden algún trámite para los sorteos promocionales, también es cosa suya. Klendar no retiene ni declara nada.</li>
  <li><strong>Datos.</strong> Solo recibe el nombre y la foto de quien gana (y los datos fiscales que le dé). Los usa solo para entregar el premio y cumplir con Hacienda, y responde de ellos (RGPD).</li>
  <li><strong>Verificable.</strong> El sorteo lo hace Klendar de forma automática y comprobable; el Negocio no puede elegir a quien gana ni pedir que se repita.</li>
  <li>Como mucho 3 sorteos abiertos a la vez. Klendar puede retirar un sorteo que incumpla esto, las normas o la ley, avisando a quienes participan.</li>
</ul>

<h2>3 septies. Dar en el momento</h2>
<p>Desde «Validar códigos» puedes dar sellos de tus tarjetas, un uso de un bono que la persona ya tiene o algo del momento (un texto libre) con un QR de tu negocio que la persona escanea y acepta. Al hacerlo:</p>
<ul>
  <li>Lo que pones es una oferta tuya: tienes que darlo en ese momento y en los términos que has escrito. Tú respondes ante la persona, según la normativa de consumo; Klendar no es parte.</li>
  <li>Solo para quien está en tu local: no enseñes ni compartas el QR fuera de él (redes, chats, carteles) y no lo uses para dar sellos o visitas a quien no ha venido, a tu equipo o a ti mismo. Lo que se da así cuenta para «Cliente verificado» y en tus cifras como visita: usarlo para inflar reseñas o cifras es una práctica engañosa (art. 6 y apartado 6) y podemos retirar la función, las reseñas afectadas o suspender la cuenta.</li>
  <li>El texto de «algo del momento» tiene que ser lícito y claro: nada engañoso, ofensivo, de apuestas o juegos de azar, ni que sea dinero o algo que no puedas dar. Si habla de alcohol o tabaco, Klendar solo deja aceptarlo a mayores de 18, pero en el local eres tú quien tiene que comprobar la edad y cumplir la normativa (no se puede dar alcohol ni tabaco a menores).</li>
  <li>Un uso de bono dado así es un uso normal del bono (apartado 3 ter): solo cuando la persona lo disfruta.</li>
  <li>Cada cosa dada queda registrada con quién de tu equipo abrió el QR, y la persona lo ve en su cuenta. Eres responsable de lo que haga tu equipo.</li>
  <li>Con el negocio bloqueado o en pausa (apartados 4 bis y 5) puedes seguir dando sellos y usos de bonos que ya existen, pero no algo del momento.</li>
</ul>

<h2>3 octies. Menú del día</h2>
<p>El Negocio puede publicar su menú del día: una publicación con el sello «Menú del día», su precio y, si quiere, una foto y una línea con lo que incluye. El precio es el que se paga por el menú, no una rebaja: no lleva precio anterior ni porcentaje. Se retira sola a la hora que elija el Negocio o, si no elige, cuando cierra su cocina (o su local) según el horario que tenga en Klendar ese día. Si activa «Todos los días», Klendar lo publica solo los días y a la hora que elija, con el precio y la línea guardados y sin foto, y le avisa para que añada la de hoy; el Negocio tiene que mantener esos datos al día o apagarlo, y responde de que el menú publicado sea cierto como de cualquier otra publicación. A quien tiene el Negocio en favoritos, o un aviso que encaja, le avisamos como mucho de un menú por semana.</p>

<h2>3 nonies. Wifi para clientes y QR de mesa</h2>
<p>El Negocio puede guardar el nombre y la contraseña de una red wifi para sus clientes e imprimir carteles con un QR a una página de Klendar que los enseña a cualquiera que lo escanee, junto con lo que tiene publicado hoy, su carta y la opción de añadirlo a favoritos. El QR no lleva la contraseña: si la cambia, los carteles siguen valiendo; si cambia el enlace, los anteriores dejan de enseñar el wifi. El Negocio decide qué red y qué contraseña pone (debe ser una red para clientes, no la de su gestión) y responde de ella y de su uso; Klendar solo enseña lo que el Negocio escribe y no da ni controla esa conexión. Mientras el Negocio no se vea en Klendar (sin verificar, bloqueado o en pausa), la página no enseña el wifi. Klendar cuenta cuántas veces se escanea el QR, sin saber quién, y le da la cifra.</p>

<h2>4. Prueba gratuita, precio y facturación</h2>
<ul>
  <li><strong>Prueba gratis.</strong> Al darse de alta, el Negocio tiene un <strong>periodo de prueba gratuito de 30 días</strong> con todas las funciones, sin tarjeta y sin renovación automática. Puede elegir cómo pagar antes de que acabe: no se cobra nada hasta el día siguiente al último de la prueba. <strong>Si al acabar la prueba no ha elegido cómo pagar, el Negocio queda bloqueado</strong> (apartado 4 bis). Le avisamos 7 días y 1 día antes.</li>
  <li><strong>Gratis de lanzamiento.</strong> Mientras Klendar arranca en una ciudad, podemos dar a sus negocios más tiempo gratis («Gratis de lanzamiento»). Le decimos con <strong>al menos un mes de antelación</strong> el día en que termina (por correo, con un aviso en la app y en «Mi negocio») y se lo recordamos 7 días y 1 día antes; desde el día siguiente, como al acabar la prueba, hay que elegir cómo pagar o el Negocio queda bloqueado (apartado 4 bis). Mientras no tenga fecha de fin, no termina.</li>
  <li><strong>Precio.</strong> Después, el servicio se presta con un <strong>plan único</strong>: una <strong>cuota fija de 19,90 € al mes por local</strong> (o 199 € al año), sin límite de publicaciones ni de canjes. Con varios locales, el primero paga la cuota entera y, a partir del segundo, la de cada local es menor, según la tabla de <a href="/precios/">klendar.app/precios</a>. Los precios son <strong>sin IVA</strong>: se suma el IVA que corresponda (hoy, el 21 %). Si el local que paga está en <strong>Canarias, Ceuta o Melilla</strong> (lo decimos por el código postal de su dirección en Klendar), la operación <strong>no está sujeta al IVA español</strong> y la factura lo indica; si la dirección de facturación que dé no cuadra con la del local, lo revisamos con el Negocio. Klendar <strong>no cobra comisión</strong> por los canjes ni por las ventas del Negocio.</li>
  <li>Klendar avisará al Negocio con al menos <strong>un mes de antelación</strong> antes de cualquier cambio de precio. Si no está de acuerdo, puede darse de baja antes de que se aplique, sin penalización.</li>
  <li>Hoy el pago se hace por <strong>transferencia bancaria</strong>: el Negocio lo solicita en <a href="mailto:{E}">{E}</a> y Klendar le indica los datos. Si más adelante se ofrecen otros medios (tarjeta o domiciliación), se comunicarán antes. Klendar emite factura de cada cobro.</li>
</ul>

<h2>4 bis. Pagos pendientes y bloqueo</h2>
<p><strong>Cuándo se bloquea.</strong> El Negocio queda <strong>bloqueado</strong> si se acaba la prueba, el «Gratis de lanzamiento» o el periodo pagado (también tras cancelar la suscripción) y no hay otro pago en vigor, o si un pago queda pendiente más de <strong>7 días</strong> desde el primer cobro fallido: una tarjeta rechazada, una domiciliación que no se puede cobrar o un <strong>recibo devuelto</strong> por el banco, aunque sea semanas después, o una transferencia acordada que no llega. Le avisamos por correo, en la app y en «Mi negocio» <strong>7 días y 1 día antes</strong> y el día que se bloquea, con el motivo y cómo pagar. Un cobro por domiciliación que aún se está procesando no bloquea. En los cobros con tarjeta o domiciliación, Stripe reintenta el cobro durante esos días y avisa por correo.</p>
<p><strong>Qué supone.</strong> Mientras está bloqueado, sus publicaciones dejan de verse, su ficha muestra «No disponible ahora mismo» y nadie de su equipo puede publicar, editar la ficha ni usar Fidelizar, RRPP u otras herramientas. <strong>No se borra nada.</strong> Puede, en todo momento:</p>
<ul>
  <li><strong>pagar</strong> (en «Tu plan» del panel web) y, en cuanto se cobra, todo vuelve a funcionar solo;</li>
  <li><strong>descargar sus datos</strong> y <strong>darse de baja</strong>;</li>
  <li><strong>validar en la puerta los códigos, reservas y bonos que ya tiene la gente</strong>, porque lo ya dado se respeta: bonos vendidos, sellos, premios y regalos, códigos y sorteos abiertos. Mientras tanto debe atenderlos.</li>
</ul>
<p><strong>Otras medidas.</strong> Si la deuda sigue, podemos cancelar la suscripción y reclamar lo debido. Una devolución de un recibo o un contracargo de un servicio que sí se prestó se considera impago. Si la persona propietaria no usa Klendar durante mucho tiempo, se aplica lo previsto para las cuentas inactivas (aviso a los 24 meses; un negocio no se elimina sin que lo decida Klendar).</p>

<h2>5. Duración, pausa, traspaso y baja</h2>
<p>El plan es mensual (o anual, si se elige así) y se renueva automáticamente, <strong>sin permanencia</strong>.</p>
<ul>
  <li><strong>Cancelar la suscripción.</strong> El Negocio puede cancelarla en cualquier momento, sin penalización, desde el panel («Dar de baja el negocio», en la app o en klendar.app/panel) o escribiendo a <a href="mailto:{E}">{E}</a>. La cancelación tiene efecto al final del periodo ya pagado (o de la prueba gratuita): hasta entonces todo sigue igual y no se cobra ningún periodo posterior. Klendar la confirma por correo y el Negocio puede deshacerla antes de esa fecha. Cancelar no borra la ficha, las publicaciones ni los datos. Cuando termina, si no hay otro pago, el Negocio queda bloqueado (apartado 4 bis) hasta que vuelva a pagar; no se borra nada. Si cancela estando en pausa, se aplica lo dicho en «Pausa por cierre».</li>
  <li><strong>Pausa por cierre.</strong> Si cierra una temporada (vacaciones, obras, temporada baja), la persona propietaria puede <strong>pausar el plan</strong> desde «Tu plan» (app o panel), eligiendo el día de vuelta o «sin fecha», que es <strong>como mucho 6 meses</strong> por pausa. Mientras dura:
    <ul>
      <li><strong>no se cobra nada</strong> y los días que ya tenía pagados y no había usado se <strong>guardan</strong> (por ejemplo, 12 días del mes o 200 del año): al volver, se gastan primero y después el plan se cobra como siempre. No se pierde ni se devuelve nada. Con pago por transferencia, se alarga la fecha de fin de lo pagado los días que dure la pausa;</li>
      <li>el Negocio queda <strong>parado igual que bloqueado</strong> (apartado 4 bis): sus publicaciones no se ven, su ficha dice «Cerrado temporalmente hasta el día X» y su equipo no puede publicar, editar ni usar las herramientas. Se puede, igual que bloqueado, validar en la puerta lo que ya tiene la gente, descargar los datos y darse de baja, y además <strong>«Volver a abrir»</strong> cuando quiera;</li>
      <li>vuelve solo el día elegido (le avisamos 7 días antes) o antes, con «Volver a abrir». Al volver avisamos a quien lo tiene en favoritos. Si el cobro de después falla, se aplica el apartado 4 bis.</li>
    </ul>
    No se puede pausar con un pago pendiente o en proceso. Si la suscripción incluye varios locales, se pausan todos. Si cancela estando en pausa, vuelve, se gastan los días que tenía pagados y la suscripción termina entonces. «Cerrar hasta nuevo aviso» oculta el Negocio pero no pausa el cobro.</li>
  <li><strong>Cerrar hasta nuevo aviso.</strong> El Negocio puede dejar de mostrarse cuando quiera: su ficha y sus publicaciones dejan de aparecer en la Plataforma (quien tenga el enlace verá «Cerrado temporalmente») hasta que lo abra de nuevo desde el panel. Cerrar no cancela ni pausa la suscripción (para dejar de pagar hay que pausarla o cancelarla) ni anula las reservas y los códigos ya entregados, que el Negocio debe respetar o cancelar desde el panel, que avisa a cada persona.</li>
  <li><strong>Traspaso.</strong> La persona propietaria puede traspasar el Negocio a alguien mayor de edad de su equipo, que debe aceptarlo (la propuesta caduca a los 14 días). Desde que lo acepta, es la titular a efectos de estas condiciones. Lo ya pagado sigue con el Negocio hasta el final del periodo; desde entonces, la nueva persona titular elige cómo pagar (la suscripción de quien lo tenía deja de incluirlo y no se le vuelve a cobrar por él). Klendar no interviene en la operación que haya detrás (venta, cesión…).</li>
  <li><strong>Eliminar el Negocio.</strong> La persona propietaria puede eliminarlo desde el panel tras confirmar su identidad, y antes puede descargar sus datos (ficha, publicaciones con sus cifras, informe y tarjetas de sellos sin datos de clientes). Al eliminarlo, Klendar anula las reservas y los códigos sin usar y avisa a cada persona afectada (también a quien tenga sellos, premios o regalos pendientes) y al equipo; la ficha, las publicaciones, las reseñas, las tarjetas de sellos y el equipo se borran definitivamente. Lo ya pagado no se devuelve. La suscripción se cancela en ese momento (si incluye otros locales, deja de incluir este). Los datos de facturación se conservan el plazo legal (fiscal 4 años, mercantil 6 años). La cuenta personal no se puede eliminar mientras sea propietaria de un negocio.</li>
</ul>
<p>Klendar puede resolver el contrato por incumplimiento grave (no honrar ofertas, contenido ilícito, fraude en canjes) con comunicación motivada.</p>

<h2>6. Moderación, suspensión y recurso</h2>
<p>Klendar puede retirar contenido o suspender temporalmente la ficha ante denuncias fundadas o incumplimientos. El Negocio recibirá la motivación y podrá pedir que se revise la decisión en un plazo de 6 meses escribiendo a <a href="mailto:{E}">{E}</a> (Reglamento (UE) 2022/2065). Los textos del Negocio pasan por una moderación automática que puede dejarlos en revisión hasta que los revise una persona de Klendar (ver «Cómo moderamos» en las <a href="/normas/">Normas de la comunidad</a>); la ficha y la carta siguen a la vista mientras tanto. El bloqueo por falta de pago (apartado 4 bis) se avisa antes y se motiva en el propio aviso; se levanta solo al pagar.</p>
<p>Si Klendar retira una publicación, se anulan sus reservas y códigos sin usar. Si desactiva la ficha del Negocio, se anulan las reservas y los códigos sin usar de todas sus publicaciones, los premios de sellos sin canjear (los sellos se devuelven a cada persona) y los regalos de cumpleaños pendientes. En los dos casos Klendar avisa a cada persona afectada con un motivo genérico, sin mencionar denuncias ni a quien las presentó.</p>
<p>Si se suspende la cuenta de la persona propietaria, Klendar pausa sus negocios ("Cerrado hasta nuevo aviso"): dejan de mostrarse y se avisa a su equipo, pero las reservas y los códigos ya emitidos siguen siendo válidos y el resto del equipo puede validarlos. Una cuenta suspendida no puede publicar, cambiar la ficha, validar códigos, invitar ni entrar en un equipo. Al levantar la suspensión, Klendar decide si reabre el negocio o deja que lo reabra la persona propietaria.</p>

<h2>7. Propiedad intelectual y datos</h2>
<p>El Negocio conserva la propiedad de sus contenidos y concede a Klendar licencia para mostrarlos en la Plataforma, incluirlos en las imágenes para historias y enlaces que las personas comparten fuera de Klendar, y usarlos en materiales promocionales de Klendar (con posibilidad de oponerse a esto último). Klendar y el Negocio actúan como responsables independientes respecto de los datos personales que cada uno trata.</p>

<h2>8. Responsabilidad</h2>
<p>Klendar responde de la prestación diligente del servicio técnico. No responde de la actividad del Negocio ni de reclamaciones de las personas usuarias derivadas de ofertas no honradas, que serán a cargo del Negocio. La responsabilidad máxima de Klendar se limita a las cuotas pagadas en los 12 meses anteriores, salvo dolo o negligencia grave.</p>

<h2>9. Legislación y fuero</h2>
<p>Legislación española. Para negocios, las partes se someten a los juzgados de {es.fuero}.</p>

<h2>10. Cambios</h2>
<p>Klendar puede modificar estas condiciones avisando al Negocio con al menos 15 días de antelación (un mes si cambia el precio) por correo y en el panel. Si no está de acuerdo, puede darse de baja antes de que se apliquen, sin penalización.</p>
<p>Cada versión de estas condiciones lleva su fecha de publicación y, si no se aplica ese mismo día, la fecha desde la que se aplica, y sus cambios están en el historial al pie de esta página. El aviso llega al correo del propietario del Negocio y se queda en «Mi negocio» y en el panel hasta que lo marca como leído o, como mucho, hasta 30 días después de que se aplique. Klendar guarda qué versión aceptó el Negocio al darse de alta y cuándo se le avisó de cada cambio. Si el Negocio sigue usando Klendar desde la fecha en que se aplica un cambio, la nueva versión vale también para él.</p>
''')

    EN['negocios'] = ('business-terms', 'Business terms', 'Terms of service of Klendar for businesses.', f'''
<p class="notice">The changes of 5 October 2026 (sections 2, 2a, 3, 7 and 10) apply from <strong>20 October 2026</strong>, those of 6 October 2026 (sections 2a and 3) from <strong>21 October 2026</strong>, those of 7 October 2026 (sections 2a, 3, 3a and 3b) from <strong>22 October 2026</strong>, those of 13 October 2026 (sections 3, 3c, 3d and 3e) from <strong>28 October 2026</strong>, those of 14 October 2026 (sections 3a, 4, 4a, 5, 6 and 10) from <strong>29 October 2026</strong>, and those of 16 October 2026 (sections 3, 3f, 3g and 3h) from <strong>31 October 2026</strong>: 15 days after publishing them and notifying the Business (Regulation (EU) 2019/1150, art. 3(2)). The “Seasonal pause” (section 5) applies from publication, as it only adds an option in the Business's favour. If the Business does not agree, it may cancel before those dates, without penalty.</p>
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
<p>Klendar lets the Business publish flash deals and events (with place reservations and a waiting list if it turns them on, and in series of dates that people can follow), news, its menu and opening hours, describe what its place is like (“About your place”), manage its page, offer stamp cards and a birthday gift, message its customers (at most once a week per venue, reviewed by Klendar), work with promoters with their own links, lists and offers, validate redemptions via QR and view statistics. People can share its publications and page outside Klendar (a link and a stories image). Klendar does not take part in the sale and does not charge users.</p>

<h2>2a. How what people see is ordered</h2>
<p>In Discover, Explore, the map and the agenda, publications are ordered using these criteria, in this order of importance: (1) in Discover and the agenda, paid featured placements (“Featured”), which always carry that label, and in the collections Klendar puts together (for example, “With children”), the order Klendar gives them; (2) with “Based on the weather” on (it is by default), if it's raining today, today's indoor plans first and today's outdoor plans last, and if the weather is nice, today's terrace or outdoor plans first, based on what the Business ticks in “About your place” or in each publication; (3) the order the person chooses in “Sort” (nearest, soonest or newest); (4) if the person has chosen their interests (3 to 5 categories), publications in those categories weigh more within the order they've chosen, without hiding anything else: with “Newest” they count as if they were two days newer, with “Soonest” as if they started six hours earlier and with “Nearest” as if they were half as far away; (5) events Klendar imports from councils' public listings (open data, shown with their source) appear at most one in every five, interleaved in the same order, as long as there are publications from businesses and organisations (on the map, at most a quarter of the points; in collections Klendar orders by hand, their order applies); nothing is hidden. What an organisation publishes itself counts like any other publication. The person's filters (distance, category, price, “When?”, “The place”, “Open now”, only with a discount) decide what is shown, not the order. “Trending” is a label (many different people got it today) and doesn't change the order. The Business's rating, its fee or its number of publications don't affect the order. If there's nothing nearby, publications from outside the radius are suggested based on the person's interests, searches and the categories they look at, stored on their phone or in their account.</p>

<h2>3. Obligations of the Business</h2>
<ul>
  <li><strong>Honour published deals</strong> under the stated conditions for as long as they are valid and until the declared capacity runs out.</li>
  <li>Honour the rewards on its stamp cards and the birthday gift for as long as it offers them.</li>
  <li>Publish the final price the person will pay, including VAT and any other charges.</li>
  <li>If it announces a price reduction, give as the previous price the lowest price it applied in the previous 30 days.</li>
  <li>Publish only accurate, lawful content it holds the rights to (photos, text), in line with the <a href="/en/community-guidelines/">Community guidelines</a>.</li>
  <li>Comply with the rules applicable to its activity, including those on advertising alcoholic beverages (Spanish Law 34/1988 and regional regulations) and the protection of minors: nightlife venues, or deals that include alcohol, must be marked "18+".</li>
  <li>Describe its place and each publication truthfully in “About your place” and in “For children?” / “Indoor or outdoors?”: in particular “Wheelchair accessible”, “Child-friendly” and “Play area”, which people rely on to decide.</li>
  <li>If it sets kitchen hours, they must be accurate: Klendar uses them to show “Kitchen: until …”, for the “Food served now” filter and to remove the daily menu.</li>
  <li>If it works with promoters: choose them, add and remove them in Klendar and answer for what they do on its behalf; agree and pay whatever they are owed outside Klendar; use the data on their lists only to manage entry that night and their figures, and not invite anyone under 16 as a promoter (or under 18 if the Business is "18+"). Klendar is not a party to the relationship between the Business and its promoters.</li>
  <li>Honour promoter offers with the places and time limit it has set, like any other offer.</li>
  <li>Respect the dates it publishes in a series; if it cancels a date with bookings, Klendar notifies each person and cancels their bookings.</li>
  <li>Use the user data it learns (name and photo when they get a code or book, the attendee list and its promoters' lists) only to provide the service, with no purposes of its own and no disclosure.</li>
  <li>If a publication asks for a student card, a youth card or being over 65, check it itself. Klendar doesn't verify anyone's identity or age for these discounts; the scanner only reminds it to ask.</li>
  <li>If it shows Klendar on a TV at its venue (“Show on TV”), be responsible for where it is and who sees it, and unlink it from “Show on TV” if it moves it, sells it or it stops being its own.</li>
  <li>If it marks that it's showing a match or an event (“We're showing it”), hold the rights to show it at its venue (for example, the hospitality subscription of the platform that broadcasts it) and really show it. Klendar doesn't check this and may remove the mark if it receives complaints.</li>
  <li><strong>No fixed venue.</strong> If it ticks “I don't have a fixed venue”, every publication must say where it is (name and address of the place) and it must have the place's permission to advertise it. It is responsible to people for the event as its organiser (price, capacity, safety, and the licences and insurance required by its region's public events rules), even if the venue belongs to someone else.</li>
  <li><strong>Who's performing.</strong> If it adds artists to an event, they must really be performing, under their stage name as it is. Klendar creates a public artist page with that name showing their upcoming dates at any venue; the Business only adds the name: Klendar reviews and decides the photo, description and links. It mustn't add a private individual as an artist, or offensive or misleading names (advertising someone who isn't coming).</li>
  <li><strong>Allergens and diets.</strong> If it ticks “Gluten-free options”, “Coeliac-friendly”, “Vegan options”, “Vegetarian options”, “Lactose-free options” or “Halal” on its page, it declares it under its own responsibility: it must only tick what it always offers and can guarantee. “Gluten-free” is a regulated claim (Commission Implementing Regulation (EU) No 828/2014) and the allergen information for what it serves is its own (Regulation (EU) No 1169/2011 and Spanish Royal Decree 126/2015); what it puts on Klendar doesn't replace it: it must also have it at its venue. Klendar doesn't check these marks and may remove them if it receives well-founded complaints.</li>
  <li><strong>Links and menu.</strong> The links it adds to its page (“Book”, “Order delivery”, “Order at the venue” or others) must lead to its own pages or to services it really uses for its business, without misleading people about where they go or asking for data or payments under another identity. What happens on those pages (bookings, orders, payments, their terms and privacy) is a matter between the Business and that service, not Klendar. Its menu files (photos and PDFs) must be its menu, with up-to-date prices and allergens, and no personal data. Klendar may remove a link or file that doesn't comply.</li>
  <li><strong>Coupons and gifts.</strong> If it turns on the next-visit coupon or sends a gift to its regulars, it commits to giving it as described while the code is valid, just like an offer. If it leaves Klendar or its page is deactivated, unused ones are cancelled and Klendar lets each person know.</li>
  <li><strong>First visit.</strong> A “first-time visitors only” offer must really be one: it mustn't use it to draw people in with something it then doesn't give. Klendar checks that the person hasn't redeemed at the Business before; its team can't use it.</li>
  <li><strong>Regulars.</strong> The list of its most loyal customers is only for thanking them within Klendar. It mustn't copy it, combine it with other data or use it to contact people in other ways.</li>
</ul>

<h2>3a. Organisation accounts</h2>
<p>A council, a municipal district council, a traders' association, a residents' association, an NGO or another non-profit organisation (the “Organisation”) can have an organisation account. It is requested when signing up to Klendar (“A council, association or NGO”) or, if it already has a page, from “Your page › Organisation account”, with the Organisation's official name, tax ID (CIF) and official website, the name and role of the person asking and a document proving that they represent it. Klendar grants it after checking (see “How we check”). An Organisation that signs up this way cannot publish until Klendar has checked it. With the organisation account, the page and publications carry a badge with the type of organisation (“Council”, “Traders' association”…) and appear under the “Public listings” filter.</p>
<p>An Organisation publishes like any Business and also undertakes to: a) publish only activities open to the public or of interest to the neighbourhood or city (festivities, street markets, local shopping campaigns, cultural, sports or charity activities); b) not use the account for electoral or party propaganda, nor for institutional advertising that is prohibited during election periods; c) keep up to date who manages the account and let us know if they no longer represent the Organisation.</p>
<p>How we check: we review the document (for example, the appointment, a certificate from the secretary bearing the seal or secure verification code, the board minutes or the entry in the relevant register of associations or entities) and compare it with the Organisation's public information: its official website, its e-office or the relevant register. We may ask for more information, write to the email address or call the phone number shown on the Organisation's official website (never one given by the applicant), refuse the account giving the reason, and remove the badge if the details stop being true, without prejudice to section 6. Requesting an organisation account with false details or documents may lead to the account being suspended.</p>
<p>Until Klendar says otherwise, organisation accounts pay no fee. If that changes, we will give at least 15 days' notice and the Organisation may leave at no cost.</p>

<h2>3b. Passes</h2>
<p>The Business can sell passes for its venue and use Klendar to keep count of the uses. When it does:</p>
<ul>
  <li>The Business sells the pass and takes payment for it itself, at its venue and by its own means. Klendar doesn't charge the person anything, doesn't receive that money and isn't a party to the contract between the Business and them. The price the Business enters in Klendar is for information (for its stats and so the person knows what they bought) and must be the price it charges.</li>
  <li>The Business must honour every pass sold on its terms (uses, what it includes, expiry and conditions) even if it later pauses, removes or changes it: changes only apply to later sales. The Business is responsible to the person for the service, refunds and claims, under consumer law.</li>
  <li>Conditions and expiry must be clear and lawful. The Business can't set conditions that consumer law treats as unfair (for example, a disproportionate expiry or losing what was paid if the Business closes).</li>
  <li>The Business only adds a pass once the person has paid for it, and only records a use when they enjoy it. Every sale and use is recorded with who on the team did it, and the person sees it in their history. The Business is responsible for what its team does.</li>
  <li>The tax obligations of the sale (invoice or receipt and VAT) are the Business's.</li>
  <li>If the Business is going to close, stop providing the service or delete its Klendar account with unused passes, it must tell those people in good time and honour or refund what is due. After it leaves, the person keeps their history on Klendar, but the Business's obligation remains: Klendar doesn't take it on.</li>
</ul>

<h2>3c. Virtual queue</h2>
<p>It's optional. If the Business opens it, it will call people in order of arrival, won't remove anyone without reason and will give a reasonable time to turn up. Anyone it adds by hand (without the app), with their permission and only with the name it needs to call them. It is responsible for what its team does with the queue; Klendar may turn it off for a business that misuses it, under section 6.</p>

<h2>3d. Groups and companies</h2>
<p>If the Business ticks “We take groups”, people can ask it for a quote for groups. When it does:</p>
<ul>
  <li>What it says (up to how many people, what for, its note and each proposal) must be true and achievable. The price per person in a proposal is indicative: if it changes, it must tell the person before confirming anything.</li>
  <li>It must reply within the time limit (72 hours or until the day of the plan, whichever comes first; it sees it on each request) or say it can't. Requests it doesn't answer expire on their own.</li>
  <li>The contact details the person gives it when accepting its proposal are only for confirming that plan with them. It can't use them for advertising, pass them on or keep them longer than necessary; from the moment it receives them it is responsible for them (GDPR). Klendar deletes them from its dashboard 30 days after the date.</li>
  <li>The Business agrees the booking, payment, deposits and cancellations with the person, outside Klendar, and is responsible for them under consumer law. Klendar isn't a party to that agreement.</li>
  <li>Only the owner and managers see and reply to requests.</li>
</ul>

<h2>3e. Giveaways</h2>
<p>The Business can run giveaways on Klendar. When it creates one <strong>the Business is the organiser</strong> (with the company name and tax ID it declares, which appear in the rules) and accepts:</p>
<ul>
  <li><strong>Free, no purchase.</strong> Entering can't require buying, paying or anything other than what Klendar allows (having the business in favourites). It can't ask for different conditions outside Klendar (sharing, tagging, buying).</li>
  <li><strong>Rules.</strong> Klendar generates them from its details and publishes them before it starts. Its conditions (the “Conditions” field) can't contradict or narrow them. Once someone has entered, the giveaway can't be changed; it can only be cancelled for a justified reason, with the reason, which is sent to the people who entered. Cancelling without cause or repeatedly is considered misleading.</li>
  <li><strong>The prize.</strong> It must exist, be what it describes and have the approximate value it gives. The Business hands it over, free of charge, to the winner (or the reserve whose turn it is) within a reasonable time and as the rules or its conditions say, and marks it in Klendar when it hands it over. It can't swap it for something of lower value or charge anything to hand it over. Tobacco, vaping products and betting can't be given away; a prize with alcohol is for over-18s only.</li>
  <li><strong>Tax.</strong> If the prize is worth more than €300, the Business makes the 19% income tax withholding or payment on account and reports it (forms 111 and 190, or as applicable), and asks the winner for the details it needs for it. If its autonomous community's rules require any formality for promotional giveaways, that is also up to it. Klendar doesn't withhold or report anything.</li>
  <li><strong>Data.</strong> It only receives the winner's name and photo (and the tax details they give it). It uses them only to hand over the prize and comply with the tax authority, and is responsible for them (GDPR).</li>
  <li><strong>Verifiable.</strong> Klendar runs the draw automatically and verifiably; the Business can't choose the winner or ask for it to be redrawn.</li>
  <li>Up to 3 giveaways open at once. Klendar may remove a giveaway that breaches this, the guidelines or the law, telling the people who entered.</li>
</ul>

<h2>3f. Give on the spot</h2>
<p>From “Validate codes” you can give stamps from your cards, one use of a pass the person already has or something on the spot (free text) with a QR code from your business that the person scans and accepts. When you do:</p>
<ul>
  <li>What you enter is your own offer: you must give it there and then, on the terms you wrote. You are responsible to the person under consumer law; Klendar isn't a party.</li>
  <li>Only for people at your venue: don't show or share the QR code outside it (social media, chats, posters) and don't use it to give stamps or visits to people who haven't come, to your team or to yourself. What's given this way counts towards “Verified customer” and as a visit in your stats: using it to inflate reviews or stats is a misleading practice (art. 6 and section 6) and we can withdraw the feature, the reviews concerned or suspend the account.</li>
  <li>The text of “something on the spot” must be lawful and clear: nothing misleading, offensive, about betting or gambling, or money or something you can't give. If it mentions alcohol or tobacco, Klendar only lets over-18s accept it, but at your venue it's up to you to check age and comply with the rules (alcohol and tobacco can't be given to minors).</li>
  <li>A pass use given this way is a normal use of the pass (section 3b): only when the person enjoys it.</li>
  <li>Everything given is recorded with who on your team opened the QR code, and the person sees it in their account. You are responsible for what your team does.</li>
  <li>With your business blocked or paused (sections 4a and 5) you can keep giving stamps and uses of passes that already exist, but not something on the spot.</li>
</ul>

<h2>3g. Daily menu</h2>
<p>The Business can publish its daily menu: a publication with the “Daily menu” badge, its price and, optionally, a photo and a line saying what's included. The price is what the menu costs, not a discount: it has no previous price or percentage. It is removed automatically at the time the Business chooses or, if it doesn't choose, when its kitchen (or its venue) closes according to the hours it has on Klendar that day. If it turns on “Every day”, Klendar publishes it automatically on the days and at the time it chooses, with the saved price and line and without a photo, and reminds it to add today's photo; the Business must keep those details up to date or turn it off, and is responsible for the published menu being accurate, as with any other publication. People who have the Business as a favourite, or an alert that matches, are notified of at most one menu per week.</p>

<h2>3h. Wi-Fi for customers and table QR</h2>
<p>The Business can save the name and password of a Wi-Fi network for its customers and print cards with a QR code linking to a Klendar page that shows them to anyone who scans it, together with what it has published today, its menu and the option to add it to favourites. The QR code does not contain the password: if it changes the password, the cards still work; if it changes the link, the old ones stop showing the Wi-Fi. The Business decides which network and password it enters (it must be a guest network, not the one it uses to run the business) and is responsible for it and its use; Klendar only shows what the Business writes and does not provide or control that connection. While the Business is not visible on Klendar (not verified, blocked or paused), the page does not show the Wi-Fi. Klendar counts how many times the QR code is scanned, without knowing who, and gives the Business the figure.</p>

<h2>4. Free trial, pricing and invoicing</h2>
<ul>
  <li><strong>Free trial.</strong> On registration, the Business gets a <strong>30-day free trial</strong> with every feature, with no card and no automatic renewal. It can choose how to pay before it ends: nothing is charged until the day after the last day of the trial. <strong>If, when the trial ends, it hasn't chosen how to pay, the Business is blocked</strong> (section 4a). We remind it 7 days and 1 day before.</li>
  <li><strong>Launch, free.</strong> While Klendar is starting in a city, we may give its businesses more free time (“Launch, free”). We tell the Business the day it ends <strong>at least one month in advance</strong> (by email, with a notice in the app and in “My business”) and remind it 7 days and 1 day before; from the following day, as when the trial ends, it needs to choose how to pay or the Business is blocked (section 4a). As long as it has no end date, it doesn't end.</li>
  <li><strong>Price.</strong> After that, the service is provided under a <strong>single plan</strong>: a <strong>flat fee of €19.90 a month per venue</strong> (or €199 a year), with no limit on publications or redemptions. With several venues, the first one pays the full fee and, from the second one on, the fee for each venue is lower, according to the table at <a href="/en/pricing/">klendar.app/en/pricing</a>. Prices are <strong>excluding VAT</strong>: the applicable VAT is added (currently 21%). If the paying venue is in the <strong>Canary Islands, Ceuta or Melilla</strong> (we go by the postcode of its address on Klendar), the transaction is <strong>not subject to Spanish VAT</strong> and the invoice says so; if the billing address the Business gives doesn't match the venue's, we check it with the Business. Klendar <strong>charges no commission</strong> on redemptions or on the Business's sales.</li>
  <li>Klendar will notify the Business at least <strong>one month in advance</strong> before any price change. If the Business does not agree, it may cancel before the change applies, without penalty.</li>
  <li>Payment is currently made by <strong>bank transfer</strong>: the Business requests it at <a href="mailto:{E}">{E}</a> and Klendar sends the details. If other methods (card or direct debit) are offered later, they will be announced beforehand. Klendar issues an invoice for each payment.</li>
</ul>

<h2>4a. Outstanding payments and blocking</h2>
<p><strong>When it's blocked.</strong> The Business is <strong>blocked</strong> if its trial, “Launch, free” period or paid period ends (including after cancelling the subscription) and there is no other payment in force, or if a payment stays outstanding for more than <strong>7 days</strong> from the first failed charge: a declined card, a direct debit that can't be collected or a <strong>direct debit returned</strong> by the bank, even weeks later, or an agreed bank transfer that doesn't arrive. We remind it by email, in the app and in “My business” <strong>7 days and 1 day before</strong> and on the day it's blocked, with the reason and how to pay. A direct debit payment still being processed doesn't block. For card or direct debit payments, Stripe retries the charge during those days and sends an email.</p>
<p><strong>What it means.</strong> While blocked, its publications are hidden, its page shows “Not available right now” and nobody on its team can publish, edit the business page or use Loyalty, promoters or other tools. <strong>Nothing is deleted.</strong> At any time it can:</p>
<ul>
  <li><strong>pay</strong> (in “Your plan” in the web dashboard) and, once the payment goes through, everything works again on its own;</li>
  <li><strong>download its data</strong> and <strong>leave Klendar</strong>;</li>
  <li><strong>validate at the door the codes, bookings and passes people already have</strong>, because what has already been given is honoured: passes sold, stamps, rewards and gifts, codes and open giveaways. It must honour them in the meantime.</li>
</ul>
<p><strong>Other measures.</strong> If the debt remains, we may cancel the subscription and claim what is owed. Returning a direct debit or charging back a service that was provided counts as non-payment. If the owner doesn't use Klendar for a long time, the inactive-account rules apply (notice at 24 months; a business is never deleted without Klendar deciding so).</p>

<h2>5. Term, pausing, handover and termination</h2>
<p>The plan is monthly (or yearly, if chosen) and renews automatically, <strong>with no minimum term</strong>.</p>
<ul>
  <li><strong>Cancelling the subscription.</strong> The Business may cancel it at any time, without penalty, from the dashboard (“Leave Klendar”, in the app or at klendar.app/panel) or by writing to <a href="mailto:{E}">{E}</a>. Cancellation takes effect at the end of the period already paid (or of the free trial): until then everything carries on as before and no later period is charged. Klendar confirms it by email and the Business can undo it before that date. Cancelling does not delete the business page, publications or data. When it ends, if there's no other payment, the Business is blocked (section 4a) until it pays again; nothing is deleted. If it cancels while paused, see “Seasonal pause”.</li>
  <li><strong>Seasonal pause.</strong> If the Business closes for a while (holidays, works, low season), the owner can <strong>pause the plan</strong> from “Your plan” (app or dashboard), choosing the return date or “no date”, which is <strong>at most 6 months</strong> per pause. While it lasts:
    <ul>
      <li><strong>nothing is charged</strong> and the days already paid for and not used are <strong>kept</strong> (for example, 12 days of the month or 200 of the year): when it comes back they're used first and after that the plan is charged as usual. Nothing is lost or refunded. With payment by bank transfer, the end date of what was paid is extended by the length of the pause;</li>
      <li>the Business is <strong>stopped just as if it were blocked</strong> (section 4a): its publications are hidden, its page says “Temporarily closed until [date]” and its team can't publish, edit or use the tools. As when blocked, it can validate at the door what people already have, download its data and leave Klendar, and also <strong>“Reopen”</strong> whenever it likes;</li>
      <li>it comes back on its own on the chosen day (we remind it 7 days before) or sooner with “Reopen”. When it comes back we let the people who have it in their favourites know. If the charge after that fails, section 4a applies.</li>
    </ul>
    It can't be paused with a payment outstanding or being processed. If the subscription covers several venues, they're all paused. If it cancels while paused, it comes back, the days already paid for are used and the subscription ends then. “Closing until further notice” hides the Business but doesn't pause billing.</li>
  <li><strong>Closing until further notice.</strong> The Business can stop being shown whenever it wants: its page and publications stop appearing on the Platform (anyone with the link will see “Temporarily closed”) until it reopens from the dashboard. Closing doesn't cancel or pause the subscription (to stop paying, it has to be paused or cancelled) and does not cancel bookings and codes already issued, which the Business must honour or cancel from the dashboard, which tells each person.</li>
  <li><strong>Handover.</strong> The owner can hand the Business over to an adult member of its team, who must accept it (the offer expires after 14 days). Once accepted, that person is the holder for the purposes of these terms. What has already been paid stays with the Business until the end of the period; from then on, the new holder chooses how to pay (the previous holder's subscription stops covering it and they're no longer charged for it). Klendar takes no part in any underlying transaction (sale, transfer…).</li>
  <li><strong>Deleting the Business.</strong> The owner can delete it from the dashboard after confirming their identity, and can first download its data (business page, publications with their figures, report and stamp cards without customer data). When it is deleted, Klendar cancels unused bookings and codes and tells each person affected (including anyone with pending stamps, rewards or gifts) and the team; the business page, publications, reviews, stamp cards and team are permanently deleted. Amounts already paid are not refunded. The subscription is cancelled at that moment (if it covers other venues, it stops covering this one). Billing data is kept for the statutory period (tax 4 years, commercial 6 years). A personal account cannot be deleted while it owns a business.</li>
</ul>
<p>Klendar may terminate the contract for serious breach (not honouring deals, unlawful content, redemption fraud) with a reasoned notice.</p>

<h2>6. Moderation, suspension and appeal</h2>
<p>Klendar may remove content or temporarily suspend the profile in response to substantiated reports or breaches. The Business will receive the reasons and may ask for the decision to be reviewed within 6 months by writing to <a href="mailto:{E}">{E}</a> (Regulation (EU) 2022/2065). The Business's text goes through automatic moderation that may hold it for review until someone at Klendar has reviewed it (see “How we moderate” in the <a href="/en/community-guidelines/">Community guidelines</a>); the business page and menu stay visible in the meantime. Blocking for non-payment (section 4a) is notified in advance with its reasons in the notice itself; it's lifted automatically on payment.</p>
<p>If Klendar takes down a publication, its unused bookings and codes are cancelled. If it deactivates the Business's page, the unused bookings and codes of all its publications, unredeemed stamp-card rewards (each person gets their stamps back) and pending birthday gifts are cancelled. In both cases Klendar tells each person affected with a generic reason, without mentioning reports or who made them.</p>
<p>If the owner's account is suspended, Klendar pauses their businesses ("Closed until further notice"): they stop being shown and their team is told, but bookings and codes already issued remain valid and the rest of the team can validate them. A suspended account cannot publish, change the business page, validate codes, invite people or join a team. When the suspension is lifted, Klendar decides whether to reopen the business or let the owner reopen it.</p>

<h2>7. Intellectual property and data</h2>
<p>The Business keeps ownership of its content and grants Klendar a licence to display it on the Platform, include it in the stories images and links that people share outside Klendar, and use it in Klendar's promotional materials (with the option to object to the latter). Klendar and the Business act as independent controllers with regard to the personal data each of them processes.</p>

<h2>8. Liability</h2>
<p>Klendar is responsible for diligently providing the technical service. It is not liable for the Business's activity or for users' claims arising from deals not honoured, which are borne by the Business. Klendar's maximum liability is limited to the fees paid in the preceding 12 months, except in cases of wilful misconduct or gross negligence.</p>

<h2>9. Governing law and jurisdiction</h2>
<p>Spanish law. For businesses, the parties submit to the courts of {en.fuero}.</p>

<h2>10. Changes</h2>
<p>Klendar may change these terms by notifying the Business at least 15 days in advance (one month if the price changes) by email and in the dashboard. If the Business does not agree, it may cancel before they apply, without penalty.</p>
<p>Each version of these terms shows its publication date and, if it does not apply that same day, the date from which it applies, and its changes are listed in the history at the bottom of this page. The notice is sent to the email address of the Business owner and stays in “My business” and in the dashboard until it is marked as read or, at most, until 30 days after it applies. Klendar keeps a record of the version the Business accepted when it signed up and of when it was notified of each change. If the Business keeps using Klendar from the date a change applies, the new version also applies to it.</p>
''')

    # ── Cookies ─────────────────────────────────────────────────────────────────
    ES['cookies'] = ('Política de cookies', 'Klendar no usa cookies: qué guarda en tu navegador para que funcione, cómo contamos las visitas sin identificarte y qué servicios de terceros se cargan.', '''
<p><strong>En resumen.</strong> klendar.app no usa cookies. Guarda en tu navegador solo lo imprescindible para que funcione lo que pides (tu sesión, tu idioma, tus filtros, los códigos que un negocio valida sin conexión) y cuenta las visitas sin cookies ni identificarte. Nada de esto sirve para publicidad ni para seguirte por otras webs, así que no te pedimos consentimiento (art. 22.2 de la LSSI-CE). Si algún día añadimos algo que lo necesite, te lo pediremos antes.</p>
<h2>Qué se guarda en tu navegador</h2>
<table>
<tr><th>Nombre</th><th>Dónde</th><th>Para qué</th><th>Cuánto dura</th><th>Tipo</th></tr>
<tr><td><code>klendar_lang</code></td><td>Todo klendar.app (almacenamiento local)</td><td>Recordar el idioma que eliges: español o inglés en las páginas públicas y, en «Tu cuenta» y el panel, también català, galego, euskara, français, Deutsch o italiano</td><td>Hasta que lo borres</td><td>Preferencia elegida por ti</td></tr>
<tr><td><code>sb-…-auth-token</code></td><td>«Tu cuenta» y panel (almacenamiento local)</td><td>Mantener tu sesión iniciada</td><td>Hasta que cierres sesión</td><td>Técnica (autenticación)</td></tr>
<tr><td><code>sb-…-auth-token-…code-verifier</code></td><td>«Tu cuenta» y panel (almacenamiento local)</td><td>Un secreto de un solo uso que comprueba que la vuelta de Google o Apple llega al mismo navegador en el que empezaste a entrar (PKCE)</td><td>Hasta terminar de entrar o cerrar sesión</td><td>Técnica (seguridad)</td></tr>
<tr><td><code>sb-…-admin-auth-token</code></td><td>Administración (almacenamiento local)</td><td>Mantener la sesión de administración, aparte de la de «Tu cuenta»</td><td>Hasta que cierres sesión, tras 30 minutos sin actividad o a las 12 horas</td><td>Técnica (autenticación)</td></tr>
<tr><td><code>klendar.admin.actividad</code>, <code>klendar.admin.cierre</code></td><td>Administración (almacenamiento local)</td><td>Cuándo hubo actividad por última vez (para cerrar la sesión tras 30 minutos sin ella) y por qué se cerró, para decírtelo</td><td>Hasta la siguiente vez que entres</td><td>Técnica (seguridad)</td></tr>
<tr><td><code>klendar.admin.nav.sistema</code>, <code>klendar.admin.resumen.mas</code></td><td>Administración (almacenamiento local)</td><td>Recordar si dejaste abiertos el grupo «Sistema» del menú y «Más» del resumen</td><td>Hasta que lo cambies</td><td>Preferencia elegida por ti</td></tr>
<tr><td><code>klendar.acceso.aviso</code></td><td>«Tu cuenta» y panel (almacenamiento de sesión)</td><td>Avisarte si un enlace del correo ha caducado o ya se usó</td><td>Hasta enseñar el aviso o cerrar la pestaña</td><td>Técnica</td></tr>
<tr><td><code>klendar.intencion</code></td><td>Fichas, Descubre, Explorar y «Tu cuenta» (almacenamiento de sesión)</td><td>Recordar el botón que acabas de pulsar (guardar, reservar, conseguir el código…) para hacerlo al volver de entrar, y no hacerlo nunca si llegas por un enlace de fuera</td><td>Hasta usarlo, 15 minutos como mucho o cerrar la pestaña</td><td>Técnica (seguridad)</td></tr>
<tr><td><code>klendar.biz</code></td><td>Panel del negocio</td><td>Recordar qué negocio estabas gestionando</td><td>Hasta que cierres sesión</td><td>Técnica</td></tr>
<tr><td><code>klendar.cola.…</code></td><td>Panel del negocio</td><td>Guardar los códigos validados sin conexión hasta que vuelva la red</td><td>Hasta que se envían o cierras sesión</td><td>Técnica</td></tr>
<tr><td><code>klendar.filtros</code></td><td>Descubre y Explorar (almacenamiento local)</td><td>Recordar los filtros que pusiste (ciudad, tipo, categorías, precio…) para volver a ellos al abrir otra vez Descubre o Explorar</td><td>Se usa durante 6 horas; se sustituye al cambiarlos y se borra con «Quitar filtros»</td><td>Preferencia elegida por ti</td></tr>
<tr><td><code>klendar.filtros.sin</code></td><td>Descubre y Explorar (almacenamiento de sesión)</td><td>Que, justo después de «Quitar filtros», no vuelvan los guardados</td><td>Hasta la siguiente página</td><td>Técnica</td></tr>
<tr><td><code>klendar.cerca</code></td><td>Descubre, Explorar y las fichas (almacenamiento local)</td><td>Tu posición (latitud y longitud) cuando pulsas «Cerca de mí» o «Usar mi ubicación», para ordenar por cercanía y enseñarte a qué distancia está cada sitio</td><td>6 horas (después se borra)</td><td>Técnica (la pides tú, con el permiso de ubicación del navegador)</td></tr>
<tr><td><code>klendar.sonido</code></td><td>Descubre, Explorar y las fichas (almacenamiento de sesión)</td><td>Recordar que has activado el sonido de los vídeos mientras navegas</td><td>Hasta cerrar la pestaña</td><td>Preferencia elegida por ti</td></tr>
<tr><td><code>klendar.traducir</code></td><td>«Tu cuenta» y las fichas (almacenamiento local)</td><td>Recordar si quieres ver traducidos los textos de los negocios cuando no has entrado</td><td>Hasta que lo cambies</td><td>Preferencia elegida por ti</td></tr>
<tr><td><code>klendar.gustos</code></td><td>Descubre, Explorar y «Tu cuenta» (almacenamiento local)</td><td>Una copia de tus gustos y tu ciudad para ordenar Descubre y Explorar y para el aviso de viaje</td><td>Hasta que cierres sesión o los cambies</td><td>Preferencia elegida por ti</td></tr>
<tr><td><code>klendar.busquedas</code></td><td>Explorar (almacenamiento local)</td><td>Tus últimas 10 búsquedas, para enseñártelas al tocar el buscador</td><td>Hasta que las borres (una o todas)</td><td>Preferencia elegida por ti</td></tr>
<tr><td><code>klendar.viaje</code></td><td>Descubre (almacenamiento local)</td><td>La fecha en que cerraste el aviso de viaje, para no repetirlo ese día (no dónde estabas)</td><td>Hasta el día siguiente (se sustituye)</td><td>Preferencia elegida por ti</td></tr>
<tr><td><code>klendar.ciudades</code></td><td>Descubre, Explorar y «Tu cuenta» (almacenamiento de sesión)</td><td>La lista de ciudades de Klendar, para no pedirla en cada página</td><td>Hasta cerrar la pestaña</td><td>Técnica</td></tr>
<tr><td><code>klendar.grupos.elegidos</code></td><td>«Grupos y empresas» y «Tu cuenta» (almacenamiento de sesión)</td><td>Recordar los negocios que eliges (como mucho 3) para pedirles presupuesto mientras preparas la petición</td><td>Hasta cerrar la pestaña</td><td>Técnica</td></tr>
<tr><td><code>klendar.codigos.…</code></td><td>«Tu cuenta» (almacenamiento local)</td><td>Una copia de tus códigos y reservas para enseñarlos en la puerta aunque no haya conexión</td><td>Hasta que cierres sesión</td><td>Técnica</td></tr>
<tr><td><code>klendar.panel.vista</code></td><td>Panel del negocio (almacenamiento local)</td><td>Cómo quieres ver tus publicaciones (tarjetas o lista)</td><td>Hasta que lo cambies</td><td>Preferencia elegida por ti</td></tr>
<tr><td><code>klendar.tv.llave</code></td><td>Klendar en la tele (almacenamiento local)</td><td>La llave que enlaza esa tele con un local, para enseñar sus publicaciones sin entrar con ninguna cuenta</td><td>Hasta que el negocio desvincule la tele (entonces se borra sola)</td><td>Técnica</td></tr>
<tr><td><code>klendar.tv.ultimo</code></td><td>Klendar en la tele (almacenamiento local)</td><td>Lo último que enseñó (las publicaciones públicas del local), para seguir si se va la red</td><td>Hasta la siguiente actualización (cada minuto) o hasta desvincular</td><td>Técnica</td></tr>
<tr><td>marca de verificación en dos pasos</td><td>Administración (almacenamiento de sesión)</td><td>No volver a preguntar en esa pestaña</td><td>Hasta cerrar la pestaña</td><td>Técnica (seguridad)</td></tr>
<tr><td><code>mapbox.eventData…</code> (si aparece)</td><td>Mapas de Explorar y del panel (almacenamiento local, lo pone Mapbox)</td><td>Un identificador aleatorio que cambia cada 24 horas y que Mapbox usa para contar cuántos mapas se cargan (facturación)</td><td>24 horas</td><td>Técnica del servicio de mapas</td></tr>
</table>
<h2>Estadísticas de visitas</h2>
<p>Usamos <strong>Cloudflare Web Analytics</strong>, que no usa cookies ni guarda nada en tu navegador: un pequeño script envía a Cloudflare, por encargo nuestro, la página vista, la web de la que vienes, el tipo de navegador y dispositivo, el país y los tiempos de carga. Solo vemos cifras agregadas, sin identificarte ni seguirte entre sitios, y Cloudflare no las usa para nada más. No se usa en «Tu cuenta», en el panel ni en la administración, ni en las direcciones de baja de los correos o los enlaces de amigo. Tampoco en las páginas cuya dirección lleva tu posición («Cerca de mí») o el enlace de un RRPP, ni en Klendar en la tele (<code>/tv/</code>) ni en la página del QR de mesa de un local (<code>/m/</code>).</p>
<h2>Servicios de terceros que se cargan en algunas páginas</h2>
<p>Reciben tu dirección IP, como cualquier web que visitas, y no guardan cookies:</p>
<ul>
  <li><strong>Mapbox</strong>: los mapas de Explorar y del panel. Al cargar un mapa, Mapbox recibe el aviso de «mapa cargado» con el que factura.</li>
  <li><strong>Cloudflare Turnstile</strong>: cuando está activada, la comprobación anti-robots al entrar y al denunciar sin cuenta.</li>
</ul>
<p>Las fuentes, los iconos y las librerías (también la que conecta «Tu cuenta», el panel y la administración con nuestra base de datos) se sirven desde klendar.app, sin pasar por Google Fonts ni por otros servicios.</p>
<h2>Cómo borrarlo</h2>
<p>Al cerrar sesión se borran la sesión, la copia de tus códigos, tus gustos y lo del panel. Todo lo demás lo puedes borrar desde la configuración de tu navegador («Borrar datos de navegación» o «Datos de sitios»).</p>
<h2>La app</h2>
<p>La <strong>app móvil</strong> no usa cookies. Usa identificadores del dispositivo para las notificaciones (solo si las activas) y para los informes de errores y, solo si lo aceptas (al crear la cuenta o en Cuenta → Ajustes → Privacidad y datos), para estadísticas de uso de la app. Puedes retirarlo cuando quieras desde la app o desde «Tu cuenta» en la web. Más detalle en la <a href="/privacidad/">Política de privacidad</a>.</p>
''')

    EN['cookies'] = ('cookies', 'Cookie policy', 'Klendar uses no cookies: what it stores in your browser so things work, how we count visits without identifying you, and which third-party services load.', '''
<p><strong>In short.</strong> klendar.app does not use cookies. It only stores in your browser what is essential for what you ask it to do (your session, your language, your filters, the codes a business validates offline) and it counts visits without cookies and without identifying you. None of this is used for advertising or to follow you across other sites, so we don't ask for your consent (art. 22.2 of the Spanish LSSI-CE). If we ever add anything that needs it, we will ask you first.</p>
<h2>What is stored in your browser</h2>
<table>
<tr><th>Name</th><th>Where</th><th>Purpose</th><th>How long</th><th>Type</th></tr>
<tr><td><code>klendar_lang</code></td><td>All of klendar.app (local storage)</td><td>Remember the language you pick: Spanish or English on the public pages and, in “Your account” and the dashboard, also català, galego, euskara, français, Deutsch or italiano</td><td>Until you delete it</td><td>Preference you chose</td></tr>
<tr><td><code>sb-…-auth-token</code></td><td>“Your account” and business dashboard (local storage)</td><td>Keep you logged in</td><td>Until you log out</td><td>Technical (authentication)</td></tr>
<tr><td><code>sb-…-auth-token-…code-verifier</code></td><td>“Your account” and business dashboard (local storage)</td><td>A one-time secret that checks that the return from Google or Apple reaches the same browser where you started logging in (PKCE)</td><td>Until you finish logging in or log out</td><td>Technical (security)</td></tr>
<tr><td><code>sb-…-admin-auth-token</code></td><td>Admin (local storage)</td><td>Keep the admin session, separate from the “Your account” one</td><td>Until you log out, after 30 minutes of inactivity or after 12 hours</td><td>Technical (authentication)</td></tr>
<tr><td><code>klendar.admin.actividad</code>, <code>klendar.admin.cierre</code></td><td>Admin (local storage)</td><td>When there was last activity (to log out after 30 minutes without any) and why the session was closed, so we can tell you</td><td>Until the next time you log in</td><td>Technical (security)</td></tr>
<tr><td><code>klendar.admin.nav.sistema</code>, <code>klendar.admin.resumen.mas</code></td><td>Admin (local storage)</td><td>Remember whether you left the “System” menu group and “More” in the summary open</td><td>Until you change it</td><td>Preference you chose</td></tr>
<tr><td><code>klendar.acceso.aviso</code></td><td>“Your account” and business dashboard (session storage)</td><td>Tell you if an email link has expired or was already used</td><td>Until the notice is shown or the tab is closed</td><td>Technical</td></tr>
<tr><td><code>klendar.intencion</code></td><td>Publication and business pages, Discover, Explore and “Your account” (session storage)</td><td>Remember the button you just pressed (save, reserve, get the code…) so it's done once you've logged in, and never done if you arrive through an outside link</td><td>Until it's used, 15 minutes at most or until the tab is closed</td><td>Technical (security)</td></tr>
<tr><td><code>klendar.biz</code></td><td>Business dashboard</td><td>Remember which business you were managing</td><td>Until you log out</td><td>Technical</td></tr>
<tr><td><code>klendar.cola.…</code></td><td>Business dashboard</td><td>Keep codes validated offline until the connection is back</td><td>Until they are sent or you log out</td><td>Technical</td></tr>
<tr><td><code>klendar.filtros</code></td><td>Discover and Explore (local storage)</td><td>Remember the filters you set (city, type, categories, price…) so they're there when you open Discover or Explore again</td><td>Used for 6 hours; replaced when you change them and deleted with “Clear filters”</td><td>Preference you chose</td></tr>
<tr><td><code>klendar.filtros.sin</code></td><td>Discover and Explore (session storage)</td><td>Make sure the saved filters don't come back right after “Clear filters”</td><td>Until the next page</td><td>Technical</td></tr>
<tr><td><code>klendar.cerca</code></td><td>Discover, Explore and publication pages (local storage)</td><td>Your position (latitude and longitude) when you tap “Near me” or “Use my location”, to sort by distance and show how far away each place is</td><td>6 hours (then deleted)</td><td>Technical (you ask for it, with the browser's location permission)</td></tr>
<tr><td><code>klendar.sonido</code></td><td>Discover, Explore and publication pages (session storage)</td><td>Remember that you've turned on video sound while you browse</td><td>Until you close the tab</td><td>Preference you chose</td></tr>
<tr><td><code>klendar.traducir</code></td><td>“Your account” and publication pages (local storage)</td><td>Remember whether you want businesses' text translated when you're not logged in</td><td>Until you change it</td><td>Preference you chose</td></tr>
<tr><td><code>klendar.gustos</code></td><td>Discover, Explore and “Your account” (local storage)</td><td>A copy of your interests and your city, to order Discover and Explore and for the travel notice</td><td>Until you log out or change them</td><td>Preference you chose</td></tr>
<tr><td><code>klendar.busquedas</code></td><td>Explore (local storage)</td><td>Your last 10 searches, to show them when you tap the search box</td><td>Until you clear them (one or all)</td><td>Preference you chose</td></tr>
<tr><td><code>klendar.viaje</code></td><td>Discover (local storage)</td><td>The date you closed the travel notice, so it doesn't show again that day (not where you were)</td><td>Until the next day (replaced)</td><td>Preference you chose</td></tr>
<tr><td><code>klendar.ciudades</code></td><td>Discover, Explore and “Your account” (session storage)</td><td>The list of Klendar's cities, so it isn't requested on every page</td><td>Until you close the tab</td><td>Technical</td></tr>
<tr><td><code>klendar.grupos.elegidos</code></td><td>“Groups and companies” and “Your account” (session storage)</td><td>Remember the places you pick (up to 3) to ask them for a quote while you prepare the request</td><td>Until you close the tab</td><td>Technical</td></tr>
<tr><td><code>klendar.codigos.…</code></td><td>“Your account” (local storage)</td><td>A copy of your codes and bookings so you can show them at the door even without a connection</td><td>Until you log out</td><td>Technical</td></tr>
<tr><td><code>klendar.panel.vista</code></td><td>Business dashboard (local storage)</td><td>How you want to see your publications (cards or list)</td><td>Until you change it</td><td>Preference you chose</td></tr>
<tr><td><code>klendar.tv.llave</code></td><td>Klendar on the TV (local storage)</td><td>The key that links that TV to a venue, to show its publications without logging in to any account</td><td>Until the business unlinks the TV (then it deletes itself)</td><td>Technical</td></tr>
<tr><td><code>klendar.tv.ultimo</code></td><td>Klendar on the TV (local storage)</td><td>What it last showed (the venue's public publications), to keep going if the connection drops</td><td>Until the next update (every minute) or until unlinked</td><td>Technical</td></tr>
<tr><td>two-step verification flag</td><td>Admin (session storage)</td><td>Not asking again in that tab</td><td>Until the tab is closed</td><td>Technical (security)</td></tr>
<tr><td><code>mapbox.eventData…</code> (if present)</td><td>Maps in Explore and the dashboard (local storage, set by Mapbox)</td><td>A random identifier that changes every 24 hours, used by Mapbox to count map loads (billing)</td><td>24 hours</td><td>Technical, for the map service</td></tr>
</table>
<h2>Visit statistics</h2>
<p>We use <strong>Cloudflare Web Analytics</strong>, which uses no cookies and stores nothing in your browser: a small script sends Cloudflare, on our behalf, the page viewed, the site you came from, your browser and device type, your country and load times. We only see aggregate figures, without identifying you or tracking you across sites, and Cloudflare does not use them for anything else. It isn't used in “Your account”, the business dashboard or admin, or on email unsubscribe links and friend links. Nor on pages whose address contains your position (“Near me”) or a promoter's link, or on Klendar on the TV (<code>/tv/</code>) or on a venue's table QR page (<code>/m/</code>).</p>
<h2>Third-party services loaded on some pages</h2>
<p>They receive your IP address, like any website you visit, and set no cookies:</p>
<ul>
  <li><strong>Mapbox</strong>: the maps in Explore and in the business dashboard. When a map loads, Mapbox receives the “map loaded” event it uses for billing.</li>
  <li><strong>Cloudflare Turnstile</strong>: when enabled, the anti-bot check when you log in and when you report without an account.</li>
</ul>
<p>Fonts, icons and libraries (including the one that connects “Your account”, the business dashboard and admin to our database) are served from klendar.app, without going through Google Fonts or any other service.</p>
<h2>How to delete it</h2>
<p>When you log out, your session, the copy of your codes, your interests and the dashboard data are deleted. You can delete everything else in your browser settings (“Clear browsing data” or “Site data”).</p>
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
  <li>Fotos y vídeos: solo propios y del sitio o de lo que reseñas. Nada de desnudos, violencia, datos personales a la vista (matrículas, documentos, pantallas) ni personas reconocibles sin su permiso, y nunca menores reconocibles.</li>
  <li>Cola virtual: coge número solo para ti y los tuyos, con una cuenta.</li>
</ul>
<h2>Para negocios</h2>
<ul>
  <li>Publica solo ofertas que vayas a honrar, con condiciones claras (horario, aforo, requisitos).</li>
  <li>Fotos reales de tu local y productos, de las que tengas derechos.</li>
  <li>Alcohol y ocio nocturno: marca el negocio o la oferta como "+18". No se permite incitar al consumo excesivo ni dirigirse a menores (Ley 34/1988). Las publicaciones que mencionan bebidas alcohólicas se marcan +18 automáticamente y pasan por la moderación automática (más abajo).</li>
  <li>No se admite publicidad de tabaco, productos de vapeo ni juegos de azar o apuestas.</li>
  <li>No manipules reseñas ni canjes (cuentas propias, incentivos por valoraciones).</li>
  <li>Para dar de alta un negocio hace falta tener 18 años; para estar en su equipo, 16 (18 si el negocio es "+18").</li>
  <li>RRPP: un RRPP no puede apuntar a nadie sin que lo sepa, comprar o inventar apuntados, usar su propio enlace ni anunciar ofertas que el local no da. Quien trabaja en el local no cuenta para ningún RRPP. Las ofertas de RRPP siguen estas mismas normas.</li>
  <li>Marca en «Cómo es tu local» solo lo que tiene de verdad (accesible, apto para niños, terraza…) y pon a tus series un nombre que diga lo que son; los nombres de las series pasan por la moderación automática.</li>
  <li>Marca una publicación como «Solidario» solo si es benéfica o a favor de una causa del barrio, y di en la descripción a quién va lo recaudado. «¿Hay sitio ahora?» tiene que decir cómo está tu local en ese momento. Si pides carné (de estudiante, joven o ser mayor de 65), lo compruebas tú en la puerta: Klendar no lo verifica.</li>
  <li>En «Antes de cerrar» ofrece solo comida que se puede comer ese día o el siguiente y en buen estado: nunca productos con la fecha de caducidad pasada. Di lo que puede llevar la bolsa (o «el contenido varía») y los alérgenos si te los preguntan.</li>
  <li>Si tu cuenta es de una entidad (ayuntamiento, junta, asociación u ONG), publica actividades para el público, no propaganda electoral ni de partido. En periodo electoral, nada de publicidad institucional que destaque logros de gestión.</li>
  <li>En «Partidos que pones» añade solo lo que vas a poner de verdad, con su nombre y su hora; nada de anuncios disfrazados de partido.</li>
  <li><strong>Artistas.</strong> En «Quién actúa», solo quien actúa de verdad y con su nombre artístico. Nada de personas particulares, nombres ofensivos o engañosos. Klendar puede quitar o fusionar artistas y ocultar páginas.</li>
  <li>Nada de sorteos engañosos: el premio tiene que existir, valer lo que dices y entregarse a quien gane; no anuncies sorteos que no vas a hacer, no pidas nada a cambio de participar y no canceles sin una causa de verdad.</li>
  <li>En «Grupos y empresas», di solo lo que puedes cumplir y usa el contacto de quien acepta tu propuesta solo para ese plan.</li>
  <li><strong>Cupones y regalos.</strong> Lo mismo que en las publicaciones: nada de tabaco ni apuestas, y si menciona alcohol solo lo reciben mayores de edad (lo hace Klendar solo). Un texto ofensivo no se guarda.</li>
</ul>
<h2 id="resenas">Reseñas</h2>
<ul>
  <li>Cualquiera con cuenta en Klendar puede escribir una reseña de un negocio: una por persona y negocio, con una nota de 1 a 5 y, si quiere, un comentario y hasta 6 fotos o vídeos. Se puede editar cuando se quiera. Quien trabaja en un negocio no puede reseñarlo.</li>
  <li>Se muestran todas, las buenas y las malas, de la más reciente a la más antigua. Nadie paga por publicar, ordenar ni quitar reseñas, y un negocio no puede borrar una reseña: puede responderla o denunciarla si incumple estas normas.</li>
  <li>Antes de publicarse pasan por la moderación automática (más abajo), y se retiran las que incumplen estas normas.</li>
  <li><strong>«Cliente verificado»</strong>: una reseña lleva esta etiqueta si quien la escribe tiene al menos un canje validado en ese negocio con Klendar (el código de una oferta o de un evento, un premio de una tarjeta de sellos o un regalo de cumpleaños) o ha aceptado algo que el negocio le dio con «Dar en el momento», que se hace escaneando en el local un QR que cambia cada 30 segundos. Lo comprobamos de forma automática con lo que el propio negocio ha validado o dado en el local. La etiqueta no comprueba que la reseña hable de esa visita ni lo que cuenta. Las demás reseñas también son de personas con cuenta, pero no comprobamos que hayan sido clientes. En la ficha de cada negocio puedes ver solo las de clientes verificados.</li>
</ul>
<h2>Cómo denunciar</h2>
<p>Cualquiera puede denunciar, tenga cuenta o no. En cada negocio, publicación, reseña o novedad, y en cada foto o vídeo de una reseña, hay un enlace "Denunciar", y en el pie de la web, "<a href="/app/#/denunciar">Denunciar contenido ilegal</a>". Un negocio también puede denunciar una petición de «Grupos y empresas» que reciba (por ejemplo, si la nota trae publicidad o insultos). Indica qué contenido es, el motivo y por qué crees que es ilegal o incumple estas normas. Sin cuenta te pediremos tu nombre y tu correo (opcionales si se trata de abuso sexual infantil) y que declares que actúas de buena fe. Te confirmaremos que la hemos recibido y te diremos qué hemos decidido y por qué (en la app o por correo). Si no estás de acuerdo, puedes pedirnos que lo revisemos en un plazo de 6 meses. Quien publicó el contenido no sabrá quién lo denunció. Las decisiones las toma una persona, no un sistema automático.</p>
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
  <li>Photos and videos: only your own, of the place or of what you're reviewing. No nudity, violence, personal data on display (number plates, documents, screens) or recognisable people without their permission, and never recognisable minors.</li>
  <li>Virtual queues: get a number only for you and your group, with one account.</li>
</ul>
<h2>For businesses</h2>
<ul>
  <li>Only publish deals you will honour, with clear conditions (hours, capacity, requirements).</li>
  <li>Real photos of your venue and products that you hold the rights to.</li>
  <li>Alcohol and nightlife: mark the business or the deal as "18+". Encouraging excessive drinking or targeting minors is not allowed (Spanish Law 34/1988). Publications that mention alcoholic drinks are marked 18+ automatically and go through automatic moderation (see below).</li>
  <li>Advertising of tobacco, vaping products, gambling or betting is not accepted.</li>
  <li>Do not manipulate reviews or redemptions (own accounts, incentives for ratings).</li>
  <li>You must be 18 to register a business, and 16 to be on its team (18 if the business is "18+").</li>
  <li>Promoters: a promoter can't sign anyone up without their knowledge, buy or invent sign-ups, use their own link or advertise offers the venue doesn't give. People who work at the venue don't count for any promoter. Promoter offers follow these same guidelines.</li>
  <li>Tick in “About your place” only what it really has (accessible, child-friendly, terrace…) and give your series a name that says what they are; series names go through automatic moderation.</li>
  <li>Only mark a publication as “Charity” if it is for charity or a local cause, and say in the description who the money goes to. “Room right now?” must say how busy your place is at that moment. If you ask for ID (a student card, a youth card or being over 65), you check it at the door: Klendar doesn't verify it.</li>
  <li>In “Before closing” only offer food that is fine to eat that day or the next: never products past their use-by date. Say what the bag may contain (or “contents vary”) and the allergens if asked.</li>
  <li>If your account is an organisation's (council, district council, association or NGO), publish activities for the public, not electoral or party propaganda. During election periods, no institutional advertising highlighting achievements in office.</li>
  <li>In “Matches you're showing” only add what you're really going to show, with its name and time; no adverts dressed up as matches.</li>
  <li><strong>Artists.</strong> In “Who's performing”, only people who really perform, under their stage name. No private individuals, offensive or misleading names. Klendar may remove or merge artists and hide pages.</li>
  <li>No misleading giveaways: the prize must exist, be worth what you say and be handed over to the winner; don't advertise giveaways you aren't going to run, don't ask for anything in return for entering and don't cancel without a real reason.</li>
  <li>In “Groups and companies”, only say what you can deliver and use the contact details of whoever accepts your proposal only for that plan.</li>
  <li><strong>Coupons and gifts.</strong> The same as for publications: no tobacco or gambling, and if it mentions alcohol only adults get it (Klendar does this automatically). Offensive text isn't saved.</li>
</ul>
<h2 id="resenas">Reviews</h2>
<ul>
  <li>Anyone with a Klendar account can write a review of a business: one per person and business, with a rating from 1 to 5 and, if they like, a comment and up to 6 photos or videos. It can be edited at any time. People who work at a business cannot review it.</li>
  <li>All reviews are shown, good and bad, from newest to oldest. Nobody pays to publish, rank or remove reviews, and a business cannot delete a review: it can reply to it or report it if it breaks these guidelines.</li>
  <li>Before going live they go through automatic moderation (see below), and those that break these guidelines are removed.</li>
  <li><strong>“Verified customer”</strong>: a review has this label if the person who wrote it has at least one validated redemption at that business with Klendar (the code for an offer or an event, a stamp-card reward or a birthday gift) or has accepted something the business gave them with “Give on the spot”, which is done by scanning at the venue a QR code that changes every 30 seconds. We check this automatically against what the business itself validated or gave at the venue. The label doesn't check that the review is about that visit or what it says. Other reviews are also from people with an account, but we don't check that they were customers. On each business page you can show only the ones from verified customers.</li>
</ul>
<h2>How to report</h2>
<p>Anyone can report, with or without an account. Every business, publication, review and news post, and every photo or video in a review, has a "Report" link, and the website footer has "<a href="/app/?lang=en#/denunciar">Report illegal content</a>". A business can also report a “Groups and companies” request it receives (for example, if the note contains advertising or insults). Tell us which content it is, the reason and why you believe it is illegal or breaks these guidelines. Without an account, we'll ask for your name and email (optional if it concerns child sexual abuse) and for you to declare that you are acting in good faith. We'll confirm we've received your report and tell you what we've decided and why (in the app or by email). If you disagree, you can ask us to review it within 6 months. The person who posted the content won't know who reported it. Decisions are made by a person, not by an automated system.</p>
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
  <li>Tu perfil (nombre, email, fecha de nacimiento, foto), tus favoritos, tus planes, las series que sigues, los equipos y los artistas que sigues, tus gustos y tu ciudad, tus avisos «Avísame si…», tus preferencias (también la de traducción) y tokens de notificaciones, tus dispositivos de confianza, tu ubicación, tus tarjetas de sellos, tu lugar en las listas de espera, tu historial de canjes (también con qué RRPP fuiste) y el enlace de tu calendario, que deja de funcionar.</li>
  <li>Tus bonos y su historial (si te quedan usos, gástalos antes o pide al negocio lo que corresponda: después no podremos enseñarte cuántos te quedaban).</li>
  <li>Tu turno en una cola; tus peticiones de grupo (los negocios que ya tenían tu contacto lo conservan si lo apuntaron); tus participaciones en sorteos (si tenías un premio sin recoger, lo pierdes; el número queda anulado en el sorteo), y los cupones y regalos que no usaste (los ya usados se quedan en las cifras del negocio sin tu nombre).</li>
  <li>Lo que te han dado en el momento (el negocio conserva solo la cifra, sin tu nombre).</li>
  <li>Los locales que has pedido y tus avisos de «Avísame cuando Klendar llegue» (también los que apuntaste sin cuenta con el mismo correo).</li>
  <li>Si eres RRPP de algún local, dejas de serlo: se borran tus enlaces y tus QR. El local conserva sus canjes, pero ya no aparecen a tu nombre.</li>
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
  <li>Your profile (name, email, date of birth, photo), your favourites, your plans, the series you follow, the teams and artists you follow, your interests and your city, your “Tell me when…” alerts, your preferences (including translation) and notification tokens, your trusted devices, your location, your stamp cards, your place on waiting lists, your redemption history (including which promoter you went with) and your calendar link, which stops working.</li>
  <li>Your passes and their history (if you have uses left, use them first or ask the business for what's due: afterwards we won't be able to show how many you had left).</li>
  <li>Your turn in a queue; your group requests (places that already had your contact details keep them if they noted them down); your giveaway entries (if you had an unclaimed prize, you lose it; the number is void in the draw), and the coupons and gifts you didn't use (used ones stay in the business's figures without your name).</li>
  <li>What you've been given on the spot (the business only keeps the count, without your name).</li>
  <li>The places you've asked for and your “Tell me when Klendar arrives” sign-ups (including any made without an account with the same email).</li>
  <li>If you're a promoter for any venue, you stop being one: your links and QR codes are deleted. The venue keeps its redemptions, but they no longer appear under your name.</li>
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
{soporte_html('es', E)}
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
