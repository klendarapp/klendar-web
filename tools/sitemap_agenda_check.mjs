// El sitemap de la agenda en una sola llamada a la base (revisión del
// 3-11-2026, 5.5): `public_sitemap_places` (migración 20261260100060 de la
// app) en vez de un `public_categories` por municipio, que con el plan
// gratis de Cloudflare (50 subpeticiones) fallaba entero a partir de unos 48.
//
//   node tools/sitemap_agenda_check.mjs
//
// Llama a la Function de verdad con la base simulada aquí (45 municipios de
// mentira; nada sale a Supabase: ver tools/_supabase_simulado.mjs) y cuenta
// las subpeticiones. También prueba la vuelta a lo de antes si la base aún no
// tiene la función (prod antes de su migración), con su tope.

import { KEY } from './_supabase_simulado.mjs';

// Una dirección que no es la de dev (con la de dev el sitemap sale vacío a
// propósito, ver datosDePrueba): nunca llega a la red, se contesta aquí.
const FALSA = 'https://comprobacion.supabase.co';
const LUGARES = Array.from({ length: 45 }, (_, i) => ({
  city: i === 0 ? 'Málaga' : `Pueblo ${i}`, slug: i === 0 ? 'malaga' : `pueblo-${i}`,
  cats: i % 3 === 0 ? [] : ['musica', i % 2 ? 'teatro' : 'deporte'], kids: i % 4 !== 0,
}));
const COLECCIONES = [{ slug: 'finde' }, { slug: 'con-ninos' }];

let fallos = 0;
const check = (msg, ok, extra = '') => {
  console.log(`${ok ? '✔' : '✘'} ${msg}${ok || !extra ? '' : ` (${extra})`}`);
  if (!ok) fallos++;
};

let llamadas = [];
let sinFuncion = false;
const responde = (x, status = 200) => Promise.resolve(new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } }));
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  llamadas.push(u.replace(FALSA, ''));
  if (!u.startsWith(`${FALSA}/rest/v1/rpc/`)) return responde({ message: 'sin simular' }, 404);
  const fn = u.slice(`${FALSA}/rest/v1/rpc/`.length);
  if (fn === 'public_sitemap_places') return sinFuncion ? responde({}, 404) : responde(LUGARES);
  if (fn === 'public_cities') return responde(LUGARES.map(({ city, slug }) => ({ city, slug })));
  if (fn === 'public_categories') {
    const { p_city: c } = JSON.parse(opts.body || '{}');
    return responde((LUGARES.find((l) => l.slug === c)?.cats || []).map((k) => ({ slug: k })));
  }
  if (fn === 'public_collections') return responde(COLECCIONES);
  return responde({ message: `sin simular: ${fn}` }, 404);
};

const { onRequestGet } = await import('../functions/sitemap-agenda.xml.js');
const ctx = { env: { SUPABASE_URL: FALSA, SUPABASE_KEY: KEY }, request: new Request('https://klendar.app/sitemap-agenda.xml') };

const r = await onRequestGet(ctx);
const xml = await r.text();
const lugares = LUGARES;
check('responde 200', r.status === 200, r.status);
check('dos llamadas a la base (lugares y selecciones), no una por municipio', llamadas.length === 2, llamadas.join(', '));
check('las colecciones', COLECCIONES.every((k) => xml.includes(`/coleccion/${k.slug}/<`)));
for (const l of lugares) {
  const slug = encodeURIComponent(String(l.slug || l.city).toLowerCase());
  check(`${l.city}: su agenda y su «hoy»`, xml.includes(`/agenda/${slug}/<`) && xml.includes(`/hoy/${slug}/<`));
  check(`${l.city}: sus ${l.cats.length} categorías`, l.cats.every((k) => xml.includes(`/agenda/${slug}/${encodeURIComponent(k)}/<`)));
  check(`${l.city}: «con niños» solo si hay algo (${l.kids})`, xml.includes(`/con-ninos/${slug}/<`) === l.kids);
}

// Sin la función (prod antes de la migración): lo de antes, con tope.
llamadas = [];
sinFuncion = true;
const r2 = await onRequestGet(ctx);
const xml2 = await r2.text();
check('sin la función: responde 200 igual', r2.status === 200, r2.status);
check('sin la función: lo de antes (una por municipio, como mucho 40)',
  llamadas.filter((u) => u.endsWith('/rpc/public_categories')).length === Math.min(40, lugares.length));
check('sin la función: las mismas agendas (las 40 primeras)', lugares.slice(0, 40).every((l) => xml2.includes(`/agenda/${encodeURIComponent(String(l.slug || l.city).toLowerCase())}/<`)));

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
