// Prueba de «Qué pedir aquí», los momentos del día y los festivos en la web
// local (tanda D), con un Supabase de mentira: no toca dev.
//
//  1. Panel, «Tu ficha»: la fila «Qué pedir aquí» con lo puesto; su pantalla
//     (`#/ficha/que-pedir`): escribir, «Elegir de la carta» y guardar con
//     `set_business_highlights`; un nombre de una letra no se manda.
//  2. Panel, «Cómo es tu local»: los momentos del día y
//     `set_business_moments` al guardar.
//  3. Panel, «Días cerrados»: «Días con otro horario» (lista y
//     `save_business_day_hours`).
//  4. Panel, resumen: «¿Abres el …?» con «Horario normal», «Otro horario» y
//     «Cerrado» (`answer_holiday`); `#/festivo/<día>`.
//  5. La ficha pública (`/b/`, las Functions de verdad): «Qué pedir aquí»,
//     los momentos en «El sitio», «Abre el festivo del …» y «Abierto» con un
//     día con otro horario aunque la semana diga cerrado.
//  6. Explorar: «Momento del día» en «El sitio»: `?momento=ahora` manda
//     `moment_now`, `?momento=vermut` manda `moment_vermouth`; el chip con
//     × y la opción marcada en la hoja.
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PORT=8796 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8796 node tools/pedir_check.mjs
// (lo público arranca su propio serve_dev en PUB_PORT, 8794, contra un
// Supabase de mentira en 8795)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8796';
const OUT = process.env.OUT || '.';
const SOLO = process.env.SOLO || '';
const PUB_PORT = Number(process.env.PUB_PORT || 8794);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8795);
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-00000000b0a1';
const BIZ = 'b1000000-0000-4000-8000-00000000b0a1';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'pedir.prueba@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const masHoras = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const hoyMadrid = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const masDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const HORARIO = { 1: [['13:00', '16:00']], 2: [['13:00', '16:00']], 3: [['13:00', '16:00']], 4: [['13:00', '16:00']], 5: [['13:00', '16:00']], 6: [], 7: [] };
const COSAS = [
  { id: 'h1000000-0000-4000-8000-000000000001', title: 'Croquetas de jamón', note: 'Las de la abuela', image_url: null },
  { id: 'h1000000-0000-4000-8000-000000000002', title: 'Tarta de queso', note: null, image_url: null },
];
const CARTA = [{ id: 's1', name: 'Para picar', items: [{ id: 'a1000000-0000-4000-8000-000000000001', name: 'Bravas', description: 'Con alioli', price_cents: 600, allergens: [] }] }];

const SUB = { plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: 'active', period_end: masHoras(480), payment_method: 'transfer',
  price_cents: 1990, active_offers: 0, max_active_offers: null, has_analytics: true, boosts_included: 0, boosts_used: 0,
  billing: { enabled: true, blocked: false, hold: null, block_soon: false } };

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
    if (p.startsWith('/storage/v1/')) return json({ Key: 'x' });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      estado.llamadas.push([fn, body]);
      const r = estado.rpc[fn];
      if (r !== undefined) return json(typeof r === 'function' ? r(body) : r);
      return json(null);
    }
    if (p.startsWith('/rest/v1/categories')) return json([{ id: 'c-bar', slug: 'bars', name: 'Bares', category_group: 'food', position: 1 }]);
    if (p.startsWith('/rest/v1/businesses')) {
      return json([{ id: BIZ, name: 'Casa Prueba', time_zone: 'Europe/Madrid', category_id: 'c-bar', logo_url: null, cover_image_url: null, gallery: [],
        opening_hours: HORARIO, kitchen_hours: null, amenities: ['terrace'], moments: ['vermouth'], address: 'Calle Mayor 1', city: 'Madrid',
        price_level: 2, crowd_enabled: false, adults_only: false, social_links: {}, description: 'Bar de barrio' }]);
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contextoPanel(nav, vp) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
  const estado = { llamadas: [], rpc: {} };
  const hoy = hoyMadrid();
  Object.assign(estado.rpc, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: [{ id: BIZ, name: 'Casa Prueba', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
    business_is_organizer: false,
    my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
    my_subscription: SUB,
    business_stats: { redemptions_30d: 3 },
    my_business_offers: [],
    business_loyalty: { ok: true },
    business_tools_overview: { ok: true, can_edit: true, team: { members: 1 }, series: { rules_active: 0 } },
    business_private: { tax_id: 'B12345678' },
    business_menu: CARTA,
    business_links: { links: [], menu_files: [] },
    business_ficha_info: { highlights: COSAS, moments: ['vermouth'], special_days: [], holiday: null },
    set_business_highlights: (b) => ({ ok: true, review: false, items: b.p_items }),
    set_business_amenities: (b) => b.p_amenities,
    set_business_place_extras: null,
    set_business_moments: (b) => b.p_moments,
    business_closures: [],
    business_special_days: [{ id: 'd1', day: masDias(hoy, 9), hours: [['10:00', '14:00']], holiday: 'Nuestra Señora de la Almudena' }],
    save_business_day_hours: { ok: true, id: 'd2' },
    delete_business_day_hours: { ok: true },
    business_holiday_questions: [{ day: masDias(hoy, 3), name: 'Fiesta de prueba', days_left: 3, usual_hours: [['13:00', '16:00']] }],
    answer_holiday: { ok: true, state: { state: 'closed', hours: [] } },
  });
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  return { ctx, p, estado, errores };
}
const vista = (p) => p.locator('#view').innerText();
const llamada = (estado, fn) => estado.llamadas.filter(([f]) => f === fn).map(([, b]) => b);

async function panel(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contextoPanel(nav, vp);
  const hoy = hoyMadrid();
  // 1. Tu ficha
  await p.goto(`${BASE}/panel/#/ficha`);
  await p.waitForSelector('.indice', { timeout: 15000 });
  let txt = await vista(p);
  if (process.env.DEPURA) console.log(txt.slice(0, 1500));
  ok(/Qué pedir aquí/.test(txt) && /Croquetas de jamón · Tarta de queso/.test(txt), `${nombre}/${t} ficha: fila «Qué pedir aquí» con lo puesto`);
  ok(/Vermut/.test(txt), `${nombre}/${t} ficha: «Cómo es tu local» dice el momento`);
  await p.goto(`${BASE}/panel/#/ficha/que-pedir`);
  await p.waitForSelector('#qp', { timeout: 15000 });
  ok(await p.locator('[data-i]').count() === 2, `${nombre}/${t} qué pedir: las dos cosas guardadas`);
  await p.screenshot({ path: `${OUT}/panel-que-pedir-${nombre}-${t}.png`, fullPage: true });
  await p.click('[data-otra]');
  await p.locator('[data-i="2"] [name=title]').fill('x');
  await p.click('#qp button[type=submit]');
  await p.waitForTimeout(300);
  ok(llamada(estado, 'set_business_highlights').length === 0 && /de 2 a 60/.test(await p.locator('#qpMsg').innerText()), `${nombre}/${t} qué pedir: un nombre de 1 letra no se manda`);
  await p.click('[data-carta="2"]');
  await p.waitForSelector('#modal[open] select');
  await p.click('#modal[open] button[type=submit]');
  await p.waitForTimeout(200);
  ok(await p.locator('[data-i="2"] [name=title]').inputValue() === 'Bravas', `${nombre}/${t} qué pedir: «Elegir de la carta» rellena el nombre`);
  await p.click('#qp button[type=submit]');
  await p.waitForTimeout(500);
  const g = llamada(estado, 'set_business_highlights').slice(-1)[0] || {};
  ok(Array.isArray(g.p_items) && g.p_items.length === 3 && g.p_items[2].title === 'Bravas' && g.p_items[2].note === 'Con alioli'
    && g.p_items[2].menu_item_id === CARTA[0].items[0].id, `${nombre}/${t} qué pedir: guarda las tres (${JSON.stringify(g.p_items)})`);
  // 2. Cómo es tu local
  await p.goto(`${BASE}/panel/#/ficha/local`);
  await p.waitForSelector('[name=momento]', { timeout: 15000 });
  ok(await p.locator('[name=momento][value=vermouth]').isChecked(), `${nombre}/${t} local: «Vermut» marcado`);
  await p.locator('[name=momento][value=drinks]').check({ force: true });
  await p.screenshot({ path: `${OUT}/panel-momentos-${nombre}-${t}.png`, fullPage: true });
  await p.click('#parte button[type=submit]');
  await p.waitForTimeout(600);
  const m = llamada(estado, 'set_business_moments').slice(-1)[0] || {};
  ok(JSON.stringify(m.p_moments) === '["vermouth","drinks"]', `${nombre}/${t} local: guarda los momentos (${JSON.stringify(m)})`);
  // 3. Días cerrados
  await p.goto(`${BASE}/panel/#/cerrados`);
  await p.waitForSelector('#fOtro', { timeout: 15000 });
  txt = await vista(p);
  ok(/Días con otro horario/.test(txt) && /10:00–14:00 · Nuestra Señora de la Almudena/.test(txt), `${nombre}/${t} días cerrados: el día con otro horario`);
  await p.fill('#fOtro [name=day]', masDias(hoy, 20));
  await p.fill('#fOtro [name=from]', '11:00');
  await p.fill('#fOtro [name=to]', '15:00');
  await p.screenshot({ path: `${OUT}/panel-dias-otro-horario-${nombre}-${t}.png`, fullPage: true });
  await p.click('#fOtro button[type=submit]');
  await p.waitForTimeout(500);
  const d = llamada(estado, 'save_business_day_hours').slice(-1)[0] || {};
  ok(d.p_day === masDias(hoy, 20) && JSON.stringify(d.p_hours) === '[["11:00","15:00"]]', `${nombre}/${t} días cerrados: guarda el día con otro horario (${JSON.stringify(d)})`);
  // 4. Resumen: el festivo
  await p.goto(`${BASE}/panel/#/resumen`);
  await p.waitForSelector('.ped-festivo', { timeout: 15000 });
  txt = await p.locator('.ped-festivo').innerText();
  ok(/¿Abres el /.test(txt) && /Fiesta de prueba · Faltan 3 días/.test(txt) && /Horario normal \(13:00–16:00\)/.test(txt), `${nombre}/${t} resumen: «¿Abres el …?»`);
  await p.screenshot({ path: `${OUT}/panel-festivo-${nombre}-${t}.png`, fullPage: true });
  await p.click('.ped-festivo [data-r=other]');
  ok(await p.locator('.ped-otro').isVisible(), `${nombre}/${t} resumen: «Otro horario» pide las horas`);
  await p.click('.ped-festivo [data-r=closed]');
  await p.waitForTimeout(500);
  const a = llamada(estado, 'answer_holiday').slice(-1)[0] || {};
  ok(a.p_answer === 'closed' && a.p_day === masDias(hoy, 3), `${nombre}/${t} resumen: «Cerrado» contesta (${JSON.stringify(a)})`);
  await p.goto(`${BASE}/panel/#/festivo/${masDias(hoy, 3)}`);
  await p.waitForSelector('.ped-festivo', { timeout: 15000 });
  ok(true, `${nombre}/${t} #/festivo: la pregunta del aviso`);
  await p.goto(`${BASE}/panel/#/festivo/${masDias(hoy, 30)}`);
  await p.waitForSelector('.vacio', { timeout: 15000 });
  ok(/Ya está contestado/.test(await vista(p)), `${nombre}/${t} #/festivo: ya contestado`);
  ok(errores.length === 0, `${nombre}/${t} panel: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

// ── Lo público, con las Functions de verdad ────────────────────────────────
function supabasePublico(estado) {
  return createServer((req, res) => {
    let datos = '';
    req.on('data', (c) => { datos += c; });
    req.on('end', () => {
      const p = new URL(req.url, 'http://x').pathname;
      let body = {};
      try { body = JSON.parse(datos || '{}'); } catch { /* */ }
      // Lo piden también los scripts de la página (otro origen): CORS.
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
      const json = (b) => { res.writeHead(200, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(b)); };
      const fn = p.startsWith('/rest/v1/rpc/') ? p.slice('/rest/v1/rpc/'.length) : null;
      if (fn) estado.llamadas.push([fn, body]);
      const hoy = hoyMadrid();
      if (fn === 'resolve_business_slug') return json([{ id: BIZ, slug: 'casa-prueba-madrid' }]);
      if (fn === 'business_profile') {
        return json([{ id: BIZ, name: 'Casa Prueba', description: 'Bar de barrio', city: 'Madrid', address: 'Calle Mayor 1', lat: 40.41, lng: -3.7,
          time_zone: 'Europe/Madrid', is_verified: true, member_since: '2026-01-01T00:00:00Z', social: {},
          // Cerrado toda la semana… salvo hoy, que abre con otro horario.
          opening_hours: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [['03:00', '03:05']] } }]);
      }
      if (fn === 'business_ficha_info') {
        return json({ highlights: COSAS, moments: ['vermouth', 'tardeo'],
          special_days: [{ id: 'd1', day: hoy, hours: [['00:00', '23:59']], holiday: 'Fiesta de prueba' }],
          holiday: { day: masDias(hoy, 1), name: 'Fiesta de prueba', state: 'special', hours: [['10:00', '14:00']] } });
      }
      if (fn === 'public_explore') return json({ items: [], total: 0 });
      if (fn) return json(null);
      if (p.startsWith('/rest/v1/businesses')) return json([{ amenities: ['terrace'], price_level: 2, crowd_enabled: false, entity_kind: null, kitchen_hours: null }]);
      return json([]);
    });
  });
}

async function publico(nav, nombre, t, vp, estado) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  const PUB = `http://localhost:${PUB_PORT}`;
  // 5. La ficha
  const r = await p.goto(`${PUB}/b/casa-prueba-madrid`, { waitUntil: 'load' });
  ok(r.status() === 200, `${nombre}/${t} /b/: 200${r.status() === 200 ? '' : ` (${r.status()})`}`);
  await p.waitForTimeout(400);
  // El festivo confirmado va dentro de la línea de estado (2026-10-22).
  await p.locator('details.estado-neg > summary').click().catch(() => {});
  const cuerpo = await p.locator('body').innerText();
  ok(/Qué pedir aquí/.test(cuerpo) && /Croquetas de jamón/.test(cuerpo) && /Las de la abuela/.test(cuerpo) && /Tarta de queso/.test(cuerpo), `${nombre}/${t} /b/: «Qué pedir aquí»`);
  ok(/Vermut · Tardeo/.test(cuerpo), `${nombre}/${t} /b/: los momentos en «El sitio»`);
  ok(/Abre el festivo del .+ \(10:00–14:00\)/.test(cuerpo), `${nombre}/${t} /b/: «Abre el festivo del … (10:00–14:00)»`);
  const estadoHoy = await p.locator('.estado-hoy').innerText();
  ok(/Abierto|Cierra pronto/.test(estadoHoy), `${nombre}/${t} /b/: «Abierto» por el día con otro horario (${estadoHoy.replace(/\s+/g, ' ')})`);
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(ancho <= 0, `${nombre}/${t} /b/: sin desplazamiento horizontal`);
  await p.screenshot({ path: `${OUT}/web-ficha-que-pedir-${nombre}-${t}.png`, fullPage: true });
  const en = await p.goto(`${PUB}/en/b/casa-prueba-madrid`);
  await p.locator('details.estado-neg > summary').click().catch(() => {});
  const ten = await p.locator('body').innerText();
  ok(en.status() === 200 && /What to order here/.test(ten) && /Vermouth · Afternoon drinks/.test(ten) && /Open on the .+ holiday/.test(ten), `${nombre}/${t} /en/b/: en inglés`);
  // 6. Explorar
  estado.llamadas.length = 0;
  await p.goto(`${PUB}/explorar/?momento=ahora`);
  let f = estado.llamadas.filter(([fn]) => fn === 'public_explore').map(([, b]) => b)[0] || {};
  ok((f.p_filters?.traits || []).includes('moment_now'), `${nombre}/${t} explorar: «Para ahora» manda moment_now (${JSON.stringify(f.p_filters?.traits)})`);
  ok(await p.locator('.chip-quitar', { hasText: 'Para ahora' }).count() === 1, `${nombre}/${t} explorar: chip «Para ahora» con ×`);
  ok(await p.locator('input[type=radio][name=momento][value=ahora]').isChecked(), `${nombre}/${t} explorar: «Para ahora» marcado en la hoja`);
  await p.screenshot({ path: `${OUT}/web-explorar-para-ahora-${nombre}-${t}.png` });
  estado.llamadas.length = 0;
  await p.goto(`${PUB}/explorar/?momento=vermut`);
  f = estado.llamadas.filter(([fn]) => fn === 'public_explore').map(([, b]) => b)[0] || {};
  ok((f.p_filters?.traits || []).includes('moment_vermouth'), `${nombre}/${t} explorar: «Vermut» manda moment_vermouth`);
  const quitar = await p.locator('.chip-quitar', { hasText: 'Vermut' }).getAttribute('href');
  ok(quitar && !/momento=/.test(quitar), `${nombre}/${t} explorar: la × quita el momento (${quitar})`);
  estado.llamadas.length = 0;
  await p.goto(`${PUB}/en/explore/?moment=now`);
  f = estado.llamadas.filter(([fn]) => fn === 'public_explore').map(([, b]) => b)[0] || {};
  ok((f.p_filters?.traits || []).includes('moment_now') && await p.locator('.chip-quitar', { hasText: 'For right now' }).count() === 1, `${nombre}/${t} /en/explore: «For right now»`);
  ok(errores.length === 0, `${nombre}/${t} público: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

let servidor = null;
let falso = null;
const estadoPub = { llamadas: [] };
if (!SOLO || SOLO.includes('publico')) {
  falso = supabasePublico(estadoPub);
  await new Promise((r) => falso.listen(FALSO_PORT, r));
  servidor = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(PUB_PORT), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa' }, stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 1500));
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]].filter(([n]) => !process.env.NAV || n === process.env.NAV)) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    if (!SOLO || SOLO.includes('panel')) await panel(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} panel: ${e.message}`));
    if (!SOLO || SOLO.includes('publico')) await publico(nav, nombre, t, vp, estadoPub).catch((e) => ok(false, `${nombre}/${t} público: ${e.message}`));
  }
  await nav.close();
}
if (servidor) servidor.kill();
if (falso) falso.close();
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
