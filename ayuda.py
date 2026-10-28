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
      'Para quien busca planes, nada. Para los negocios hay un solo plan, después de 30 días de prueba gratis; los detalles están en <a href="/precios/">precios</a>.',
      'How much does Klendar cost?',
      'For people looking for plans, nothing. For businesses there is a single plan, after a 30-day free trial; the details are in <a href="/en/pricing/">pricing</a>.'),
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
    P('cola-virtual', 'ti',
      '¿Cómo funciona la cola virtual?',
      'Si un local tiene cola virtual, en la puerta hay un cartel con un QR. Lo escaneas, dices cuántos sois y coges número (con tu cuenta, en la app o en la web). Ves cuántos tienes delante y una espera aproximada, y cuando te toca te avisamos en el móvil: tienes unos minutos para presentarte. Si te vas, «Salir de la cola». La lista se borra al acabar el día.',
      'How does the virtual queue work?',
      'If a venue has a virtual queue, there\'s a poster with a QR code on the door. Scan it, say how many of you there are and get a number (with your account, in the app or on the web). You see how many people are ahead of you and an estimated wait, and when it\'s your turn we let you know on your phone: you have a few minutes to get there. If you leave, tap “Leave the queue”. The list is deleted at the end of the day.'),
    P('te-aviso-listo', 'ti',
      '¿Cómo funciona «Te aviso cuando esté listo»?',
      'Algunas cafeterías y sitios de comida para llevar tienen en el mostrador un cartel con un QR. Lo escaneas después de pedir y pulsas «Avísame cuando esté listo» (con tu cuenta, en la app o en la web). Te damos un número, el que dicen en el mostrador, y te avisamos en el móvil cuando el local marca tu pedido como listo, aunque estés en horas de silencio, porque lo acabas de pedir. Si ya no lo esperas, «Ya no lo espero». Un pedido listo que no recoges se cierra solo a las 2 horas, y todo se borra a las 6:00.',
      'How does “Ready alert” work?',
      'Some cafés and takeaways have a poster with a QR code on the counter. Scan it after you order and tap “Tell me when it’s ready” (with your account, in the app or on the web). We give you a number, the one they call at the counter, and we let you know on your phone when the venue marks your order as ready, even during your quiet hours, because you’ve just asked for it. If you’re no longer waiting, tap “I’m not waiting any more”. A ready order you don’t pick up closes by itself after 2 hours, and everything is deleted at 6:00.'),
    P('voy', 'ti',
      '¿Para qué sirve «Voy»?',
      'Para apuntarte a un plan sin código, como un concierto gratis o con entradas en otra web: lo guarda en Planes y, si compartes tus planes, lo ven tus amigos. En lo que tiene código o reserva no hay «Voy»: conseguir el código o reservar plaza ya cuenta.',
      'What is “I\'m going” for?',
      'To sign up for a plan without a code, like a free gig or one with tickets on another site: it saves it in Plans and, if you share your plans, your friends see it. Things with a code or a reservation don\'t have “I\'m going”: getting the code or reserving a place already counts.'),
    P('planes-en-el-calendario', 'ti',
      '¿Puedo ver Tus planes en el calendario del móvil?',
      'Sí. En Cuenta → Ajustes → «Tus planes en tu calendario» (en la web, en «Tu cuenta» → Ajustes) elige Google Calendar, Apple / iPhone o copia el enlace para cualquier otro calendario. Salen los eventos a los que vas, tus reservas, los códigos con hora y las fechas que añaden las series que sigues, y se actualizan solos: si algo se anula, desaparece. Google puede tardar unas horas en mostrar los cambios. Quien tenga el enlace ve tus planes: si se te escapa, cámbialo desde ahí.',
      'Can I see my plans in my phone\'s calendar?',
      'Yes. In Account → Settings → “Your plans in your calendar” (on the web, in “Your account” → Settings) choose Google Calendar, Apple / iPhone or copy the link for any other calendar. It shows the events you\'re going to, your reservations, codes with a time and the dates added by the series you follow, and it updates itself: if something is cancelled, it disappears. Google can take a few hours to show changes. Anyone with the link can see your plans: if it gets out, change it there.'),
    P('dejar-de-seguir-serie', 'ti',
      'Dejar de seguir una serie',
      'En la ficha de cualquier fecha de la serie pulsa «Sigues la serie» → «Dejar de seguir», o en Cuenta → «Series que sigues». Para no recibir avisos de ninguna serie: Ajustes → Notificaciones → «Series que sigues».',
      'Unfollowing a series',
      'On the page of any date in the series tap “You\'re following the series” → “Unfollow”, or go to Account → “Series you follow”. To stop notifications for all series: Settings → Notifications → “Series you follow”.',
      soporte=8),
    P('traduccion-no-correcta', 'ti',
      'La traducción no es correcta',
      'Pulsa «Ver original»: lo que vale es lo que escribió el negocio. Si la traducción cambia el sentido de una oferta, escríbenos a <a href="mailto:info@klendar.app">info@klendar.app</a>.',
      'The translation is wrong',
      'Tap “See original”: what counts is what the business wrote. If the translation changes the meaning of an offer, email us at <a href="mailto:info@klendar.app">info@klendar.app</a>.',
      soporte=10),
    P('compartir-historias-whatsapp', 'ti',
      '¿Cómo comparto un plan en mis historias o en mi estado de WhatsApp?',
      'En la ficha, pulsa Compartir y elige «Compartir en historias» o «Estado de WhatsApp»: es una imagen vertical con el diseño del plan y un QR que lleva a su ficha. En la web, en la ficha, «Compartir en historias» y allí «Estado de WhatsApp» la descarga para que la subas desde WhatsApp.',
      'How do I share a plan in my stories or my WhatsApp status?',
      'On the page, tap Share and choose “Share to stories” or “WhatsApp status”: it\'s a vertical image with the plan\'s design and a QR code that leads to its page. On the web, on the page, “Share to stories” and then “WhatsApp status” downloads it so you can post it from WhatsApp.'),
    P('por-que-veo-esto', 'ti',
      '¿Por qué veo unas cosas y no otras?',
      'Lo destacado de pago sale primero y siempre con la etiqueta «Destacado». Después, el orden que elijas en Filtros (☰), arriba del todo: «Ordenar por». De serie es «Recomendado»: lo más nuevo cerca y, si dejas encendidas sus casillas, con lluvia lo de hoy bajo techo antes y con buen tiempo las terrazas y el aire libre, y lo de tus gustos (Ajustes → Lo que ves) un poco antes, sin esconder nada. También puedes elegir «Más cerca», «Empieza antes» o «Lo más nuevo». En la agenda, la lista del día va por hora o por cercanía, y en Sitios, por cercanía o por la mejor valoración. La agenda pública de tu ayuntamiento sale intercalada: como mucho una de cada cinco. Lo que se ve lo deciden las preguntas de arriba (¿Dónde?, ¿Cuándo?, ¿Qué?) y Filtros. Si cerca no hay nada, la app te sugiere cosas según tus últimas búsquedas y las categorías que más miras, que se guardan en tu móvil. No usamos datos de otras webs. En cada ficha hay un «¿Por qué ves esto?» que lo explica.',
      'Why do I see some things and not others?',
      'Paid featured placements come first and always carry the “Featured” label. After that, the order you choose in Filters (☰), at the very top: “Sort by”. By default it\'s “Recommended”: the newest nearby and, if you leave its boxes ticked, today\'s indoor plans first when it rains and terraces and outdoor plans when it\'s nice, and what you like (Settings → What you see) a little earlier, without hiding anything. You can also choose “Nearest”, “Starts soonest” or “Newest”. In the agenda, a day\'s list goes by time or by distance, and in Places, by distance or by best rating. Your council\'s public listings are interleaved: at most one in five. What you see is decided by the questions at the top (Where?, When?, What?) and Filters. If there\'s nothing nearby, the app suggests things based on your recent searches and the categories you look at most, which are stored on your phone. We don\'t use data from other sites. Each publication has a “Why are you seeing this?” that explains it.'),
    P('antes-de-cerrar', 'ti',
      '¿Qué es «Antes de cerrar»?',
      'Lo que sobra del día en panaderías, cafeterías y restaurantes, con descuento (por ejemplo, una bolsa sorpresa). Consigues el código en Klendar, vas antes de la hora que pone y lo pagas en el local. Para ver solo eso, en «¿Qué?» (arriba, en la fila de filtros), «Antes de cerrar», o el atajo «Antes de cerrar» de la búsqueda.',
      'What is “Before closing”?',
      "What's left over at the end of the day in bakeries, cafés and restaurants, at a discount (a surprise bag, for example). You get the code on Klendar, go before the time shown and pay at the venue. To see only these, go to “What?” (at the top, in the filters row) and turn on “Before closing”, or use the “Before closing” shortcut in search."),
    P('carne', 'ti',
      'Me pide carné de estudiante, carné joven o ser mayor de 65',
      'Algunas ofertas son solo para quien lo enseñe: lo verás en la ficha y al conseguir el código. Enséñalo en el local al canjear; lo comprueba el negocio, no Klendar. Para ver solo esas, en Filtros (☰) → Para quién → «Descuentos para».',
      'It asks for a student card, a youth card or being over 65',
      "Some offers are only for people who show it: you'll see it on the page and when you get the code. Show it at the venue when you redeem; the business checks it, not Klendar. To see only those, go to Filters (☰) → Who it's for → “Discounts for”."),
    P('notificaciones', 'ti',
      'No recibo notificaciones',
      'Revisa Cuenta → Ajustes → Notificaciones y los permisos de notificaciones del sistema. "Cerca de ti" solo avisa de ofertas flash dentro del radio elegido y como máximo 3 veces al día.',
      'I don\'t get notifications',
      'Check Account → Settings → Notifications and the system notification permission. “Nearby” only alerts you about flash offers within your chosen radius, at most 3 times a day.',
      soporte=5),
    P('avisame-hay-sitio', 'ti',
      '¿Qué es «Avísame cuando haya sitio»?',
      'Si un local marca «Casi lleno» o «Lleno», en su ficha (y en su tarjeta del mapa) puedes pedir «Avísame cuando haya sitio», con tu cuenta. Te avisamos una vez en cuanto haya sitio, aunque sean tus horas de silencio, porque lo has pedido tú. Caduca a las 3 horas o al cerrar el local, y puedes esperar aviso de 5 sitios a la vez. Se apaga en Ajustes → Notificaciones → «Cuando haya sitio».',
      'What is “Tell me when there’s room”?',
      "If a venue shows “Nearly full” or “Full”, on its page (and its card on the map) you can ask “Tell me when there’s room”, with your account. We let you know once as soon as there's room, even during your quiet hours, because you asked for it. It expires after 3 hours or when the venue closes, and you can wait to hear from 5 places at a time. You can turn it off in Settings → Notifications → “When there’s room”."),
    P('que-tal', 'ti',
      '¿Por qué me llega «¿Qué tal?»?',
      'Al día siguiente de usar algo en un local te preguntamos si quieres reseñarlo; si ya tienes una reseña antigua, si quieres actualizarla. Es opcional («Ahora no») y no insistimos. Se apaga en Ajustes → Notificaciones.',
      'Why do you ask me “How was it?”?',
      "The day after you use something at a venue we ask whether you'd like to review it; if you already have an old review, whether you'd like to update it. It's optional (“Not now”) and we don't insist. You can turn it off in Settings → Notifications."),
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
      'Lo <strong>pruebas gratis</strong>: 30 días con todo al darte de alta, sin tarjeta. Después, un solo plan con todo incluido: 19,90 € + IVA al mes por local (24,08 € con IVA), sin límites, sin permanencia y sin comisión por canje. <a href="/precios/">Ver precios</a>.',
      'How much does it cost me?',
      'You <strong>try it free</strong>: 30 days with everything when you register, no card. After that, one plan with everything included: €19.90 + VAT a month per venue (€24.08 incl. VAT), with no limits, no lock-in and no commission per redemption. <a href="/en/pricing/">See pricing</a>.'),
    P('comision', 'negocios',
      '¿Klendar se lleva una comisión de lo que vendo?',
      'No. Lo que cobras en tu local es tuyo entero; Klendar no toca el dinero.',
      'Does Klendar take a commission on what I sell?',
      'No. What you charge at your venue is yours; Klendar never touches the money.'),
    P('si-no-pago', 'negocios',
      '¿Qué pasa si no pago?',
      'Te avisamos 7 días y 1 día antes de que se acabe tu prueba o lo que tienes pagado. Si llega el día sin pagar, tu negocio se <strong>bloquea</strong>: tus publicaciones no se ven, tu ficha dice «No disponible ahora mismo» y no puedes publicar ni editar. <strong>No se borra nada</strong>: en cuanto pagas en «Tu plan» (klendar.app/panel), todo vuelve solo. Mientras tanto puedes validar en la puerta los códigos y bonos que ya tiene la gente, descargar tus datos o darte de baja. Si un cobro falla (o el banco devuelve un recibo), tienes 7 días para ponerlo al día.',
      'What happens if I don\'t pay?',
      'We remind you 7 days and 1 day before your trial or what you\'ve paid for ends. If the day comes without payment, your business is <strong>blocked</strong>: your publications are hidden, your page says “Not available right now” and you can\'t publish or edit. <strong>Nothing is deleted</strong>: as soon as you pay in “Your plan” (klendar.app/panel), everything comes back on its own. In the meantime you can validate at the door the codes and passes people already have, download your data or leave Klendar. If a charge fails (or the bank returns a direct debit), you have 7 days to sort it out.'),
    P('pausar-plan', 'negocios',
      '¿Puedo pausar el plan si cierro una temporada?',
      'Sí. En «Tu plan» (app o panel), «Pausar el plan»: eliges el día de vuelta o «sin fecha» (hasta 6 meses). No se cobra nada y los días que ya tenías pagados se guardan: al volver se gastan primero. Mientras dura, tu negocio está parado (como bloqueado): tus publicaciones no se ven, tu ficha dice «Cerrado temporalmente hasta el día X» y solo puedes validar lo que ya tiene la gente, descargar tus datos, darte de baja o «Volver a abrir». Vuelve solo el día elegido (te avisamos 7 días antes) y avisamos a quien te tiene en favoritos. No se puede pausar con un pago pendiente o en proceso.',
      'Can I pause the plan if I close for a while?',
      'Yes. In “Your plan” (app or dashboard), “Pause the plan”: choose the return date or “no date” (up to 6 months). Nothing is charged and the days you\'d already paid for are kept: they\'re used first when you come back. While it lasts, your business is stopped (as if blocked): your publications are hidden, your page says “Temporarily closed until [date]” and you can only validate what people already have, download your data, leave Klendar or “Reopen”. It comes back on its own on the chosen day (we remind you 7 days before) and we let the people who have you in their favourites know. You can\'t pause with a payment outstanding or being processed.'),
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
      'En «Mi negocio» › «Cifras» tienes todo en una pantalla: arriba, cuánto te ha traído Klendar, las visitas y los clientes nuevos y los que repiten; debajo, cada publicación (con su comparación con las de tu zona), de dónde viene tu gente y los canjes validados, exportables para tu gestor. Si alguien comparte tu publicación en sus historias o en su estado de WhatsApp, verás cuántas visitas llegan desde ahí.',
      'How do I know what worked?',
      'In “My business” › “Stats” you have everything on one screen: at the top, what Klendar has brought you, visits, and new and returning customers; below, each publication (compared with others nearby), where your people come from and the validated redemptions, which you can export for your accountant. If someone shares your publication in their stories or WhatsApp status, you\'ll see how many visits come from there.'),
    P('cuanto-te-ha-traido', 'negocios',
      '¿Qué es «Cuánto te ha traído Klendar»?',
      'Lo que ha gastado en tu local la gente que vino con Klendar, arriba de «Cifras». Al validar un código puedes apuntar el importe del ticket (opcional); también en «Últimos validados» durante 24 horas. Si no lo apuntas, contamos el precio de la oferta por las plazas: por eso dice «al menos».',
      'What is “What Klendar has brought you”?',
      "What people who came with Klendar spent at your place, at the top of “Stats”. When you validate a code you can enter the receipt total (optional); also in “Recently validated” for 24 hours. If you don't, we count the offer's price times the places: that's why it says “at least”."),
    P('hay-sitio', 'negocios',
      '¿Cómo funciona «¿Hay sitio ahora?»?',
      'Actívalo en tu ficha, en «Cómo es tu local». Luego cualquiera de tu equipo marca desde Mi negocio, con un toque, cómo está el local: Hay sitio, Casi lleno o Lleno. Sale en tu ficha y en el mapa mientras estás abierto y se quita solo a las 2 horas. Con el aforo en directo, se pone solo.',
      'How does “Room right now?” work?',
      "Turn it on in your business page, in “About your place”. Then anyone on your team marks how busy it is from My business with one tap: There’s room, Nearly full or Full. It shows on your page and on the map while you're open and clears itself after 2 hours. With live capacity, it sets itself."),
    P('aforo-en-directo', 'negocios',
      '¿Cómo funciona el aforo en directo?',
      'En Mi negocio → «Más herramientas» → «Aforo en directo» (también en el <a href="/panel/">panel web</a>): pon tu aforo máximo y, en la puerta, cualquiera de tu equipo cuenta con +1 y −1, desde varios móviles a la vez. «¿Hay sitio ahora?» se pone solo: Hay sitio por debajo del 70 %, Casi lleno hasta el 95 % y Lleno a partir de ahí (los porcentajes los cambias tú). Si marcas algo a mano, manda 30 minutos. Al cerrar, «Poner a 0»; al empezar otro día vuelve a 0 solo. En «Cifras» ves a qué hora se llenó cada noche. Solo números, nunca quién entra. El aforo lo pones tú y tiene que ser real: Klendar no controla el aforo legal de tu local.',
      'How does live capacity work?',
      "In My business → “More tools” → “Live capacity” (also in the <a href=\"/panel/\">web dashboard</a>): set your maximum capacity and, at the door, anyone on your team counts with +1 and −1, from several phones at once. “Room right now?” sets itself: There’s room below 70%, Nearly full up to 95% and Full from there (you can change the percentages). If you set it by hand, that counts for 30 minutes. When you close, “Set to 0”; it also goes back to 0 by itself when a new day starts. In “Stats” you can see what time it filled up each night. Only numbers, never who comes in. You set the capacity and it has to be real: Klendar doesn't check your venue's legal capacity."),
    P('cola-virtual-negocio', 'negocios',
      '¿Cómo pongo una cola virtual en la puerta?',
      'En Mi negocio → «Cola virtual» (también en el <a href="/panel/">panel web</a>): imprime el «Cartel para la puerta» y abre la cola cada día con el tope de personas y los minutos que tiene cada uno para presentarse. Quien llega escanea el cartel y coge número; tú solo tocas «Avisar al siguiente» y le avisamos en el móvil. A quien no tenga la app lo apuntas tú. La lista se borra sola al acabar el día (a las 6:00) o al pulsar «Terminar por hoy».',
      'How do I set up a virtual queue at the door?',
      'In My business → “Virtual queue” (also on the <a href="/panel/">web dashboard</a>): print the “Poster for the door” and open the queue each day with the maximum number of people and the minutes each person has to show up. People scan the poster when they arrive and get a number; you just tap “Call the next one” and we let them know on their phone. You add anyone without the app yourself. The list deletes itself at the end of the day (at 6:00) or when you tap “Finish for today”.'),
    P('te-aviso-listo-negocio', 'negocios',
      '¿Cómo aviso a quien pide en el mostrador de que su pedido está listo?',
      'Con «Te aviso cuando esté listo», en Mi negocio → «Más herramientas» (también en el <a href="/panel/">panel web</a>). Lo activa el propietario o un encargado; luego imprime el «Cartel para el mostrador». Quien pide lo escanea y recibe un número; en «Pedidos de hoy» cualquiera de tu equipo toca «Listo» y le avisamos en el móvil. Ves su número y la primera palabra de su nombre, nada más. El aviso es solo para ese pedido. La lista se borra sola a las 6:00 o al pulsar «Terminar por hoy».',
      'How do I tell people who order at the counter that their order is ready?',
      'With “Ready alert”, in My business → “More tools” (also on the <a href="/panel/">web dashboard</a>). The owner or a manager turns it on; then print the “Poster for the counter”. People who order scan it and get a number; in “Today’s orders” anyone on your team taps “Ready” and we let them know on their phone. You see their number and the first word of their name, nothing else. The notification is only for that order. The list deletes itself at 6:00 or when you tap “Finish for today”.'),
    P('antes-de-cerrar-negocio', 'negocios',
      '¿Cómo publico lo que me sobra del día?',
      'Con «Antes de cerrar», en Mi negocio (panaderías, cafeterías, restaurantes y parecidos): se publica en dos toques con lo de la última vez, hasta la hora de cierre, y se paga en tu local. Puedes pedir que te lo recordemos cada día.',
      "How do I post what's left over at the end of the day?",
      "With “Before closing”, in My business (bakeries, cafés, restaurants and similar): it's published in two taps with last time's details, until closing time, and paid at your place. You can ask us to remind you every day."),
    P('horario-sin-confirmar', 'negocios',
      '¿Qué es «Horario sin confirmar»?',
      'Sale en tu ficha cuando 3 personas distintas encuentran cerrado tu local en 14 días con tu horario diciendo abierto. Se quita en cuanto guardas el horario, añades días cerrados o pulsas «Está bien así». Nunca sabrás quién avisó.',
      'What is “Opening hours not confirmed”?',
      "It appears on your page when 3 different people find your venue closed within 14 days while your opening hours said open. It goes away as soon as you save your hours, add closed days or tap “They’re right”. You'll never know who reported it."),
    P('orden', 'negocios',
      '¿Puedo salir el primero si pago más?',
      'No vendemos tus datos ni los de tus clientes, no cobramos por canje y no ponemos tu oferta por delante de otra porque pagues más: en la app el orden lo elige la persona (cerca de ti, empieza antes o nuevas). Se pueden destacar publicaciones, y cuando pasa <strong>se dice</strong>.',
      'Can I come first if I pay more?',
      'We don\'t sell your data or your customers\' data, we don\'t charge per redemption and we don\'t put your offer ahead of another because you pay more: in the app people choose the order (near you, starting soonest or newest). Publications can be featured, and when that happens <strong>it says so</strong>.'),
    P('permanencia', 'negocios',
      '¿Hay permanencia?',
      'No. Cancelas cuando quieras: sigues hasta el final del periodo pagado y no se renueva.',
      'Is there a lock-in?',
      'No. Cancel whenever you like: you keep everything until the end of the period you\'ve paid for and it doesn\'t renew.'),
    P('kit', 'negocios',
      '¿Hay algo para poner en el local?',
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
