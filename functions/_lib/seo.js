// Lo de los buscadores en un solo sitio (Google y Bing, Iván, 18-11: «que las
// páginas de negocios y eventos salgan en las búsquedas de Málaga»):
//
//  - UMBRALES: cuánto tiene que tener un municipio (o una provincia) para que
//    sus páginas se indexen. Sin contenido suficiente, `noindex` y fuera del
//    sitemap: Google castiga las páginas vacías en masa («thin content») y hay
//    más de 8000 municipios. Lo usan las páginas y los sitemaps, así nunca
//    sale en el sitemap una dirección que la página manda no indexar
//    (tools/seo_check.mjs lo comprueba).
//  - `lugaresSeo()`: lo publicado en cada municipio, de una vez
//    (`public_seo_places`, migraciones 20261285900000 y 010 de la app; unos minutos en
//    la memoria de cada copia, ver MEMO en page.js). Sin esa función (prod
//    antes de su migración), lo de `public_cities` (cuántos planes hay en
//    cada municipio), que ya se pedía.
//  - Datos estructurados (schema.org) de las fichas: el tipo de negocio según
//    su categoría (Restaurant, BarOrPub, BeautySalon…), la dirección, el
//    horario y el rango de precio.

import { esc, rpcAll } from './page.js';

/** Los umbrales (Iván, 18-11). Se cambian aquí y valen para páginas y sitemaps. */
export const UMBRALES = {
  // Planes publicados (ofertas y eventos vivos, sin +18 ni exclusivas) para
  // que se indexen las páginas de un municipio: hoy, la semana, con niños y
  // cada categoría.
  municipio: 3,
  // En una categoría del municipio («Bares en Málaga»), además del municipio.
  categoria: 2,
  // Ofertas vivas para «Ofertas en <municipio>».
  ofertas: 2,
  // Planes en toda la provincia para su página («Planes en la provincia de Málaga»).
  provincia: 5,
};

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

/** Una fila de `public_seo_places` (o de `public_cities`, con lo que trae). */
function normaliza(f, completa) {
  return {
    city: f.city || f.name || '',
    slug: f.slug || null,
    code: f.code || null,
    province: f.province || null,
    provinceName: f.province_name || null,
    n: num(f.n),
    // Sin la función nueva no se sabe: null (la página mira lo suyo).
    flash: completa ? num(f.flash) : null,
    events: completa ? num(f.events) : null,
    kids: completa ? num(f.kids) : null,
    // Los de los próximos 8 días (lo que enseña su agenda).
    week: completa && f.week != null ? num(f.week) : null,
    businesses: completa ? num(f.businesses) : null,
    cats: completa && Array.isArray(f.cats) ? f.cats.filter((k) => k && k.slug).map((k) => ({ slug: k.slug, n: num(k.n) })) : null,
    completa,
  };
}

/** Lo publicado en cada municipio con algo. `completa`: con la función nueva. */
// Sin la función (prod antes de su migración) no se vuelve a preguntar en un
// rato: cada página haría una llamada de más (la que falla no se recuerda).
let SIN_FUNCION_HASTA = 0;
const memoActiva = () => typeof globalThis.caches?.default?.match === 'function';

export async function lugaresSeo() {
  if (Date.now() >= SIN_FUNCION_HASTA) {
    try {
      const l = await rpcAll('public_seo_places', {});
      return { lugares: l.filter((f) => f && (f.slug || f.city)).map((f) => normaliza(f, true)), completa: true };
    } catch {
      if (memoActiva()) SIN_FUNCION_HASTA = Date.now() + 10 * 60_000;
    }
  }
  const l = await rpcAll('public_cities', {}).catch(() => []);
  return { lugares: l.filter((f) => f && f.city).map((f) => normaliza(f, false)), completa: false };
}

const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Lo de un municipio (por su slug o su nombre); sin nada publicado, ceros. */
export async function lugarSeo(slugOCiudad) {
  const { lugares, completa } = await lugaresSeo();
  const k = plano(slugOCiudad);
  const f = lugares.find((x) => (x.slug && x.slug === slugOCiudad) || plano(x.slug) === k || plano(x.city) === k);
  return f || normaliza({ slug: slugOCiudad, n: 0 }, completa);
}

/** ¿Tiene el municipio lo suficiente para indexar sus páginas? */
export const municipioConContenido = (l) => Boolean(l) && l.n >= UMBRALES.municipio;

/** ¿Su agenda de la semana? La página mira lo que enseña (`propio`); el
 * sitemap, los planes de los próximos 8 días (sin la función nueva, se fía
 * del municipio). */
export function agendaConContenido(l, propio = null) {
  if (!municipioConContenido(l)) return false;
  if (propio != null) return num(propio) > 0;
  return l.week == null || l.week > 0;
}

/** ¿«Qué hacer hoy»? Con el municipio basta, salvo que la página no tenga nada
 * (ni hoy, ni mañana, ni sitios: `vacia`). */
export const hoyConContenido = (l, vacia = false) => municipioConContenido(l) && !vacia;

/** ¿Y una de sus categorías? `propio`: lo que enseña la página (sin la función nueva). */
export function categoriaConContenido(l, slug, propio = null) {
  if (!municipioConContenido(l)) return false;
  // Sin la función nueva no se sabe cuántos hay en cada categoría: basta con
  // que tenga algo (lo de antes, lo mismo que pone el sitemap).
  if (!Array.isArray(l.cats)) return propio == null || num(propio) >= 1;
  const k = l.cats.find((c) => c.slug === slug);
  return Boolean(k) && k.n >= UMBRALES.categoria;
}

/** ¿«Ofertas en <municipio>»? */
export function ofertasConContenido(l, propio = null) {
  if (!l || l.flash == null) return propio != null && num(propio) >= UMBRALES.ofertas;
  return l.flash >= UMBRALES.ofertas && (propio == null || num(propio) > 0);
}

/** Las provincias con algo: [{ code, name, n, lugares: [...] }], de más a menos. */
export function provincias(lugares) {
  const m = new Map();
  for (const l of lugares) {
    if (!l.province) continue;
    if (!m.has(l.province)) m.set(l.province, { code: l.province, name: l.provinceName || '', n: 0, lugares: [] });
    const p = m.get(l.province);
    p.n += l.n;
    p.lugares.push(l);
    if (!p.name && l.provinceName) p.name = l.provinceName;
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

/** ¿Se indexa la página de la provincia? Lo suficiente y algún municipio indexable. */
export const provinciaConContenido = (p) => Boolean(p) && p.n >= UMBRALES.provincia && p.lugares.some(municipioConContenido);

/** «Málaga» → «malaga» (la dirección de la provincia). */
export const slugProvincia = (nombre) => plano(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** «Más en la provincia de Málaga →» bajo las páginas de un municipio, si la
 * página de su provincia se indexa ('' si no). */
export async function enlaceProvincia(lugar, lang) {
  if (!lugar?.province) return '';
  const { lugares } = await lugaresSeo();
  const p = provincias(lugares).find((x) => x.code === lugar.province);
  if (!provinciaConContenido(p)) return '';
  const en = lang === 'en';
  return `<p><a href="${en ? '/en/province' : '/provincia'}/${slugProvincia(p.name)}">${esc(en ? `More in the province of ${p.name}` : `Más en la provincia de ${p.name}`)} →</a></p>`;
}

// ── Datos estructurados de una ficha ────────────────────────────────────────

// El tipo de schema.org de cada categoría (tool/categorias.json de la app; los
// slugs de antes de los 96 tipos también están). Solo subtipos de
// LocalBusiness: lo que Google entiende como un sitio al que ir. Lo que no
// está, `LocalBusiness`.
const TIPOS = {
  bar: 'BarOrPub', cocktail: 'BarOrPub', wine: 'BarOrPub', brewery: 'Brewery',
  restaurant: 'Restaurant', cafe: 'CafeOrCoffeeShop', bakery: 'Bakery', churros: 'FoodEstablishment',
  icecream: 'IceCreamShop', takeaway: 'FastFoodRestaurant', foodtruck: 'FoodEstablishment', catering: 'FoodEstablishment',
  gourmet: 'Store', grocery: 'GroceryStore', market: 'Store',
  nightclub: 'NightClub', karaoke: 'EntertainmentBusiness', music: 'EntertainmentBusiness', stage: 'EntertainmentBusiness',
  cinema: 'MovieTheater', culture: 'EntertainmentBusiness', art: 'ArtGallery',
  games: 'EntertainmentBusiness', escape_room: 'EntertainmentBusiness', bowling: 'BowlingAlley', karting: 'SportsActivityLocation',
  theme_park: 'AmusementPark', kids_play: 'EntertainmentBusiness', family: 'EntertainmentBusiness', experiences: 'EntertainmentBusiness',
  sport: 'SportsActivityLocation', gym: 'ExerciseGym', yoga: 'SportsActivityLocation', padel: 'SportsActivityLocation',
  climbing: 'SportsActivityLocation', pool: 'PublicSwimmingPool', martial_arts: 'SportsActivityLocation',
  adventure: 'SportsActivityLocation', golf: 'GolfCourse',
  wellness: 'DaySpa', beauty: 'BeautySalon', hairdresser: 'HairSalon', barber: 'HairSalon', nails: 'NailSalon', tattoo: 'TattooParlor',
  pharmacy: 'Pharmacy', optician: 'Optician', dentist: 'Dentist', physio: 'Physiotherapy', medical: 'MedicalClinic',
  hearing: 'MedicalBusiness', podiatry: 'MedicalBusiness', psychology: 'MedicalBusiness', nutrition: 'MedicalBusiness',
  aesthetic_clinic: 'MedicalBusiness', health: 'MedicalBusiness', vet: 'VeterinaryCare',
  event_planner: 'ProfessionalService', photo: 'ProfessionalService', print: 'ProfessionalService',
  lodging: 'Hotel', hostel: 'Hostel', apartments: 'LodgingBusiness', rural: 'LodgingBusiness', camping: 'Campground',
  fashion: 'ClothingStore', jewelry: 'JewelryStore', florist: 'Florist', gifts: 'Store', books: 'BookStore', stationery: 'Store',
  kiosk: 'Store', toys: 'ToyStore', sports_shop: 'SportingGoodsStore', electronics: 'ElectronicsStore', home_decor: 'HomeGoodsStore',
  hardware: 'HardwareStore', cosmetics: 'Store', secondhand: 'Store', shop: 'Store',
  workshop: 'AutoRepair', home: 'HomeAndConstructionBusiness', laundry: 'DryCleaningOrLaundry', travel: 'TravelAgency',
  civic: 'GovernmentOffice',
};
/** Los tipos que se usan (para tools/seo_check.mjs). */
export const TIPOS_SCHEMA = new Set(['LocalBusiness', ...Object.values(TIPOS)]);
/** Los que son de comer y beber (llevan `servesCuisine`/`hasMenu`). */
const DE_COMER = new Set(['BarOrPub', 'Brewery', 'Restaurant', 'CafeOrCoffeeShop', 'Bakery', 'FoodEstablishment', 'IceCreamShop', 'FastFoodRestaurant']);

/** El tipo de schema.org de un negocio por el slug de su categoría principal. */
export const tipoSchema = (slug) => TIPOS[slug] || 'LocalBusiness';
export const esDeComer = (tipo) => DE_COMER.has(tipo);

const DIAS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HORA = /^([01]\d|2[0-4]):[0-5]\d$/;

/** El horario de la ficha ({"1": [["09:00","14:00"]], …}, 1 = lunes) para Google. */
export function horarioLd(horas) {
  if (!horas || typeof horas !== 'object') return undefined;
  const out = [];
  for (let d = 1; d <= 7; d += 1) {
    const tramos = Array.isArray(horas[d]) ? horas[d] : Array.isArray(horas[String(d)]) ? horas[String(d)] : [];
    for (const t of tramos) {
      if (!Array.isArray(t) || !HORA.test(String(t[0])) || !HORA.test(String(t[1]))) continue;
      out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${DIAS[d - 1]}`, opens: t[0], closes: t[1] });
    }
  }
  return out.length ? out : undefined;
}

/** «Calle Larios 5, 29005 Málaga» → la dirección postal, con su código postal. */
export function direccionLd({ calle, ciudad, provincia }) {
  if (!calle && !ciudad) return undefined;
  const cp = /(?:^|\D)(\d{5})(?:\D|$)/.exec(String(calle || ''))?.[1];
  return {
    '@type': 'PostalAddress',
    streetAddress: calle || undefined,
    postalCode: cp || undefined,
    addressLocality: ciudad || undefined,
    addressRegion: provincia && !/^\d+$/.test(String(provincia)) && provincia !== ciudad ? provincia : undefined,
    addressCountry: 'ES',
  };
}

/** La valoración media, solo si es real (de quien la ha dejado en Klendar) y se ve en la página. */
export function valoracionLd(media, cuantas) {
  const n = Math.floor(num(cuantas));
  const v = num(media);
  if (n < 1 || v < 1 || v > 5) return undefined;
  return { '@type': 'AggregateRating', ratingValue: v.toFixed(1), reviewCount: n, bestRating: 5, worstRating: 1 };
}
