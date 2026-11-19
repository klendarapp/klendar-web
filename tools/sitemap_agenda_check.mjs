// El sitemap de la agenda (functions/sitemap-agenda.xml.js) con la base de
// ahora: `public_seo_places` (migraciones 20261285900000 y 010 de la app), de
// una vez, y los umbrales de functions/_lib/seo.js (UMBRALES), los mismos que
// miran las páginas para el noindex.
//
//   node tools/sitemap_agenda_check.mjs
//
// Llama a la Function de verdad con la base simulada aquí (45 municipios de
// mentira, por encima y por debajo de cada umbral; nada sale a Supabase: ver
// tools/_supabase_simulado.mjs) y comprueba:
//
//  1. Con `public_seo_places`: dos llamadas a la base (lugares y colecciones),
//     nunca una por municipio (con el plan gratis de Cloudflare, 50
//     subpeticiones, el sitemap fallaba entero a partir de unos 48). Salen
//     exactamente las páginas que pasan los umbrales: «hoy» y la agenda del
//     municipio (y la agenda solo con algo esta semana), «con niños» con algo
//     para niños, «ofertas» con bastantes ofertas, cada categoría con
//     bastantes planes, las provincias con contenido y las colecciones. Cada
//     una con su pareja en inglés.
//  2. Sin ella (prod antes de su migración): `public_cities` para cuántos
//     planes hay y `public_sitemap_places` para categorías y niños (tres
//     llamadas); con el umbral del municipio, sin ofertas ni provincias.
//  3. Sin ninguna de las dos: igual responde, con «hoy» y agenda.
//
// Las tres vueltas usan direcciones de base distintas: la memoria de page.js
// (MEMO) va por dirección y no se mezclan.

import { KEY } from './_supabase_simulado.mjs';
import { UMBRALES } from '../functions/_lib/seo.js';

const U = UMBRALES;
// Las provincias, de dos en dos municipios; la primera con contenido de sobra.
const PROV = (i) => ({ province: String(29 + (i % 5)).padStart(2, '0'), province_name: ['Málaga', 'Murcia', 'Navarra', 'Ourense', 'Asturias'][i % 5] });
// 45 municipios: unos por encima y otros por debajo de cada umbral.
const LUGARES = Array.from({ length: 45 }, (_, i) => {
  const n = i % 5 === 4 ? U.municipio - 1 : U.municipio + (i % 4); // uno de cada cinco, por debajo
  return {
    city: i === 0 ? 'Málaga' : `Pueblo ${i}`, slug: i === 0 ? 'malaga' : `pueblo-${i}`,
    ...PROV(i),
    n,
    week: i % 6 === 1 ? 0 : n, // alguno sin nada esta semana: sin agenda (pero con «hoy»)
    kids: i % 4 === 0 ? 0 : 1,
    flash: i % 3 === 0 ? U.ofertas : U.ofertas - 1,
    events: n,
    businesses: 3,
    cats: i % 3 === 2 ? [] : [{ slug: 'musica', n: U.categoria }, { slug: i % 2 ? 'teatro' : 'deporte', n: U.categoria - 1 }],
  };
});
// Una provincia con algo pero por debajo de su umbral y sin municipios buenos.
LUGARES.push({ city: 'Aldea', slug: 'aldea', province: '44', province_name: 'Teruel', n: 1, week: 1, kids: 1, flash: 0, events: 1, businesses: 1, cats: [{ slug: 'musica', n: 1 }] });
const COLECCIONES = [{ slug: 'finde' }, { slug: 'con-ninos' }];

let fallos = 0;
const check = (msg, ok, extra = '') => {
  console.log(`${ok ? '✔' : '✘'} ${msg}${ok || !extra ? '' : ` (${extra})`}`);
  if (!ok) fallos++;
};

let llamadas = [];
let FALSA = '';
let quita = new Set(); // las funciones que «aún no existen» en esta vuelta
const responde = (x, status = 200) => Promise.resolve(new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } }));
globalThis.fetch = async (url) => {
  const u = String(url);
  if (!u.startsWith(`${FALSA}/rest/v1/rpc/`)) return responde({ message: 'sin simular' }, 404);
  const fn = u.slice(`${FALSA}/rest/v1/rpc/`.length);
  llamadas.push(fn);
  if (quita.has(fn)) return responde({ code: 'PGRST202', message: 'no existe' }, 404);
  if (fn === 'public_seo_places') return responde(LUGARES);
  if (fn === 'public_cities') return responde(LUGARES.map(({ city, slug, n }) => ({ city, slug, n })));
  if (fn === 'public_sitemap_places') return responde(LUGARES.map(({ city, slug, cats, kids }) => ({ city, slug, cats: cats.map((k) => k.slug), kids: kids > 0 })));
  if (fn === 'public_collections') return responde(COLECCIONES);
  return responde({ message: `sin simular: ${fn}` }, 404);
};

const { onRequestGet } = await import('../functions/sitemap-agenda.xml.js');
const BASE = 'https://klendar.app';

/** Una vuelta: el sitemap con la base de `dir` y sin las funciones de `sin`. */
async function vuelta(dir, sin = []) {
  FALSA = dir; llamadas = []; quita = new Set(sin);
  const ctx = { env: { SUPABASE_URL: dir, SUPABASE_KEY: KEY }, request: new Request(`${BASE}/sitemap-agenda.xml`) };
  const r = await onRequestGet(ctx);
  const xml = await r.text();
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, b]) => ({
    loc: (/<loc>([^<]+)<\/loc>/.exec(b) || [])[1],
    es: (/hreflang="es" href="([^"]+)"/.exec(b) || [])[1],
    en: (/hreflang="en" href="([^"]+)"/.exec(b) || [])[1],
  }));
  const locs = new Set(urls.map((x) => x.loc.slice(BASE.length)));
  return { r, xml, urls, locs, llamadas: [...llamadas] };
}

/** Lo que tiene que salir (en español; la pareja inglesa se mira aparte). */
function esperado({ completa, conSitios }) {
  const s = new Set(COLECCIONES.map((k) => `/coleccion/${k.slug}`));
  for (const l of LUGARES) {
    if (l.n < U.municipio) continue;
    s.add(`/hoy/${l.slug}`);
    if (!completa || l.week > 0) s.add(`/agenda/${l.slug}`);
    if (completa ? l.kids > 0 : conSitios && l.kids > 0) s.add(`/con-ninos/${l.slug}`);
    if (completa && l.flash >= U.ofertas) s.add(`/ofertas/${l.slug}`);
    for (const k of l.cats) {
      if (completa ? k.n >= U.categoria : conSitios) s.add(`/agenda/${l.slug}/${k.slug}`);
    }
  }
  if (completa) {
    const prov = new Map();
    for (const l of LUGARES) {
      const p = prov.get(l.province) || { n: 0, bueno: false, nombre: l.province_name };
      p.n += l.n; p.bueno ||= l.n >= U.municipio;
      prov.set(l.province, p);
    }
    for (const p of prov.values()) {
      if (p.n >= U.provincia && p.bueno) s.add(`/provincia/${p.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}`);
    }
  }
  return s;
}

const EN = [[/^\/hoy\//, '/en/today/'], [/^\/agenda\//, '/en/whats-on/'], [/^\/con-ninos\//, '/en/kids/'], [/^\/ofertas\//, '/en/deals/'],
  [/^\/provincia\//, '/en/province/'], [/^\/coleccion\//, '/en/collection/']];
const enDe = (es) => { for (const [re, en] of EN) if (re.test(es)) return es.replace(re, en); return null; };

function compara(etiqueta, v, quiere) {
  check(`${etiqueta}: responde 200`, v.r.status === 200, v.r.status);
  const es = new Set([...v.locs].filter((p) => !p.startsWith('/en/')));
  const sobra = [...es].filter((p) => !quiere.has(p));
  const falta = [...quiere].filter((p) => !es.has(p));
  check(`${etiqueta}: exactamente lo que pasa los umbrales (${quiere.size})`, !sobra.length && !falta.length,
    `sobra ${sobra.slice(0, 5).join(' ')} · falta ${falta.slice(0, 5).join(' ')}`);
  const sinPareja = [...es].filter((p) => !v.locs.has(enDe(p)));
  check(`${etiqueta}: cada una con su pareja en inglés (${v.locs.size - es.size} EN)`, !sinPareja.length && v.locs.size === 2 * es.size, sinPareja.slice(0, 5).join(' '));
  check(`${etiqueta}: cada <url> con su hreflang es/en`, v.urls.every((x) => x.es && x.en && (x.loc === x.es || x.loc === x.en)));
}

// ── 1. Con public_seo_places ────────────────────────────────────────────────
const v1 = await vuelta('https://comprobacion-1.supabase.co');
check('con la función: dos llamadas (lugares y colecciones), no una por municipio',
  v1.llamadas.length === 2 && v1.llamadas.includes('public_seo_places') && v1.llamadas.includes('public_collections'), v1.llamadas.join(', '));
compara('con la función', v1, esperado({ completa: true }));
// Unos casos sueltos, para que se lea qué se espera.
check('con la función: Málaga con su provincia, sus ofertas y «musica»', ['/hoy/malaga', '/agenda/malaga', '/ofertas/malaga', '/agenda/malaga/musica', '/provincia/malaga'].every((p) => v1.locs.has(p)));
check('con la función: una categoría por debajo del umbral no sale', !v1.locs.has('/agenda/malaga/deporte'));
check('con la función: un municipio por debajo del umbral no sale', ![...v1.locs].some((p) => p.endsWith('/pueblo-4')));
check('con la función: sin nada esta semana, «hoy» sí y agenda no', v1.locs.has('/hoy/pueblo-1') && !v1.locs.has('/agenda/pueblo-1'));
check('con la función: la provincia por debajo de su umbral no sale', !v1.locs.has('/provincia/teruel'));

// ── 2. Sin public_seo_places (prod antes de su migración) ────────────────
const v2 = await vuelta('https://comprobacion-2.supabase.co', ['public_seo_places']);
check('sin la función: tres llamadas (municipios, sitios y colecciones), no una por municipio',
  v2.llamadas.length === 4 && v2.llamadas.filter((f) => f !== 'public_seo_places').length === 3, v2.llamadas.join(', '));
compara('sin la función', v2, esperado({ completa: false, conSitios: true }));
check('sin la función: sin ofertas ni provincias', ![...v2.locs].some((p) => /^\/(ofertas|provincia)\//.test(p)));

// ── 3. Sin ninguna de las dos ───────────────────────────────────────────────
const v3 = await vuelta('https://comprobacion-3.supabase.co', ['public_seo_places', 'public_sitemap_places']);
compara('sin ninguna', v3, esperado({ completa: false, conSitios: false }));

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
