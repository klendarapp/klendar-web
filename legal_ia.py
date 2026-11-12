# -*- coding: utf-8 -*-
"""Textos legales de las funciones con IA (Claude, de Anthropic), todos juntos.

Unifica los apartados FF (moderador), TF (traducción), PA (piloto automático),
FO y FE (rellenar desde una foto, un enlace o un texto), IN (ayudas para
negocios) y AS (asistente de ayuda) de `docs/LEGAL_PENDIENTE_2026-10.md` del
repo de la app (rama `legal-ia`, 12-11-2026). PDF para Iván:
«Klendar para Ivan\\Textos de IA - todo junto.pdf».

Cómo funciona: `build_legal.py` y `ayuda.py` generan los textos de siempre y,
si `IA_DESDE` tiene fecha, este módulo los cambia: sustituye frases exactas
(si una no está, o está dos veces, para y dice cuál) y añade lo nuevo. Así lo
de hoy no se toca y todo lo de la IA está en un solo sitio.

  · IA_DESDE = None          → los textos de hoy, sin ninguna IA.
  · IA_DESDE = 'AAAA-MM-DD'  → los textos con IA, con esa fecha en
    «Última actualización» y en el historial de cada página, y una versión
    nueva de las condiciones para negocios que se aplica 15 días después
    (Reglamento (UE) 2019/1150, art. 3.2).

**El día que se publique: poner aquí esa fecha y regenerar** (`python
build_legal.py`, `python build_pages.py`, `python build_site.py`; en la app,
`python tool/sync_help.py`). RUNBOOK §4zm del repo de la app.

Decisiones de Iván del 12-11 (lo que dicen estos textos):

  · Se encienden: rellenar desde una foto, un enlace o un texto; la
    traducción; el moderador de textos y fotos (ante la duda, a una persona);
    las ayudas para negocios y el asistente.
  · La IA o el piloto ayudan, pero decide siempre una persona: verificar
    negocios y entidades (lista «Listos para aprobar»; nada se verifica solo,
    tampoco con un dominio oficial), leer documentos (`document_review`: solo
    «coincide / no coincide / dudoso»; `claim_document` y
    `verify_entity.by_document` apagados) y las denuncias (`report_review` en
    modo «solo opina»: no cierra ni oculta nada).
  · Automático: solo «¿Es tu negocio?» con un código al correo publicado
    (`claim_code`), con sus frenos.
  · Apagado: ocultar por denuncias (`report_autohide`). Sus textos, y los de
    que la IA cierre u oculte sola una denuncia, van preparados aquí con
    DENUNCIAS_AUTOMATICAS_DESDE = None: no salen hasta que conteste el abogado
    y se encienda (con su línea en el historial y su versión con 15 días).

Ojo: los modos «Listos para aprobar» y «solo opina» aún no están programados
(los hace otra tarea). Estos textos los dan por hechos: no publicar sin ellos.
"""
import datetime
import sys

# ════════════════════════════════════════════════════════════════════════════
# LA FECHA DEL DÍA QUE SE PUBLIQUE (AAAA-MM-DD). Hoy es una fecha de
# PRUEBA: cambiarla por la del día de publicar antes de subir nada.
# ════════════════════════════════════════════════════════════════════════════
IA_DESDE = '2026-11-13'
DENUNCIAS_AUTOMATICAS_DESDE = None  # NO se enciende hasta que conteste el abogado (FF-Q4, PA-Q1)

CORREO = 'info@klendar.app'
PREAVISO_DIAS = 15

_MESES_ES = ('enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
             'septiembre', 'octubre', 'noviembre', 'diciembre')
_MESES_EN = ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
             'September', 'October', 'November', 'December')


def _d(iso):
    return datetime.date.fromisoformat(iso)


def fecha(iso, lang):
    """'2026-11-13' → '13 de noviembre de 2026' / '13 November 2026'."""
    d = _d(iso)
    return f'{d.day} de {_MESES_ES[d.month - 1]} de {d.year}' if lang == 'es' else f'{d.day} {_MESES_EN[d.month - 1]} {d.year}'


def fechas(iso):
    return {'es': fecha(iso, 'es'), 'en': fecha(iso, 'en')}


def aplica(iso):
    """Desde cuándo se aplica una versión de las condiciones para negocios publicada ese día."""
    return (_d(iso) + datetime.timedelta(days=PREAVISO_DIAS)).isoformat()


def activo():
    return bool(IA_DESDE)


def aviso_fecha():
    """Un aviso si la fecha de los textos no es la de hoy (para no publicar una de prueba)."""
    if IA_DESDE and IA_DESDE != datetime.date.today().isoformat():
        print(f'legal_ia.py: OJO, los textos de IA llevan la fecha {IA_DESDE} y hoy es '
              f'{datetime.date.today().isoformat()}. Si vas a publicar, pon la de hoy en IA_DESDE.', file=sys.stderr)


# ── Sustituir frases exactas ────────────────────────────────────────────────
def _cambia(cuerpo, antes, despues, donde):
    n = cuerpo.count(antes)
    if n != 1:
        sys.exit(f'legal_ia.py: en {donde}, «{antes[:90]}…» sale {n} veces (tiene que salir 1). '
                 '¿Ha cambiado ese texto en build_legal.py? Ajusta la frase aquí.')
    return cuerpo.replace(antes, despues)


def _aplica_lista(D, slug, lang, cambios):
    t = D[slug]
    cuerpo = t[-1]
    for antes, despues in cambios:
        cuerpo = _cambia(cuerpo, antes, despues, f'{slug} ({lang})')
    D[slug] = t[:-1] + (cuerpo,)


# ════════════════════════════════════════════════════════════════════════════
# PRIVACIDAD
# ════════════════════════════════════════════════════════════════════════════
def _fila(*celdas):
    return '<tr>' + ''.join(f'<td>{c}</td>' for c in celdas) + '</tr>'


def _bloque_privacidad(lang, E):
    """Apartado «Funciones con inteligencia artificial» (al final del 2)."""
    denuncias_auto = bool(DENUNCIAS_AUTOMATICAS_DESDE)
    if lang == 'es':
        cab = ('<h3 id="ia">Funciones con inteligencia artificial (IA)</h3>\n'
               '<p>Algunas funciones usan <strong>Claude</strong>, la IA de <strong>Anthropic</strong>, que trata los datos por encargo nuestro (apartado 3). En todas:</p>\n<ul>\n'
               '  <li><strong>Lo envía nuestro servidor, no tu móvil.</strong> A Anthropic no le llegan tu nombre, tu correo, tu cuenta ni tu dirección IP, salvo que los escribas tú en lo que se envía. Antes de enviar un texto quitamos los correos, teléfonos, enlaces y @usuarios que veamos. Procura no escribir datos de otras personas.</li>\n'
               '  <li><strong>Te pedimos permiso antes</strong>, con una pregunta aparte y sin nada marcado, salvo en la traducción y en la ayuda para revisar denuncias, que explican por qué en su fila. Decir que no no te quita nada de lo de siempre. Lo retiras cuando quieras en Cuenta → Ajustes → Privacidad y datos (en la app y en «Tu cuenta») y, desde ese momento, no se envía nada más.</li>\n'
               '  <li><strong>Nada se publica solo.</strong> Lo que propone la IA lo revisas y lo publicas tú. Solo el moderador decide sin una persona, cuando no publica algo: te lo decimos con el motivo y lo revisa una persona si lo pides (apartado 5).</li>\n'
               '  <li><strong>Lo que hace Anthropic con ello:</strong> no lo usa para entrenar su IA y lo borra en 30 días; lo que sus sistemas de seguridad marquen como incumplimiento de su política de uso puede guardarlo hasta 2 años, y sus puntuaciones de seguridad, hasta 7. Si detecta abuso sexual infantil, dice que lo comunica a las autoridades.</li>\n'
               '  <li><strong>Puede equivocarse.</strong> Lo que dice la IA no obliga a Klendar: vale lo publicado.</li>\n</ul>\n'
               '<table>\n<tr><th>Función</th><th>Datos</th><th>Finalidad</th><th>Base jurídica</th><th>Conservación en Klendar</th></tr>\n')
        filas = [
            _fila('Moderador automático',
                  'Lo que escribes o subes para publicarlo (textos, fotos y unos fotogramas de los vídeos); el resultado (qué ha encontrado y con qué probabilidad), tu cuenta, cuándo y lo que se decidió. Si no se publica, el texto o el original se guarda aparte y solo lo ves tú y el equipo de Klendar. De lo que se publica no guardamos una copia aparte',
                  'Antes de publicarlo, comprobar que cumple las <a href="/normas">Normas de la comunidad</a>: se publica, se publica solo para mayores de 18 (si habla de alcohol), no se publica o, si hay dudas, lo revisa una persona. Lo muy grave se oculta y lo revisa una persona enseguida',
                  'Tu consentimiento (art. 6.1.a RGPD) para enviarlo a la IA. Sin él, o si la IA no está disponible, lo revisan las listas de palabras o una persona, sin enviarlo a nadie, por nuestro interés legítimo en mantener la plataforma segura y hacer cumplir las Normas (art. 6.1.f); tus fotos pueden tardar más en publicarse',
                  'El resultado, 200 días. Lo no publicado, 6 meses desde la decisión (el plazo para reclamar) y luego se borra; antes, si eliminas la cuenta o el negocio'),
            _fila('Ayuda para revisar denuncias',
                  'Lo denunciado (su texto y su imagen) y el motivo, y hasta 3 comentarios de quien denuncia, sin su nombre, su correo ni su cuenta y sin los correos, teléfonos, enlaces ni documentos que lleven; un nombre propio escrito en la denuncia sí puede ir. Solo se envía lo publicado por quien ha dado permiso para el moderador. Lo que tenga que ver con abuso sexual infantil no se envía nunca a ninguna IA. Guardamos lo que opina la IA: el resultado, la norma, su confianza y el motivo',
                  ('Que la IA lea la denuncia y, si está claro, la cierre o retire lo que incumple claramente las Normas, sin que lo mire antes una persona: te lo decimos y lo revisa una persona si lo pides. Lo dudoso y lo grave lo decide una persona; mientras tanto, lo grave puede quedar oculto. Si denuncias en falso de forma repetida, tras avisarte, tus denuncias dejan de contar para ocultar nada de forma automática; las seguimos leyendo'
                   if denuncias_auto else
                   'Que la IA lea la denuncia y deje su opinión y el motivo a la persona de Klendar que la decide, para resolverlas antes. La IA no cierra denuncias ni oculta ni retira nada: lo decide siempre esa persona'),
                  'Nuestro interés legítimo en tramitar las denuncias con rapidez y cuidado, como pide el Reglamento de Servicios Digitales (art. 6.1.f RGPD), con el permiso de quien publicó el contenido para enviarlo a una IA',
                  'Lo que opina la IA, 2 años, como la denuncia'),
        ]
        filas.append(_fila('Leer documentos con IA (reclamar un negocio o pedir una cuenta de entidad)',
                  'Si marcas la casilla al subirlo, el documento con el que acreditas un negocio o una entidad. La IA copia el nombre, el NIF y la dirección del titular y el tipo de documento. No guardamos lo que lee: solo si coincide con lo que nos dices, no coincide o hay dudas, y por qué',
                  'Ayudar a la persona de Klendar que revisa tu solicitud: le dice si coincide con lo que declaras, no coincide o hay dudas. No aprueba, no verifica ni traspasa nada: lo decide esa persona. Compara lo que pone, no si el documento es auténtico',
                  f'Tu consentimiento (art. 6.1.a), que das con la casilla, sin marcar, al subir el documento. Sin él, lo revisa igual una persona. Para retirarlo, escríbenos a <a href="mailto:{E}">{E}</a>',
                  'El resultado, junto al documento: hasta 6 meses después de decidir'))
        filas += [
            _fila('Traducción automática',
                  'Lo que pides traducir (al tocar «Traducir» debajo de un texto de un negocio que está en otro idioma), sin guardar quién lo pidió; y, si la enciendes, la preferencia «Traducir siempre automáticamente» (con cuenta, en tu perfil; sin ella, en tu móvil o tu navegador)',
                  'Enseñarte en tu idioma (el de la app o el de la página), solo cuando lo pides o si tienes encendido «Traducir siempre automáticamente», el título, la descripción y las condiciones de las publicaciones, las novedades, la descripción del negocio, «Qué pedir aquí» y su carta. Junto al texto traducido pone «Traducción automática» o, si la ha hecho Google, «Traducido por Google», y siempre puedes ver el original. Nunca se traducen las reseñas, las preguntas ni los nombres. Lo traduce nuestro servidor con Claude o, si no está disponible, con Google Cloud Translation. Los dos reciben solo los textos ya publicados de los negocios, sin tus datos ni tu cuenta (también los de un negocio que no ha dado permiso para el moderador, que es otra cosa); guardamos la traducción para no volver a pedirla',
                  'Ejecución del contrato (lo pides tú; «Traducir siempre automáticamente» empieza apagado). Por eso no te pedimos un permiso aparte',
                  'La preferencia, hasta que la cambies o elimines la cuenta. Las traducciones, hasta 60 días después de la última vez que se usan; las de un negocio que se elimina, en ese momento'),
            _fila('Rellenar desde una foto, un enlace o un texto (cuenta de negocio)',
                  'La foto que eliges de tu cartel, tu pizarra o tu carta, reducida y sin metadatos; el enlace que pegas (la página la leemos nosotros, sin cookies ni contraseñas: solo su texto y, si la pides, su imagen; la web ve una visita de Klendar, no la tuya), o el texto que pegas',
                  'Leer lo que pone y escribirlo en el formulario, en la lista de tu carta o en una lista de eventos que revisas uno a uno, para que lo compruebes y lo publiques tú. Nunca se publica solo',
                  'Tu consentimiento (art. 6.1.a), con una casilla la primera vez: una para las fotos y otra para los enlaces y los textos. Sin él escribes a mano como siempre',
                  'Nada: no guardamos la foto, el enlace, el texto ni lo que se lee en ellos, salvo que uses la foto o la imagen de la página como imagen de tu publicación. Solo contamos cuántas lecturas se hacen al día por negocio'),
            _fila('Proponer categoría y etiquetas (cuenta de negocio)',
                  'El título y la descripción que escribes al crear una publicación',
                  'Proponerte la categoría y las marcas de la publicación, que cambias si quieres. Nunca se publica nada solo',
                  'Tu consentimiento (art. 6.1.a). Sin él, el formulario sigue como siempre',
                  'Nada de lo enviado. Solo contamos cuántas propuestas se piden al día por negocio'),
            _fila('Ideas para tu negocio (cuenta de negocio)',
                  'Tu categoría y los momentos del día de tu local, los partidos que pones, la previsión del tiempo de tu zona, los festivos y los títulos de tus publicaciones de los últimos meses con sus vistas y canjes en total (sin las que hablan de alcohol). Sin el nombre del negocio, sin dirección y sin nada de tus clientes',
                  'Proponerte cada semana de 1 a 3 ideas de oferta o evento, que revisas y publicas tú',
                  'Tu consentimiento (art. 6.1.a), que da quien gestiona el negocio al encenderlas; si lo retira, se apagan. Se encienden y se apagan por negocio',
                  'Las ideas de cada semana, 8 semanas'),
            _fila('Proponer respuestas a reseñas',
                  'El texto de una reseña pública y sus estrellas, sin el nombre, la foto, la fecha ni nada más de quien la escribió; quitamos correos, teléfonos, enlaces y @usuarios. Solo reseñas escritas después de poner el aviso al escribirlas, y ninguna de quien se haya opuesto',
                  'Preparar un borrador para que el negocio lo revise, lo cambie y lo publique él. Nunca se envía solo',
                  'Para el negocio que lo usa, su consentimiento (art. 6.1.a). Para quien escribió la reseña, nuestro interés legítimo y el del negocio en contestar bien a lo que se publica para que se conteste (art. 6.1.f). Te puedes oponer cuando quieras, sin dar motivos, con «Que mis reseñas no pasen por una IA», en Ajustes o en «Tu cuenta»: entonces tus reseñas no se envían',
                  'Nada de lo enviado; el borrador, hasta que el negocio lo publica o lo descarta. Solo contamos cuántos se piden al día por negocio'),
            _fila('Asistente de ayuda',
                  'Lo que escribes en el asistente y hasta 3 turnos anteriores de esa conversación, tras quitar correos, teléfonos, enlaces, DNI, NIE, NIF e IBAN; tu idioma, si usas la app o la web y si consta que eres mayor de edad. Va sin tu nombre, tu cuenta ni tu IP. Los nombres, las direcciones o lo que cuentes de tu salud no siempre se pueden quitar: no los escribas',
                  'Responder a tus dudas sobre Klendar con lo que tenemos publicado en la Ayuda y en las Normas, y saber qué falta en la Ayuda. Antes de la primera pregunta te dice que es una IA, no una persona',
                  'Tu consentimiento (art. 6.1.a), que das antes de la primera pregunta. Lo retiras en Ajustes o, sin cuenta, dejando de usarlo (entonces se guarda solo en tu móvil o tu navegador). Sin él, tienes la Ayuda y el correo',
                  'No guardamos la conversación. Solo contamos, 13 meses, cuántas preguntas hay, de qué tema (de una lista cerrada) y cuáles no supo responder. Para el límite de preguntas al día, un contador por persona o, sin cuenta, un resumen de tu conexión que dura 24 horas'),
        ]
        return cab + '\n'.join(filas) + '\n</table>\n'
    cab = ('<h3 id="ia">Artificial intelligence (AI) features</h3>\n'
           '<p>Some features use <strong>Claude</strong>, the AI from <strong>Anthropic</strong>, which processes the data on our behalf (section 3). In all of them:</p>\n<ul>\n'
           "  <li><strong>Our server sends it, not your phone.</strong> Anthropic does not receive your name, email, account or IP address, unless you write them yourself in what is sent. Before sending any text we remove the emails, phone numbers, links and @usernames we spot. Try not to write other people's details.</li>\n"
           "  <li><strong>We ask for your permission first</strong>, with a separate question and nothing ticked, except for translation and help with reviewing reports, whose rows explain why. Saying no doesn't take away anything you already had. You can withdraw it whenever you like in Account → Settings → Privacy and data (in the app and in “Your account”) and, from that moment, nothing more is sent.</li>\n"
           "  <li><strong>Nothing is published on its own.</strong> What the AI suggests, you check and publish yourself. Only the moderator decides without a person, when it doesn't publish something: we tell you why and a person reviews it if you ask (section 5).</li>\n"
           "  <li><strong>What Anthropic does with it:</strong> it doesn't use it to train its AI and deletes it within 30 days; anything its safety systems flag as a breach of its usage policy may be kept for up to 2 years, and its safety scores for up to 7. If it detects child sexual abuse, it says it reports it to the authorities.</li>\n"
           "  <li><strong>It can get things wrong.</strong> What the AI says doesn't bind Klendar: what is published applies.</li>\n</ul>\n"
           '<table>\n<tr><th>Feature</th><th>Data</th><th>Purpose</th><th>Legal basis</th><th>Retention at Klendar</th></tr>\n')
    filas = [
        _fila('Automatic moderator',
              "What you write or upload to publish (text, photos and a few frames from videos); the result (what it found and how likely), your account, when, and what was decided. If it isn't published, the text or original is stored separately and only you and the Klendar team can see it. We don't keep a separate copy of what is published",
              "Before it goes live, checking that it follows the <a href=\"/en/community-guidelines\">Community guidelines</a>: it is published, published for over-18s only (if it mentions alcohol), not published or, if in doubt, reviewed by a person. Anything very serious is hidden and a person reviews it straight away",
              "Your consent (Art. 6(1)(a) GDPR) to send it to the AI. Without it, or if the AI isn't available, the word lists or a person check it, without sending it to anyone, based on our legitimate interest in keeping the platform safe and enforcing the Guidelines (Art. 6(1)(f)); your photos may take longer to go live",
              "The result, 200 days. What isn't published, 6 months from the decision (the time limit for complaints), then deleted; sooner if you delete your account or business"),
        _fila('Help with reviewing reports',
              "What was reported (its text and image) and the reason, and up to 3 comments from the reporter, without their name, email or account and without any emails, phone numbers, links or documents in them; a personal name written in the report may still go. Only content published by someone who has given permission for the moderator is sent. Anything concerning child sexual abuse is never sent to any AI. We keep the AI's opinion: the result, the guideline, its confidence and the reason",
              ("The AI reads the report and, when it is clear, closes it or takes down what clearly breaks the Guidelines without a person looking at it first: we tell you, and a person reviews it if you ask. A person decides doubtful and serious matters; meanwhile, serious content may stay hidden. If you repeatedly report falsely, after a warning, your reports stop counting towards hiding anything automatically; we still read them"
               if denuncias_auto else
               "The AI reads the report and leaves its opinion and the reason for the person at Klendar who decides it, so reports are settled sooner. The AI doesn't close reports or hide or take down anything: that person always decides"),
              "Our legitimate interest in handling reports quickly and carefully, as the Digital Services Act requires (Art. 6(1)(f) GDPR), with the permission of whoever posted the content to send it to an AI",
              "The AI's opinion, 2 years, like the report"),
    ]
    filas.append(_fila('Reading documents with AI (claiming a business or applying for an organisation account)',
              'If you tick the box when uploading it, the document you use to prove a business or an organisation. The AI copies the holder\'s name, tax ID and address and the type of document. We don\'t keep what it reads: only whether it matches what you tell us, doesn\'t match or is doubtful, and why',
              "Helping the person at Klendar who reviews your request: it tells them whether it matches what you declare, doesn't match or is doubtful. It doesn't approve, verify or hand over anything: that person decides. It compares what it says, not whether the document is genuine",
              f'Your consent (Art. 6(1)(a)), given with the unticked box when uploading the document. Without it, a person still reviews it. To withdraw it, write to <a href="mailto:{E}">{E}</a>',
              'The result, together with the document: up to 6 months after the decision'))
    filas += [
        _fila('Automatic translation',
              "What you ask to translate (by tapping “Translate” under a business's text that is in another language), without storing who asked; and, if you turn it on, the “Always translate automatically” preference (with an account, in your profile; without one, on your phone or browser)",
              "Showing you in your language (the app's or the page's), only when you ask or if you have “Always translate automatically” on, the title, description and conditions of publications, news, the business description, “What to order here” and its menu. Next to the translated text it says “Automatic translation” or, if Google did it, “Translated by Google”, and you can always see the original. Reviews, questions and names are never translated. Our server translates them with Claude or, if it isn't available, with Google Cloud Translation. Both only receive the businesses' already published text, not your data or your account (including that of a business that hasn't given permission for the moderator, which is a separate thing); we keep the translation so we don't have to ask for it again",
              "Performance of a contract (you ask for it; “Always translate automatically” starts off). That's why we don't ask for separate permission",
              'The preference, until you change it or delete your account. Translations, up to 60 days after they were last used; those of a business that is deleted, at that moment'),
        _fila('Fill in from a photo, a link or some text (business account)',
              'The photo you choose of your poster, chalkboard or menu, reduced and without metadata; the link you paste (we read the page ourselves, without cookies or passwords: only its text and, if you ask for it, its image; the website sees a visit from Klendar, not from you), or the text you paste',
              'Reading what it says and writing it into the form, your menu list or a list of events you check one by one, so you can check it and publish it yourself. Nothing is ever published on its own',
              'Your consent (Art. 6(1)(a)), with a tick box the first time: one for photos and another for links and texts. Without it you type as usual',
              "Nothing: we don't keep the photo, the link, the text or what is read from them, unless you use the photo or the page's image as your publication's image. We only count how many readings are made per business per day"),
        _fila('Suggesting a category and tags (business account)',
              'The title and description you write when creating a publication',
              "Suggesting the publication's category and marks, which you can change. Nothing is ever published on its own",
              'Your consent (Art. 6(1)(a)). Without it, the form works as usual',
              'Nothing that was sent. We only count how many suggestions are requested per business per day'),
        _fila('Ideas for your business (business account)',
              "Your category and your venue's times of day, the matches you show, the weather forecast for your area, public holidays and the titles of your publications from recent months with their total views and redemptions (except those mentioning alcohol). Without the business name, address or anything about your customers",
              'Suggesting 1 to 3 offer or event ideas every week, which you check and publish yourself',
              'Your consent (Art. 6(1)(a)), given by whoever manages the business when turning them on; if they withdraw it, they switch off. They are turned on and off per business',
              "Each week's ideas, 8 weeks"),
        _fila('Suggesting replies to reviews',
              'The text of a public review and its stars, without the name, photo, date or anything else about the person who wrote it; we remove emails, phone numbers, links and @usernames. Only reviews written after the notice was shown when writing them, and none from anyone who has objected',
              'Preparing a draft for the business to check, change and publish itself. Nothing is ever sent on its own',
              "For the business using it, its consent (Art. 6(1)(a)). For the person who wrote the review, our legitimate interest and the business's in replying properly to something published so that it can be replied to (Art. 6(1)(f)). You can object at any time, without giving reasons, with “Keep my reviews away from AI”, in Settings or “Your account”: your reviews are then not sent",
              'Nothing that was sent; the draft, until the business publishes or discards it. We only count how many are requested per business per day'),
        _fila('Help assistant',
              "What you write in the assistant and up to 3 previous turns of that conversation, after removing emails, phone numbers, links, ID and tax numbers and IBANs; your language, whether you use the app or the website, and whether you are recorded as being of age. It goes without your name, account or IP address. Names, addresses or what you say about your health can't always be removed: don't write them",
              "Answering your questions about Klendar from what we have published in Help and the Guidelines, and knowing what is missing from Help. Before the first question it tells you it is an AI, not a person",
              'Your consent (Art. 6(1)(a)), given before the first question. You withdraw it in Settings or, without an account, by no longer using it (it is then stored only on your phone or browser). Without it, you still have Help and email',
              "We don't keep the conversation. We only count, for 13 months, how many questions there are, on what topic (from a closed list) and which it couldn't answer. To limit questions per day, a counter per person or, without an account, a summary of your connection that lasts 24 hours"),
    ]
    return cab + '\n'.join(filas) + '\n</table>\n'


def _filas_piloto(lang):
    """Filas de la tabla principal: las comprobaciones para verificar (decide una
    persona) y «¿Es tu negocio?» con un código (la única decisión automática)."""
    if lang == 'es':
        return (_fila('Comprobaciones para verificar negocios y entidades',
                      'El NIF o CIF, si tu correo o tu móvil están confirmados, la ficha, si hay otra parecida, el nombre y la descripción, y el resultado de cada comprobación',
                      'Antes de que una persona de Klendar verifique tu negocio o tu entidad, un sistema comprueba de forma automática que el NIF o CIF está bien formado y no es de otro negocio, que tu contacto está confirmado, que la ficha está completa, que no es un duplicado y que el nombre no coincide con una marca conocida ni lo ha marcado la moderación. Si todo cuadra, la pone en una lista para que esa persona la apruebe. El sistema no verifica ni rechaza nada: lo decide siempre una persona. «Verificado» quiere decir que lo ha revisado una persona de Klendar',
                      'Ejecución del contrato e interés legítimo en que lo publicado sea de fiar (art. 6.1.b y f RGPD)',
                      'Lo que se comprobó y lo que se decidió, 2 años') + '\n'
                + _fila('«¿Es tu negocio?» con un código',
                        'El correo publicado en la ficha, al que mandamos un código de 6 cifras, y una huella del código (nunca el código)',
                        'Que demuestres que llevas el negocio. Quien lleve ese correo recibe el aviso de que alguien lo ha pedido, sin saber quién. Si el código es bueno y además quien era propietario lleva 30 días sin entrar, no ha pagado nada y no hay más equipo, la propiedad se traspasa <strong>sin que lo mire una persona</strong>; quien era propietario sigue en el equipo como encargado, se le avisa y puede pedir que lo revise una persona. Si no se cumple todo, lo revisa una persona',
                        'Ejecución del contrato e interés legítimo en evitar suplantaciones (art. 6.1.b y f). Es una decisión automatizada: puedes pedir que la revise una persona (apartado 5)',
                        'El registro del código, 30 días; lo que se hizo y por qué, 2 años') + '\n')
    return (_fila('Checks before verifying businesses and organisations',
                  'The tax ID, whether your email or phone is confirmed, the page, whether there is a similar one, the name and description, and the result of each check',
                  "Before a person at Klendar verifies your business or organisation, a system automatically checks that the tax ID is well formed and not another business's, that your contact is confirmed, that the page is complete, that it isn't a duplicate and that the name doesn't match a known brand or carry a moderation flag. If everything checks out, it puts it on a list for that person to approve. The system doesn't verify or reject anything: a person always decides. “Verified” means a person at Klendar has reviewed it",
                  'Performance of the contract and legitimate interest in what is published being reliable (Art. 6(1)(b) and (f) GDPR)',
                  'What was checked and what was decided, 2 years') + '\n'
            + _fila('“Is this your business?” with a code',
                    'The email address published on the page, to which we send a 6-digit code, and a fingerprint of the code (never the code itself)',
                    "Letting you show that you run the business. Whoever uses that address is told that someone has asked, without being told who. If the code is right and, in addition, the previous owner hasn't logged in for 30 days, hasn't paid anything and there is no other team, ownership is handed over <strong>without a person looking at it</strong>; the previous owner stays on the team as a manager, is told, and can ask for a person to review it. If not everything is met, a person reviews it",
                    'Performance of the contract and legitimate interest in preventing impersonation (Art. 6(1)(b) and (f)). It is an automated decision: you can ask for a person to review it (section 5)',
                    'The code record, 30 days; what was done and why, 2 years') + '\n')


def _privacidad(lang, E):
    piloto = True  # documentos (ayuda), verificar (ayuda) y el código (automático): siempre
    if lang == 'es':
        c = [
            # Fotos y vídeos de las reseñas: ya no es «más adelante» ni Google Cloud Vision.
            ('Más adelante podremos analizar automáticamente las fotos y los vídeos (Google Cloud Vision) para detectar desnudos o violencia antes de publicarlos; te avisaremos antes de activarlo',
             'Si nos das permiso, el moderador automático los analiza antes de publicarlos (de los vídeos, unos fotogramas): ver «<a href="#ia">Funciones con inteligencia artificial</a>»'),
            # Denuncias: una IA ayuda a ordenarlas.
            ('Tramitar la denuncia y contestarte: confirmarte que la hemos recibido y decirte qué hemos decidido y por qué. Quien publicó el contenido no sabe quién lo denunció',
             'Tramitar la denuncia y contestarte: confirmarte que la hemos recibido y decirte qué hemos decidido y por qué. Quien publicó el contenido no sabe quién lo denunció. Para ir más rápido, una IA puede leerla antes, sin tus datos (ver «<a href="#ia">Funciones con inteligencia artificial</a>»)'),
            # La traducción pasa al bloque de IA.
            ('<tr><td>Traducción automática</td><td>Lo que pides traducir (al tocar «Traducir» debajo de un texto de un negocio que está en otro idioma), sin guardar quién lo pidió; y, si la enciendes, la preferencia «Traducir siempre automáticamente» (con cuenta, en tu perfil; sin ella, en tu móvil o tu navegador)</td><td>Enseñarte en tu idioma (el de la app o el de la página), solo cuando lo pides o si tienes encendido «Traducir siempre automáticamente», el título, la descripción y las condiciones de las publicaciones, las novedades, la descripción del negocio, «Qué pedir aquí» y su carta; junto al texto traducido se indica que lo ha traducido Google y siempre puedes ver el original. Nunca se traducen las reseñas, las preguntas ni los nombres. Lo traduce nuestro servidor con Google Cloud Translation, que solo recibe los textos de los negocios (sin tus datos ni tu cuenta); guardamos la traducción para no volver a pedirla</td><td>Ejecución del contrato (lo pides tú; «Traducir siempre automáticamente» empieza apagado)</td><td>La preferencia, hasta que la cambies o elimines la cuenta. Las traducciones, hasta 60 días después de la última vez que se usan; las de un negocio que se elimina, en ese momento</td></tr>\n',
             ''),
            ('<tr><td>Historial de consentimientos</td><td>Qué has aceptado o retirado y cuándo</td>',
             '<tr><td>Historial de consentimientos</td><td>Qué has aceptado o retirado y cuándo (también los permisos de las funciones con IA)</td>'),
            # El bloque nuevo, al final del apartado 2.
            ('\n<h2>3. Destinatarios y encargados del tratamiento</h2>',
             '\n' + _bloque_privacidad('es', E) + '\n<h2>3. Destinatarios y encargados del tratamiento</h2>'),
            # Encargados: Google de reserva y Anthropic.
            ('traducción automática de los textos que publican los negocios, solo si alguien la ha pedido; no recibe datos de las personas usuarias; transferencias internacionales amparadas en el Marco de Privacidad de Datos UE-EE. UU. y cláusulas contractuales tipo).</li>',
             'traducción automática de los textos que publican los negocios, solo si alguien la ha pedido y Claude no está disponible; no recibe datos de las personas usuarias; transferencias internacionales amparadas en el Marco de Privacidad de Datos UE-EE. UU. y cláusulas contractuales tipo).</li>\n'
             '  <li><strong>Anthropic</strong> (Anthropic Ireland, Limited; lo trata en Estados Unidos y, según la carga, en otros países: Claude, la IA de las «<a href="#ia">Funciones con inteligencia artificial</a>» del apartado 2: moderar lo que se publica, ayudar a revisar denuncias, traducir los textos de los negocios, rellenar publicaciones desde una foto, un enlace o un texto, las ayudas para negocios y el asistente de ayuda'
             + (', y leer los documentos de quien da permiso' if piloto else '')
             + '. No recibe tu nombre, tu correo ni tu cuenta. Transferencia con cláusulas contractuales tipo de la Comisión Europea. No entrena con ello).</li>'),
            ('<p>Las <strong>denuncias</strong> solo las ve el equipo de Klendar.',
             '<p>Las <strong>denuncias</strong> solo las ve el equipo de Klendar (y, para ayudarle a revisarlas, Claude, sin tus datos: «<a href="#ia">Funciones con inteligencia artificial</a>»).'),
            # Tus derechos.
            ('retirar por separado el consentimiento de ubicación, notificaciones push, estadísticas de uso y comunicaciones comerciales,',
             'retirar por separado el consentimiento de ubicación, notificaciones push, estadísticas de uso y comunicaciones comerciales y cada permiso de las funciones con IA, oponerte a que tus reseñas pasen por una IA,'),
            ('\n<h2>6. Seguridad</h2>',
             f'\n<p><strong>Decisiones automáticas.</strong> Cuando una decisión la toma un sistema automático (el traspaso de una ficha con el código de «¿Es tu negocio?», o que el moderador no publique algo tuyo), te lo decimos en el aviso, con el motivo. Puedes pedir que la revise una persona, dar tu punto de vista e impugnarla escribiendo a <a href="mailto:{E}">{E}</a> (art. 22 RGPD).</p>\n\n<h2>6. Seguridad</h2>'),
        ]
        if piloto:
            c += [
                ('Solo lo ve el equipo de Klendar, y la prueba se guarda en un almacenamiento privado',
                 'Solo lo ve el equipo de Klendar, y la prueba se guarda en un almacenamiento privado. Si marcas la casilla, una IA lee el documento para ayudar a quien lo revisa (ver «<a href="#ia">Funciones con inteligencia artificial</a>»)'),
                ('el documento, solo tú y Klendar, en un almacenamiento privado.',
                 'el documento, solo tú y Klendar, en un almacenamiento privado (y, si marcas la casilla, una IA lo lee para ayudar a quien lo revisa: ver «<a href="#ia">Funciones con inteligencia artificial</a>»).'),
                ('<tr><td>Cuenta de entidad (la solicitud)</td>',
                 _filas_piloto('es') + '<tr><td>Cuenta de entidad (la solicitud)</td>'),
            ]
        return c
    c = [
        ("In the future we may analyse photos and videos automatically (Google Cloud Vision) to detect nudity or violence before they're published; we'll let you know before turning it on",
         'If you give us permission, the automatic moderator analyses them before they are published (for videos, a few frames): see “<a href="#ia">Artificial intelligence features</a>”'),
        ("Handle the report and reply to you: confirm we've received it and tell you what we've decided and why. The person who posted the content doesn't know who reported it",
         "Handle the report and reply to you: confirm we've received it and tell you what we've decided and why. The person who posted the content doesn't know who reported it. To be quicker, an AI may read it first, without your details (see “<a href=\"#ia\">Artificial intelligence features</a>”)"),
        ("<tr><td>Automatic translation</td><td>What you ask to translate (by tapping “Translate” under a business's text that is in another language), without storing who asked; and, if you turn it on, the “Always translate automatically” preference (with an account, in your profile; without one, on your phone or browser)</td><td>Show you in your language (the app's or the page's), only when you ask or if you have “Always translate automatically” on, the title, description and conditions of publications, news, the business description, “What to order here” and its menu; next to the translated text it says that Google translated it, and you can always see the original. Reviews, questions and names are never translated. Our server translates them with Google Cloud Translation, which only receives the businesses' text (not your data or your account); we keep the translation so we don't have to ask for it again</td><td>Performance of a contract (you ask for it; “Always translate automatically” starts off)</td><td>The preference, until you change it or delete your account. Translations, up to 60 days after they were last used; those of a business that is deleted, at that moment</td></tr>\n",
         ''),
        ('<tr><td>Consent history</td><td>What you have accepted or withdrawn and when</td>',
         '<tr><td>Consent history</td><td>What you have accepted or withdrawn and when (including permissions for AI features)</td>'),
        ('\n<h2>3. Recipients and processors</h2>',
         '\n' + _bloque_privacidad('en', E) + '\n<h2>3. Recipients and processors</h2>'),
        ('automatic translation of the text businesses publish, only when someone has asked for it; it receives no data about users; international transfers covered by the EU-US Data Privacy Framework and standard contractual clauses).</li>',
         "automatic translation of the text businesses publish, only when someone has asked for it and Claude isn't available; it receives no data about users; international transfers covered by the EU-US Data Privacy Framework and standard contractual clauses).</li>\n"
         '  <li><strong>Anthropic</strong> (Anthropic Ireland, Limited; processed in the United States and, depending on load, other countries: Claude, the AI behind the “<a href="#ia">Artificial intelligence features</a>” in section 2: moderating what is published, helping to review reports, translating businesses\' text, filling in publications from a photo, a link or some text, AI help for businesses and the help assistant'
         + (', and reading the documents of whoever gives permission' if piloto else '')
         + ". It doesn't receive your name, email or account. Transfer under the European Commission's standard contractual clauses. It doesn't train on it).</li>"),
        ('<p><strong>Reports</strong> are only seen by the Klendar team.',
         '<p><strong>Reports</strong> are only seen by the Klendar team (and, to help it review them, Claude, without your details: “<a href="#ia">Artificial intelligence features</a>”).'),
        ('withdraw location, push, usage statistics and marketing consent separately,',
         'withdraw location, push, usage statistics and marketing consent and each AI feature permission separately, object to your reviews going through an AI,'),
        ('\n<h2>6. Security</h2>',
         f'\n<p><strong>Automated decisions.</strong> When an automated system takes a decision (handing over a page with the “Is this your business?” code, or the moderator not publishing something of yours), the notice tells you so, with the reason. You can ask for a person to review it, give your point of view and challenge it by writing to <a href="mailto:{E}">{E}</a> (Art. 22 GDPR).</p>\n\n<h2>6. Security</h2>'),
    ]
    if piloto:
        c += [
            ('Only the Klendar team sees it, and the evidence is kept in private storage',
             'Only the Klendar team sees it, and the evidence is kept in private storage. If you tick the box, an AI reads the document to help whoever reviews it (see “<a href="#ia">Artificial intelligence features</a>”)'),
            ('the document, only you and Klendar, in private storage.',
             'the document, only you and Klendar, in private storage (and, if you tick the box, an AI reads it to help whoever reviews it: see “<a href="#ia">Artificial intelligence features</a>”).'),
            ('<tr><td>Organisation account (the request)</td>',
             _filas_piloto('en') + '<tr><td>Organisation account (the request)</td>'),
        ]
    return c


# ════════════════════════════════════════════════════════════════════════════
# TÉRMINOS DE USO
# ════════════════════════════════════════════════════════════════════════════
def _terminos(lang, E):
    auto = bool(DENUNCIAS_AUTOMATICAS_DESDE)
    if lang == 'es':
        return [
            ('Al crear una cuenta o usar la app aceptas estos términos y la <a href="/privacidad">Política de privacidad</a>.</p>',
             'Al crear una cuenta o usar la app aceptas estos términos y la <a href="/privacidad">Política de privacidad</a>.</p>\n'
             '<p><strong>Funciones con inteligencia artificial.</strong> Algunas funciones usan una IA, Claude, de Anthropic: el moderador, la traducción y el asistente de ayuda, entre otras. Te pedimos permiso antes cuando hace falta, y qué hace cada una y qué datos usa está en la <a href="/privacidad#ia">Política de privacidad</a>. <strong>El asistente de ayuda</strong> es una herramienta automática que responde a partir de lo que tenemos publicado, y te dice que es una IA antes de empezar. Puede equivocarse. Lo que diga no cambia estos términos, ni los precios ni las condiciones, y no es una promesa ni un compromiso de Klendar: si no coincide con lo publicado, vale lo publicado. No da consejo legal, médico ni de impuestos, y no hace nada en tu cuenta.</p>'),
            ('la traducción es automática, la hace Google Translate y puede tener errores:',
             'la traducción es automática, la hace Claude, la IA de Anthropic, o, si no está disponible, Google Translate, y puede tener errores:'),
            ('Antes de publicarse, los textos pasan por una moderación automática que puede dejarlos en revisión hasta que los mire una persona; cómo funciona está en las <a href="/normas">Normas de la comunidad</a>.</li>',
             'Antes de publicarse, lo que escribes y subes pasa por una moderación automática: si nos das permiso, la hace Claude, la IA de Anthropic, que puede publicarlo, publicarlo solo para mayores de 18, no publicarlo o dejarlo para que lo mire una persona; sin tu permiso, las listas de palabras y una persona. Si no se publica, te decimos el motivo y lo revisa una persona si lo pides. '
             + ('Si varias personas distintas denuncian lo mismo por ser inapropiado o ilegal, lo ocultamos automáticamente mientras lo revisa una persona del equipo: es provisional, te avisamos y, si cumple las normas, vuelve a verse. ' if auto else '')
             + 'Cómo funciona está en las <a href="/normas">Normas de la comunidad</a>.</li>'),
        ]
    return [
        ('By creating an account or using the app you accept these terms and the <a href="/en/privacy">Privacy policy</a>.</p>',
         'By creating an account or using the app you accept these terms and the <a href="/en/privacy">Privacy policy</a>.</p>\n'
         "<p><strong>Artificial intelligence features.</strong> Some features use an AI, Claude, from Anthropic: the moderator, translation and the help assistant, among others. We ask for your permission first where needed, and what each one does and what data it uses is in the <a href=\"/en/privacy#ia\">Privacy policy</a>. <strong>The help assistant</strong> is an automated tool that answers from what we have published, and tells you it is an AI before you start. It can get things wrong. What it says does not change these terms, the prices or the conditions, and it is not a promise or commitment by Klendar: if it differs from what is published, what is published applies. It does not give legal, medical or tax advice and does nothing in your account.</p>"),
        ("the translation is automatic, it's done by Google Translate and it may contain mistakes:",
         "the translation is automatic, it's done by Claude, the AI from Anthropic, or, if it isn't available, Google Translate, and it may contain mistakes:"),
        ('Before going live, text goes through automatic moderation that may hold it for review until a person has looked at it; how it works is explained in the <a href="/en/community-guidelines">Community guidelines</a>.</li>',
         "Before going live, what you write and upload goes through automatic moderation: if you give us permission, it's done by Claude, the AI from Anthropic, which may publish it, publish it for over-18s only, not publish it or leave it for a person to look at; without your permission, the word lists and a person. If it isn't published, we tell you why and a person reviews it if you ask. "
         + ("If several different people report the same thing as inappropriate or illegal, we automatically hide it while someone on the team reviews it: it is provisional, we let you know and, if it follows the guidelines, it goes back up. " if auto else '')
         + 'How it works is explained in the <a href="/en/community-guidelines">Community guidelines</a>.</li>'),
    ]


# ════════════════════════════════════════════════════════════════════════════
# CONDICIONES PARA NEGOCIOS
# ════════════════════════════════════════════════════════════════════════════
def _apartado_6bis(lang):
    if lang == 'es':
        return ('<h2 id="ia">6 bis. Herramientas con inteligencia artificial</h2>\n'
                '<p>Klendar ofrece al Negocio herramientas opcionales con IA (Claude, de Anthropic). Cada una pide permiso a quien la usa la primera vez y se apaga en Ajustes; sin ella, todo funciona como siempre. Qué se envía y qué se guarda está en la <a href="/privacidad#ia">Política de privacidad</a>. Lo que propone la IA es una propuesta, no una decisión: nada se publica ni se envía sin que el Negocio lo revise y lo confirme, y lo publicado pasa por la moderación de siempre (apartado 6).</p>\n<ul>\n'
                '  <li><strong>Rellenar desde una foto, un enlace o un texto.</strong> Lo que lee la IA es una propuesta que el Negocio revisa: puede equivocarse, dejarse algo o dejar campos vacíos. Lo que publica es suyo y responde de ello igual que si lo hubiera escrito: los precios, el precio anterior, las fechas, el sitio, las condiciones y, muy especialmente, los alérgenos, que tiene que comprobar él (Reglamento (UE) 1169/2011). Solo sube, enlaza o pega lo suyo o lo que tenga derecho a usar (también la imagen de una página) y procura que no salgan personas ni datos personales.</li>\n'
                '  <li><strong>Ayudas de IA.</strong> Lo que propone la IA (la categoría y las marcas de una publicación, las ideas de la semana, los borradores de respuesta a reseñas) es una propuesta que el Negocio revisa: puede equivocarse. Lo que publica o contesta es suyo y responde de ello igual que si lo hubiera escrito, también de los precios, las condiciones y lo que diga a sus clientes. Las ideas no llevan precio, no son un consejo profesional y no garantizan ningún resultado.</li>\n'
                '  <li><strong>Asistente de ayuda.</strong> Lo que diga el asistente no cambia estas condiciones, ni los precios ni el plan, y no es una promesa ni un compromiso de Klendar: si no coincide con lo publicado, vale lo publicado. Puede equivocarse, no da consejo legal, fiscal ni de otro tipo y no hace nada en la cuenta del Negocio.</li>\n</ul>\n\n')
    return ('<h2 id="ia">6a. Artificial intelligence tools</h2>\n'
            "<p>Klendar offers the Business optional AI tools (Claude, from Anthropic). Each one asks whoever uses it for permission the first time and can be turned off in Settings; without it, everything works as usual. What is sent and what is kept is in the <a href=\"/en/privacy#ia\">Privacy policy</a>. What the AI proposes is a suggestion, not a decision: nothing is published or sent unless the Business checks and confirms it, and what is published goes through the usual moderation (section 6).</p>\n<ul>\n"
            "  <li><strong>Fill in from a photo, a link or some text.</strong> What the AI reads is a suggestion that the Business checks: it can make mistakes, miss things or leave fields empty. What it publishes is its own and it is responsible for it just as if it had written it: prices, the previous price, dates, the venue, conditions and, above all, allergens, which it must check itself (Regulation (EU) 1169/2011). It only uploads, links or pastes its own material or material it has the right to use (including a page's image) and tries to keep people and personal details out of it.</li>\n"
            "  <li><strong>AI help.</strong> What the AI suggests (a publication's category and marks, the week's ideas, draft replies to reviews) is a suggestion that the Business checks: it can make mistakes. What it publishes or replies is its own and it is responsible for it just as if it had written it, including prices, conditions and what it says to its customers. Ideas don't include prices, aren't professional advice and don't guarantee any result.</li>\n"
            "  <li><strong>Help assistant.</strong> What the assistant says does not change these terms, the prices or the plan, and it is not a promise or commitment by Klendar: if it differs from what is published, what is published applies. It can get things wrong, gives no legal, tax or other advice and does nothing in the Business's account.</li>\n</ul>\n\n")


def _negocios(lang, E):
    auto = bool(DENUNCIAS_AUTOMATICAS_DESDE)
    pend = [(IA_DESDE, 'apartados 1, 3 bis, 6 y 6 bis', 'sections 1, 3a, 6 and 6a')]
    if auto:
        pend.append((DENUNCIAS_AUTOMATICAS_DESDE, 'apartado 6', 'section 6'))
    if lang == 'es':
        # El aviso de arriba: una frase más, detrás de la lista de lo que aún no se aplica.
        nuevo = 'avisar al Negocio (Reglamento (UE) 2019/1150, art. 3.2). ' + ' '.join(
            f'Los cambios del {fecha(d, "es")} ({ap}) se aplican desde el <strong>{fecha(aplica(d), "es")}</strong>, también 15 días después.' for d, ap, _ in pend)
        return [
            ('avisar al Negocio (Reglamento (UE) 2019/1150, art. 3.2). ', nuevo),
            # 1. Verificar: el sistema comprueba y prepara la lista; verifica una persona.
            ('Klendar verifica el alta antes de hacerlo público y puede rechazarlo motivadamente.</li>',
             'Klendar verifica el alta antes de hacerlo público y puede rechazarlo motivadamente. Un sistema comprueba antes de forma automática los datos que se cuentan en la Política de privacidad («Comprobaciones para verificar negocios y entidades») y, si todo cuadra, lo deja listo para aprobar, pero quien verifica es siempre una persona de Klendar. «Verificado» quiere decir que lo ha revisado una persona de Klendar, no que Klendar responda del Negocio.</li>'),
            # 1. Reclamar: el código traspasa solo; el documento lo lee la IA para ayudar.
            ('Klendar lo revisa a mano y, si lo aprueba, le traspasa la propiedad;',
             'Klendar lo revisa y, si lo aprueba, le traspasa la propiedad. Si quien reclama marca la casilla al subir un documento, una IA (Claude, de Anthropic) lo lee antes para ayudar a la persona de Klendar que lo revisa; no decide nada. Hay una excepción, lo único que se decide sin una persona: si la ficha tiene un correo publicado, quien reclama puede pedir un código a ese correo y, si lo escribe bien, la propiedad se le traspasa de forma automática cuando además quien era propietario lleva 30 días sin entrar, no ha pagado nada y no hay más equipo; quien era propietario se queda como encargado, recibe el aviso y puede pedir que lo revise una persona. Por eso el Negocio debe mantener al día el correo de su ficha. En los dos casos,'),
            # 3 bis. Entidades: lo revisa una persona; la IA puede leer el documento para ayudarle.
            ('Podemos pedir más información, escribir al correo',
             'Lo revisa siempre una persona, también si el correo o la web son de un dominio oficial. Si lo marcas al subirlo, una IA (Claude, de Anthropic) lee antes el documento y le dice a esa persona si coincide con lo que declaras; quien decide es la persona. Podemos pedir más información, escribir al correo'),
            ('Los textos del Negocio pasan por una moderación automática que puede dejarlos en revisión hasta que los revise una persona de Klendar (ver «Cómo moderamos» en las <a href="/normas">Normas de la comunidad</a>); la ficha y la carta siguen a la vista mientras tanto.',
             'Lo que publica el Negocio (textos, fotos y vídeos) pasa por una moderación automática: si quien lo publica ha dado permiso, la hace Claude, la IA de Anthropic, que decide publicarlo, publicarlo solo para mayores de 18, no publicarlo o, si hay dudas, dejarlo para que lo revise una persona de Klendar; sin ese permiso, las listas de palabras y una persona (ver «Cómo moderamos» en las <a href="/normas">Normas de la comunidad</a>). Una publicación, una novedad o un mensaje a clientes sale cuando se decide, normalmente en segundos. Mientras una foto espera, en su lugar se ve la anterior o una imagen neutra, y se pone sola al aprobarse; la ficha y la carta siguen a la vista mientras se revisan sus textos. Si algo no se publica, el Negocio recibe el motivo y puede pedir que lo revise una persona en el plazo de 6 meses. '
             + ('Si la ficha o las publicaciones del Negocio reciben varias denuncias por contenido inapropiado o ilegal, Klendar puede ocultarlas de forma provisional hasta revisarlas, y un sistema automático con IA puede ocultar contenido tras una denuncia si incumple claramente las Normas, con el motivo y sin que lo mire antes una persona; una persona lo revisa si el Negocio lo pide.'
                if auto else
                'Para tramitar antes las denuncias, una IA puede leerlas y dar su opinión a la persona de Klendar que las decide; la IA no oculta ni retira nada.')),
            ('\n<h2>7. Propiedad intelectual y datos</h2>',
             '\n' + _apartado_6bis('es') + '<h2>7. Propiedad intelectual y datos</h2>'),
        ]
    nuevo = 'notifying the Business (Regulation (EU) 2019/1150, art. 3(2)). ' + ' '.join(
        f'The changes of {fecha(d, "en")} ({ap}) apply from <strong>{fecha(aplica(d), "en")}</strong>, also 15 days later.' for d, _, ap in pend)
    return [
        ('notifying the Business (Regulation (EU) 2019/1150, art. 3(2)). ', nuevo),
        ('Klendar verifies the registration before making it public and may reject it with reasons.</li>',
         "Klendar verifies the registration before making it public and may reject it with reasons. A system first automatically checks the details described in the Privacy policy (“Checks before verifying businesses and organisations”) and, if everything checks out, makes it ready for approval, but verification is always done by a person at Klendar. “Verified” means a person at Klendar has reviewed it, not that Klendar vouches for the Business.</li>"),
        ('Klendar reviews it by hand and, if it approves it, hands ownership over to them;',
         "Klendar reviews it and, if it approves it, hands ownership over to them. If the claimant ticks the box when uploading a document, an AI (Claude, from Anthropic) reads it first to help the person at Klendar who reviews it; it decides nothing. There is one exception, the only thing decided without a person: if the page has a published email address, the claimant can ask for a code to be sent to it and, if they enter it correctly, ownership is handed over automatically when, in addition, the previous owner hasn't logged in for 30 days, hasn't paid anything and there is no other team; the previous owner stays on as a manager, is notified and can ask for a person to review it. That is why the Business must keep its page's email up to date. In both cases,"),
        ('We may ask for more information, write to the email address',
         "A person always reviews it, even if the email or website is on an official domain. If you tick the box when uploading it, an AI (Claude, from Anthropic) reads the document first and tells that person whether it matches what you declare; the person decides. We may ask for more information, write to the email address"),
        ("The Business's text goes through automatic moderation that may hold it for review until someone at Klendar has reviewed it (see “How we moderate” in the <a href=\"/en/community-guidelines\">Community guidelines</a>); the business page and menu stay visible in the meantime.",
         "What the Business publishes (text, photos and videos) goes through automatic moderation: if whoever publishes it has given permission, it's done by Claude, the AI from Anthropic, which decides to publish it, publish it for over-18s only, not publish it or, if in doubt, leave it for someone at Klendar to review; without that permission, the word lists and a person (see “How we moderate” in the <a href=\"/en/community-guidelines\">Community guidelines</a>). A publication, news post or customer message goes live when decided, usually within seconds. While a photo waits, the previous one or a neutral image is shown in its place, and it appears by itself once approved; the business page and menu stay visible while their text is reviewed. If something isn't published, the Business is given the reason and may ask for a person to review it within 6 months. "
         + ("If the Business's page or publications receive several reports of inappropriate or illegal content, Klendar may provisionally hide them until they are reviewed, and an automated AI system may hide content following a report if it clearly breaks the Guidelines, with the reason and without a person looking at it first; a person reviews it if the Business asks."
            if auto else
            "To handle reports sooner, an AI may read them and give its opinion to the person at Klendar who decides them; the AI doesn't hide or take down anything.")),
        ('\n<h2>7. Intellectual property and data</h2>',
         '\n' + _apartado_6bis('en') + '<h2>7. Intellectual property and data</h2>'),
    ]


def versiones_negocios():
    """Filas nuevas de VERSIONES_NEGOCIOS (versión, publicada, se aplica desde)."""
    xs = []
    for d in (IA_DESDE, DENUNCIAS_AUTOMATICAS_DESDE):
        if d:
            v = d if not any(x[0] == d for x in xs) else d + '-b'
            xs.append((v, d, aplica(d)))
    return sorted(xs, key=lambda x: x[0], reverse=True)


# ════════════════════════════════════════════════════════════════════════════
# NORMAS DE LA COMUNIDAD
# ════════════════════════════════════════════════════════════════════════════
def _normas(lang, E):
    auto = bool(DENUNCIAS_AUTOMATICAS_DESDE)
    if lang == 'es':
        denuncias = ('  <li><strong>Denuncias con ayuda de una IA.</strong> Un sistema automático con IA (Claude, de Anthropic) puede leer una denuncia, sin el nombre ni el correo de quien denuncia, y cerrarla si no hay nada, u ocultar lo que incumple claramente estas normas. Te decimos siempre que ha sido automático y por qué. <strong>Lo revisa siempre una persona si lo pides</strong>, en 6 meses, en '
                     f'<a href="mailto:{E}">{E}</a>. Lo dudoso y lo grave (lo ilegal, lo que afecta a menores) lo decide una persona; mientras tanto, lo grave puede quedar oculto. Si varias personas distintas denuncian lo mismo por ser inapropiado o ilegal, lo ocultamos automáticamente mientras lo revisa una persona del equipo: es provisional, te avisamos al ocultarlo y, si cumple las normas, vuelve a verse (la ficha entera de un negocio no se oculta así, solo sus imágenes). Si denuncias en falso de forma repetida, te avisamos y tus denuncias dejarán de contar para ocultar nada de forma automática. Lo que tenga que ver con abuso sexual infantil no se envía a ninguna IA: lo mira una persona.</li>\n'
                     if auto else
                     '  <li><strong>Denuncias con ayuda de una IA.</strong> Para ir más rápido, Claude, la IA de Anthropic, puede leer una denuncia (sin el nombre ni el correo de quien denuncia) y dejar su opinión a la persona que la decide. No cierra, no oculta ni retira nada por su cuenta: decide siempre una persona. Lo que tenga que ver con abuso sexual infantil no se envía a ninguna IA: lo mira una persona.</li>\n')
        return [
            ('Quien publicó el contenido no sabrá quién lo denunció. Las decisiones las toma una persona, no un sistema automático.</p>',
             ('Quien publicó el contenido no sabrá quién lo denunció. Un sistema automático con IA puede resolver lo claro; lo dudoso y lo grave lo decide una persona, y lo revisa una persona si lo pides («Cómo moderamos», más abajo).</p>'
              if auto else
              'Quien publicó el contenido no sabrá quién lo denunció. Las decisiones las toma una persona. Para ir más rápido, una IA puede leer antes la denuncia y dejarle su opinión, pero no cierra ni oculta nada («Cómo moderamos», más abajo).</p>')),
            ('(24 horas si es contenido objetable, afecta a menores o es claramente ilegal).</li>\n',
             '(24 horas si es contenido objetable, afecta a menores o es claramente ilegal).</li>\n'
             '  <li><strong>Un moderador con IA y personas.</strong> Si nos das permiso, lo que escribes y las fotos que subes los analiza antes de publicarse Claude, la IA de Anthropic; de un vídeo mira unos pocos fotogramas, no todo. Si es claramente lo que estas normas no permiten, no se publica; si hay dudas, lo retenemos hasta que lo revise una persona del equipo; si es muy grave, lo ocultamos y lo revisa una persona enseguida. Te lo decimos siempre, con el motivo si no se publica, y puedes pedir que lo revise una persona en un plazo de 6 meses escribiendo a '
             f'<a href="mailto:{E}">{E}</a>. Sin tu permiso, o si ese servicio no está disponible, usamos las listas de palabras (el punto siguiente) o lo revisa una persona, y tus fotos pueden tardar más. Se puede equivocar en los dos sentidos: por eso sigue siendo importante que denuncies lo que veas.</li>\n'
             + denuncias),
            ('Lo que se marca no se publica hasta que lo revisa una persona de Klendar, normalmente en menos de 24 horas;',
             'Sin el moderador con IA, lo que se marca no se publica hasta que lo revisa una persona de Klendar, normalmente en menos de 24 horas;'),
        ]
    denuncias = ('  <li><strong>Reports with the help of an AI.</strong> An automated AI system (Claude, from Anthropic) may read a report, without the reporter\'s name or email, and close it if there is nothing to it, or hide what clearly breaks these guidelines. We always tell you that it was automatic and why. <strong>A person always reviews it if you ask</strong>, within 6 months, at '
                 f'<a href="mailto:{E}">{E}</a>. A person decides doubtful and serious matters (anything illegal or affecting minors); meanwhile, serious content may stay hidden. If several different people report the same thing as inappropriate or illegal, we automatically hide it while someone on the team reviews it: it is provisional, we let you know when it\'s hidden and, if it follows the guidelines, it goes back up (a business\'s whole page isn\'t hidden this way, only its images). If you repeatedly report falsely, we warn you and your reports stop counting towards hiding anything automatically. Anything concerning child sexual abuse is never sent to any AI: a person looks at it.</li>\n'
                 if auto else
                 "  <li><strong>Reports with the help of an AI.</strong> To be quicker, Claude, the AI from Anthropic, may read a report (without the reporter's name or email) and leave its opinion for the person who decides it. It doesn't close, hide or take down anything on its own: a person always decides. Anything concerning child sexual abuse is never sent to any AI: a person looks at it.</li>\n")
    return [
        ("The person who posted the content won't know who reported it. Decisions are made by a person, not by an automated system.</p>",
         ("The person who posted the content won't know who reported it. An automated AI system may settle clear cases; a person decides doubtful and serious ones, and a person reviews it if you ask (“How we moderate”, below).</p>"
          if auto else
          "The person who posted the content won't know who reported it. Decisions are made by a person. To be quicker, an AI may read the report first and leave its opinion for that person, but it doesn't close or hide anything (“How we moderate”, below).</p>")),
        ("(24 hours if it's objectionable content, involves minors or is clearly illegal).</li>\n",
         "(24 hours if it's objectionable content, involves minors or is clearly illegal).</li>\n"
         "  <li><strong>An AI moderator and people.</strong> If you give us permission, what you write and the photos you upload are analysed before they go live by Claude, the AI from Anthropic; for a video it looks at a few frames, not all of it. If it is clearly something these guidelines don't allow, it isn't published; if there is any doubt, we hold it back until someone on the team reviews it; if it is very serious, we hide it and someone reviews it straight away. We always tell you, with the reason if it isn't published, and you can ask a person to review it within 6 months by writing to "
         f"<a href=\"mailto:{E}\">{E}</a>. Without your permission, or if that service isn't available, we use the word lists (next point) or a person reviews it, and your photos may take longer. It can make mistakes both ways, which is why it still matters that you report what you see.</li>\n"
         + denuncias),
        ("Anything flagged isn't published until someone at Klendar has reviewed it, usually within 24 hours;",
         "Without the AI moderator, anything flagged isn't published until someone at Klendar has reviewed it, usually within 24 hours;"),
    ]


# ════════════════════════════════════════════════════════════════════════════
# COOKIES: la clave del permiso del asistente sin cuenta
# ════════════════════════════════════════════════════════════════════════════
def _cookies(lang, E):
    if lang == 'es':
        return [('<tr><td><code>klendar.traducir.ok</code></td><td>Las fichas (almacenamiento de sesión)</td><td>Si la traducción automática está disponible ahora, para no preguntarlo en cada página</td><td>10 minutos, o hasta cerrar la pestaña</td><td>Técnica</td></tr>',
                 '<tr><td><code>klendar.traducir.ok</code></td><td>Las fichas (almacenamiento de sesión)</td><td>Si la traducción automática está disponible ahora, para no preguntarlo en cada página</td><td>10 minutos, o hasta cerrar la pestaña</td><td>Técnica</td></tr>\n'
                 '<tr><td><code>klendar.asistente.permiso</code></td><td>El asistente de ayuda (almacenamiento local)</td><td>Recordar que, sin haber entrado, aceptaste el aviso del asistente (que es una IA y qué se le envía), para no preguntártelo cada vez</td><td>Hasta que borres los datos del navegador</td><td>Técnica</td></tr>')]
    return [('<tr><td><code>klendar.traducir.ok</code></td><td>Publication and business pages (session storage)</td><td>Whether automatic translation is available right now, so it isn\'t checked on every page</td><td>10 minutes, or until you close the tab</td><td>Technical</td></tr>',
             '<tr><td><code>klendar.traducir.ok</code></td><td>Publication and business pages (session storage)</td><td>Whether automatic translation is available right now, so it isn\'t checked on every page</td><td>10 minutes, or until you close the tab</td><td>Technical</td></tr>\n'
             "<tr><td><code>klendar.asistente.permiso</code></td><td>The help assistant (local storage)</td><td>Remembering that, without logging in, you accepted the assistant's notice (that it is an AI and what is sent to it), so you aren't asked every time</td><td>Until you clear your browser data</td><td>Technical</td></tr>")]


def aplicar(ES, EN, E):
    """Cambia los cuerpos de las páginas de build_legal.py (si IA_DESDE tiene fecha)."""
    if not activo():
        return
    for slug, f in (('privacidad', _privacidad), ('terminos', _terminos), ('negocios', _negocios),
                    ('normas', _normas), ('cookies', _cookies)):
        _aplica_lista(ES, slug, 'es', f('es', E))
        _aplica_lista(EN, slug, 'en', f('en', E))


# ════════════════════════════════════════════════════════════════════════════
# HISTORIAL DE CAMBIOS: (slug, fecha, ES, EN)
# ════════════════════════════════════════════════════════════════════════════
def cambios():
    if not activo():
        return []
    f = fechas(IA_DESDE)
    desde = fechas(aplica(IA_DESDE))
    xs = [
        ('privacidad', f,
         'Apartado nuevo «Funciones con inteligencia artificial» (en el 2): el moderador automático, la ayuda para revisar denuncias, la traducción, rellenar desde una foto, un enlace o un texto, las ayudas para negocios y el asistente de ayuda usan Claude, la IA de Anthropic, nuevo encargado (apartado 3). Qué se envía, qué se guarda, cuándo te pedimos permiso y cómo retirarlo. La traducción pasa a esa tabla y Google Cloud Translation queda de reserva. Filas nuevas «Comprobaciones para verificar negocios y entidades» (verifica siempre una persona) y «¿Es tu negocio?» con un código (la única decisión automática); al reclamar un negocio o pedir una cuenta de entidad, una IA puede leer el documento, si lo marcas, para ayudar a quien lo revisa. En «Tus derechos», qué puedes hacer ante una decisión automática.',
         'New “Artificial intelligence features” part (in section 2): the automatic moderator, help with reviewing reports, translation, filling in from a photo, a link or some text, AI help for businesses and the help assistant use Claude, the AI from Anthropic, a new processor (section 3). What is sent, what is kept, when we ask for your permission and how to withdraw it. Translation moves to that table and Google Cloud Translation stays as a backup. New rows “Checks before verifying businesses and organisations” (a person always verifies) and “Is this your business?” with a code (the only automated decision); when claiming a business or applying for an organisation account, an AI may read the document, if you tick the box, to help whoever reviews it. In “Your rights”, what you can do about an automated decision.'),
        ('terminos', f,
         'Funciones con inteligencia artificial y el asistente de ayuda (apartado 1); la traducción automática la hace Claude y, de reserva, Google Translate (apartado 3); la moderación automática con IA (apartado 4). Tus derechos y obligaciones no cambian, así que no hace falta volver a aceptarlos.',
         "Artificial intelligence features and the help assistant (section 1); automatic translation is done by Claude, with Google Translate as a backup (section 3); automatic moderation with AI (section 4). Your rights and obligations don't change, so there's no need to accept them again."),
        ('negocios', f,
         f'Verificar lo hace siempre una persona, y «¿Es tu negocio?» con un código al correo publicado puede traspasar la ficha sin una persona (apartado 1); una IA puede leer el documento de una reclamación o de una entidad para ayudar a quien lo revisa (apartados 1 y 3 bis); la moderación con IA y la ayuda de una IA para revisar las denuncias (apartado 6), y apartado nuevo 6 bis, «Herramientas con inteligencia artificial»: rellenar desde una foto, un enlace o un texto, las ayudas de IA y el asistente de ayuda. Se aplica desde el {desde["es"]}, 15 días después de publicarlo y avisarte.',
         f'Verification is always done by a person, and “Is this your business?” with a code sent to the published email may hand a page over without a person (section 1); an AI may read the document of a claim or an organisation to help whoever reviews it (sections 1 and 3a); moderation with AI and an AI helping to review reports (section 6), and new section 6a, “Artificial intelligence tools”: filling in from a photo, a link or some text, AI help and the help assistant. It applies from {desde["en"]}, 15 days after publishing it and notifying you.'),
        ('normas', f,
         '«Cómo moderamos»: un moderador con IA (Claude, de Anthropic), si das permiso, y una IA que ayuda a revisar las denuncias; «Cómo denunciar», al día.',
         '“How we moderate”: an AI moderator (Claude, from Anthropic), if you give permission, and an AI that helps to review reports; “How to report”, updated.'),
        ('cookies', f,
         'Clave nueva klendar.asistente.permiso, del asistente de ayuda (solo sin haber entrado).',
         'New klendar.asistente.permiso key, for the help assistant (only when not logged in).'),
        ('soporte', f,
         '«La traducción no es correcta»: las traducciones las hace Claude y, de reserva, Google Translate, solo cuando las pides.',
         '“The translation is wrong”: translations are done by Claude, with Google Translate as a backup, only when you ask for them.'),
    ]
    if DENUNCIAS_AUTOMATICAS_DESDE:
        d = fechas(DENUNCIAS_AUTOMATICAS_DESDE)
        xs += [
            ('normas', d, 'Denuncias: lo que denuncian varias personas se oculta mientras se revisa, y la IA puede cerrar u ocultar lo claro, con revisión de una persona si la pides.',
             'Reports: what several people report is hidden while it is reviewed, and the AI may close or hide clear cases, with a review by a person if you ask.'),
            ('terminos', d, 'Lo que denuncian varias personas se oculta de forma provisional mientras se revisa (apartado 4).',
             'What several people report is provisionally hidden while it is reviewed (section 4).'),
            ('privacidad', d, 'Ayuda para revisar denuncias: la IA puede cerrar u ocultar lo claro, y las denuncias en falso repetidas dejan de contar para ocultar.',
             'Help with reviewing reports: the AI may close or hide clear cases, and repeated false reports stop counting towards hiding.'),
            ('negocios', d,
             f'Ocultar de forma provisional por varias denuncias y por la IA (apartado 6). Se aplica desde el {fechas(aplica(DENUNCIAS_AUTOMATICAS_DESDE))["es"]}.',
             f'Provisional hiding after several reports and by the AI (section 6). It applies from {fechas(aplica(DENUNCIAS_AUTOMATICAS_DESDE))["en"]}.'),
        ]
    return xs


# ════════════════════════════════════════════════════════════════════════════
# AYUDA (ayuda.py): preguntas nuevas y la de la traducción
# ════════════════════════════════════════════════════════════════════════════
def ayuda(preguntas, P):
    """Las preguntas del centro de ayuda con lo de la IA (si IA_DESDE tiene fecha)."""
    if not activo():
        return preguntas
    m = 'mailto:' + CORREO
    nuevas_ti = [
        P('ia', 'ti',
          '¿Klendar usa inteligencia artificial?',
          f'Sí, en algunas cosas, y siempre con Claude, la IA de Anthropic: para revisar lo que publicas, si nos das permiso; para traducir los textos de los negocios cuando lo pides, y en el asistente de ayuda. Nunca publica nada por ti y no se le envía tu nombre ni tu cuenta. Los permisos se quitan en Ajustes → Privacidad y datos. Qué se envía y qué se guarda está en la <a href="/privacidad#ia">Política de privacidad</a>.',
          'Does Klendar use artificial intelligence?',
          "Yes, for some things, and always with Claude, the AI from Anthropic: to check what you publish, if you give us permission; to translate businesses' text when you ask, and in the help assistant. It never publishes anything for you and your name and account aren't sent to it. You can withdraw permissions in Settings → Privacy and data. What is sent and what is kept is in the <a href=\"/en/privacy#ia\">Privacy policy</a>."),
        P('asistente', 'ti',
          '¿Qué es el asistente de ayuda?',
          f'Una IA que responde a tus dudas sobre Klendar con lo que tenemos publicado en estas preguntas y en las <a href="/normas">Normas</a>. Puede equivocarse y lo que dice no nos obliga: si no te sirve, escríbenos a <a href="{m}">{CORREO}</a>. No pongas datos personales. No guardamos la conversación.',
          'What is the help assistant?',
          f"An AI that answers your questions about Klendar from what we've published in these questions and the <a href=\"/en/community-guidelines\">Community Guidelines</a>. It can get things wrong and what it says doesn't bind us: if it doesn't help, write to <a href=\"{m}\">{CORREO}</a>. Don't include personal data. We don't keep the conversation."),
    ]
    nuevas_negocios = [
        P('rellenar-desde', 'negocios',
          '¿Puedo rellenar una publicación desde una foto, un enlace o un texto?',
          'Sí. Al crear una publicación, pulsa «Rellenar desde…» y elige una foto de tu cartel, el enlace de la página de tu evento o un texto que tengas (un WhatsApp, por ejemplo); en «Carta», haz fotos a tu carta. Se rellena el formulario y, si hay varios eventos, sale una lista para revisarlos uno a uno. Lo lee una IA (Claude, de Anthropic, EE. UU.): revísalo, porque puede equivocarse, y mira bien lo marcado y los alérgenos. Si un enlace no se puede leer (Instagram o Facebook, muchas veces), usa una captura. No se publica nada sin ti y no se guarda lo que mandas, salvo que uses la foto o la imagen de la página como imagen. Si prefieres que no, escribe a mano: los permisos se quitan en Ajustes.',
          'Can I fill in a publication from a photo, a link or some text?',
          "Yes. When creating a publication, tap “Fill in from…” and choose a photo of your poster, the link to your event's page or some text you have (a WhatsApp message, say); in “Menu”, take photos of your menu. The form fills itself and, if there are several events, a list appears so you can check them one by one. An AI reads it (Claude, from Anthropic, US): check it, because it can make mistakes, and look closely at what's marked and at allergens. If a link can't be read (often Instagram or Facebook), use a screenshot. Nothing goes live without you and what you send isn't kept, unless you use the photo or the page's image as the image. If you'd rather not, type it in: you can withdraw permissions in Settings."),
        P('ayudas-ia', 'negocios',
          '¿Qué ayudas de IA hay para mi negocio?',
          '<strong>Categoría y etiquetas propuestas.</strong> Al crear una publicación, una IA (Claude, de Anthropic, EE. UU.) lee el título y la descripción y te deja puestas la categoría y las marcas. Las cambias si quieres, y lo que ya hayas tocado no se cambia. <strong>Ideas para esta semana.</strong> Si las enciendes, cada semana te proponemos de 1 a 3 ideas según tus partidos, el tiempo, los festivos y lo que te ha funcionado. Tocas una y se abre el formulario relleno: revísala y pon el precio. No van el nombre de tu negocio ni nada de tus clientes. Las apagas en la misma tarjeta. <strong>Proponer respuesta.</strong> En «Reseñas», un borrador educado y corto en el idioma de la reseña, que cambias antes de enviarlo. Solo se envía el texto de la reseña, sin el nombre de quien la escribió. Alguna hay que contestarla a mano. El permiso de cada una se quita en Ajustes.',
          'What AI help is there for my business?',
          "<strong>Suggested category and tags.</strong> When creating a publication, an AI (Claude, from Anthropic, US) reads the title and description and fills in the category and marks. Change them if you like, and anything you've already touched isn't changed. <strong>Ideas for this week.</strong> If you turn them on, every week we suggest 1 to 3 ideas based on your matches, the weather, public holidays and what has worked for you. Tap one and the form opens filled in: check it and set the price. Your business name and anything about your customers aren't included. Turn them off on the same card. <strong>Suggest a reply.</strong> In “Reviews”, a short, polite draft in the language of the review, which you change before sending. Only the text of the review is sent, without the name of the person who wrote it. Some have to be answered by hand. You can withdraw each permission in Settings."),
    ]
    out = []
    for p in preguntas:
        if p['id'] == 'traduccion-no-correcta':
            p = dict(p,
                     a_es=f'Pulsa «Ver original»: lo que vale es lo que escribió el negocio. Las traducciones las hace Claude, la IA de Anthropic, o, si no está disponible, <a href="https://cloud.google.com/translate">Google Translate</a>, solo cuando tocas «Traducir» o si tienes encendido «Traducir siempre automáticamente» (Ajustes). Si la traducción cambia el sentido de una oferta, escríbenos a <a href="{m}">{CORREO}</a>.',
                     a_en=f"Tap “See original”: what counts is what the business wrote. Translations are done by Claude, the AI from Anthropic, or, if it isn't available, <a href=\"https://cloud.google.com/translate\">Google Translate</a>, only when you tap “Translate” or if you have “Always translate automatically” on (Settings). If the translation changes the meaning of an offer, email us at <a href=\"{m}\">{CORREO}</a>.")
            out.append(p)
            out += nuevas_ti
            continue
        out.append(p)
    if not any(p['id'] == 'ia' for p in out):
        sys.exit('legal_ia.py: no está la pregunta «traduccion-no-correcta» en ayuda.py; mira dónde poner las de la IA.')
    return out + nuevas_negocios
