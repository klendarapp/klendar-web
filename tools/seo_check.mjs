// Lo de los buscadores (Iván, 18-11: «que las páginas de negocios y eventos
// salgan en las búsquedas de Málaga»), con la web local y la base simulada
// (tools/_web_con_datos.mjs; sin red ni Supabase):
//
//  1. Cada dirección de cada sitemap (agenda, negocios, planes, guías,
//     artistas y el estático) tiene su pareja en el otro idioma como <url>
//     propia (lo que pide Bing y recomienda Google), con el mismo trío de
//     hreflang es/en/x-default y la misma fecha; las dos se abren con 200 y SE
//     PUEDEN INDEXAR: sin noindex ni en la página ni en la cabecera, con
//     canonical a sí mismas y el mismo hreflang que el sitemap. Y ninguno pasa
//     de 50 000 URL ni de 50 MB.
//  2. Sus datos estructurados (JSON-LD) se leen y cuadran con schema.org: tipos
//     conocidos (los de LocalBusiness por categoría de _lib/seo.js), lo que
//     Google pide de cada uno (Event: nombre, fecha, sitio con dirección;
//     negocio: nombre y dirección o punto; migas en orden y con direcciones
//     de klendar.app; valoración real entre 1 y 5) y fechas ISO.
//  3. Lo vacío o con poco no se indexa y no sale en el sitemap: un municipio
//     sin nada, uno con un solo plan (por debajo del umbral), una categoría
//     con uno, una oferta terminada, una ficha cerrada, una provincia sin
//     contenido (404).
//  4. Lo mismo sin las funciones nuevas de la base (prod antes de la
//     migración 20261285900000): los sitemaps siguen sin direcciones noindex.
//  5. Los sitemaps y las páginas nuevas van a la caché del borde (EN_CACHE) y
//     robots.txt los nombra todos.
//
//   node tools/seo_check.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { DATOS, webConDatos } from './_web_con_datos.mjs';
import { EN_CACHE } from '../functions/_lib/cache.js';
import { TIPOS_SCHEMA, UMBRALES } from '../functions/_lib/seo.js';

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos += 1; console.log('FALLA:', m); } else if (process.env.VERBOSO) console.log('ok:', m); };

// ── Los datos: los de serie y lo que hace falta para probar los umbrales ──
const AHORA = Date.now();
const iso = (h) => new Date(AHORA + h * 3600e3).toISOString();
const id = (pre, n) => `${pre}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const cat = (slug) => DATOS.CATEGORIAS.find((c) => c.slug === slug);
const HORARIO = { 1: [['09:00', '14:00'], ['17:00', '23:30']], 2: [['09:00', '23:30']], 3: [], 4: [['09:00', '02:00']], 5: [['09:00', '02:00']], 6: [['10:00', '02:00']], 7: [] };
const NEGOCIOS = [
  ...DATOS.NEGOCIOS.map((b, i) => (i === 0 ? { ...b, opening_hours: HORARIO, address: 'Calle de Prueba 1, 28013 Madrid', phone: '+34 600 000 000' } : b)),
  // Málaga: un tercer local, para que tenga contenido (Taberna y Chiringuito ya están).
  { ...DATOS.NEGOCIOS[6], id: id('b9100000', 1), name: 'Peluquería Brisa', slug: 'peluqueria-brisa-malaga', category_id: cat('beauty').id, category_slug: 'beauty', rating: null, ratings: 0 },
  // Alcobendas: un solo plan (por debajo del umbral del municipio).
  { ...DATOS.NEGOCIOS[0], id: id('b9100000', 2), name: 'Bar Solo', slug: 'bar-solo-alcobendas', city: 'Alcobendas', city_id: null, lat: 40.5475, lng: -3.642 },
  // Cerrado hasta nuevo aviso: su ficha va con noindex y no sale en el sitemap.
  { ...DATOS.NEGOCIOS[1], id: id('b9100000', 3), name: 'Bar Cerrado', slug: 'bar-cerrado-madrid', closed_indefinitely: true },
];
const neg = (slug) => NEGOCIOS.find((b) => b.slug === slug);
const plan = (n, b, extra) => ({
  ...DATOS.PLANES[0], id: id('a9100000', n), business_id: b.id, business_name: b.name, business_slug: b.slug, business_city: b.city,
  business_address: b.address, city: b.city, lat: b.lat, lng: b.lng, category_id: b.category_id, category_slug: b.category_slug,
  adults_only: false, imported: false, traits: [], ...extra,
});
const PLANES = [
  ...DATOS.PLANES,
  plan(1, neg('peluqueria-brisa-malaga'), { kind: 'flash_offer', title: 'Corte −30 %', discount: { type: 'percent', value: 30 }, starts_at: iso(-1), redeem_start_at: iso(-1), redeem_end_at: iso(5) }),
  plan(2, neg('taberna-del-puerto-malaga'), { kind: 'future_event', title: 'Flamenco en la taberna', event_at: iso(30), starts_at: iso(30), price_cents: 1500 }),
  plan(3, neg('bar-solo-alcobendas'), { kind: 'flash_offer', title: 'Caña y tapa', starts_at: iso(-1), redeem_start_at: iso(-1), redeem_end_at: iso(3) }),
  // Terminada: la ficha se abre, con noindex; no sale en el sitemap de planes.
  plan(4, neg('bar-sonda-madrid'), { kind: 'flash_offer', title: 'Oferta de ayer', starts_at: iso(-30), redeem_start_at: iso(-30), redeem_end_at: iso(-26) }),
];
const TERMINADA = id('a9100000', 4);
const datos = { ...DATOS, NEGOCIOS, PLANES };
// La agenda de un municipio como la base (`public_city_agenda`): lo visible
// que empieza en los próximos 8 días, sin +18 (la de serie de la base
// simulada solo da lo importado).
const plano = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const agenda = (a) => PLANES.filter((o) => !o.adults_only && plano(o.city) === plano(a.p_city)
  && Date.parse(o.event_at || o.redeem_start_at || o.starts_at) < AHORA + 8 * 864e5
  && Date.parse(o.redeem_end_at || o.event_end_at || iso(1000)) > AHORA);

// ── schema.org: lo que se usa y lo que pide Google ───────────────────────
const TIPOS = new Set([...TIPOS_SCHEMA, 'Organization', 'Event', 'Offer', 'Place', 'PostalAddress', 'GeoCoordinates', 'AggregateRating',
  'OpeningHoursSpecification', 'BreadcrumbList', 'ListItem', 'CollectionPage', 'ItemList', 'WebSite', 'City', 'AdministrativeArea',
  'Country', 'PerformingGroup', 'Person', 'MobileApplication', 'FAQPage', 'Question', 'Answer', 'WebPage', 'MusicGroup']);
const DE_NEGOCIO = new Set([...TIPOS_SCHEMA]);
const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const KL = /^https:\/\/klendar\.app(\/|$)/;

function nodos(x, out = []) {
  if (Array.isArray(x)) { x.forEach((y) => nodos(y, out)); return out; }
  if (x && typeof x === 'object') { if (x['@type']) out.push(x); Object.values(x).forEach((y) => nodos(y, out)); }
  return out;
}

/** Los problemas de los datos estructurados de una página ([] si ninguno). */
function revisaLd(bloques) {
  const mal = [];
  for (const b of bloques) {
    if (b['@context'] !== 'https://schema.org') mal.push('sin @context de schema.org');
    for (const n of nodos(b)) {
      const t = n['@type'];
      for (const tt of [].concat(t)) if (!TIPOS.has(tt)) mal.push(`tipo desconocido: ${tt}`);
      if (t === 'Event') {
        if (!n.name || !n.startDate || !ISO.test(n.startDate)) mal.push('Event sin nombre o fecha ISO');
        if (n.endDate && !ISO.test(n.endDate)) mal.push('Event con endDate que no es ISO');
        if (!n.location?.name || !(n.location.address)) mal.push('Event sin sitio con dirección');
        if (n.eventStatus && !/^https:\/\/schema\.org\/Event(Scheduled|Cancelled|Postponed|Rescheduled|MovedOnline)$/.test(n.eventStatus)) mal.push('eventStatus raro');
        if (n.offers && (n.offers.price == null || !n.offers.priceCurrency)) mal.push('Event con entrada sin precio o moneda');
      }
      if (DE_NEGOCIO.has(t)) {
        if (!n.name || !(n.address || n.geo)) mal.push(`${t} sin nombre o sin dirección/punto`);
        if (n.url && !KL.test(n.url)) mal.push(`${t} con url de fuera`);
      }
      if (t === 'PostalAddress' && n.addressCountry !== 'ES') mal.push('dirección sin país');
      if (t === 'AggregateRating') {
        const v = Number(n.ratingValue);
        if (!(v >= 1 && v <= 5) || !(Number(n.reviewCount) >= 1)) mal.push(`valoración rara ${n.ratingValue}/${n.reviewCount}`);
      }
      if (t === 'OpeningHoursSpecification' && (!/^https:\/\/schema\.org\/(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/.test(n.dayOfWeek) || !/^\d{2}:\d{2}$/.test(n.opens) || !/^\d{2}:\d{2}$/.test(n.closes))) mal.push('horario mal escrito');
      if (t === 'BreadcrumbList') {
        (n.itemListElement || []).forEach((li, i) => {
          if (li.position !== i + 1 || !li.name || !KL.test(li.item || '')) mal.push(`miga ${i + 1} mal`);
        });
      }
      if (t === 'GeoCoordinates' && !(Number.isFinite(n.latitude) && Number.isFinite(n.longitude))) mal.push('punto sin números');
      if (t === 'Offer' && n.price != null && !/^\d+(\.\d{1,2})?$/.test(String(n.price))) mal.push(`precio raro: ${n.price}`);
    }
  }
  return mal;
}

// ── Lo de cada página ──────────────────────────────────────────────────────
const metaRobots = (t) => (t.match(/<meta name="robots" content="([^"]*)"/g) || []).map((m) => m.match(/content="([^"]*)"/)[1]).join(', ');
const enlace = (t, rel, lang) => {
  const re = lang
    ? new RegExp(`<link rel="alternate" hreflang="${lang}" href="([^"]+)"`)
    : new RegExp(`<link rel="${rel}" href="([^"]+)"`);
  return (re.exec(t) || [])[1] || null;
};
const ldDe = (t) => [...t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => {
  try { return JSON.parse(m[1]); } catch { return { '@context': 'roto' }; }
});

async function pagina(web, ruta) {
  const r = await fetch(web.BASE + ruta, { redirect: 'manual', headers: { 'accept-language': 'es' } });
  const t = await r.text();
  return { status: r.status, cabecera: r.headers.get('x-robots-tag') || '', t, robots: metaRobots(t) };
}
const noindex = (p) => /noindex/.test(p.robots) || /noindex/.test(p.cabecera);

// Lo que cabe en un sitemap (sitemaps.org): 50 000 direcciones y 50 MB sin comprimir.
const TOPE_URLS = 50000;
const TOPE_BYTES = 50 * 1024 * 1024;

/** Las entradas de un sitemap: cada <url> con su <loc> y su trío de hreflang. */
async function entradasDe(web, ruta) {
  const r = await fetch(web.BASE + ruta);
  const t = await r.text();
  ok(r.status === 200 && t.startsWith('<?xml') && t.includes('<urlset'), `${ruta}: XML con su urlset`);
  ok((r.headers.get('cache-control') || '').includes(ruta === '/sitemap.xml' ? '' : 's-maxage'), `${ruta}: con s-maxage (caché del borde)`);
  const des = (x) => (x || '').replace(/&amp;/g, '&');
  const alt = (b, lang) => des((new RegExp(`<xhtml:link rel="alternate" hreflang="${lang}" href="([^"]+)"`).exec(b) || [])[1]);
  const entradas = [...t.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, b]) => ({
    loc: des((/<loc>([^<]+)<\/loc>/.exec(b) || [])[1]),
    lastmod: (/<lastmod>([^<]+)<\/lastmod>/.exec(b) || [])[1] || null,
    es: alt(b, 'es'), en: alt(b, 'en'), xd: alt(b, 'x-default'),
  }));
  ok(entradas.length <= TOPE_URLS && Buffer.byteLength(t) <= TOPE_BYTES, `${ruta}: dentro de 50 000 URL y 50 MB (${entradas.length})`);
  return entradas;
}

const SITEMAPS = ['/sitemap.xml', '/sitemap-agenda.xml', '/sitemap-negocios.xml', '/sitemap-planes.xml', '/sitemap-guias.xml', '/sitemap-artistas.xml'];

/** Cada dirección de los sitemaps tiene su pareja en el otro idioma (su propio
 * <url>, con el mismo trío es/en/x-default y la misma fecha), las dos se
 * abren con 200, se pueden indexar, llevan canonical a sí mismas y el mismo
 * hreflang que el sitemap; y sus datos estructurados cuadran. */
async function revisaSitemaps(web, etiqueta) {
  const todas = [];
  for (const s of SITEMAPS) {
    const entradas = await entradasDe(web, s);
    const porLoc = new Map(entradas.map((e) => [e.loc, e]));
    ok(porLoc.size === entradas.length, `${etiqueta} ${s}: sin direcciones repetidas`);
    let es = 0; let en = 0;
    for (const e of entradas) {
      const ruta = new URL(e.loc).pathname;
      const espanola = e.loc === e.es;
      if (espanola) es += 1; else en += 1;
      ok(e.es && e.en && e.xd === e.es && (espanola || e.loc === e.en), `${etiqueta} ${s}: ${ruta} con hreflang es/en/x-default y él entre ellos`);
      ok(espanola ? !/^\/en(\/|$)/.test(ruta) : /^\/en(\/|$)/.test(ruta), `${etiqueta} ${s}: ${ruta} en su idioma`);
      const pareja = porLoc.get(espanola ? e.en : e.es);
      ok(pareja && pareja.es === e.es && pareja.en === e.en && pareja.xd === e.xd && pareja.lastmod === e.lastmod,
        `${etiqueta} ${s}: ${ruta} tiene su pareja en el otro idioma con el mismo trío (${espanola ? e.en : e.es})`);
      todas.push([s, e]);
    }
    ok(es === en, `${etiqueta} ${s}: tantas en español como en inglés (${es}/${en})`);
  }
  ok(todas.length > 10, `${etiqueta}: los sitemaps traen direcciones (${todas.length})`);
  for (const [s, e] of todas) {
    const u = e.loc;
    const ruta = new URL(u).pathname;
    const p = await pagina(web, ruta);
    ok(p.status === 200, `${etiqueta} ${s}: ${ruta} da ${p.status}`);
    if (p.status !== 200) continue;
    ok(!noindex(p), `${etiqueta} ${s}: ${ruta} va con noindex (${p.robots} · ${p.cabecera})`);
    const can = enlace(p.t, 'canonical');
    ok(can === u, `${etiqueta} ${ruta}: canonical ${can}`);
    const es = enlace(p.t, null, 'es');
    const en = enlace(p.t, null, 'en');
    const xd = enlace(p.t, null, 'x-default');
    ok(es === e.es && en === e.en && xd === e.xd, `${etiqueta} ${ruta}: el hreflang de la página es el del sitemap (${es} · ${en} · ${xd})`);
    const ld = ldDe(p.t);
    if (/^\/(en\/)?(o|b)\//.test(ruta)) ok(ld.length > 0, `${etiqueta} ${ruta}: con datos estructurados`);
    const mal = revisaLd(ld);
    ok(!mal.length, `${etiqueta} ${ruta}: JSON-LD ${mal.join('; ')}`);
  }
  return todas.map(([, e]) => new URL(e.loc).pathname);
}

// ── 1–3. Con las funciones nuevas ───────────────────────────────────────────
const web = await webConDatos({ puerto: Number(process.env.PORT || 9041), datos, rpc: { public_city_agenda: agenda } });
try {
  const rutas = await revisaSitemaps(web, 'con la base nueva');
  const esta = (r) => rutas.includes(r);
  // Lo que tiene que estar.
  for (const r of ['/hoy/madrid', '/agenda/madrid', '/ofertas/madrid', '/hoy/malaga', '/agenda/malaga', '/ofertas/malaga', '/provincia/madrid', '/b/peluqueria-brisa-malaga', `/o/${id('a9100000', 2)}`]) {
    ok(esta(r), `en el sitemap: ${r}`);
  }
  // Lo que no: poco contenido, terminado, cerrado, de revisión.
  for (const r of ['/hoy/alcobendas', '/agenda/alcobendas', '/ofertas/alcobendas', '/agenda/malaga/beauty', '/hoy/teruel', '/hoy/barcelona',
    `/o/${TERMINADA}`, '/b/bar-cerrado-madrid', '/provincia/malaga']) {
    ok(!esta(r), `fuera del sitemap: ${r}`);
  }
  // Y esas páginas llevan noindex (o no existen).
  for (const r of ['/hoy/alcobendas', '/agenda/alcobendas', '/ofertas/alcobendas', '/en/deals/alcobendas', '/agenda/malaga/beauty', '/hoy/teruel',
    '/agenda/teruel', '/con-ninos/teruel', `/o/${TERMINADA}`, `/en/o/${TERMINADA}`, '/b/bar-cerrado-madrid', '/provincia/malaga']) {
    const p = await pagina(web, r);
    ok(p.status === 404 || (p.status === 200 && noindex(p)), `${r}: noindex o 404 (${p.status} · ${p.robots})`);
    if (p.status === 200) ok(!ldDe(p.t).some((b) => nodos(b).some((n) => n['@type'] === 'Event' || n['@type'] === 'Offer')) || /\/(hoy|agenda|ofertas|deals)\//.test(r), `${r}: sin Event ni Offer`);
  }
  for (const r of ['/provincia/teruel', '/provincia/no-existe', '/en/province/no-existe']) {
    ok((await pagina(web, r)).status === 404, `${r}: 404`);
  }
  // La ficha con categoría, horario y valoración: su tipo y lo que pide Google.
  const bar = await pagina(web, '/b/bar-sonda-madrid');
  const nb = ldDe(bar.t).flatMap((b) => nodos(b)).find((n) => n['@type'] === 'BarOrPub');
  ok(nb && nb.openingHoursSpecification?.length === 6 && nb.priceRange === '€€' && nb.address?.postalCode === '28013'
    && nb.aggregateRating?.bestRating === 5 && nb.telephone, 'Bar Sonda: BarOrPub con horario, precio, código postal, teléfono y valoración');
  const pelu = await pagina(web, '/b/peluqueria-brisa-malaga');
  const np = ldDe(pelu.t).flatMap((b) => nodos(b)).find((n) => n['@type'] === 'BeautySalon');
  ok(np && !np.aggregateRating && !np.hasMenu, 'Peluquería: BeautySalon, sin valoración (no tiene) ni carta');
  // Un evento: Event con su dirección, fin y entrada.
  const ev = await pagina(web, `/o/${id('a9100000', 2)}`);
  const ne = ldDe(ev.t).flatMap((b) => nodos(b)).find((n) => n['@type'] === 'Event');
  ok(ne && ne.endDate && ne.location?.address?.['@type'] === 'PostalAddress' && ne.offers?.price === '15.00' && ne.eventStatus === 'https://schema.org/EventScheduled',
    'evento: Event con fin, dirección postal, entrada y estado');
  ok(ldDe(ev.t).some((b) => nodos(b).some((n) => n['@type'] === 'BreadcrumbList')), 'evento: con migas');
  // Umbrales: los de config, tal y como se pidieron.
  ok(UMBRALES.municipio >= 2 && UMBRALES.categoria >= 1 && UMBRALES.ofertas >= 1 && UMBRALES.provincia >= UMBRALES.municipio, `umbrales razonables (${JSON.stringify(UMBRALES)})`);
} finally {
  await web.cierra();
}

// ── 4. Sin las funciones nuevas (prod antes de la migración) ─────────────────
const falla = () => { throw new Error('PGRST202: no existe'); };
const vieja = await webConDatos({
  puerto: Number(process.env.PORT || 9041) + 2,
  datos,
  rpc: { public_seo_places: falla, public_sitemap_offers: falla, public_sitemap_businesses: falla, public_city_agenda: agenda },
  // Sin la función, el sitemap de planes lee la tabla y el de negocios, `businesses`.
  tablas: { businesses: NEGOCIOS.filter((b) => !b.closed_indefinitely) },
});
try {
  const rutas = await revisaSitemaps(vieja, 'sin la base nueva');
  ok(rutas.includes('/hoy/madrid') && !rutas.includes('/hoy/alcobendas') && !rutas.some((r) => r.startsWith('/provincia/')),
    'sin la base nueva: municipios con el umbral y sin provincias');
  ok((await pagina(vieja, '/provincia/madrid')).status === 404, 'sin la base nueva: la provincia no existe');
} finally {
  await vieja.cierra();
}

// ── 5. Caché del borde y robots.txt ─────────────────────────────────────────
for (const r of ['/ofertas/malaga', '/en/deals/malaga', '/provincia/malaga', '/en/province/malaga', ...SITEMAPS.filter((s) => s !== '/sitemap.xml')]) {
  ok(EN_CACHE.test(r), `${r}: en la caché del borde`);
}
const robots = readFileSync(new URL('../robots.txt', import.meta.url), 'utf8');
const conFuncion = readdirSync(new URL('../functions/', import.meta.url)).filter((f) => /^sitemap-[a-z]+\.xml\.js$/.test(f)).map((f) => f.replace(/\.js$/, ''));
for (const s of ['sitemap.xml', ...conFuncion]) ok(robots.includes(`Sitemap: https://klendar.app/${s}`), `robots.txt nombra ${s}`);

console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
