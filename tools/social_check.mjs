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
    if (url.pathname === '/rest/v1/rpc/giveaway_detail') {
      let args = '';
      req.on('data', (c) => { args += c; });
      req.on('end', () => {
        const id = (JSON.parse(args || '{}').p_id) || '';
        json(id === SORTEO_HECHO ? { ...SORTEO(), id, status: 'drawn', ends_at: '2026-10-01T20:00:00Z', seed: 'abc', entries_total: 0, picked_numbers: [], void_numbers: [] } : SORTEO());
      });
      return undefined;
    }
    if (url.pathname.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, time_zone: 'Europe/Madrid' }]);
    return json([]);
  });
}
const SORTEO_ID = 'd1000000-0000-4000-8000-0000000097c1';
const SORTEO_HECHO = 'd1000000-0000-4000-8000-0000000097c2';
const SORTEO = (x = {}) => ({ id: SORTEO_ID, prize: 'Cena para dos', status: 'active', ends_at: '2027-01-01T20:00:00Z', winners: 1, backups: 0, entries: 0,
  seed_hash: 'ab', business: { id: BIZ, name: 'Bar Sonda', city: 'Madrid' }, organizer_name: 'Bar Sonda SL', ...x });
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

// 3. Confirmar antes de dejar un sorteo o dejar de seguir.
async function sorteos(nav, nombre, t, vp) {
  // Sin sesión: «Entra para participar», quién organiza y nadie aún.
  let ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  let p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`http://localhost:${FICHA_PORT}/sorteo/${SORTEO_ID}`, { waitUntil: 'networkidle' });
  let v = await p.locator('body').innerText();
  ok(/Organiza: Bar Sonda SL\. Klendar solo pone la herramienta\./.test(v) && /Aún no participa nadie/.test(v) && /sin suplentes/.test(v),
    `${nombre}/${t} sorteo: «Organiza: …», «Aún no participa nadie» y «sin suplentes»`);
  ok((await p.locator('#sorteo-boton').innerText()).trim() === 'Entra para participar', `${nombre}/${t} sorteo sin sesión: «Entra para participar»`);
  await p.goto(`http://localhost:${FICHA_PORT}/sorteo/${SORTEO_HECHO}`, { waitUntil: 'networkidle' });
  v = await p.locator('body').innerText();
  ok(/Nadie participó: no hay ganador\./.test(v) && /Números anulados: ninguno/.test(v) && !/Han salido/.test(v), `${nombre}/${t} sorteo verificable sin participantes`);
  await ctx.close();
  // Con sesión (la página apunta a Supabase «de verdad», contestado aquí):
  // dejarlo pregunta antes.
  ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  await ctx.addInitScript(([k, val]) => { try { localStorage.setItem(k, val); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
  await ctx.route(`http://localhost:${FICHA_PORT}/sorteo/**`, async (route) => {
    const r = await route.fetch();
    route.fulfill({ response: r, body: (await r.text()).replace(/data-url="[^"]*"/g, `data-url="${SUPA}"`) });
  });
  const estado = { llamadas: [], rpc: { giveaway_detail: SORTEO({ me: { entered: true, number: 7, adult: true } }), giveaway_leave: { ok: true } } };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`http://localhost:${FICHA_PORT}/sorteo/${SORTEO_ID}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-sorteo=leave]');
  await p.click('[data-sorteo=leave]');
  await p.waitForSelector('dialog.sorteo-dialogo[open]');
  ok(/¿Dejar el sorteo\?/.test(await p.locator('dialog.sorteo-dialogo').innerText()), `${nombre}/${t} dejar el sorteo: pregunta antes`);
  if (t === 'movil') await p.screenshot({ path: `${OUT}/web-sorteo-dejar-${nombre}-${t}.png` });
  await p.click('dialog.sorteo-dialogo button[value=no]');
  await p.waitForTimeout(300);
  ok(!estado.llamadas.some(([f]) => f === 'giveaway_leave'), `${nombre}/${t} dejar el sorteo: «Cancelar» no lo deja`);
  await p.click('[data-sorteo=leave]');
  await p.click('dialog.sorteo-dialogo button[value=si]');
  await p.waitForTimeout(800);
  ok(estado.llamadas.some(([f]) => f === 'giveaway_leave'), `${nombre}/${t} dejar el sorteo: confirmado, lo deja`);
  ok(errores.length === 0, `${nombre}/${t} sorteos sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function dejarDeSeguir(nav, nombre, t, vp) {
  for (const [ruta, fn, lista] of [
    ['artistas', 'unfollow_artist', { my_followed_artists: [{ id: 'a1', name: 'DJ Nano', slug: 'dj-nano', next: null }] }],
    ['equipos', 'unfollow_broadcast_team', { my_followed_teams: [{ id: 't1', name: 'Real Madrid', sport: 'football', next: null }] }],
  ]) {
    const { ctx, p, estado, errores } = await contexto(nav, vp, CUENTA({ ...lista, [fn]: { ok: true } }));
    await p.goto(`${BASE}/app/#/${ruta}`, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-dejar]');
    const v = await p.locator('#view').innerText();
    ok(/Sin (fechas|partidos) a la vista/.test(v), `${nombre}/${t} ${ruta}: «Sin … a la vista»`);
    await p.click('[data-dejar]');
    await p.waitForSelector('dialog.dialogo[open]');
    ok(/Sigues a (DJ Nano|Real Madrid)/.test(await p.locator('dialog.dialogo[open]').innerText()), `${nombre}/${t} ${ruta}: dejar de seguir pregunta antes`);
    await p.click('dialog.dialogo[open] button[value=si]');
    await p.waitForTimeout(800);
    ok(estado.llamadas.some(([f]) => f === fn), `${nombre}/${t} ${ruta}: confirmado, deja de seguir`);
    ok(errores.length === 0, `${nombre}/${t} ${ruta} sin errores JS ${errores.join(' | ')}`);
    await ctx.close();
  }
}

// 4. Ajustes: Idioma y «Traducir…» se guardan solos; el perfil, aparte.
async function ajustes(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, CUENTA({
    my_translation_settings: { translate_content: false }, set_translate_content: { ok: true },
    my_auth_methods: { has_password: true }, my_blocks: { blocks: [] },
  }), { fn: { translate: { available: true } }, perfil: { display_name: 'Ana', avatar_url: null, locale: null, birth_date: '1990-05-01' } });
  await p.goto(`${BASE}/app/#/ajustes`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#idioma');
  const v = await p.locator('#view').innerText();
  ok(!/Tu perfil/.test(v) && await p.locator('#f-perfil').count() === 0, `${nombre}/${t} Ajustes: sin «Tu perfil» dentro`);
  await p.screenshot({ path: `${OUT}/web-ajustes-${nombre}-${t}.png`, fullPage: true });
  await p.selectOption('#idioma', 'es');
  await p.waitForTimeout(800);
  ok(estado.llamadas.some(([f, b]) => f === 'profiles' && b.locale === 'es') && estado.llamadas.some(([f, b]) => f === 'auth_update' && b.data?.locale === 'es'),
    `${nombre}/${t} Ajustes: el idioma se guarda al elegirlo`);
  await p.check('#traducir');
  await p.waitForTimeout(600);
  ok(estado.llamadas.some(([f, b]) => f === 'set_translate_content' && b.p_value === true), `${nombre}/${t} Ajustes: «Traducir…» se guarda al marcarlo`);
  // Editar perfil, su pantalla.
  await p.goto(`${BASE}/app/#/perfil`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#f-perfil');
  const v2 = await p.locator('#view').innerText();
  ok(/Editar perfil/.test(v2) && /Cómo quieres que te vean en las reseñas/.test(v2) && await p.locator('#f-perfil select').count() === 0,
    `${nombre}/${t} «Editar perfil»: foto, nombre y fecha (sin idioma)`);
  await p.screenshot({ path: `${OUT}/web-perfil-${nombre}-${t}.png`, fullPage: true });
  await p.fill('#f-perfil input[name=nombre]', 'Ana B.');
  await p.click('#g-perfil');
  await p.waitForTimeout(800);
  ok(estado.llamadas.some(([f, b]) => f === 'profiles' && b.display_name === 'Ana B.'), `${nombre}/${t} «Editar perfil» guarda el nombre`);
  ok(errores.length === 0, `${nombre}/${t} Ajustes sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// 5. Textos de la app en la cola, «Lo que has pedido» y «Tus peticiones».
async function textos(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, CUENTA({
    queue_info: { business: { id: BIZ, name: 'Bar Sonda', adults_only: true }, queue: { status: 'open', waiting: 0, full: false, wait_minutes: 17, call_minutes: 5 }, me: null, team: false },
    my_venue_requests: [{ id: 'v1', name: 'Bar Paco', place: 'Madrid', status: 'waiting', people: 1, created_at: '2026-10-01T10:00:00Z' }],
    my_city_waitlist: [],
    my_notification_preferences: {},
    my_group_requests: [{ id: 'g1', status: 'open', kind: 'afterwork', people: 8, date: '2026-11-20', targets: [{ status: 'proposed', business: { name: 'A' } }, { status: 'pending', business: { name: 'B' } }] }],
  }));
  await p.goto(`${BASE}/app/#/cola/ABCDEFGHIJKLMNOP`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.cola-turno');
  let v = await p.locator('#view').innerText();
  ok(/Espera aproximada: unos 15 min/.test(v) && /Solo para mayores de 18 años/.test(v), `${nombre}/${t} cola: espera redondeada con la cola vacía y +18`);
  await p.goto(`${BASE}/app/#/pedidos`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.avisos');
  v = await p.locator('#view').innerText();
  ok(/Locales que has pedido/.test(v) && /Solo tú/.test(v) && /Aún no te has apuntado en ninguna zona\./.test(v)
    && v.indexOf('Bar Paco') < v.indexOf('Pedir un local'), `${nombre}/${t} «Lo que has pedido»: textos y «Pedir un local» debajo`);
  await p.goto(`${BASE}/app/#/grupos/peticiones`, { waitUntil: 'networkidle' }).catch(() => {});
  await p.goto(`${BASE}/app/#/ajustes/notificaciones`, { waitUntil: 'networkidle' });
  await p.waitForSelector('input[name=pedidos]');
  v = await p.locator('#view').innerText();
  ok(/Lo que has pedido/.test(v) && /Cuando tienen una fecha nueva cerca/.test(v) && /Cuando llega a Klendar un sitio que pediste/.test(v),
    `${nombre}/${t} Notificaciones: ayuda de artistas, de locales pedidos y «Lo que has pedido»`);
  ok(errores.length === 0, `${nombre}/${t} textos sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

export const PRUEBAS = { fichaAmigo, rrppPersona, rrppPanel, paginaRp, sorteos, dejarDeSeguir, ajustes, textos };
const SOLO = process.env.SOLO || '';
let servidorRp = null;
let falso = null;
if (!SOLO || SOLO.includes('paginaRp') || SOLO.includes('sorteos')) {
  falso = supabaseRp();
  await new Promise((r) => falso.listen(FALSO_PORT, r));
  servidorRp = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(FICHA_PORT), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa' }, stdio: 'ignore',
  });
  process.on('exit', () => { try { servidorRp.kill(); } catch { /* ya cerrado */ } });
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
