// El mapa de Sitios cuando falla `map_places` (Iván, 6-11, como la app): vuelve a
// probar solo (a los 2, 5 y 10 s) y, si sigue fallando, un aviso pequeño con
// «Reintentar». Antes se quedaba sin puntos sin decir nada. El mapa de Mapbox y
// `map_places`, contestados aquí: no toca dev ni prod.
//
//   SUPABASE_BLOQUEADO=1 PORT=8874 node tools/serve_dev.mjs &
//   BASE=http://localhost:8874 PW=<ruta a playwright> node tools/sitios_reintento_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium } = playwright();
const BASE = process.env.BASE || 'http://localhost:8874';
await servidorSeguro(BASE);

const MAPBOX = `window.mapboxgl = { Map: class {
  constructor(o) { this.o = o; this.h = {}; setTimeout(() => (this.h.load || []).forEach((f) => f()), 0); }
  on(e, f) { (this.h[e] = this.h[e] || []).push(f); } off() {} addControl() {} easeTo() {} fitBounds() {}
  getBounds() { return { getSouth: () => 36, getWest: () => -5, getNorth: () => 37, getEast: () => -4 }; }
  getZoom() { return 12; } getContainer() { return this.o.container; }
}, NavigationControl: class {}, Popup: class {}, Marker: class {}, LngLatBounds: class {} };`;

let fallos = 0;
const ok = (c, m, x = '') => { if (!c) fallos += 1; console.log(`  ${c ? 'ok ' : 'MAL'} ${m} ${c ? '' : x}`); };

const nav = await chromium.launch();
async function abre(fallan) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES' });
  await ctx.route('https://api.mapbox.com/**', (r) => (r.request().url().endsWith('.js')
    ? r.fulfill({ contentType: 'text/javascript', body: MAPBOX }) : r.fulfill({ contentType: 'text/css', body: '' })));
  await ctx.route(`${BASE}/api/mapbox-token`, (r) => r.fulfill({ contentType: 'application/json', body: '{"token":"prueba"}' }));
  const estado = { pedidas: 0, fallan };
  await ctx.route('**/rest/v1/rpc/map_places', (r) => {
    estado.pedidas += 1;
    return estado.pedidas <= estado.fallan
      ? r.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      : r.fulfill({ contentType: 'application/json', body: '[]' });
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(30000);
  await p.goto(`${BASE}/explorar?que=sitios&vista=mapa&lat=36.72&lng=-4.42`);
  return { ctx, p, estado };
}
const AVISO = '.sitios-sin-puntos';

// Un fallo suelto: vuelve a probar solo y no se dice nada.
{
  const { ctx, p, estado } = await abre(1);
  await p.waitForTimeout(3000);
  ok(estado.pedidas === 2, 'un fallo: vuelve a pedirlo solo a los 2 s', String(estado.pedidas));
  ok(await p.locator(AVISO).count() === 0, 'un fallo: sin aviso');
  await ctx.close();
}
// Sigue fallando: el aviso; al tocarlo, otra vez.
{
  const { ctx, p, estado } = await abre(4);
  await p.waitForSelector(AVISO, { timeout: 25000 });
  ok(estado.pedidas === 4, 'sigue fallando: tres reintentos y el aviso', String(estado.pedidas));
  ok(/No hemos podido cargar lo que hay en el mapa/.test(await p.textContent(AVISO)) && /Reintentar/.test(await p.textContent(AVISO)), 'el aviso dice lo mismo que la app');
  await p.click(AVISO);
  await p.waitForSelector(AVISO, { state: 'detached' });
  ok(estado.pedidas === 5, '«Reintentar» vuelve a pedirlo y quita el aviso', String(estado.pedidas));
  await ctx.close();
}
await nav.close();
console.log(fallos ? `${fallos} fallos` : 'Todo bien');
process.exit(fallos ? 1 : 0);
