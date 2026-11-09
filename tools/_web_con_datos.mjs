// La web local con DATOS DE MENTIRA, para las pruebas que antes leían de dev
// (revisión del 9-11, punto 4). Desde el 5-11 las pruebas no pueden llegar a
// Supabase (03abcf9): con la base vacía, Descubre, Explorar, las fichas y la
// agenda salían sin nada y 24 pruebas fallaban siempre, sin decir nada de la
// web. Esto es lo que ya hacía mapa_check.mjs, para todas:
//
//  - un Supabase falso (http://localhost:<puerto>) con unos datos fijos y
//    realistas (DATOS: ciudades, categorías, negocios, planes de hoy, de esta
//    noche y del finde, ofertas flash, agenda pública sin foto, +18, sitios,
//    municipios…) que contesta las RPC y las tablas que usan las Functions;
//  - su serve_dev, con las Functions leyendo de él (SUPABASE_URL) y
//    diciéndole al navegador `${SUPA}` (como config.js), y Supabase de verdad
//    cortado (SUPABASE_BLOQUEADO, lo hereda de _supabase_simulado.mjs);
//  - el navegador también: cada contexto de Playwright (los de
//    `playwright()` de _supabase_simulado, creados después de arrancar esto)
//    manda lo de `${SUPA}` a este falso, sin sesión. La prueba que necesite
//    otra cosa (una sesión, una escritura) enruta lo suyo en su contexto y
//    manda, porque va después. `conDatos(ctx)` lo hace a mano.
//
// Cada prueba puede cambiar o añadir lo suyo: `rpc: { nombre: (args, req) =>
// respuesta }` y `tablas: { nombre: [filas] }`. Lo que pide se apunta en
// `llamadas` ([{ fn, args }]).
//
//   import { webConDatos, DATOS } from './_web_con_datos.mjs';
//   const web = await webConDatos({ puerto: 8901 });
//   const BASE = web.BASE;
//   const ctx = await nav.newContext(); await web.conDatos(ctx);
//   …
//   await web.cierra();
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { SUPA, playwright, servidorSeguro } from './_supabase_simulado.mjs';

// ── Los datos ─────────────────────────────────────────────────────────────
const AHORA = Date.now();
const iso = (horas) => new Date(AHORA + horas * 3600e3).toISOString();
/** Hoy a las [h]:[m] en Madrid, más [dias] (aprox.: +1 h en invierno, +2 en verano). */
function aLas(dias, h, m = 0) {
  const d = new Date(AHORA + dias * 864e5);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });
  const dia = fmt.format(d);
  const off = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset' }).formatToParts(d)
    .find((p) => p.type === 'timeZoneName')?.value.replace('GMT', '') || '+1';
  const signo = off.startsWith('-') ? '-' : '+';
  const horas = String(Math.abs(Number.parseInt(off, 10) || 1)).padStart(2, '0');
  return new Date(`${dia}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00${signo}${horas}:00`).toISOString();
}
/** Días hasta el próximo sábado (0 si hoy lo es). */
const HASTA_SABADO = (6 - new Date(AHORA).getDay() + 7) % 7;

const uuid = (pre, n) => `${pre}-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const CIUDADES = [
  { id: 'madrid', name: 'Madrid', lat: 40.4168, lng: -3.7038, position: 1, active: true, province: 'Madrid', time_zone: 'Europe/Madrid', radius_m: 25000 },
  { id: 'malaga', name: 'Málaga', lat: 36.7213, lng: -4.4214, position: 2, active: true, province: 'Málaga', time_zone: 'Europe/Madrid', radius_m: 25000 },
  { id: 'barcelona', name: 'Barcelona', lat: 41.3874, lng: 2.1686, position: 3, active: true, province: 'Barcelona', time_zone: 'Europe/Madrid', radius_m: 25000 },
];

const CAT = (n, slug, es, en, grupo) => ({
  id: uuid('c0000000', n), slug, names: { es, en }, name: es, position: n, category_group: grupo, icon: slug,
});
export const CATEGORIAS = [
  CAT(1, 'bar', 'Bares', 'Bars', 'food'), CAT(2, 'restaurant', 'Restaurantes', 'Restaurants', 'food'),
  CAT(3, 'cafe', 'Cafeterías', 'Cafés', 'food'), CAT(4, 'bakery', 'Panaderías', 'Bakeries', 'food'),
  CAT(5, 'music', 'Música', 'Music', 'night'), CAT(6, 'culture', 'Cultura', 'Culture', 'night'),
  CAT(7, 'nightclub', 'Discotecas', 'Nightclubs', 'night'), CAT(8, 'family', 'Familia', 'Family', 'leisure'),
  CAT(9, 'sport', 'Deporte', 'Sport', 'leisure'), CAT(10, 'beauty', 'Belleza', 'Beauty', 'care'),
  CAT(11, 'shop', 'Tiendas', 'Shops', 'services'), CAT(12, 'art', 'Arte', 'Art', 'night'),
];
const cat = (slug) => CATEGORIAS.find((c) => c.slug === slug);

const NEG = (n, nombre, ciudad, slugCat, lat, lng, extra = {}) => ({
  id: uuid('b9000000', n), name: nombre, slug: `${nombre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${ciudad}`,
  city: CIUDADES.find((c) => c.id === ciudad).name, city_id: ciudad, category_id: cat(slugCat).id, category_slug: slugCat,
  names: cat(slugCat).names, lat, lng, address: `Calle de Prueba ${n}`, time_zone: 'Europe/Madrid', is_verified: true,
  status: 'active', photo: null, logo_url: null, cover_url: null, price_level: 2, rating: 4.5, ratings: 12,
  description: `${nombre}, un sitio de prueba.`, social: {}, closed_indefinitely: false, member_since: '2026-01-01T00:00:00Z',
  redemptions_total: 10, plans_today: 1, has_offer: true, open_now: true, ...extra,
});
export const NEGOCIOS = [
  NEG(1, 'Bar Sonda', 'madrid', 'bar', 40.4169, -3.7035),
  NEG(2, 'Café Prueba', 'madrid', 'cafe', 40.4180, -3.7060),
  NEG(3, 'Sala Eco', 'madrid', 'music', 40.4250, -3.7010, { adults_only: true }),
  NEG(4, 'Restaurante Ensayo', 'madrid', 'restaurant', 40.4100, -3.6950),
  NEG(5, 'Panadería Muestra', 'madrid', 'bakery', 40.4300, -3.7100),
  NEG(6, 'Centro Cultural Sonda', 'madrid', 'culture', 40.3900, -3.7000, { entity_kind: 'council' }),
  NEG(7, 'Taberna del Puerto', 'malaga', 'bar', 36.7200, -4.4200),
  NEG(8, 'Chiringuito Prueba', 'malaga', 'restaurant', 36.7180, -4.4100),
  NEG(9, 'Agenda pública de Madrid', 'madrid', 'culture', 40.4155, -3.7074, { entity_kind: 'council', organizer: true }),
];
const neg = (n) => NEGOCIOS[n - 1];

/** Lo común de un plan (lo que lee la tarjeta y la ficha). */
const PLAN = (n, negocio, extra) => {
  const b = neg(negocio);
  return {
    id: uuid('a9000000', n), business_id: b.id, business_name: b.name, business_slug: b.slug, business_city: b.city,
    business_address: b.address, business_logo: null, business_cover: null, city: b.city, lat: b.lat, lng: b.lng,
    category_id: b.category_id, category_slug: b.category_slug, status: 'active', time_zone: 'Europe/Madrid',
    images: [], style: {}, audience: 'all', locked: false, imported: false, seats_left: null, max_seats: null,
    waitlist_count: 0, redemptions_count: 0, max_per_user: 1, description: 'Un plan de prueba para las comprobaciones de la web.',
    currency: 'EUR', price_cents: null, discount: null, traits: [], adults_only: Boolean(b.adults_only), created_at: iso(-48),
    ...extra,
  };
};
// Las fotos, en el Storage de `${SUPA}` (el navegador lo pide al falso, que da una imagen pequeña).
const FOTO = (n) => [`${SUPA}/storage/v1/object/public/business-images/b9000000/foto-${n}.webp`];
/** La imagen genérica que pone la importación de la agenda (`business-images/agenda/<cat>.webp`). */
const GENERICA = (slug) => [`${SUPA}/storage/v1/object/public/business-images/agenda/${slug}.webp`];
export const PLANES = [
  // Ofertas flash, ahora.
  PLAN(1, 1, { kind: 'flash_offer', title: 'Cañas 2x1', discount: { type: '2x1' }, starts_at: iso(-1), redeem_start_at: iso(-1), redeem_end_at: iso(3), seats_left: 20, images: FOTO(1) }),
  PLAN(2, 2, { kind: 'flash_offer', title: 'Café y tostada', discount: { type: 'fixed', value: 2 }, price_cents: 250, starts_at: iso(-0.5), redeem_start_at: iso(-0.5), redeem_end_at: iso(2), seats_left: 8, images: FOTO(2) }),
  PLAN(3, 5, { kind: 'flash_offer', title: 'Bolsa sorpresa', style: { badge: 'before_closing' }, discount: { type: 'percent', value: 50 }, starts_at: iso(-0.2), redeem_start_at: iso(-0.2), redeem_end_at: iso(1.5), seats_left: 4, images: FOTO(3) }),
  PLAN(4, 4, { kind: 'flash_offer', title: 'Menú del día', discount: { type: 'percent', value: 20 }, starts_at: iso(-2), redeem_start_at: iso(-2), redeem_end_at: iso(4), images: FOTO(4) }),
  PLAN(5, 7, { kind: 'flash_offer', title: 'Espetos 2x1', discount: { type: '2x1' }, starts_at: iso(-1), redeem_start_at: iso(-1), redeem_end_at: iso(3), images: FOTO(5) }),
  // Eventos: esta noche, mañana, el finde y más adelante.
  PLAN(10, 3, { kind: 'future_event', title: 'Concierto acústico', event_at: aLas(0, 22), starts_at: aLas(0, 22), event_end_at: aLas(0, 23, 30), price_cents: 1200, images: FOTO(10), adults_only: true }),
  PLAN(11, 1, { kind: 'future_event', title: 'Monólogos', event_at: aLas(1, 21), starts_at: aLas(1, 21), images: FOTO(11) }),
  PLAN(12, 4, { kind: 'future_event', title: 'Cata de vinos', event_at: aLas(HASTA_SABADO, 19), starts_at: aLas(HASTA_SABADO, 19), seats_left: 6, max_seats: 20, images: FOTO(12) }),
  PLAN(13, 2, { kind: 'future_event', title: 'Cuentacuentos', event_at: aLas(HASTA_SABADO + 1, 12), starts_at: aLas(HASTA_SABADO + 1, 12), traits: ['kids'], images: FOTO(13) }),
  PLAN(14, 8, { kind: 'future_event', title: 'Noche de salsa', event_at: aLas(2, 22), starts_at: aLas(2, 22), images: FOTO(14) }),
  PLAN(15, 3, { kind: 'future_event', title: 'Concierto agotado', event_at: aLas(3, 21), starts_at: aLas(3, 21), status: 'sold_out', seats_left: 0, images: FOTO(15) }),
  PLAN(16, 1, { kind: 'future_event', title: 'Partido en pantalla grande', event_at: aLas(4, 21), starts_at: aLas(4, 21), images: FOTO(16) }),
  PLAN(17, 4, { kind: 'future_event', title: 'Cena con música', event_at: aLas(6, 21), starts_at: aLas(6, 21), images: FOTO(17) }),
  PLAN(18, 2, { kind: 'future_event', title: 'Taller de café', event_at: aLas(9, 18), starts_at: aLas(9, 18), images: FOTO(18) }),
  // Agenda pública (importada de un ayuntamiento), sin foto: la imagen genérica de su categoría.
  ...Array.from({ length: 8 }, (_, i) => PLAN(30 + i, i % 2 ? 6 : 9, {
    kind: 'future_event', title: `Exposición de prueba ${i + 1}`, imported: true, entity_kind: 'council',
    event_at: aLas(i, 10), starts_at: aLas(i, 10), event_end_at: aLas(i, 20), all_day: i % 3 === 0,
    images: GENERICA('culture'), source_name: 'Datos abiertos del Ayuntamiento de Madrid', source_url: 'https://datos.madrid.es/',
  })),
];

/** Los municipios (tabla `municipalities` de la base). */
export const MUNICIPIOS = [
  { code: '28079', slug: 'madrid', name: 'Madrid', province: 'Madrid', lat: 40.4168, lng: -3.7038, population: 3300000, city_id: 'madrid', radius_m: 25000, active: true },
  { code: '29067', slug: 'malaga', name: 'Málaga', province: 'Málaga', lat: 36.7213, lng: -4.4214, population: 580000, city_id: 'malaga', radius_m: 25000, active: true },
  { code: '08019', slug: 'barcelona', name: 'Barcelona', province: 'Barcelona', lat: 41.3874, lng: 2.1686, population: 1660000, city_id: 'barcelona', radius_m: 25000, active: true },
  { code: '44216', slug: 'teruel', name: 'Teruel', province: 'Teruel', lat: 40.3456, lng: -1.1065, population: 36000, city_id: null, radius_m: 10000, active: false },
  { code: '28006', slug: 'alcobendas', name: 'Alcobendas', province: 'Madrid', lat: 40.5475, lng: -3.6420, population: 118000, city_id: null, radius_m: 15000, active: false },
];

export const DATOS = { CIUDADES, CATEGORIAS, NEGOCIOS, PLANES, MUNICIPIOS };

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// ── Las respuestas ────────────────────────────────────────────────────────
const metros = (a, b, c, d) => {
  const r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2);
  const y = Math.sin(((d - b) * r) / 2);
  return 12742000 * Math.asin(Math.sqrt(x * x + Math.cos(a * r) * Math.cos(c * r) * y * y));
};
const plano = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const empieza = (o) => Date.parse(o.redeem_start_at || o.event_at || o.starts_at || 0);

/** Lo que encaja con la zona (punto y radio, o ciudad), el tipo, la categoría y el texto. */
function filtra(lista, a = {}, { conDistancia = true } = {}) {
  const f = a.p_filters || {};
  const radio = Number(f.radius_m || a.p_radius_m) || 25000;
  let out = lista.map((o) => ({ ...o }));
  if (a.p_lat != null && a.p_lng != null) {
    out = out.map((o) => ({ ...o, distance_m: Math.round(metros(Number(a.p_lat), Number(a.p_lng), o.lat, o.lng)) }))
      .filter((o) => o.distance_m <= radio);
    if (!conDistancia) out.forEach((o) => { delete o.distance_m; });
  } else if (a.p_city) out = out.filter((o) => plano(o.city) === plano(a.p_city) || plano(o.city_id) === plano(a.p_city));
  if (a.p_kind) out = out.filter((o) => o.kind === a.p_kind);
  const cats = [a.p_category, ...(f.categories || [])].filter(Boolean);
  if (cats.length) out = out.filter((o) => cats.includes(o.category_slug) || cats.includes(o.category_id));
  if (a.p_categories?.length) out = out.filter((o) => a.p_categories.includes(o.category_id));
  if (a.p_q) out = out.filter((o) => plano(`${o.title || ''} ${o.name || ''} ${o.business_name || ''}`).includes(plano(a.p_q)));
  if (f.kids || (f.traits || []).includes('kids')) out = out.filter((o) => (o.traits || []).includes('kids'));
  if (f.adults === false || a.p_adults === false) out = out.filter((o) => !o.adults_only);
  return out;
}

/** Las respuestas de serie (lo que una prueba no cambia). */
function respuestas(D) {
  const pagina = (l, a, def = 24) => {
    const n = Number(a.p_limit) || def;
    const d = Number(a.p_offset) || 0;
    return { items: l.slice(d, d + n), total: l.length };
  };
  const activos = () => D.PLANES.filter((o) => o.status !== 'deleted');
  return {
    public_explore: (a) => pagina(filtra(activos(), a).sort((x, y) => (a.p_filters?.sort === 'nearest' ? (x.distance_m || 0) - (y.distance_m || 0) : empieza(x) - empieza(y))), a, 24),
    recommended_offers: (a) => filtra(activos(), { ...a, p_filters: { radius_m: 300000 } }).slice(0, Number(a.p_limit) || 8),
    public_places: (a) => pagina(filtra(D.NEGOCIOS, a), a, 24),
    map_places: (a) => filtra(D.NEGOCIOS, a),
    public_businesses: (a) => filtra(D.NEGOCIOS, a, { conDistancia: false }).slice(0, Number(a.p_limit) || 4),
    public_cities: () => D.CIUDADES.map((c) => ({ ...c, offers: D.PLANES.filter((o) => o.city === c.name).length })),
    public_categories: (a) => D.CATEGORIAS.map((c) => ({ ...c, count: filtra(activos(), { p_city: a.p_city, p_category: c.slug }).length }))
      .filter((c) => c.count > 0),
    public_collections: () => [],
    offer_detail: (a) => { const o = D.PLANES.find((x) => x.id === a.p_id); return o ? [{ ...o }] : []; },
    offer_marks: () => [], offer_place_traits: () => [], offer_artists_of: () => [], offer_series_info: () => null,
    offer_source: (a) => { const o = D.PLANES.find((x) => x.id === a.p_offer || x.id === a.p_id); return o?.imported ? { name: o.source_name, url: o.source_url, license: 'CC BY 4.0' } : null; },
    business_profile: (a) => { const b = D.NEGOCIOS.find((x) => x.id === a.p_id); return b ? [{ ...b }] : []; },
    resolve_business_slug: (a) => { const b = D.NEGOCIOS.find((x) => x.slug === a.p_slug || x.id === a.p_slug); return b ? [{ id: b.id, slug: b.slug }] : []; },
    business_offers: (a) => D.PLANES.filter((o) => o.business_id === a.p_business || o.business_id === a.p_id),
    business_offers_page: (a) => D.PLANES.filter((o) => o.business_id === a.p_business || o.business_id === a.p_id).slice(0, Number(a.p_limit) || 24),
    business_offer_counts: (a) => ({ total: D.PLANES.filter((o) => o.business_id === (a.p_business || a.p_id)).length }),
    business_reviews: () => [], business_questions_page: () => [], business_questions_summary: () => null,
    business_public_giveaways: () => [], business_closures: () => [], business_broadcasts_public: () => [], business_menu: () => [],
    business_links: () => [], business_closure_state: () => null, business_is_organizer: (a) => Boolean(D.NEGOCIOS.find((b) => b.id === a.p_business)?.organizer),
    business_municipality_info: (a) => { const b = D.NEGOCIOS.find((x) => x.id === (a.p_business || a.p_id)); const m = D.MUNICIPIOS.find((x) => x.city_id === b?.city_id); return m ? { ...m } : null; },
    business_ficha_info: () => null, business_group_info: () => null, business_verified_review_count: () => 0, stamp_cards_of: () => [],
    search_municipalities: (a) => {
      const q = plano(a.p_q || '');
      const l = q ? D.MUNICIPIOS.filter((m) => plano(m.name).includes(q)) : D.MUNICIPIOS.filter((m) => m.active);
      return l.map((m) => ({ ...m, is_klendar_city: Boolean(m.city_id) }));
    },
    resolve_municipality: (a) => {
      const s = plano(a.p_slug || a.p_q || a.p_code || '');
      return D.MUNICIPIOS.filter((m) => plano(m.slug) === s || m.code === a.p_code || plano(m.name) === s).map((m) => ({ ...m, is_klendar_city: Boolean(m.city_id) }));
    },
    klendar_coverage: (a) => {
      const c = D.CIUDADES.map((x) => ({ x, d: metros(Number(a.p_lat), Number(a.p_lng), x.lat, x.lng) })).sort((p, q) => p.d - q.d)[0];
      return c && c.d < 60000 ? { covered: true, city: c.x.id, city_name: c.x.name } : { covered: false, nearest_city: c?.x.id || null, nearest_name: c?.x.name || null, distance_m: Math.round(c?.d || 0) };
    },
    public_city_agenda: (a) => D.PLANES.filter((o) => o.imported && (!a.p_city || plano(o.city) === plano(a.p_city))),
    public_organizers: () => D.NEGOCIOS.filter((b) => b.organizer),
    public_sitemap_places: () => D.NEGOCIOS.map((b) => ({ slug: b.slug, updated_at: iso(-24) })),
    rated_sort_available: () => true,
    where_to_watch: () => [], broadcast_competitions: () => [], group_venues: (a) => filtra(D.NEGOCIOS, a).map((b) => ({ ...b, kinds: ['company', 'birthday'] })),
    giveaways_near: () => [], artist_search: () => [], public_artist_slugs: () => [], event_default_end: () => null,
    viewer_sees_adults: () => true, assistant_status: () => ({ available: false }),
  };
}

/** Una tabla de PostgREST: `col=eq.x` (también `in.(…)`), `limit`, y un objeto con `vnd.pgrst.object`. */
function tabla(filas, sp) {
  let out = [...filas];
  for (const [k, v] of sp) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const m = /^(eq|neq|in|is|ilike)\.(.*)$/.exec(v);
    if (!m) continue;
    const [, op, val] = m;
    if (op === 'eq') out = out.filter((f) => String(f[k]) === val);
    else if (op === 'neq') out = out.filter((f) => String(f[k]) !== val);
    else if (op === 'in') { const s = val.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')); out = out.filter((f) => s.includes(String(f[k]))); }
    else if (op === 'is') out = out.filter((f) => (val === 'null' ? f[k] == null : String(f[k]) === val));
    else if (op === 'ilike') { const re = new RegExp(`^${val.replace(/\*/g, '.*')}$`, 'i'); out = out.filter((f) => re.test(String(f[k] ?? ''))); }
  }
  const o = Number(sp.get('offset')) || 0;
  const l = sp.get('limit') ? Number(sp.get('limit')) : out.length;
  return out.slice(o, o + l);
}

/**
 * Arranca el Supabase falso y su serve_dev. [rpc] y [tablas] cambian o añaden
 * respuestas (una función recibe los argumentos, la petición y los DATOS).
 * [datos]: otros datos en vez de DATOS (p. ej. `{ ...DATOS, PLANES: [] }`).
 */
export async function webConDatos({ puerto = 8901, puertoFalso = puerto + 1, rpc = {}, tablas = {}, datos = DATOS, entorno = {} } = {}) {
  const D = datos;
  const R = { ...respuestas(D), ...rpc };
  const T = {
    cities: D.CIUDADES, categories: D.CATEGORIAS, businesses: D.NEGOCIOS, offers: D.PLANES, municipalities: D.MUNICIPIOS,
    app_config: [], business_posts: [], business_municipality: [], ...tablas,
  };
  const llamadas = [];
  const falso = createServer((req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; });
    req.on('end', async () => {
      const url = new URL(req.url, 'http://x');
      const p = url.pathname;
      const manda = (b, status = 200, extra = {}) => {
        res.writeHead(status, { 'content-type': 'application/json', ...cors, ...extra });
        res.end(req.method === 'HEAD' ? '' : JSON.stringify(b));
      };
      let args = {};
      try { args = JSON.parse(cuerpo || '{}'); } catch { /* sin cuerpo */ }
      try {
        if (p.startsWith('/rest/v1/rpc/')) {
          const fn = p.slice('/rest/v1/rpc/'.length);
          llamadas.push({ fn, args });
          const r = R[fn];
          const v = typeof r === 'function' ? await r(args, req, D) : r !== undefined ? r : [];
          return manda(v ?? null);
        }
        if (p.startsWith('/rest/v1/')) {
          const t = p.slice('/rest/v1/'.length);
          llamadas.push({ fn: `tabla:${t}`, args: Object.fromEntries(url.searchParams) });
          const base = typeof T[t] === 'function' ? await T[t](url.searchParams, req, D) : T[t] || [];
          const filas = tabla(base, url.searchParams);
          const uno = /vnd\.pgrst\.object/.test(req.headers.accept || '');
          return manda(uno ? filas[0] || null : filas, uno && !filas.length ? 406 : 200, { 'content-range': `0-${Math.max(filas.length - 1, 0)}/${filas.length}` });
        }
        // Las fotos: una imagen de 1 px (PNG), sea cual sea su nombre.
        if (p.startsWith('/storage/v1/')) {
          res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=3600', ...cors });
          return res.end(PNG);
        }
        if (p === '/auth/v1/settings') return manda({ external: { email: true, google: true }, disable_signup: false });
        if (p.startsWith('/auth/v1/user')) return manda({ code: 401, msg: 'sin sesión' }, 401);
        if (p.startsWith('/functions/v1/')) { llamadas.push({ fn: `function:${p.slice(14)}`, args }); return manda({}); }
        return manda({});
      } catch (e) {
        return manda({ message: String(e?.message || e) }, 500);
      }
    });
  });
  await new Promise((r) => falso.listen(puertoFalso, r));
  const FALSO = `http://localhost:${puertoFalso}`;
  const BASE = `http://localhost:${puerto}`;
  const servidor = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(puerto), SUPABASE_URL: FALSO, SUPABASE_KEY: 'falsa', SUPABASE_URL_NAVEGADOR: SUPA, ...entorno },
    stdio: 'ignore',
  });
  // Hasta que conteste (como mucho 15 s).
  for (let i = 0; i < 150; i += 1) {
    try { if ((await globalThis.fetch(`${BASE}/__supabase_bloqueado`)).ok) break; } catch { /* aún no */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  await servidorSeguro(BASE);
  const cierra = async () => {
    servidor.kill();
    await new Promise((r) => falso.close(r));
  };
  process.on('exit', () => { try { servidor.kill(); } catch { /* ya */ } });
  /** El navegador de [ctx] habla con este falso (sin sesión) en vez de con `${SUPA}`. */
  const conDatos = async (ctx) => {
    await ctx.route(`${SUPA}/**`, async (route) => {
      const url = route.request().url().replace(SUPA, FALSO);
      try { await route.fulfill({ response: await route.fetch({ url }) }); } catch { await route.abort().catch(() => {}); }
    });
    if (ctx.routeWebSocket) await ctx.routeWebSocket(new RegExp(`^wss://[^/]*\\.supabase\\.co/realtime/`), () => { /* mudo */ });
    return ctx;
  };
  ACTIVO = conDatos;
  conNavegadores();
  return { BASE, FALSO, llamadas, conDatos, cierra, datos: D };
}

// Los contextos nuevos de Playwright hablan con el último falso arrancado.
let ACTIVO = null;
function conNavegadores() {
  let pw = null;
  try { pw = playwright(); } catch { return; } // sin Playwright (una prueba sin navegador)
  for (const tipo of [pw.chromium, pw.webkit, pw.firefox].filter(Boolean)) {
    if (tipo.__conDatos) continue;
    tipo.__conDatos = true;
    const lanza = tipo.launch.bind(tipo);
    tipo.launch = async (...a) => {
      const nav = await lanza(...a);
      const nuevo = nav.newContext.bind(nav);
      // browser.newPage() también pasa por aquí (llama a this.newContext).
      nav.newContext = async (...b) => { const ctx = await nuevo(...b); return ACTIVO ? ACTIVO(ctx) : ctx; };
      return nav;
    };
    const persistente = tipo.launchPersistentContext.bind(tipo);
    tipo.launchPersistentContext = async (...a) => { const ctx = await persistente(...a); return ACTIVO ? ACTIVO(ctx) : ctx; };
  }
}
