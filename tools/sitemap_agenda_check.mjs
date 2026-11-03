// El sitemap de la agenda en una sola llamada a la base (revisión del
// 3-11-2026, 5.5): `public_sitemap_places` (migración 20261260100060 de la
// app) en vez de un `public_categories` por municipio, que con el plan
// gratis de Cloudflare (50 subpeticiones) fallaba entero a partir de unos 48.
//
//   node tools/sitemap_agenda_check.mjs
//
// Llama a la Function de verdad contra dev (que en el sitemap sale vacío a
// propósito: aquí se le hace creer que no es dev cambiando la dirección y
// pasando las llamadas a dev) y cuenta las subpeticiones. También prueba la
// vuelta a lo de antes si la base aún no tiene la función (prod antes de su
// migración), con su tope.

import { readFileSync } from 'node:fs';

const cfg = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const URL_DEV = cfg.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0];
const KEY = cfg.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0] || cfg.match(/eyJ[A-Za-z0-9._-]+/)[0];
const FALSA = 'https://comprobacion.supabase.co';

let fallos = 0;
const check = (msg, ok, extra = '') => {
  console.log(`${ok ? '✔' : '✘'} ${msg}${ok || !extra ? '' : ` (${extra})`}`);
  if (!ok) fallos++;
};

const real = globalThis.fetch;
let llamadas = [];
let sinFuncion = false;
globalThis.fetch = (url, opts) => {
  const u = String(url);
  llamadas.push(u.replace(FALSA, ''));
  if (sinFuncion && u.endsWith('/rpc/public_sitemap_places')) return Promise.resolve(new Response('{}', { status: 404 }));
  return real(u.replace(FALSA, URL_DEV), opts);
};

const { onRequestGet } = await import('../functions/sitemap-agenda.xml.js');
const ctx = { env: { SUPABASE_URL: FALSA, SUPABASE_KEY: KEY }, request: new Request('https://klendar.app/sitemap-agenda.xml') };

const r = await onRequestGet(ctx);
const xml = await r.text();
const lugares = await real(`${URL_DEV}/rest/v1/rpc/public_sitemap_places`, {
  method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}',
}).then((x) => x.json());
check('responde 200', r.status === 200, r.status);
check('dos llamadas a la base (lugares y selecciones), no una por municipio', llamadas.length === 2, llamadas.join(', '));
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
check('sin la función: las mismas agendas', lugares.every((l) => xml2.includes(`/agenda/${encodeURIComponent(String(l.slug || l.city).toLowerCase())}/<`)));

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
