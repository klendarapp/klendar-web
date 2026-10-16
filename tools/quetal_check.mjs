// Prueba de «¿Qué tal?» y «Estaba cerrado» en la web local, con una sesión
// simulada (Supabase contestado aquí: no toca dev ni manda nada):
//
//  1. Tu cuenta › «Tus códigos»: la pregunta con 👍 / 👎 en lo ya usado.
//  2. Tu cuenta › `#/que-tal/<id>?a=up`: cuenta la respuesta y lleva a la
//     reseña con 5 estrellas (`#/opinar/<id>?nota=5`, ya marcadas).
//  3. Tu cuenta › 👎: el mensaje privado (ofensivo no sale; bien, se manda) y
//     «Prefiero dejar una reseña» siempre a la vista.
//  4. Tu cuenta › Ajustes → Notificaciones: «¿Qué tal? al día siguiente».
//  5. Panel › Cifras: «¿Qué tal?: 42 👍 · 5 👎» y «Mensajes privados».
//  6. Panel › `#/que-tal`: contestar una vez y denunciar.
//  7. Panel › `#/estaba-cerrado`: «Horario» y «Era un cierre puntual».
//  8. Panel › Tu ficha › Horario: el aviso y «Está bien así».
//  9. Admin › Denuncias: un mensaje privado denunciado y su filtro.
// 10. Ficha pública (Functions de verdad contra un Supabase falso): sin
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
const Q1 = 'a1000000-0000-4000-8000-0000000097a1';
const Q2 = 'a2000000-0000-4000-8000-0000000097a2';
const M1 = 'c1000000-0000-4000-8000-0000000097c1';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'quetal@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const ayer = () => { const d = new Date(Date.now() - 864e5); return d.toISOString().slice(0, 10); };

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

const pregunta = (x = {}) => ({
  id: Q1, business_id: BIZ, business_name: 'Bar Sonda', business_logo: null, business_slug: 'bar-sonda-madrid',
  source: 'redemption', what: 'Vermú + tapa', visit_day: ayer(), answer: null, message: null, message_removed: false,
  reply: null, reply_at: null, can_answer: true, can_message: true, reviewed: false, ...x,
});
const CUENTA = (x = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_redemptions: [], my_stamp_rewards: [], my_passes: [], my_queue_turns: [], my_birthday_gifts: [], my_loyalty_gifts: [],
  ...x,
});

async function cuentaCodigos(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, CUENTA({
    my_quetal: [pregunta(), pregunta({ id: Q2, business_name: 'Café Central', answer: 'down', message: 'Tardaron mucho', reply: 'Lo sentimos', can_message: false })],
  }));
  await p.goto(`${BASE}/app/#/codigos`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.qt-tarjeta');
  const v = await p.locator('#view').innerText();
  ok(/Pasados/.test(v) && /¿Qué tal en Bar Sonda\?/.test(v) && /Ayer · Vermú \+ tapa/.test(v), `${nombre}/${t} Tus códigos: la pregunta en lo ya usado`);
  ok(await p.locator(`a[href="#/que-tal/${Q1}?a=up"]`).count() === 1 && await p.locator(`a[href="#/que-tal/${Q1}?a=down"]`).count() === 1, `${nombre}/${t} Tus códigos: 👍 y 👎`);
  ok(/Te han contestado/.test(v), `${nombre}/${t} Tus códigos: la contestada dice que hay respuesta`);
  await p.screenshot({ path: `${OUT}/web-codigos-que-tal-${nombre}-${t}.png`, fullPage: true });
  ok(errores.length === 0, `${nombre}/${t} Tus códigos sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function cuentaBien(nav, nombre, t, vp) {
  let q = pregunta();
  const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, CUENTA({
    my_quetal: () => [q],
    quetal_answer: (b) => { q = { ...q, answer: b.p_answer }; return { ok: true, item: q }; },
    business_profile: [{ id: BIZ, name: 'Bar Sonda', city: 'Madrid', time_zone: 'Europe/Madrid' }],
    my_review: null, business_reviews: [],
  }));
  await p.goto(`${BASE}/app/#/que-tal/${Q1}?a=up`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.qt-negocio');
  const v = await p.locator('#view').innerText();
  const l = estado.llamadas.find(([fn]) => fn === 'quetal_answer');
  ok(l && l[1].p_answer === 'up' && l[1].p_id === Q1, `${nombre}/${t} ¿Qué tal? 👍: cuenta la respuesta ${JSON.stringify(l)}`);
  ok(/¡Qué bien!/.test(v) && await p.locator(`a[href="#/opinar/${BIZ}?nota=5"]`).count() === 1, `${nombre}/${t} ¿Qué tal? 👍: invita a reseñar con 5 estrellas`);
  ok(/Cambiar mi respuesta/.test(v), `${nombre}/${t} ¿Qué tal? 👍: se puede cambiar`);
  await p.screenshot({ path: `${OUT}/web-que-tal-bien-${nombre}-${t}.png`, fullPage: true });
  await p.click(`a[href="#/opinar/${BIZ}?nota=5"]`);
  await p.waitForSelector('#n5');
  ok(await p.locator('#n5').isChecked(), `${nombre}/${t} reseña: 5 estrellas de partida`);
  ok(errores.length === 0, `${nombre}/${t} ¿Qué tal? 👍 sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function cuentaMal(nav, nombre, t, vp) {
  let q = pregunta();
  const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, CUENTA({
    my_quetal: () => [q],
    quetal_answer: (b) => { q = { ...q, answer: b.p_answer }; return { ok: true, item: q }; },
    quetal_send_message: (b) => (/gilipollas/.test(b.p_text) ? { ok: false, error: 'offensive_text' }
      : (q = { ...q, message: b.p_text, can_message: false }, { ok: true, item: q })),
  }));
  await p.goto(`${BASE}/app/#/que-tal/${Q1}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-qt=down]');
  ok(/Escribir una reseña/.test(await p.locator('#view').innerText()), `${nombre}/${t} ¿Qué tal?: reseñar a la vista antes de contestar`);
  await p.screenshot({ path: `${OUT}/web-que-tal-${nombre}-${t}.png`, fullPage: true });
  await p.click('[data-qt=down]');
  await p.waitForSelector('#qtForm textarea');
  let v = await p.locator('#view').innerText();
  ok(/Vaya\. ¿Qué ha fallado\?/.test(v) && /Prefiero dejar una reseña/.test(v), `${nombre}/${t} ¿Qué tal? 👎: mensaje privado y «Prefiero dejar una reseña»`);
  await p.screenshot({ path: `${OUT}/web-que-tal-mal-${nombre}-${t}.png`, fullPage: true });
  await p.fill('#qtForm textarea', 'el camarero es un gilipollas');
  await p.click('#qtForm button[type=submit]');
  await p.waitForTimeout(300);
  ok(/palabras que no se permiten/.test(await p.locator('#toast').innerText()), `${nombre}/${t} ¿Qué tal? 👎: lo ofensivo no sale`);
  await p.fill('#qtForm textarea', 'Tardaron 40 minutos en traer la cuenta');
  await p.click('#qtForm button[type=submit]');
  await p.waitForSelector('.qt-burbuja');
  v = await p.locator('#view').innerText();
  const l = estado.llamadas.filter(([fn]) => fn === 'quetal_send_message').pop();
  ok(l && l[1].p_text === 'Tardaron 40 minutos en traer la cuenta' && /Tu mensaje/.test(v) && /aún no ha contestado/.test(v) && /Prefiero dejar una reseña/.test(v),
    `${nombre}/${t} ¿Qué tal? 👎: mensaje enviado y reseñar sigue a la vista`);
  ok(errores.length === 0, `${nombre}/${t} ¿Qué tal? 👎 sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function cuentaAjustes(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, CUENTA({
    my_notification_preferences: { notify_favorites: true, notify_quetal: true },
    my_businesses: [], update_notification_preferences: null,
  }));
  await p.goto(`${BASE}/app/#/ajustes/notificaciones`, { waitUntil: 'networkidle' });
  await p.waitForSelector('input[name=quetal]');
  ok(/¿Qué tal\? al día siguiente/.test(await p.locator('#view').innerText()) && await p.locator('input[name=quetal]').isChecked(), `${nombre}/${t} Ajustes: «¿Qué tal? al día siguiente», encendido`);
  await p.locator('input[name=quetal]').click({ force: true });
  await p.waitForTimeout(1200);
  const l = estado.llamadas.filter(([fn]) => fn === 'update_notification_preferences').pop();
  ok(l && l[1].p && l[1].p.notify_quetal === false, `${nombre}/${t} Ajustes: lo apaga ${JSON.stringify(l && l[1].p && l[1].p.notify_quetal)}`);
  ok(errores.length === 0, `${nombre}/${t} Ajustes sin errores JS ${errores.join(' | ')}`);
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
const negocioQueTal = (x = {}) => ({
  up: 42, down: 5, can_manage: true, can_reply: true, unread: 1,
  messages: [{ id: M1, name: 'Lucía', message: 'Tardaron 40 minutos en traer la cuenta.', message_at: new Date().toISOString(), visit_day: ayer(), what: 'Vermú + tapa', read: false, reply: null, reply_at: null, reported: false }],
  ...x,
});

async function panelCifras(nav, nombre, t, vp) {
  const { ctx, p, errores, estado } = await contexto(nav, vp, `sb-${REF}-auth-token`, PANEL({
    business_report: { totals: {}, loyalty: {}, daily: [], offers: [], by_hour: [], redemptions: [] },
    business_quetal: negocioQueTal(),
  }));
  await p.goto(`${BASE}/panel/#/informe`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#cifrasDetalle');
  const html = await p.locator('#cifrasDetalle').innerHTML();
  ok(/¿Qué tal\?: 42 👍 · 5 👎/.test(html) && /#\/que-tal/.test(html) && /1 sin leer/.test(html), `${nombre}/${t} Cifras: «¿Qué tal?: 42 👍 · 5 👎» y los mensajes`);
  ok(errores.length === 0, `${nombre}/${t} Cifras sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function panelQueTal(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, PANEL({
    business_quetal: negocioQueTal(), quetal_reply: { ok: true }, quetal_mark_read: null, report_target: null,
  }));
  await p.goto(`${BASE}/panel/#/que-tal`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-qt-resp]');
  const v = await p.locator('#view').innerText();
  ok(/Lucía/.test(v) && /Tardaron 40 minutos/.test(v) && /Sin leer/.test(v), `${nombre}/${t} panel ¿Qué tal?: el mensaje con el nombre visible`);
  await p.screenshot({ path: `${OUT}/web-panel-que-tal-${nombre}-${t}.png`, fullPage: true });
  await p.click('[data-qt-resp]');
  await p.waitForSelector('#modal textarea[name=reply]');
  await p.fill('#modal textarea[name=reply]', 'Lo sentimos mucho, ya lo hemos hablado con el equipo');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(500);
  const l = estado.llamadas.find(([fn]) => fn === 'quetal_reply');
  ok(l && l[1].p_id === M1 && /Lo sentimos/.test(l[1].p_text), `${nombre}/${t} panel ¿Qué tal?: contesta ${JSON.stringify(l)}`);
  await p.waitForSelector('[data-qt-den]');
  await p.click('[data-qt-den]');
  await p.waitForSelector('#modal select[name=motivo]');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(500);
  const d = estado.llamadas.find(([fn]) => fn === 'report_target');
  ok(d && d[1].p_type === 'quetal_message' && d[1].p_id === M1 && d[1].p_reason === 'inappropriate', `${nombre}/${t} panel ¿Qué tal?: denuncia el mensaje ${JSON.stringify(d)}`);
  ok(errores.length === 0, `${nombre}/${t} panel ¿Qué tal? sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function panelCerrado(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, `sb-${REF}-auth-token`, PANEL({
    business_closed_reports: { reports: [{ at: new Date().toISOString(), local: '2026-10-15T18:00', after_check: true }, { at: new Date().toISOString(), local: '2026-10-14T17:40', after_check: true }, { at: new Date().toISOString(), local: '2026-10-09T19:15', after_check: true }],
      people: 3, unconfirmed: true, confirmed_at: null, can_manage: true },
    confirm_business_hours: null, business_closures: [],
  }));
  await p.goto(`${BASE}/panel/#/estaba-cerrado`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#qtPuntual');
  const v = await p.locator('#view').innerText();
  ok(/Alguien encontró cerrado tu local el jueves a las 18:00\. ¿Está bien tu horario\?/.test(v) && /Horario sin confirmar/.test(v) && /3 personas desde que revisaste el horario/.test(v),
    `${nombre}/${t} panel Estaba cerrado: el aviso, el estado y cuántas personas`);
  ok(await p.locator('a[href="#/ficha/horario"]').count() === 1, `${nombre}/${t} panel Estaba cerrado: «Horario»`);
  await p.screenshot({ path: `${OUT}/web-panel-estaba-cerrado-${nombre}-${t}.png`, fullPage: true });
  await p.click('#qtPuntual');
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
  await p.waitForSelector('#qtBien');
  ok(/Alguien encontró cerrado tu local/.test(await p.locator('#view').innerText()), `${nombre}/${t} panel Horario: el aviso encima del editor`);
  await p.screenshot({ path: `${OUT}/web-panel-horario-aviso-${nombre}-${t}.png`, fullPage: true });
  await p.click('#qtBien');
  await p.waitForTimeout(400);
  ok(estado.llamadas.some(([fn]) => fn === 'confirm_business_hours') && await p.locator('#qtBien').count() === 0, `${nombre}/${t} panel Horario: «Está bien así» lo confirma`);
  ok(errores.length === 0, `${nombre}/${t} panel Horario sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function adminDenuncia(nav, nombre, t, vp) {
  const den = {
    target_type: 'quetal_message', target_id: M1, n: 1, open_count: 1, total_count: 1, people: 1, with_account: 1, without_account: 0,
    first_at: new Date().toISOString(), last_at: new Date().toISOString(), reviewing: false, state: 'published', live: true,
    target: { title: 'Sois unos ladrones', business: 'Bar Sonda', business_id: BIZ, city: 'Madrid' }, reasons: [{ reason: 'inappropriate', n: 1 }],
  };
  const { ctx, p, errores } = await contexto(nav, vp, `sb-${REF}-admin-auth-token`, {
    is_admin: true, admin_mfa_status: { required: false, enrolled: true }, admin_kpis: {},
    admin_report_groups: { total: 1, rows: [den], hot: 0 },
  });
  await p.goto(`${BASE}/admin/#/denuncias`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.den-grupo');
  const v = await p.locator('#view').innerText();
  ok(/mensaje privado/i.test(v) && /«Sois unos ladrones»/.test(v) && /para Bar Sonda/.test(v), `${nombre}/${t} admin: el mensaje privado denunciado`);
  ok(await p.locator('#type option[value=quetal_message]').count() === 1, `${nombre}/${t} admin: filtro «Mensajes privados (¿Qué tal?)»`);
  await p.screenshot({ path: `${OUT}/web-admin-denuncia-quetal-${nombre}-${t}.png`, fullPage: true });
  ok(errores.length === 0, `${nombre}/${t} admin sin errores JS ${errores.join(' | ')}`);
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

const PRUEBAS = { cuentaCodigos, cuentaBien, cuentaMal, cuentaAjustes, panelCifras, panelQueTal, panelCerrado, panelHorario, adminDenuncia, ficha };
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
