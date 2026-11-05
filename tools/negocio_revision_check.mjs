// El negocio de revisión de las tiendas fuera de los buscadores (2026-11-05),
// con Supabase simulado (no toca dev ni prod):
//
//  1. Su ficha (`business_ficha_info.review_only`) se abre con el enlace, pero
//     con `noindex, nofollow` (meta y cabecera), sin JSON-LD, canonical ni
//     hreflang, en español, en inglés y en sus listas (`?ver=carta`, `?ver=resenas`).
//  2. La de un negocio normal no cambia, y tampoco si la función no trae la marca
//     (la base aún sin la migración).
//  3. Fuera de `sitemap-negocios.xml` y de «Planes con niños»; y si la base aún
//     no tiene la columna (400), el sitemap sigue saliendo con el resto.
//
//   node tools/negocio_revision_check.mjs
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SUPA } from './_supabase_simulado.mjs';

const PORT = Number(process.env.PORT || 8877);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8878);
const DEMO = 'b1000000-0000-4000-8000-00000000de40';
const NORMAL = 'b1000000-0000-4000-8000-00000000de41';
const SIN_MARCA = 'b1000000-0000-4000-8000-00000000de42';
const SLUGS = { 'klendar-demo-madrid': DEMO, 'bar-sonda-madrid': NORMAL, 'bar-viejo-madrid': SIN_MARCA };
const estado = { conColumna: true };
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const falso = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let cuerpo = '';
  req.on('data', (c) => { cuerpo += c; });
  req.on('end', () => {
    const json = (b, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
    let args = {};
    try { args = JSON.parse(cuerpo || '{}'); } catch { /* */ }
    const p = url.pathname;
    if (p === '/rest/v1/rpc/resolve_business_slug') {
      const id = SLUGS[args.p_slug];
      return json(id ? [{ id, slug: args.p_slug }] : []);
    }
    if (p === '/rest/v1/rpc/business_profile') {
      return json([{ id: args.p_id, name: args.p_id === DEMO ? 'Klendar DEMO · no es un local real' : 'Bar Sonda', city: 'Madrid', address: 'Calle Mayor 1',
        lat: 40.4168, lng: -3.7038, is_verified: true, member_since: '2026-01-01T00:00:00Z', time_zone: 'Europe/Madrid',
        description: 'Prueba.', closed_indefinitely: false, social: {}, rating: null, ratings: 0 }]);
    }
    if (p === '/rest/v1/rpc/business_ficha_info') {
      if (args.p_business === SIN_MARCA) return json({ highlights: [], moments: [], special_days: [], holiday: null });
      return json({ highlights: [], moments: [], special_days: [], holiday: null, review_only: args.p_business === DEMO });
    }
    if (p === '/rest/v1/rpc/public_explore') return json({ total: 0, items: [] });
    if (p === '/rest/v1/rpc/public_cities') return json([{ city: 'Madrid', slug: 'madrid', n: 1 }]);
    if (p.startsWith('/rest/v1/rpc/')) return json([]);
    if (p === '/rest/v1/businesses') {
      const conFiltro = url.searchParams.get('review_only') === 'eq.false';
      if (conFiltro && !estado.conColumna) return json({ code: '42703', message: 'column businesses.review_only does not exist' }, 400);
      const todos = [
        { id: NORMAL, slug: 'bar-sonda-madrid', name: 'Bar Sonda', city: 'Madrid', updated_at: '2026-11-01T00:00:00Z', amenities: ['kids'] },
        ...(conFiltro ? [] : [{ id: DEMO, slug: 'klendar-demo-madrid', name: 'Klendar DEMO', city: 'Madrid', updated_at: '2026-11-01T00:00:00Z', amenities: ['kids'] }]),
      ];
      return json(todos);
    }
    return json([]);
  });
});
await new Promise((r) => falso.listen(FALSO_PORT, r));
const servidor = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
  env: { ...process.env, PORT: String(PORT), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa', SUPABASE_URL_NAVEGADOR: SUPA }, stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 2000));

const BASE = `http://localhost:${PORT}`;
const pide = async (ruta) => {
  const r = await fetch(BASE + ruta, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/120', 'accept-language': 'es' } });
  return { status: r.status, robots: r.headers.get('x-robots-tag'), txt: await r.text() };
};
const meta = (t) => (t.match(/<meta name="robots" content="([^"]*)"/g) || []).map((m) => m.match(/content="([^"]*)"/)[1]);

try {
  for (const ruta of ['/b/klendar-demo-madrid', '/en/b/klendar-demo-madrid', '/b/klendar-demo-madrid?ver=carta', '/b/klendar-demo-madrid?ver=resenas']) {
    const r = await pide(ruta);
    ok(r.status === 200 && r.txt.includes('Klendar DEMO'), `${ruta}: se abre con el enlace`);
    ok(meta(r.txt).join() === 'noindex, nofollow', `${ruta}: una sola orden, noindex, nofollow (${meta(r.txt)})`);
    ok(r.robots === 'noindex, nofollow', `${ruta}: cabecera x-robots-tag (${r.robots})`);
    ok(!r.txt.includes('application/ld+json') && !r.txt.includes('LocalBusiness'), `${ruta}: sin datos estructurados`);
    ok(!r.txt.includes('rel="canonical"') && !/rel="alternate"[^>]*hreflang/.test(r.txt), `${ruta}: sin canonical ni alternates`);
  }
  for (const [ruta, que] of [['/b/bar-sonda-madrid', 'normal'], ['/b/bar-viejo-madrid', 'sin la migración']]) {
    const r = await pide(ruta);
    ok(meta(r.txt).join() === 'index, follow' && r.robots === 'all', `${que}: indexable (${meta(r.txt)} · ${r.robots})`);
    ok(r.txt.includes('"LocalBusiness"') && r.txt.includes('rel="canonical"'), `${que}: con JSON-LD y canonical`);
  }
  const ninos = await pide('/con-ninos/madrid/');
  ok(ninos.status === 200 && ninos.txt.includes('bar-sonda-madrid') && !ninos.txt.includes('klendar-demo-madrid'), 'Planes con niños: el normal sí, el de revisión no');

  let mapa = await pide('/sitemap-negocios.xml');
  ok(mapa.status === 200 && mapa.txt.includes('/b/bar-sonda-madrid') && !mapa.txt.includes('klendar-demo'), 'sitemap: sin el de revisión');
  estado.conColumna = false;
  mapa = await pide('/sitemap-negocios.xml');
  ok(mapa.status === 200 && mapa.txt.includes('/b/bar-sonda-madrid'), 'sitemap sin la columna en la base: no se rompe');
} finally {
  servidor.kill();
  falso.close();
}
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
