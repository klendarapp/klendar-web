// Prueba de «listas por partes» en la web local (docs/RUNBOOK.md §3g), con una
// sesión simulada (Supabase contestado aquí: no toca dev ni manda nada):
//
//  1. Panel › Resumen: las 8 últimas y «Ver todas (N) · M activas» con los
//     recuentos de la base.
//  2. Panel › Publicaciones: 24 y «Ver más» (cursor `created_at`, `id`), los
//     chips con los recuentos de la base y el CSV entero, parte a parte.
//  3. Panel › Calendario: el mes que se ve (`my_business_offers_range`).
//  4. Panel › Reseñas: media y «sin responder» de la base; «Ver más».
//  5. Panel › Cifras: canjes validados por partes y el total de la base.
//  6. Panel › Asistentes: cuentas de la base y la búsqueda en la base.
//  7. Tu cuenta › Notificaciones y Tus códigos: «Ver más».
//  8. Ficha pública (Functions de verdad contra un Supabase falso): 24
//     publicaciones por página con `?p=`, «Ver todas (N)» de novedades y
//     reseñas y sus listas (`?ver=`).
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PORT=8796 node tools/serve_dev.mjs &
//   BASE=http://localhost:8796 PW=<ruta a playwright> OUT=<carpeta> node tools/listas_check.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8796';
const OUT = process.env.OUT || '.';
const FICHA_PORT = Number(process.env.FICHA_PORT || 8797);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8798);
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-0000000011a5';
const BIZ = 'b1000000-0000-4000-8000-0000000011a5';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'listas@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hace = (min) => new Date(Date.now() - min * 6e4).toISOString();

// Publicaciones inventadas: 40 (la 1, la más nueva), una por minuto.
const PUBS = Array.from({ length: 40 }, (_, i) => ({
  id: uuid(i + 1), kind: i % 3 ? 'flash_offer' : 'future_event', title: `Publicación ${i + 1}`,
  status: 'active', moderation_status: 'approved', panel_state: 'activa', created_at: hace(i + 1),
  redeem_start_at: hace(-60), redeem_end_at: hace(-180), event_at: hace(-600), images: [], views: i, redemptions_count: 0,
  audience: 'all',
}));
const pagina = (lista, args, campo = 'created_at') => {
  let desde = 0;
  if (args.p_before) desde = lista.findIndex((x) => x.id === args.p_before_id) + 1;
  return lista.slice(desde, desde + (args.p_limit || 24));
};

function supabaseFalso(estado) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (body, status = 200, extra = {}) => route.fulfill({ status, contentType: 'application/json', headers: extra, body: JSON.stringify(body) });
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
    if (p.startsWith('/rest/v1/notifications')) {
      estado.llamadas.push(['notifications', Object.fromEntries(url.searchParams)]);
      if (req.method === 'HEAD' || url.searchParams.get('select') === 'id') return json([], 200, { 'content-range': '0-0/45' });
      const otra = url.searchParams.get('or');
      const todas = Array.from({ length: 45 }, (_, i) => ({ id: uuid(500 + i), kind: 'favorite_offer', title: `Aviso ${i + 1}`, body: 'Algo nuevo', route: null, data: {}, read_at: i > 2 ? hace(1) : null, created_at: hace(i + 1) }));
      if (!otra) return json(todas.slice(0, 30));
      return json(todas.slice(30));
    }
    if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, time_zone: 'Europe/Madrid', logo_url: null, cover_image_url: null, gallery: [] }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, vp, rpc) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid', acceptDownloads: true });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
  const estado = { llamadas: [], rpc };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}
const llamadas = (estado, fn) => estado.llamadas.filter(([f]) => f === fn).map(([, b]) => b);

const PANEL = (x = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: 'Bar Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
  business_is_organizer: false,
  my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
  business_tools_overview: { ok: true, can_edit: true, team: { members: 1 }, series: { rules_active: 0 } },
  my_business_offers_page: (a) => pagina(PUBS, a),
  // Como la base (migración 20261240400000 de la app): el chip «Activas»
  // cuenta `activas` (activa + agotada); el resumen, `activa`.
  my_business_offer_counts: { total: 41, todas: 40, activa: 37, activas: 37, terminada: 3, archivada: 1 },
  my_business_offer: (a) => PUBS.filter((o) => o.id === a.p_id),
  business_stats: { views_30d: 10, redemptions_30d: 2 },
  my_subscription: { status: 'active', plan_slug: 'pro' },
  ...x,
});

async function panelResumen(nav, n, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, PANEL());
  await p.goto(`${BASE}/panel/#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForSelector('a.link[href="#/publicaciones"]', { state: 'attached' });
  const v = await p.locator('#view').innerText();
  ok(/Ver todas \(40\) · 37 activas/.test(v), `${n}/${t} resumen: «Ver todas (40) · 37 activas» de la base`);
  ok(llamadas(estado, 'my_business_offers_page').some((a) => a.p_limit === 8), `${n}/${t} resumen: pide solo 8`);
  ok(!llamadas(estado, 'my_business_offers').length, `${n}/${t} resumen: ya no pide todas`);
  ok(errores.length === 0, `${n}/${t} resumen sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function panelPublicaciones(nav, n, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, PANEL());
  await p.goto(`${BASE}/panel/#/publicaciones`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-ver-mas="pubs"]');
  ok(await p.locator('.pub-item').count() === 24, `${n}/${t} publicaciones: las 24 primeras`);
  ok(/Activas\s*37/.test(await p.locator('#filtroArch').innerText()), `${n}/${t} publicaciones: los chips con los recuentos de la base`);
  await p.screenshot({ path: `${OUT}/web-panel-publicaciones-${n}-${t}.png`, fullPage: false });
  await p.click('[data-ver-mas="pubs"]');
  await p.waitForFunction(() => document.querySelectorAll('.pub-item').length === 40);
  const seg = llamadas(estado, 'my_business_offers_page').pop();
  ok(seg.p_before === PUBS[23].created_at && seg.p_before_id === PUBS[23].id, `${n}/${t} publicaciones: «Ver más» con el cursor de la última`);
  ok(await p.locator('[data-ver-mas="pubs"]').count() === 0, `${n}/${t} publicaciones: sin «Ver más» al acabar`);
  const descarga = p.waitForEvent('download');
  await p.click('#csv');
  await descarga;
  ok(llamadas(estado, 'my_business_offers_page').some((a) => a.p_status === 'cualquiera' && a.p_limit === 100), `${n}/${t} publicaciones: el CSV las pide todas, parte a parte`);
  ok(errores.length === 0, `${n}/${t} publicaciones sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function panelCalendario(nav, n, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, PANEL({
    my_business_offers_range: () => PUBS.slice(0, 3).map((o) => ({ ...o, redeem_start_at: new Date().toISOString() })),
    my_business_offer_next_day: null,
  }));
  await p.goto(`${BASE}/panel/#/calendario`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.cal-mes');
  const r = llamadas(estado, 'my_business_offers_range')[0];
  ok(r && /^\d{4}-\d{2}-01$/.test(r.p_from), `${n}/${t} calendario: pide el mes (${r && r.p_from}–${r && r.p_to})`);
  await p.click('[data-mes="1"]');
  await p.waitForTimeout(500);
  ok(llamadas(estado, 'my_business_offers_range').length === 2, `${n}/${t} calendario: el mes siguiente, al ir a él`);
  ok(errores.length === 0, `${n}/${t} calendario sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const RESENAS = Array.from({ length: 30 }, (_, i) => ({ id: uuid(100 + i), rating: 1 + (i % 5), comment: `Reseña ${i + 1}`, created_at: hace(i + 1), user_id: uuid(900), display_name: 'Ana', reply: i % 2 ? 'Gracias' : null }));
async function panelResenas(nav, n, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, PANEL({
    business_reviews: (a) => pagina(RESENAS, a),
    business_review_summary: { count: 120, avg: 4.2, unanswered: 35 },
  }));
  await p.goto(`${BASE}/panel/#/resenas`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.resumen-resenas');
  const v = await p.locator('.resumen-resenas').innerText();
  ok(/4,2 de media · 120 reseñas/.test(v) && /35 sin responder/.test(v), `${n}/${t} reseñas: media y «sin responder» de la base (${v.replace(/\s+/g, ' ')})`);
  ok(await p.locator('#resenasLista > article').count() === 20, `${n}/${t} reseñas: las 20 primeras`);
  await p.click('[data-ver-mas="resenas"]');
  await p.waitForFunction(() => document.querySelectorAll('#resenasLista > article').length === 30);
  ok(llamadas(estado, 'business_reviews').pop().p_before_id === RESENAS[19].id, `${n}/${t} reseñas: «Ver más» con el cursor`);
  await p.screenshot({ path: `${OUT}/web-panel-resenas-${n}-${t}.png`, fullPage: false });
  ok(errores.length === 0, `${n}/${t} reseñas sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const CANJES = Array.from({ length: 70 }, (_, i) => ({ id: uuid(200 + i), at: hace(i + 1), title: `Canje ${i + 1}`, kind: 'flash_offer', code: 'ABCDEF12', by: 'Marta', seats: 1 }));
async function panelCifras(nav, n, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, PANEL({
    business_report: { from: hace(30 * 1440), totals: { views: 10, codes: 70, redeemed: 70 }, redemptions_total: 70, redemptions: CANJES.slice(0, 70), offers: [], daily: [], by_hour: [] },
    business_redemptions_page: (a) => pagina(CANJES, a, 'at'),
  }));
  await p.goto(`${BASE}/panel/#/informe`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#canjesTabla', { state: 'attached' });
  await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  ok(await p.locator('#canjesTabla tbody tr').count() === 50, `${n}/${t} Cifras: los 50 primeros canjes`);
  await p.click('[data-ver-mas="canjes"]');
  await p.waitForFunction(() => document.querySelectorAll('#canjesTabla tbody tr').length === 70);
  ok(llamadas(estado, 'business_redemptions_page').pop().p_before_id === CANJES[49].id, `${n}/${t} Cifras: «Ver más» con el cursor`);
  ok(errores.length === 0, `${n}/${t} Cifras sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const ASIST = Array.from({ length: 60 }, (_, i) => ({ id: uuid(300 + i), code: `C0DE${String(i).padStart(4, '0')}`, user_name: i === 7 ? 'Lucía Prueba' : `Persona ${i}`, status: i < 10 ? 'validated' : 'pending', created_at: hace(i), seats: 1 }));
async function panelAsistentes(nav, n, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, PANEL({
    offer_attendees: (a) => (a.p_q ? ASIST.filter((x) => x.user_name.toLowerCase().includes(a.p_q.toLowerCase())) : ASIST.slice(a.p_offset, a.p_offset + a.p_limit)),
    offer_attendees_summary: { codes: 60, codes_in: 10, people: 60, people_in: 10 },
  }));
  await p.goto(`${BASE}/panel/#/asistentes/${PUBS[0].id}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#q');
  ok(/10 de 60 han entrado · 10 de 60 personas/.test(await p.locator('#view').innerText()), `${n}/${t} asistentes: las cuentas de la base`);
  ok(await p.locator('#list tbody tr').count() === 50, `${n}/${t} asistentes: los 50 primeros`);
  await p.fill('#q', 'lucía');
  await p.waitForFunction(() => document.querySelectorAll('#list tbody tr').length === 1);
  ok(llamadas(estado, 'offer_attendees').pop().p_q === 'lucía', `${n}/${t} asistentes: la búsqueda va a la base`);
  ok(errores.length === 0, `${n}/${t} asistentes sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const CUENTA = (x = {}) => ({ my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true }, my_businesses: [], ...x });
async function cuentaAvisos(nav, n, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, CUENTA({ mark_notifications_read: null }));
  await p.goto(`${BASE}/app/#/notificaciones`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-ver-mas="avisos"]');
  ok(await p.locator('#avisos .aviso').count() === 30, `${n}/${t} notificaciones: las 30 primeras`);
  await p.click('[data-ver-mas="avisos"]');
  await p.waitForFunction(() => document.querySelectorAll('#avisos .aviso').length === 45);
  ok(llamadas(estado, 'notifications').some((q) => /created_at\.lt\./.test(q.or || '')), `${n}/${t} notificaciones: «Ver más» con el cursor`);
  await p.screenshot({ path: `${OUT}/web-cuenta-notificaciones-${n}-${t}.png`, fullPage: false });
  ok(errores.length === 0, `${n}/${t} notificaciones sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const CODIGOS = Array.from({ length: 70 }, (_, i) => ({ id: uuid(400 + i), offer_id: uuid(1), offer_title: `Plan ${i + 1}`, business_id: BIZ, business_name: 'Bar Sonda', status: 'validated', code: 'ABCD1234', created_at: hace(i + 10), validated_at: hace(i + 5), expires_at: hace(i), seats: 1 }));
async function cuentaCodigos(nav, n, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, CUENTA({
    my_redemptions: (a) => CODIGOS.slice(a.p_offset || 0, (a.p_offset || 0) + (a.p_limit || 50)),
    my_birthday_gifts: [], my_loyalty_gifts: [], my_stamp_rewards: [], my_passes: [], my_queue_turns: [], my_spot_gifts: [],
  }));
  await p.goto(`${BASE}/app/#/codigos`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-ver-mas="codigos"]');
  const antes = await p.locator('#codigosPasados > *').count();
  await p.click('[data-ver-mas="codigos"]');
  await p.waitForFunction((a) => document.querySelectorAll('#codigosPasados > *').length > a, antes);
  ok(llamadas(estado, 'my_redemptions').some((a) => a.p_offset === 50), `${n}/${t} Tus códigos: «Ver más» pide los siguientes (${antes} → ${await p.locator('#codigosPasados > *').count()})`);
  ok(errores.length === 0, `${n}/${t} Tus códigos sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// ── La ficha pública, con las Functions de verdad ───────────────────────────
function supabaseFicha() {
  return createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; });
    req.on('end', () => {
      const json = (b) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
      let args = {};
      try { args = JSON.parse(cuerpo || '{}'); } catch { /* */ }
      const f = url.pathname.replace('/rest/v1/rpc/', '');
      if (f === 'business_profile') {
        return json([{ id: args.p_id, name: 'Bar Sonda', city: 'Madrid', address: 'Calle Mayor 1', lat: 40.4, lng: -3.7, is_verified: true, rating: 4.5, ratings: 40, posts: 15,
          member_since: '2026-01-01T00:00:00Z', time_zone: 'Europe/Madrid', social: {} }]);
      }
      if (f === 'business_offer_counts') return json({ flash: 10, events: 50, total: 60 });
      if (f === 'business_offers_page') {
        const todas = Array.from({ length: 60 }, (_, i) => ({ id: uuid(600 + i), business_id: BIZ, business_name: 'Bar Sonda', kind: i < 10 ? 'flash_offer' : 'future_event', title: `Plan ${i + 1}`,
          redeem_start_at: hace(10), redeem_end_at: hace(-120), event_at: hace(-1440 * (i + 1)), images: [], audience: 'all' }));
        return json(todas.slice(args.p_offset || 0, (args.p_offset || 0) + (args.p_limit || 24)));
      }
      if (f === 'business_reviews') return json(Array.from({ length: Math.min(args.p_limit || 12, 40 - (args.p_offset || 0)) }, (_, i) => ({ id: uuid(700 + i), rating: 4, comment: 'Bien', created_at: hace(i), display_name: 'Ana' })));
      if (url.pathname.startsWith('/rest/v1/business_posts')) {
        const lim = Number(url.searchParams.get('limit') || 6);
        const off = Number(url.searchParams.get('offset') || 0);
        return json(Array.from({ length: Math.max(0, Math.min(lim, 15 - off)) }, (_, i) => ({ id: uuid(800 + off + i), body: `Novedad ${off + i + 1}`, created_at: hace(off + i) })));
      }
      if (f === 'resolve_business_slug') return json({ id: BIZ, slug: 'bar-sonda-madrid' });
      return json([]);
    });
  });
}

async function ficha(nav, n, t, vp) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`http://localhost:${FICHA_PORT}/b/bar-sonda-madrid`, { waitUntil: 'networkidle' });
  let v = await p.locator('main').innerText();
  ok(/Página 1\/3/.test(v) && /Ofertas\s*10/.test(v) && /Eventos\s*50/.test(v), `${n}/${t} ficha: chips con los recuentos y «Página 1/3»`);
  ok(await p.locator('.d-body .tj, .d-body [data-o]').count() > 0, `${n}/${t} ficha: con publicaciones`);
  ok(await p.locator('a[href$="?ver=novedades"]').count() === 1 && /Ver todas \(15\)/.test(v), `${n}/${t} ficha: «Ver todas (15)» de las novedades`);
  await p.screenshot({ path: `${OUT}/web-ficha-pagina1-${n}-${t}.png`, fullPage: false });
  await p.click('a[rel="next"]');
  await p.waitForLoadState('networkidle');
  v = await p.locator('main').innerText();
  ok(/Página 2\/3/.test(v) && /\?p=2$/.test(p.url()), `${n}/${t} ficha: «Siguiente» lleva a ?p=2`);
  ok(await p.locator('meta[name="robots"][content*="noindex"]').count() === 1, `${n}/${t} ficha ?p=2: noindex, follow`);
  await p.goto(`http://localhost:${FICHA_PORT}/b/bar-sonda-madrid?ver=novedades`, { waitUntil: 'networkidle' });
  v = await p.locator('main').innerText();
  ok(/Novedades · Bar Sonda/.test(v) && (await p.locator('.novedades article').count()) === 15 && /Volver a la ficha/.test(v), `${n}/${t} ficha ?ver=novedades: la lista entera`);
  await p.screenshot({ path: `${OUT}/web-ficha-novedades-${n}-${t}.png`, fullPage: false });
  ok(errores.length === 0, `${n}/${t} ficha sin errores JS ${errores.join(' | ')}`);
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

const PRUEBAS = { panelResumen, panelPublicaciones, panelCalendario, panelResenas, panelCifras, panelAsistentes, cuentaAvisos, cuentaCodigos, ficha };
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
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
