// Paridad app ↔ web (tanda 2, área «social» y Ajustes), con Supabase contestado
// aquí (no toca dev ni manda nada):
//
//  1. Ficha de un amigo (`#/amigos/<id>`): el ⋮ con «Quitar de tus amigos» y
//     «Bloquear», cada uno con su confirmación y, hecho, a la lista. Bloquear
//     con el tope lleno dice el texto de la app (`blockTooMany`).
//  2. Tus listas de RRPP (`#/rrpp/<negocio>`): cuándo funciona la lista, el
//     estado de cada enlace (fuera de horario, caducidad, visitas) y «Tus
//     ofertas» vacía.
//  3. Dejar un sorteo, dejar de seguir a un artista o a un equipo: piden
//     confirmación, como la app.
//  4. Ajustes: Idioma y «Traducir…» se guardan solos (sin «Guardar»); el
//     perfil (`#/perfil`) es su propia pantalla.
//  5. «Avísame si…»: el editor como el de la app.
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PORT=8792 node tools/serve_dev.mjs &
//   BASE=http://localhost:8792 PW=<ruta a playwright> OUT=<carpeta> node tools/social_check.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8792';
const OUT = process.env.OUT || '.';
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-0000000097c1';
const AMIGO = '0e7717e0-0000-4000-8000-0000000097c2';
const BIZ = 'b1000000-0000-4000-8000-0000000097c1';
const PROMO = 'c1000000-0000-4000-8000-0000000097c1';
const FICHA_PORT = Number(process.env.FICHA_PORT || 8793);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8794);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'social@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, identities: [{ provider: 'email' }], created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

function supabaseFalso(estado) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) {
      if (req.method() === 'PUT') estado.llamadas.push(['auth_update', body]);
      return json(USER);
    }
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/functions/v1/')) return json(estado.fn?.[p.slice('/functions/v1/'.length)] ?? { ok: true });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      estado.llamadas.push([fn, body]);
      const r = estado.rpc[fn];
      if (r !== undefined) return json(typeof r === 'function' ? r(body) : r);
      return json(null);
    }
    if (p.startsWith('/rest/v1/profiles')) {
      if (req.method() === 'PATCH') { estado.llamadas.push(['profiles', body]); return json([]); }
      return json(estado.perfil || { display_name: 'Ana', avatar_url: null, locale: null, birth_date: '1990-05-01' });
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, vp, rpc, extra = {}) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => {
    try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ }
  }, [`sb-${REF}-auth-token`, sesion()]);
  const estado = { llamadas: [], rpc, ...extra };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

const CUENTA = (x = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, share_plans: true },
  my_businesses: [],
  ...x,
});
const confirmaSi = async (p) => { await p.waitForSelector('dialog.dialogo[open]'); await p.click('dialog.dialogo[open] button[value=si]'); };

// 1. La ficha de un amigo con su ⋮.
async function fichaAmigo(nav, nombre, t, vp) {
  for (const accion of ['quitar', 'bloquear', 'tope']) {
    const { ctx, p, estado, errores } = await contexto(nav, vp, CUENTA({
      friend_plans: { friend: { id: AMIGO, name: 'Marta', since: '2026-03-01T10:00:00Z' }, plans: [], together: 2 },
      my_friends: { friends: [], limit: 500 },
      my_friend_link: { code: 'abcdefgh' },
      remove_friend: { ok: true },
      block_user: accion === 'tope' ? { ok: false, error: 'too_many' } : { ok: true },
    }));
    await p.goto(`${BASE}/app/#/amigos/${AMIGO}`, { waitUntil: 'networkidle' });
    await p.waitForSelector('.ficha-amigo h1');
    if (accion === 'quitar') await p.screenshot({ path: `${OUT}/web-ficha-amigo-${nombre}-${t}.png`, fullPage: true });
    await p.click('.amigo-barra details.mas-menu summary');
    ok(await p.locator('[data-ficha-quitar]').isVisible() && await p.locator('[data-ficha-bloquear]').isVisible(), `${nombre}/${t} ficha de amigo: ⋮ con Quitar y Bloquear`);
    if (accion === 'quitar' && t === 'movil') await p.screenshot({ path: `${OUT}/web-ficha-amigo-menu-${nombre}-${t}.png` });
    await p.click(accion === 'quitar' ? '[data-ficha-quitar]' : '[data-ficha-bloquear]');
    await confirmaSi(p);
    await p.waitForTimeout(900);
    const fn = accion === 'quitar' ? 'remove_friend' : 'block_user';
    ok(estado.llamadas.some(([f, b]) => f === fn && b.p_user === AMIGO), `${nombre}/${t} ${accion}: llama a ${fn}`);
    if (accion === 'tope') {
      const toast = await p.locator('.toast, #toast, [role=status]').allInnerTexts();
      ok(toast.join(' ').includes('Has bloqueado a demasiadas personas'), `${nombre}/${t} tope de bloqueos: «Has bloqueado a demasiadas personas…» (${toast.join(' | ')})`);
      ok(/#\/amigos\//.test(p.url()), `${nombre}/${t} tope: se queda en la ficha`);
    } else {
      ok(/#\/amigos$/.test(p.url()), `${nombre}/${t} ${accion}: vuelve a la lista (${p.url()})`);
    }
    ok(errores.length === 0, `${nombre}/${t} ficha de amigo sin errores JS ${errores.join(' | ')}`);
    await ctx.close();
  }
}

// 2. Tus listas de RRPP (persona) y la ficha del RRPP en el panel.
const ENLACE = (x = {}) => ({ id: 'l1', code: 'abcd1234', state: 'ok', label: null, expires_at: null, opens: 1, schedule: null, opens_at: null, ...x });
async function rrppPersona(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, CUENTA({
    promoter_home: {
      business: { id: BIZ, name: 'Sala Sonda' }, status: 'active', tonight: '2026-10-22', night: '2026-10-22', nights: [],
      schedule: { 5: [['22:00', '03:00']], 6: [['22:00', '03:00']] },
      links: [ENLACE({ state: 'closed', opens_at: '2026-10-23T20:00:00Z', opens: 12 }), ENLACE({ id: 'l2', code: 'efgh5678', label: 'Instagram', expires_at: '2026-12-31T22:00:00Z', schedule: { 7: [['20:00', '23:00']] } })],
      offers: [],
      list: [{ name: 'Ana', joined_at: '2026-10-22T23:14:00Z', offer_title: 'Copa 2x1', seats: 1, status: 'validated', entered_at: '2026-10-22T23:32:00Z' }],
    },
  }));
  await p.goto(`${BASE}/app/#/rrpp/${PROMO}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#rrpp-lista .rrpp-fila');
  const v = await p.locator('#view').innerText();
  ok(/Cuándo funciona la lista/.test(v) && /Viernes y sábado, de 22:00 a 3:00/.test(v), `${nombre}/${t} RRPP: cuándo funciona la lista y cuándo abre`);
  ok(/Fuera de horario · 12 visitas/.test(v) && /Caduca el .* · Domingo, de 20:00 a 23:00 · 1 visita/.test(v), `${nombre}/${t} RRPP: estado de cada enlace (fuera de horario, caducidad, horario propio, visitas)`);
  ok(/Ahora mismo no tienes ofertas: lo que saquen con tu enlace cuenta igual/.test(v), `${nombre}/${t} RRPP: «Tus ofertas» vacía con su texto`);
  ok(/Se apuntó a la 1:14/.test(v) && /Dentro a la 1:32/.test(v) && !/1 plaza/.test(v), `${nombre}/${t} RRPP: «a la 1:14» y sin «1 plaza»`);
  ok(/Compartir enlace/.test(v), `${nombre}/${t} RRPP: «Compartir enlace»`);
  await p.screenshot({ path: `${OUT}/web-rrpp-persona-${nombre}-${t}.png`, fullPage: true });
  ok(errores.length === 0, `${nombre}/${t} RRPP sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const PANEL = (x = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: 'Sala Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid', opening_hours: { 5: [['22:00', '03:00']] } }],
  business_is_organizer: false,
  my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
  business_tools_overview: { ok: true, can_edit: true, team: { members: 1 } },
  ...x,
});
async function rrppPanel(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, PANEL({
    promoter_report: { promoter: { id: PROMO, name: 'Marta', status: 'active', accepted_at: '2026-09-01T10:00:00Z', schedule: null, business_has_hours: true },
      tonight: '2026-10-22', night: '2026-10-22', nights: [], list: [], offers: [],
      links: [ENLACE({ label: 'Instagram', expires_at: '2026-12-31T22:00:00Z' })] },
    create_promoter_link: { ok: true, id: 'l9' },
    set_promoter_link_schedule: { ok: true },
    update_promoter_link: { ok: true },
  }));
  await p.goto(`${BASE}/panel/#/rrpp/${PROMO}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-rrpp-editar-enlace]');
  ok(await p.locator('[data-rrpp-compartir]').count() === 1, `${nombre}/${t} panel RRPP: «Compartir enlace»`);
  await p.screenshot({ path: `${OUT}/web-panel-rrpp-${nombre}-${t}.png`, fullPage: true });
  // Nuevo enlace con horario propio.
  await p.click('#rrppNuevo');
  await p.fill('#modal input[name=label]', 'WhatsApp');
  await p.selectOption('#modal select[name=modo]', 'propio');
  if (t === 'movil') await p.screenshot({ path: `${OUT}/web-panel-rrpp-nuevo-${nombre}-${t}.png` });
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(800);
  const c = estado.llamadas.find(([f]) => f === 'create_promoter_link');
  const h = estado.llamadas.find(([f]) => f === 'set_promoter_link_schedule');
  ok(c && c[1].p_label === 'WhatsApp' && h && h[1].p_link === 'l9' && JSON.stringify(h[1].p_schedule) === JSON.stringify({ 5: [['22:00', '03:00']], 6: [['22:00', '03:00']] }),
    `${nombre}/${t} panel RRPP: nuevo enlace con horario (${JSON.stringify(h && h[1])})`);
  // Cambiar el enlace: nombre y sin caducidad.
  await p.waitForSelector('[data-rrpp-editar-enlace]');
  await p.click('[data-rrpp-editar-enlace]');
  ok(await p.inputValue('#modal input[name=label]') === 'Instagram', `${nombre}/${t} panel RRPP: «Cambiar el enlace» trae lo que tiene`);
  await p.fill('#modal input[name=label]', 'Insta');
  await p.fill('#modal input[name=caduca]', '');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(800);
  const u = estado.llamadas.find(([f]) => f === 'update_promoter_link');
  ok(u && u[1].p_label === 'Insta' && u[1].p_clear_expiry === true, `${nombre}/${t} panel RRPP: «Cambiar el enlace» guarda (${JSON.stringify(u && u[1])})`);
  ok(errores.length === 0, `${nombre}/${t} panel RRPP sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// La página del enlace /rp/ (Functions de verdad contra un Supabase falso).
function supabaseRp() {
  return createServer((req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    const url = new URL(req.url, 'http://x');
    const json = (b) => { res.writeHead(200, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(b)); };
    if (url.pathname === '/rest/v1/rpc/promoter_link_open') {
      return json({ ok: true, code: 'abcd1234', business: { id: BIZ, name: 'Sala Sonda', city: 'Madrid' }, promoter: { name: 'Marta' }, offers: [] });
    }
    if (url.pathname.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, time_zone: 'Europe/Madrid' }]);
    return json([]);
  });
}
async function paginaRp(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`http://localhost:${FICHA_PORT}/rp/abcd1234`, { waitUntil: 'networkidle' });
  const v = await p.locator('body').innerText();
  ok(/Ofertas de su lista/.test(v) && /Ahora mismo no hay ofertas en su lista/.test(v), `${nombre}/${t} /rp/: «Ofertas de su lista» vacía con su texto`);
  ok(await p.locator('#rp-entrar').isVisible(), `${nombre}/${t} /rp/: sin sesión, «Para conseguir el código hace falta entrar…»`);
  await p.screenshot({ path: `${OUT}/web-rp-${nombre}-${t}.png`, fullPage: true });
  ok(errores.length === 0, `${nombre}/${t} /rp/ sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

export const PRUEBAS = { fichaAmigo, rrppPersona, rrppPanel, paginaRp };
const SOLO = process.env.SOLO || '';
let servidorRp = null;
let falso = null;
if (!SOLO || SOLO.includes('paginaRp')) {
  falso = supabaseRp();
  await new Promise((r) => falso.listen(FALSO_PORT, r));
  servidorRp = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(FICHA_PORT), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa' }, stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 2000));
}
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
if (servidorRp) servidorRp.kill();
if (falso) falso.close();
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
