# Genera la landing y las páginas de marketing en ES (/) y EN (/en/).
# Ejecutar: python build_site.py   (desde la raíz de klendar-web)
# Las páginas legales las genera build_legal.py (ES prevalece; EN informativa).
import datetime
import io, os

YEAR = '2026'
BASE = 'https://klendar.app'

# Ruta ES → ruta EN equivalente (hreflang, selector de idioma).
ALT = {
    '/': '/en/',
    '/soporte/': '/en/support/',
    '/aviso-legal/': '/en/legal-notice/',
    '/privacidad/': '/en/privacy/',
    '/terminos/': '/en/terms/',
    '/negocios/': '/en/business-terms/',
    '/cookies/': '/en/cookies/',
    '/normas/': '/en/community-guidelines/',
    '/eliminar-cuenta/': '/en/delete-account/',
    '/para-negocios/': '/en/for-business/',
    '/precios/': '/en/pricing/',
    '/preguntas/': '/en/faq/',
    '/prensa/': '/en/press/',
    '/accesibilidad/': '/en/accessibility/',
    '/estado/': '/en/status/',
    '/sobre/': '/en/about/',
}
ALT_EN = {en: es for es, en in ALT.items()}


def alternates(path):
    """(ruta ES, ruta EN) de cualquier página del sitio."""
    if path in ALT: return path, ALT[path]
    if path in ALT_EN: return ALT_EN[path], path
    return '/', '/en/'

T = {
  'es': dict(
    lang='es', dir='', other='en', other_url='/en/',
    title='Klendar — Lo que pasa cerca de ti, ahora mismo',
    desc='Ofertas flash con cuenta atrás y eventos de los negocios de tu barrio, ordenados por cercanía. Guarda tus sitios, recibe avisos y canjea con un QR.',
    nav_how='Cómo funciona', nav_biz='Para negocios', nav_faq='Preguntas', nav_support='Soporte',
    a_how='como', a_feat='funciones', a_screens='pantallas', a_biz='negocios', a_faq='preguntas',
    h1='Ofertas que se acaban. <em>Planes que empiezan.</em>',
    lead='Lo que pasa cerca de ti, ahora mismo: ofertas flash con cuenta atrás y eventos de tu barrio, ordenados por cercanía. Guarda tus sitios, recibe avisos y canjea con un QR de un solo uso.',
    play='Google Play · próximamente', appstore='App Store · próximamente',
    note='Lanzamiento ciudad a ciudad en España. Gratis y sin anuncios.',
    float_a=('⚡ 1 h 31 min', 'para canjear'), float_b=('📍 262 m', 'a pie desde ti'),
    how_eyebrow='Cómo funciona', how_h2='Tres pasos y estás dentro',
    steps=[('Abre y mira lo más cercano', 'Un feed a pantalla completa con lo que está pasando a tu alrededor: bares, restaurantes, peluquerías, gimnasios, tiendas, cultura y ocio nocturno.'),
           ('Guarda o canjea', 'Si es un evento, guárdalo en tu agenda o en el calendario del móvil. Si es una oferta flash, pulsa «Canjear» antes de que acabe la cuenta atrás.'),
           ('Enseña el QR', 'El negocio escanea tu código y listo. Cada código vale una sola vez; sin tarjetas, sin registros raros.')],
    feat_eyebrow='Todo en una app', feat_h2='Pensada para el barrio, no para el algoritmo',
    feats=[('📍', 'Por cercanía', 'Lo que tienes a mano, ordenado por distancia. Filtra por categoría, precio, tipo y radio.'),
           ('⚡', 'Ofertas flash', 'Descuentos que duran unas horas, con cuenta atrás y plazas limitadas. Ideales para huecos de última hora.'),
           ('📅', 'Agenda y mapa', 'Todo lo que hay cada día en un calendario y en un mapa con los negocios que tienen algo activo.'),
           ('🔲', 'Canjeo con QR', 'Un código único de un solo uso que el negocio valida en el momento. Sin comisiones a la persona usuaria.'),
           ('❤️', 'Favoritos y avisos', 'Guarda tus sitios y te avisamos cuando publiquen. O activa «cerca de ti» y no te pierdas una oferta a dos calles.'),
           ('⭐', 'Reseñas reales', 'Una reseña por persona y negocio. Horarios y «abierto ahora» en cada ficha.')],
    screens_eyebrow='La app', screens_h2='Así se ve',
    screens=[('agenda', 'Agenda', 'Calendario con lo que hay cada día'), ('map', 'Mapa', 'Negocios con algo activo y cuánto tardas andando'), ('detail', 'Detalle', 'Cuándo, dónde, cómo llegar y al calendario')],
    biz_eyebrow='Para negocios', biz_h2='¿Tienes un bar, una tienda, una sala?',
    biz_sub='Publica una oferta flash cuando tengas un hueco, anuncia tus eventos y valida los canjeos con la cámara del móvil. Sin comisiones por venta: una cuota mensual fija.',
    biz_points=['Alta en 2 minutos desde la app; verificamos tu negocio en 24–48 h.', 'Ofertas con cuenta atrás y aforo: tú decides cuántas y hasta cuándo.', 'Estadísticas de vistas, favoritos y canjeos por publicación.', 'Equipo: añade encargados y empleados para validar códigos.'],
    biz_cta='Escríbenos', biz_terms='Ver condiciones', biz_note='Las primeras semanas en cada ciudad, gratis.',
    biz_page_url='/para-negocios/', pricing_url='/precios/', faq_url='/preguntas/',
    live_eyebrow='Ahora mismo', live_h2='Lo que hay estos días',
    live_all='Ver la agenda completa', live_city='en',
    biz_panel='Acceso para negocios', biz_panel_url='/panel/',
    biz_panel_note='¿Ya tienes tu negocio en Klendar? Entra en tu panel para publicar, ver cómo va y validar códigos desde el ordenador.',
    biz_kit='Kit para tu local: <a href="/assets/kit/klendar-guia-negocios.pdf">guía de 1 página (PDF)</a> · <a href="/assets/kit/klendar-cartel.pdf">cartel con QR (PDF)</a>',
    biz_stats=[('0 %', 'comisión por venta'), ('2 min', 'para publicar'), ('24–48 h', 'verificación'), ('QR', 'de un solo uso')],
    faq_eyebrow='Preguntas frecuentes', faq_h2='Dudas habituales',
    faqs=[('¿Klendar es gratis?', 'Sí, para las personas usuarias es gratis y sin anuncios. Los negocios pagan una cuota mensual fija por publicar.'),
          ('¿Necesito cuenta?', 'Puedes mirar el feed, la agenda y el mapa sin cuenta. Para canjear, guardar favoritos o recibir avisos hace falta una cuenta (email o Google). Edad mínima: 14 años.'),
          ('¿Cómo funciona el canjeo?', 'Pulsas «Canjear», te sale un QR que vale 5 minutos y el negocio lo escanea con su móvil. Cada oferta se canjea una vez por persona y el código no se puede reutilizar.'),
          ('¿Qué hacéis con mi ubicación?', 'Solo se usa mientras la app está abierta para ordenar por cercanía y, si lo activas, para avisarte de ofertas cerca. Nunca se comparte con otros usuarios ni con los negocios.'),
          ('¿En qué ciudades está?', 'Empezamos ciudad a ciudad en España. Si en la tuya todavía hay poco, ayúdanos: díselo a tu bar de siempre.')],
    cta_h2='Lo que pasa cerca, en tu bolsillo', cta_sub='Muy pronto en Google Play y App Store.',
    foot_product='Producto', foot_legal='Legal', foot_contact='Contacto',
    foot_links_product=[('/#como', 'Cómo funciona'), ('/agenda/', 'Agenda local'), ('/para-negocios/', 'Para negocios'), ('/precios/', 'Precios'), ('/panel/', 'Acceso para negocios'), ('/preguntas/', 'Preguntas frecuentes'), ('/soporte/', 'Soporte'), ('/sobre/', 'Sobre Klendar'), ('/prensa/', 'Prensa'), ('/en/', 'English')],
    foot_links_legal=[('/aviso-legal/', 'Aviso legal'), ('/privacidad/', 'Privacidad'), ('/terminos/', 'Términos de uso'), ('/negocios/', 'Condiciones para negocios'), ('/cookies/', 'Cookies'), ('/normas/', 'Normas de la comunidad'), ('/eliminar-cuenta/', 'Eliminar cuenta'), ('/accesibilidad/', 'Accesibilidad'), ('/estado/', 'Estado del servicio')],
    foot_rights=f'© {YEAR} Klendar. Todos los derechos reservados.', foot_made='Hecho en España',
    support_url='/soporte/', biz_terms_url='/negocios/',
  ),
  'en': dict(
    lang='en', dir='en/', other='es', other_url='/',
    title='Klendar — What\'s happening near you, right now',
    desc='Flash deals with a countdown and events from the businesses around you, sorted by distance. Save your places, get alerts and redeem with a QR code.',
    nav_how='How it works', nav_biz='For businesses', nav_faq='FAQ', nav_support='Support',
    a_how='how-it-works', a_feat='features', a_screens='screenshots', a_biz='businesses', a_faq='faq',
    h1='Deals that run out. <em>Plans that begin.</em>',
    lead='What\'s happening near you, right now: flash deals with a countdown and events from your neighbourhood, sorted by distance. Save your places, get alerts and redeem with a single-use QR code.',
    play='Google Play · coming soon', appstore='App Store · coming soon',
    note='Launching city by city in Spain. Free, no ads.',
    float_a=('⚡ 1 h 31 min', 'left to redeem'), float_b=('📍 262 m', 'walk from you'),
    how_eyebrow='How it works', how_h2='Three steps and you\'re in',
    steps=[('Open and see what\'s closest', 'A full-screen feed with what\'s going on around you: bars, restaurants, hairdressers, gyms, shops, culture and nightlife.'),
           ('Save or redeem', 'If it\'s an event, save it to your agenda or your phone calendar. If it\'s a flash deal, tap "Redeem" before the countdown ends.'),
           ('Show the QR', 'The business scans your code and that\'s it. Each code works once; no cards, no weird sign-ups.')],
    feat_eyebrow='All in one app', feat_h2='Built for the neighbourhood, not the algorithm',
    feats=[('📍', 'By distance', 'What\'s within reach, sorted by how close it is. Filter by category, price, type and radius.'),
           ('⚡', 'Flash deals', 'Discounts that last a few hours, with a countdown and limited spots. Perfect for last-minute gaps.'),
           ('📅', 'Agenda and map', 'Everything happening each day on a calendar and on a map of businesses with something live.'),
           ('🔲', 'QR redemption', 'A unique single-use code the business validates on the spot. No fees for users.'),
           ('❤️', 'Favourites and alerts', 'Save your places and we tell you when they post. Or turn on "nearby" and never miss a deal two streets away.'),
           ('⭐', 'Real reviews', 'One review per person and business. Opening hours and "open now" on every profile.')],
    screens_eyebrow='The app', screens_h2='This is what it looks like',
    screens=[('agenda', 'Agenda', 'A calendar with what\'s on each day'), ('map', 'Map', 'Businesses with something live and how long it takes to walk'), ('detail', 'Details', 'When, where, directions and add to calendar')],
    biz_eyebrow='For businesses', biz_h2='Got a bar, a shop, a venue?',
    biz_sub='Post a flash deal when you have a quiet hour, announce your events and validate redemptions with your phone camera. No sales commission: one flat monthly fee.',
    biz_points=['Sign up in 2 minutes from the app; we verify your business in 24–48 h.', 'Deals with a countdown and capacity: you decide how many and until when.', 'Stats for views, favourites and redemptions per post.', 'Team: add managers and staff to validate codes.'],
    biz_cta='Email us', biz_terms='Business terms', biz_note='The first weeks in each city are free.',
    biz_page_url='/en/for-business/', pricing_url='/en/pricing/', faq_url='/en/faq/',
    live_eyebrow='Right now', live_h2='What is on these days',
    live_all='See the full agenda', live_city='in',
    biz_panel='Business sign in', biz_panel_url='/panel/',
    biz_panel_note='Already on Klendar? Sign in to your dashboard to publish, see how it is going and validate codes from your computer.',
    biz_kit='Kit for your venue (Spanish): <a href="/assets/kit/klendar-guia-negocios.pdf">one-page guide (PDF)</a> · <a href="/assets/kit/klendar-cartel.pdf">poster with QR (PDF)</a>',
    biz_stats=[('0 %', 'sales commission'), ('2 min', 'to publish'), ('24–48 h', 'verification'), ('QR', 'single-use')],
    faq_eyebrow='FAQ', faq_h2='Common questions',
    faqs=[('Is Klendar free?', 'Yes, for users it\'s free and ad-free. Businesses pay a flat monthly fee to publish.'),
          ('Do I need an account?', 'You can browse the feed, the agenda and the map without one. To redeem, save favourites or get alerts you need an account (email or Google). Minimum age: 14.'),
          ('How does redemption work?', 'Tap "Redeem", a QR code valid for 5 minutes appears and the business scans it with their phone. Each deal can be redeemed once per person and codes can\'t be reused.'),
          ('What do you do with my location?', 'It\'s only used while the app is open to sort by distance and, if you turn it on, to alert you about nearby deals. It\'s never shared with other users or with businesses.'),
          ('Which cities?', 'We\'re starting city by city in Spain. If yours is still quiet, help us: tell your local bar.')],
    cta_h2='What\'s happening nearby, in your pocket', cta_sub='Coming soon to Google Play and the App Store.',
    foot_product='Product', foot_legal='Legal', foot_contact='Contact',
    foot_links_product=[('/en/#how-it-works', 'How it works'), ('/en/whats-on/', "What's on"), ('/en/for-business/', 'For businesses'), ('/en/pricing/', 'Pricing'), ('/panel/', 'Business sign in'), ('/en/faq/', 'FAQ'), ('/en/support/', 'Support'), ('/en/about/', 'About'), ('/en/press/', 'Press'), ('/', 'Español')],
    foot_links_legal=[('/en/legal-notice/', 'Legal notice'), ('/en/privacy/', 'Privacy policy'), ('/en/terms/', 'Terms of use'), ('/en/business-terms/', 'Business terms'), ('/en/cookies/', 'Cookies'), ('/en/community-guidelines/', 'Community guidelines'), ('/en/delete-account/', 'Delete account'), ('/en/accessibility/', 'Accessibility'), ('/en/status/', 'Service status')],
    foot_rights=f'© {YEAR} Klendar. All rights reserved.', foot_made='Made in Spain',
    support_url='/en/support/', biz_terms_url='/en/business-terms/',
  ),
}

SUPPORT_EN = ('Support', 'Klendar help: how to redeem a deal, list your business, recover your account or report content. We reply within 2 working days.', '''
<h2>Contact</h2>
<p>Email us at <a href="mailto:info@klendar.app">info@klendar.app</a>. We reply within 2 working days.</p>
<h2>Frequently asked questions</h2>
<h3>I can't redeem a deal</h3>
<p>Check that the deal is still active (it has a time window and a capacity), that you are logged in and that you haven't redeemed it already: each deal can be redeemed once per person.</p>
<h3>The QR code has expired</h3>
<p>Each code is valid for 5 minutes. Tap "Generate another code" on the same screen.</p>
<h3>A business didn't honour its deal</h3>
<p>Report it from its profile (flag icon) with the reason "The deal isn't as advertised". We review it and, if it happens again, the business is suspended.</p>
<h3>I don't get notifications</h3>
<p>Check Profile → Notification settings and the system notification permission. "Nearby" only alerts you about flash deals within your chosen radius, at most 3 times a day.</p>
<h3>I run a business and want to sign up</h3>
<p>In the app: Profile → "Got a business? Register it". We review it within 24–48 h. You can also email us.</p>
<h2>Legal documents</h2>
<p><a href="/en/privacy/">Privacy policy</a> · <a href="/en/terms/">Terms of use</a> · <a href="/en/business-terms/">Business terms</a> · <a href="/en/community-guidelines/">Community guidelines</a> · <a href="/en/delete-account/">Delete your account</a>. English versions are courtesy translations; the Spanish originals are the governing text.</p>
''')


def head(t, path, page_title=None, page_desc=None, extra=''):
    title = page_title or t['title']; desc = page_desc or t['desc']
    canonical = BASE + path
    es_path, en_path = alternates(path)
    alt_es, alt_en = BASE + es_path, BASE + en_path
    return f'''<!doctype html>
<html lang="{t['lang']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="es" href="{alt_es}">
<link rel="alternate" hreflang="en" href="{alt_en}">
<link rel="alternate" hreflang="x-default" href="{alt_es}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{BASE}/assets/og.png">
<meta property="og:url" content="{canonical}">
<meta property="og:type" content="website">
<meta property="og:locale" content="{'es_ES' if t['lang']=='es' else 'en_GB'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0B0F1A">
<link rel="icon" href="/assets/favicon.png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/public.css?v=2">
{extra}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/{t['dir']}"><img src="/assets/symbol.png" alt="" width="30" height="30"> Klendar</a>
  <input type="checkbox" id="menu" aria-hidden="true">
  <label class="menu-toggle" for="menu" aria-label="Menú"><span></span><span></span><span></span></label>
  <nav class="main">
    <a href="/{t['dir']}#{t['a_how']}">{t['nav_how']}</a>
    <a href="{t['biz_page_url']}">{t['nav_biz']}</a>
    <a href="{t['faq_url']}">{t['nav_faq']}</a>
    <a href="{t['support_url']}">{t['nav_support']}</a>
    <a href="{t['biz_panel_url']}" class="nav-panel">{t['biz_panel']}</a>
    <span class="lang" aria-label="Idioma / Language">
      <a href="{es_path}" class="{'on' if t['lang']=='es' else ''}" data-lang="es" hreflang="es">ES</a>
      <a href="{en_path}" class="{'on' if t['lang']=='en' else ''}" data-lang="en" hreflang="en">EN</a>
    </span>
  </nav>
</div></header>
'''


# Solo la portada trae contenido en vivo; los documentos no lo necesitan.
LIVE_SCRIPTS = (
    '<script src="/config.js?v=1"></script>'
    '<script src="/assets/live.js?v=1" defer></script>'
)


def footer(t, only_footer=True):
    prod = ''.join(f'<a href="{h}">{l}</a>' for h, l in t['foot_links_product'])
    legal = ''.join(f'<a href="{h}">{l}</a>' for h, l in t['foot_links_legal'])
    return f'''
<footer><div class="wrap">
  <div class="cols">
    <div><a class="brand" href="/{t['dir']}"><img src="/assets/symbol.png" alt="" width="30" height="30"> Klendar</a>
      <p style="margin:12px 0 0;max-width:340px">{t['desc']}</p></div>
    <div><h4>{t['foot_product']}</h4>{prod}</div>
    <div><h4>{t['foot_legal']}</h4>{legal}</div>
  </div>
  <div class="bottom">
    <span>{t['foot_rights']}</span>
    <span><a href="mailto:info@klendar.app">info@klendar.app</a> · {t['foot_made']}</span>
  </div>
</div></footer>
<script>
(function(){{
  var links=document.querySelectorAll('.lang a');
  for(var i=0;i<links.length;i++){{links[i].addEventListener('click',function(){{try{{localStorage.setItem('klendar_lang',this.getAttribute('data-lang'))}}catch(e){{}}}});}}
}})();
</script>
{'' if only_footer else LIVE_SCRIPTS}
</body></html>
'''


LANG_REDIRECT = '''<script>
// Primera visita a la portada: si el navegador está en inglés, a /en/ (recordamos la elección).
(function(){try{var p=location.pathname;if(p!=='/')return;var s=localStorage.getItem('klendar_lang');if(s==='es')return;
if(s==='en'||(!s&&/^en\\b/i.test(navigator.language||''))){location.replace('/en/'+location.hash);}}catch(e){}})();
</script>'''


def landing(t):
    path = '/' + t['dir']
    jsonld = f'''<script type="application/ld+json">{{"@context":"https://schema.org","@graph":[
{{"@type":"Organization","name":"Klendar","url":"{BASE}/","logo":"{BASE}/assets/icon-512.png","email":"info@klendar.app"}},
{{"@type":"WebSite","name":"Klendar","url":"{BASE}/","inLanguage":["es","en"]}},
{{"@type":"MobileApplication","name":"Klendar","operatingSystem":"Android, iOS","applicationCategory":"LifestyleApplication","offers":{{"@type":"Offer","price":"0","priceCurrency":"EUR"}},"description":"{t['desc']}"}}]}}</script>'''
    steps = ''.join(f'<div class="step"><h3>{h}</h3><p>{p}</p></div>' for h, p in t['steps'])
    feats = ''.join(f'<div class="card"><div class="ic">{i}</div><h3>{h}</h3><p>{p}</p></div>' for i, h, p in t['feats'])
    screens = ''.join(f'<figure><div class="phone"><img src="/assets/screens/{f}.webp" alt="{h}" loading="lazy" width="540" height="1212"></div><figcaption>{h}<small>{s}</small></figcaption></figure>' for f, h, s in t['screens'])
    points = ''.join(f'<li>{p}</li>' for p in t['biz_points'])
    stats = ''.join(f'<div><b>{b}</b><span>{s}</span></div>' for b, s in t['biz_stats'])
    faqs = ''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q, a in t['faqs'])
    faq_ld = '<script type="application/ld+json">' + '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[' + ','.join(
        '{"@type":"Question","name":%s,"acceptedAnswer":{"@type":"Answer","text":%s}}' % (jsq(q), jsq(a)) for q, a in t['faqs']) + ']}</script>'
    fa, fb = t['float_a'], t['float_b']
    mail = 'mailto:info@klendar.app?subject=' + ('Quiero%20dar%20de%20alta%20mi%20negocio%20en%20Klendar' if t['lang'] == 'es' else 'I%20want%20to%20list%20my%20business%20on%20Klendar')
    body = f'''
<section class="hero"><div class="wrap">
  <div>
    <h1>{t['h1']}</h1>
    <p class="lead">{t['lead']}</p>
    <div class="stores">
      <a class="pill ink" href="#" aria-disabled="true">▶ {t['play']}</a>
      <a class="pill ink" href="#" aria-disabled="true"> {t['appstore']}</a>
    </div>
    <p class="note">{t['note']}</p>
  </div>
  <div class="hero-visual">
    <div class="phone"><img src="/assets/screens/feed.webp" alt="Klendar" width="540" height="1212" fetchpriority="high"></div>
    <div class="float a">{fa[0]}<small>{fa[1]}</small></div>
    <div class="float b">{fb[0]}<small>{fb[1]}</small></div>
  </div>
</div></section>

<section id="ahora" class="live" hidden><div class="wrap">
  <span class="eyebrow">{t['live_eyebrow']}</span>
  <h2>{t['live_h2']} <span id="liveCity" class="muted"></span></h2>
  <div class="olist" id="liveList"></div>
  <p><a class="pill ghost" id="liveAll" href="{'/agenda/' if t['lang'] == 'es' else '/en/whats-on/'}">{t['live_all']}</a></p>
</div></section>

<section id="{t['a_how']}"><div class="wrap">
  <span class="eyebrow">{t['how_eyebrow']}</span>
  <h2>{t['how_h2']}</h2>
  <div class="steps">{steps}</div>
</div></section>

<section id="{t['a_feat']}"><div class="wrap">
  <span class="eyebrow">{t['feat_eyebrow']}</span>
  <h2>{t['feat_h2']}</h2>
  <div class="grid">{feats}</div>
</div></section>

<section id="{t['a_screens']}"><div class="wrap">
  <span class="eyebrow">{t['screens_eyebrow']}</span>
  <h2>{t['screens_h2']}</h2>
  <div class="screens">{screens}</div>
</div></section>

<section id="{t['a_biz']}"><div class="wrap">
  <div class="biz">
    <div>
      <span class="eyebrow">{t['biz_eyebrow']}</span>
      <h2>{t['biz_h2']}</h2>
      <p class="sub">{t['biz_sub']}</p>
      <ul>{points}</ul>
      <p style="margin:0;display:flex;gap:10px;flex-wrap:wrap"><a class="pill accent" href="{mail}">{t['biz_cta']}</a> <a class="pill ghost" href="{t['biz_panel_url']}">{t['biz_panel']}</a> <a class="pill ghost" href="{t['biz_terms_url']}">{t['biz_terms']}</a></p>
      <p class="note" style="color:inherit;opacity:.7">{t['biz_panel_note']}</p>
      <p class="note" style="color:inherit;opacity:.7">{t['biz_note']}</p>
      <p class="note" style="color:inherit;opacity:.85">{t['biz_kit']}</p>
    </div>
    <aside><div class="row">{stats}</div></aside>
  </div>
</div></section>

<section id="{t['a_faq']}"><div class="wrap">
  <span class="eyebrow">{t['faq_eyebrow']}</span>
  <h2>{t['faq_h2']}</h2>
  <div class="faq">{faqs}</div>
</div></section>

<section class="cta"><div class="wrap">
  <h2>{t['cta_h2']}</h2>
  <p class="sub" style="margin:0 auto 24px">{t['cta_sub']}</p>
  <div class="stores" style="justify-content:center">
    <a class="pill ink" href="#" aria-disabled="true">▶ {t['play']}</a>
    <a class="pill ink" href="#" aria-disabled="true"> {t['appstore']}</a>
  </div>
</div></section>
'''
    extra = jsonld + faq_ld + (LANG_REDIRECT if t['lang'] == 'es' else '')
    return head(t, path, extra=extra) + body + footer(t, only_footer=False)


def jsq(s):
    import json
    return json.dumps(s, ensure_ascii=False)


def doc_page(t, path, title, desc, body):
    return head(t, path, f'{title} · Klendar', desc) + f'''
<main class="doc">
<h1>{title}</h1>
{body}
</main>
''' + footer(t)


# ── robots.txt y sitemap.xml ────────────────────────────────────────────────
# Solo se indexan las páginas estáticas: /admin/ es privado y /o/, /b/ y /r/
# son enlaces profundos que se generan al vuelo (ya llevan su propio canonical).
SITEMAP_ES = ['/', '/agenda/', '/para-negocios/', '/precios/', '/preguntas/', '/prensa/', '/sobre/', '/accesibilidad/', '/estado/', '/negocios/', '/soporte/', '/privacidad/', '/terminos/', '/aviso-legal/', '/cookies/', '/normas/', '/eliminar-cuenta/']
SITEMAP_EN = ['/en/', '/en/whats-on/', '/en/for-business/', '/en/pricing/', '/en/faq/', '/en/press/', '/en/about/', '/en/accessibility/', '/en/status/', '/en/business-terms/', '/en/support/', '/en/privacy/', '/en/terms/', '/en/legal-notice/', '/en/cookies/', '/en/community-guidelines/', '/en/delete-account/']
ALT_PAIRS = dict(zip(SITEMAP_ES, SITEMAP_EN))


def robots():
    nl = chr(10)
    return nl.join([
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin/',
        'Disallow: /r/',
        'Disallow: /legal/',
        '',
        f'Sitemap: {BASE}/sitemap.xml',
        f'Sitemap: {BASE}/sitemap-agenda.xml',
        '',
    ])


def sitemap():
    today = datetime.date.today().isoformat()
    nl = chr(10)
    urls = []
    for path in SITEMAP_ES + SITEMAP_EN:
        es_path = path if path in ALT_PAIRS else next((k for k, v in ALT_PAIRS.items() if v == path), None)
        en_path = ALT_PAIRS.get(path) or (path if path.startswith('/en/') else None)
        alts = ''
        if es_path and en_path:
            alts = nl.join([
                '',
                f'    <xhtml:link rel="alternate" hreflang="es" href="{BASE}{es_path}"/>',
                f'    <xhtml:link rel="alternate" hreflang="en" href="{BASE}{en_path}"/>',
                f'    <xhtml:link rel="alternate" hreflang="x-default" href="{BASE}{es_path}"/>',
            ])
        prio = '1.0' if path in ('/', '/en/') else ('0.8' if 'negocios' in path or 'business-terms' in path else '0.5')
        urls.append(nl.join([
            '  <url>',
            f'    <loc>{BASE}{path}</loc>',
            f'    <lastmod>{today}</lastmod>',
            f'    <priority>{prio}</priority>{alts}',
            '  </url>',
        ]))
    head = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    return nl.join(head + urls + ['</urlset>', ''])


if __name__ == '__main__':
    os.makedirs('en/support', exist_ok=True)
    io.open('index.html', 'w', encoding='utf-8', newline='\n').write(landing(T['es']))
    io.open('en/index.html', 'w', encoding='utf-8', newline='\n').write(landing(T['en']))
    io.open('en/support/index.html', 'w', encoding='utf-8', newline='\n').write(doc_page(T['en'], '/en/support/', *SUPPORT_EN))
    io.open('robots.txt', 'w', encoding='utf-8', newline=chr(10)).write(robots())
    io.open('sitemap.xml', 'w', encoding='utf-8', newline=chr(10)).write(sitemap())
    print('ok: index.html, en/index.html, en/support/index.html, robots.txt, sitemap.xml')
