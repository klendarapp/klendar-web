// Revisión general, parte 4 (§4zzz-revweb): la web pública, lo que se
// arregló y necesita un navegador. Con datos de mentira (Chromium, unos s).
//
//  · «Busca tu municipio»: Intro antes de que lleguen los resultados de lo
//    escrito elige de lo escrito, no el primero de la búsqueda de antes.
//
//   node tools/revweb_check.mjs
import { webConDatos } from './_web_con_datos.mjs';
import { playwright, SUPA } from './_supabase_simulado.mjs';

const web = await webConDatos({ puerto: 8977 });
const { chromium } = playwright();
const nav = await chromium.launch();
let fallos = 0;
const ok = (nombre, cond, extra = '') => { console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}${cond || !extra ? '' : ` (${extra})`}`); if (!cond) fallos++; };

// «Busca tu municipio», en una página vacía de la web con solo municipios.js.
{
  const ctx = await nav.newContext();
  const MUNIS = { mad: [{ slug: 'madrid', name: 'Madrid', province: 'Madrid' }], madrigal: [{ slug: 'madrigal-de-la-vera', name: 'Madrigal de la Vera', province: 'Cáceres' }] };
  await ctx.route(`${SUPA}/rest/v1/rpc/search_municipalities`, async (r) => {
    const q = String(r.request().postDataJSON()?.p_q || '').toLowerCase();
    await new Promise((x) => setTimeout(x, 120));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MUNIS[q] || []) });
  });
  await ctx.route(`${web.BASE}/prueba-municipios`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><meta charset="utf-8">
    <script>window.KLENDAR_ENV = { url: ${JSON.stringify(SUPA)}, key: 'k' };</script>
    <div data-muni-busca data-muni-href="/destino/__SLUG__"><form action="/destino"><input type="search" name="q"></form><div data-muni-res></div></div>
    <script src="/assets/municipios.js"></script>` }));
  await ctx.route(`${web.BASE}/destino/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
  const p = await ctx.newPage();
  await p.goto(`${web.BASE}/prueba-municipios`);
  await p.fill('input[type=search]', 'Mad');
  await p.waitForSelector('[data-muni-res] a');
  await p.type('input[type=search]', 'rigal', { delay: 10 });
  await p.keyboard.press('Enter');
  await p.waitForURL(/\/destino\//, { timeout: 5000 }).catch(() => {});
  ok('municipios: Intro deprisa elige de lo escrito ahora', p.url().endsWith('/destino/madrigal-de-la-vera'), p.url());
  await ctx.close();
}

await nav.close();
await web.cierra();
console.log(fallos ? `\n${fallos} fallos` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
