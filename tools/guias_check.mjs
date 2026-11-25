// Guías de temporada generales (Iván, 2026-11-17; migraciones 20261283800000
// y 20261283900000 de la app): lo que la web tiene que hacer igual que la
// app. Sin navegador ni red: las páginas con un Supabase de mentira (fetch
// simulado) y la lectura del código del panel, el admin y Descubre. Lo de la
// base (quién puede qué, el mínimo de planes), en la app: tool/guias_smoke.py.
//
//   1. /guia/<slug>/<municipio>: «Navidad en Málaga», lo de ese municipio,
//      filtros normales, OG, indexable; /en/guide/… su gemela. Sin planes
//      en ese municipio: 404 con noindex.
//   2. /guia/<slug>: lo de la zona del visitante (`?lat=&lng=&km=` o la
//      conexión, sin caché compartida) y «Elige tu sitio»; `?ciudad=` → 301
//      a la página del municipio. Terminada: «Esta guía ha terminado».
//   3. Descubre (web): la franja, sobria y con la zona de Descubre.
//   4. Panel: «Añadir a «…»» solo con «Para todos», desmarcada.
//   5. Admin: ámbito, «… en {sitio}», portada, publicaciones por sitio;
//      sitemap con una página por municipio.
//
//   node tools/guias_check.mjs
import { readFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const lee = (f) => readFileSync(new URL(f, raiz), 'utf8');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};

const COVER = 'https://falso.supabase.example/storage/v1/object/public/business-images/guides/g1/portada.jpg';
const guia = (extra = {}) => ({
  id: 'g1', slug: 'navidad', title: { es: 'Navidad', en: 'Christmas' }, title_place: true,
  text: { es: 'Luces, belenes y mercadillos.' }, cover_url: COVER, place_name: null, scope_name: null,
  starts_on: '2026-12-01', ends_on: '2027-01-06', status: 'live', count: 5, ...extra,
});
const hora = (h) => new Date(Date.now() + h * 36e5).toISOString();
const item = (id, titulo, kind = 'future_event') => ({
  id, kind, title: titulo, business_id: 'b1', business_name: 'Café Central', business_logo: null,
  starts_at: hora(24), event_at: kind === 'future_event' ? hora(24) : null, redeem_start_at: kind === 'flash_offer' ? hora(-1) : null,
  redeem_end_at: kind === 'flash_offer' ? hora(3) : null, images: [], price_cents: 0, currency: 'EUR', city: 'Málaga',
  lat: 36.72, lng: -4.42, audience: 'all', is_boosted: false, destacado: false, imported: false,
});
const SITIOS = [
  { code: '29067', slug: 'malaga', name: 'Málaga', province: 'Málaga', count: 3 },
  ...Array.from({ length: 14 }, (_, i) => ({ code: `280${10 + i}`, slug: `pueblo-${i}`, name: `Pueblo ${i}`, province: 'Madrid', count: 1 })),
];
let estado = guia();
const pedidas = [];
globalThis.fetch = async (url, op = {}) => {
  const u = String(url);
  const body = op.body ? JSON.parse(op.body) : {};
  pedidas.push({ u, body });
  const json = (d) => new Response(JSON.stringify(d), { status: 200, headers: { 'content-type': 'application/json' } });
  if (u.endsWith('/rpc/guide_info')) {
    if (body.p_slug !== 'navidad') return json(null);
    return json({ ...estado, place_name: body.p_lat != null ? 'Málaga' : null });
  }
  if (u.endsWith('/rpc/guide_places')) return json(body.p_slug === 'navidad' ? SITIOS : []);
  if (u.endsWith('/rpc/guide_offers')) {
    const todas = [item('o1', 'Belén viviente'), item('o2', 'Chocolate con churros', 'flash_offer')];
    const f = body.p_filters || {};
    const items = todas.filter((o) => !f.kind || o.kind === f.kind);
    return json({ total: items.length, items });
  }
  if (u.includes('/rpc/')) return json(null);
  return json([]);
};
const { configure } = await import('../functions/_lib/page.js');
configure({ SUPABASE_URL: 'https://falso.supabase.example', SUPABASE_KEY: 'clave-publica' });
const { guiaPage, bannerGuia, tituloGuia } = await import('../functions/_lib/guias.js');
const { altPath } = await import('../functions/_lib/public.js');
const pagina = async (ruta, lang = 'es', request = null) => {
  const url = new URL(`https://klendar.app${ruta}`);
  const partes = url.pathname.split('/').filter(Boolean).slice(lang === 'en' ? 2 : 1);
  const r = await guiaPage(partes[0], partes[1] ?? null, url, lang, request);
  return { r, h: r.status === 301 ? '' : await r.text() };
};
const ultima = (fn) => pedidas.filter((p) => p.u.endsWith(`/rpc/${fn}`)).pop()?.body;

// 1
{
  const { r, h } = await pagina('/guia/navidad/malaga');
  ok('1. municipio: «Navidad en Málaga», 200, con su texto y fechas', r.status === 200 && h.includes('<h1>Navidad en Málaga</h1>')
    && h.includes('1 dic – 6 ene') && h.includes('Luces, belenes y mercadillos.'));
  ok('1. la pestaña «Navidad en Málaga · Klendar»', h.includes('<title>Navidad en Málaga · Klendar</title>'));
  ok('1. solo lo de ese municipio', ultima('guide_offers')?.p_filters?.municipality === '29067' && h.includes('Belén viviente'));
  ok('1. OG con la portada', h.includes(`<meta property="og:image" content="${COVER}">`));
  ok('1. indexable, canónica y gemela en inglés', !h.includes('noindex')
    && h.includes('<link rel="canonical" href="https://klendar.app/guia/navidad/malaga">')
    && h.includes('hreflang="en" href="https://klendar.app/en/guide/navidad/malaga"'));
  ok('1. migas: Klendar › Navidad › Navidad en Málaga', h.includes('"@type":"BreadcrumbList"') && h.includes('<a href="/guia/navidad">Navidad</a>'));
  ok('1. los filtros normales', h.includes('?cuando=finde') && h.includes('?tipo=eventos'));
  const f = await pagina('/guia/navidad/malaga?tipo=eventos');
  ok('1. con filtro: a la base y noindex', ultima('guide_offers')?.p_filters?.kind === 'future_event'
    && !f.h.includes('Chocolate con churros') && f.h.includes('noindex'));
  // El tipo, sin «Todo» y de varios a la vez (§4zzz-chips).
  ok('1. el tipo sin «Todo», con aria-pressed', !/>Todo<\/a>/.test(h) && /role="button" aria-pressed="false" rel="nofollow">Eventos</.test(h));
  ok('1. con Eventos, pulsado', /aria-pressed="true" rel="nofollow">Eventos</.test(f.h));
  const dos = await pagina('/guia/navidad/malaga?tipo=eventos&tipo=ofertas');
  ok('1. con los dos: todo, los dos pulsados y en orden fijo', ultima('guide_offers')?.p_filters?.kind === undefined
    && dos.h.includes('Chocolate con churros') && (dos.h.match(/aria-pressed="true"/g) || []).length === 2
    && dos.h.includes('?cuando=finde&amp;tipo=ofertas&amp;tipo=eventos'));
  const viejo = await pagina('/guia/navidad/malaga?tipo=todos');
  ok('1. el ?tipo=todos de antes = todo', ultima('guide_offers')?.p_filters?.kind === undefined && !/aria-pressed="true"/.test(viejo.h));
  const en = await pagina('/en/guide/navidad/malaga', 'en');
  ok('1. en inglés: «Christmas in Málaga»', en.h.includes('<h1>Christmas in Málaga</h1>'));
  const sin = await pagina('/guia/navidad/zaragoza');
  ok('1. un municipio sin planes: 404 con noindex', sin.r.status === 404 && sin.h.includes('noindex'));
  ok('1. /guia/x/y ⇄ /en/guide/x/y', altPath('/guia/x/y', 'es') === '/en/guide/x/y' && altPath('/en/guide/x/y', 'en') === '/guia/x/y');
  ok('1. sin coral (no hay botón principal)', !h.includes('pill accent'));
  estado = guia({ title_place: false });
  const apagada = await pagina('/guia/navidad/malaga');
  ok('1. «… en {sitio}» apagada: el título tal cual y el sitio aparte', apagada.h.includes('<h1>Navidad</h1>')
    && apagada.h.includes('Málaga · 1 dic – 6 ene'));
  estado = guia();
}

// 2
{
  const sinZona = await pagina('/guia/navidad');
  ok('2. general sin zona: «Navidad» y «Elige tu sitio»', sinZona.h.includes('<h1>Navidad</h1>') && sinZona.h.includes('Elige tu sitio')
    && sinZona.h.includes('href="/guia/navidad/malaga"') && sinZona.h.includes('Málaga · 3'));
  ok('2. …más de 12 sitios: el desplegable (sin JavaScript, ?ciudad=)', sinZona.h.includes('<select id="guiaSitio" name="ciudad">'));
  ok('2. …indexable y en caché compartida', !sinZona.h.includes('noindex') && /public/.test(sinZona.r.headers.get('cache-control')));
  const red = await pagina('/guia/navidad?ciudad=malaga');
  ok('2. ?ciudad= → 301 a la página del municipio', red.r.status === 301 && red.r.headers.get('location') === '/guia/navidad/malaga');
  // La zona de Descubre es su celda (§4zzz-ubicacion-web2): desde su centro, con la distancia y la mitad de su diagonal.
  const KCe = (await import('../assets/celda.js')).default;
  const celda = KCe.de(36.72, -4.42);
  const vieja = await pagina('/guia/navidad?lat=36.72&lng=-4.42&km=10');
  ok('2. un enlace de antes con ?lat=&lng=: 301 a su celda', vieja.r.status === 301 && vieja.r.headers.get('location') === `/guia/navidad?km=10&celda=${celda}`);
  const zona = await pagina(`/guia/navidad?celda=${celda}&km=10`);
  ok('2. la zona de Descubre: «Navidad en Málaga» y lo de 10 km (más la mitad de la celda)', zona.h.includes('<h1>Navidad en Málaga</h1>')
    && ultima('guide_offers')?.p_filters?.radius_m === 10000 + KCe.margenM(celda) && ultima('guide_offers')?.p_lat === KCe.centro(celda).lat);
  ok('2. …la misma para toda la celda: en caché compartida, sin buscadores ni contador', /public/.test(zona.r.headers.get('cache-control')) && zona.h.includes('noindex')
    && !zona.h.includes('cloudflareinsights') && sinZona.h.includes('cloudflareinsights'));
  ok('2. …los filtros conservan la celda', zona.h.includes(`?celda=${celda}&amp;km=10&amp;cuando=`));
  ok('2. …recupera la zona guardada solo sin municipio', zona.h.includes('/assets/recupera-zona.js?v=2') && !(await pagina('/guia/navidad/malaga')).h.includes('recupera-zona'));
  const conexion = await pagina('/guia/navidad', 'es', new Request('https://klendar.app/guia/navidad', { cf: { country: 'ES', latitude: '36.7', longitude: '-4.4' } }));
  const req = new Request('https://klendar.app/guia/navidad');
  Object.defineProperty(req, 'cf', { value: { country: 'ES', latitude: '36.7', longitude: '-4.4' } });
  const porConexion = await guiaPage('navidad', null, new URL('https://klendar.app/guia/navidad'), 'es', req);
  const ph = await porConexion.text();
  ok('2. …o la de la conexión, sin caché compartida', ph.includes('Navidad en Málaga') && /private/.test(porConexion.headers.get('cache-control'))
    && /CF-Connecting-IP/.test(porConexion.headers.get('vary') || '') && conexion.r.status === 200);
  estado = guia({ status: 'ended' });
  const fin = await pagina('/guia/navidad/malaga');
  ok('2. terminada: lo dice y lleva a Descubre (coral solo ahí), noindex', fin.r.status === 200 && fin.h.includes('Esta guía ha terminado')
    && fin.h.includes('<a class="pill accent" href="/descubre">Ir a Descubre</a>') && fin.h.includes('noindex'));
  estado = guia({ status: 'soon' });
  const pronto = await pagina('/guia/navidad/malaga');
  ok('2. por empezar: «Empieza el …»', /Empieza el martes,? 1 de diciembre/.test(pronto.h));
  estado = guia();
  ok('2. una guía que no existe: 404', (await pagina('/guia/no-existe')).r.status === 404);
  ok('2. un slug raro: 404 sin preguntar', (await pagina('/guia/Mal%20Slug')).r.status === 404);
}

// 3
{
  const g = guia({ place_name: 'Málaga', count: 4 });
  const b = bannerGuia(g, 'es', '?ciudad=malaga');
  ok('3. la franja: «Navidad en Málaga», fechas, planes y «Ver la guía»', b.includes('Navidad en Málaga') && b.includes('1 dic – 6 ene · 4 planes')
    && b.includes('href="/guia/navidad?ciudad=malaga"') && b.includes('Ver la guía'));
  ok('3. sobria: sin coral', !/accent|coral/.test(b));
  ok('3. sin guía, nada', bannerGuia(null, 'es') === '');
  ok('3. «… en {sitio}» en inglés', tituloGuia(g, 'en') === 'Christmas in Málaga');
  const explore = lee('functions/_lib/explore.js');
  ok('3. Descubre la pide con su zona (punto y distancia, o la ciudad entera)', explore.includes("rpc('current_guide'")
    && explore.includes('p_radius_m: cerca ? radioM : centroCiudad?.radius_m || RADIO_CIUDAD_M')
    && /\$\{guiaHtml\}\s*\$\{resultados\}/.test(explore));
}

// 4
{
  const panel = lee('panel/panel.js');
  const g = lee('panel/guias.js');
  ok('4. el bloque, fuera de «Más opciones»', panel.includes("${guiasHtml()}\n      ${bloque('bMas'"));
  ok('4. solo con «Para todos»', g.includes("que().audiencia === 'all' ? guias.filter"));
  ok('4. desmarcada salvo que ya esté', g.includes('(elegido[g.id] ?? g.on)'));
  ok('4. se guarda con la publicación', panel.includes('await guias.guarda(offerId)') && g.includes("rpc('set_offer_guide'"));
  ok('4. el script, en el panel', /<script src="\/panel\/guias\.js\?v=[0-9a-f]+"><\/script>/.test(lee('panel.html')));
}

// 5
{
  const a = lee('admin/guias.js');
  ok('5. en el menú de Contenido', lee('admin/admin.js').includes("['guias', 'menu_book', 'Guías']"));
  ok('5. ámbito: toda España, comunidades y provincias', a.includes("rpc('admin_guide_places', { p_q: '' })")
    && a.includes("p_place: form.elements.ambito.value || null"));
  ok('5. «… en {sitio}», que se puede apagar', a.includes('p_title_place: form.elements.title_place.checked'));
  ok('5. la portada, en guides/<id>/', a.includes('`guides/${id}/${crypto.randomUUID()}.${ext}`'));
  ok('5. publicaciones: filtrar por sitio, añadir y quitar', a.includes('id="guSitio"') && a.includes("rpc('admin_collection_add'")
    && a.includes("rpc('admin_collection_remove'"));
  const sm = lee('functions/sitemap-guias.xml.js');
  ok('5. sitemap: cada guía y una página por municipio', sm.includes('sitiosDeGuia(g.slug)') && sm.includes('/guia/${g.slug}/${m.slug}')
    && lee('robots.txt').includes('Sitemap: https://klendar.app/sitemap-guias.xml'));
  ok('5. la app abre el enlace (iOS)', lee('.well-known/apple-app-site-association').includes('"/guia/*"'));
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
