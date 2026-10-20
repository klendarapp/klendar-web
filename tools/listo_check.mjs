// Prueba de «Te aviso cuando esté listo» en la web local, con un Supabase de
// mentira (no toca dev ni manda nada):
//
//  1. Panel › #/pedidos: «3 preparando · 1 listo», los avisados hoy y la
//     espera media; «Listo» → `order_set_ready` y «Avisado el 24»;
//     «Recogido»; «Quitar» con su pregunta; «Terminar por hoy» con su
//     pregunta → «Has terminado por hoy» y «Volver a abrir»; sin
//     desplazamiento horizontal.
//  2. Panel › apagado: el propietario lo activa (`set_orders_enabled`); un
//     empleado ve «El avisador de pedidos está apagado» y no ve los botones de
//     gestión.
//  3. Panel › «Más herramientas» (la tarjeta), el resumen (la fila «Pedidos de
//     hoy · 3 preparando»), «Validar códigos» (el botón) y «Cifras» (el
//     plegable).
//  4. «Tu cuenta» › #/listo/<código>: «Avísame cuando esté listo» →
//     `order_join`, «Tu número 24 · Preparando…», «Mientras esperas» con
//     favoritos y lo de hoy; al marcarlo, «¡Listo! Pasa a recogerlo» (sin
//     recargar); «Ya no lo espero» con su pregunta; sin sesión, «Entrar para
//     que te avisemos»; «Tus códigos» con «Tu pedido en …»; el cartel malo;
//     en catalán.
//  5. Lo público (las Functions de verdad contra un Supabase falso):
//     /listo/<código> sin sesión, en pausa, apagado, cartel malo, en inglés
//     (/en/ready/<código>) y el cartel para imprimir (/cartel/listo/<código>).
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800). Capturas en OUT.
//
//   PORT=8811 node tools/serve_dev.mjs &
//   BASE=http://localhost:8811 PW=<ruta a playwright> OUT=<carpeta> node tools/listo_check.mjs
// (lo público arranca su propio serve_dev en PUB_PORT, 8812, contra un
// Supabase de mentira en 8813)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8811';
const OUT = process.env.OUT || '.';
const SOLO = process.env.SOLO || '';
const PUB_PORT = Number(process.env.PUB_PORT || 8812);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8813);
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-0000000115a1';
const BIZ = 'b1000000-0000-4000-8000-0000000115a1';
const CODE = 'Ab3_-Ab3_-Ab3_-A';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'listo.prueba@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const masMin = (m) => new Date(Date.now() + m * 60e3).toISOString();
const SUB = { plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: 'active', period_end: masMin(60 * 480), payment_method: 'transfer',
  price_cents: 1990, active_offers: 0, max_active_offers: null, has_analytics: true, boosts_included: 0, boosts_used: 0,
  billing: { enabled: true, blocked: false, hold: null, block_soon: false } };
const NEGOCIO = { id: BIZ, name: 'Café Norte', logo_url: null, slug: 'cafe-norte', address: 'Calle Mayor 1, 28013 Madrid', city: 'Madrid', adults_only: false };

function supabaseFalso(estado) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      estado.llamadas.push([fn, body]);
      const r = estado.rpc[fn];
      if (r !== undefined) return json(typeof r === 'function' ? r(body) : r);
      return json(null);
    }
    if (p.startsWith('/rest/v1/favorites')) return json(estado.fav ? [{ business_id: BIZ }] : []);
    if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, name: 'Café Norte', time_zone: 'Europe/Madrid', category_id: null, amenities: [], address: 'Calle Mayor 1', city: 'Madrid' }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

/** «Pedidos de hoy» de mentira: lo mismo que `business_orders` en la base. */
function pedidosFalso(rol = 'owner', { enabled = true } = {}) {
  const k = {
    enabled, ended: false,
    entries: [
      { id: 'o24', number: 24, status: 'waiting', name: 'Lucía', created_at: masMin(-7) },
      { id: 'o25', number: 25, status: 'waiting', name: null, created_at: masMin(-4) },
      { id: 'o26', number: 26, status: 'waiting', name: 'Jorge', created_at: masMin(0) },
      { id: 'o23', number: 23, status: 'ready', name: 'Carla', created_at: masMin(-12), ready_at: masMin(-2) },
      { id: 'o22', number: 22, status: 'picked_up', name: 'Pablo', created_at: masMin(-30), ready_at: masMin(-20), done_at: masMin(-15) },
    ],
    notified: 41,
  };
  const cuenta = (s) => k.entries.filter((e) => e.status === s).length;
  const estado = () => ({
    ok: true, enabled: k.enabled, can_manage: rol !== 'staff', blocked: false, paused: false, code: CODE,
    stats: { today: { notified: k.notified, avg_wait_minutes: 6.5 }, month: { notified: 812, avg_wait_minutes: 7.2 } },
    board: k.ended ? { status: 'ended', entries: [], waiting: 0, ready: 0 }
      : { status: 'open', waiting: cuenta('waiting'), ready: cuenta('ready'), picked_up: cuenta('picked_up'), entries: k.entries },
    now: new Date().toISOString(),
  });
  const pon = (id, status) => { const e = k.entries.find((x) => x.id === id); if (e) { e.status = status; if (status === 'ready') e.ready_at = masMin(0); else e.done_at = masMin(0); } };
  return { k, estado, rpc: {
    business_orders: () => estado(),
    set_orders_enabled: (b) => { k.enabled = b.p_enabled; return estado(); },
    order_set_ready: (b) => { pon(b.p_ticket, 'ready'); k.notified += 1; return { ...estado(), ready_id: b.p_ticket }; },
    order_set_status: (b) => { pon(b.p_ticket, b.p_status); return estado(); },
    end_orders: () => { k.ended = true; return estado(); },
    reopen_orders: () => { k.ended = false; return estado(); },
    rotate_order_code: () => estado(),
  } };
}

async function contextoPanel(nav, vp, { rol = 'owner', enabled = true } = {}) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
  const pf = pedidosFalso(rol, { enabled });
  const estado = { llamadas: [], rpc: {}, pf };
  Object.assign(estado.rpc, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: [{ id: BIZ, name: 'Café Norte', role: rol, verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
    business_is_organizer: false,
    my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
    my_subscription: SUB,
    business_stats: { redemptions_30d: 3 },
    my_business_offers: [],
    business_loyalty: { ok: true },
    business_tools_overview: () => ({ ok: true, can_edit: rol !== 'staff', team: { members: 2 }, series: { rules_active: 0 },
      orders: { enabled: pf.k.enabled, waiting: pf.k.entries.filter((e) => e.status === 'waiting').length, ready: 1, notified_today: pf.k.notified } }),
    business_private: { tax_id: '' },
    business_report: { ok: true, totals: {}, daily: [], offers: [], by_hour: [], redemptions: [], loyalty: {} },
    business_audience: null,
    business_link_taps_report: [],
    table_qr_stats: { ok: true, has: false },
    business_recent_validations: [],
    ...pf.rpc,
  });
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}
const vista = (p) => p.locator('#view').innerText();
const llamadas = (estado, fn) => estado.llamadas.filter(([f]) => f === fn);
const sinScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0);

async function pedidos(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contextoPanel(nav, vp);
  await p.goto(`${BASE}/panel/#/pedidos`);
  await p.waitForSelector('.listo-fila');
  let txt = await vista(p);
  ok(/Pedidos de hoy/.test(txt) && /3 preparando · 1 listo/.test(txt), `${nombre}/${t} pedidos: «3 preparando · 1 listo»`);
  ok(/Hoy: 41 pedidos avisados · Espera media: 6,5 min/.test(txt), `${nombre}/${t} pedidos: avisados hoy y espera media`);
  ok(/Lucía/.test(txt) && /hace 7 min/.test(txt) && /ahora mismo/.test(txt) && /listo hace 2 min/.test(txt), `${nombre}/${t} pedidos: nombre corto y cuánto llevan`);
  ok(/Terminados \(1\)/.test(txt), `${nombre}/${t} pedidos: «Terminados (1)» plegado`);
  ok(await sinScroll(p), `${nombre}/${t} pedidos: sin desplazamiento horizontal`);
  const coral = await p.locator('#view .btn.primary').count();
  ok(coral === 0, `${nombre}/${t} pedidos: sin coral en la lista (${coral})`);
  await p.screenshot({ path: `${OUT}/panel-pedidos-${nombre}-${t}.png`, fullPage: true });
  // «Listo» en el 24.
  await p.click('button[data-listo-ya="o24"]');
  await p.waitForTimeout(500);
  ok(llamadas(estado, 'order_set_ready')[0]?.[1]?.p_ticket === 'o24', `${nombre}/${t} pedidos: «Listo» → order_set_ready(o24)`);
  txt = await vista(p);
  ok(/2 preparando · 2 listos/.test(txt) && /Avisado el 24/.test(await p.locator('body').innerText()), `${nombre}/${t} pedidos: pasa a «Listos» y «Avisado el 24»`);
  // «Recogido» en el 23.
  await p.click('.listo-fila[data-pedido="o23"] button[data-recogido]');
  await p.waitForTimeout(500);
  ok(llamadas(estado, 'order_set_status').some(([, b]) => b.p_ticket === 'o23' && b.p_status === 'picked_up'), `${nombre}/${t} pedidos: «Recogido» → picked_up`);
  // «Quitar» el 25, con su pregunta.
  await p.click('.listo-fila[data-pedido="o25"] details.mas summary');
  await p.click('.listo-fila[data-pedido="o25"] button[data-quita]');
  await p.waitForSelector('#modal[open]');
  const dlg = await p.locator('#modal').innerText();
  ok(/¿Quitar el 25\?/.test(dlg) && /Le avisamos de que su pedido ya no está en la lista\./.test(dlg), `${nombre}/${t} pedidos: «¿Quitar el 25?»`);
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(500);
  ok(llamadas(estado, 'order_set_status').some(([, b]) => b.p_ticket === 'o25' && b.p_status === 'removed'), `${nombre}/${t} pedidos: «Quitar» → removed`);
  // «Terminar por hoy».
  await p.click('[data-listo="terminar"]');
  await p.waitForSelector('#modal[open]');
  ok(/¿Terminar por hoy\?/.test(await p.locator('#modal').innerText()), `${nombre}/${t} pedidos: «¿Terminar por hoy?»`);
  await p.click('#modal button[type=submit]');
  await p.waitForSelector('[data-listo="reabrir"]');
  ok(/Has terminado por hoy/.test(await vista(p)) && /No entran pedidos nuevos hasta mañana a las 6:00\./.test(await vista(p)), `${nombre}/${t} pedidos: «Has terminado por hoy»`);
  await p.screenshot({ path: `${OUT}/panel-pedidos-terminado-${nombre}-${t}.png`, fullPage: true });
  await p.click('[data-listo="reabrir"]');
  await p.waitForSelector('.listo-fila');
  ok(llamadas(estado, 'reopen_orders').length === 1, `${nombre}/${t} pedidos: «Volver a abrir»`);
  ok(errores.length === 0, `${nombre}/${t} pedidos: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

async function apagado(nav, nombre, t, vp) {
  let { ctx, p, estado, errores } = await contextoPanel(nav, vp, { enabled: false });
  await p.goto(`${BASE}/panel/#/pedidos`);
  await p.waitForSelector('[data-listo="activar"]');
  ok(/Te aviso cuando esté listo/.test(await vista(p)) && /Tú solo tocas «Listo»\./.test(await vista(p)), `${nombre}/${t} apagado: la explicación`);
  await p.screenshot({ path: `${OUT}/panel-pedidos-apagado-${nombre}-${t}.png`, fullPage: true });
  await p.click('[data-listo="activar"]');
  await p.waitForSelector('.listo-fila');
  ok(llamadas(estado, 'set_orders_enabled')[0]?.[1]?.p_enabled === true, `${nombre}/${t} apagado: «Activar el avisador» → set_orders_enabled(true)`);
  ok(errores.length === 0, `${nombre}/${t} apagado: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
  ({ ctx, p, estado, errores } = await contextoPanel(nav, vp, { rol: 'staff', enabled: false }));
  await p.goto(`${BASE}/panel/#/pedidos`);
  await p.waitForSelector('.vacio');
  ok(/El avisador de pedidos está apagado/.test(await vista(p)) && await p.locator('[data-listo="activar"]').count() === 0, `${nombre}/${t} empleado: apagado, sin «Activar»`);
  await ctx.close();
  ({ ctx, p, estado, errores } = await contextoPanel(nav, vp, { rol: 'staff' }));
  await p.goto(`${BASE}/panel/#/pedidos`);
  await p.waitForSelector('.listo-fila');
  ok(await p.locator('[data-listo="terminar"]').count() === 0 && await p.locator('[data-listo="codigo"]').count() === 0
    && await p.locator('button[data-listo-ya]').count() === 3, `${nombre}/${t} empleado: marca «Listo», sin terminar ni cambiar el código`);
  ok(errores.length === 0, `${nombre}/${t} empleado: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

async function resto(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contextoPanel(nav, vp);
  await p.goto(`${BASE}/panel/#/herramientas`);
  await p.waitForSelector('.fiel-card');
  let txt = await vista(p);
  ok(/Te aviso cuando esté listo/.test(txt) && /Para cafeterías y comida para llevar/.test(txt) && /Activado · 3 preparando/.test(txt), `${nombre}/${t} herramientas: la tarjeta`);
  ok(await p.locator('.fiel-card a[href="#/pedidos"]').count() === 1, `${nombre}/${t} herramientas: «Abrir» lleva a #/pedidos`);
  await p.goto(`${BASE}/panel/#/resumen`);
  await p.waitForSelector('#listoCaja .fila-inicio');
  ok(/Pedidos de hoy · 3 preparando/.test(await p.locator('#listoCaja').innerText()), `${nombre}/${t} resumen: «Pedidos de hoy · 3 preparando»`);
  await p.goto(`${BASE}/panel/#/validar`);
  await p.waitForSelector('#listoEntrada a[href="#/pedidos"]');
  ok(true, `${nombre}/${t} validar: el botón «Pedidos de hoy»`);
  await p.goto(`${BASE}/panel/#/informe`);
  await p.waitForSelector('#informeListo details.plegable');
  const d = p.locator('#informeListo details');
  ok(/Te aviso cuando esté listo/.test(await d.locator('summary').innerText()) && /Pedidos avisados: 41 hoy · 812 este mes/.test(await d.locator('summary').innerText()), `${nombre}/${t} cifras: plegable con su resumen`);
  await d.locator('summary').click();
  txt = await d.innerText();
  ok(/Espera media: 6,5 min hoy · 7,2 min este mes/.test(txt), `${nombre}/${t} cifras: espera media`);
  ok(errores.length === 0, `${nombre}/${t} resto del panel: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

async function contextoCuenta(nav, vp, { conSesion = true, locale = 'es-ES', lang = 'es' } = {}) {
  const ctx = await nav.newContext({ viewport: vp, locale, timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l, con]) => { try { if (con) localStorage.setItem(k, v); localStorage.setItem('klendar_lang', l); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion(), lang, conSesion]);
  const m = { status: null };
  const ticket = () => ({ id: 't1', number: 24, status: m.status, created_at: masMin(-3), ready_at: m.status === 'ready' ? masMin(0) : null,
    expires_at: m.status === 'ready' ? masMin(120) : null, ahead: 1, code: CODE, business: NEGOCIO });
  const estado = { llamadas: [], fav: false, m, rpc: {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: [],
    orders_info: (b) => (b.p_code === CODE
      ? { ok: true, business: NEGOCIO, state: 'available', team: false, me: m.status ? ticket() : null }
      : { ok: false, error: 'bad_code' }),
    order_join: () => { m.status = 'waiting'; return { ok: true, ...ticket() }; },
    order_leave: () => { m.status = 'left'; return { ok: true }; },
    my_orders: () => (m.status === 'waiting' || m.status === 'ready' ? [ticket()] : []),
    business_offers_page: [{ id: 'f1000000-0000-4000-8000-0000000115a1', title: 'Café + tostada 2,50 €', kind: 'flash_offer', images: [] }],
    toggle_favorite: () => { estado.fav = !estado.fav; return estado.fav; },
    my_redemptions: [], my_passes: [], my_stamp_rewards: [], my_queue_turns: [], my_spot_gifts: [], my_birthday_gifts: [],
  } };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

async function cuenta(nav, nombre, t, vp) {
  let { ctx, p, estado, errores } = await contextoCuenta(nav, vp);
  await p.goto(`${BASE}/app/#/listo/${CODE}`);
  await p.waitForSelector('#listo-pedir');
  let txt = await vista(p);
  ok(/Café Norte/.test(txt) && /¿Has pedido en el mostrador\? Te avisamos en el móvil cuando esté listo\./.test(txt), `${nombre}/${t} cuenta: el local y la frase`);
  ok(await p.locator('#listo-pedir.accent').count() === 1, `${nombre}/${t} cuenta: «Avísame cuando esté listo» en coral`);
  await p.screenshot({ path: `${OUT}/cuenta-listo-pedir-${nombre}-${t}.png`, fullPage: true });
  await p.click('#listo-pedir');
  await p.waitForSelector('#listo-salir');
  txt = await vista(p);
  ok(llamadas(estado, 'order_join').length === 1 && /Tu número/.test(txt) && /24/.test(txt) && /Preparando…/.test(txt), `${nombre}/${t} cuenta: «Tu número 24 · Preparando…»`);
  await p.waitForSelector('#listo-fav');
  txt = await vista(p);
  ok(/Mientras esperas/.test(txt) && /Añadir a favoritos/.test(txt) && /Café \+ tostada 2,50 €/.test(txt), `${nombre}/${t} cuenta: «Mientras esperas» con favoritos y lo de hoy`);
  ok(await p.locator('.listo-mientras .accent').count() === 0, `${nombre}/${t} cuenta: «Mientras esperas» sin coral`);
  await p.click('#listo-fav');
  await p.waitForFunction(() => /Quitar de favoritos/.test(document.querySelector('#listo-fav')?.innerText || ''));
  ok(llamadas(estado, 'toggle_favorite').length === 1, `${nombre}/${t} cuenta: «Añadir a favoritos» → toggle_favorite`);
  ok(await sinScroll(p), `${nombre}/${t} cuenta: sin desplazamiento horizontal`);
  await p.screenshot({ path: `${OUT}/cuenta-listo-preparando-${nombre}-${t}.png`, fullPage: true });
  // Lo marcan: en 10 s se ve, sin recargar.
  estado.m.status = 'ready';
  await p.waitForFunction(() => /¡Listo! Pasa a recogerlo/.test(document.querySelector('#view')?.innerText || ''), null, { timeout: 15000 });
  ok(/Di tu número en el mostrador\./.test(await vista(p)), `${nombre}/${t} cuenta: «¡Listo! Pasa a recogerlo» al momento`);
  await p.screenshot({ path: `${OUT}/cuenta-listo-listo-${nombre}-${t}.png`, fullPage: true });
  // «Tus códigos».
  await p.goto(`${BASE}/app/#/codigos`);
  await p.waitForSelector('a[href="#/listo/' + CODE + '"]');
  ok(/Tu pedido en Café Norte/.test(await vista(p)), `${nombre}/${t} cuenta: «Tu pedido en Café Norte» en «Tus códigos»`);
  // «Ya no lo espero».
  await p.goto(`${BASE}/app/#/listo/${CODE}`);
  await p.waitForSelector('#listo-salir');
  await p.click('#listo-salir');
  await p.waitForSelector('dialog[open]');
  ok(/¿Ya no lo esperas\?/.test(await p.locator('dialog[open]').innerText()), `${nombre}/${t} cuenta: «¿Ya no lo esperas?»`);
  await p.locator('dialog[open] button').filter({ hasText: 'Ya no lo espero' }).click();
  await p.waitForSelector('#listo-otro');
  ok(llamadas(estado, 'order_leave').length === 1 && /Ya no esperas este pedido/.test(await vista(p)), `${nombre}/${t} cuenta: «Ya no esperas este pedido» con «Avísame de otro pedido»`);
  // El cartel malo.
  await p.goto(`${BASE}/app/#/listo/XXXXXXXXXXXXXXXX`);
  await p.waitForFunction(() => /Este cartel ya no funciona/.test(document.querySelector('#view')?.innerText || ''));
  ok(true, `${nombre}/${t} cuenta: cartel malo`);
  ok(errores.length === 0, `${nombre}/${t} cuenta: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
  // Sin sesión.
  ({ ctx, p, estado, errores } = await contextoCuenta(nav, vp, { conSesion: false }));
  await p.goto(`${BASE}/app/#/listo/${CODE}`);
  await p.waitForSelector('#view a[href*="entrar"]');
  ok(/Entrar para que te avisemos/.test(await vista(p)), `${nombre}/${t} cuenta sin sesión: «Entrar para que te avisemos»`);
  await ctx.close();
  // En catalán.
  ({ ctx, p, estado, errores } = await contextoCuenta(nav, vp, { locale: 'ca-ES', lang: 'ca' }));
  await p.goto(`${BASE}/app/?lang=ca#/listo/${CODE}`);
  await p.waitForSelector('#listo-pedir');
  await p.waitForTimeout(800);
  ok(/Avisa’m quan estigui a punt/.test(await vista(p)), `${nombre}/${t} cuenta en catalán: «Avisa’m quan estigui a punt»`);
  await ctx.close();
}

// ── Lo público, con las Functions de verdad ────────────────────────────────
const PUB = { state: 'available' };
function supabasePublico() {
  return createServer((req, res) => {
    let datos = '';
    req.on('data', (c) => { datos += c; });
    req.on('end', () => {
      const p = new URL(req.url, 'http://x').pathname;
      let body = {};
      try { body = JSON.parse(datos || '{}'); } catch { /* */ }
      const json = (b) => { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(b)); };
      const fn = p.startsWith('/rest/v1/rpc/') ? p.slice('/rest/v1/rpc/'.length) : null;
      if (fn === 'orders_info') {
        return json(body.p_code === CODE ? { ok: true, business: NEGOCIO, state: PUB.state, team: false, me: null } : { ok: false, error: 'bad_code' });
      }
      return json([]);
    });
  });
}

async function publico(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  const URLP = `http://localhost:${PUB_PORT}`;
  PUB.state = 'available';
  let r = await p.goto(`${URLP}/listo/${CODE}?lang=es`, { waitUntil: 'load' });
  let txt = await p.locator('main').innerText();
  ok(r.status() === 200 && /Café Norte/.test(txt) && /Entrar para que te avisemos/.test(txt) && /Te daremos un número/.test(txt), `${nombre}/${t} público: el local y «Entrar para que te avisemos»`);
  ok((r.headers()['x-robots-tag'] || '').includes('noindex'), `${nombre}/${t} público: noindex`);
  ok(await p.locator(`a[href*="siguiente=listo%2F${CODE}"]`).count() === 1, `${nombre}/${t} público: entrar vuelve a #/listo/<código>`);
  ok(await sinScroll(p), `${nombre}/${t} público: sin desplazamiento horizontal`);
  await p.screenshot({ path: `${OUT}/publico-listo-${nombre}-${t}.png`, fullPage: true });
  PUB.state = 'paused';
  await p.goto(`${URLP}/listo/${CODE}?lang=es`);
  ok(/Ahora no se pueden pedir avisos aquí/.test(await p.locator('main').innerText()), `${nombre}/${t} público: en pausa`);
  PUB.state = 'off';
  await p.goto(`${URLP}/listo/${CODE}?lang=es`);
  ok(/Este local no avisa de pedidos ahora/.test(await p.locator('main').innerText()), `${nombre}/${t} público: apagado`);
  PUB.state = 'available';
  r = await p.goto(`${URLP}/listo/XXXXXXXXXXXXXXXX?lang=es`);
  ok(r.status() === 404 && /Este cartel ya no funciona/.test(await p.locator('main').innerText()), `${nombre}/${t} público: cartel malo (404)`);
  await p.goto(`${URLP}/en/ready/${CODE}`);
  txt = await p.locator('main').innerText();
  ok(/Ready alert/i.test(txt) && /Log in so we can tell you/.test(txt), `${nombre}/${t} público en inglés`);
  r = await p.goto(`${URLP}/cartel/listo/${CODE}`);
  txt = await p.locator('body').innerText();
  ok(r.status() === 200 && /Café Norte/.test(txt) && /Te aviso cuando esté listo/i.test(txt) && /¿Has pedido\? Escanea/.test(txt), `${nombre}/${t} cartel para imprimir`);
  await p.waitForSelector('.qr svg');
  if (t === 'escritorio') await p.screenshot({ path: `${OUT}/cartel-listo-${nombre}.png`, fullPage: true });
  ok(errores.length === 0, `${nombre}/${t} público: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

let servidor = null;
let falso = null;
if (!SOLO || /publico/.test(SOLO)) {
  falso = supabasePublico();
  await new Promise((r) => falso.listen(FALSO_PORT, r));
  servidor = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(PUB_PORT), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa' }, stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 2500));
}

const PRUEBAS = { pedidos, apagado, resto, cuenta, publico };
for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]].filter(([n]) => !process.env.NAV || n === process.env.NAV)) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 800 }]]) {
    for (const [k, f] of Object.entries(PRUEBAS)) {
      if (SOLO && !SOLO.split(',').includes(k)) continue;
      await f(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} ${k}: ${e.message.split('\n')[0]}`));
    }
  }
  await nav.close();
}
if (servidor) servidor.kill();
if (falso) falso.close();
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
