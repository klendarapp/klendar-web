# Páginas de contenido de klendar.app (las que no son legales ni la portada):
# para negocios, precios, preguntas, prensa, accesibilidad, estado y sobre.
#
# En español y en inglés, cada una con su URL propia. Se generan igual que las
# legales (`build_legal.py`) para que compartan cabecera, pie y estilo.
#
# Ejecutar: python build_pages.py   (desde la raíz de klendar-web)
import io
import os

from build_site import T, doc_page, footer, head

# Precios reales de `subscription_plans` (Supabase). Si cambian allí, aquí.
PLANES = [
    # Un solo plan, después de la prueba gratis. Los límites por plan se
    # quitaron: castigaban justo lo que llena el mapa, que es publicar. El
    # precio de fundador se retiró el 2026-09-29 (el plan sigue en la base,
    # oculto, por si alguien lo tuviera).
    ('standard', 'Klendar', 'Klendar', '19,90 €', '€19.90',
     '199 €/año (dos meses gratis)', '€199/year (two months free)'),
]

PAGINAS = {}  # slug ES -> (slug EN, título ES, título EN, desc ES, desc EN, cuerpo ES, cuerpo EN)


# ── Para negocios ───────────────────────────────────────────────────────────
PAGINAS['para-negocios'] = (
    'for-business',
    'Klendar para negocios', 'Klendar for businesses',
    'Atrae clientes nuevos, llena tus eventos y haz que vuelvan. Pruébalo gratis, sin comisiones por canje y sin permanencia.',
    'Bring in new customers, fill your events and get people coming back. Try it free, no commission per redemption, no lock-in.',
    '''
<p class="lead">Quieres que te conozca gente nueva, llenar la cata del jueves o que quien vino una vez vuelva. Klendar es para eso: publicas una oferta flash o un evento en un minuto y lo ve quien está cerca <strong>ahora</strong>.</p>

<h2>Cómo funciona</h2>
<ol>
  <li><strong>Das de alta tu negocio</strong> desde la app o desde el <a href="/panel/">panel web</a> (hace falta la ubicación exacta del local). Lo revisamos y lo verificamos, normalmente en 24-48 horas.</li>
  <li><strong>Publicas</strong> una oferta flash (con cuenta atrás y aforo) o un evento con fecha. Desde el móvil o desde el <a href="/panel/">panel del ordenador</a>.</li>
  <li><strong>La gente la canjea</strong> enseñándote un código QR de un solo uso. Lo validas con la cámara o escribiendo el código; el aforo baja solo.</li>
</ol>

<h2>Qué ganas</h2>
<ul>
  <li><strong>Sin comisiones por canje.</strong> Lo que cobras en el local es tuyo entero: Klendar no toca el dinero.</li>
  <li><strong>Clientes nuevos.</strong> La app enseña lo que está cerca y empieza pronto, no lo que más paga.</li>
  <li><strong>Sabes qué funcionó.</strong> Vistas, códigos y canjes de cada publicación, con el detalle de quién validó cada uno; exportable para tu gestor.</li>
  <li><strong>Tu equipo, con su sitio.</strong> Puedes dar acceso a quien esté en barra para que valide códigos, sin darle acceso a lo demás.</li>
  <li><strong>Sin permanencia.</strong> Lo dejas cuando quieras.</li>
</ul>

<h2>Lo que cuesta</h2>
<p>Lo <strong>pruebas gratis</strong>: 30 días con todo al darte de alta, sin tarjeta, y gratis mientras arrancamos en tu ciudad. Después, un solo plan de 19,90 € al mes sin límites, sin permanencia y sin comisión por canje. <a href="/precios/">Ver precios</a>.</p>

<h2>Echa la cuenta</h2>
<p>Con tus números, no con los nuestros. Es una estimación para ver si sale a cuenta, no una promesa.</p>
<div class="calc" id="calc">
  <div class="calc-fila"><label for="c-ticket">Ticket medio</label><span class="calc-campo"><input type="number" id="c-ticket" value="12" min="1" step="0.5" inputmode="decimal"><span class="calc-ud">€</span></span></div>
  <div class="calc-fila"><label for="c-desc">Descuento</label><span class="calc-campo"><input type="number" id="c-desc" value="20" min="0" max="90" step="5" inputmode="decimal"><span class="calc-ud">%</span></span></div>
  <div class="calc-fila"><label for="c-gente">Personas al mes</label><span class="calc-campo"><input type="number" id="c-gente" value="25" min="1" step="1" inputmode="decimal"><span class="calc-ud" aria-hidden="true"></span></span></div>
  <div class="calc-fila"><label for="c-margen">Margen sobre el ticket</label><span class="calc-campo"><input type="number" id="c-margen" value="60" min="5" max="100" step="5" inputmode="decimal"><span class="calc-ud">%</span></span></div>
  <output id="c-out" for="c-ticket c-desc c-gente c-margen" aria-live="polite"></output>
</div>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var eur = function (n) { return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
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
<p class="lead">You want new people to discover you, a full house for Thursday's tasting, or the customers who came once to come back. That's what Klendar is for: you post a flash offer or an event in a minute and people nearby see it <strong>now</strong>.</p>

<h2>How it works</h2>
<ol>
  <li><strong>Register your business</strong> from the app or from the <a href="/panel/">web dashboard</a> (it needs the venue's exact location). We review and verify it, usually within 24–48 hours.</li>
  <li><strong>Publish</strong> a flash offer (with a countdown and a capacity) or an event with a date. From your phone or from the <a href="/panel/">dashboard on a computer</a>.</li>
  <li><strong>People redeem it</strong> by showing you a single-use QR code. You validate it with the camera or by typing the code; the capacity updates automatically.</li>
</ol>

<h2>What you get</h2>
<ul>
  <li><strong>No commission per redemption.</strong> What you charge at the venue is yours: Klendar never touches the money.</li>
  <li><strong>New customers.</strong> The app shows what's nearby and starting soon, not whoever pays most.</li>
  <li><strong>You know what worked.</strong> Views, codes and redemptions for each publication, with who validated each one; exportable for your accountant.</li>
  <li><strong>Your team, with its own access.</strong> Whoever is behind the bar can validate codes without getting access to everything else.</li>
  <li><strong>No lock-in.</strong> Leave whenever you like.</li>
</ul>

<h2>What it costs</h2>
<p>You <strong>try it free</strong>: 30 days with everything when you register, no card, and free while we're launching in your city. After that, one plan at €19.90 a month with no limits, no lock-in and no commission per redemption. <a href="/en/pricing/">See pricing</a>.</p>

<h2>Do the maths</h2>
<p>With your numbers, not ours. It's an estimate to see whether it adds up, not a promise.</p>
<div class="calc" id="calc">
  <div class="calc-fila"><label for="c-ticket">Average ticket</label><span class="calc-campo"><input type="number" id="c-ticket" value="12" min="1" step="0.5" inputmode="decimal"><span class="calc-ud">€</span></span></div>
  <div class="calc-fila"><label for="c-desc">Discount</label><span class="calc-campo"><input type="number" id="c-desc" value="20" min="0" max="90" step="5" inputmode="decimal"><span class="calc-ud">%</span></span></div>
  <div class="calc-fila"><label for="c-gente">People per month</label><span class="calc-campo"><input type="number" id="c-gente" value="25" min="1" step="1" inputmode="decimal"><span class="calc-ud" aria-hidden="true"></span></span></div>
  <div class="calc-fila"><label for="c-margen">Margin on the ticket</label><span class="calc-campo"><input type="number" id="c-margen" value="60" min="5" max="100" step="5" inputmode="decimal"><span class="calc-ud">%</span></span></div>
  <output id="c-out" for="c-ticket c-desc c-gente c-margen" aria-live="polite"></output>
</div>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var eur = function (n) { return n.toLocaleString('en-GB', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  function calc() {
    var t = +$('c-ticket').value || 0, d = +$('c-desc').value || 0;
    var g = +$('c-gente').value || 0, m = +$('c-margen').value || 0;
    var cobras = t * (1 - d / 100);
    var ingresos = cobras * g;
    var margen = ingresos * m / 100;
    var plan = 19.9;
    var paraPagarlo = cobras * m / 100 > 0 ? Math.ceil(plan / (cobras * m / 100)) : 0;
    $('c-out').innerHTML = '<b>' + eur(ingresos) + ' a month</b> through the till from that offer, '
      + eur(margen) + ' in margin. The plan costs ' + eur(plan) + ': '
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

<h2>What we don't do</h2>
<p>We don't sell your data or your customers' data, we don't charge per redemption, and we don't put your offer ahead of another because you pay more: <a href="/en/faq/">in the app the order is chosen by the person</a> (near you, starting soonest or newest). Publications can be featured, and when that happens <strong>we say so</strong>.</p>

<h2>Getting started</h2>
<p>We're just getting started, so if nobody in your city is on Klendar yet, email us and we'll get it going with you: <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>
<p class="acciones" style="margin-top:18px">
  <a class="pill accent" href="mailto:info@klendar.app?subject=I%20want%20to%20register%20my%20business">Email us</a>
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
        'Unlimited publications: flash offers, events and place reservations',
        'Unlimited redemptions and <strong>no commission</strong>',
        'Stats, exportable report and attendee list',
        'Business page, gallery and a dashboard for your team',
        'No lock-in: leave whenever you like',
    ]
    # Primero la prueba (no es un plan: es cómo se empieza) y luego el plan.
    prueba = [
        'Todo lo del plan, sin límites', 'Y gratis mientras arrancamos en tu ciudad',
        'Te avisamos un mes antes de empezar a cobrar',
    ] if es else [
        'Everything in the plan, no limits', 'And free while we\'re launching in your city',
        'We\'ll give you a month\'s notice before charging',
    ]
    filas = [f'''
    <div class="plan">
      <p class="tag">{'Para empezar' if es else 'To start'}</p>
      <h2>{'Prueba gratis' if es else 'Free trial'}</h2>
      <p class="price"><b>{'0 €' if es else '€0'}</b><span>{'· 30 días' if es else '· 30 days'}</span></p>
      <p class="note">{'Sin tarjeta y sin renovación automática' if es else 'No card and no automatic renewal'}</p>
      <ul>
        {''.join(f'<li>{p}</li>' for p in prueba)}
      </ul>
    </div>''']
    for _slug, n_es, n_en, p_es, p_en, extra_es, extra_en in PLANES:
        nombre = n_es if es else n_en
        precio = p_es if es else p_en
        extra = extra_es if es else extra_en
        puntos = ventajas_es if es else ventajas_en
        filas.append(f'''
    <div class="plan best">
      <p class="tag">{'Después' if es else 'After that'}</p>
      <h2>{nombre}</h2>
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
    'Pruébalo gratis y, después, un solo plan de 19,90 €/mes sin límites (menos por local si tienes varios). '
    'Sin comisiones por canje y sin permanencia.',
    'Try it free, then one plan at €19.90/month with no limits (less per venue if you have several). '
    'No commission per redemption and no lock-in.',
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
<p>Gratis, y sin cuenta para mirar. Solo hace falta crear una cuenta para canjear, guardar planes o recibir avisos.</p>
<p style="margin-top:18px"><a class="pill accent" href="mailto:info@klendar.app?subject=Plan%20de%20Klendar">Preguntar por un plan</a> <a class="pill ghost" href="/para-negocios/">Cómo funciona</a></p>
''',
    f'''
<p class="lead">One plan, no limits and no commission per redemption. What you charge at your venue is yours.</p>
<p class="callout"><strong>Right now it's free.</strong> While a city is launching, we don't charge anyone: an empty map is no use to businesses or to people. Before we start charging in your city, we'll give you a month's notice.</p>
{tabla_planes('en')}
<p class="note">Price per venue, VAT not included.</p>

<h2>Several venues?</h2>
<p>The price is <strong>per venue</strong>, because each one has its own audience, its own codes and its own numbers. From the second one, it goes down:</p>
<table class="tiers">
  <tr><td>1 venue</td><td><b>€19.90</b> a month</td></tr>
  <tr><td>2 to 5 venues</td><td><b>€15</b> a month per venue</td></tr>
  <tr><td>6 or more</td><td><b>€12</b> a month per venue, with a dedicated contact</td></tr>
</table>
<p><strong>Publishing to several venues at once is included.</strong> You write the offer once, tick the venues you want and each one gets its own, with its own address and its own code; you see the numbers per venue and added up. We don't charge extra for saving you from typing it three times.</p>

<h2>The small print, in two lines</h2>
<ul>
  <li><strong>Trial.</strong> When you register your business you get 30 days with everything, no card and no automatic renewal.</li>
  <li><strong>How you pay.</strong> Until we have card payments, by bank transfer: email <a href="mailto:info@klendar.app">info@klendar.app</a> and we'll activate it.</li>
  <li><strong>Changing or leaving.</strong> Whenever you want, at the same address. No lock-in, no penalty, and we don't charge for the month you're in if you leave.</li>
  <li><strong>We never charge per redemption.</strong> No percentage, no euros per code: if it works well for you, you pay the same.</li>
  <li><strong>What “featured” means.</strong> A publication that shows at the top for a while; it's charged separately and you request it by email. When one is featured, the app says so: it isn't dressed up as a recommendation.</li>
  <li><strong>Your plan doesn't change what people see</strong> beyond that: the order is chosen by each person in the filters.</li>
</ul>

<h2>And for people using the app?</h2>
<p>Free, and no account needed to browse. You only sign up to redeem, save plans or get alerts.</p>
<p style="margin-top:18px"><a class="pill accent" href="mailto:info@klendar.app?subject=Klendar%20plan">Ask about a plan</a> <a class="pill ghost" href="/en/for-business/">How it works</a></p>
''',
)


# ── Preguntas frecuentes (centro de ayuda) ───────────────────────────────────
# El contenido vive en `ayuda.py` (una sola fuente para esta página, Soporte y
# la app, que se descarga `assets/ayuda.json`). Aquí solo se pinta: pestañas
# «Para ti» / «Para negocios» y buscador (`assets/ayuda.js`, `assets/ayuda.css`).
import ayuda  # noqa: E402

AYUDA_V = 1  # ?v= de assets/ayuda.js y ayuda.css

AYUDA_T = {
    'es': dict(lead='Lo que más nos preguntan, para quien busca planes y para los negocios.',
               buscar='Buscar en la ayuda', ph='Buscar: código, reserva, calendario…',
               pestanas='Preguntas frecuentes', nada_h='¿No lo encuentras?',
               nada_p='Escríbenos y te respondemos en 2 días laborables como mucho. Si es algo que se pregunta a menudo, lo añadimos aquí.',
               boton='Escríbenos', sugerencias='/app/#/sugerencias',
               correo='O por correo a <a href="mailto:info@klendar.app">info@klendar.app</a> · <a href="/soporte/">Soporte</a>'),
    'en': dict(lead='What we get asked most, for people looking for plans and for businesses.',
               buscar='Search help', ph='Search: code, reservation, calendar…',
               pestanas='Frequently asked questions', nada_h="Can't find it?",
               nada_p="Write to us and we'll reply within 2 working days at most. If it's something people often ask, we'll add it here.",
               boton='Write to us', sugerencias='/app/?lang=en#/sugerencias',
               correo='Or by email at <a href="mailto:info@klendar.app">info@klendar.app</a> · <a href="/en/support/">Support</a>'),
}


def ayuda_html(lang):
    t = AYUDA_T[lang]
    nombres = ayuda.PESTANAS[lang]
    pestanas = ''.join(
        f'<button type="button" role="tab" id="tab-{k}" aria-controls="ayuda-{k}" aria-selected="{str(i == 0).lower()}">{nombres[k]}</button>'
        for i, k in enumerate(('ti', 'negocios')))
    paneles = ''.join(
        f'<section id="ayuda-{k}" role="tabpanel" aria-labelledby="tab-{k}">\n'
        f'<h2 class="ayuda-titulo">{nombres[k]}</h2>\n'
        + '\n'.join(f'<details class="faq" id="{p["id"]}"><summary>{p[f"q_{lang}"]}</summary><p>{p[f"a_{lang}"]}</p></details>'
                    for p in ayuda.de(k))
        + '\n</section>\n'
        for k in ('ti', 'negocios'))
    return f'''
<link rel="stylesheet" href="/assets/ayuda.css?v={AYUDA_V}">
<p class="lead">{t['lead']}</p>
<div class="ayuda" data-ayuda>
<label class="ayuda-buscar" data-solo-js hidden><span class="ayuda-titulo">{t['buscar']}</span><input type="search" id="ayuda-q" placeholder="{t['ph']}" autocomplete="off" enterkeyhint="search"></label>
<div class="ayuda-pestanas" role="tablist" aria-label="{t['pestanas']}" data-solo-js hidden>{pestanas}</div>
<div class="ayuda-estado" role="status" aria-live="polite"></div>
{paneles}<section class="ayuda-escribenos">
<h2>{t['nada_h']}</h2>
<p>{t['nada_p']}</p>
<a class="pill accent" href="{t['sugerencias']}">{t['boton']}</a>
<p class="note">{t['correo']}</p>
</section>
</div>
<script src="/assets/ayuda.js?v={AYUDA_V}" defer></script>
'''


PAGINAS['preguntas'] = (
    'faq',
    'Preguntas frecuentes', 'Frequently asked questions',
    'Cómo se canjea una oferta, qué pasa si el código no funciona, cómo llevar tus planes al calendario, cómo se da de alta un negocio y qué hacemos con tus datos.',
    "How to redeem a deal, what to do if a code doesn't work, how to get your plans into your calendar, how a business registers and what we do with your data.",
    ayuda_html('es'),
    ayuda_html('en'),
)


# ── Prensa ──────────────────────────────────────────────────────────────────
PAGINAS['prensa'] = (
    'press',
    'Prensa', 'Press',
    'Qué es Klendar en dos líneas, logotipos, capturas y a quién escribir.',
    'What Klendar is in two lines, logos, screenshots and who to contact.',
    '''
<p class="lead">Si estás escribiendo sobre Klendar, aquí tienes lo que necesitas. Para cualquier otra cosa: <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>

<h2>En dos líneas</h2>
<p>Klendar es una app gratuita donde los negocios de barrio publican <strong>ofertas de última hora</strong> (con cuenta atrás y plazas limitadas) y <strong>eventos</strong>, y la gente de alrededor las ve y las canjea enseñando un código QR de un solo uso. No hay comisiones por canje: lo que se cobra en el local es del local.</p>

<h2>En un párrafo</h2>
<p>Un bar con mesas vacías a media tarde, una peluquería con tres huecos el martes o una sala con entradas sin vender tienen el mismo problema: avisar a tiempo a quien está a dos calles. Klendar (klendar.app) convierte ese hueco en una publicación con caducidad que solo ve quien está cerca. Para el negocio es un panel donde publica en un minuto y valida los códigos en la puerta; para quien la usa, una lista honesta de lo que hay hoy alrededor, ordenada por cercanía o por lo que empieza antes, sin perfilado publicitario.</p>

<h2>Material</h2>
<ul>
  <li><a href="/assets/icon-512.png">Icono (PNG 512)</a> · <a href="/assets/symbol.png">Símbolo</a> · <a href="/assets/og.png">Imagen social</a></li>
  <li>Capturas: <a href="/assets/screens/feed.webp?v=20261001">descubrir</a> · <a href="/assets/screens/detail.webp?v=20261001">ficha</a> · <a href="/assets/screens/agenda.webp?v=20261001">agenda</a> · <a href="/assets/screens/map.webp?v=20261001">mapa</a></li>
  <li><a href="/assets/kit/klendar-guia-negocios.pdf">Guía para negocios (PDF)</a> · <a href="/assets/kit/klendar-cartel.pdf">Cartel con QR (PDF)</a></li>
</ul>
<p class="note">El nombre se escribe <strong>Klendar</strong>, con K y sin acentos. El color de marca es el coral <code>#FF4D6D</code> sobre fondo tinta <code>#0A0A0A</code>. Se puede usar el logotipo tal cual, sin deformarlo ni cambiarle el color.</p>

<h2>Contacto</h2>
<p>Prensa y cualquier consulta: <a href="mailto:info@klendar.app">info@klendar.app</a>. Asuntos técnicos: <a href="mailto:dev@klendar.app">dev@klendar.app</a>.</p>
''',
    '''
<p class="lead">If you're writing about Klendar, here's what you need. For anything else: <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>

<h2>In two lines</h2>
<p>Klendar is a free app where neighbourhood businesses publish <strong>last-minute deals</strong> (with a countdown and limited places) and <strong>events</strong>, and people nearby see them and redeem them by showing a single-use QR code. There's no commission per redemption: what the venue charges, the venue keeps.</p>

<h2>In one paragraph</h2>
<p>A bar with empty tables mid-afternoon, a hairdresser with three free slots on Tuesday or a venue with unsold tickets all share a problem: telling someone two streets away, in time. Klendar (klendar.app) turns that gap into a publication with an expiry that only people nearby see. For businesses, it's a dashboard where they post in a minute and validate codes at the door; for everyone else, an honest list of what's on around them today, sorted by distance or by what starts soonest, with no ad profiling.</p>

<h2>Assets</h2>
<ul>
  <li><a href="/assets/icon-512.png">Icon (PNG 512)</a> · <a href="/assets/symbol.png">Symbol</a> · <a href="/assets/og.png">Social image</a></li>
  <li>Screenshots: <a href="/assets/screens/feed.webp?v=20261001">discover</a> · <a href="/assets/screens/detail.webp?v=20261001">detail</a> · <a href="/assets/screens/agenda.webp?v=20261001">agenda</a> · <a href="/assets/screens/map.webp?v=20261001">map</a></li>
  <li><a href="/assets/kit/klendar-guia-negocios.pdf">Business guide (PDF, Spanish)</a> · <a href="/assets/kit/klendar-cartel.pdf">Poster with QR (PDF)</a></li>
</ul>
<p class="note">The name is written <strong>Klendar</strong>, with a K. The brand colour is coral <code>#FF4D6D</code> on ink <code>#0A0A0A</code>. The logo can be used as it is, without stretching it or changing its colour.</p>

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
<p><strong>Parcialmente conforme</strong> con las WCAG 2.2 nivel AA. Klendar es una microempresa y la Ley 11/2023 no le obliga a publicar esta información, pero queremos contar qué hay hecho y qué falta. Última revisión: septiembre de 2026.</p>

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
<p>Escríbenos a <a href="mailto:info@klendar.app">info@klendar.app</a> contando qué pantalla es y con qué lo usas (móvil, lector de pantalla, navegador). Respondemos en un máximo de 20 días hábiles y, si podemos, lo arreglamos antes.</p>
<p>Si no te contestamos o no te convence la respuesta, puedes reclamar ante la autoridad competente en materia de accesibilidad.</p>
''',
    '''
<p class="lead">We want Klendar to work with a screen reader, with large text and without depending on colour. Here's what's done, what's missing and how to tell us when something doesn't work.</p>

<h2>Status</h2>
<p><strong>Partially compliant</strong> with WCAG 2.2 level AA. Klendar is a micro-enterprise and Spanish Law 11/2023 does not require it to publish this information, but we want to explain what has been done and what is still missing. Last reviewed: September 2026.</p>

<h2>What's already in place</h2>
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
  <li>The map isn't easy to use with a screen reader; the same information is in the list and the agenda, which are.</li>
  <li>Some videos uploaded by businesses have no captions, because adding them is up to the business that uploads them.</li>
</ul>

<h2>If something doesn't work for you</h2>
<p>Email <a href="mailto:info@klendar.app">info@klendar.app</a> and tell us which screen it is and what you use it with (phone, screen reader, browser). We reply within 20 working days at most and, if we can, fix it sooner.</p>
<p>If we don't reply, or you're not satisfied with the reply, you can complain to the competent accessibility authority.</p>
''',
)


# ── Estado del servicio ─────────────────────────────────────────────────────
PAGINAS['estado'] = (
    'status',
    'Estado del servicio', 'Service status',
    'Si Klendar no va, aquí están los sitios donde mirar y cómo avisarnos.',
    'If Klendar is down, here\'s where to look and how to tell us.',
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
<p class="lead">If the app or the website isn't working, it's almost always one of three things. You can check it yourself here.</p>

<h2>Where to look</h2>
<ul>
  <li><strong>Database and sign-in</strong> (accounts, deals, redemptions): <a href="https://status.supabase.com" rel="noopener" target="_blank">status.supabase.com</a>.</li>
  <li><strong>The website and links</strong> (klendar.app): <a href="https://www.cloudflarestatus.com" rel="noopener" target="_blank">cloudflarestatus.com</a>.</li>
  <li><strong>Notifications</strong>: <a href="https://status.firebase.google.com" rel="noopener" target="_blank">status.firebase.google.com</a>.</li>
</ul>

<h2>Maintenance</h2>
<p>When we touch something delicate, the app shows a message instead of half-failing. If you see it, it's on purpose and usually brief.</p>

<h2>If it still doesn't work</h2>
<p>Email <a href="mailto:info@klendar.app">info@klendar.app</a> and tell us what you were doing and where (phone or web). If it affects a lot of people, we'll say so here.</p>
<p class="note">We don't publish uptime figures yet: we'd rather not give a number we can't back up.</p>
''',
)


# ── Sobre Klendar ───────────────────────────────────────────────────────────
PAGINAS['sobre'] = (
    'about',
    'Sobre Klendar', 'About Klendar',
    'Por qué existe Klendar, cómo se gana dinero y qué no vamos a hacer.',
    'Why Klendar exists, how it makes money and what we won\'t do.',
    '''
<p class="lead">Klendar nació de una escena de todos los días: un bar medio vacío a las seis de la tarde y, a dos calles, alguien mirando el móvil sin saber qué hacer.</p>

<h2>Qué intentamos</h2>
<p>Que lo que pasa cerca de ti se entere quien está cerca de ti. Ni un buscador de cupones ni una red social más: una lista de lo que hay <strong>hoy</strong> a tu alrededor, con el tiempo que le queda y las plazas que quedan, y un negocio al otro lado que puede publicarla en un minuto.</p>

<h2>Cómo se gana dinero</h2>
<p>Con el plan de los negocios (<a href="/precios/">precios</a>), y solo con eso. <strong>No cobramos comisión por canje</strong>, no vendemos datos y no hay publicidad de terceros. Un negocio puede destacar una publicación, y cuando lo hace la app lo dice.</p>

<h2>Lo que no vamos a hacer</h2>
<ul>
  <li>Inventar urgencia: si quedan diez plazas, pone diez.</li>
  <li>Colar lo pagado sin decirlo: si un negocio paga por destacar algo, sale primero y con la etiqueta «Destacado». Lo demás lo ordenan tus filtros y, si lo dejas encendido, el tiempo que hace hoy.</li>
  <li>Perfilarte con datos de otras webs. Si cerca no hay nada, la app te sugiere cosas según tus últimas búsquedas, que se quedan en tu móvil.</li>
  <li>Pedirte más datos de los que hacen falta para que esto funcione.</li>
</ul>

<h2>Quién está detrás</h2>
<p>Un proyecto pequeño, hecho en España. Los datos del titular están en el <a href="/aviso-legal/">aviso legal</a>. Para cualquier cosa: <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>
''',
    '''
<p class="lead">Klendar started from an everyday scene: a half-empty bar at six in the afternoon and, two streets away, someone staring at their phone with nothing to do.</p>

<h2>What we're trying to do</h2>
<p>Make sure what's happening near you reaches the people who are near you. Not a coupon search engine, not another social network: a list of what's on <strong>today</strong> around you, with the time it has left and the places still free, and a business on the other side that can publish it in a minute.</p>

<h2>How it makes money</h2>
<p>From the business plan (<a href="/en/pricing/">pricing</a>), and only from that. <strong>We take no commission per redemption</strong>, we don't sell data and there's no third-party advertising. A business can feature a publication, and when it does, the app says so.</p>

<h2>What we won't do</h2>
<ul>
  <li>Invent urgency: if ten places are left, it says ten.</li>
  <li>Sneak in paid placements: if a business pays to feature something, it comes first and carries the “Featured” label. The rest is ordered by your filters and, if you leave it on, today's weather.</li>
  <li>Profile you with data from other sites. If there's nothing nearby, the app suggests things based on your recent searches, which stay on your phone.</li>
  <li>Ask you for more data than this needs to work.</li>
</ul>

<h2>Who's behind it</h2>
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

    # El centro de ayuda para la app (la descarga y la guarda; lleva una
    # copia dentro: `python tool/sync_help.py` en el repo de la app).
    import json
    io.open(os.path.join('assets', 'ayuda.json'), 'w', encoding='utf-8', newline='\n').write(
        json.dumps(ayuda.json_para_la_app(), ensure_ascii=False, indent=1) + '\n')
    print('ok assets/ayuda.json')

    # «Esta página no existe». Cloudflare sirve la 404.html más cercana a la
    # ruta pedida: /en/404.html para lo que empieza por /en/, y la de la raíz
    # para lo demás. Con la cabecera y el pie de siempre, y algo que hacer.
    # Centrada, como toda pantalla de error (`.vacio`, glosario de la app).
    NO_EXISTE = {
        'es': ('/', 'Esta página no existe', 'Puede que el enlace esté mal escrito o que la página se haya movido.',
               [('/explorar/', 'Ver qué hay cerca'), ('/', 'Ir a la portada')], '',
               '¿Buscabas algo concreto? Escríbenos desde <a href="/soporte/">soporte</a>.'),
        'en': ('/en/', 'This page doesn\'t exist', 'The link may be mistyped or the page may have moved.',
               [('/en/explore/', "See what's nearby"), ('/en/', 'Go to the home page')], 'en',
               'Looking for something in particular? Get in touch through <a href="/en/support/">support</a>.'),
    }
    for lang, (path, titulo, texto, botones, carpeta, pie) in NO_EXISTE.items():
        pills = ''.join(f'<a class="pill{" accent" if i == 0 else " ghost"}" href="{h}">{l}</a>' for i, (h, l) in enumerate(botones))
        pagina = head(T[lang], path, f'{titulo} · Klendar', texto, extra='<meta name="robots" content="noindex">') + f'''
<main class="doc" id="contenido">
<section class="vacio">
<h1>{titulo}</h1>
<p>{texto}</p>
<div class="vacio-botones">{pills}</div>
<p class="note">{pie}</p>
</section>
</main>
''' + footer(T[lang])
        io.open(os.path.join(carpeta, '404.html'), 'w', encoding='utf-8', newline=chr(10)).write(pagina)
        print('ok', os.path.join(carpeta, '404.html'))
