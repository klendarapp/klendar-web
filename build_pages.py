# Páginas de contenido de klendar.app (las que no son legales ni la portada):
# para negocios, precios, preguntas, prensa, accesibilidad, estado y sobre.
#
# En español y en inglés, cada una con su URL propia. Se generan igual que las
# legales (`build_legal.py`) para que compartan cabecera, pie y estilo.
#
# Ejecutar: python build_pages.py   (desde la raíz de klendar-web)
import io
import os

from build_site import REDES_HTML, T, doc_page, footer, head

# Precios reales de `subscription_plans` (Supabase). Si cambian allí, aquí.
PLANES = [
    # Un solo plan, después de la prueba gratis. Los límites por plan se
    # quitaron: castigaban justo lo que llena el mapa, que es publicar. El
    # precio de fundador se retiró el 2026-09-29 (el plan sigue en la base,
    # oculto, por si alguien lo tuviera).
    # Precios sin IVA y la cifra con IVA al lado (decisión de 2026-10-14:
    # plan único de 19,90 € + IVA con todo incluido).
    ('standard', 'Klendar', 'Klendar', '19,90 €', '€19.90',
     '24,08 € con IVA · o 199 € + IVA al año (dos meses gratis)',
     '€24.08 incl. VAT · or €199 + VAT a year (two months free)'),
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
  <li><strong>Sin permanencia.</strong> Cancelas cuando quieras: sigues hasta el final del periodo pagado y no se renueva.</li>
</ul>

<h2>Lo que cuesta</h2>
<p>Lo <strong>pruebas gratis</strong>: 30 días con todo al darte de alta, sin tarjeta. Después, un solo plan con todo incluido: 19,90 € + IVA al mes por local (24,08 € con IVA), sin límites, sin permanencia y sin comisión por canje. <a href="/precios/">Ver precios</a>.</p>
<p class="callout"><strong>En la provincia de Málaga: gratis hasta el 31 de marzo de 2027</strong> (te avisamos 7 días y 1 día antes).</p>

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
      + eur(margen) + ' de margen. El plan cuesta ' + eur(plan) + ' + IVA: lo pagas con '
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
<p>No vendemos tus datos ni los de tus clientes, no cobramos por canje y no ponemos tu oferta por delante de otra porque pagues más: <a href="/preguntas/">en la app el orden de serie es «Recomendado»</a> (el tiempo de hoy, lo más nuevo y los gustos de cada persona) y cada uno puede cambiarlo en los filtros («Más cerca», «Empieza antes» o «Lo más nuevo»); la cuota no cuenta. Hoy no se vende destacar publicaciones; si algún día se puede, <strong>se dirá</strong> en cada una.</p>

<h2>Empezar</h2>
<p>Estamos empezando, así que si en tu ciudad todavía no hay nadie, escríbenos y lo arrancamos contigo: <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>
<p class="acciones" style="margin-top:18px">
  <a class="pill accent" href="mailto:info@klendar.app?subject=Quiero%20dar%20de%20alta%20mi%20negocio">Escríbenos</a>
  <a class="pill ghost" href="/panel/">Entrar al panel</a>
  <a class="pill ghost" href="/precios/">Ver precios</a>
</p>
<p>¿Eres un ayuntamiento, una junta de distrito, una asociación o una ONG? Para ti Klendar es gratis para siempre: <a href="/para-entidades/">Klendar para ayuntamientos y asociaciones</a>.</p>
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
  <li><strong>No lock-in.</strong> Cancel whenever you like: you keep everything until the end of the period you've paid for and it doesn't renew.</li>
</ul>

<h2>What it costs</h2>
<p>You <strong>try it free</strong>: 30 days with everything when you register, no card. After that, one plan with everything included: €19.90 + VAT a month per venue (€24.08 incl. VAT), with no limits, no lock-in and no commission per redemption. <a href="/en/pricing/">See pricing</a>.</p>
<p class="callout"><strong>In the province of Málaga: free until 31 March 2027</strong> (we remind you 7 days and 1 day before).</p>

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
      + eur(margen) + ' in margin. The plan costs ' + eur(plan) + ' + VAT: '
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
<p>We don't sell your data or your customers' data, we don't charge per redemption, and we don't put your offer ahead of another because you pay more: <a href="/en/faq/">in the app the default order is “Recommended”</a> (today's weather, what's newest and each person's interests) and anyone can change it in the filters (“Nearest”, “Starts soonest” or “Newest”); your plan doesn't count. Featuring publications isn't sold today; if it ever is, each one <strong>will say so</strong>.</p>

<h2>Getting started</h2>
<p>We're just getting started, so if nobody in your city is on Klendar yet, email us and we'll get it going with you: <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>
<p class="acciones" style="margin-top:18px">
  <a class="pill accent" href="mailto:info@klendar.app?subject=I%20want%20to%20register%20my%20business">Email us</a>
  <a class="pill ghost" href="/panel/">Go to the dashboard</a>
  <a class="pill ghost" href="/en/pricing/">See pricing</a>
</p>
<p>Are you a council, a district council, an association or an NGO? For you, Klendar is free for good: <a href="/en/for-organisations/">Klendar for councils and associations</a>.</p>
<p class="note">Kit for your venue (Spanish): <a href="/assets/kit/klendar-guia-negocios.pdf">one-page guide (PDF)</a> · <a href="/assets/kit/klendar-cartel.pdf">poster with QR (PDF)</a>. The legal part is in the <a href="/en/business-terms/">business terms</a>.</p>
''',
)


# ── Para ayuntamientos y asociaciones ───────────────────────────────────────
# Las cuentas de entidad (migraciones 20261130100000 y 20261219100000 de la
# app) y «Conecta tu agenda» (20261260100400). Gratis para siempre: decisión de
# Iván del 3–4-11-2026. «Conecta tu agenda» está tras el interruptor
# `app_config.entity_calendar.enabled` hasta que se aprueben sus textos legales
# (docs/LEGAL_PENDIENTE_2026-10.md, «EN»): mientras, aquí sale como «Muy
# pronto». El día que se encienda en prod, AGENDA_CONECTADA = True y
# `python build_pages.py`.
AGENDA_CONECTADA = False

_PRONTO = {
    'es': '' if AGENDA_CONECTADA else ' <span style="display:inline-block;vertical-align:middle;margin-left:6px;padding:3px 9px;border-radius:999px;background:var(--soft);color:var(--ink);font-weight:800;font-size:12px">Muy pronto</span>',
    'en': '' if AGENDA_CONECTADA else ' <span style="display:inline-block;vertical-align:middle;margin-left:6px;padding:3px 9px;border-radius:999px;background:var(--soft);color:var(--ink);font-weight:800;font-size:12px">Coming soon</span>',
}
_AGENDA_DONDE = {
    'es': ('En «Mi negocio › Más herramientas › Conecta tu agenda», en la app o en el <a href="/panel/">panel web</a>.'
           if AGENDA_CONECTADA else
           'Estará en «Mi negocio › Más herramientas › Conecta tu agenda», en la app y en el panel web. Mientras tanto, tus eventos se publican a mano en un minuto.'),
    'en': ('In “My business › More tools › Connect your calendar”, in the app or on the <a href="/panel/">web dashboard</a>.'
           if AGENDA_CONECTADA else
           "It will be in “My business › More tools › Connect your calendar”, in the app and on the web dashboard. Until then, you can publish your events by hand in a minute."),
}

PAGINAS['para-entidades'] = (
    'for-organisations',
    'Klendar para ayuntamientos y asociaciones', 'Klendar for councils and associations',
    'Ayuntamientos, juntas de distrito, asociaciones y ONG publican sus actividades en Klendar y las ve la gente de alrededor. Gratis para siempre.',
    'Councils, district councils, associations and NGOs publish their activities on Klendar and people nearby see them. Free, for good.',
    f'''
<p class="lead">La fiesta del barrio, el mercadillo solidario, la campaña de comercio local o el taller de la biblioteca: Klendar los enseña a quien está cerca y busca qué hacer. Para un ayuntamiento, una junta de distrito, una asociación o una ONG es <strong>gratis para siempre</strong>.</p>

<h2>Qué es Klendar para una entidad</h2>
<ul>
  <li><strong>Tus actividades, donde la gente mira.</strong> Lo que publicas sale en Descubre, en Explorar, en el mapa y en la agenda de tu ciudad, y en la ficha de tu entidad. Hay un filtro, «Agenda pública», para ver solo lo de ayuntamientos, asociaciones y ONG.</li>
  <li><strong>Con tu sello.</strong> Tu ficha y tus publicaciones llevan el sello de tu tipo de entidad (Ayuntamiento, Junta de distrito, Asociación de comerciantes, Asociación vecinal, ONG o Entidad), para que se sepa quién lo organiza.</li>
  <li><strong>Avisos sin agobiar.</strong> Quien te tiene en favoritos recibe un aviso de lo nuevo que publicas, como mucho uno al día.</li>
  <li><strong>Lo que se repite, solo.</strong> En «Series y repeticiones», el mercadillo de cada domingo o el taller de los martes se publican solos.</li>
  <li><strong>Tu equipo y tus cifras.</strong> Puedes dar acceso a otras personas de la entidad y ver cuánta gente ve cada publicación.</li>
</ul>

<h2>Gratis para siempre</h2>
<p>Las entidades no pagan cuota: ni prueba que se acabe, ni plan, ni comisión. Hoy no ven nada de pago para los negocios y, si algún día hubiera funciones nuevas de pago, serían opcionales. Klendar se paga con el plan de los negocios.</p>

<h2>Cómo darte de alta</h2>
<ol>
  <li>En la app o en el <a href="/panel/">panel web</a>, al empezar el alta elige <strong>«Un ayuntamiento, asociación u ONG»</strong>.</li>
  <li>Cuéntanos qué entidad es: el tipo, su nombre oficial, su CIF, su web oficial y su zona (el punto en el mapa y el municipio).</li>
  <li>Dinos quién la da de alta (tu nombre y tu cargo) y sube un <strong>documento que lo acredite</strong>: tu nombramiento, un certificado de la secretaría, el acta de la junta o la inscripción en el registro de asociaciones, por ejemplo.</li>
  <li>Lo comprobamos y te avisamos. Hasta entonces la entidad no publica. El documento solo lo ve el equipo de Klendar y se borra a los 6 meses de decidir.</li>
</ol>
<p>¿Ya estás en Klendar como negocio? Pídelo desde tu ficha: «Tu ficha › Cuenta de entidad».</p>

<h2>Qué puedes publicar</h2>
<p>Lo mismo que un negocio: <strong>eventos</strong> con fecha (con reserva de plaza si la quieres) y <strong>novedades</strong> en tu ficha. Solo actividades abiertas al público o de interés para el barrio o la ciudad: fiestas, mercadillos, campañas de comercio local, actividades culturales, deportivas o solidarias. No vale la propaganda electoral ni de partido, ni la publicidad institucional que destaque logros de gestión en periodo electoral. Todo pasa por las mismas <a href="/normas/">normas de la comunidad</a> que cualquier publicación.</p>

<h2>Conecta tu agenda{_PRONTO['es']}</h2>
<p>Si tu entidad ya tiene un calendario en su web (Google Calendar, Outlook, la agenda de WordPress…), no hace falta escribir cada evento dos veces: pegas la dirección iCal o ICS del calendario y sus eventos entran solos en Klendar una vez al día.</p>
<ul>
  <li><strong>Lo que cambias allí, cambia aquí.</strong> Si un evento se mueve o se borra en tu calendario, se mueve o se borra en Klendar.</li>
  <li><strong>Lo que tocas en Klendar, se respeta.</strong> Si editas un evento en Klendar, deja de actualizarse desde el calendario; si lo borras, no vuelve.</li>
  <li><strong>Solo lo que viene.</strong> Los eventos de los próximos 90 días (hasta 300 por agenda). Lo que se repite entra una vez, con su próxima fecha. Los privados y los cancelados no entran.</li>
  <li><strong>Sin lugar, en tu dirección.</strong> Un evento sin lugar sale en la dirección de la entidad. Uno con un lugar que no sabemos situar en el mapa entra como borrador para que lo sitúes tú.</li>
  <li><strong>Con las mismas normas.</strong> Lo que entra sigue las mismas normas que lo que publicas a mano.</li>
</ul>
<p>{_AGENDA_DONDE['es']}</p>

<h2>Empezar</h2>
<p class="acciones" style="margin-top:18px">
  <a class="pill accent" href="/panel/#/alta/entidad/1">Dar de alta una entidad</a>
  <a class="pill ghost" href="mailto:info@klendar.app?subject=Klendar%20para%20mi%20entidad">Escríbenos</a>
</p>
<p class="note">Lo legal, en las <a href="/negocios/">condiciones para negocios</a> (apartado 3 bis, «Cuentas de entidad»). ¿Eres un negocio? Mira <a href="/para-negocios/">Klendar para negocios</a>.</p>
''',
    f'''
<p class="lead">The neighbourhood festival, the charity market, the local shopping campaign or the library workshop: Klendar shows them to people nearby who are looking for something to do. For a council, a district council, an association or an NGO it is <strong>free, for good</strong>.</p>

<h2>What Klendar is for an organisation</h2>
<ul>
  <li><strong>Your activities, where people look.</strong> What you publish shows in Discover, Explore, the map and your city's agenda, and on your organisation's page. There's a “Public listings” filter to see only what councils, associations and NGOs publish.</li>
  <li><strong>With your badge.</strong> Your page and your publications carry the badge for your type of organisation (Council, District council, Traders' association, Residents' association, NGO or Organisation), so people know who's behind it.</li>
  <li><strong>Notifications without overdoing it.</strong> People who have you in their favourites get a notification about what you publish, one a day at most.</li>
  <li><strong>Repeats, on their own.</strong> In “Series and repeats”, the Sunday market or the Tuesday workshop publish themselves.</li>
  <li><strong>Your team and your numbers.</strong> You can give other people at the organisation access and see how many people view each publication.</li>
</ul>

<h2>Free, for good</h2>
<p>Organisations don't pay a fee: no trial that runs out, no plan, no commission. Today they don't see anything that's paid for businesses and, if paid features are ever added, they will be optional. Klendar is paid for by the business plan.</p>

<h2>How to register</h2>
<ol>
  <li>In the app or on the <a href="/panel/">web dashboard</a>, when you start registering choose <strong>“A council, association or NGO”</strong>.</li>
  <li>Tell us which organisation it is: its type, official name, tax ID (CIF), official website and area (the point on the map and the town).</li>
  <li>Tell us who is registering it (your name and your role) and upload a <strong>supporting document</strong>: your appointment, a certificate from the secretary, the board minutes or the entry in the register of associations, for example.</li>
  <li>We check it and let you know. Until then the organisation can't publish. Only the Klendar team sees the document, and it's deleted 6 months after we decide.</li>
</ol>
<p>Already on Klendar as a business? Ask for it from your page: “Your page › Organisation account”.</p>

<h2>What you can publish</h2>
<p>The same as a business: <strong>events</strong> with a date (with place booking if you want it) and <strong>updates</strong> on your page. Only activities open to the public or of interest to the neighbourhood or city: festivities, street markets, local shopping campaigns, cultural, sports or charity activities. No electoral or party propaganda, and no institutional advertising highlighting achievements in office during election periods. Everything follows the same <a href="/en/community-guidelines/">community guidelines</a> as any publication.</p>

<h2>Connect your calendar{_PRONTO['en']}</h2>
<p>If your organisation already has a calendar on its website (Google Calendar, Outlook, a WordPress events calendar…), there's no need to type every event twice: you paste the calendar's iCal or ICS address and its events come into Klendar on their own once a day.</p>
<ul>
  <li><strong>What you change there changes here.</strong> If an event moves or is deleted in your calendar, it moves or is deleted on Klendar.</li>
  <li><strong>What you touch on Klendar is respected.</strong> If you edit an event on Klendar, it stops updating from the calendar; if you delete it, it doesn't come back.</li>
  <li><strong>Only what's coming up.</strong> Events in the next 90 days (up to 300 per calendar). Repeating events come in once, with their next date. Private and cancelled ones don't come in.</li>
  <li><strong>No place, your address.</strong> An event without a place shows at the organisation's address. One with a place we can't put on the map comes in as a draft for you to place.</li>
  <li><strong>Same rules.</strong> What comes in follows the same rules as what you publish by hand.</li>
</ul>
<p>{_AGENDA_DONDE['en']}</p>

<h2>Getting started</h2>
<p class="acciones" style="margin-top:18px">
  <a class="pill accent" href="/panel/?lang=en#/alta/entidad/1">Register an organisation</a>
  <a class="pill ghost" href="mailto:info@klendar.app?subject=Klendar%20for%20my%20organisation">Email us</a>
</p>
<p class="note">The legal part is in the <a href="/en/business-terms/">business terms</a> (section 3a, “Organisation accounts”). Are you a business? See <a href="/en/for-business/">Klendar for businesses</a>.</p>
''',
)


def tabla_planes(lang):
    es = lang == 'es'
    ventajas_es = [
        'Publicaciones sin límite: ofertas flash, eventos y reservas',
        'Canjes sin límite y <strong>sin comisión</strong>',
        'Estadísticas, informe exportable y lista de asistentes',
        'Ficha del negocio, galería y panel para tu equipo',
        'Sin permanencia: cancelas cuando quieras',
    ]
    ventajas_en = [
        'Unlimited publications: flash offers, events and place reservations',
        'Unlimited redemptions and <strong>no commission</strong>',
        'Stats, exportable report and attendee list',
        'Business page, gallery and a dashboard for your team',
        'No lock-in: cancel whenever you like',
    ]
    # Primero la prueba (no es un plan: es cómo se empieza) y luego el plan.
    prueba = [
        'Todo lo del plan, sin límites', 'Te avisamos 7 días y 1 día antes de que acabe',
        'Si no eliges cómo pagar, tu negocio puede bloquearse (no se borra nada)',
    ] if es else [
        'Everything in the plan, no limits', 'We remind you 7 days and 1 day before it ends',
        'If you don\'t choose how to pay, your business may be blocked (nothing is deleted)',
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
      <p class="price"><b>{precio}</b><span>{'+ IVA/mes' if es else '+ VAT/month'}</span></p>
      <p class="note">{extra}</p>
      <ul>
        {''.join(f'<li>{p}</li>' for p in puntos)}
      </ul>
    </div>''')
    return '<div class="plans">' + ''.join(filas) + '\n  </div>'


PAGINAS['precios'] = (
    'pricing',
    'Precios', 'Pricing',
    'Pruébalo gratis y, después, un solo plan con todo: 19,90 € + IVA al mes por local (menos por local si tienes varios). '
    'Sin comisiones por canje y sin permanencia.',
    'Try it free, then one plan with everything: €19.90 + VAT a month per venue (less per venue if you have several). '
    'No commission per redemption and no lock-in.',
    f'''
<p class="lead">Un solo plan con todo incluido, sin límites y sin comisiones por canje. Lo que cobras en tu local es tuyo entero.</p>
<p class="callout"><strong>Gratis de lanzamiento.</strong> Mientras Klendar arranca en una provincia, podemos dar a los negocios de esa provincia más tiempo gratis: un mapa vacío no le sirve ni a los negocios ni a la gente. El día en que termina te lo decimos con al menos un mes de antelación, y te lo recordamos 7 días y 1 día antes.</p>
<p class="callout"><strong>En la provincia de Málaga: gratis hasta el 31 de marzo de 2027</strong> (te avisamos 7 días y 1 día antes).</p>
{tabla_planes('es')}
<p class="note">Precio por local, IVA no incluido: 19,90 € + 21 % de IVA son 24,08 € al mes.</p>
<p>¿Ayuntamiento, asociación u ONG? <a href="/para-entidades/">Gratis para siempre</a>.</p>

<h2>¿Varios locales?</h2>
<p>El precio es <strong>por local</strong>, porque cada uno tiene su público, sus códigos y sus números. El primero paga el precio entero y, a partir del segundo, cada local más paga menos:</p>
<table class="tiers">
  <tr><td>El&nbsp;primer&nbsp;local</td><td style="padding-left:14px"><b>19,90 €</b> al mes</td></tr>
  <tr><td>Del&nbsp;2.º&nbsp;al&nbsp;5.º</td><td style="padding-left:14px"><b>15 €</b> al mes cada uno</td></tr>
  <tr><td>Desde&nbsp;el&nbsp;6.º</td><td style="padding-left:14px"><b>12 €</b> al mes cada uno, con una persona de contacto</td></tr>
</table>
<p class="note">Todo + IVA. Por ejemplo, con 3 locales pagas 19,90 + 15 + 15 = 49,90 € + IVA al mes; con 6, 19,90 + 4 × 15 + 12 = 91,90 € + IVA.</p>
<p><strong>Publicar en varios locales a la vez va incluido.</strong> Escribes la oferta una vez, marcas en qué locales la quieres y cada uno recibe la suya, con su dirección y su propio código; las cifras las ves por separado y sumadas. No cobramos aparte por ahorrarte el trabajo de escribirlo tres veces.</p>

<h2>La letra pequeña</h2>
<ul>
  <li><strong>Prueba.</strong> Al dar de alta el negocio tienes 30 días con todo, sin tarjeta y sin que se renueve solo.</li>
  <li><strong>Cómo se paga.</strong> Mientras no tengamos pago con tarjeta, por transferencia: escribes a <a href="mailto:info@klendar.app">info@klendar.app</a> y lo dejamos activado. En Canarias, Ceuta y Melilla, sin IVA.</li>
  <li><strong>Si no pagas</strong>, tu negocio <strong>puede bloquearse</strong> hasta que pagues: no se borra nada y puedes seguir validando lo que ya tiene la gente. Si va a pasar, te avisamos 7 días y 1 día antes (apartado 4 bis de las <a href="/negocios/">condiciones</a>).</li>
  <li><strong>Pausa por cierre.</strong> Hasta 6 meses sin pagar; lo que ya tenías pagado se guarda para cuando vuelvas. Mientras, tu negocio está parado.</li>
  <li><strong>Cancela cuando quieras:</strong> sigues hasta el final del periodo pagado y no se renueva. Sin permanencia ni penalización; desde el panel («Dar de baja el negocio») o en el mismo correo.</li>
  <li><strong>Nunca cobramos por canje.</strong> Ni porcentaje ni euros por código: si te funciona bien, pagas lo mismo.</li>
  <li><strong>Hoy nadie puede pagar por salir antes.</strong> De serie, el orden es «Recomendado» (con el tiempo de hoy y los gustos de cada persona) y cada persona puede cambiarlo en los filtros; cómo se ordena todo, también lo ya visto, está en el apartado 2 bis de las <a href="/negocios/">condiciones</a>. Ni la cuota ni el número de publicaciones cuentan en el orden.</li>
</ul>

<h2>¿Y para quien usa la app?</h2>
<p>Gratis, y sin cuenta para mirar. Solo hace falta crear una cuenta para canjear, guardar planes o recibir avisos.</p>
<p style="margin-top:18px"><a class="pill accent" href="mailto:info@klendar.app?subject=Plan%20de%20Klendar">Preguntar por el plan</a> <a class="pill ghost" href="/para-negocios/">Cómo funciona</a></p>
''',
    f'''
<p class="lead">One plan with everything included, no limits and no commission per redemption. What you charge at your venue is yours.</p>
<p class="callout"><strong>Launch, free.</strong> While Klendar is starting in a province, we may give businesses in that province more free time: an empty map is no use to businesses or to people. We tell you the day it ends at least a month in advance, and remind you 7 days and 1 day before.</p>
<p class="callout"><strong>In the province of Málaga: free until 31 March 2027</strong> (we remind you 7 days and 1 day before).</p>
{tabla_planes('en')}
<p class="note">Price per venue, VAT not included: €19.90 + 21% VAT comes to €24.08 a month.</p>
<p>Council, association or NGO? <a href="/en/for-organisations/">Free, for good</a>.</p>

<h2>Several venues?</h2>
<p>The price is <strong>per venue</strong>, because each one has its own audience, its own codes and its own numbers. The first venue pays the full price and, from the second one on, each extra venue pays less:</p>
<table class="tiers">
  <tr><td>Your&nbsp;first&nbsp;venue</td><td style="padding-left:14px"><b>€19.90</b> a month</td></tr>
  <tr><td>2nd&nbsp;to&nbsp;5th</td><td style="padding-left:14px"><b>€15</b> a month each</td></tr>
  <tr><td>6th&nbsp;onwards</td><td style="padding-left:14px"><b>€12</b> a month each, with a dedicated contact</td></tr>
</table>
<p class="note">All + VAT. For example, with 3 venues you pay 19.90 + 15 + 15 = €49.90 + VAT a month; with 6, 19.90 + 4 × 15 + 12 = €91.90 + VAT.</p>
<p><strong>Publishing to several venues at once is included.</strong> You write the offer once, tick the venues you want and each one gets its own, with its own address and its own code; you see the numbers per venue and added up. We don't charge extra for saving you from typing it three times.</p>

<h2>The small print</h2>
<ul>
  <li><strong>Trial.</strong> When you register your business you get 30 days with everything, no card and no automatic renewal.</li>
  <li><strong>How you pay.</strong> Until we have card payments, by bank transfer: email <a href="mailto:info@klendar.app">info@klendar.app</a> and we'll activate it. In the Canary Islands, Ceuta and Melilla, no VAT.</li>
  <li><strong>If you don't pay</strong>, your business <strong>may be blocked</strong> until you do: nothing is deleted and you can still validate what people already have. If it's going to happen, we remind you 7 days and 1 day before (section 4a of the <a href="/en/business-terms/">business terms</a>).</li>
  <li><strong>Seasonal pause.</strong> Up to 6 months without paying; what you'd already paid for is kept for when you come back. Meanwhile, your business is stopped.</li>
  <li><strong>Cancel whenever you like:</strong> you keep everything until the end of the period you've paid for and it doesn't renew. No lock-in, no penalty; from the dashboard (“Leave Klendar”) or at the same address.</li>
  <li><strong>We never charge per redemption.</strong> No percentage, no euros per code: if it works well for you, you pay the same.</li>
  <li><strong>Today nobody can pay to appear earlier.</strong> By default the order is ‘Recommended’ (with today's weather and each person's interests) and anyone can change it in the filters; how everything is ordered, including what someone has already seen, is in section 2a of the <a href="/en/business-terms/">business terms</a>. Neither the fee nor the number of publications affects the order.</li>
</ul>

<h2>And for people using the app?</h2>
<p>Free, and no account needed to browse. You only sign up to redeem, save plans or get alerts.</p>
<p style="margin-top:18px"><a class="pill accent" href="mailto:info@klendar.app?subject=Klendar%20plan">Ask about the plan</a> <a class="pill ghost" href="/en/for-business/">How it works</a></p>
''',
)


# ── Preguntas frecuentes (centro de ayuda) ───────────────────────────────────
# El contenido vive en `ayuda.py` (una sola fuente para esta página, Soporte y
# la app, que se descarga `assets/ayuda.json`). Aquí solo se pinta: pestañas
# «Para ti» / «Para negocios» y buscador (`assets/ayuda.js`, `assets/ayuda.css`).
import ayuda  # noqa: E402

AYUDA_V = 1  # ?v= de assets/ayuda.js y ayuda.css
ASISTENTE_V = 2  # ?v= de assets/asistente.js y asistente.css (apagado no sale nada; RUNBOOK §4zi de la app)

AYUDA_T = {
    'es': dict(lead='Lo que más nos preguntan, para quien busca planes y para los negocios.',
               buscar='Buscar en la ayuda', ph='Buscar: código, reserva, calendario…',
               pestanas='Preguntas frecuentes', nada_h='¿No lo encuentras?',
               nada_p='Escríbenos y te respondemos en 2 días laborables como mucho. Si es algo que se pregunta a menudo, lo añadimos aquí.',
               boton='Escríbenos', sugerencias='/cuenta/sugerencias',
               correo='O por correo a <a href="mailto:info@klendar.app">info@klendar.app</a> · <a href="/soporte/">Soporte</a>'),
    'en': dict(lead='What we get asked most, for people looking for plans and for businesses.',
               buscar='Search help', ph='Search: code, reservation, calendar…',
               pestanas='Frequently asked questions', nada_h="Can't find it?",
               nada_p="Write to us and we'll reply within 2 working days at most. If it's something people often ask, we'll add it here.",
               boton='Write to us', sugerencias='/cuenta/sugerencias?lang=en',
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
<link rel="stylesheet" href="/assets/asistente.css?v={ASISTENTE_V}">
<p class="lead">{t['lead']}</p>
<div data-asistente hidden></div>
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
<script src="/assets/asistente.js?v={ASISTENTE_V}" defer></script>
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
  <li>Capturas: <a href="/assets/screens/feed.webp?v=20261106">descubrir</a> · <a href="/assets/screens/detail.webp?v=20261106">ficha</a> · <a href="/assets/screens/agenda.webp?v=20261106">agenda</a> · <a href="/assets/screens/map.webp?v=20261106">mapa</a></li>
  <li><a href="/assets/kit/klendar-guia-negocios.pdf">Guía para negocios (PDF)</a> · <a href="/assets/kit/klendar-cartel.pdf">Cartel con QR (PDF)</a></li>
</ul>
<p class="note">El nombre se escribe <strong>Klendar</strong>, con K y sin acentos. El color de marca es el coral <code>#FF4D6D</code> sobre fondo tinta <code>#0A0A0A</code>. Se puede usar el logotipo tal cual, sin deformarlo ni cambiarle el color.</p>

<h2>Redes</h2>
<p>Lo que publicamos y las novedades de Klendar:</p>
<p class="prensa-redes" style="display:flex;flex-wrap:wrap;gap:4px 18px">''' + REDES_HTML['es'] + '''</p>

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
  <li>Screenshots: <a href="/assets/screens/feed.webp?v=20261106">discover</a> · <a href="/assets/screens/detail.webp?v=20261106">detail</a> · <a href="/assets/screens/agenda.webp?v=20261106">agenda</a> · <a href="/assets/screens/map.webp?v=20261106">map</a></li>
  <li><a href="/assets/kit/klendar-guia-negocios.pdf">Business guide (PDF, Spanish)</a> · <a href="/assets/kit/klendar-cartel.pdf">Poster with QR (PDF)</a></li>
</ul>
<p class="note">The name is written <strong>Klendar</strong>, with a K. The brand colour is coral <code>#FF4D6D</code> on ink <code>#0A0A0A</code>. The logo can be used as it is, without stretching it or changing its colour.</p>

<h2>Social media</h2>
<p>What we post and Klendar's news:</p>
<p class="prensa-redes" style="display:flex;flex-wrap:wrap;gap:4px 18px">''' + REDES_HTML['en'] + '''</p>

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
<p>Con el plan de los negocios (<a href="/precios/">precios</a>), y solo con eso. <strong>No cobramos comisión por canje</strong>, no vendemos datos y no hay publicidad de terceros. Hoy nadie puede pagar por salir antes.</p>

<h2>Lo que no vamos a hacer</h2>
<ul>
  <li>Inventar urgencia: si quedan diez plazas, pone diez.</li>
  <li>Colar lo pagado sin decirlo: hoy nadie puede pagar por salir antes y, si algún día se puede, se dirá en cada publicación. El orden no depende de pagar: lo marcan tus filtros, tus gustos si los eliges y, si lo dejas encendido, el tiempo que hace hoy.</li>
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
<p>From the business plan (<a href="/en/pricing/">pricing</a>), and only from that. <strong>We take no commission per redemption</strong>, we don't sell data and there's no third-party advertising. Today nobody can pay to appear earlier.</p>

<h2>What we won't do</h2>
<ul>
  <li>Invent urgency: if ten places are left, it says ten.</li>
  <li>Sneak in paid placements: today nobody can pay to appear earlier and, if that ever changes, each publication will say so. The order doesn't depend on paying: it comes from your filters, your interests if you choose them and, if you leave it on, today's weather.</li>
  <li>Profile you with data from other sites. If there's nothing nearby, the app suggests things based on your recent searches, which stay on your phone.</li>
  <li>Ask you for more data than this needs to work.</li>
</ul>

<h2>Who's behind it</h2>
<p>A small project, made in Spain. The owner's details are in the <a href="/en/legal-notice/">legal notice</a>. For anything at all: <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>
''',
)


# ── Fuentes y licencias ─────────────────────────────────────────────────────
# Los datos de otros que enseña Klendar y lo que pide cada licencia. La agenda
# pública importada de datos abiertos (tabla `public_agenda_sources` y Edge
# Function `agenda-import` del repo de la app): la misma atribución sale en la
# ficha de cada evento importado. Al añadir una fuente, añadirla aquí.
FUENTES_AGENDA = [
    # (ciudad, quién, conjunto, url del conjunto, licencia ES, licencia EN, url de la licencia, cita ES, cita EN)
    ('Madrid', 'Ayuntamiento de Madrid',
     'Actividades culturales y de ocio municipal en los próximos 100 días',
     'https://datos.madrid.es/dataset/206974-0-agenda-eventos-culturales-100',
     'CC BY 4.0', 'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/deed.es',
     'Fuente: Ayuntamiento de Madrid, datos.madrid.es', 'Source: Madrid City Council, datos.madrid.es'),
    ('Zaragoza', 'Ayuntamiento de Zaragoza', 'Agenda de Zaragoza',
     'https://www.zaragoza.es/sede/portal/datos-abiertos/servicio/catalogo/282',
     'Condiciones generales de reutilización del Ayuntamiento de Zaragoza',
     'Zaragoza City Council general reuse conditions',
     'https://www.zaragoza.es/sede/portal/aviso-legal#condiciones',
     'Origen de los datos: Ayuntamiento de Zaragoza', 'Data source: Zaragoza City Council'),
]


def _filas_fuentes(en):
    out = []
    for ciudad, quien, conjunto, url, lic_es, lic_en, lic_url, cita_es, cita_en in FUENTES_AGENDA:
        out.append(
            f'<tr><td>{ciudad}</td><td>{quien}<br><a href="{url}" rel="noopener" target="_blank">{conjunto}</a></td>'
            f'<td><a href="{lic_url}" rel="license noopener" target="_blank">{lic_en if en else lic_es}</a></td>'
            f'<td>«{cita_en if en else cita_es}»</td></tr>')
    return ''.join(out)


PAGINAS['fuentes'] = (
    'sources',
    'Fuentes y licencias', 'Sources and licences',
    'De dónde salen los datos de otros que enseña Klendar (la agenda pública de cada ciudad, los partidos, el tiempo, los festivos, los mapas y los municipios) y con qué licencia.',
    "Where the third-party data on Klendar comes from (each city's public listings, matches, the weather, public holidays, maps and towns) and under which licence.",
    f'''
<p class="lead">Casi todo lo que ves en Klendar lo publican los negocios y las entidades. Además, en algunas ciudades enseñamos la agenda municipal, que los ayuntamientos publican como datos abiertos; usamos los horarios de los partidos de un servicio externo y la previsión del tiempo de un servicio público, y la lista de festivos sale de los boletines oficiales. Aquí está de dónde sale cada cosa y con qué licencia.</p>

<h2>Agenda pública de cada ciudad</h2>
<p>Cada día importamos la agenda cultural y de ocio de estas fuentes y la publicamos en la cuenta «Agenda pública de &lt;ciudad&gt;» (o en la del ayuntamiento, si está en Klendar). Klendar no organiza esos eventos: adaptamos las fechas al formato de la app, elegimos una categoría, recortamos los textos largos y, como las fuentes no traen fotos con licencia clara, usamos una imagen genérica de la categoría. En la ficha de cada evento sale su fuente, su licencia, la fecha de actualización y el enlace al original. Que un ayuntamiento publique sus datos abiertos no quiere decir que participe en Klendar ni que lo patrocine.</p>
<table>
<thead><tr><th>Ciudad</th><th>Quién y qué</th><th>Licencia</th><th>Cómo se cita</th></tr></thead>
<tbody>{_filas_fuentes(False)}</tbody>
</table>
<p>Si un evento está mal, ha cambiado o se ha cancelado, manda la fuente: Klendar lo actualiza al día siguiente. Para pedirnos que quitemos algo o una fuente entera, escríbenos a <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>

<h2>Partidos y eventos televisados</h2>
<p>Los partidos y eventos de <strong>todos los deportes</strong> (fútbol, baloncesto, Fórmula 1, MotoGP, balonmano, UFC…) y sus horarios vienen de <strong>TheSportsDB</strong> (<a href="https://www.thesportsdb.com/" rel="noopener" target="_blank">thesportsdb.com</a>), con su plan de pago, que permite usarlos citándoles como fuente: «Datos deportivos: TheSportsDB». Lo que no llega solo (las finales de tenis, Eurovisión…) lo añade Klendar a mano, y cada bar puede añadir lo que pone. No usamos sus imágenes ni enseñamos el canal de televisión: lo que importa es si el bar lo pone. Los horarios pueden cambiar: confírmalos con el bar.</p>

<h2>El tiempo</h2>
<p>«Según el tiempo» usa la previsión de <a href="https://api.met.no/" rel="noopener" target="_blank">MET Norway</a> (Instituto Meteorológico de Noruega), con licencia <a href="https://creativecommons.org/licenses/by/4.0/deed.es" rel="license noopener" target="_blank">CC BY 4.0</a>.</p>

<h2>Festivos</h2>
<p>Con la lista de festivos preguntamos a los negocios si abren. La importamos cada lunes de octubre a enero de estas fuentes oficiales y una persona de Klendar la revisa antes de usarla; de cada festivo guardamos de qué fuente sale. Adaptamos los datos al formato de la app (día, nombre y municipio). Ninguno de estos organismos participa en Klendar ni lo patrocina.</p>
<table>
<thead><tr><th>Qué</th><th>Quién y qué</th><th>Licencia y cita</th></tr></thead>
<tbody>
<tr><td>Nacionales y de cada comunidad</td><td>Agencia Estatal Boletín Oficial del Estado: resolución anual de la Dirección General de Trabajo con las fiestas laborales (<a href="https://www.boe.es/" rel="noopener" target="_blank">www.boe.es</a>, datos abiertos)</td><td><a href="https://www.boe.es/informacion/aviso_legal/index.php" rel="license noopener" target="_blank">Condiciones de reutilización del BOE</a>: «Basado en datos de la Agencia Estatal Boletín Oficial del Estado»</td></tr>
<tr><td>Locales de Madrid</td><td>Ayuntamiento de Madrid, <a href="https://datos.madrid.es/dataset/300082-0-calendario_laboral" rel="noopener" target="_blank">Calendario laboral</a></td><td><a href="https://creativecommons.org/licenses/by/4.0/deed.es" rel="license noopener" target="_blank">CC BY 4.0</a>: «Fuente: Ayuntamiento de Madrid, datos.madrid.es»</td></tr>
<tr><td>Locales de Cataluña</td><td>Generalitat de Catalunya, <a href="https://analisi.transparenciacatalunya.cat/d/b4eh-r8up" rel="noopener" target="_blank">Calendari de festes locals a Catalunya</a></td><td><a href="https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies" rel="license noopener" target="_blank">Llicència oberta d’ús d’informació – Catalunya</a>: «Generalitat de Catalunya. Departament d’Empresa i Treball»</td></tr>
<tr><td>Locales de Andalucía</td><td>Junta de Andalucía (Consejería de Empleo), <a href="https://www.juntadeandalucia.es/datosabiertos/portal.html" rel="noopener" target="_blank">Calendario de días festivos</a></td><td><a href="https://creativecommons.org/licenses/by/4.0/deed.es" rel="license noopener" target="_blank">CC BY 4.0</a>: «Fuente: Junta de Andalucía»</td></tr>
<tr><td>Locales de Aragón</td><td>Gobierno de Aragón, <a href="https://opendata.aragon.es/" rel="noopener" target="_blank">Calendario de festivos en comunidad de Aragón</a> (Aragón Open Data)</td><td><a href="https://creativecommons.org/licenses/by/4.0/deed.es" rel="license noopener" target="_blank">CC BY 4.0</a>: «Fuente: Gobierno de Aragón»</td></tr>
<tr><td>Locales de Illes Balears</td><td>Govern de les Illes Balears, Calendari laboral general i local (<a href="https://catalegdades.caib.cat/" rel="noopener" target="_blank">catálogo de datos abiertos</a>)</td><td><a href="https://creativecommons.org/licenses/by/4.0/deed.es" rel="license noopener" target="_blank">CC BY</a>: «Fuente: Govern de les Illes Balears»</td></tr>
<tr><td>Locales de Euskadi</td><td>Gobierno Vasco, Calendario laboral de Euskadi (<a href="https://opendata.euskadi.eus/" rel="noopener" target="_blank">Open Data Euskadi</a>)</td><td><a href="https://opendata.euskadi.eus/general/-/informacion-legal-opendata/" rel="license noopener" target="_blank">Licencia de reconocimiento de Open Data Euskadi</a>: «Fuente: Gobierno Vasco, Open Data Euskadi»</td></tr>
<tr><td>Locales de Castilla y León</td><td>Junta de Castilla y León, <a href="https://datosabiertos.jcyl.es/web/jcyl/set/es/empleo/fiestas-locales/1284952783683" rel="noopener" target="_blank">Fiestas locales</a></td><td><a href="https://creativecommons.org/licenses/by/4.0/deed.es" rel="license noopener" target="_blank">CC BY 4.0</a>: «Fuente: Junta de Castilla y León»</td></tr>
</tbody>
</table>
<p>Para los demás municipios, los boletines oficiales de las comunidades y las provincias (y, mientras no se publican, los acuerdos de los ayuntamientos). Reutilización de información del sector público (Ley 37/2007).</p>

<h2>Mapas</h2>
<p>Los mapas, las direcciones y las rutas a pie son de <a href="https://www.mapbox.com/about/maps/" rel="noopener" target="_blank">Mapbox</a>, con datos de <a href="https://www.openstreetmap.org/copyright" rel="noopener" target="_blank">© los colaboradores de OpenStreetMap</a> (licencia <a href="https://opendatacommons.org/licenses/odbl/" rel="license noopener" target="_blank">ODbL</a>). Cada mapa lleva su atribución («© Mapbox © OpenStreetMap»).</p>

<h2>Municipios</h2>
<p>Los nombres, los códigos y los contornos de los municipios y las provincias son de las Líneas límite municipales del <strong>Instituto Geográfico Nacional</strong> (© Instituto Geográfico Nacional, IGN/CNIG, <a href="https://centrodedescargas.cnig.es/" rel="noopener" target="_blank">centrodedescargas.cnig.es</a>), con licencia <a href="https://creativecommons.org/licenses/by/4.0/deed.es" rel="license noopener" target="_blank"><strong>CC BY 4.0</strong></a>, simplificados por <a href="https://github.com/martgnz/es-atlas" rel="noopener" target="_blank">es-atlas</a> (Martín González, MIT). El punto de cada pueblo y su población (solo para ordenar la búsqueda) son de <strong><a href="https://www.wikidata.org/" rel="noopener" target="_blank">Wikidata</a></strong>, con licencia <a href="https://creativecommons.org/publicdomain/zero/1.0/deed.es" rel="license noopener" target="_blank"><strong>CC0</strong></a>.</p>

<h2>Iconos</h2>
<p>Los iconos son <a href="https://fonts.google.com/icons" rel="noopener" target="_blank">Material Icons</a> de Google, con licencia <a href="https://www.apache.org/licenses/LICENSE-2.0" rel="license noopener" target="_blank">Apache 2.0</a>.</p>
''',
    f'''
<p class="lead">Almost everything on Klendar is published by businesses and organisations. In some cities we also show the council's listings, which councils publish as open data; we use match times from an external service and the weather forecast from a public service, and the list of public holidays comes from the official gazettes. Here's where each thing comes from and under which licence.</p>

<h2>Each city's public listings</h2>
<p>Every day we import the cultural and leisure listings from these sources and publish them on the “Public listings” account of each city (or on the council's own, if it's on Klendar). Klendar doesn't organise those events: we adapt the dates to the app's format, choose a category, shorten long texts and, as the sources don't come with photos under a clear licence, we use a generic image for the category. Each event's page shows its source, licence, update date and a link to the original. A council publishing open data doesn't mean it takes part in or sponsors Klendar.</p>
<table>
<thead><tr><th>City</th><th>Who and what</th><th>Licence</th><th>How it's credited</th></tr></thead>
<tbody>{_filas_fuentes(True)}</tbody>
</table>
<p>If an event is wrong, has changed or has been cancelled, the source rules: Klendar updates it the next day. To ask us to remove something or a whole source, write to <a href="mailto:info@klendar.app">info@klendar.app</a>.</p>

<h2>Matches and televised events</h2>
<p>Matches and events in <strong>every sport</strong> (football, basketball, Formula 1, MotoGP, handball, UFC…) and their times come from <strong>TheSportsDB</strong> (<a href="https://www.thesportsdb.com/" rel="noopener" target="_blank">thesportsdb.com</a>), under its paid plan, which allows them to be used crediting them as the source: “Sports data: TheSportsDB”. What doesn't come in on its own (tennis finals, Eurovision…) is added by Klendar by hand, and each bar can add what it's showing. We don't use their images or show the TV channel: what matters is whether the bar is showing it. Times can change: check with the bar.</p>

<h2>Weather</h2>
<p>“Based on the weather” uses the forecast from <a href="https://api.met.no/" rel="noopener" target="_blank">MET Norway</a> (Norwegian Meteorological Institute), under a <a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener" target="_blank">CC BY 4.0</a> licence.</p>

<h2>Public holidays</h2>
<p>We use the list of public holidays to ask businesses whether they open. We import it every Monday from October to January from these official sources, and someone at Klendar reviews it before it's used; for each holiday we keep the source it comes from. We adapt the data to the app's format (day, name and town). None of these bodies takes part in or sponsors Klendar.</p>
<table>
<thead><tr><th>What</th><th>Who and what</th><th>Licence and credit</th></tr></thead>
<tbody>
<tr><td>National and regional</td><td>Spanish Official State Gazette (Agencia Estatal Boletín Oficial del Estado): the annual resolution of the Directorate-General for Labour on public holidays (<a href="https://www.boe.es/" rel="noopener" target="_blank">www.boe.es</a>, open data)</td><td><a href="https://www.boe.es/informacion/aviso_legal/index.php" rel="license noopener" target="_blank">BOE re-use conditions</a>: “Basado en datos de la Agencia Estatal Boletín Oficial del Estado” (based on data from the BOE)</td></tr>
<tr><td>Local, Madrid</td><td>Madrid City Council, <a href="https://datos.madrid.es/dataset/300082-0-calendario_laboral" rel="noopener" target="_blank">Calendario laboral</a></td><td><a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener" target="_blank">CC BY 4.0</a>: “Source: Madrid City Council, datos.madrid.es”</td></tr>
<tr><td>Local, Catalonia</td><td>Government of Catalonia, <a href="https://analisi.transparenciacatalunya.cat/d/b4eh-r8up" rel="noopener" target="_blank">Calendari de festes locals a Catalunya</a></td><td><a href="https://web.gencat.cat/ca/generalitat/dades-indicadors/dades-obertes/llicencies" rel="license noopener" target="_blank">Llicència oberta d’ús d’informació – Catalunya</a>: “Generalitat de Catalunya. Departament d’Empresa i Treball”</td></tr>
<tr><td>Local, Andalusia</td><td>Regional Government of Andalusia (Ministry of Employment), <a href="https://www.juntadeandalucia.es/datosabiertos/portal.html" rel="noopener" target="_blank">Calendario de días festivos</a></td><td><a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener" target="_blank">CC BY 4.0</a>: “Source: Junta de Andalucía”</td></tr>
<tr><td>Local, Aragon</td><td>Government of Aragon, <a href="https://opendata.aragon.es/" rel="noopener" target="_blank">Calendario de festivos en comunidad de Aragón</a> (Aragón Open Data)</td><td><a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener" target="_blank">CC BY 4.0</a>: “Source: Gobierno de Aragón”</td></tr>
<tr><td>Local, Balearic Islands</td><td>Government of the Balearic Islands, Calendari laboral general i local (<a href="https://catalegdades.caib.cat/" rel="noopener" target="_blank">open data catalogue</a>)</td><td><a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener" target="_blank">CC BY</a>: “Source: Govern de les Illes Balears”</td></tr>
<tr><td>Local, Basque Country</td><td>Basque Government, Calendario laboral de Euskadi (<a href="https://opendata.euskadi.eus/" rel="noopener" target="_blank">Open Data Euskadi</a>)</td><td><a href="https://opendata.euskadi.eus/general/-/informacion-legal-opendata/" rel="license noopener" target="_blank">Open Data Euskadi attribution licence</a>: “Source: Gobierno Vasco, Open Data Euskadi”</td></tr>
<tr><td>Local, Castile and León</td><td>Regional Government of Castile and León, <a href="https://datosabiertos.jcyl.es/web/jcyl/set/es/empleo/fiestas-locales/1284952783683" rel="noopener" target="_blank">Fiestas locales</a></td><td><a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener" target="_blank">CC BY 4.0</a>: “Source: Junta de Castilla y León”</td></tr>
</tbody>
</table>
<p>For other towns, the official gazettes of the autonomous communities and provinces (and, until they are published, city council agreements). Re-use of public sector information (Law 37/2007).</p>

<h2>Maps</h2>
<p>Maps, addresses and walking routes come from <a href="https://www.mapbox.com/about/maps/" rel="noopener" target="_blank">Mapbox</a>, with data <a href="https://www.openstreetmap.org/copyright" rel="noopener" target="_blank">© OpenStreetMap contributors</a> (<a href="https://opendatacommons.org/licenses/odbl/" rel="license noopener" target="_blank">ODbL</a> licence). Every map carries its credit (“© Mapbox © OpenStreetMap”).</p>

<h2>Towns</h2>
<p>The names, codes and boundaries of Spanish towns and provinces come from the municipal boundary lines of the <strong>Instituto Geográfico Nacional</strong> (© IGN/CNIG, <a href="https://centrodedescargas.cnig.es/" rel="noopener" target="_blank">centrodedescargas.cnig.es</a>), licensed under <a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener" target="_blank"><strong>CC BY 4.0</strong></a>, simplified by <a href="https://github.com/martgnz/es-atlas" rel="noopener" target="_blank">es-atlas</a> (Martín González, MIT). Each town's point and population (only used to sort search results) come from <strong><a href="https://www.wikidata.org/" rel="noopener" target="_blank">Wikidata</a></strong>, licensed <a href="https://creativecommons.org/publicdomain/zero/1.0/" rel="license noopener" target="_blank"><strong>CC0</strong></a>.</p>

<h2>Icons</h2>
<p>Icons are Google's <a href="https://fonts.google.com/icons" rel="noopener" target="_blank">Material Icons</a>, under the <a href="https://www.apache.org/licenses/LICENSE-2.0" rel="license noopener" target="_blank">Apache 2.0</a> licence.</p>
''',
)


# El título de la pestaña de las que dicen «Klendar» en el h1 (formato de la
# web, «Página · Klendar», sin repetir la marca; también va en og:title).
PESTANAS = {
    'para-negocios': ('Para negocios · Klendar', 'For businesses · Klendar'),
    'para-entidades': ('Para ayuntamientos y asociaciones · Klendar', 'For councils and associations · Klendar'),
    'sobre': ('Sobre Klendar', 'About Klendar'),
}


if __name__ == '__main__':
    for es_slug, (en_slug, t_es, t_en, d_es, d_en, b_es, b_en) in PAGINAS.items():
        for lang, slug, title, desc, body in (
            ('es', es_slug, t_es, d_es, b_es),
            ('en', 'en/' + en_slug, t_en, d_en, b_en),
        ):
            os.makedirs(slug, exist_ok=True)
            path = '/' + slug + '/'
            io.open(os.path.join(slug, 'index.html'), 'w', encoding='utf-8', newline='\n').write(
                doc_page(T[lang], path, title, desc, body,
                         pestana=PESTANAS.get(es_slug, (None, None))[lang == 'en']))
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
