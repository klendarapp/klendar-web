// Prueba del alta rápida (Semana 0, 2026-11-05) en la web local, con una sesión
// simulada (Supabase contestado aquí: no toca dev ni prod ni manda nada):
//
//  1. Panel › Resumen de una cafetería sin verificar y sin nada publicado:
//     tres ofertas sugeridas con sus días y su hora, «Completa tu ficha». La
//     hoja publica la primera (precio cerrado, sin descuento) y crea su regla.
//     Si la regla falla, la publicación se quita (al reintentar no sale doble).
//  2. En francés: los títulos, de `panel/sugerencias.js`. Los de un bar, sin
//     nada de alcohol.
//  3. Sin local fijo y entidad comprobada: sin sugerencias, «Publica tu primera
//     oferta». Entidad sin comprobar y empleado: nada de esto.
//  4. Crear una oferta flash: sugerencias solo sin nada publicado y sin ?idea=1.
//  5. Admin › Resumen: «Por verificar ahora» (verificar en dos toques), el QR de
//     klendar.app/alta y el pulso con su semáforo. Sin las migraciones: solo el QR.
//  6. /alta sin sesión: «Crea tu cuenta de negocio». Con sesión: el alta.
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> OUT=<carpeta> node tools/alta_rapida_check.mjs
import { playwright, REF, SUPA, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();
const BASE = process.env.BASE || 'http://localhost:8788';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });

const U = '0e7717e0-0000-4000-8000-00000000a17a';
const BIZ = 'b1000000-0000-4000-8000-00000000a17a';
const OFERTA = 'c1000000-0000-4000-8000-00000000a17a';
const CATS = [
  { id: 'c0000000-0000-4000-8000-000000000001', slug: 'cafe', names: { es: 'Cafeterías', en: 'Cafés' }, position: 1 },
  { id: 'c0000000-0000-4000-8000-000000000002', slug: 'bar', names: { es: 'Bares', en: 'Bars' }, position: 2 },
];
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'alta.rapida@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

function supabaseFalso(e) {
  return async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/functions/v1/')) return json({ ok: true });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      e.llamadas.push([fn, body]);
      if (e.fallan?.includes(fn)) return json({ message: 'falla_a_proposito' }, 400);
      const r = e.rpc[fn];
      return json(r === undefined ? null : typeof r === 'function' ? r(body) : r);
    }
    if (p.startsWith('/rest/v1/categories')) return json(CATS);
    if (p.startsWith('/rest/v1/offers')) {
      if (req.method() === 'POST') { e.insertadas.push(body); return json({ id: OFERTA }, 201); }
      if (req.method() === 'DELETE') { e.borradas.push(req.url()); return json([]); }
      return json([]);
    }
    if (p.startsWith('/rest/v1/businesses')) {
      return json([{ id: BIZ, time_zone: 'Europe/Madrid', category_id: e.categoria, logo_url: null, cover_image_url: null, gallery: [], opening_hours: null, menu_url: null, menu_images: [], created_at: new Date().toISOString() }]);
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, { clave = `sb-${REF}-auth-token`, conSesion = true, lang = 'es', rpc = {}, categoria = CATS[0].id, fallan = [] }) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l]) => {
    try { if (v) localStorage.setItem(k, v); localStorage.setItem('klendar_lang', l); } catch { /* */ }
  }, [clave, conSesion ? sesion() : '', lang]);
  const estado = { llamadas: [], insertadas: [], borradas: [], rpc, categoria, fallan };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (x) => errores.push(x.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

const PANEL = (x = {}, biz = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: 'Café Sonda', role: 'owner', verification_status: 'pending', is_active: true, time_zone: 'Europe/Madrid', city: 'Málaga', ...biz }],
  my_business_offer_counts: { total: 0, todas: 0, activa: 0 },
  business_is_organizer: false,
  my_entity_application: { entity_kind: null, application: null, can_apply: true },
  ...x,
});

async function sugerida(nav, n) {
  const { ctx, p, estado, errores } = await contexto(nav, { rpc: PANEL({ save_offer_rule: 'r1' }) });
  await p.goto(`${BASE}/panel/#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.primeros [data-sug]');
  const v = await p.locator('.primeros').innerText();
  ok(await p.locator('.primeros [data-sug]').count() === 3, `${n}: tres sugerencias`);
  ok(/Café y tostada por 2,50\s€/.test(v) && /lun, mar, mié, jue · 08:00–11:00/.test(v), `${n}: con su precio, sus días y su hora`);
  ok(/Completa tu ficha/.test(v) && /Pon tu horario/.test(v) && /cartel del local/.test(v) && /Prefiero escribir otra/.test(v), `${n}: «Completa tu ficha» y «Prefiero escribir otra»`);
  await p.screenshot({ path: `${OUT}/alta-resumen-${n}.png`, fullPage: true });
  await p.click('.primeros [data-sug="0"]');
  await p.waitForSelector('#modal input[name=precio]');
  const intro = await p.locator('#modal').innerText();
  ok(/Se verá en cuanto verifiquemos tu negocio/.test(intro), `${n}: sin verificar, lo dice`);
  ok(await p.locator('#modal input[name=d1]').isChecked() && !await p.locator('#modal input[name=d5]').isChecked(), `${n}: los días ya marcados`);
  await p.screenshot({ path: `${OUT}/alta-hoja-${n}.png` });
  await p.fill('#modal input[name=precio]', '2,80');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(800);
  const o = estado.insertadas[0];
  ok(o && o.kind === 'flash_offer' && /2,80\s€/.test(o.title) && o.price_cents === 280 && o.discount === null && o.status === 'active' && o.max_per_user === 1, `${n}: publica con el precio nuevo y sin descuento ${JSON.stringify(o)}`);
  ok(o && new Date(o.redeem_end_at) > new Date(o.redeem_start_at) && new Date(o.redeem_end_at) > new Date(), `${n}: en su franja, por delante`);
  const r = estado.llamadas.find(([f]) => f === 'save_offer_rule');
  ok(r && r[1].p_offer === OFERTA && JSON.stringify(r[1].p_weekdays) === '[1,2,3,4]' && r[1].p_start_time === '08:00' && r[1].p_duration_min === 180, `${n}: crea la regla ${JSON.stringify(r)}`);
  ok(estado.borradas.length === 0, `${n}: no borra nada`);
  ok(errores.length === 0, `${n}: sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function reglaFalla(nav, n) {
  const { ctx, p, estado } = await contexto(nav, { rpc: PANEL(), fallan: ['save_offer_rule'] });
  await p.goto(`${BASE}/panel/#/resumen`, { waitUntil: 'networkidle' });
  await p.click('.primeros [data-sug="0"]');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(800);
  ok(estado.insertadas.length === 1 && estado.borradas.length === 1 && estado.borradas[0].includes(OFERTA), `${n}: sin regla, la publicación se quita`);
  await ctx.close();
}

async function idiomas(nav, n) {
  const fr = await contexto(nav, { lang: 'fr', rpc: PANEL() });
  await fr.p.goto(`${BASE}/panel/#/resumen`, { waitUntil: 'networkidle' });
  await fr.p.waitForSelector('.primeros [data-sug]');
  const v = await fr.p.locator('.primeros').innerText();
  ok(/Café et tartine pour 2,50\s€/.test(v) && /Ta première offre, qui se répète toute seule/.test(v), `${n}: en francés`);
  await fr.ctx.close();
  const bar = await contexto(nav, { categoria: CATS[1].id, rpc: PANEL() });
  await bar.p.goto(`${BASE}/panel/#/resumen`, { waitUntil: 'networkidle' });
  await bar.p.waitForSelector('.primeros [data-sug]');
  const b = await bar.p.locator('.sug-lista').innerText();
  ok(/Tapa gratis con tu consumición/.test(b) && !/caña|cerveza|vino|copa|alcohol/i.test(b), `${n}: las de un bar, sin alcohol`);
  await bar.ctx.close();
}

async function sinSugerencias(nav, n) {
  const casos = [
    ['sin local fijo', PANEL({ business_is_organizer: true }), true],
    ['entidad comprobada', PANEL({ my_entity_application: { entity_kind: 'town_hall', application: null } }, { verification_status: 'verified' }), true],
    ['entidad sin comprobar', PANEL({ my_entity_application: { entity_kind: null, application: { status: 'pending', origin: 'signup' } } }), false],
    ['empleado', PANEL({}, { role: 'staff' }), false],
  ];
  for (const [nombre, rpc, conPasos] of casos) {
    const { ctx, p } = await contexto(nav, { rpc });
    await p.goto(`${BASE}/panel/#/resumen`, { waitUntil: 'networkidle' });
    await p.waitForSelector('#view h1');
    ok(await p.locator('[data-sug]').count() === 0, `${n}: ${nombre}, sin sugerencias`);
    const pasos = await p.locator('.primeros').count();
    ok(conPasos ? pasos === 1 && /Publica tu primera oferta/.test(await p.locator('.primeros').innerText()) : pasos === 0, `${n}: ${nombre}, ${conPasos ? '«Publica tu primera oferta»' : 'sin «Primeros pasos»'}`);
    await ctx.close();
  }
}

async function formulario(nav, n) {
  const a = await contexto(nav, { rpc: PANEL() });
  await a.p.goto(`${BASE}/panel/#/publicaciones/nueva-flash`, { waitUntil: 'networkidle' });
  await a.p.waitForSelector('#form');
  ok(await a.p.locator('.sug-caja [data-sug]').count() === 3, `${n}: sin nada publicado, en el formulario`);
  await a.p.evaluate(() => { location.hash = '#/publicaciones/nueva-flash?idea=1'; });
  await a.p.waitForTimeout(800);
  ok(await a.p.locator('.sug-caja').count() === 0, `${n}: «Prefiero escribir otra», sin ellas`);
  await a.ctx.close();
  const b = await contexto(nav, { rpc: PANEL({ my_business_offer_counts: { total: 3, todas: 3, activa: 1 } }) });
  await b.p.goto(`${BASE}/panel/#/publicaciones/nueva-flash`, { waitUntil: 'networkidle' });
  await b.p.waitForSelector('#form');
  ok(await b.p.locator('.sug-caja').count() === 0, `${n}: con publicaciones, sin ellas`);
  await b.ctx.close();
}

const PULSO = { negocios_malaga: 16, vivas_5km: 42, nuevas_24h_5km: 3, flash_ahora_5km: 1, eventos_7d_5km: 21, dias_sin_eventos_14d: 2, reglas_que_se_repiten: 12, en_revision: 1, en_revision_horas: 30, por_verificar: 0, solo_18_5km: 5, hora_local: '12:30' };
const ADMIN = (x = {}) => ({ is_admin: true, admin_mfa_status: { required: false, enrolled: true }, admin_kpis: {}, ...x });

async function admin(nav, n) {
  const fila = { id: BIZ, name: 'Café Sonda', category: 'Cafeterías', city: 'Málaga', address: 'Calle Granada 10', created_at: new Date().toISOString(), owner_email: 'duena@example.com', has_tax_id: true, has_logo: false, offers: 1, rules: 1 };
  const { ctx, p, estado, errores } = await contexto(nav, { clave: `sb-${REF}-admin-auth-token`, rpc: ADMIN({ admin_pending_now: { total: 1, rows: [fila] }, admin_pulso: PULSO, admin_set_verification: null }) });
  await p.goto(`${BASE}/admin/#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#porVerificar [data-verificar]');
  const v = await p.locator('#porVerificar').innerText();
  ok(/Café Sonda/.test(v) && /NIF ✓/.test(v) && /sin logo/.test(v) && /1 oferta que se repite lista/.test(v), `${n}: lo que hace falta para decidir`);
  await p.click('.qr-alta summary');
  ok(await p.locator('#qrAlta svg').isVisible(), `${n}: el QR se ve`);
  await p.screenshot({ path: `${OUT}/alta-admin-${n}.png`, fullPage: true });
  const pul = await p.locator('#pulso').innerText();
  ok(/Locales verificados en Málaga\s+16\s+Justo/.test(pul), `${n}: 16 locales, «Justo» ${pul.slice(0, 200)}`);
  ok(/Nuevas en 24 h a 5 km\s+3\s+Hay que actuar/.test(pul) && /Publicaciones vivas a 5 km\s+42\s+Bien/.test(pul), `${n}: rojo y verde según §5.2`);
  ok(/En revisión[^\n]*30 h[^\n]*\s+1\s+Hay que actuar/.test(pul), `${n}: revisión de más de 24 h, en rojo`);
  ok(/Días sin eventos en los próximos 14\s+2\s+Hay que actuar/.test(pul), `${n}: días sin eventos, en rojo`);
  await p.click('[data-verificar]');
  await p.waitForSelector('#modal button[type=submit]');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(600);
  const c = estado.llamadas.find(([f]) => f === 'admin_set_verification');
  ok(c && c[1].p_id === BIZ && c[1].p_status === 'verified', `${n}: verificar en dos toques ${JSON.stringify(c)}`);
  ok(errores.length === 0, `${n}: admin sin errores JS ${errores.join(' | ')}`);
  await ctx.close();

  const s = await contexto(nav, { clave: `sb-${REF}-admin-auth-token`, rpc: ADMIN() });
  await s.p.goto(`${BASE}/admin/#/resumen`, { waitUntil: 'networkidle' });
  await s.p.waitForSelector('#porVerificar');
  ok(await s.p.locator('#pulso').count() === 0 && await s.p.locator('#porVerificar .qr-alta').count() === 1 && !/Por verificar ahora/.test(await s.p.locator('#porVerificar').innerText()), `${n}: sin las migraciones, solo el QR`);
  await s.ctx.close();
}

async function enlace(nav, n) {
  const a = await contexto(nav, { conSesion: false });
  await a.p.goto(`${BASE}/alta/`);
  await a.p.waitForURL(/\/cuenta\/registro\?.*para=negocio/);
  await a.p.waitForSelector('main form');
  ok(/Crea tu cuenta de negocio/.test(await a.p.locator('main').innerText()), `${n}: /alta sin sesión, «Crea tu cuenta de negocio»`);
  await a.ctx.close();
  const b = await contexto(nav, { rpc: PANEL({ my_businesses: [] }) });
  await b.p.goto(`${BASE}/alta/`);
  await b.p.waitForURL(/\/panel\/#\/alta/);
  await b.p.waitForSelector('#view h1, #view h2');
  ok(true, `${n}: /alta con sesión, al alta`);
  await b.ctx.close();
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  try {
    await sugerida(nav, nombre);
    await reglaFalla(nav, nombre);
    await idiomas(nav, nombre);
    await sinSugerencias(nav, nombre);
    await formulario(nav, nombre);
    await admin(nav, nombre);
    await enlace(nav, nombre);
  } catch (e) {
    fallos++;
    console.log(`FALLO (${nombre}):`, e.message);
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
