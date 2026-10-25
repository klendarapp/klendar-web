// Prueba de «sorteos apagados» (app_config.giveaways, migración 20261243100000
// de la app) en la web local, con Supabase de mentira (no toca dev):
//
//  1. Lo público (las Functions de verdad, contra dos Supabase falsos: uno
//     apagado y otro encendido en la web):
//     · apagado: /sorteos/, /en/giveaways/, /sorteo/<id> y sus bases dicen
//       «Los sorteos no están disponibles» con «Ir a Descubre» y noindex;
//       Explorar sin el acceso a «Sorteos»; el sitemap de negocios sin
//       sorteos;
//     · encendido: /sorteos/ es la lista y Explorar tiene el acceso.
//  2. «Tu cuenta»: apagado, #/sorteos y #/sorteo/<id> con el mismo vacío; la
//     bandeja pide sin los avisos de sorteos (`kind=neq.giveaway`) y los
//     ajustes de notificaciones no tienen «Sorteos»; encendido, sí.
//  3. Panel: apagado, #/sorteos dice que no están disponibles con «Volver al
//     resumen» y Fidelizar no tiene la tarjeta; encendido, sí.
//  4. Admin › Configuración › «Sorteos»: por qué están apagados, y encender
//     pide confirmación y guarda `{enabled, platforms}`.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800). Capturas en OUT.
//
//   PORT=8821 node tools/serve_dev.mjs &
//   BASE=http://localhost:8821 PW=<ruta a playwright> OUT=<carpeta> node tools/sorteos_apagados_check.mjs
// (lo público arranca dos serve_dev en 8822 y 8824, con sus Supabase falsos
// en 8823 y 8825)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8821';
const OUT = process.env.OUT || '.';
const SOLO = process.env.SOLO || '';
const PUERTOS = { off: [8822, 8823], on: [8824, 8825] };
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-00000005a0a1';
const BIZ = 'b1000000-0000-4000-8000-00000005a0a1';
const GID = 'd1000000-0000-4000-8000-00000005a0a1';
const ON = { enabled: true, platforms: ['web', 'android'] };
const OFF = { enabled: false, platforms: ['web', 'android'] };
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'sorteos.apagados@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const SUB = { plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: 'active', period_end: '2027-06-01T00:00:00Z', payment_method: 'transfer',
  price_cents: 1990, active_offers: 0, max_active_offers: null, has_analytics: true, boosts_included: 0, boosts_used: 0,
  billing: { enabled: true, blocked: false, hold: null, block_soon: false } };
const sinScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0);
const vista = (p) => p.locator('#view').innerText();

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
    if (p.startsWith('/rest/v1/app_config')) return json(estado.giveaways ? [{ value: estado.giveaways }] : []);
    if (p.startsWith('/rest/v1/notifications')) {
      estado.avisos.push(url.search);
      return json([]);
    }
    if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, name: 'Bar Sonda', time_zone: 'Europe/Madrid', amenities: [], address: 'Calle Mayor 1', city: 'Madrid' }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, vp, giveaways, rpc) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
  const estado = { llamadas: [], avisos: [], giveaways, rpc: {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    ...rpc,
  } };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  // La lista pública de «En los que participas» (adonde lleva #/sorteos
  // encendido): no hace falta pintarla, solo ver que se llega.
  await ctx.route(/\/sorteos\/\?mios=1/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>lista</p>' }));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

// ── 2. «Tu cuenta» ─────────────────────────────────────────────────────────
const CUENTA = {
  my_businesses: [],
  my_notification_preferences: { notify_favorites: true, notify_giveaways: true },
  my_alert_words: [],
  giveaway_detail: { id: GID, prize: 'Cena para dos', status: 'active', ends_at: '2027-01-01T20:00:00Z', business: { id: BIZ, name: 'Bar Sonda' }, me: { adult: true } },
};
async function cuenta(nav, nombre, t, vp) {
  let { ctx, p, estado, errores } = await contexto(nav, vp, OFF, CUENTA);
  await p.goto(`${BASE}/app/#/sorteos`);
  await p.waitForFunction(() => /Los sorteos no están disponibles/.test(document.querySelector('#view')?.innerText || ''));
  let txt = await vista(p);
  ok(/Por ahora no hay sorteos en Klendar/.test(txt) && await p.locator('#view a[href="/descubre/"]').count() === 1, `${nombre}/${t} cuenta apagado: #/sorteos, vacío con «Ir a Descubre»`);
  ok(await sinScroll(p), `${nombre}/${t} cuenta apagado: sin desplazamiento horizontal`);
  await p.screenshot({ path: `${OUT}/cuenta-sorteos-apagados-${nombre}-${t}.png`, fullPage: true });
  await p.goto(`${BASE}/app/#/sorteo/${GID}`);
  await p.waitForFunction(() => /Los sorteos no están disponibles/.test(document.querySelector('#view')?.innerText || ''));
  ok(!estado.llamadas.some(([f]) => f === 'giveaway_enter' || f === 'giveaway_detail'), `${nombre}/${t} cuenta apagado: #/sorteo/<id> no pide el sorteo ni participa`);
  await p.goto(`${BASE}/app/#/notificaciones`);
  await p.waitForTimeout(1200);
  ok(estado.avisos.length > 0 && estado.avisos.every((q) => /kind=neq\.giveaway/.test(q)), `${nombre}/${t} cuenta apagado: la bandeja sin avisos de sorteos (${estado.avisos.join(' ; ')})`);
  await p.goto(`${BASE}/app/#/ajustes/notificaciones`);
  await p.waitForFunction(() => /Grupos y empresas/.test(document.querySelector('#view')?.innerText || ''));
  txt = await vista(p);
  ok(!/Resultados de los sorteos/.test(txt), `${nombre}/${t} cuenta apagado: ajustes sin «Sorteos»`);
  ok(errores.length === 0, `${nombre}/${t} cuenta apagado: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();

  ({ ctx, p, estado, errores } = await contexto(nav, vp, ON, CUENTA));
  await p.goto(`${BASE}/app/#/ajustes/notificaciones`);
  await p.waitForFunction(() => /Grupos y empresas/.test(document.querySelector('#view')?.innerText || ''));
  ok(/Resultados de los sorteos/.test(await vista(p)), `${nombre}/${t} cuenta encendido: ajustes con «Sorteos»`);
  await p.goto(`${BASE}/app/#/notificaciones`);
  await p.waitForTimeout(1200);
  ok(estado.avisos.length > 0 && !estado.avisos.some((q) => /neq\.giveaway/.test(q)), `${nombre}/${t} cuenta encendido: la bandeja entera`);
  await p.goto(`${BASE}/app/#/sorteos`);
  await p.waitForURL(/\/sorteos\/\?mios=1/);
  ok(true, `${nombre}/${t} cuenta encendido: #/sorteos lleva a «En los que participas»`);
  ok(errores.length === 0, `${nombre}/${t} cuenta encendido: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

// ── 3. Panel ───────────────────────────────────────────────────────────────
const PANEL = {
  my_businesses: [{ id: BIZ, name: 'Bar Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
  business_is_organizer: false,
  my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
  my_subscription: SUB,
  business_stats: { redemptions_30d: 3 },
  my_business_offers: [],
  business_loyalty: { ok: true, can_edit: true, coupon: {}, thanks: {} },
  business_tools_overview: { ok: true, can_edit: true, team: { members: 1 }, series: { rules_active: 0 }, giveaways: { active: 1 } },
  business_private: { tax_id: '' },
  business_report: { ok: true, totals: {}, daily: [], offers: [], by_hour: [], redemptions: [], loyalty: {} },
  business_audience: null,
  business_link_taps_report: [],
  table_qr_stats: { ok: true, has: false },
  business_recent_validations: [],
  business_giveaways: { can_manage: true, tax_id: 'B12345674', giveaways: [] },
};
async function panel(nav, nombre, t, vp) {
  let { ctx, p, estado, errores } = await contexto(nav, vp, OFF, PANEL);
  await p.goto(`${BASE}/panel/#/sorteos`);
  await p.waitForFunction(() => /Los sorteos no están disponibles/.test(document.querySelector('#view')?.innerText || ''));
  ok(/Lo demás de Fidelizar funciona como siempre/.test(await vista(p)) && await p.locator('#view a[href="#/resumen"]').count() === 1, `${nombre}/${t} panel apagado: #/sorteos con «Volver al resumen»`);
  ok(!estado.llamadas.some(([f]) => f === 'business_giveaways'), `${nombre}/${t} panel apagado: no pide los sorteos`);
  ok(await sinScroll(p), `${nombre}/${t} panel apagado: sin desplazamiento horizontal`);
  await p.screenshot({ path: `${OUT}/panel-sorteos-apagados-${nombre}-${t}.png`, fullPage: true });
  await p.goto(`${BASE}/panel/#/sorteos/nuevo`);
  await p.waitForFunction(() => /Los sorteos no están disponibles/.test(document.querySelector('#view')?.innerText || ''));
  ok(await p.locator('#view form').count() === 0, `${nombre}/${t} panel apagado: #/sorteos/nuevo sin formulario`);
  await p.goto(`${BASE}/panel/#/fidelizar`);
  await p.waitForSelector('.fiel-lista');
  ok(await p.locator('a[href="#/sorteos"]').count() === 0 && !/Sorteos/.test(await vista(p)), `${nombre}/${t} panel apagado: Fidelizar sin «Sorteos»`);
  await p.screenshot({ path: `${OUT}/panel-fidelizar-apagados-${nombre}-${t}.png`, fullPage: true });
  ok(errores.length === 0, `${nombre}/${t} panel apagado: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();

  ({ ctx, p, estado, errores } = await contexto(nav, vp, ON, PANEL));
  await p.goto(`${BASE}/panel/#/fidelizar`);
  await p.waitForSelector('.fiel-lista a[href="#/sorteos"]');
  ok(/1 sorteo abierto/.test(await vista(p)), `${nombre}/${t} panel encendido: Fidelizar con «Sorteos · 1 sorteo abierto»`);
  await p.goto(`${BASE}/panel/#/sorteos`);
  await p.waitForFunction(() => /Crear un sorteo/.test(document.querySelector('#view')?.innerText || ''));
  ok(estado.llamadas.some(([f]) => f === 'business_giveaways'), `${nombre}/${t} panel encendido: #/sorteos, la lista de siempre`);
  ok(errores.length === 0, `${nombre}/${t} panel encendido: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

// ── 4. Admin: el interruptor en Configuración ──────────────────────────────
async function admin(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-admin-auth-token`, sesion()]);
  const estado = { llamadas: [], avisos: [], giveaways: null, rpc: {
    is_admin: true,
    admin_mfa_status: { required: false, enrolled: true },
    admin_kpis: {},
    admin_config: { giveaways: { value: OFF, updated_at: '2026-10-22T10:00:00Z' }, maintenance: { value: { enabled: false } } },
    admin_rate_limits: [],
    storage_cleanup_count: null,
  } };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  await p.goto(`${BASE}/admin/#/configuracion`);
  await p.waitForSelector('#gwf');
  const card = p.locator('.card', { has: p.locator('#gwf') });
  const txt = await card.innerText();
  ok(/Sorteos/.test(txt) && /Apagados desde el lanzamiento/.test(txt) && /norma 5\.3 de Apple/.test(txt), `${nombre}/${t} admin: la tarjeta «Sorteos» explica por qué están apagados`);
  ok(!(await p.locator('#gwf [name=enabled]').isChecked()) && await p.locator('#gwf [name=web]').isChecked()
    && await p.locator('#gwf [name=android]').isChecked() && !(await p.locator('#gwf [name=ios]').isChecked()), `${nombre}/${t} admin: apagado, con web y Android marcados para cuando se encienda`);
  await card.screenshot({ path: `${OUT}/admin-sorteos-interruptor-${nombre}-${t}.png` });
  await p.check('#gwf [name=enabled]');
  await p.click('#gwf button');
  await p.waitForSelector('#modal[open]');
  ok(/Encender los sorteos/.test(await p.locator('#modal').innerText()), `${nombre}/${t} admin: encender pide confirmación`);
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(600);
  const l = estado.llamadas.find(([f]) => f === 'admin_set_config');
  ok(l && l[1].p_key === 'giveaways' && l[1].p_value.enabled === true && JSON.stringify(l[1].p_value.platforms) === '["web","android"]',
    `${nombre}/${t} admin: guarda {enabled: true, platforms: [web, android]} (${JSON.stringify(l && l[1])})`);
  ok(errores.length === 0, `${nombre}/${t} admin: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

// ── 1. Lo público, con las Functions de verdad ─────────────────────────────
function supabasePublico(valor) {
  return createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      const p = new URL(req.url, 'http://x').pathname;
      const json = (b) => { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(b)); };
      if (p.startsWith('/rest/v1/app_config')) return json(valor ? [{ value: valor }] : []);
      if (p === '/rest/v1/rpc/giveaway_detail') return json(null);
      if (p === '/rest/v1/rpc/giveaway_bases') return json(null);
      return json([]);
    });
  });
}

async function publico(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  const OFFP = `http://localhost:${PUERTOS.off[0]}`;
  const ONP = `http://localhost:${PUERTOS.on[0]}`;
  for (const [ruta, texto, ir] of [
    ['/sorteos/', 'Los sorteos no están disponibles', '/descubre/'],
    ['/sorteos/?mios=1', 'Los sorteos no están disponibles', '/descubre/'],
    [`/sorteo/${GID}`, 'Los sorteos no están disponibles', '/descubre/'],
    [`/sorteo/${GID}/bases`, 'Los sorteos no están disponibles', '/descubre/'],
    ['/en/giveaways/', "Giveaways aren't available", '/en/discover/'],
    [`/en/giveaway/${GID}`, "Giveaways aren't available", '/en/discover/'],
  ]) {
    const r = await p.goto(`${OFFP}${ruta}`, { waitUntil: 'load' });
    const main = await p.locator('main').innerText();
    const html = await p.content();
    ok(r.status() === 200 && main.includes(texto) && await p.locator(`main a[href="${ir}"]`).count() === 1,
      `${nombre}/${t} público apagado: ${ruta} → «${texto}» con salida a ${ir}`);
    ok(/name="robots" content="noindex"/.test(html) || (r.headers()['x-robots-tag'] || '').includes('noindex'), `${nombre}/${t} público apagado: ${ruta} con noindex`);
  }
  ok(await sinScroll(p), `${nombre}/${t} público apagado: sin desplazamiento horizontal`);
  await p.goto(`${OFFP}/sorteos/`);
  await p.screenshot({ path: `${OUT}/publico-sorteos-apagados-${nombre}-${t}.png`, fullPage: true });
  await p.goto(`${OFFP}/explorar/`, { waitUntil: 'load' });
  ok(await p.locator('a[href^="/sorteos/"]').count() === 0 && !/"sorteos":/.test(await p.content()), `${nombre}/${t} público apagado: Explorar sin «Sorteos»`);
  const mapa = await (await p.request.get(`${OFFP}/sitemap-negocios.xml`)).text();
  ok(!/\/sorteo\//.test(mapa), `${nombre}/${t} público apagado: el sitemap de negocios sin sorteos`);

  let r = await p.goto(`${ONP}/sorteos/`, { waitUntil: 'load' });
  ok(r.status() === 200 && !/Los sorteos no están disponibles/.test(await p.locator('main').innerText()) && /Sorteos/.test(await p.locator('h1').innerText()), `${nombre}/${t} público encendido: /sorteos/ es la lista`);
  await p.goto(`${ONP}/explorar/`, { waitUntil: 'load' });
  ok(await p.locator('a[href^="/sorteos/"]').count() >= 1, `${nombre}/${t} público encendido: Explorar con «Sorteos»`);
  r = await p.goto(`${ONP}/sorteo/${GID}`, { waitUntil: 'load' });
  ok(r.status() === 404 && /Este sorteo no está/.test(await p.locator('main').innerText()), `${nombre}/${t} público encendido: un sorteo que no está, como siempre (404)`);
  ok(errores.length === 0, `${nombre}/${t} público: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

const servidores = [];
if (!SOLO || /publico/.test(SOLO)) {
  for (const [k, valor] of [['off', OFF], ['on', ON]]) {
    const [pub, fal] = PUERTOS[k];
    const falso = supabasePublico(valor);
    await new Promise((r) => falso.listen(fal, r));
    const srv = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
      env: { ...process.env, PORT: String(pub), SUPABASE_URL: `http://localhost:${fal}`, SUPABASE_KEY: 'falsa' }, stdio: 'ignore',
    });
    servidores.push(falso, srv);
  }
  await new Promise((r) => setTimeout(r, 2500));
}

const PRUEBAS = { publico, cuenta, panel, admin };
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
for (const s of servidores) (s.kill ? s.kill() : s.close());
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
