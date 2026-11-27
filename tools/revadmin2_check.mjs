// Revisión general, parte 5 (§4zzz-revadmin2 de la app): el admin.
//  1. «Algo ha fallado» se vuelve a intentar solo al volver la red y al volver
//     a la pestaña (antes se quedaba hasta pulsar «Reintentar»).
//  2. Una lista de dentro de una pantalla (una pestaña, un filtro) que no
//     carga: el aviso con «Reintentar» (antes solo el texto) y, también, de
//     nuevo sola al volver la red.
//  3. Una ficha con un id que no es un id (`/negocios/xyz`): «no encontrado»
//     sin preguntar a la base, y lo que no está no se reintenta solo.
//  4. `not_authorized` / `forbidden` de las funciones que miran `is_admin()`:
//     «No tienes permiso para esto.» (antes, «Prueba otra vez»).
//  5. «Buscar festivos» (Edge Function `holidays`) con tope: sin respuesta,
//     a los 160 s el error y el botón libre (antes, la aguja para siempre).
// Base simulada (_admin_simulado), Chromium y WebKit (~30 s).
//
//   node tools/revadmin2_check.mjs
import { adminDe, playwright, SUPA } from './_supabase_simulado.mjs';
import { webConDatos } from './_web_con_datos.mjs';
import { conSesionAdmin } from './_admin_simulado.mjs';

const web = await webConDatos({ puerto: 9611 });
const ADMIN = adminDe(web.BASE);
const pw = playwright();
let fallos = 0;
const ok = (nombre, cond, extra = '') => { console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}${cond || !extra ? '' : ` (${extra})`}`); if (!cond) fallos++; };

/** Un contexto con la sesión de admin; `falla` (Set de funciones que dan 500
 *  o un objeto { fn: { status, body } }) se puede cambiar sobre la marcha. */
async function contexto(nav, estado) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await conSesionAdmin(ctx);
  estado.llamadas = [];
  await ctx.route(`${SUPA}/rest/v1/rpc/**`, (r) => {
    const fn = new URL(r.request().url()).pathname.split('/').pop();
    estado.llamadas.push(fn);
    const f = estado.falla?.[fn];
    if (f) return r.fulfill({ status: f.status || 500, contentType: 'application/json', body: JSON.stringify(f.body || { code: 'XX000', message: 'boom' }) });
    return r.fallback();
  });
  return ctx;
}
const titulo = (p) => p.evaluate(() => (document.querySelector('#view h1, #view h2')?.textContent || '').trim());
const espera = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: 10000 }).then(() => true).catch(() => false);
const ROTO = () => (document.querySelector('#view .vacio h2')?.textContent || '').includes('Algo ha fallado');

for (const tipo of ['chromium', 'webkit']) {
  const nav = await pw[tipo].launch();
  console.log(`— ${tipo}`);

  // 1. «Algo ha fallado» → vuelve la red / la pestaña → la pantalla.
  for (const como of ['online', 'visibilitychange']) {
    const estado = { falla: { admin_businesses_page: {} } };
    const ctx = await contexto(nav, estado);
    const p = await ctx.newPage();
    await p.goto(`${ADMIN}/negocios`);
    ok(`${como}: sale «Algo ha fallado»`, await espera(p, ROTO));
    estado.falla = {};
    await p.evaluate((c) => (c === 'online' ? dispatchEvent(new Event('online')) : document.dispatchEvent(new Event('visibilitychange'))), como);
    ok(`${como}: se vuelve a pedir sola y se pinta`, await espera(p, () => document.querySelector('#view h1')?.textContent.trim() === 'Negocios' && !document.querySelector('#view .vacio h2')), await titulo(p));
    // Ya pintada: otro «online» no vuelve a pintar.
    const antes = estado.llamadas.filter((f) => f === 'admin_businesses_page').length;
    await p.evaluate(() => dispatchEvent(new Event('online')));
    await p.waitForTimeout(400);
    ok(`${como}: pintada, otro «online» no la vuelve a pedir`, estado.llamadas.filter((f) => f === 'admin_businesses_page').length === antes);
    await ctx.close();
  }

  // 2. Una pestaña que no carga: aviso con «Reintentar» y de nuevo al volver la red.
  {
    const estado = { falla: {} };
    const ctx = await contexto(nav, estado);
    const p = await ctx.newPage();
    await p.goto(`${ADMIN}/avisos`);
    await espera(p, () => document.querySelector('#sendf'));
    estado.falla = { admin_audit: {} };
    await p.click('.tabs button[data-t="history"]');
    ok('pestaña que falla: el aviso con «Reintentar»', await espera(p, () => document.querySelector('#tabview .carga-fallida [data-reintentar]') && !document.querySelector('#tabview .loading')));
    estado.falla = {};
    await p.evaluate(() => dispatchEvent(new Event('online')));
    ok('pestaña que falla: al volver la red, la lista', await espera(p, () => !document.querySelector('.carga-fallida') && document.querySelector('#tabview table, #tabview .empty')));
    ok('pestaña que falla: se queda en la misma pestaña', new URL(p.url()).search.includes('tab=history'), p.url());
    // Y con el botón.
    estado.falla = { admin_audit: {} };
    await p.click('.tabs button[data-t="push"]');
    await p.click('.tabs button[data-t="history"]');
    await espera(p, () => document.querySelector('.carga-fallida [data-reintentar]'));
    estado.falla = {};
    await p.click('.carga-fallida [data-reintentar]', { timeout: 5000 }).catch(() => {});
    ok('pestaña que falla: «Reintentar» la pinta', await espera(p, () => !document.querySelector('.carga-fallida') && document.querySelector('#tabview table, #tabview .empty')));
    await ctx.close();
  }

  // 3. Ids que no son ids.
  for (const [ruta, fn, texto] of [['/negocios/xyz', 'admin_business_detail', 'Negocio no encontrado.'], ['/publicaciones/1%27or%271', 'admin_offer_detail', 'Publicación no encontrada.'],
    ['/usuarios/abc', 'admin_user_detail', 'Usuario no encontrado.'], ['/pedidos/zzz', 'admin_venue_request_detail', 'Ese sitio pedido no existe']]) {
    const estado = { falla: {} };
    const ctx = await contexto(nav, estado);
    const p = await ctx.newPage();
    await p.goto(ADMIN + ruta);
    ok(`${ruta}: «${texto}»`, await espera(p, (t) => (document.querySelector('#view .vacio p')?.textContent || '').includes(t), texto));
    ok(`${ruta}: sin preguntar a la base`, !estado.llamadas.includes(fn), estado.llamadas.join(','));
    const n = estado.llamadas.length;
    await p.evaluate(() => { dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForTimeout(400);
    ok(`${ruta}: no se reintenta solo`, estado.llamadas.length === n && await p.evaluate(ROTO));
    await ctx.close();
  }
  // Uno que sí es un id pero no está (la base da null): tampoco se reintenta solo.
  {
    const estado = { falla: {} };
    const ctx = await contexto(nav, estado);
    await ctx.route(`${SUPA}/rest/v1/rpc/admin_user_detail`, (r) => { estado.llamadas.push('admin_user_detail'); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }); });
    const p = await ctx.newPage();
    await p.goto(`${ADMIN}/usuarios/00000000-0000-4000-8000-000000000000`);
    ok('id que no está: «Usuario no encontrado.»', await espera(p, () => (document.querySelector('#view .vacio p')?.textContent || '').includes('Usuario no encontrado.')));
    const n = estado.llamadas.filter((f) => f === 'admin_user_detail').length;
    await p.evaluate(() => dispatchEvent(new Event('online')));
    await p.waitForTimeout(400);
    ok('id que no está: no se reintenta solo', estado.llamadas.filter((f) => f === 'admin_user_detail').length === n);
    await ctx.close();
  }

  // 4. not_authorized / forbidden.
  for (const [ruta, fn, codigo] of [['/artistas', 'admin_artists', 'not_authorized'], ['/traduccion', 'admin_translation_usage', 'forbidden']]) {
    const estado = { falla: { [fn]: { status: 400, body: { code: 'P0001', message: codigo } } } };
    const ctx = await contexto(nav, estado);
    const p = await ctx.newPage();
    await p.goto(ADMIN + ruta);
    const visto = await espera(p, () => /No tienes permiso para esto/.test(document.querySelector('#view')?.textContent || '') || [...document.querySelectorAll('.toast')].some((t) => /No tienes permiso para esto/.test(t.textContent)));
    ok(`${ruta} con ${codigo}: «No tienes permiso para esto.»`, visto, await p.evaluate(() => document.querySelector('#view')?.textContent.slice(0, 120)));
    await ctx.close();
  }

  // 5. «Buscar festivos» sin respuesta: a los 160 s, el error y el botón libre.
  {
    const estado = { falla: {} };
    const ctx = await contexto(nav, estado);
    let pedida = false;
    await ctx.route(`${SUPA}/functions/v1/holidays`, () => { pedida = true; /* nunca contesta */ });
    const p = await ctx.newPage();
    await p.clock.install();
    await p.goto(`${ADMIN}/festivos`);
    await espera(p, () => document.querySelector('#buscar'));
    await p.click('#buscar');
    await espera(p, () => document.querySelector('#buscar')?.disabled);
    for (let i = 0; i < 20 && !pedida; i++) await p.waitForTimeout(100);
    ok('festivos: se pide a la Edge Function', pedida);
    await p.clock.runFor(150000);
    ok('festivos: a los 150 s sigue esperando', await p.evaluate(() => document.querySelector('#buscar')?.disabled));
    await p.clock.runFor(12000);
    ok('festivos: a los 160 s, el botón libre', await espera(p, () => !document.querySelector('#buscar')?.disabled));
    ok('festivos: y el error', await espera(p, () => [...document.querySelectorAll('.toast.bad')].length > 0));
    await ctx.close();
  }
  await nav.close();
}
await web.cierra();
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
