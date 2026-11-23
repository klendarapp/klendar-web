// Cuánto tarda Explorar con la caché del borde, antes y después de las celdas
// (RUNBOOK §4zzz-explorar). Sin Cloudflare: el middleware de verdad
// (functions/_middleware.js) con una Cache API de mentira y la página de
// verdad contra el Supabase falso de tools/_web_con_datos.mjs, con [ESPERA]
// ms por llamada a la base (lo que tarda prod en contestar, más o menos).
//
// Diez personas de la misma celda abren Explorar › lista:
//   - «Cerca de mí»: antes, cada una con su punto (`?lat=&lng=`, 3 decimales);
//     ahora, con la celda (`?celda=`);
//   - sin nada en la dirección (la zona aproximada de la conexión).
//
//   node tools/celda_mide.mjs [raíz de otra copia de la web, para «antes»]
//   ESPERA=80 node tools/celda_mide.mjs ../klw-antes
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { webConDatos } from './_web_con_datos.mjs';

const ESPERA = Number(process.env.ESPERA || 80);
const raiz = resolve(process.argv[2] || new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const de = (rel) => pathToFileURL(resolve(raiz, rel)).href;

// La Cache API de Cloudflare, de mentira (guarda hasta su max-age).
const guardado = new Map();
globalThis.caches = {
  default: {
    async match(req) { const g = guardado.get(req.url); return g && Date.now() < g.hasta ? new Response(g.cuerpo, { status: g.status, headers: g.headers }) : undefined; },
    async put(req, res) {
      const ma = Number((/max-age=(\d+)/.exec(res.headers.get('cache-control') || '') || [])[1] || 0);
      guardado.set(req.url, { cuerpo: await res.text(), status: res.status, headers: [...res.headers], hasta: Date.now() + ma * 1000 });
    },
  },
};

const web = await webConDatos({ puerto: Number(process.env.PORT || 8981) });
const fetchDeVerdad = globalThis.fetch;
globalThis.fetch = async (u, ...r) => {
  if (String(u).startsWith(web.FALSO)) await new Promise((ok) => setTimeout(ok, ESPERA));
  return fetchDeVerdad(u, ...r);
};
process.env.SUPABASE_URL = web.FALSO;
process.env.SUPABASE_KEY = 'falsa';
const { onRequest } = await import(de('functions/_middleware.js'));
const explorar = await import(de('functions/explorar/index.js'));

const ZONA = { country: 'ES', latitude: '40.41', longitude: '-3.70' };
async function visita(ruta, cf) {
  const request = new Request(`https://klendar.app${ruta}`, { headers: { 'user-agent': 'Mozilla/5.0 medida' } });
  if (cf) Object.defineProperty(request, 'cf', { value: cf });
  const pendientes = [];
  const ctx = { request, env: { SUPABASE_URL: web.FALSO, SUPABASE_KEY: 'falsa' }, waitUntil: (p) => pendientes.push(p), next: () => explorar.onRequestGet({ request, env: ctx.env }) };
  const t0 = performance.now();
  let r = await onRequest(ctx);
  // Un 301 (un enlace de antes con el punto): se sigue, como el navegador.
  if (r.status === 301) return visita(r.headers.get('location').replace('https://klendar.app', ''), cf).then((x) => ({ ...x, ms: x.ms + (performance.now() - t0) }));
  await r.text();
  const ms = performance.now() - t0;
  await Promise.all(pendientes);
  return { ms, estado: r.headers.get('x-klendar-cache') };
}
const med = (l) => { const s = [...l].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

// Diez puntos de la misma celda (ezjmg, Madrid centro), cada uno el suyo.
const puntos = Array.from({ length: 10 }, (_, i) => [40.4001 + i * 0.0021, -3.7301 + i * 0.0029]);
const celda = (await import(de('assets/celda.js')).catch(() => null))?.default;
const conCelda = Boolean(celda);
const res = { cerca: [], zona: [] };
for (const [lat, lng] of puntos) {
  const ruta = conCelda ? `/explorar?vista=lista&celda=${celda.de(lat, lng)}` : `/explorar?vista=lista&lat=${lat.toFixed(3)}&lng=${lng.toFixed(3)}`;
  res.cerca.push(await visita(ruta));
}
for (let i = 0; i < 10; i += 1) res.zona.push(await visita('/explorar?vista=lista', ZONA));
for (const [k, l] of Object.entries(res)) {
  const primera = l[0];
  const resto = l.slice(1);
  console.log(`${conCelda ? 'después' : 'antes  '} · ${k === 'cerca' ? '«Cerca de mí»' : 'zona de la conexión'}: 1.ª ${Math.round(primera.ms)} ms (${primera.estado}); las 9 siguientes, mediana ${Math.round(med(resto.map((x) => x.ms)))} ms (${[...new Set(resto.map((x) => x.estado))].join('/')})`);
}
await web.cierra();
process.exit(0);
