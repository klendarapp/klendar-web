# Páginas de contenido de klendar.app (las que no son legales ni la portada):
# para negocios, precios, preguntas, prensa, accesibilidad, estado y sobre.
#
# En español y en inglés, cada una con su URL propia. Se generan igual que las
# legales (`build_legal.py`) para que compartan cabecera, pie y estilo.
#
# Ejecutar: python build_pages.py   (desde la raíz de klendar-web)
import io
import os

from build_site import T, doc_page

# Precios reales de `subscription_plans` (Supabase). Si cambian allí, aquí.
PLANES = [
    # Un solo plan y el precio de fundador. Los límites por plan se quitaron:
    # castigaban justo lo que llena el mapa, que es publicar.
    ('standard', 'Klendar', 'Klendar', '19,90 €', '€19.90',
     '199 €/año (dos meses gratis)', '€199/year (two months free)', False),
    ('founder', 'Fundador', 'Founder', '9,90 €', '€9.90',
     'Precio bloqueado de por vida', 'Price locked for life', True),
]

PAGINAS = {}  # slug ES -> (slug EN, título ES, título EN, desc ES, desc EN, cuerpo ES, cuerpo EN)


# ── Para negocios ───────────────────────────────────────────────────────────
PAGINAS['para-negocios'] = (
    'for-business',
    'Klendar para negocios', 'Klendar for businesses',
    'Llena los huecos de tu local con gente del barrio. Sin comisiones por canje y sin permanencia.',
    'Fill the empty hours in your venue with people from the neighbourhood. No commission per redemption, no lock-in.',
    '''
<p class="lead">Tienes mesas vacías a las cinco de la tarde, tres cortes libres el martes o veinte entradas sin vender para el jueves. Klendar es para eso: lo publicas en un minuto y lo ve quien está cerca <strong>ahora</strong>.</p>

<h2>Cómo funciona</h2>
<ol>
  <li><strong>Das de alta tu negocio</strong> desde la app (hace falta la ubicación exacta del local). Lo revisamos y lo verificamos, normalmente en 24-48 horas.</li>
  <li><strong>Publicas</strong> una oferta flash (con cuenta atrás y aforo) o un evento con fecha. Desde el móvil o desde el <a href="/panel/">panel del ordenador</a>.</li>
  <li><strong>La gente la canjea</strong> enseñándote un código QR de un solo uso. Lo validas con la cámara o escribiendo el código; el aforo baja solo.</li>
</ol>

<h2>Qué ganas</h2>
<ul>
  <li><strong>Sin comisiones por canje.</strong> Lo que cobras en el local es tuyo entero: Klendar no toca el dinero.</li>
  <li><strong>Clientes de al lado.</strong> La app enseña lo que está cerca y empieza pronto, no lo que más paga.</li>
  <li><strong>Sabes qué funcionó.</strong> Vistas, códigos y canjes de cada publicación, con el detalle de quién validó cada uno; exportable para tu gestor.</li>
  <li><strong>Tu equipo, con su sitio.</strong> Puedes dar acceso a quien esté en barra para que valide códigos, sin darle acceso a lo demás.</li>
  <li><strong>Sin permanencia.</strong> Se cambia de plan o se deja cuando quieras.</li>
</ul>

<h2>Lo que cuesta</h2>
<p>Ahora mismo es <strong>gratis</strong> mientras arrancamos en tu ciudad. Después, un solo plan de 19,90 € al mes sin límites, y precio de fundador si entras al principio. <a href="/precios/">Ver precios</a>.</p>

<h2>Echa la cuenta</h2>
<p>Con tus números, no con los nuestros. Es una estimación para ver si sale a cuenta, no una promesa.</p>
<div class="calc" id="calc">
  <label>Ticket medio <input type="number" id="c-ticket" value="12" min="1" step="0.5"> €</label>
  <label>Descuento <input type="number" id="c-desc" value="20" min="0" max="90" step="5"> %</label>
  <label>Personas al mes <input type="number" id="c-gente" value="25" min="1" step="1"></label>
  <label>Margen sobre el ticket <input type="number" id="c-margen" value="60" min="5" max="100" step="5"> %</label>
  <output id="c-out"></output>
</div>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var eur = function (n) { return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }); };
  function calc() {
    var t = +$('c-ticket').value || 0, d = +$('c-desc').value || 0;
    var g = +$('c-gente').value || 0, m = +$('c-margen').value || 0;
    var cobras = t * (1 - d / 100);
    var ingresos = cobras * g;
    var margen = ingresos * m / 100;
    var plan = 19.9;
    var paraPagarlo = cobras * m / 100 > 0 ? Math.ceil(plan / (cobras * m / 100)) : 0;
    $('c-out').innerHTML = '<b>' + eur(ingresos) + ' al mes</b> de caja con esa oferta, '
      + eur(margen) + ' de margen. El plan cuesta ' + eur(plan) + ': lo pagas con '
      + '<b>' + paraPagarlo + (paraPagarlo === 1 ? ' canje' : ' canjes') + '</b> al mes.'
      + '<br><span class="mu">Cada persona te paga ' + eur(cobras) + ' en vez de ' + eur(t) + '. '
      + 'Si esa gente iba a venir igual, el descuento te cuesta ' + eur(t * d / 100 * g) + '.</span>';
  }
  ['c-ticket', 'c-desc', 'c-gente', 'c-margen'].forEach(function (id) {
    $(id).addEventListener('input', calc);
  });
  calc();
})();
</script>

<h2>Lo que no hacemos</h2>
<p>No vendemos tus datos ni los de tus clientes, no cobramos por canje y no ponemos tu oferta por delante de otra porque pagues más: <a href="/preguntas/">en la app el orden lo elige la persona</a> (cerca de ti, empieza antes o nuevas). Se pueden destacar publicaciones, y cuando pasa <strong>se dice</strong>.</p>

<h2>Empezar</h2>
<p>Estamos empezando, así que si en tu ciudad todavía no hay nadie, escríbenos y lo arrancamos contigo: <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>
<p class="acciones" style="margin-top:18px">
  <a class="pill accent" href="mailto:info@klendar.app?subject=Quiero%20dar%20de%20alta%20mi%20negocio">Escríbenos</a>
  <a class="pill ghost" href="/panel/">Entrar al panel</a>
  <a class="pill ghost" href="/precios/">Ver precios</a>
</p>
<p class="note">Kit para tu local: <a href="/assets/kit/klendar-guia-negocios.pdf">guía de 1 página (PDF)</a> · <a href="/assets/kit/klendar-cartel.pdf">cartel con QR (PDF)</a>. Lo legal, en las <a href="/negocios/">condiciones para negocios</a>.</p>
''',
    '''
<p class="lead">You have empty tables at five in the afternoon, three free slots on Tuesday or twenty unsold tickets for Thursday. That is what Klendar is for: you publish it in a minute and people nearby see it <strong>now</strong>.</p>

<h2>How it works</h2>
<ol>
  <li><strong>Register your business</strong> from the app (it needs the venue's exact location). We check it and verify it, usually within 24-48 hours.</li>
  <li><strong>Publish</strong> a flash deal (with a countdown and a capacity) or an event with a date. From your phone or from the <a href="/panel/">dashboard on a computer</a>.</li>
  <li><strong>People redeem it</strong> by showing you a single-use QR code. You validate it with the camera or by typing the code; the capacity goes down on its own.</li>
</ol>

<h2>What you get</h2>
<ul>
  <li><strong>No commission per redemption.</strong> What you charge at the venue is yours: Klendar never touches the money.</li>
  <li><strong>Customers from next door.</strong> The app shows what is near and starting soon, not what pays most.</li>
  <li><strong>You know what worked.</strong> Views, codes and redemptions for each publication, with who validated each one; exportable for your accountant.</li>
  <li><strong>Your team, with its own access.</strong> Whoever is behind the bar can validate codes without getting access to everything else.</li>
  <li><strong>No lock-in.</strong> Change plan or leave whenever you want.</li>
</ul>

<h2>What it costs</h2>
<p>Right now it is <strong>free</strong> while we are starting in your city. After that, one plan at €19.90 a month with no limits, and a founder price if you come in early. <a href="/en/pricing/">See pricing</a>.</p>

<h2>Do the maths</h2>
<p>With your numbers, not ours. It is an estimate to see whether it adds up, not a promise.</p>
<div class="calc" id="calc">
  <label>Average ticket <input type="number" id="c-ticket" value="12" min="1" step="0.5"> €</label>
  <label>Discount <input type="number" id="c-desc" value="20" min="0" max="90" step="5"> %</label>
  <label>People per month <input type="number" id="c-gente" value="25" min="1" step="1"></label>
  <label>Margin on the ticket <input type="number" id="c-margen" value="60" min="5" max="100" step="5"> %</label>
  <output id="c-out"></output>
</div>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var eur = function (n) { return n.toLocaleString('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }); };
  function calc() {
    var t = +$('c-ticket').value || 0, d = +$('c-desc').value || 0;
    var g = +$('c-gente').value || 0, m = +$('c-margen').value || 0;
    var cobras = t * (1 - d / 100);
    var ingresos = cobras * g;
    var margen = ingresos * m / 100;
    var plan = 19.9;
    var paraPagarlo = cobras * m / 100 > 0 ? Math.ceil(plan / (cobras * m / 100)) : 0;
    $('c-out').innerHTML = '<b>' + eur(ingresos) + ' a month</b> through the till from that offer, '
      + eur(margen) + ' of margin. The plan costs ' + eur(plan) + ': '
      + '<b>' + paraPagarlo + (paraPagarlo === 1 ? ' redemption' : ' redemptions') + '</b> a month pays for it.'
      + '<br><span class="mu">Each person pays you ' + eur(cobras) + ' instead of ' + eur(t) + '. '
      + 'If they were coming anyway, the discount costs you ' + eur(t * d / 100 * g) + '.</span>';
  }
  ['c-ticket', 'c-desc', 'c-gente', 'c-margen'].forEach(function (id) {
    $(id).addEventListener('input', calc);
  });
  calc();
})();
</script>

<h2>What we do not do</h2>
<p>We do not sell your data or your customers' data, we do not charge per redemption, and we do not put your deal ahead of another because you pay more: <a href="/en/faq/">in the app the order is chosen by the person</a> (near you, starting soonest or newest). Publications can be featured, and when that happens <strong>we say so</strong>.</p>

<h2>Getting started</h2>
<p>We are just starting, so if nobody is on Klendar in your city yet, write to us and we will get it going with you: <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>
<p class="acciones" style="margin-top:18px">
  <a class="pill accent" href="mailto:info@klendar.app?subject=I%20want%20to%20register%20my%20business">Write to us</a>
  <a class="pill ghost" href="/panel/">Go to the dashboard</a>
  <a class="pill ghost" href="/en/pricing/">See pricing</a>
</p>
<p class="note">Kit for your venue (Spanish): <a href="/assets/kit/klendar-guia-negocios.pdf">one-page guide (PDF)</a> · <a href="/assets/kit/klendar-cartel.pdf">poster with QR (PDF)</a>. The legal part is in the <a href="/en/business-terms/">business terms</a>.</p>
''',
)


def tabla_planes(lang):
    es = lang == 'es'
    ventajas_es = [
        'Publicaciones sin límite: ofertas flash, eventos y reservas',
        'Canjes sin límite y <strong>sin comisión</strong>',
        'Estadísticas, informe exportable y lista de asistentes',
        'Ficha del negocio, galería y panel para tu equipo',
        'Sin permanencia: lo dejas cuando quieras',
    ]
    ventajas_en = [
        'Unlimited publications: flash offers, events and bookings',
        'Unlimited redemptions and <strong>no commission</strong>',
        'Stats, exportable report and attendee list',
        'Business page, gallery and a panel for your team',
        'No lock-in: leave whenever you want',
    ]
    filas = []
    for _slug, n_es, n_en, p_es, p_en, extra_es, extra_en, destacado in PLANES:
        nombre = n_es if es else n_en
        precio = p_es if es else p_en
        extra = extra_es if es else extra_en
        if destacado:
            puntos = [
                ('Todo lo del plan Klendar' if es else 'Everything in the Klendar plan'),
                ('El precio no te sube nunca, ni cuando suba la tarifa'
                 if es else 'Your price never goes up, even when the rate does'),
                ('Plazas limitadas en cada ciudad' if es else 'Limited spots in each city'),
            ]
        else:
            puntos = ventajas_es if es else ventajas_en
        filas.append(f'''
    <div class="plan{' best' if destacado else ''}">
      {'<p class="tag">' + ('Para los primeros de tu ciudad' if es else 'For the first in your city') + '</p>' if destacado else ''}
      <h3>{nombre}</h3>
      <p class="price"><b>{precio}</b><span>{'/mes' if es else '/month'}</span></p>
      <p class="note">{extra}</p>
      <ul>
        {''.join(f'<li>{p}</li>' for p in puntos)}
      </ul>
    </div>''')
    return '<div class="plans">' + ''.join(filas) + '\n  </div>'


PAGINAS['precios'] = (
    'pricing',
    'Precios', 'Pricing',
    'Un solo plan, 19,90 €/mes sin límites y menos por local si tienes varios. '
    'Gratis mientras arrancamos en tu ciudad, sin comisiones por canje y sin permanencia.',
    'One plan, €19.90/month with no limits and less per venue if you have several. '
    'Free while we are starting in your city, no commission per redemption and no lock-in.',
    f'''
<p class="lead">Un solo plan, sin límites y sin comisiones por canje. Lo que cobras en tu local es tuyo entero.</p>
<p class="callout"><strong>Ahora mismo es gratis.</strong> Mientras una ciudad está arrancando no le cobramos a nadie: un mapa vacío no le sirve ni a los negocios ni a la gente. Cuando vayamos a empezar a cobrar en tu ciudad, te avisamos con un mes de antelación.</p>
{tabla_planes('es')}
<p class="note">Precio por local, IVA no incluido.</p>

<h2>¿Varios locales?</h2>
<p>El precio es <strong>por local</strong>, porque cada uno tiene su público, sus códigos y sus números. A partir del segundo baja:</p>
<table class="tiers">
  <tr><td>1 local</td><td><b>19,90 €</b> al mes</td></tr>
  <tr><td>2 a 5 locales</td><td><b>15 €</b> al mes por local</td></tr>
  <tr><td>6 o más</td><td><b>12 €</b> al mes por local, con una persona de contacto</td></tr>
</table>
<p><strong>Publicar en varios locales a la vez va incluido.</strong> Escribes la oferta una vez, marcas en qué locales la quieres y cada uno recibe la suya, con su dirección y su propio código; las cifras las ves por separado y sumadas. No cobramos aparte por ahorrarte el trabajo de escribirlo tres veces.</p>

<h2>La letra pequeña, en dos líneas</h2>
<ul>
  <li><strong>Prueba.</strong> Al dar de alta el negocio tienes 30 días con todo, sin tarjeta y sin que se renueve solo.</li>
  <li><strong>Cómo se paga.</strong> Mientras no tengamos pago con tarjeta, por transferencia: escribes a <a href="mailto:info@klendar.app">info@klendar.app</a> y lo dejamos activado.</li>
  <li><strong>Cambiar o dejarlo.</strong> Cuando quieras, en el mismo correo. No hay permanencia ni penalización, y no cobramos el mes empezado si te vas.</li>
  <li><strong>Nunca cobramos por canje.</strong> Ni porcentaje ni euros por código: si te funciona bien, pagas lo mismo.</li>
  <li><strong>Qué es un «destacado».</strong> Una publicación que aparece arriba durante un rato; va aparte y se pide por correo. Cuando una está destacada, la app lo dice: no se disfraza de recomendación.</li>
  <li><strong>El plan no cambia lo que ve la gente</strong> más allá de eso: el orden lo elige cada persona en los filtros.</li>
</ul>

<h2>¿Y para quien usa la app?</h2>
<p>Gratis, y sin cuenta para mirar. Solo hace falta registrarse para canjear, guardar planes o recibir avisos.</p>
<p style="margin-top:18px"><a class="pill accent" href="mailto:info@klendar.app?subject=Plan%20de%20Klendar">Preguntar por un plan</a> <a class="pill ghost" href="/para-negocios/">Cómo funciona</a></p>
''',
    f'''
<p class="lead">One plan, no limits and no commission per redemption. What you charge at your venue is yours.</p>
<p class="callout"><strong>Right now it is free.</strong> While a city is starting we charge nobody: an empty map is no use to businesses or to people. Before we start charging in your city, we tell you a month ahead.</p>
{tabla_planes('en')}
<p class="note">Price per venue, VAT not included.</p>

<h2>Several venues?</h2>
<p>The price is <strong>per venue</strong>, because each one has its own audience, its own codes and its own numbers. From the second one it drops:</p>
<table class="tiers">
  <tr><td>1 venue</td><td><b>€19.90</b> a month</td></tr>
  <tr><td>2 to 5 venues</td><td><b>€15</b> a month per venue</td></tr>
  <tr><td>6 or more</td><td><b>€12</b> a month per venue, with someone to talk to</td></tr>
</table>
<p><strong>Publishing to several venues at once is included.</strong> You write the offer once, tick the venues you want and each one gets its own, with its own address and its own code; you see the numbers per venue and added up. We do not charge extra for saving you the work of typing it three times.</p>

<h2>The small print, in two lines</h2>
<ul>
  <li><strong>Trial.</strong> When you register your business you get 30 days with everything, no card and no automatic renewal.</li>
  <li><strong>How you pay.</strong> Until we have card payments, by bank transfer: write to <a href="mailto:info@klendar.app">info@klendar.app</a> and we activate it.</li>
  <li><strong>Changing or leaving.</strong> Whenever you want, at the same address. No lock-in, no penalty, and we do not charge the month you are in if you go.</li>
  <li><strong>We never charge per redemption.</strong> No percentage, no euros per code: if it works well for you, you pay the same.</li>
  <li><strong>What a «featured» slot is.</strong> A publication that shows at the top for a while; it goes separately and you ask for it by email. When one is featured, the app says so: it is not dressed up as a recommendation.</li>
  <li><strong>Your plan does not change what people see</strong> beyond that: the order is chosen by each person in the filters.</li>
</ul>

<h2>And for people using the app?</h2>
<p>Free, and no account needed to look. You only sign up to redeem, save plans or get alerts.</p>
<p style="margin-top:18px"><a class="pill accent" href="mailto:info@klendar.app?subject=Klendar%20plan">Ask about a plan</a> <a class="pill ghost" href="/en/for-business/">How it works</a></p>
''',
)


# ── Preguntas frecuentes ────────────────────────────────────────────────────
FAQ_ES = [
    ('¿Cuánto cuesta usar Klendar?', 'Para quien busca planes, nada. Para los negocios hay un solo plan, y ahora mismo es gratis mientras arrancamos; los detalles están en <a href="/precios/">precios</a>.'),
    ('¿Hace falta cuenta para mirar?', 'No. Puedes ver ofertas y eventos sin registrarte, en la app y en la web. La cuenta hace falta para canjear, guardar planes o recibir avisos.'),
    ('¿Cómo se canjea una oferta?', 'Pulsas «Canjear» y te sale un código QR de un solo uso. Se lo enseñas al negocio, que lo escanea o escribe el código. Ojo: algunos códigos caducan a los pocos minutos, así que se pide estando ya en el local.'),
    ('Mi código no funciona', 'Suele ser una de tres: ya se usó, caducó (los de barra duran minutos) o es de otro negocio. En la app, en «Tus códigos», ves el estado de cada uno. Si algo no cuadra, escríbenos con el código a <a href="mailto:info@klendar.app">info@klendar.app</a>.'),
    ('¿Puedo reservar una plaza en un evento?', 'Si el negocio lo activa, sí: reservas desde la app y enseñas tu código en la puerta. La reserva no es un pago; lo que cueste, si cuesta, se paga en el local.'),
    ('¿Por qué veo unas cosas y no otras?', 'Por cercanía, por lo que empieza pronto y por lo que sigues. No usamos tu historial ni datos de otras webs. En cada ficha hay un «¿Por qué ves esto?» que lo explica, y el orden lo eliges tú en los filtros.'),
    ('¿Qué pasa con mis datos?', 'Lo contamos entero en la <a href="/privacidad/">política de privacidad</a>. En resumen: se usan para que la app funcione, no se venden, y puedes descargarlos o borrar tu cuenta desde la propia app.'),
    ('¿Cómo borro mi cuenta?', 'Desde Cuenta → Ajustes → Eliminar mi cuenta, en la app o en «Tu cuenta» de la web. Se borra todo lo tuyo. También puedes pedirlo por correo: <a href="/eliminar-cuenta/">cómo hacerlo</a>.'),
    ('Soy un negocio, ¿cómo me doy de alta?', 'Desde la app: Cuenta → ¿Quieres registrar tu negocio? (hace falta la ubicación exacta del local). Lo revisamos y te verificamos, normalmente en 24-48 horas. Luego puedes publicar desde el móvil o desde el <a href="/panel/">panel</a>.'),
    ('¿Klendar se lleva una comisión de lo que vendo?', 'No. Lo que cobras en tu local es tuyo entero; Klendar no toca el dinero.'),
    ('Vi algo que no debería estar ahí', 'En la app, en la ficha, hay un botón para denunciar. Lo revisamos y, si hay que retirarlo, se retira con un motivo y el negocio puede recurrir.'),
    ('¿En qué ciudades está?', 'Estamos empezando. Si en la tuya todavía no hay nada, en <a href="/agenda/">la agenda</a> lo verás vacío: escríbenos y lo arrancamos.'),
]
FAQ_EN = [
    ('How much does Klendar cost?', 'For people looking for plans, nothing. For businesses there is a single plan, and right now it is free while we are starting; the details are in <a href="/en/pricing/">pricing</a>.'),
    ('Do I need an account to look?', 'No. You can see deals and events without signing up, both in the app and on the web. An account is needed to redeem, save plans or get alerts.'),
    ('How do I redeem a deal?', 'You tap «Redeem» and get a single-use QR code. You show it to the business, which scans it or types the code. Careful: some codes expire within minutes, so ask for it once you are at the venue.'),
    ('My code does not work', 'Usually one of three: it was already used, it expired (bar codes last minutes) or it belongs to another business. In the app, under «My plans», you can see the status of each one. If something is off, write to us with the code at <a href="mailto:info@klendar.app">info@klendar.app</a>.'),
    ('Can I book a place at an event?', 'If the business turns it on, yes: you book from the app and show your code at the door. Booking is not a payment; whatever it costs, if anything, is paid at the venue.'),
    ('Why do I see some things and not others?', 'Because of how near they are, what starts soon and who you follow. We do not use your history or data from other sites. Each publication has a «Why are you seeing this?» that explains it, and you choose the order in the filters.'),
    ('What happens with my data?', 'The whole story is in the <a href="/en/privacy/">privacy policy</a>. In short: it is used to make the app work, it is not sold, and you can download it or delete your account from the app itself.'),
    ('How do I delete my account?', 'From Account → Settings → Delete my account, in the app or in “Your account” on the website. Everything of yours is deleted. You can also ask by email: <a href="/en/delete-account/">how to do it</a>.'),
    ('I am a business, how do I register?', 'From the app: Account → Want to register your business? (it needs the venue’s exact location). We check it and verify you, usually within 24-48 hours. After that you can publish from your phone or from the <a href="/panel/">dashboard</a>.'),
    ('Does Klendar take a commission on what I sell?', 'No. What you charge at your venue is yours; Klendar never touches the money.'),
    ('I saw something that should not be there', 'In the app, on the publication, there is a button to report it. We review it and, if it has to come down, it comes down with a reason and the business can appeal.'),
    ('Which cities is it in?', 'We are just starting. If nothing is happening in yours yet, <a href="/agenda/">the agenda</a> will look empty: write to us and we will get it going.'),
]


def faq_html(items):
    return '\n'.join(
        f'<details class="faq"><summary>{q}</summary><p>{a}</p></details>' for q, a in items)


PAGINAS['preguntas'] = (
    'faq',
    'Preguntas frecuentes', 'Frequently asked questions',
    'Cómo se canjea una oferta, qué pasa si el código no funciona, cómo se da de alta un negocio y qué hacemos con tus datos.',
    'How to redeem a deal, what to do if a code does not work, how a business registers and what we do with your data.',
    f'''
<p class="lead">Lo que más nos preguntan. Si lo tuyo no está aquí, escríbenos a <a href="mailto:info@klendar.app">info@klendar.app</a> y lo añadimos.</p>
{faq_html(FAQ_ES)}
<p class="note" style="margin-top:22px">¿Necesitas ayuda con algo concreto? <a href="/soporte/">Soporte</a>.</p>
''',
    f'''
<p class="lead">What we get asked most. If yours is not here, write to <a href="mailto:info@klendar.app">info@klendar.app</a> and we will add it.</p>
{faq_html(FAQ_EN)}
<p class="note" style="margin-top:22px">Need help with something specific? <a href="/en/support/">Support</a>.</p>
''',
)


# ── Prensa ──────────────────────────────────────────────────────────────────
PAGINAS['prensa'] = (
    'press',
    'Prensa', 'Press',
    'Qué es Klendar en dos líneas, logotipos, capturas y a quién escribir.',
    'What Klendar is in two lines, logos, screenshots and who to write to.',
    '''
<p class="lead">Si estás escribiendo sobre Klendar, aquí tienes lo que necesitas. Para cualquier otra cosa: <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>

<h2>En dos líneas</h2>
<p>Klendar es una app gratuita donde los negocios de barrio publican <strong>ofertas de última hora</strong> (con cuenta atrás y plazas limitadas) y <strong>eventos</strong>, y la gente de alrededor las ve y las canjea enseñando un código QR de un solo uso. No hay comisiones por canje: lo que se cobra en el local es del local.</p>

<h2>En un párrafo</h2>
<p>Un bar con mesas vacías a media tarde, una peluquería con tres huecos el martes o una sala con entradas sin vender tienen el mismo problema: avisar a tiempo a quien está a dos calles. Klendar (klendar.app) convierte ese hueco en una publicación con caducidad que solo ve quien está cerca. Para el negocio es un panel donde publica en un minuto y valida los códigos en la puerta; para quien la usa, una lista honesta de lo que hay hoy alrededor, ordenada por cercanía o por lo que empieza antes, sin perfilado publicitario.</p>

<h2>Material</h2>
<ul>
  <li><a href="/assets/icon-512.png">Icono (PNG 512)</a> · <a href="/assets/symbol.png">Símbolo</a> · <a href="/assets/og.png">Imagen social</a></li>
  <li>Capturas: <a href="/assets/screens/feed.webp?v=20260926">descubrir</a> · <a href="/assets/screens/detail.webp?v=20260926">ficha</a> · <a href="/assets/screens/agenda.webp?v=20260926">agenda</a> · <a href="/assets/screens/map.webp?v=20260926">mapa</a></li>
  <li><a href="/assets/kit/klendar-guia-negocios.pdf">Guía para negocios (PDF)</a> · <a href="/assets/kit/klendar-cartel.pdf">Cartel con QR (PDF)</a></li>
</ul>
<p class="note">El nombre se escribe <strong>Klendar</strong>, con K y sin acentos. El color de marca es el coral <code>#FF4D6D</code> sobre fondo tinta <code>#0B0F1A</code>. Se puede usar el logotipo tal cual, sin deformarlo ni cambiarle el color.</p>

<h2>Contacto</h2>
<p>Prensa y cualquier consulta: <a href="mailto:info@klendar.app">info@klendar.app</a>. Asuntos técnicos: <a href="mailto:dev@klendar.app">dev@klendar.app</a>.</p>
''',
    '''
<p class="lead">If you are writing about Klendar, here is what you need. For anything else: <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>

<h2>In two lines</h2>
<p>Klendar is a free app where neighbourhood businesses publish <strong>last-minute deals</strong> (with a countdown and limited places) and <strong>events</strong>, and people nearby see them and redeem them by showing a single-use QR code. There is no commission per redemption: what is charged at the venue belongs to the venue.</p>

<h2>In one paragraph</h2>
<p>A bar with empty tables mid-afternoon, a hairdresser with three free slots on Tuesday or a venue with unsold tickets all share a problem: telling someone two streets away, in time. Klendar (klendar.app) turns that gap into a publication with an expiry that only people nearby see. For the business it is a dashboard where they publish in a minute and validate codes at the door; for everyone else, an honest list of what is on around them today, ordered by distance or by what starts soonest, with no ad profiling.</p>

<h2>Assets</h2>
<ul>
  <li><a href="/assets/icon-512.png">Icon (PNG 512)</a> · <a href="/assets/symbol.png">Symbol</a> · <a href="/assets/og.png">Social image</a></li>
  <li>Screenshots: <a href="/assets/screens/feed.webp?v=20260926">discover</a> · <a href="/assets/screens/detail.webp?v=20260926">detail</a> · <a href="/assets/screens/agenda.webp?v=20260926">agenda</a> · <a href="/assets/screens/map.webp?v=20260926">map</a></li>
  <li><a href="/assets/kit/klendar-guia-negocios.pdf">Business guide (PDF, Spanish)</a> · <a href="/assets/kit/klendar-cartel.pdf">Poster with QR (PDF)</a></li>
</ul>
<p class="note">The name is written <strong>Klendar</strong>, with a K. The brand colour is coral <code>#FF4D6D</code> on ink <code>#0B0F1A</code>. The logo can be used as it is, without stretching it or changing its colour.</p>

<h2>Contact</h2>
<p>Press and anything else: <a href="mailto:info@klendar.app">info@klendar.app</a>. Technical matters: <a href="mailto:dev@klendar.app">dev@klendar.app</a>.</p>
''',
)


# ── Accesibilidad ───────────────────────────────────────────────────────────
PAGINAS['accesibilidad'] = (
    'accessibility',
    'Accesibilidad', 'Accessibility',
    'En qué estado está la accesibilidad de Klendar, qué sabemos que falta y cómo avisarnos.',
    'Where Klendar stands on accessibility, what we know is missing and how to tell us.',
    '''
<p class="lead">Queremos que Klendar se pueda usar con lector de pantalla, con el texto grande y sin depender del color. Esto es lo que hay hecho, lo que falta y cómo avisarnos si algo no funciona.</p>

<h2>Estado</h2>
<p><strong>Parcialmente conforme</strong> con las WCAG 2.2 nivel AA. Declaración preparada según la Ley 11/2023 y el Real Decreto 1112/2018; última revisión: septiembre de 2026.</p>

<h2>Lo que ya está</h2>
<ul>
  <li>Contraste revisado en los textos y botones principales, en modo claro y oscuro.</li>
  <li>La app respeta el tamaño de letra del sistema y se puede usar en vertical.</li>
  <li>Etiquetas para lector de pantalla en los botones y las tarjetas de la app.</li>
  <li>La web funciona sin JavaScript para leer el contenido, y las páginas públicas se navegan con el teclado.</li>
  <li>Ninguna información depende solo del color: lo que se dice con color se dice también con texto.</li>
</ul>

<h2>Lo que sabemos que falta</h2>
<ul>
  <li>Un repaso completo con lector de pantalla (TalkBack y VoiceOver) de todas las pantallas de la app: está pendiente y es lo siguiente.</li>
  <li>El mapa no es cómodo con lector de pantalla; la misma información está en la lista y en la agenda, que sí lo son.</li>
  <li>Algunos vídeos que suben los negocios no llevan subtítulos, porque los pone quien publica.</li>
</ul>

<h2>Si algo no te funciona</h2>
<p>Escríbenos a <a href="mailto:info@klendar.app">info@klendar.app</a> contando qué pantalla es y con qué lo usas (móvil, lector de pantalla, navegador). Respondemos en un máximo de 20 días hábiles, como marca la norma, y si podemos lo arreglamos antes.</p>
<p>Si no te contestamos o no te convence la respuesta, puedes reclamar ante la autoridad competente en materia de accesibilidad.</p>
''',
    '''
<p class="lead">We want Klendar to work with a screen reader, with large text and without depending on colour. Here is what is done, what is missing and how to tell us when something does not work.</p>

<h2>Status</h2>
<p><strong>Partially compliant</strong> with WCAG 2.2 level AA. Statement prepared under Spanish Law 11/2023 and Royal Decree 1112/2018; last reviewed September 2026.</p>

<h2>What is already there</h2>
<ul>
  <li>Contrast reviewed on the main text and buttons, in light and dark mode.</li>
  <li>The app respects the system font size and works in portrait.</li>
  <li>Screen-reader labels on the app's buttons and cards.</li>
  <li>The website can be read without JavaScript, and the public pages can be navigated with a keyboard.</li>
  <li>No information depends on colour alone: whatever colour says, words say too.</li>
</ul>

<h2>What we know is missing</h2>
<ul>
  <li>A full pass with a screen reader (TalkBack and VoiceOver) over every screen of the app: pending, and next on the list.</li>
  <li>The map is not comfortable with a screen reader; the same information is in the list and the agenda, which are.</li>
  <li>Some videos uploaded by businesses have no captions, because whoever publishes adds them.</li>
</ul>

<h2>If something does not work for you</h2>
<p>Write to <a href="mailto:info@klendar.app">info@klendar.app</a> telling us which screen it is and what you use it with (phone, screen reader, browser). We reply within 20 working days at most, as the rules require, and we fix it sooner if we can.</p>
<p>If we do not reply, or the reply does not satisfy you, you can complain to the competent accessibility authority.</p>
''',
)


# ── Estado del servicio ─────────────────────────────────────────────────────
PAGINAS['estado'] = (
    'status',
    'Estado del servicio', 'Service status',
    'Si Klendar no va, aquí están los sitios donde mirar y cómo avisarnos.',
    'If Klendar is down, here is where to look and how to tell us.',
    '''
<p class="lead">Si la app o la web no van, casi siempre es una de tres cosas. Aquí puedes comprobarlo tú mismo.</p>

<h2>Dónde mirar</h2>
<ul>
  <li><strong>La base de datos y el acceso</strong> (cuentas, ofertas, canjes): <a href="https://status.supabase.com" rel="noopener" target="_blank">status.supabase.com</a>.</li>
  <li><strong>La web y los enlaces</strong> (klendar.app): <a href="https://www.cloudflarestatus.com" rel="noopener" target="_blank">cloudflarestatus.com</a>.</li>
  <li><strong>Las notificaciones</strong>: <a href="https://status.firebase.google.com" rel="noopener" target="_blank">status.firebase.google.com</a>.</li>
</ul>

<h2>Mantenimiento</h2>
<p>Cuando tocamos algo delicado, la app avisa con un mensaje en pantalla en vez de fallar a medias. Si te sale, es a propósito y suele durar poco.</p>

<h2>Si sigue sin ir</h2>
<p>Escríbenos a <a href="mailto:info@klendar.app">info@klendar.app</a> contando qué hacías y desde dónde (móvil o web). Si es algo que afecta a mucha gente, lo contamos aquí.</p>
<p class="note">Todavía no publicamos cifras de disponibilidad: preferimos no dar un número que no podamos sostener.</p>
''',
    '''
<p class="lead">If the app or the website are not working, it is almost always one of three things. You can check it yourself here.</p>

<h2>Where to look</h2>
<ul>
  <li><strong>Database and sign-in</strong> (accounts, deals, redemptions): <a href="https://status.supabase.com" rel="noopener" target="_blank">status.supabase.com</a>.</li>
  <li><strong>The website and links</strong> (klendar.app): <a href="https://www.cloudflarestatus.com" rel="noopener" target="_blank">cloudflarestatus.com</a>.</li>
  <li><strong>Notifications</strong>: <a href="https://status.firebase.google.com" rel="noopener" target="_blank">status.firebase.google.com</a>.</li>
</ul>

<h2>Maintenance</h2>
<p>When we touch something delicate, the app shows a message instead of half-failing. If you see it, it is on purpose and usually brief.</p>

<h2>If it still does not work</h2>
<p>Write to <a href="mailto:info@klendar.app">info@klendar.app</a> telling us what you were doing and where (phone or web). If it affects a lot of people, we will say so here.</p>
<p class="note">We do not publish uptime figures yet: we would rather not give a number we cannot back up.</p>
''',
)


# ── Sobre Klendar ───────────────────────────────────────────────────────────
PAGINAS['sobre'] = (
    'about',
    'Sobre Klendar', 'About Klendar',
    'Por qué existe Klendar, cómo se gana dinero y qué no vamos a hacer.',
    'Why Klendar exists, how it makes money and what we are not going to do.',
    '''
<p class="lead">Klendar nació de una escena de todos los días: un bar medio vacío a las seis de la tarde y, a dos calles, alguien mirando el móvil sin saber qué hacer.</p>

<h2>Qué intentamos</h2>
<p>Que lo que pasa cerca de ti se entere quien está cerca de ti. Ni un buscador de cupones ni una red social más: una lista de lo que hay <strong>hoy</strong> a tu alrededor, con el tiempo que le queda y las plazas que quedan, y un negocio al otro lado que puede publicarla en un minuto.</p>

<h2>Cómo se gana dinero</h2>
<p>Con el plan de los negocios (<a href="/precios/">precios</a>), y solo con eso. <strong>No cobramos comisión por canje</strong>, no vendemos datos y no hay publicidad de terceros. Un negocio puede destacar una publicación, y cuando lo hace la app lo dice.</p>

<h2>Lo que no vamos a hacer</h2>
<ul>
  <li>Inventar urgencia: si quedan diez plazas, pone diez.</li>
  <li>Ordenar por lo que más nos paga, ni decidir por ti: el orden lo eliges en los filtros.</li>
  <li>Perfilarte con tu historial ni con datos de otras webs.</li>
  <li>Pedirte más datos de los que hacen falta para que esto funcione.</li>
</ul>

<h2>Quién está detrás</h2>
<p>Un proyecto pequeño, hecho en España. Los datos del titular están en el <a href="/aviso-legal/">aviso legal</a>. Para cualquier cosa: <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>
''',
    '''
<p class="lead">Klendar started from an everyday scene: a half-empty bar at six in the afternoon and, two streets away, someone staring at their phone with nothing to do.</p>

<h2>What we are trying to do</h2>
<p>Make what is happening near you reach the people who are near you. Not a coupon search engine, not another social network: a list of what is on <strong>today</strong> around you, with the time it has left and the places still free, and a business on the other side that can publish it in a minute.</p>

<h2>How it makes money</h2>
<p>From the business plan (<a href="/en/pricing/">pricing</a>), and only from that. <strong>We take no commission per redemption</strong>, we do not sell data and there is no third-party advertising. A business can feature a publication, and when it does, the app says so.</p>

<h2>What we are not going to do</h2>
<ul>
  <li>Invent urgency: if ten places are left, it says ten.</li>
  <li>Order things by who pays us most, or decide for you: you choose the order in the filters.</li>
  <li>Profile you with your history or with data from other sites.</li>
  <li>Ask you for more data than this needs to work.</li>
</ul>

<h2>Who is behind it</h2>
<p>A small project, made in Spain. The owner's details are in the <a href="/en/legal-notice/">legal notice</a>. For anything at all: <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>
''',
)


if __name__ == '__main__':
    for es_slug, (en_slug, t_es, t_en, d_es, d_en, b_es, b_en) in PAGINAS.items():
        for lang, slug, title, desc, body in (
            ('es', es_slug, t_es, d_es, b_es),
            ('en', 'en/' + en_slug, t_en, d_en, b_en),
        ):
            os.makedirs(slug, exist_ok=True)
            path = '/' + slug + '/'
            io.open(os.path.join(slug, 'index.html'), 'w', encoding='utf-8', newline='\n').write(
                doc_page(T[lang], path, title, desc, body))
        print('ok', es_slug, '·', en_slug)
