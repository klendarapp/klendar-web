# -*- coding: utf-8 -*-
"""Centro de ayuda: **la única fuente** de las preguntas frecuentes.

De aquí salen:

- `/preguntas/` y `/en/faq/` (`build_pages.py`), con las pestañas «Para ti»
  y «Para negocios» y un buscador que ignora las tildes (`assets/ayuda.js`);
- `assets/ayuda.json` (`build_pages.py`), que la app descarga, guarda en
  caché y lleva una copia dentro por si no hay conexión (en el repo de la
  app: `python tool/sync_help.py`);
- las preguntas de `/soporte/` (`build_legal.py`) y de `/en/support/`
  (`build_site.py`): las marcadas con `soporte`, con el mismo texto.

Cada pregunta: `id` (estable: la app y los enlaces `#id` lo usan), a quién
va (`ti` | `negocios`), pregunta y respuesta en español e inglés. En la
respuesta solo `<a href>` y `<strong>`; los enlaces, relativos a la web
(`/precios/`) o `mailto:`. Opciones:

- `soporte=1|2…`: sale en Soporte, en ese orden;
- `soporte_q_es/en`: otra pregunta en Soporte (allí son títulos);
- `ayuda=False`: solo en Soporte (no en el centro de ayuda; p. ej. si allí
  ya hay otra que dice lo mismo).

Para cambiar una respuesta: aquí, y luego `python build_pages.py`,
`python build_legal.py` y `python build_site.py` (y en la app
`python tool/sync_help.py`). Lo de Soporte es un texto legal: su cambio
lleva fecha y línea en el historial (`build_legal.py`).
"""

CORREO = 'info@klendar.app'


def P(id, para, q_es, a_es, q_en, a_en, **op):
    return dict(id=id, para=para, q_es=q_es, a_es=a_es, q_en=q_en, a_en=a_en, **op)


PREGUNTAS = [
    # ── Para ti ──────────────────────────────────────────────────────────
    P('cuanto-cuesta', 'ti',
      '¿Cuánto cuesta usar Klendar?',
      'Para quien busca planes, nada. Para los negocios hay un solo plan, y ahora mismo es gratis mientras arrancamos; los detalles están en <a href="/precios/">precios</a>.',
      'How much does Klendar cost?',
      'For people looking for plans, nothing. For businesses there is a single plan, and right now it\'s free while we\'re launching; the details are in <a href="/en/pricing/">pricing</a>.'),
    P('cuenta-para-mirar', 'ti',
      '¿Hace falta cuenta para mirar?',
      'No. Puedes ver ofertas y eventos sin crear una cuenta, en la app y en la web. La cuenta hace falta para canjear, guardar planes o recibir avisos.',
      'Do I need an account to look?',
      'No. You can see deals and events without signing up, both in the app and on the web. An account is needed to redeem, save plans or get alerts.'),
    P('canjear', 'ti',
      '¿Cómo se canjea una oferta?',
      'Pulsas «Conseguir el código» y te sale un código QR de un solo uso. Se lo enseñas al negocio, que lo escanea o escribe el código. Ojo: algunos códigos caducan a los pocos minutos, así que se pide estando ya en el local.',
      'How do I redeem a deal?',
      'Tap “Get the code” and you get a single-use QR code. Show it to the business, and they scan it or type in the code. Careful: some codes expire within minutes, so get it once you\'re at the venue.'),
    P('no-me-deja-canjear', 'ti',
      'No me deja canjear una oferta',
      'Comprueba que la oferta sigue activa (tiene una ventana horaria y un aforo), que has entrado en tu cuenta y que no has gastado los canjes por persona que permite el negocio.',
      'I can\'t redeem a deal',
      'Check that the deal is still active (it has a time window and a capacity), that you\'re logged in and that you haven\'t used up the redemptions per person the business allows.',
      soporte=1, soporte_q_en='I can\'t redeem a deal'),
    P('codigo-no-funciona', 'ti',
      'Mi código no funciona',
      'Suele ser una de tres: ya se usó, caducó (los de barra duran minutos) o es de otro negocio. En «Tus códigos» (en la app o en la web) ves el estado de cada uno. Si algo no cuadra, escríbenos con el código a <a href="mailto:info@klendar.app">info@klendar.app</a>.',
      'My code doesn\'t work',
      'Usually one of three things: it\'s already been used, it\'s expired (codes at a bar last minutes) or it belongs to another business. In “Your codes” (in the app or on the web) you can see the status of each one. If something is off, email us the code at <a href="mailto:info@klendar.app">info@klendar.app</a>.'),
    P('codigo-caducado', 'ti',
      'El código QR ha caducado',
      'Los códigos caducan al cabo de un rato (normalmente pocos minutos; lo elige cada negocio). Pulsa "Generar otro código" en la misma pantalla.',
      'The QR code has expired',
      'Codes expire after a while (usually a few minutes; each business chooses). Tap “Generate a new code” on the same screen.',
      soporte=2),
    P('reservar-plaza', 'ti',
      '¿Puedo reservar una plaza en un evento?',
      'Si el negocio lo activa, sí: reservas plaza desde la app o desde la web y enseñas tu código en la puerta. La reserva no es un pago; lo que cueste, si cuesta, se paga en el local.',
      'Can I reserve a place at an event?',
      'If the business turns it on, yes: you reserve a place from the app or the website and show your code at the door. Reserving isn\'t a payment; whatever it costs, if anything, is paid at the venue.'),
    P('voy', 'ti',
      '¿Para qué sirve «Voy»?',
      'Para apuntarte a un plan sin código, como un concierto gratis o con entradas en otra web: lo guarda en Planes y, si compartes tus planes, lo ven tus amigos. En lo que tiene código o reserva no hay «Voy»: conseguir el código o reservar plaza ya cuenta.',
      'What is “I\'m going” for?',
      'To sign up for a plan without a code, like a free gig or one with tickets on another site: it saves it in Plans and, if you share your plans, your friends see it. Things with a code or a reservation don\'t have “I\'m going”: getting the code or reserving a place already counts.'),
    P('planes-en-el-calendario', 'ti',
      '¿Puedo ver mis planes en el calendario del móvil?',
      'Sí. En Cuenta → Ajustes → «Tus planes en tu calendario» (en la web, en «Tu cuenta» → Ajustes) elige Google Calendar, Apple / iPhone o copia el enlace para cualquier otro calendario. Salen los eventos a los que vas, tus reservas, los códigos con hora y las fechas que añaden las series que sigues, y se actualizan solos: si algo se anula, desaparece. Google puede tardar unas horas en mostrar los cambios. Quien tenga el enlace ve tus planes: si se te escapa, cámbialo desde ahí.',
      'Can I see my plans in my phone\'s calendar?',
      'Yes. In Account → Settings → “Your plans in your calendar” (on the web, in “Your account” → Settings) choose Google Calendar, Apple / iPhone or copy the link for any other calendar. It shows the events you\'re going to, your reservations, codes with a time and the dates added by the series you follow, and it updates itself: if something is cancelled, it disappears. Google can take a few hours to show changes. Anyone with the link can see your plans: if it gets out, change it there.'),
    P('dejar-de-seguir-serie', 'ti',
      'Dejar de seguir una serie',
      'En la ficha de cualquier fecha de la serie pulsa «Sigues la serie» → «Dejar de seguir», o en Cuenta → «Series que sigues». Para no recibir avisos de ninguna serie: Ajustes → Notificaciones → «Series que sigues».',
      'Unfollowing a series',
      'On the page of any date in the series tap “You\'re following the series” → “Unfollow”, or go to Account → “Series you follow”. To stop notifications for all series: Settings → Notifications → “Series you follow”.',
      soporte=8),
    P('compartir-historias-whatsapp', 'ti',
      '¿Cómo comparto un plan en mis historias o en mi estado de WhatsApp?',
      'En la ficha, pulsa Compartir y elige «Compartir en historias» o «Estado de WhatsApp»: es una imagen vertical con el diseño del plan y un QR que lleva a su ficha. En la web, en la ficha, «Compartir en historias» y allí «Estado de WhatsApp» la descarga para que la subas desde WhatsApp.',
      'How do I share a plan in my stories or my WhatsApp status?',
      'On the page, tap Share and choose “Share to stories” or “WhatsApp status”: it\'s a vertical image with the plan\'s design and a QR code that leads to its page. On the web, on the page, “Share to stories” and then “WhatsApp status” downloads it so you can post it from WhatsApp.'),
    P('por-que-veo-esto', 'ti',
      '¿Por qué veo unas cosas y no otras?',
      'Por cercanía, por lo que empieza pronto y por tus favoritos. Si un negocio paga por destacar una publicación, sale primero y siempre con la etiqueta «Destacado». Con «Según el tiempo» (encendido de serie, se apaga en Filtros), si hoy llueve sale primero lo de hoy bajo techo y, si hace buen tiempo, las terrazas y el aire libre; no quita nada. El resto del orden lo eliges tú en los filtros. Si cerca no hay nada, la app te sugiere cosas según tus últimas búsquedas y las categorías que más miras, que se guardan en tu móvil. No usamos datos de otras webs. En cada ficha hay un «¿Por qué ves esto?» que lo explica.',
      'Why do I see some things and not others?',
      'Because of how close they are, what starts soon and your favourites. If a business pays to feature a publication, it comes first and always carries the “Featured” label. With “Based on the weather” (on by default, turn it off in Filters), if it\'s raining today indoor plans for today come first and, if the weather is nice, terraces and outdoor plans; nothing is removed. You choose the rest of the order in the filters. If there\'s nothing nearby, the app suggests things based on your recent searches and the categories you look at most, which are stored on your phone. We don\'t use data from other sites. Each publication has a “Why are you seeing this?” that explains it.'),
    P('notificaciones', 'ti',
      'No recibo notificaciones',
      'Revisa Cuenta → Ajustes → Notificaciones y los permisos de notificaciones del sistema. "Cerca de ti" solo avisa de ofertas flash dentro del radio elegido y como máximo 3 veces al día.',
      'I don\'t get notifications',
      'Check Account → Settings → Notifications and the system notification permission. “Nearby” only alerts you about flash offers within your chosen radius, at most 3 times a day.',
      soporte=5),
    P('no-puedo-entrar', 'ti',
      'No puedo entrar en mi cuenta',
      'En «Entrar», pulsa «¿Has olvidado la contraseña?» y te mandamos un enlace para crear una nueva, o elige «Entrar con un código por correo» y entra sin contraseña. Si creaste la cuenta con Google o con Apple, entra con ese mismo botón. Si ya no puedes abrir ese correo, escríbenos a <a href="mailto:info@klendar.app">info@klendar.app</a> desde otra dirección y dinos con qué correo creaste la cuenta.',
      'I can\'t log in to my account',
      'On “Log in”, tap “Forgot your password?” and we\'ll send you a link to create a new one, or choose “Log in with an email code” and get in without a password. If you created the account with Google or Apple, log in with that same button. If you can no longer open that email, write to <a href="mailto:info@klendar.app">info@klendar.app</a> from another address and tell us which email you signed up with.',
      soporte=6),
    P('rrpp-que-ve', 'ti',
      'Un RRPP me ha pasado su enlace: ¿qué ve de mí?',
      'Tu nombre y tu foto, cuándo te apuntaste, qué oferta has conseguido y si has entrado y a qué hora. Nunca tu correo, tu teléfono ni tu fecha de nacimiento. Si no quieres estar en su lista, entra a la ficha del local sin su enlace.',
      'A promoter gave me their link: what do they see about me?',
      'Your name and photo, when you signed up, which offer you got and whether and when you got in. Never your email, phone number or date of birth. If you don\'t want to be on their list, open the venue\'s page without their link.',
      soporte=7),
    P('mis-datos', 'ti',
      '¿Qué pasa con mis datos?',
      'Lo contamos entero en la <a href="/privacidad/">política de privacidad</a>. En resumen: se usan para que la app funcione, no se venden, y puedes descargarlos o borrar tu cuenta desde la app o desde «Tu cuenta» en la web.',
      'What happens to my data?',
      'It\'s all in the <a href="/en/privacy/">privacy policy</a>. In short: it\'s used to make the app work, it\'s never sold, and you can download it or delete your account from the app or from “Your account” on the website.'),
    P('ubicacion', 'ti',
      '¿Qué hacéis con mi ubicación?',
      'Se usa para ordenar por cercanía y, si lo activas, para avisarte de ofertas cerca (con la última ubicación conocida, que se borra a los 7 días; no guardamos un historial). Nunca se comparte con otros usuarios, y los negocios solo ven cifras agregadas de distancia, sin saber de quién son.',
      'What do you do with my location?',
      'It\'s used to sort by distance and, if you turn it on, to alert you about deals nearby (with your last known location, which is deleted after 7 days; we don\'t keep a history). It\'s never shared with other users, and businesses only see aggregated distance figures, without knowing whose they are.'),
    P('borrar-cuenta', 'ti',
      '¿Cómo borro mi cuenta?',
      'Desde Cuenta → Ajustes → Eliminar mi cuenta, en la app o en «Tu cuenta» de la web. Se borra todo lo tuyo. También puedes pedirlo por correo: <a href="/eliminar-cuenta/">cómo hacerlo</a>.',
      'How do I delete my account?',
      'From Account → Settings → Delete my account, in the app or in “Your account” on the website. Everything of yours is deleted. You can also ask by email: <a href="/en/delete-account/">how to do it</a>.'),
    P('algo-que-no-deberia', 'ti',
      'Vi algo que no debería estar ahí',
      'En cada ficha, en la app y en la web, hay un botón para denunciar, y no hace falta tener cuenta: también puedes usar <a href="/app/#/denunciar">el formulario de denuncias</a>. Lo revisamos y, si hay que retirarlo, se retira con un motivo y el negocio puede recurrir.',
      'I saw something that shouldn\'t be there',
      'On every publication, in the app and on the website, there\'s a button to report it, and you don\'t need an account: you can also use <a href="/app/?lang=en#/denunciar">the report form</a>. We review it and, if it has to come down, it comes down with a reason and the business can appeal.'),
    P('contenido-ilegal', 'ti',
      'Denunciar contenido ilegal',
      'Si ves algo ilegal o que incumple las <a href="/normas/">Normas de la comunidad</a>, pulsa «Denunciar» en ese negocio, publicación, reseña o novedad, o usa el <a href="/app/#/denunciar">formulario de denuncias</a> (también en el pie de cada página: «Denunciar contenido ilegal»). No hace falta tener cuenta. Te confirmamos que la hemos recibido y te contamos qué hemos decidido y por qué. Si alguien está en peligro ahora mismo, llama al 112.',
      'Report illegal content',
      'If you see something illegal or that breaks the <a href="/en/community-guidelines/">Community guidelines</a>, tap “Report” on that business, publication, review or news post, or use the <a href="/app/?lang=en#/denunciar">report form</a> (also in the footer of every page: “Report illegal content”). You don\'t need an account. We\'ll confirm we\'ve received it and tell you what we\'ve decided and why. If someone is in danger right now, call 112.',
      soporte=4),
    P('oferta-no-respetada', 'ti',
      'Un negocio no ha respetado su oferta',
      'Denúncialo desde su ficha (icono de bandera) con el motivo "La oferta no es como se anuncia". Lo revisamos y, si se repite, el negocio queda suspendido.',
      'A business didn\'t honour its deal',
      'Report it from its profile (flag icon) with the reason “The offer isn\'t as advertised”. We review it and, if it happens again, the business is suspended.',
      soporte=3),
    P('ciudades', 'ti',
      '¿En qué ciudades está?',
      'Estamos empezando. Si en la tuya todavía no hay nada, en <a href="/agenda/">la agenda</a> lo verás vacío: escríbenos y lo arrancamos.',
      'Which cities is it in?',
      'We\'re just getting started. If nothing is happening in yours yet, <a href="/en/whats-on/">what\'s on</a> will look empty: email us and we\'ll get it going.'),

    # ── Para negocios ────────────────────────────────────────────────────
    P('alta-negocio', 'negocios',
      'Soy un negocio, ¿cómo me doy de alta?',
      'Desde la app (Cuenta → ¿Quieres registrar tu negocio?) o desde el <a href="/panel/">panel web</a>; hace falta la ubicación exacta del local. Lo revisamos y te verificamos, normalmente en 24-48 horas. Luego puedes publicar desde el móvil o desde el ordenador.',
      'I run a business. How do I register?',
      'From the app (Account → Want to register your business?) or from the <a href="/panel/">web dashboard</a>; it needs the venue’s exact location. We review and verify it, usually within 24–48 hours. After that you can publish from your phone or from a computer.'),
    P('alta-negocio-soporte', 'negocios',
      'Soy un negocio y quiero darme de alta',
      'En la app: Cuenta → «¿Quieres registrar tu negocio?», o en la web desde el <a href="/panel/">panel</a>. Lo revisamos en 24-48 h. También puedes escribirnos.',
      'I run a business and want to sign up',
      'In the app: Account → “Want to register your business?”, or on the web from the <a href="/panel/">dashboard</a>. We review it within 24–48 h. You can also email us.',
      soporte=9, ayuda=False),
    P('precio-negocio', 'negocios',
      '¿Cuánto me cuesta?',
      'Lo <strong>pruebas gratis</strong>: 30 días con todo al darte de alta, sin tarjeta, y gratis mientras arrancamos en tu ciudad. Después, un solo plan de 19,90 € al mes sin límites, sin permanencia y sin comisión por canje. <a href="/precios/">Ver precios</a>.',
      'How much does it cost me?',
      'You <strong>try it free</strong>: 30 days with everything when you register, no card, and free while we\'re launching in your city. After that, one plan at €19.90 a month with no limits, no lock-in and no commission per redemption. <a href="/en/pricing/">See pricing</a>.'),
    P('comision', 'negocios',
      '¿Klendar se lleva una comisión de lo que vendo?',
      'No. Lo que cobras en tu local es tuyo entero; Klendar no toca el dinero.',
      'Does Klendar take a commission on what I sell?',
      'No. What you charge at your venue is yours; Klendar never touches the money.'),
    P('publicar', 'negocios',
      '¿Cómo publico una oferta o un evento?',
      'Desde la app (Mi negocio → Publicaciones) o desde el <a href="/panel/">panel del ordenador</a>: una oferta flash, con cuenta atrás y aforo, o un evento con fecha. Al crear una en blanco tienes «Ideas» de tu gremio para empezar, y puedes guardar las tuyas como plantillas.',
      'How do I publish a deal or an event?',
      'From the app (My business → Publications) or from the <a href="/panel/">dashboard on a computer</a>: a flash offer, with a countdown and a capacity, or an event with a date. When you create one from scratch you get “Ideas” from your trade to start with, and you can save your own as templates.'),
    P('repetir-cada-semana', 'negocios',
      '¿Puedo repetir una oferta o un evento cada semana?',
      'Sí: «Repetir cada semana» (en «Series y repeticiones»). Las ofertas flash salen solas a su hora y los eventos, cada fecha, una semana antes. Cada repetición es una serie que la gente puede seguir; si la quitas, se termina y se avisa a quien la sigue.',
      'Can I repeat a deal or an event every week?',
      'Yes: “Repeat every week” (in “Series and repeats”). Flash offers go out on their own at their time and events, each date, a week before. Each repeat is a series people can follow; if you remove it, it ends and its followers are told.'),
    P('validar-codigos', 'negocios',
      '¿Cómo valido un código?',
      'En «Validar códigos», con la cámara del móvil o escribiendo el código (también en el panel web, con la cámara del ordenador). El aforo baja solo.',
      'How do I validate a code?',
      'In “Validate codes”, with your phone\'s camera or by typing the code (also on the web dashboard, with your computer\'s camera). The capacity updates automatically.'),
    P('equipo', 'negocios',
      '¿Puede mi equipo validar códigos?',
      'Sí. En «Equipo» invitas a quien esté en barra: como empleado valida códigos sin acceso a lo demás; como encargado también publica y gestiona. Cada persona acepta la invitación desde su cuenta.',
      'Can my team validate codes?',
      'Yes. In “Team” you invite whoever is behind the bar: as staff they validate codes without access to anything else; as a manager they can also publish and manage. Each person accepts the invitation from their own account.'),
    P('cifras', 'negocios',
      '¿Cómo sé qué ha funcionado?',
      'Cada publicación tiene sus «Cifras» (vistas, códigos y canjes) y el negocio, su «Informe», exportable para tu gestor. Si alguien comparte tu publicación en sus historias o en su estado de WhatsApp, verás cuántas visitas llegan desde ahí.',
      'How do I know what worked?',
      'Each publication has its “Stats” (views, codes and redemptions) and the business has its “Report”, which you can export for your accountant. If someone shares your publication in their stories or WhatsApp status, you\'ll see how many visits come from there.'),
    P('orden', 'negocios',
      '¿Puedo salir el primero si pago más?',
      'No vendemos tus datos ni los de tus clientes, no cobramos por canje y no ponemos tu oferta por delante de otra porque pagues más: en la app el orden lo elige la persona (cerca de ti, empieza antes o nuevas). Se pueden destacar publicaciones, y cuando pasa <strong>se dice</strong>.',
      'Can I come first if I pay more?',
      'We don\'t sell your data or your customers\' data, we don\'t charge per redemption and we don\'t put your offer ahead of another because you pay more: in the app people choose the order (near you, starting soonest or newest). Publications can be featured, and when that happens <strong>it says so</strong>.'),
    P('permanencia', 'negocios',
      '¿Hay permanencia?',
      'No. Lo dejas cuando quieras.',
      'Is there a lock-in?',
      'No. Leave whenever you like.'),
    P('kit', 'negocios',
      '¿Tenéis algo para poner en el local?',
      'Sí: una <a href="/assets/kit/klendar-guia-negocios.pdf">guía de 1 página (PDF)</a> y un <a href="/assets/kit/klendar-cartel.pdf">cartel con QR (PDF)</a>. Lo legal, en las <a href="/negocios/">condiciones para negocios</a>.',
      'Do you have anything to put up at the venue?',
      'Yes: a <a href="/assets/kit/klendar-guia-negocios.pdf">1-page guide (PDF)</a> and a <a href="/assets/kit/klendar-cartel.pdf">poster with a QR code (PDF)</a>. The legal side is in the <a href="/en/business-terms/">business terms</a>.'),
]

PESTANAS = {
    'es': {'ti': 'Para ti', 'negocios': 'Para negocios'},
    'en': {'ti': 'For you', 'negocios': 'For businesses'},
}


def de(para, lang=None, ayuda=True):
    """Las preguntas de una pestaña, en orden."""
    return [p for p in PREGUNTAS if p['para'] == para and (p.get('ayuda', True) or not ayuda)]


def soporte(lang):
    """Las de Soporte, en su orden: [(pregunta, respuesta)]."""
    xs = sorted((p for p in PREGUNTAS if p.get('soporte')), key=lambda p: p['soporte'])
    return [(p.get(f'soporte_q_{lang}') or p[f'q_{lang}'], p[f'a_{lang}']) for p in xs]


def soporte_html(lang, correo=CORREO):
    """Las preguntas de Soporte en HTML (`<h3>` y `<p>`), con [correo]."""
    return '\n'.join(f'<h3>{q}</h3>\n<p>{a}</p>' for q, a in soporte(lang)).replace(CORREO, correo)


# ── El JSON para la app ──────────────────────────────────────────────────
from html.parser import HTMLParser  # noqa: E402
import hashlib  # noqa: E402
import json  # noqa: E402

BASE = 'https://klendar.app'


class _Trozos(HTMLParser):
    """La respuesta en trozos: texto y enlaces (`{"t": …, "u": …}`)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.href = [], None

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.href = dict(attrs).get('href')
        elif tag not in ('strong', 'b', 'em'):
            raise ValueError(f'etiqueta no admitida en una respuesta: <{tag}>')

    def handle_endtag(self, tag):
        if tag == 'a':
            self.href = None

    def handle_data(self, data):
        if not data:
            return
        u = self.href
        if u and u.startswith('/'):
            u = BASE + u
        if not u and self.out and 'u' not in self.out[-1]:
            self.out[-1]['t'] += data
        else:
            self.out.append({'t': data, **({'u': u} if u else {})})


def trozos(html):
    t = _Trozos()
    t.feed(html)
    t.close()
    return t.out


def texto_plano(html):
    return ''.join(x['t'] for x in trozos(html))


def json_para_la_app():
    datos = {
        lang: {
            para: [{'id': p['id'], 'q': p[f'q_{lang}'], 'a': trozos(p[f'a_{lang}'])} for p in de(para)]
            for para in ('ti', 'negocios')
        }
        for lang in ('es', 'en')
    }
    cuerpo = json.dumps(datos, ensure_ascii=False, sort_keys=True)
    return {
        'version': hashlib.sha1(cuerpo.encode('utf-8')).hexdigest()[:12],
        'contact': CORREO,
        'tabs': PESTANAS,
        **datos,
    }


if __name__ == '__main__':
    ids = [p['id'] for p in PREGUNTAS]
    assert len(ids) == len(set(ids)), 'ids repetidos'
    j = json_para_la_app()
    print(j['version'], {k: len(v) for k, v in j['es'].items()})
