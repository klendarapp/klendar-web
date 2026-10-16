// Prueba de «¿Qué tal?» y «Estaba cerrado» en la web local, con una sesión
// simulada (Supabase contestado aquí: no toca dev ni manda nada):
//
//  1. Tu cuenta › Ajustes → Notificaciones: «¿Qué tal? al día siguiente».
//  2. El aviso del día siguiente (`/business/<id>?review=1&from=quetal`)
//     lleva a `#/opinar/<id>?desde=quetal`: la reseña sin estrellas marcadas
//     y con «Ahora no»; sin venir del aviso, sin «Ahora no».
//  3. Panel › `#/estaba-cerrado`: «Horario» y «Era un cierre puntual».
//  4. Panel › Tu ficha › Horario: el aviso y «Está bien así».
//  5. Ficha pública (Functions de verdad contra un Supabase falso): sin
//     sesión, «Horario sin confirmar» sin botón; con sesión, «Estaba
//     cerrado» → `report_closed`.
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PORT=8793 node tools/serve_dev.mjs &
//   BASE=http://localhost:8793 PW=<ruta a playwright> OUT=<carpeta> node tools/quetal_check.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8793';
const OUT = process.env.OUT || '.';
const FICHA_PORT = Number(process.env.FICHA_PORT || 8794);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8795);
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-0000000097a1';
const BIZ = 'b1000000-0000-4000-8000-0000000097a1';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'quetal@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

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
    if (p.startsWith('/functions/v1/')) return json({ ok: true });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      estado.llamadas.push([fn, body]);
      const r = estado.rpc[fn];
      if (r !== undefined) return json(typeof r === 'function' ? r(body) : r);
      return json(null);
    }
    if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, time_zone: 'Europe/Madrid', opening_hours: { 1: [['09:00', '14:00']] }, logo_url: null, cover_image_url: null, gallery: [] }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, vp, clave, rpc) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [clave, sesion()]);
  const estado = { llamadas: [], rpc };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  const esperaOriginal = p.waitForSelector.bind(p);
  p.waitForSelector = (sel, o) => esperaOriginal(sel, o).catch(async (e) => {
    const v = await p.locator('#view').innerText().catch(() => '');
    throw new Error(`${sel} no aparece: ${v.replace(/\s+/g, ' ').slice(0, 300)} ${errores.join(' | ')}`);
  });
  return { ctx, p, estado, errores };
}

const CUENTA = (x = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  ...x,
});

async function cuentaAjustes(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, CUENTA({
    my_notification_preferences: { notify_favorites: true, notify_quetal: true },
    my_businesses: [], update_notification_preferences: null,
  }));
  await p.goto(`${BASE}/app/#/ajustes/notificaciones`, { waitUntil: 'networkidle' });
  await p.waitForSelector('input[name=quetal]');
  const vA = await p.locator('#view').innerText();
  ok(/¿Qué tal\? al día siguiente/.test(vA) && /te pedimos tu reseña/.test(vA) && await p.locator('input[name=quetal]').isChecked(), `${nombre}/${t} Ajustes: «¿Qué tal? al día siguiente», encendido`);
  await p.locator('input[name=quetal]').click({ force: true });
  await p.waitForTimeout(1200);
  const l = estado.llamadas.filter(([fn]) => fn === 'update_notification_preferences').pop();
  ok(l && l[1].p && l[1].p.notify_quetal === false, `${nombre}/${t} Ajustes: lo apaga ${JSON.stringify(l && l[1].p && l[1].p.notify_quetal)}`);
  ok(errores.length === 0, `${nombre}/${t} Ajustes sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function cuentaResena(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, CUENTA({
    business_profile: [{ id: BIZ, name: 'Bar Sonda', city: 'Madrid', time_zone: 'Europe/Madrid' }],
    my_review: null, business_reviews: [],
  }));
  await p.goto(`${BASE}/app/#/`, { waitUntil: 'networkidle' });
  const destino = await p.evaluate((b) => destinoWeb(`/business/${b}?review=1&from=quetal`), BIZ);
  ok(destino === `#/opinar/${BIZ}?desde=quetal`, `${nombre}/${t} el aviso lleva a la reseña con «Ahora no» (${destino})`);
  await p.goto(`${BASE}/app/#/opinar/${BIZ}?desde=quetal`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#n5');
  const marcadas = await p.locator('input[name=nota]:checked').count();
  ok(marcadas === 0, `${nombre}/${t} reseña desde el aviso: sin estrellas marcadas`);
  ok(await p.locator(`.ahora-no a[href$="/b/${BIZ}"]`).count() === 1, `${nombre}/${t} reseña desde el aviso: «Ahora no»`);
  await p.screenshot({ path: `${OUT}/web-resena-que-tal-${nombre}-${t}.png`, fullPage: true });
  await p.goto(`${BASE}/app/#/opinar/${BIZ}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#n5');
  // Solo cambia el `#`: se espera a que se vuelva a pintar.
  await p.waitForFunction(() => !document.querySelector('.ahora-no'), null, { timeout: 5000 }).catch(() => {});
  ok(await p.locator('.ahora-no').count() === 0, `${nombre}/${t} reseña normal: sin «Ahora no»`);
  ok(errores.length === 0, `${nombre}/${t} reseña sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const PANEL = (x = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: 'Bar Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid', opening_hours: { 1: [['09:00', '14:00']] } }],
  business_is_organizer: false,
  my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
  business_tools_overview: { ok: true, can_edit: true, team: { members: 1 }, series: { rules_active: 0 } },
  ...x,
});
async function panelCerrado(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, PANEL({
    business_closed_reports: { reports: [{ at: new Date().toISOString(), local: '2026-10-15T18:00', after_check: true }, { at: new Date().toISOString(), local: '2026-10-14T17:40', after_check: true }, { at: new Date().toISOString(), local: '2026-10-09T19:15', after_check: true }],
      people: 3, unconfirmed: true, confirmed_at: null, can_manage: true },
    confirm_business_hours: null, business_closures: [],
  }));
  await p.goto(`${BASE}/panel/#/estaba-cerrado`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#cerrPuntual');
  const v = await p.locator('#view').innerText();
  ok(/Alguien encontró cerrado tu local el jueves a las 18:00\. ¿Está bien tu horario\?/.test(v) && /Horario sin confirmar/.test(v) && /3 personas desde que revisaste el horario/.test(v),
    `${nombre}/${t} panel Estaba cerrado: el aviso, el estado y cuántas personas`);
  ok(await p.locator('a[href="#/ficha/horario"]').count() === 1, `${nombre}/${t} panel Estaba cerrado: «Horario»`);
  await p.screenshot({ path: `${OUT}/web-panel-estaba-cerrado-${nombre}-${t}.png`, fullPage: true });
  await p.click('#cerrPuntual');
  await p.waitForTimeout(600);
  ok(estado.llamadas.some(([fn]) => fn === 'confirm_business_hours') && /#\/cerrados/.test(p.url()), `${nombre}/${t} panel Estaba cerrado: «Era un cierre puntual» confirma y abre «Días cerrados»`);
  ok(errores.length === 0, `${nombre}/${t} panel Estaba cerrado sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function panelHorario(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, PANEL({
    business_closed_reports: { reports: [{ at: new Date().toISOString(), local: '2026-10-15T18:00', after_check: true }], people: 1, unconfirmed: false, confirmed_at: null, can_manage: true },
    confirm_business_hours: null,
    business_private: { tax_id: null },
  }));
  await p.goto(`${BASE}/panel/#/ficha/horario`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#cerrBien');
  ok(/Alguien encontró cerrado tu local/.test(await p.locator('#view').innerText()), `${nombre}/${t} panel Horario: el aviso encima del editor`);
  await p.screenshot({ path: `${OUT}/web-panel-horario-aviso-${nombre}-${t}.png`, fullPage: true });
  await p.click('#cerrBien');
  await p.waitForTimeout(400);
  ok(estado.llamadas.some(([fn]) => fn === 'confirm_business_hours') && await p.locator('#cerrBien').count() === 0, `${nombre}/${t} panel Horario: «Está bien así» lo confirma`);
  ok(errores.length === 0, `${nombre}/${t} panel Horario sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// ── La ficha pública, con las Functions de verdad ───────────────────────────
const HORAS = { 1: [['00:00', '00:00']], 2: [['00:00', '00:00']], 3: [['00:00', '00:00']], 4: [['00:00', '00:00']], 5: [['00:00', '00:00']], 6: [['00:00', '00:00']], 7: [['00:00', '00:00']] };
function supabaseFicha() {
  return createServer((req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    const url = new URL(req.url, 'http://x');
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; });
    req.on('end', () => {
      const json = (b) => { res.writeHead(200, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(b)); };
      let args = {};
      try { args = JSON.parse(cuerpo || '{}'); } catch { /* */ }
      if (url.pathname === '/rest/v1/rpc/business_profile') {
        return json([{ id: args.p_id, name: 'Bar Sonda', city: 'Madrid', address: 'Calle Mayor 1, 28013 Madrid', lat: 40.4168, lng: -3.7038, is_verified: true,
          member_since: '2026-01-01T00:00:00Z', time_zone: 'Europe/Madrid', description: 'Un bar de prueba.', closed_indefinitely: false, social: {}, opening_hours: HORAS }]);
      }
      if (url.pathname === '/rest/v1/rpc/business_hours_status') return json({ ok: true, open_now: true, unconfirmed: true, reported_today: false, can_report: false });
      if (url.pathname.startsWith('/rest/v1/rpc/')) return json([]);
      return json([]);
    });
  });
}

async function ficha(nav, nombre, t, vp) {
  // Sin sesión: «Horario sin confirmar», sin botón.
  let ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  let p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`http://localhost:${FICHA_PORT}/b/${BIZ}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.horario-sin', { timeout: 10000 }).catch(() => null);
  let caja = await p.locator('.horario-check').innerText().catch(() => '');
  ok(/Horario sin confirmar/.test(caja) && !/Estaba cerrado/.test(caja), `${nombre}/${t} ficha sin sesión: «Horario sin confirmar», sin «Estaba cerrado» (${caja.slice(0, 80)})`);
  await p.locator('.horario-check').screenshot({ path: `${OUT}/web-ficha-horario-sin-${nombre}-${t}.png` }).catch(() => {});
  await ctx.close();
  // Con sesión: el botón y `report_closed`.
  ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
  const estado = { llamadas: [], rpc: {
    business_hours_status: { ok: true, open_now: true, unconfirmed: false, reported_today: false, can_report: true },
    report_closed: { ok: true, unconfirmed: false },
    my_businesses: [], my_blocks: [],
  } };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`http://localhost:${FICHA_PORT}/b/${BIZ}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-cerrado-boton]', { timeout: 10000 }).catch(() => null);
  ok(await p.locator('[data-cerrado-boton]').count() === 1, `${nombre}/${t} ficha con sesión: «Estaba cerrado»`);
  if (await p.locator('[data-cerrado-boton]').count()) {
    await p.click('[data-cerrado-boton]');
    await p.locator('.horario-check').screenshot({ path: `${OUT}/web-ficha-estaba-cerrado-${nombre}-${t}.png` }).catch(() => {});
    await p.click('.horario-check [data-si]');
    await p.waitForTimeout(800);
    const l = estado.llamadas.find(([fn]) => fn === 'report_closed');
    ok(l && l[1].p_business === BIZ && /Se lo hemos dicho al negocio/.test(await p.locator('.horario-check').innerText()), `${nombre}/${t} ficha: avisa y da las gracias ${JSON.stringify(l)}`);
  }
  ok(errores.length === 0, `${nombre}/${t} ficha sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const SOLO = process.env.SOLO || '';
let servidorFicha = null;
let falso = null;
if (!SOLO || SOLO.includes('ficha')) {
  falso = supabaseFicha();
  await new Promise((r) => falso.listen(FALSO_PORT, r));
  servidorFicha = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(FICHA_PORT), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa' }, stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 2000));
}

const PRUEBAS = { cuentaAjustes, cuentaResena, panelCerrado, panelHorario, ficha };
for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    for (const [k, f] of Object.entries(PRUEBAS)) {
      if (SOLO && !SOLO.split(',').includes(k)) continue;
      await f(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} ${k}: ${e.message.split('\n')[0]}`));
    }
  }
  await nav.close();
}
if (servidorFicha) servidorFicha.kill();
if (falso) falso.close();
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
