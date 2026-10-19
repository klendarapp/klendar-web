// Prueba de «Avísame si…» por palabras y del menú del día un día cerrado en
// la web local (tanda D, migraciones 20261232100000–01 de la app), con un
// Supabase de mentira: no toca dev.
//
//  1. Panel, «Menú del día»: si hoy el horario dice cerrado, «Hoy tu local
//     sale cerrado en Klendar. ¿Abres hoy?» con «Sí, abro hoy» (al horario;
//     con «Días cerrados», a #/cerrados) y «Seguir igualmente», que lo quita.
//     Sin `closed_today`, nada.
//  2. Tu cuenta, Ajustes → Notificaciones → Para ti: «Avísame si…» con la
//     zona, las palabras, «Añadir palabra» (`add_alert_word`), quitar
//     (`remove_alert_word`), una palabra corta no se manda, y el interruptor
//     (`notify_word_alerts`).
//  3. Tu cuenta, «Avísame si…» (#/alertas): la fila «Por palabras».
//  4. Tu cuenta, #/avisame-palabra?palabra=karaoke (desde Explorar, con la
//     marca): la añade sin preguntar y va a Ajustes → Notificaciones.
//  5. Explorar (las Functions de verdad): buscar «karaoke» enseña «Avísame si
//     hay algo de «karaoke»» (con resultados y sin ellos); sin sesión lleva a
//     Tu cuenta; con sesión la añade sin salir y pasa a «Te avisaremos de
//     «karaoke»». Con 2 letras, no sale.
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PORT=8791 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8791 node tools/avisame_check.mjs
// (lo público arranca su propio serve_dev en PUB_PORT, 8794, contra un
// Supabase de mentira en 8795)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8791';
const OUT = process.env.OUT || '.';
const SOLO = process.env.SOLO || '';
const PUB_PORT = Number(process.env.PUB_PORT || 8794);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8795);
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-00000000a5a2';
const BIZ = 'b1000000-0000-4000-8000-00000000a5a2';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'avisame.prueba@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const masHoras = (h) => new Date(Date.now() + h * 3600e3).toISOString();

const SUB = { plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: 'active', period_end: masHoras(480), payment_method: 'transfer',
  price_cents: 1990, active_offers: 0, max_active_offers: null, has_analytics: true, boosts_included: 0, boosts_used: 0,
  billing: { enabled: true, blocked: false, hold: null, block_soon: false } };

/** Las palabras de mentira, como `my_alert_words`. */
function palabrasFalsas() {
  const st = { words: ['sushi'] };
  return {
    st,
    my_alert_words: () => ({ words: st.words.map((w) => ({ word: w, created_at: '2026-10-17T10:00:00Z' })), max: 10, on: true,
      area: { how: 'nearby', radius_m: 1000, city: null } }),
    add_alert_word: (b) => {
      const w = String(b.p_word || '').trim().toLowerCase();
      if (w.replace(/[^a-z0-9]/g, '').length < 3) return { ok: false, error: 'too_short' };
      if (st.words.includes(w)) return { ok: true, already: true, word: w };
      st.words.push(w);
      return { ok: true, already: false, word: w };
    },
    remove_alert_word: (b) => { st.words = st.words.filter((w) => w !== b.p_word); return { ok: true, removed: true }; },
  };
}

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
    if (p.startsWith('/rest/v1/categories')) return json([{ id: 'c-rest', slug: 'restaurant', name: 'Restaurantes', category_group: 'food', position: 1 }]);
    if (p.startsWith('/rest/v1/businesses')) {
      return json([{ id: BIZ, name: 'Casa Prueba', time_zone: 'Europe/Madrid', category_id: 'c-rest', logo_url: null, cover_image_url: null, gallery: [],
        opening_hours: { 1: [['13:00', '16:00']] }, kitchen_hours: null, amenities: [], address: 'Calle Mayor 1', city: 'Madrid' }]);
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, vp, extra = {}) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
  const pal = palabrasFalsas();
  const estado = { llamadas: [], rpc: {}, pal };
  Object.assign(estado.rpc, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, push_devices: 1 },
    my_businesses: [{ id: BIZ, name: 'Casa Prueba', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
    business_is_organizer: false,
    my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
    my_subscription: SUB,
    business_stats: { redemptions_30d: 3 },
    my_business_offers: [],
    business_tools_overview: { ok: true, can_edit: true, team: { members: 1 }, daily_menu: { suggested: true, live_until: null, plan_days: 0 } },
    daily_menu_setup: {
      suggested: true, can_publish: true, blocked: false, kitchen: false, closed_today: 'hours',
      last: null, live: null, plan: null,
      until: { lunch: { until: masHoras(3), at_close: false }, dinner: { until: masHoras(8), at_close: false }, both: { until: masHoras(8), at_close: false } },
    },
    my_notification_preferences: { notify_favorites: true, notify_nearby: true, nearby_radius_m: 1000, nearby_categories: null, quiet_hours_start: null,
      quiet_hours_end: null, weekly_email: false, business_email: true, notify_word_alerts: true },
    update_notification_preferences: null,
    my_offer_alerts: [],
    my_alert_words: pal.my_alert_words,
    add_alert_word: pal.add_alert_word,
    remove_alert_word: pal.remove_alert_word,
    ...extra,
  });
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  return { ctx, p, estado, errores };
}
const llamada = (estado, fn) => estado.llamadas.filter(([f]) => f === fn).map(([, b]) => b);

async function panel(nav, nombre, t, vp) {
  // 1. Menú del día, hoy cerrado por el horario
  let { ctx, p, errores } = await contexto(nav, vp);
  await p.goto(`${BASE}/panel/#/menu-del-dia`);
  await p.waitForSelector('#publicar', { timeout: 15000 });
  let txt = await p.locator('#view').innerText();
  ok(/Hoy tu local sale cerrado en Klendar\. ¿Abres hoy\?/.test(txt), `${nombre}/${t} menú: «¿Abres hoy?» arriba`);
  ok(/la ficha dice «Cerrado»/.test(txt), `${nombre}/${t} menú: por qué (el horario)`);
  ok((await p.getAttribute('#mesaCerrado a.btn', 'href')) === '#/ficha/horario', `${nombre}/${t} menú: «Sí, abro hoy» lleva al horario`);
  await p.screenshot({ path: `${OUT}/panel-menu-cerrado-${nombre}-${t}.png`, fullPage: true });
  await p.click('#mesaSigue');
  ok(await p.locator('#mesaCerrado').isHidden(), `${nombre}/${t} menú: «Seguir igualmente» lo quita`);
  ok(errores.length === 0, `${nombre}/${t} menú: sin errores (${errores.join(' | ')})`);
  await ctx.close();

  // …en «Días cerrados»
  ({ ctx, p, errores } = await contexto(nav, vp, { daily_menu_setup: {
    suggested: true, can_publish: true, closed_today: 'closure', last: null, live: null, plan: null,
    until: { lunch: { until: masHoras(3), at_close: false } } } }));
  await p.goto(`${BASE}/panel/#/menu-del-dia`);
  await p.waitForSelector('#publicar', { timeout: 15000 });
  txt = await p.locator('#view').innerText();
  ok(/no se ve nada de tu local/.test(txt) && (await p.getAttribute('#mesaCerrado a.btn', 'href')) === '#/cerrados',
    `${nombre}/${t} menú: con «Días cerrados», «Sí, abro hoy» va a #/cerrados`);
  await ctx.close();

  // …abierto: nada
  ({ ctx, p, errores } = await contexto(nav, vp, { daily_menu_setup: { suggested: true, can_publish: true, closed_today: null, last: null, live: null, plan: null,
    until: { lunch: { until: masHoras(3), at_close: true } } } }));
  await p.goto(`${BASE}/panel/#/menu-del-dia`);
  await p.waitForSelector('#publicar', { timeout: 15000 });
  ok(await p.locator('#mesaCerrado').count() === 0, `${nombre}/${t} menú: abierto hoy, sin aviso`);
  await ctx.close();
}

async function cuenta(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp);
  // 2. Ajustes → Notificaciones
  await p.goto(`${BASE}/app/#/ajustes/notificaciones`);
  await p.waitForSelector('#palabras-mas .palabras', { timeout: 15000 });
  let txt = await p.locator('#palabras-mas').innerText();
  ok(/a 1 km encaje/.test(txt) && /sushi/.test(txt) && /1 de 10/.test(txt), `${nombre}/${t} ajustes: zona, «sushi» y «1 de 10»`);
  ok(await p.locator('input[name=palabras]').isChecked(), `${nombre}/${t} ajustes: «Avísame si…» encendido`);
  await p.fill('#palabra-nueva', 'dj');
  await p.click('#palabra-anade');
  await p.waitForTimeout(300);
  ok(llamada(estado, 'add_alert_word').length === 0, `${nombre}/${t} ajustes: 2 letras no se manda`);
  await p.fill('#palabra-nueva', 'Karaoke');
  await p.press('#palabra-nueva', 'Enter');
  await p.waitForFunction(() => /karaoke/.test(document.querySelector('#palabras-mas')?.innerText || ''), null, { timeout: 5000 }).catch(() => {});
  ok(llamada(estado, 'add_alert_word')[0]?.p_word === 'Karaoke', `${nombre}/${t} ajustes: «Añadir palabra» manda add_alert_word`);
  txt = await p.locator('#palabras-mas').innerText();
  ok(/karaoke/.test(txt) && /2 de 10/.test(txt), `${nombre}/${t} ajustes: la lista con «karaoke» (2 de 10)`);
  ok(llamada(estado, 'update_notification_preferences').length === 0, `${nombre}/${t} ajustes: añadir no guarda las preferencias`);
  await p.screenshot({ path: `${OUT}/cuenta-ajustes-palabras-${nombre}-${t}.png`, fullPage: true });
  await p.click('[data-quita="sushi"]');
  await p.waitForTimeout(500);
  ok(llamada(estado, 'remove_alert_word')[0]?.p_word === 'sushi' && !/sushi/.test(await p.locator('#palabras-mas').innerText()),
    `${nombre}/${t} ajustes: quitar «sushi»`);
  await p.locator('label:has(input[name=palabras])').click();
  await p.waitForTimeout(900);
  const pr = llamada(estado, 'update_notification_preferences').slice(-1)[0]?.p || {};
  ok(pr.notify_word_alerts === false && await p.locator('#palabras-mas').isHidden(), `${nombre}/${t} ajustes: apagar «Avísame si…» (${JSON.stringify(pr.notify_word_alerts)})`);

  // 3. #/alertas
  await p.goto(`${BASE}/app/#/alertas`);
  await p.waitForSelector('a[href="#/ajustes/notificaciones"]', { timeout: 15000 });
  ok(/Por palabras/.test(await p.locator('#view, main').first().innerText()) && /karaoke/.test(await p.locator('a[href="#/ajustes/notificaciones"]').innerText()),
    `${nombre}/${t} «Avísame si…»: la fila «Por palabras» con las palabras`);

  // 4. Desde Explorar, con la marca
  await p.evaluate(() => sessionStorage.setItem('klendar.intencion', JSON.stringify({ r: 'avisame-palabra?palabra=jazz', t: Date.now() })));
  await p.goto(`${BASE}/app/#/avisame-palabra?palabra=jazz`);
  await p.waitForFunction(() => location.hash === '#/ajustes/notificaciones', null, { timeout: 10000 }).catch(() => {});
  ok(llamada(estado, 'add_alert_word').some((b) => b.p_word === 'jazz') && /ajustes\/notificaciones/.test(p.url()),
    `${nombre}/${t} #/avisame-palabra: la añade y va a Ajustes → Notificaciones`);
  ok(errores.length === 0, `${nombre}/${t} cuenta: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── Explorar, con las Functions de verdad ──────────────────────────────────
function supabasePublico(estado) {
  return createServer((req, res) => {
    let datos = '';
    req.on('data', (c) => { datos += c; });
    req.on('end', () => {
      const p = new URL(req.url, 'http://x').pathname;
      let body = {};
      try { body = JSON.parse(datos || '{}'); } catch { /* */ }
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
      const json = (b) => { res.writeHead(200, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(b)); };
      if (p.startsWith('/auth/v1/user')) return json(USER);
      const fn = p.startsWith('/rest/v1/rpc/') ? p.slice('/rest/v1/rpc/'.length) : null;
      if (fn) estado.llamadas.push([fn, body]);
      if (fn && estado.pal[fn]) return json(estado.pal[fn](body));
      if (fn === 'public_explore') {
        return json(estado.conResultados ? { total: 1, items: [{ id: '0f000000-0000-4000-8000-000000000002', kind: 'future_event', title: 'Noche de karaoke',
          event_at: masHoras(30), business_id: BIZ, business_name: 'Bar Luna', images: [], price_cents: 0, currency: 'EUR' }] } : { total: 0, items: [] });
      }
      if (fn) return json(null);
      return json([]);
    });
  });
}

async function publico(nav, nombre, t, vp, estado) {
  const PUB = `http://localhost:${PUB_PORT}`;
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  if (process.env.DEBUG) { p.on('console', (m) => console.log('  consola:', m.text())); p.on('framenavigated', (f) => { if (f === p.mainFrame()) console.log('  nav:', f.url()); }); }
  // Sin sesión (y las palabras de mentira de cero en cada vuelta)
  estado.pal = palabrasFalsas();
  estado.conResultados = false;
  await p.goto(`${PUB}/explorar/?q=karaoke`);
  let caja = p.locator('.avisame-palabra');
  ok(await caja.count() === 1 && /Avísame si hay algo de «karaoke»/.test(await caja.innerText()), `${nombre}/${t} explorar sin resultados: «Avísame si hay algo de «karaoke»»`);
  ok((await caja.locator('a').getAttribute('href')) === '/app/#/avisame-palabra?palabra=karaoke', `${nombre}/${t} explorar: sin sesión, a Tu cuenta`);
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(ancho <= 0, `${nombre}/${t} explorar: sin desplazamiento horizontal`);
  await p.screenshot({ path: `${OUT}/explorar-avisame-vacio-${nombre}-${t}.png`, fullPage: true });
  await p.goto(`${PUB}/explorar/?q=dj`);
  ok(await p.locator('.avisame-palabra').count() === 0, `${nombre}/${t} explorar: con 2 letras no sale`);
  const en = await p.goto(`${PUB}/en/explore/?q=karaoke`);
  ok(en.status() === 200 && /Tell me when there’s something for “karaoke”/.test(await p.locator('.avisame-palabra').innerText()), `${nombre}/${t} explore: en inglés`);

  // Con sesión: se añade sin salir
  await ctx.addInitScript((v) => { try { localStorage.setItem('sb-localhost-auth-token', v); } catch { /* */ } }, sesion());
  estado.conResultados = true;
  await p.goto(`${PUB}/explorar/?q=karaoke`);
  caja = p.locator('.avisame-palabra');
  ok(await caja.count() === 1, `${nombre}/${t} explorar con resultados: el bloque sale también`);
  await p.waitForFunction(() => document.querySelector('.avisame-palabra a')?.getAttribute('data-directo') === '1', null, { timeout: 8000 }).catch(() => {});
  await caja.locator('a').click();
  await p.waitForFunction(() => document.querySelector('.avisame-palabra')?.classList.contains('on'), null, { timeout: 8000 }).catch(() => {});
  ok(estado.llamadas.some(([f, b]) => f === 'add_alert_word' && b.p_word === 'karaoke'), `${nombre}/${t} explorar: con sesión, add_alert_word sin salir`);
  ok(/Te avisaremos de «karaoke»/.test(await caja.innerText()) && /explorar/.test(p.url()), `${nombre}/${t} explorar: pasa a «Te avisaremos de «karaoke»»`);
  await p.screenshot({ path: `${OUT}/explorar-avisame-hecho-${nombre}-${t}.png`, fullPage: true });
  await p.goto(`${PUB}/explorar/?q=karaoke`);
  await p.waitForFunction(() => document.querySelector('.avisame-palabra')?.classList.contains('on'), null, { timeout: 8000 }).catch(() => {});
  ok(/Te avisaremos de «karaoke»/.test(await p.locator('.avisame-palabra').innerText())
    && /#\/ajustes\/notificaciones$/.test(await p.locator('.avisame-palabra a').getAttribute('href')),
  `${nombre}/${t} explorar: si ya la tienes, lo dice y lleva a tus palabras`);
  ok(errores.length === 0, `${nombre}/${t} explorar: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

let servidor = null;
let falso = null;
const estadoPub = { llamadas: [], conResultados: false, pal: palabrasFalsas() };
if (!SOLO || SOLO.includes('publico')) {
  falso = supabasePublico(estadoPub);
  await new Promise((r) => falso.listen(FALSO_PORT, r));
  servidor = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(PUB_PORT), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa' }, stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 1500));
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    if (!SOLO || SOLO.includes('panel')) await panel(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} panel: ${e.message}`));
    if (!SOLO || SOLO.includes('cuenta')) await cuenta(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} cuenta: ${e.message}`));
    if (!SOLO || SOLO.includes('publico')) await publico(nav, nombre, t, vp, estadoPub).catch((e) => ok(false, `${nombre}/${t} público: ${e.message}`));
  }
  await nav.close();
}
if (servidor) servidor.kill();
if (falso) falso.close();
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
