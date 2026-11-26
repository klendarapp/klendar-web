// Revisión general, parte 4 (§4zzz-revweb): la web pública, lo que se
// arregló y necesita un navegador. Con datos de mentira (Chromium, unos s).
//
//  · «Busca tu municipio»: Intro antes de que lleguen los resultados de lo
//    escrito elige de lo escrito, no el primero de la búsqueda de antes.
//  · Portada, «Ahora mismo»: cambiar de ciudad deprisa enseña la última
//    elegida (no la que llega tarde) y, si no llega, el selector vuelve a
//    la que se ve.
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

// Portada: el selector de ciudad de «Ahora mismo».
{
  const ctx = await nav.newContext();
  const plan = (n, ciudad) => ({ id: `a9000000-0000-4000-8000-0000000007${n}0`, title: `Plan de ${ciudad}`, business_name: ciudad, starts_at: new Date(Date.now() + 864e5).toISOString(), images: [] });
  const espera = { madrid: 0, malaga: 1500, barcelona: 100 };
  let cortar = false;
  await ctx.route(`${SUPA}/rest/v1/rpc/public_city_agenda`, async (r) => {
    const c = r.request().postDataJSON()?.p_city;
    if (cortar) return r.abort('internetdisconnected');
    await new Promise((x) => setTimeout(x, espera[c] ?? 0));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([plan(1, c), plan(2, c)]) });
  });
  await ctx.route(`${SUPA}/rest/v1/rpc/public_cities`, (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify([{ slug: 'madrid', city: 'Madrid' }, { slug: 'malaga', city: 'Málaga' }, { slug: 'barcelona', city: 'Barcelona' }]) }));
  const p = await ctx.newPage();
  await p.goto(`${web.BASE}/`);
  await p.waitForSelector('#liveSelect', { timeout: 10000 });
  await p.selectOption('#liveSelect', 'malaga');
  await p.selectOption('#liveSelect', 'barcelona');
  await p.waitForTimeout(2200);
  const [valor, primera] = await p.evaluate(() => [document.getElementById('liveSelect').value, document.querySelector('#liveList b')?.textContent]);
  ok('portada: la última ciudad elegida, aunque la de antes llegue tarde', valor === 'barcelona' && primera === 'Plan de barcelona', `${valor} · ${primera}`);
  cortar = true;
  await p.selectOption('#liveSelect', 'madrid');
  await p.waitForTimeout(800);
  const [v2, p2] = await p.evaluate(() => [document.getElementById('liveSelect').value, document.querySelector('#liveList b')?.textContent]);
  ok('portada: sin red, el selector vuelve a la ciudad que se ve', v2 === 'barcelona' && p2 === 'Plan de barcelona', `${v2} · ${p2}`);
  await ctx.close();
}

await nav.close();
await web.cierra();
console.log(fallos ? `\n${fallos} fallos` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
