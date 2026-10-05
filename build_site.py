# Genera la landing y las páginas de marketing en ES (/) y EN (/en/).
# Ejecutar: python build_site.py   (desde la raíz de klendar-web)
# Las páginas legales las genera build_legal.py (ES prevalece; EN informativa).
import datetime
import io, os

AQUI = os.path.dirname(os.path.abspath(__file__))

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
    '/como-funciona/': '/en/how-it-works/',
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
    title='Klendar — Ofertas y planes cerca de ti, hoy',
    desc='Ofertas flash con cuenta atrás y eventos de los bares, restaurantes, tiendas y salas de tu barrio, ordenados por cercanía. Gratis y sin anuncios.',
    hero_eyebrow='Ofertas que se acaban. Planes que empiezan.',
    hero_h1='Ofertas y planes <em>cerca de ti</em>, hoy',
    hero_lead='Ofertas flash con cuenta atrás y eventos de los bares, restaurantes, tiendas y salas de tu barrio, ordenados por cercanía. Gratis y sin anuncios.',
    cta_explore='Ver qué hay cerca', cta_explore_url='/descubre/',
    cta_register='Crear cuenta gratis', cta_register_url='/app/#/registro',
    cities_label='Qué hacer hoy en', cities_fallback='tu ciudad', agenda_url='/agenda/',
    app_note='App para Android e iPhone, muy pronto. Mientras tanto, todo funciona desde aquí.',
    live_all_short='Ver todo',
    home_how_h2='Mira, elige y enséñalo en la puerta',
    home_steps=[('Mira lo que hay cerca', 'Ofertas que duran unas horas y eventos con fecha, ordenados por distancia.'),
                ('Guárdalo o pide tu código', 'Los eventos, a tus planes. Las ofertas, un QR antes de que acabe la cuenta atrás.'),
                ('Enséñalo y listo', 'El negocio lo escanea. Cada código vale una vez; sin tarjetas ni registros raros.')],
    how_url='/como-funciona/', how_more='Todo lo que hace Klendar →',
    how_title='Cómo funciona Klendar',
    how_desc='Cómo funciona Klendar: ofertas flash con cuenta atrás y eventos de tu barrio, ordenados por cercanía; se guardan en tus planes o se canjean con un QR de un solo uso.',
    band_h2='¿Tienes un bar, una tienda o una sala?',
    band_text='Publica una oferta cuando tengas un hueco y llena tus eventos. Sin comisiones por venta. Las primeras semanas en cada ciudad, gratis.',
    band_more='Cómo funciona para negocios', band_panel='Entrar a mi panel',
    faq_all='Todas las preguntas', faq_support='Soporte',
    app_h2='Llévalo en el bolsillo',
    app_text='La app para Android e iPhone llega muy pronto, con avisos de lo que pasa a dos calles.',
    nav_how='Cómo funciona', nav_biz='Para negocios', nav_faq='Preguntas', nav_support='Soporte',
    a_how='como', a_feat='funciones', a_screens='pantallas', a_biz='negocios', a_faq='preguntas',
    h1='Ofertas que se acaban. <em>Planes que empiezan.</em>',
    lead='Lo que pasa cerca de ti, ahora mismo: ofertas flash con cuenta atrás y eventos de tu barrio, ordenados por cercanía. Marca tus favoritos, recibe avisos y canjea con un QR de un solo uso.',
    play='Google Play · próximamente', appstore='App Store · próximamente',
    note='Lanzamiento ciudad a ciudad en España. Gratis y sin anuncios.',
    float_a=('⚡ 1 h 31 min', 'para canjear'), float_b=('📍 262 m', 'a pie desde ti'),
    how_eyebrow='Cómo funciona', how_h2='Tres pasos y estás dentro',
    steps=[('Abre y mira lo más cercano', 'Un feed a pantalla completa con lo que está pasando a tu alrededor: bares, restaurantes, peluquerías, gimnasios, tiendas, cultura y ocio nocturno.'),
           ('Guarda o canjea', 'Si es un evento, guárdalo en tus planes o en el calendario del móvil. Si es una oferta flash, pulsa «Conseguir el código» antes de que acabe la cuenta atrás.'),
           ('Enseña el QR', 'El negocio escanea tu código y listo. Cada código vale una sola vez; sin tarjetas, sin registros raros.')],
    feat_eyebrow='Todo en una app', feat_h2='Pensada para el barrio, no para el algoritmo',
    feats=[('📍', 'Por cercanía', 'Lo que tienes a mano, ordenado por distancia. Filtra por categoría, precio, tipo y radio.'),
           ('⚡', 'Ofertas flash', 'Descuentos que duran unas horas, con cuenta atrás y plazas limitadas. Ideales para huecos de última hora.'),
           ('📅', 'Agenda y mapa', 'Todo lo que hay cada día en un calendario y en un mapa con los negocios que tienen algo activo.'),
           ('🔲', 'Canje con QR', 'Un código único de un solo uso que el negocio valida en el momento. Sin comisiones a la persona usuaria.'),
           ('❤️', 'Favoritos y avisos', 'Añade negocios a favoritos y te avisamos cuando publiquen. O activa «cerca de ti» y no te pierdas una oferta a dos calles.'),
           ('⭐', 'Reseñas reales', 'Una reseña por persona y negocio. Horarios y «abierto ahora» en cada ficha.')],
    screens_eyebrow='La app', screens_h2='Así se ve',
    screens=[('agenda', 'Agenda', 'Calendario con lo que hay cada día'), ('map', 'Mapa', 'Negocios con algo activo y cuánto tardas andando'), ('detail', 'Detalle', 'Cuándo, dónde, cómo llegar y al calendario')],
    biz_eyebrow='Para negocios', biz_h2='¿Tienes un bar, una tienda, una sala?',
    biz_sub='Publica una oferta flash cuando tengas un hueco, anuncia tus eventos y valida los canjes con la cámara del móvil. Sin comisiones por venta: una cuota mensual fija.',
    biz_points=['Alta en 2 minutos desde la app; verificamos tu negocio en 24–48 h.', 'Ofertas con cuenta atrás y aforo: tú decides cuántas y hasta cuándo.', 'Estadísticas de vistas, favoritos y canjes por publicación.', 'Equipo: añade encargados y empleados para validar códigos.'],
    biz_cta='Escríbenos', biz_terms='Ver condiciones', biz_note='Las primeras semanas en cada ciudad, gratis.',
    biz_page_url='/para-negocios/', pricing_url='/precios/', faq_url='/preguntas/',
    live_eyebrow='Ahora mismo', live_h2='Lo que hay estos días',
    live_note='La ciudad con más movimiento ahora mismo. No pedimos tu ubicación: eso es cosa de la app.',
    live_all='Ver la agenda completa', live_city='en',
    biz_panel='Acceso para negocios', biz_panel_url='/panel/',
    biz_panel_note='¿Ya tienes tu negocio en Klendar? Entra en tu panel para publicar, ver cómo va y validar códigos desde el ordenador.',
    biz_kit='Kit para tu local: <a href="/assets/kit/klendar-guia-negocios.pdf">guía de 1 página (PDF)</a> · <a href="/assets/kit/klendar-cartel.pdf">cartel con QR (PDF)</a>',
    biz_stats=[('0 %', 'comisión por venta'), ('2 min', 'para publicar'), ('24–48 h', 'verificación'), ('QR', 'de un solo uso')],
    faq_eyebrow='Preguntas frecuentes', faq_h2='Dudas habituales',
    faqs=[('¿Klendar es gratis?', 'Sí, para las personas usuarias es gratis y sin anuncios. Los negocios pagan una cuota mensual fija por publicar.'),
          ('¿Necesito cuenta?', 'Puedes mirar el feed, la agenda y el mapa sin cuenta. Para canjear, guardar favoritos o recibir avisos hace falta una cuenta (email o Google). Edad mínima: 14 años.'),
          ('¿Cómo funciona el canje?', 'Pulsas «Conseguir el código», te sale un QR de un solo uso y el negocio lo escanea con su móvil (o escribe el código). Suele caducar a los pocos minutos, así que pídelo cuando ya estés en el local.'),
          ('¿Qué hacéis con mi ubicación?', 'Se usa para ordenar por cercanía y, si lo activas, para avisarte de ofertas cerca (con la última ubicación conocida, que se borra a los 7 días; no guardamos un historial). Nunca se comparte con otros usuarios, y los negocios solo ven cifras agregadas de distancia, sin saber de quién son.'),
          ('¿En qué ciudades está?', 'Empezamos ciudad a ciudad en España. Si en la tuya todavía hay poco, ayúdanos: díselo a tu bar de siempre.')],
    cta_h2='Lo que pasa cerca, en tu bolsillo', cta_sub='Muy pronto en Google Play y App Store.',
    foot_product='Producto', foot_legal='Legal', foot_contact='Contacto',
    foot_links_product=[('/#como', 'Cómo funciona'), ('/explorar/', 'Explorar'), ('/agenda/', 'Agenda local'), ('/para-negocios/', 'Para negocios'), ('/precios/', 'Precios'), ('/panel/', 'Acceso para negocios'), ('/preguntas/', 'Preguntas frecuentes'), ('/soporte/', 'Soporte'), ('/sobre/', 'Sobre Klendar'), ('/prensa/', 'Prensa'), ('/en/', 'English')],
    foot_links_legal=[('/aviso-legal/', 'Aviso legal'), ('/privacidad/', 'Privacidad'), ('/terminos/', 'Términos de uso'), ('/negocios/', 'Condiciones para negocios'), ('/cookies/', 'Cookies'), ('/normas/', 'Normas de la comunidad'), ('/eliminar-cuenta/', 'Eliminar cuenta'), ('/accesibilidad/', 'Accesibilidad'), ('/estado/', 'Estado del servicio')],
    foot_rights=f'© {YEAR} Klendar. Todos los derechos reservados.', foot_made='Hecho en España',
    support_url='/soporte/', biz_terms_url='/negocios/',
  ),
  'en': dict(
    lang='en', dir='en/', other='es', other_url='/',
    title='Klendar — Deals and things to do near you, today',
    desc='Flash offers with a countdown and events from the bars, restaurants, shops and venues around you, sorted by distance. Free, no ads.',
    hero_eyebrow='Deals that run out. Plans that begin.',
    hero_h1='Deals and things to do <em>near you</em>, today',
    hero_lead='Flash offers with a countdown and events from the bars, restaurants, shops and venues around you, sorted by distance. Free, no ads.',
    cta_explore='See what\'s nearby', cta_explore_url='/en/discover/',
    cta_register='Create a free account', cta_register_url='/app/?lang=en#/registro',
    cities_label='What to do today in', cities_fallback='your city', agenda_url='/en/whats-on/',
    app_note='Android and iPhone app coming soon. Meanwhile, everything works right here.',
    live_all_short='See all',
    home_how_h2='Look, choose and show it at the door',
    home_steps=[('See what\'s nearby', 'Deals that last a few hours and events with a date, sorted by distance.'),
                ('Save it or get your code', 'Events go to your plans. Deals get a QR code before the countdown ends.'),
                ('Show it, done', 'The business scans it. Each code works once; no cards, no weird sign-ups.')],
    how_url='/en/how-it-works/', how_more='Everything Klendar does →',
    how_title='How Klendar works',
    how_desc='How Klendar works: flash offers with a countdown and events from your neighbourhood, sorted by distance; save them to your plans or redeem with a single-use QR code.',
    band_h2='Got a bar, a shop or a venue?',
    band_text='Post a deal when you have a quiet hour and fill your events. No sales commission. The first weeks in each city are free.',
    band_more='How it works for businesses', band_panel='Log in to my dashboard',
    faq_all='All questions', faq_support='Support',
    app_h2='Take it in your pocket',
    app_text='The Android and iPhone app is coming soon, with alerts for what\'s happening two streets away.',
    nav_how='How it works', nav_biz='For businesses', nav_faq='FAQ', nav_support='Support',
    a_how='how-it-works', a_feat='features', a_screens='screenshots', a_biz='businesses', a_faq='faq',
    h1='Deals that run out. <em>Plans that begin.</em>',
    lead='What\'s happening near you, right now: flash offers with a countdown and events from your neighbourhood, sorted by distance. Mark your favourites, get alerts and redeem with a single-use QR code.',
    play='Google Play · coming soon', appstore='App Store · coming soon',
    note='Launching city by city in Spain. Free, no ads.',
    float_a=('⚡ 1 h 31 min', 'left to redeem'), float_b=('📍 262 m', 'walk from you'),
    how_eyebrow='How it works', how_h2='Three steps and you\'re in',
    steps=[('Open and see what\'s closest', 'A full-screen feed with what\'s going on around you: bars, restaurants, hairdressers, gyms, shops, culture and nightlife.'),
           ('Save or redeem', 'If it\'s an event, save it to your plans or your phone calendar. If it\'s a flash offer, tap “Get the code” before the countdown ends.'),
           ('Show the QR', 'The business scans your code and that\'s it. Each code works once; no cards, no weird sign-ups.')],
    feat_eyebrow='All in one app', feat_h2='Built for the neighbourhood, not the algorithm',
    feats=[('📍', 'By distance', 'What\'s within reach, sorted by how close it is. Filter by category, price, type and radius.'),
           ('⚡', 'Flash offers', 'Discounts that last a few hours, with a countdown and limited places. Perfect for last-minute gaps.'),
           ('📅', 'Agenda and map', 'Everything happening each day on a calendar and on a map of businesses with something live.'),
           ('🔲', 'QR redemption', 'A unique single-use code the business validates on the spot. No fees for users.'),
           ('❤️', 'Favourites and alerts', 'Add businesses to your favourites and we\'ll let you know when they post. Or turn on “Nearby” and never miss a deal two streets away.'),
           ('⭐', 'Real reviews', 'One review per person per business. Opening hours and “Open now” on every profile.')],
    screens_eyebrow='The app', screens_h2='This is what it looks like',
    screens=[('agenda', 'Agenda', 'A calendar with what\'s on each day'), ('map', 'Map', 'Businesses with something live and how long it takes to walk'), ('detail', 'Details', 'When, where, directions and add to calendar')],
    biz_eyebrow='For businesses', biz_h2='Got a bar, a shop, a venue?',
    biz_sub='Post a flash offer when you have a quiet hour, announce your events and validate redemptions with your phone camera. No sales commission: one flat monthly fee.',
    biz_points=['Sign up in 2 minutes from the app; we verify your business in 24–48 h.', 'Deals with a countdown and capacity: you decide how many and until when.', 'Stats for views, favourites and redemptions per publication.', 'Team: add managers and staff to validate codes.'],
    biz_cta='Email us', biz_terms='Business terms', biz_note='The first weeks in each city are free.',
    biz_page_url='/en/for-business/', pricing_url='/en/pricing/', faq_url='/en/faq/',
    live_eyebrow='Right now', live_h2='What\'s on this week',
    live_note='The busiest city right now. We don\u2019t ask for your location here: that\u2019s the app\u2019s job.',
    live_all='See the full agenda', live_city='in',
    biz_panel='Business login', biz_panel_url='/panel/',
    biz_panel_note='Already on Klendar? Log in to your dashboard to publish, see how it\'s going and validate codes from your computer.',
    biz_kit='Kit for your venue (Spanish): <a href="/assets/kit/klendar-guia-negocios.pdf">one-page guide (PDF)</a> · <a href="/assets/kit/klendar-cartel.pdf">poster with QR (PDF)</a>',
    biz_stats=[('0 %', 'sales commission'), ('2 min', 'to publish'), ('24–48 h', 'verification'), ('QR', 'single-use')],
    faq_eyebrow='FAQ', faq_h2='Common questions',
    faqs=[('Is Klendar free?', 'Yes, for users it\'s free and ad-free. Businesses pay a flat monthly fee to publish.'),
          ('Do I need an account?', 'You can browse the feed, the agenda and the map without one. To redeem, save favourites or get alerts you need an account (email or Google). Minimum age: 14.'),
          ('How does redemption work?', 'Tap “Get the code” and a single-use QR code appears; the business scans it with their phone (or types the code). It usually expires within minutes, so get it once you\'re at the venue.'),
          ('What do you do with my location?', 'It\'s used to sort by distance and, if you turn it on, to alert you about nearby deals (using your last known location, which is deleted after 7 days; we keep no history). It\'s never shared with other users, and businesses only see aggregate distance figures, without knowing whose they are.'),
          ('Which cities?', 'We\'re starting city by city in Spain. If yours is still quiet, help us: tell your local bar.')],
    cta_h2='What\'s happening nearby, in your pocket', cta_sub='Coming soon to Google Play and the App Store.',
    foot_product='Product', foot_legal='Legal', foot_contact='Contact',
    foot_links_product=[('/en/#how-it-works', 'How it works'), ('/en/explore/', 'Explore'), ('/en/whats-on/', "What's on"), ('/en/for-business/', 'For businesses'), ('/en/pricing/', 'Pricing'), ('/panel/', 'Business login'), ('/en/faq/', 'FAQ'), ('/en/support/', 'Support'), ('/en/about/', 'About'), ('/en/press/', 'Press'), ('/', 'Español')],
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
<p>Check that the deal is still active (it has a time window and a capacity), that you're logged in and that you haven't used up the redemptions per person the business allows.</p>
<h3>The QR code has expired</h3>
<p>Codes expire after a while (usually a few minutes; each business chooses). Tap “Generate a new code” on the same screen.</p>
<h3>A business didn't honour its deal</h3>
<p>Report it from its profile (flag icon) with the reason “The offer isn't as advertised”. We review it and, if it happens again, the business is suspended.</p>
<h3>Report illegal content</h3>
<p>If you see something illegal or that breaks the <a href="/en/community-guidelines/">Community guidelines</a>, tap “Report” on that business, publication, review or news post, or use the <a href="/app/?lang=en#/denunciar">report form</a> (also in the footer of every page: “Report illegal content”). You don't need an account. We'll confirm we've received it and tell you what we've decided and why. If someone is in danger right now, call 112.</p>
<h3>I don't get notifications</h3>
<p>Check Account → Settings → Notifications and the system notification permission. “Nearby” only alerts you about flash offers within your chosen radius, at most 3 times a day.</p>
<h3>I can't log in to my account</h3>
<p>On “Log in”, tap “Forgot your password?” and we'll send you a link to create a new one, or choose “Log in with an email code” and get in without a password. If you created the account with Google or Apple, log in with that same button. If you can no longer open that email, write to <a href="mailto:info@klendar.app">info@klendar.app</a> from another address and tell us which email you signed up with.</p>
<h3>A promoter gave me their link: what do they see about me?</h3>
<p>Your name and photo, when you signed up, which offer you got and whether and when you got in. Never your email, phone number or date of birth. If you don't want to be on their list, open the venue's page without their link.</p>
<h3>Unfollowing a series</h3>
<p>On the page of any date in the series tap “You're following the series” → “Unfollow”, or go to Account → “Series you follow”. To stop notifications for all series: Settings → Notifications → “Series you follow”.</p>
<h3>I run a business and want to sign up</h3>
<p>In the app: Account → “Want to register your business?”, or on the web from the <a href="/panel/">dashboard</a>. We review it within 24–48 h. You can also email us.</p>
<h2>Legal documents</h2>
<p><a href="/en/privacy/">Privacy policy</a> · <a href="/en/terms/">Terms of use</a> · <a href="/en/business-terms/">Business terms</a> · <a href="/en/community-guidelines/">Community guidelines</a> · <a href="/en/delete-account/">Delete your account</a>. English versions are courtesy translations; the Spanish originals are the governing text.</p>
''')


# Cloudflare «Email Address Obfuscation» cambia cada correo por
# «[email protected]» y un enlace a /cdn-cgi/l/email-protection que sin
# JavaScript no se lee (y el aviso legal tiene que dar un correo que se lea
# siempre: LSSI art. 10.1.a). Todo lo que va entre estos dos comentarios lo
# deja tal cual: en las páginas que salen de aquí (legales, soporte,
# preguntas, portada…) envuelven todo el <body>; el pie de la web lo lleva
# también alrededor de su correo (functions/_lib/chrome.js).
EMAIL_OFF, EMAIL_ON = '<!--email_off-->', '<!--/email_off-->'


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
{ERRORES}
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
<meta name="theme-color" content="#0A0A0A">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="96x96" href="/assets/favicon-96.png"><link rel="manifest" href="/site.webmanifest">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/sora-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css?v=20261012">
<link rel="stylesheet" href="/assets/public.css?v=35">
{extra}
</head>
<body>
{EMAIL_OFF}
{HEADER_TPL[t['lang']].replace('{{ES}}', es_path).replace('{{EN}}', en_path)}
'''


# Errores del navegador → «Errores de la web» del admin. En el <head> y antes
# que nada; estas páginas no cargan config.js y errores.js lo pide solo si
# tiene algo que mandar. Mismo `?v=` que `ERRORES_V` en functions/_lib/page.js.
# `async`: se pide el primero y corre en cuanto llega (antes que los `defer`),
# sin frenar el primer pintado (Lighthouse lo daba como bloqueante, ~0,4 s).
ERRORES = '<script src="/assets/errores.js?v=1" async></script>'

# Solo la portada trae contenido en vivo; los documentos no lo necesitan.
LIVE_SCRIPTS = (
    '<script src="/config.js?v=3"></script>'
    '<script src="/assets/zona.js?v=1" defer></script>'
    '<script src="/assets/live.js?v=5" defer></script>'
)


# ── La barra y el pie, compartidos con las páginas dinámicas ────────────────
# Viven en `functions/_lib/chrome.js` porque allí también se usan; aquí se
# piden a node para que no haya dos menús que se vayan separando solos.
def _chrome(fn, *args):
    import json as _json
    import subprocess as _sub
    codigo = (
        "import('./functions/_lib/chrome.js').then(m=>"
        "process.stdout.write(JSON.stringify(m.%s(%s))))"
        % (fn, ','.join(_json.dumps(a) for a in args))
    )
    out = _sub.run(['node', '-e', codigo], cwd=AQUI, capture_output=True, text=True,
                   encoding='utf-8')
    if out.returncode != 0 or not out.stdout:
        raise SystemExit('No se pudo leer la barra de functions/_lib/chrome.js '
                         '(¿está node instalado?): ' + (out.stderr or '')[-300:])
    return _json.loads(out.stdout)


HEADER_TPL = {lang: _chrome('siteHeader', lang, '{{ES}}', '{{EN}}') for lang in ('es', 'en')}
FOOTER_HTML = {lang: _chrome('siteFooter', lang) for lang in ('es', 'en')}


def footer(t, only_footer=True):
    prod = ''.join(f'<a href="{h}">{l}</a>' for h, l in t['foot_links_product'])
    legal = ''.join(f'<a href="{h}">{l}</a>' for h, l in t['foot_links_legal'])
    return f'''
{FOOTER_HTML[t['lang']]}
<script>
(function(){{
  var links=document.querySelectorAll('.lang a');
  for(var i=0;i<links.length;i++){{links[i].addEventListener('click',function(){{try{{localStorage.setItem('klendar_lang',this.getAttribute('data-lang'))}}catch(e){{}}}});}}
}})();
</script>
{'' if only_footer else LIVE_SCRIPTS}
{EMAIL_ON}
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
    screens = ''.join(f'<figure><div class="phone"><img src="/assets/screens/{f}.webp?v=20260926" alt="{h}" loading="lazy" width="540" height="1212"></div><figcaption>{h}<small>{s}</small></figcaption></figure>' for f, h, s in t['screens'])
    points = ''.join(f'<li>{p}</li>' for p in t['biz_points'])
    stats = ''.join(f'<div><b>{b}</b><span>{s}</span></div>' for b, s in t['biz_stats'])
    faqs = ''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q, a in t['faqs'])
    faq_ld = '<script type="application/ld+json">' + '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[' + ','.join(
        '{"@type":"Question","name":%s,"acceptedAnswer":{"@type":"Answer","text":%s}}' % (jsq(q), jsq(a)) for q, a in t['faqs']) + ']}</script>'
    fa, fb = t['float_a'], t['float_b']
    mail = 'mailto:info@klendar.app?subject=' + ('Quiero%20dar%20de%20alta%20mi%20negocio%20en%20Klendar' if t['lang'] == 'es' else 'I%20want%20to%20list%20my%20business%20on%20Klendar')
    home_steps = ''.join(f'<div><span class="paso-num">{i}</span><h3>{h}</h3><p>{p}</p></div>' for i, (h, p) in enumerate(t['home_steps'], 1))
    body = f'''
<main id="contenido">
<section class="hero"><div class="wrap">
  <div>
    <span class="eyebrow">{t['hero_eyebrow']}</span>
    <h1>{t['hero_h1']}</h1>
    <p class="lead">{t['hero_lead']}</p>
    <div class="cta-botones">
      <a class="pill accent big" href="{t['cta_explore_url']}">{t['cta_explore']}</a>
      <a class="pill big" href="{t['cta_register_url']}" data-sin-sesion>{t['cta_register']}</a>
    </div>
    <p class="ciudades">{t['cities_label']} <span id="liveCiudades"><a href="{t['agenda_url']}">{t['cities_fallback']}</a></span></p>
    <p class="note">{t['app_note']}</p>
  </div>
  <div class="hero-visual">
    <div class="phone"><img src="/assets/screens/feed.webp?v=20261001" alt="Klendar" width="540" height="1212" fetchpriority="high"></div>
    <div class="float a">{fa[0]}<small>{fa[1]}</small></div>
    <div class="float b">{fb[0]}<small>{fb[1]}</small></div>
  </div>
</div></section>

<section id="ahora" class="live junto" hidden><div class="wrap">
  <div class="cabecera-seccion">
    <div>
      <span class="eyebrow">{t['live_eyebrow']}</span>
      <h2>{t['live_h2']} <span id="liveCity"></span></h2>
    </div>
    <a class="pill" id="liveAll" href="{t['cta_explore_url']}">{t['live_all_short']}</a>
  </div>
  <div class="tarjetas" id="liveList"></div>
</div></section>

<section id="{t['a_how']}"><div class="wrap">
  <span class="eyebrow">{t['how_eyebrow']}</span>
  <h2>{t['home_how_h2']}</h2>
  <div class="pasos">{home_steps}</div>
  <div class="screens compactas" tabindex="0" role="region" aria-label="{t['screens_h2']}">{screens}</div>
  <p class="mas"><a href="{t['how_url']}">{t['how_more']}</a></p>
</div></section>

<section id="{t['a_biz']}" class="junto"><div class="wrap">
  <div class="franja-biz">
    <div>
      <span class="eyebrow">{t['biz_eyebrow']}</span>
      <h2>{t['band_h2']}</h2>
      <p>{t['band_text']}</p>
    </div>
    <div class="botones">
      <a class="pill accent" href="{t['biz_page_url']}">{t['band_more']}</a>
      <a class="pill" href="/panel/">{t['band_panel']}</a>
    </div>
  </div>
</div></section>

<section id="{t['a_faq']}"><div class="wrap">
  <span class="eyebrow">{t['faq_eyebrow']}</span>
  <h2>{t['faq_h2']}</h2>
  <div class="faq">{faqs}</div>
  <p class="mas"><a href="{t['faq_url']}">{t['faq_all']}</a> · <a href="{t['support_url']}">{t['faq_support']}</a></p>
</div></section>

<section class="junto"><div class="wrap">
  <div class="app-caja">
    <div><h2>{t['app_h2']}</h2><p>{t['app_text']}</p></div>
    <div class="stores">
      <a class="pill ink" href="#" aria-disabled="true">▶ {t['play']}</a>
      <a class="pill ink" href="#" aria-disabled="true"> {t['appstore']}</a>
    </div>
  </div>
</div></section>
</main>
'''
    extra = jsonld + faq_ld + (LANG_REDIRECT if t['lang'] == 'es' else '')
    return head(t, path, extra=extra) + body + footer(t, only_footer=False)


def como_funciona(t):
    """Los pasos, todo lo que hace Klendar y las capturas: lo que no cabe en
    la portada. También es una puerta de entrada desde Google."""
    path = t['how_url']
    steps = ''.join(f'<div class="step"><h3>{h}</h3><p>{p}</p></div>' for h, p in t['steps'])
    feats = ''.join(f'<div class="card"><div class="ic">{i}</div><h3>{h}</h3><p>{p}</p></div>' for i, h, p in t['feats'])
    screens = ''.join(f'<figure><div class="phone"><img src="/assets/screens/{f}.webp?v=20260926" alt="{h}" loading="lazy" width="540" height="1212"></div><figcaption>{h}<small>{s_}</small></figcaption></figure>' for f, h, s_ in t['screens'])
    body = f'''
<main id="contenido">
<section class="junto" style="padding-top:48px"><div class="wrap">
  <h1 style="font-size:clamp(34px,5vw,52px);letter-spacing:-.03em;margin:0 0 12px">{t['how_title']}</h1>
  <p class="lead" style="font-size:19px;color:var(--ink-2);max-width:640px;margin:0 0 22px">{t['hero_lead']}</p>
  <div class="cta-botones">
    <a class="pill accent" href="{t['cta_explore_url']}">{t['cta_explore']}</a>
    <a class="pill" href="{t['biz_page_url']}">{t['band_more']}</a>
  </div>
</div></section>

<section><div class="wrap">
  <span class="eyebrow">{t['how_eyebrow']}</span>
  <h2>{t['how_h2']}</h2>
  <div class="steps">{steps}</div>
</div></section>

<section class="junto"><div class="wrap">
  <span class="eyebrow">{t['feat_eyebrow']}</span>
  <h2>{t['feat_h2']}</h2>
  <div class="grid">{feats}</div>
</div></section>

<section><div class="wrap">
  <span class="eyebrow">{t['screens_eyebrow']}</span>
  <h2>{t['screens_h2']}</h2>
  <div class="screens">{screens}</div>
  <p class="mas"><a href="{t['faq_url']}">{t['faq_all']}</a> · <a href="{t['support_url']}">{t['faq_support']}</a></p>
</div></section>
</main>
'''
    return head(t, path, f"{t['how_title']} · Klendar", t['how_desc']) + body + footer(t)


def jsq(s):
    import json
    return json.dumps(s, ensure_ascii=False)


def doc_page(t, path, title, desc, body):
    return head(t, path, f'{title} · Klendar', desc) + f'''
<main class="doc" id="contenido">
<h1>{title}</h1>
{body}
</main>
''' + footer(t)


# ── robots.txt y sitemap.xml ────────────────────────────────────────────────
# Aquí solo van las páginas estáticas: /admin/ es privado y /r/ es un enlace
# profundo. Las que se generan al vuelo tienen su sitemap dinámico: ciudades,
# «hoy» y categorías en /sitemap-agenda.xml y las fichas de negocio (/b/) en
# /sitemap-negocios.xml (vacíos mientras la web enseña los datos de dev).
SITEMAP_ES = ['/', '/como-funciona/', '/descubre/', '/explorar/', '/agenda/', '/para-negocios/', '/precios/', '/preguntas/', '/prensa/', '/sobre/', '/accesibilidad/', '/estado/', '/negocios/', '/soporte/', '/privacidad/', '/terminos/', '/aviso-legal/', '/cookies/', '/normas/', '/eliminar-cuenta/']
SITEMAP_EN = ['/en/', '/en/how-it-works/', '/en/discover/', '/en/explore/', '/en/whats-on/', '/en/for-business/', '/en/pricing/', '/en/faq/', '/en/press/', '/en/about/', '/en/accessibility/', '/en/status/', '/en/business-terms/', '/en/support/', '/en/privacy/', '/en/terms/', '/en/legal-notice/', '/en/cookies/', '/en/community-guidelines/', '/en/delete-account/']
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
        f'Sitemap: {BASE}/sitemap-negocios.xml',
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
    os.makedirs('como-funciona', exist_ok=True)
    os.makedirs('en/how-it-works', exist_ok=True)
    io.open('como-funciona/index.html', 'w', encoding='utf-8', newline='\n').write(como_funciona(T['es']))
    io.open('en/how-it-works/index.html', 'w', encoding='utf-8', newline='\n').write(como_funciona(T['en']))
    io.open('robots.txt', 'w', encoding='utf-8', newline=chr(10)).write(robots())
    io.open('sitemap.xml', 'w', encoding='utf-8', newline=chr(10)).write(sitemap())
    print('ok: index.html, en/index.html, en/support/index.html, robots.txt, sitemap.xml')

    # «Tu cuenta» (/app/) es una sola página con los dos idiomas: lleva las
    # dos cabeceras y los dos pies, y el propio app.js enseña la que toca.
    # Se estampan aquí para que el menú sea el mismo que en el resto.
    import re as _re
    ruta = os.path.join('app', 'index.html')
    if os.path.exists(ruta):
        app = io.open(ruta, encoding='utf-8').read()
        trozos = {
            # En «Tu cuenta» el contenido es <main id="view">: «Saltar al
            # contenido» va ahí (en las demás páginas, a #contenido).
            'CABECERA-ES': '<div data-only="es">' + HEADER_TPL['es'].replace('{{ES}}', '/app/?lang=es').replace('{{EN}}', '/app/?lang=en').replace('href="#contenido"', 'href="#view"') + '</div>',
            'CABECERA-EN': '<div data-only="en" hidden>' + HEADER_TPL['en'].replace('{{ES}}', '/app/?lang=es').replace('{{EN}}', '/app/?lang=en').replace('href="#contenido"', 'href="#view"') + '</div>',
            'PIE-ES': '<div data-only="es">' + FOOTER_HTML['es'] + '</div>',
            'PIE-EN': '<div data-only="en" hidden>' + FOOTER_HTML['en'] + '</div>',
        }
        for marca, html_ in trozos.items():
            app = _re.sub(r'<!--%s-->.*?<!--/%s-->' % (marca, marca),
                          lambda _m, h=html_, m=marca: '<!--%s-->%s<!--/%s-->' % (m, h, m),
                          app, flags=_re.S)
        io.open(ruta, 'w', encoding='utf-8', newline=chr(10)).write(app)
        print('ok: app/index.html (cabecera y pie)')
