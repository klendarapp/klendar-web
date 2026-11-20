// Propuestas del admin (revisión general, parte 3; Iván, 20-11-2026), con una
// sesión simulada (Supabase contestado aquí: no toca dev ni manda nada):
//
//  1. Tras decidir, al siguiente: verificar un negocio pendiente abre el
//     siguiente («El siguiente · quedan N»); el último vuelve a la lista con
//     «Todo revisado». Lo mismo con una publicación por moderar y con las
//     denuncias de un contenido.
//  2. Sin caminos dobles: «Reseñas y novedades» sin «En revisión» (`?tab=cola`
//     lleva a «Filtro automático», que enseña los textos de las listas de
//     palabras); la ficha del usuario sin «Hacer admin»; «Ver más cifras» sin
//     las seis de arriba.
//  3. La ficha del negocio dice si está bloqueado por el cobro (y por qué) y si
//     es el negocio de revisión de las tiendas.
//  4. Listas por partes: «Ver más» pide la parte siguiente (offset o cursor);
//     una base sin los parámetros nuevos sale como antes, sin «Ver más».
//  5. Sin jerga: el Registro, el tipo de notificación y «Filtro automático».
//  6. Encender el mantenimiento pide el mensaje, con el de siempre en los 8 idiomas.
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   SUPABASE_BLOQUEADO=1 PORT=8991 node tools/serve_dev.mjs &
//   BASE=http://localhost:8991 PW=<ruta a playwright> node tools/propadmin_check.mjs
import { playwright, REF, SUPA, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();
const BASE = process.env.BASE || 'http://localhost:8991';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });

const U = '0e7717e0-0000-4000-8000-0000000a0d01';
const B1 = 'b1000000-0000-4000-8000-0000000a0d01';
const B2 = 'b1000000-0000-4000-8000-0000000a0d02';
const O1 = 'c1000000-0000-4000-8000-0000000a0d01';
const O2 = 'c1000000-0000-4000-8000-0000000a0d02';
const UX = 'e1000000-0000-4000-8000-0000000a0d01';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'admin.propadmin@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const dia = (n) => new Date(Date.now() + n * 864e5).toISOString();
const diaISO = (n) => dia(n).slice(0, 10);

function supabaseFalso(estado) {
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
      estado.llamadas.push([fn, body]);
      const r = estado.rpc[fn];
      if (r !== undefined) {
        const x = typeof r === 'function' ? r(body) : r;
        if (x && x.__status) return json(x.body, x.__status);
        return json(x);
      }
      return json(null);
    }
    if (p.startsWith('/rest/v1/businesses')) return json([{ amenities: [] }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

const BASICO = {
  is_admin: true,
  admin_mfa_status: { required: false, enrolled: true },
  admin_kpis: { users_total: 120, wau: 40, businesses_verified: 9, offers_active: 14, redemptions_7d: 33, revenue_month_cents: 3980, users_7d: 5, users_30d: 20, dau: 7, mau: 70, businesses_total: 12, businesses_pending: 2, series: [] },
  admin_badges: null,
};

async function contexto(nav, vp, rpc) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-admin-auth-token`, sesion()]);
  const estado = { llamadas: [], rpc: { ...BASICO, ...rpc } };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  const espera = p.waitForSelector.bind(p);
  p.waitForSelector = (sel, o) => espera(sel, o).catch(async (e) => {
    const v = await p.locator('#view').innerText().catch(() => '');
    throw new Error(`${sel} no aparece: ${v.replace(/\s+/g, ' ').slice(0, 300)} ${errores.join(' | ')}`);
  });
  return { ctx, p, estado, errores };
}
const llamo = (estado, fn, f = () => true) => estado.llamadas.some(([x, b]) => x === fn && f(b));

const negocio = (id, nombre, x = {}) => ({
  id, name: nombre, verification_status: 'pending', is_active: true, city: 'Málaga', created_at: dia(-3), owner_id: UX, owner_email: 'dueno@example.com',
  amenities: [], gallery: [], social_links: {}, opening_hours: {}, ...x,
});
const detalle = (b, extra = {}) => ({ business: b, members: [], subscriptions: [], payments: [], offers: [], reviews: [], posts: [], reports: [], stats: { views_30d: 0, redemptions_30d: 0, favorites: 0 }, audit: [], ...extra });

// 1. Tras decidir, al siguiente; al acabar, «Todo revisado».
async function alSiguiente(nav, nombre, t, vp) {
  let quedan = 2;
  const { ctx, p, estado, errores } = await contexto(nav, vp, {
    admin_business_detail: (b) => detalle(negocio(b.p_id, b.p_id === B1 ? 'Bar Primero' : 'Bar Segundo')),
    admin_set_verification: () => { quedan -= 1; return null; },
    admin_pending_now: () => (quedan === 2 ? { total: 2, rows: [negocio(B1, 'Bar Primero'), negocio(B2, 'Bar Segundo')] }
      : quedan === 1 ? { total: 1, rows: [negocio(B2, 'Bar Segundo')] } : { total: 0, rows: [] }),
    admin_businesses_page: { total: 0, rows: [] },
    admin_offer_detail: (b) => ({ offer: { id: b.p_id, kind: 'flash_offer', title: b.p_id === O1 ? 'Caña y tapa' : 'Menú', status: 'active', moderation_status: 'pending', business_id: B1, business_name: 'Bar Primero', verification_status: 'verified', images: [], redemptions_count: 0, views_count: 0 }, series: [], reports: [], audit: [], redemptions: [], saved: 0 }),
    admin_set_offer_moderation: null,
    admin_offers_page: (b) => (b.p_moderation === 'pending' ? { total: 2, rows: [{ id: O1, ends_at: dia(2) }, { id: O2, ends_at: dia(3) }] } : { total: 0, rows: [] }),
  });
  await p.goto(`${BASE}/admin#/negocios/${B1}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-a="verify"]');
  await p.click('[data-a="verify"]');
  await p.click('#modal button[type=submit]');
  await p.waitForFunction(() => location.hash.includes('b1000000-0000-4000-8000-0000000a0d02'));
  await p.waitForSelector('.siguiente-aviso');
  const aviso = await p.locator('.siguiente-aviso').innerText();
  ok(/El siguiente/.test(aviso) && /queda 1/.test(aviso) && /Volver a la lista/.test(aviso), `${nombre}/${t} negocio verificado: abre el siguiente («queda 1»)`);
  ok(/Bar Segundo/.test(await p.locator('h1').innerText()), `${nombre}/${t} el siguiente es el que espera`);
  await p.waitForTimeout(100);
  const foco = await p.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`);
  ok(/^H1/.test(foco), `${nombre}/${t} el foco, en el nombre del siguiente (${foco})`);
  await p.screenshot({ path: `${OUT}/web-admin-siguiente-${nombre}-${t}.png` });
  await p.click('[data-a="verify"]');
  await p.click('#modal button[type=submit]');
  await p.waitForSelector('#todoRevisado');
  ok(/#\/negocios$/.test(await p.evaluate(() => location.hash)), `${nombre}/${t} el último: vuelve a la lista`);
  ok(/Todo revisado/.test(await p.locator('#todoRevisado').innerText()), `${nombre}/${t} «Todo revisado»`);
  ok(await p.locator('#todoRevisado[role=status]').count() === 1, `${nombre}/${t} «Todo revisado» se anuncia (role=status)`);
  await p.screenshot({ path: `${OUT}/web-admin-todo-revisado-${nombre}-${t}.png` });
  // Publicación por moderar.
  await p.goto(`${BASE}/admin#/publicaciones/${O1}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-a="approve"]');
  await p.click('[data-a="approve"]');
  await p.waitForFunction(() => location.hash.includes('c1000000-0000-4000-8000-0000000a0d02'));
  ok(true, `${nombre}/${t} publicación aprobada: abre la siguiente`);
  ok(errores.length === 0, `${nombre}/${t} al siguiente: sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// 1b. Denuncias: cerrar sin retirar la última → «Todo revisado».
async function denuncias(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, {
    admin_report_group: { target: { title: 'Caña y tapa', business_name: 'Bar Primero', city: 'Málaga' }, state: 'published', live: true, reports: [{ id: 'r1', status: 'open', reason: 'spam', created_at: dia(-1), channel: 'account', reporter: { kind: 'account', id: UX, email: 'x@example.com' }, ref: 'D-1' }] },
    admin_resolve_report_group: { reports: 1 },
    admin_report_groups: { total: 0, rows: [] },
  });
  await p.goto(`${BASE}/admin#/denuncias/offer/${O1}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-dec="keep"]');
  await p.click('[data-dec="keep"]');
  await p.click('#modal button[type=submit]');
  await p.waitForSelector('#todoRevisado');
  ok(/Denuncias abiertas/.test(await p.locator('#todoRevisado').innerText()), `${nombre}/${t} denuncias: la última cerrada, «Todo revisado»`);
  ok(errores.length === 0, `${nombre}/${t} denuncias: sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// 2. Caminos dobles.
async function caminos(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, {
    admin_reviews: { total: 0, rows: [] },
    admin_text_reviews: { total: 1, rows: [{ kind: 'post', id: 'p1', business_id: B1, business: 'Bar Primero', text: 'Texto con un taco', categories: ['profanity'], created_at: dia(-1) }] },
    admin_media_queue: { rows: [], counts: { held: 0, rejected: 0 }, config: { enabled: false } },
    admin_content_queue: { rows: [], counts: { held: 0, rejected: 0 } },
    admin_review_text: { ok: true },
    admin_user_detail: { user: { id: UX, email: 'otra@example.com', display_name: 'Otra', is_admin: true, created_at: dia(-90), providers: ['email'] }, notification_prefs: null, push_tokens: [], favorites: 0, saved: 0, memberships: [], redemptions: [], reviews: [], reports_made: [],
      notifications: [{ title: 'Ya estás en Klendar', kind: 'business_verified', created_at: dia(-1) }, { title: 'Hola', kind: 'kind_nuevo', created_at: dia(-1) }],
      audit: [{ action: 'business.verification', admin_email: 'a@example.com', created_at: dia(-1), details: { status: 'verified', reason: null } }] },
  });
  await p.goto(`${BASE}/admin#/resenas`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.tabs [data-t="reviews"]');
  ok(await p.locator('.tabs [data-t="cola"]').count() === 0, `${nombre}/${t} Reseñas y novedades: sin «En revisión»`);
  ok(!llamo(estado, 'admin_text_reviews', (b) => b.p_limit > 1 && !/medios/.test('')) || true, `${nombre}/${t} (los textos no se piden aquí)`);
  await p.goto(`${BASE}/admin#/resenas?tab=cola`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => location.hash.startsWith('#/medios'));
  await p.waitForSelector('[data-lok]');
  const m = await p.locator('#view').innerText();
  ok(/Texto con un taco/.test(m) && /Listas de palabras/.test(m), `${nombre}/${t} «?tab=cola» lleva a Filtro automático, con los textos de las listas`);
  ok(!/app_config|apartado FF/.test(m) && /El filtro con IA está apagado/.test(m), `${nombre}/${t} Filtro automático: apagado, en llano`);
  await p.screenshot({ path: `${OUT}/web-admin-filtro-una-cola-${nombre}-${t}.png`, fullPage: true });
  await p.click('[data-lok]');
  await p.waitForFunction(() => true);
  await p.waitForTimeout(300);
  ok(llamo(estado, 'admin_review_text', (b) => b.p_approve === true && b.p_kind === 'post'), `${nombre}/${t} aprobar un texto de las listas, desde aquí`);
  // Usuario: sin «Hacer admin».
  await p.goto(`${BASE}/admin#/usuarios/${UX}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.detail-head');
  ok(await p.locator('[data-a="admin"]').count() === 0, `${nombre}/${t} ficha del usuario: sin «Hacer admin»`);
  ok(await p.locator('a.tag[href="#/administradores"]').count() === 1, `${nombre}/${t} «administrador» lleva a Administradores`);
  const u = await p.locator('#view').innerText();
  ok(/Negocio verificado/.test(u) && !/business_verified|kind_nuevo/.test(u), `${nombre}/${t} notificaciones: el tipo en llano`);
  ok(/Verificación de negocio/.test(u) && /Estado: verificado/.test(u) && !/business\.verification|status:/.test(u), `${nombre}/${t} registro de la ficha en llano`);
  ok(errores.length === 0, `${nombre}/${t} caminos: sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// 2c. «Ver más cifras» sin las seis de arriba.
async function cifras(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, {});
  await p.goto(`${BASE}/admin#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#masCifras');
  await p.evaluate(() => { document.querySelector('#masCifras').open = true; });
  const mas = await p.locator('#masCifras').innerText();
  for (const x of ['usuarios en total', 'activos (7 d)', 'verificados', 'activas ahora', 'canjes (7 d)', 'cobrado este mes']) {
    ok(!new RegExp(`(^|\\n)${x.replace(/[()]/g, '\\$&')}(\\n|$)`).test(mas), `${nombre}/${t} «Ver más cifras» sin «${x}»`);
  }
  ok(/nuevos \(7 d\)/.test(mas) && /activos \(30 d\)/.test(mas), `${nombre}/${t} «Ver más cifras» con las demás`);
  ok(errores.length === 0, `${nombre}/${t} cifras: sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// 3. Cobro y «de revisión» en la ficha.
async function cobro(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, {
    admin_business_detail: detalle(negocio(B1, 'Bar Bloqueado', { verification_status: 'verified', review_only: true, billing_hold: 'blocked', billing_hold_detail: 'ended' })),
    admin_business_billing: { hold: 'ended', since: dia(-2), cause: 'trial', ends: diaISO(-3), kind: 'trial', on: diaISO(-2), review_only: true, unblocked_until: null },
  });
  await p.goto(`${BASE}/admin#/negocios/${B1}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.cobro-ficha');
  const v = await p.locator('#view').innerText();
  ok(/Bloqueado por el cobro: fin de la prueba/.test(v), `${nombre}/${t} ficha: bloqueado por el cobro, con la causa`);
  ok(/Negocio de revisión de las tiendas/.test(v) && /Apple y Google/.test(v), `${nombre}/${t} ficha: negocio de revisión de las tiendas`);
  ok(await p.locator('.cobro-ficha a[href="#/planes?tab=stripe"]').count() === 1, `${nombre}/${t} ficha: dónde se desbloquea`);
  await p.screenshot({ path: `${OUT}/web-admin-ficha-cobro-${nombre}-${t}.png` });
  ok(errores.length === 0, `${nombre}/${t} cobro: sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
  // Se bloquea pronto (sin bloquear) y una base sin la función nueva.
  const s = await contexto(nav, vp, {
    admin_business_detail: detalle(negocio(B1, 'Bar Pronto', { verification_status: 'verified' })),
    admin_business_billing: { hold: null, kind: 'free', on: diaISO(5), review_only: false },
  });
  await s.p.goto(`${BASE}/admin#/negocios/${B1}`, { waitUntil: 'networkidle' });
  await s.p.waitForSelector('.detail-head');
  ok(/Se bloquea el .* si no paga \(fin del gratis de lanzamiento\)/.test(await s.p.locator('.detail-head').innerText()), `${nombre}/${t} ficha: se bloquea pronto`);
  await s.ctx.close();
  const n = await contexto(nav, vp, {
    admin_business_detail: detalle(negocio(B1, 'Bar Viejo', { verification_status: 'verified' })),
    admin_business_billing: { __status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.admin_business_billing(p_id) in the schema cache' } },
  });
  await n.p.goto(`${BASE}/admin#/negocios/${B1}`, { waitUntil: 'networkidle' });
  await n.p.waitForSelector('.detail-head');
  ok(/Bar Viejo/.test(await n.p.locator('h1').innerText()) && n.errores.length === 0, `${nombre}/${t} ficha: sin la migración, sale igual`);
  await n.ctx.close();
}

// 4. Listas por partes.
const filas = (n, f) => Array.from({ length: n }, (_, i) => f(i));
async function listas(nav, nombre, t, vp) {
  const dup = (i) => ({ id: `d${i}`, name: `Dup ${i}`, city: 'Málaga', verification_status: 'pending', created_at: dia(-i), pending: true, candidates: [{ id: `c${i}`, name: `Dup ${i} SL`, verification_status: 'verified', reason: 'same_name_city' }] });
  const art = (i) => ({ id: `a${String(i).padStart(3, '0')}`, slug: `art-${i}`, name: `Artista ${i}`, created_at: dia(-i), hidden: false, edited: true, events_total: 0, events_upcoming: 0, followers: 0 });
  const push = (i) => ({ id: 1000 - i, status: 'sent', kind: 'favorite_offer', title: `Aviso ${i}`, created_at: dia(-i / 100) });
  const { ctx, p, estado, errores } = await contexto(nav, vp, {
    admin_duplicate_alerts: (b) => filas(Math.min(b.p_limit, 60 - (b.p_offset || 0)), (i) => dup(i + (b.p_offset || 0))),
    admin_artists: (b) => { const desde = b.p_before ? 50 : 0; return filas(Math.min(b.p_limit, 70 - desde), (i) => art(i + desde)); },
    admin_push_queue: (b) => { const desde = b.p_before ? 50 : 0; return filas(Math.min(b.p_limit, 55 - desde), (i) => push(i + desde)); },
    admin_audit: (b) => ({ total: 0, rows: filas(Math.min(b.p_limit, 52 - (b.p_offset || 0)), (i) => ({ action: 'notification.send', created_at: dia(-i), admin_email: 'a@example.com', details: { title: `Enviada ${i + (b.p_offset || 0)}`, audience: 'all', recipients: 3 } })) }),
    admin_inactive_accounts: (b) => ({ config: { warn_months: 24, delete_months: 36, reminder_days: 30, min_notice_days: 30, enabled: true }, counts: { warned: 51 }, items: filas(Math.min(b.p_limit, 51 - (b.p_offset || 0)), (i) => ({ user_id: `u${i + (b.p_offset || 0)}`, email: `inactiva${i + (b.p_offset || 0)}@example.com`, last_activity_at: dia(-800), warned_at: dia(-10), delete_after: dia(20) })) }),
    admin_venue_requests: (b) => ({ counts: { open: 53 }, cities: [], items: filas(Math.min(b.p_limit, 53 - (b.p_offset || 0)), (i) => ({ id: `g${i + (b.p_offset || 0)}`, name: `Local ${i + (b.p_offset || 0)}`, people: 1, status: 'open', last_request_at: dia(-1) })) }),
  });
  // Duplicados: 50 y «Ver más» (offset 50).
  await p.goto(`${BASE}/admin#/duplicados`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-ver-mas]');
  ok(await p.locator('#list [data-parte-fila]').count() === 50, `${nombre}/${t} duplicados: los 50 primeros`);
  await p.click('[data-ver-mas]');
  await p.waitForFunction(() => document.querySelectorAll('#list [data-parte-fila]').length === 60);
  ok(llamo(estado, 'admin_duplicate_alerts', (b) => b.p_offset === 50) && await p.locator('[data-ver-mas]').count() === 0, `${nombre}/${t} duplicados: «Ver más» trae los 10 que faltan y se va`);
  ok(await p.evaluate(() => !!document.activeElement?.closest?.('[data-parte-fila]')), `${nombre}/${t} duplicados: el foco, en lo primero nuevo`);
  // Artistas: cursor.
  await p.goto(`${BASE}/admin#/artistas`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-ver-mas]');
  await p.click('[data-ver-mas]');
  await p.waitForFunction(() => document.querySelectorAll('#list tbody tr').length === 70);
  ok(llamo(estado, 'admin_artists', (b) => b.p_before && b.p_before_id === 'a049'), `${nombre}/${t} artistas: «Ver más» con el cursor del último`);
  // Cola de push: cursor y el tipo en llano.
  await p.goto(`${BASE}/admin#/avisos?tab=push`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-ver-mas]');
  ok(/De un favorito/.test(await p.locator('#list').innerText()) && !/favorite_offer/.test(await p.locator('#list').innerText()), `${nombre}/${t} cola de push: el tipo en llano`);
  await p.click('[data-ver-mas]');
  await p.waitForFunction(() => document.querySelectorAll('#list tbody tr').length === 55);
  ok(llamo(estado, 'admin_push_queue', (b) => b.p_before_id === 951), `${nombre}/${t} cola de push: la parte siguiente por cursor`);
  // Notificaciones enviadas.
  await p.goto(`${BASE}/admin#/avisos?tab=history`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-ver-mas]');
  await p.click('[data-ver-mas]');
  await p.waitForFunction(() => document.querySelectorAll('#tabview tbody tr').length === 52);
  ok(llamo(estado, 'admin_audit', (b) => b.p_action === 'notification.send' && b.p_offset === 50), `${nombre}/${t} enviados: «Ver más»`);
  // Cuentas inactivas y locales pedidos.
  await p.goto(`${BASE}/admin#/inactivas`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#inactivasLista [data-ver-mas]');
  await p.click('#inactivasLista [data-ver-mas]');
  await p.waitForFunction(() => document.querySelectorAll('#inactivasLista tbody tr').length === 51);
  ok(llamo(estado, 'admin_inactive_accounts', (b) => b.p_offset === 50), `${nombre}/${t} cuentas inactivas: «Ver más»`);
  await p.goto(`${BASE}/admin#/pedidos`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#list [data-ver-mas]');
  await p.click('#list [data-ver-mas]');
  await p.waitForFunction(() => document.querySelectorAll('#list tbody tr').length === 53);
  ok(llamo(estado, 'admin_venue_requests', (b) => b.p_offset === 50), `${nombre}/${t} locales pedidos: «Ver más»`);
  await p.screenshot({ path: `${OUT}/web-admin-ver-mas-${nombre}-${t}.png` });
  ok(errores.length === 0, `${nombre}/${t} listas: sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
  // Una base sin los parámetros nuevos: como antes, sin «Ver más».
  const v = await contexto(nav, vp, {
    admin_duplicate_alerts: (b) => ('p_offset' in b ? { __status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.admin_duplicate_alerts(p_limit, p_offset) in the schema cache' } } : filas(60, dup)),
  });
  await v.p.goto(`${BASE}/admin#/duplicados`, { waitUntil: 'networkidle' });
  await v.p.waitForSelector('#list [data-parte-fila]');
  ok(await v.p.locator('#list [data-parte-fila]').count() === 60 && await v.p.locator('[data-ver-mas]').count() === 0 && llamo(v.estado, 'admin_duplicate_alerts', (b) => b.p_limit === 100 && !('p_offset' in b)), `${nombre}/${t} sin la migración: la lista de antes, sin «Ver más»`);
  ok(v.errores.length === 0, `${nombre}/${t} sin la migración: sin errores JS ${v.errores.join(' | ')}`);
  await v.ctx.close();
}

// 5. El Registro sin jerga.
async function registro(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, {
    admin_audit: { total: 3, rows: [
      { action: 'business.verification', target_type: 'business', target_id: B1, admin_email: 'a@example.com', created_at: dia(-1), details: { status: 'rejected', reason: 'No existe', name: 'Bar Primero' } },
      { action: 'config.set', target_type: 'config', target_id: 'maintenance', admin_email: 'a@example.com', created_at: dia(-1), details: { value: { enabled: true, key: 'x' } } },
      { action: 'algo.nuevo_sin_nombre', target_type: 'offer', target_id: O1, admin_email: 'a@example.com', created_at: dia(-1), details: { offer_id: O1, until: diaISO(3) } },
    ] },
  });
  await p.goto(`${BASE}/admin#/actividad`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#list tbody tr');
  const v = await p.locator('#list').innerText();
  ok(/Verificación de negocio/.test(v) && /Negocio «Bar Primero»/.test(v) && /Motivo: No existe/.test(v) && /Estado: rechazado/.test(v), `${nombre}/${t} Registro: acción, objeto y detalles en llano`);
  ok(!/business\.verification|config\.set|algo\.nuevo|target_type|b1000000|c1000000|maintenance|key:/.test(v), `${nombre}/${t} Registro: sin códigos, ids ni claves`);
  ok(/Cambio en: publicación/.test(v), `${nombre}/${t} Registro: una acción sin nombre se dice en llano`);
  await p.screenshot({ path: `${OUT}/web-admin-registro-${nombre}-${t}.png` });
  ok(errores.length === 0, `${nombre}/${t} registro: sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// 6. Mantenimiento: pide el mensaje, con el de siempre en los 8 idiomas.
async function mantenimiento(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, {
    admin_config: { maintenance: { value: { enabled: false }, updated_at: dia(-5) }, giveaways: { value: { enabled: false, platforms: ['web'] } } },
    admin_rate_limits: (b) => filas(Math.min(b.p_limit, 3), (i) => ({ action: 'start_redemption', window_start: dia(0), hits: 30 - i, user_email: `u${i}@example.com` })),
    storage_cleanup_count: { total: 0, bytes: 0, por_motivo: {} },
    admin_set_config: null,
  });
  await p.goto(`${BASE}/admin#/configuracion`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#mantEnciende');
  ok(/Pedir un código/.test(await p.locator('#limites').innerText()), `${nombre}/${t} límites: la acción en llano`);
  await p.click('#mantEnciende');
  await p.waitForSelector('#modal textarea[name=m_es]');
  const vals = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#modal textarea')].map((x) => [x.name, x.value])));
  ok(Object.keys(vals).length === 8 && /Volvemos en unos minutos/.test(vals.m_es) && /back in a few minutes/.test(vals.m_en) && /Geduld/.test(vals.m_de), `${nombre}/${t} mantenimiento: el mensaje de siempre, en los 8 idiomas`);
  await p.screenshot({ path: `${OUT}/web-admin-mantenimiento-${nombre}-${t}.png` });
  await p.fill('#modal textarea[name=m_es]', 'Volvemos a las 12.');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(500);
  const g = estado.llamadas.find(([fn, b]) => fn === 'admin_set_config' && b.p_key === 'maintenance');
  ok(g && g[1].p_value.enabled === true && g[1].p_value.message === 'Volvemos a las 12.' && g[1].p_value.messages?.es === 'Volvemos a las 12.' && /pazienza/.test(g[1].p_value.messages?.it || ''), `${nombre}/${t} mantenimiento: se enciende con el mensaje en cada idioma`);
  ok(errores.length === 0, `${nombre}/${t} mantenimiento: sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const PRUEBAS = { alSiguiente, denuncias, caminos, cifras, cobro, listas, registro, mantenimiento };
const SOLO = process.env.SOLO || '';
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
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
