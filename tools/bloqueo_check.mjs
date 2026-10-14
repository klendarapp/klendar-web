// Prueba del bloqueo sin pago y de la pausa por cierre en la web local, con
// una sesión simulada (Supabase contestado aquí: no toca dev ni manda nada).
//
//  1. Panel bloqueado (propietario): el menú solo lleva Resumen, Validar
//     códigos, Tu plan y Dar de baja; el resumen, el aviso con «Pagar»
//     (coral, a «Tu plan»), «Validar códigos», descargar los datos y darse de
//     baja; cualquier otra pantalla vuelve al resumen; «Tu plan» con el pago
//     (tarjeta o domiciliación) y, en Canarias, sin IVA y con su nota.
//  2. Panel bloqueado (encargado): sin «Pagar», «Solo el propietario…».
//  3. Panel en pausa por cierre: «Cerrado temporalmente hasta el…» y «Volver
//     a abrir» (manda `resume` a la Edge Function `billing`).
//  4. Se bloquea pronto: un aviso arriba con «Pagar»; un recibo devuelto, con
//     «Escribir a soporte».
//  5. «Pausar el plan…»: sin fecha (`days: null`) y hasta un día (`days`).
//  6. Admin, «Planes y pagos → Cobro con tarjeta»: bloqueados y en pausa,
//     «Se bloquean pronto», «Desbloquear hasta…», «Comprobar ahora» y los
//     ajustes (bloqueo, pausa, formas de pago, IVA no sujeto).
//  7. La ficha pública (`/b/<id>`, las Functions de verdad con un Supabase de
//     mentira): «No disponible ahora mismo» / «Cerrado temporalmente hasta
//     el…», sin publicaciones ni novedades y con `noindex`.
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PORT=8795 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> node tools/bloqueo_check.mjs
// (la ficha arranca su propio serve_dev en FICHA_PORT, 8796, contra un
// Supabase de mentira en 8797)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8795';
const OUT = process.env.OUT || '.';
const SOLO = process.env.SOLO || '';
const FICHA_PORT = Number(process.env.FICHA_PORT || 8796);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8797);
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-00000000b10c';
const BIZ = 'b1000000-0000-4000-8000-00000000b10c';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'bloqueo.prueba@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const hoy = () => new Date().toISOString().slice(0, 10);
const masDias = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

/** `billing` de `my_subscription` con lo de siempre y lo que cambie. */
const billing = (x = {}) => ({
  enabled: true, block_enabled: true, pause_enabled: true, provider: 'none', past_due_since: null, grace_until: null,
  hold: null, hold_since: null, blocked: false, block_kind: null, block_on: null, block_soon: false, processing: false,
  dispute: false, unblocked_until: null, interval: null, quantity: null, next_billing_at: null, next_amount_cents: null,
  cancel_at_period_end: false, ends_at: null, paused_until: null, paused_since: null, tax_region: 'peninsula', tax_exempt: false, ...x,
});
const NOMBRES = { es: 'Klendar', en: 'Klendar' };
const sub = (x = {}, b = {}) => ({
  plan_slug: 'standard', plan_names: NOMBRES, status: 'active', period_end: masDias(20), payment_method: 'transfer',
  price_cents: 1990, active_offers: 0, max_active_offers: null, has_analytics: true, boosts_included: 0, boosts_used: 0,
  ...x, billing: billing(b),
});
const PLANES = [{ slug: 'standard', names: NOMBRES, prices: {
  month: { tiers: [{ up_to: 1, unit_cents: 1990 }, { up_to: 5, unit_cents: 1500 }, { up_to: null, unit_cents: 1200 }], mode: 'graduated', currency: 'eur' },
  year: { tiers: [{ up_to: null, unit_cents: 19900 }], mode: 'graduated', currency: 'eur' },
} }];
const overview = (s, x = {}) => ({
  is_owner: true, ready: true, subscription: s, stripe: null, grace_days: 7, tax_mode: 'rate',
  tax_region: s.billing.tax_region, payment_methods: ['card', 'sepa_debit'], plans: PLANES,
  pause: { enabled: true, max_days: 183, min_days: 1, open: null },
  locales: [{ id: BIZ, name: 'Cafetería Prueba', city: 'Madrid', covered: false, blocked: s.billing.blocked, free_forever: false }],
  can_add_to: null, ...x,
});

/** Los casos del panel. */
const CASOS = {
  bloqueado: () => {
    const s = sub({ status: 'none', plan_slug: 'free', period_end: null, payment_method: null },
      { hold: 'ended', hold_since: `${hoy()}T08:00:00Z`, blocked: true, block_kind: 'trial', block_on: hoy(), tax_region: 'canarias', tax_exempt: true });
    return { role: 'owner', sub: s, ov: overview(s) };
  },
  encargado: () => {
    const s = sub({ status: 'none' }, { hold: 'unpaid', blocked: true, block_kind: 'unpaid', block_on: hoy() });
    return { role: 'manager', sub: s, ov: { ...overview(s), is_owner: false, plans: null, locales: null } };
  },
  pausa: () => {
    const s = sub({ status: 'paused' }, { hold: 'paused', blocked: true, block_kind: 'paused', paused_until: '2026-11-03T13:36:31Z', paused_since: `${hoy()}T08:00:00Z`, provider: 'manual' });
    return { role: 'owner', sub: s, ov: overview(s, { pause: { enabled: true, max_days: 183, min_days: 1, open: { since: `${hoy()}T08:00:00Z`, until: '2026-11-03T13:36:31Z', kind: 'manual' } } }) };
  },
  pronto: () => {
    const s = sub({ status: 'trial', period_end: masDias(4), payment_method: null }, { block_kind: 'trial', block_on: masDias(5), block_soon: true });
    return { role: 'owner', sub: s, ov: overview(s) };
  },
  devuelto: () => {
    const s = sub({ status: 'past_due', payment_method: 'stripe' }, { block_kind: 'dispute', block_on: masDias(3), block_soon: true, dispute: true, provider: 'stripe', past_due_since: `${hoy()}T08:00:00Z` });
    return { role: 'owner', sub: s, ov: overview(s, { stripe: { status: 'past_due', interval: 'month', quantity: 1, processing: false, dispute: true, businesses: [{ id: BIZ, name: 'Cafetería Prueba' }], invoice: null }, plans: PLANES }) };
  },
  pagado: () => {
    const s = sub({}, {});
    return { role: 'owner', sub: s, ov: overview(s) };
  },
};

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
    if (p.startsWith('/functions/v1/')) { estado.funciones.push([p.slice('/functions/v1/'.length), body]); return json({ ok: true, done: true }); }
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      estado.llamadas.push([fn, body]);
      const r = estado.rpc[fn];
      if (r !== undefined) return json(typeof r === 'function' ? r(body) : r);
      return json(null);
    }
    if (p.startsWith('/rest/v1/categories')) return json([]);
    if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, time_zone: 'Europe/Madrid', logo_url: null, cover_image_url: null, gallery: [] }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contextoPanel(nav, vp, caso, idioma = 'es') {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', l); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion(), idioma]);
  const c = CASOS[caso]();
  const estado = { llamadas: [], funciones: [], rpc: {} };
  Object.assign(estado.rpc, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: [{ id: BIZ, name: 'Cafetería Prueba', role: c.role, verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
    business_is_organizer: false,
    my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
    my_subscription: () => c.sub,
    billing_overview: () => c.ov,
    // Lo de gestión lo niega la base con el negocio parado.
    business_stats: c.sub.billing.blocked ? undefined : { redemptions_30d: 0 },
    my_business_offers: c.sub.billing.blocked ? undefined : [],
    business_tools_overview: { ok: true, can_edit: true, team: { members: 1 }, series: { rules_active: 0 } },
  });
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  return { ctx, p, estado, errores, c };
}

const texto = (p) => p.locator('#view').innerText();
const menu = (p) => p.locator('#nav').textContent();

async function panelBloqueado(nav, nombre, t, vp) {
  const { ctx, p, errores, estado } = await contextoPanel(nav, vp, 'bloqueado');
  const foto = (n, full = true) => p.screenshot({ path: `${OUT}/web-${n}-${nombre}-${t}.png`, fullPage: full });
  await p.goto(`${BASE}/panel/`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.aviso-parado');
  const v = await texto(p);
  ok(/Tu negocio está bloqueado/.test(v) && /Ha terminado tu prueba gratis/.test(v) && /No disponible ahora mismo/.test(v), `${nombre}/${t} bloqueado: el aviso y el motivo`);
  ok(/bonos vendidos, sellos, premios, códigos y sorteos abiertos/.test(v), `${nombre}/${t} bloqueado: explica lo que se respeta`);
  const pagar = p.locator('.aviso-parado a.btn.primary');
  ok(await pagar.count() === 1 && (await pagar.getAttribute('href')) === '#/plan' && /Pagar/.test(await pagar.innerText()), `${nombre}/${t} bloqueado: «Pagar» coral a «Tu plan»`);
  ok(await p.locator('[data-go=validar]').count() === 1 && await p.locator('[data-descarga]').count() === 2 && await p.locator('#view a[href="#/baja"]').count() === 1,
    `${nombre}/${t} bloqueado: validar, descargar los datos y darse de baja`);
  ok(!/Crear|Últimas publicaciones|Fidelizar/.test(v), `${nombre}/${t} bloqueado: nada de gestión en el resumen`);
  ok(!estado.llamadas.some(([fn]) => ['business_stats', 'my_business_offers'].includes(fn)), `${nombre}/${t} bloqueado: no pide lo de gestión`);
  const m = await menu(p);
  ok(/Validar códigos/.test(m) && /Tu plan/.test(m) && /Dar de baja el negocio/.test(m) && !/Publicaciones|Calendario|Fidelizar|RRPP|Equipo|Tu ficha/.test(m), `${nombre}/${t} bloqueado: el menú solo con lo que se puede (${m.replace(/\s+/g, ' ')})`);
  await foto('bloqueado-resumen');
  // Otra pantalla → al resumen.
  await p.goto(`${BASE}/panel/#/publicaciones`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.aviso-parado');
  ok(/#\/resumen$/.test(p.url()), `${nombre}/${t} bloqueado: #/publicaciones vuelve al resumen (${p.url()})`);
  await p.goto(`${BASE}/panel/#/ficha`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.aviso-parado');
  ok(/#\/resumen$/.test(p.url()), `${nombre}/${t} bloqueado: #/ficha vuelve al resumen`);
  // «Pagar» → «Tu plan».
  await p.click('.aviso-parado a.btn.primary');
  await p.waitForSelector('#plan-pagar');
  const plan = await texto(p);
  ok(/BLOQUEADO/.test(plan) && /Pagar el plan/.test(plan) && /domiciliación bancaria \(SEPA\)/.test(plan), `${nombre}/${t} «Tu plan» bloqueado: estado y pago con tarjeta o domiciliación`);
  const total = await p.locator('#plan-total').innerText();
  ok(/19,90\s?€ al mes/.test(total) && !/IVA/.test(total) && /Operación no sujeta al IVA \(Canarias, Ceuta y Melilla\)/.test(plan), `${nombre}/${t} «Tu plan» en Canarias: sin IVA y con la nota (${total})`);
  ok(/Al pagar, tu negocio vuelve a funcionar solo/.test(plan), `${nombre}/${t} «Tu plan» bloqueado: al pagar vuelve solo`);
  await foto('bloqueado-tu-plan');
  // Validar sí.
  await p.goto(`${BASE}/panel/#/validar`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#code');
  ok(/Tu negocio está bloqueado: puedes validar los códigos y bonos/.test(await texto(p)), `${nombre}/${t} bloqueado: «Validar códigos» se abre y lo explica`);
  ok(errores.length === 0, `${nombre}/${t} bloqueado sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

/** En francés (uno de los seis idiomas nuevos): el aviso traducido, también con la fecha dentro. */
async function panelIdioma(nav, nombre, t, vp) {
  if (t !== 'escritorio') return;
  for (const [caso, frase] of [['bloqueado', /Ton commerce est bloqué/], ['pausa', /Fermé temporairement jusqu'au 3 novembre 2026/]]) {
    const { ctx, p, errores } = await contextoPanel(nav, vp, caso, 'fr');
    await p.goto(`${BASE}/panel/`, { waitUntil: 'networkidle' });
    await p.waitForSelector('.aviso-parado');
    await p.waitForTimeout(300);
    const v = await texto(p);
    ok(frase.test(v) && !/Tu negocio está|Cerrado temporalmente|Sí puedes validar/.test(v), `${nombre}/${t} ${caso} en francés: traducido`);
    await p.screenshot({ path: `${OUT}/web-${caso}-fr-${nombre}-${t}.png`, fullPage: true });
    ok(errores.length === 0, `${nombre}/${t} ${caso} en francés sin errores JS ${errores.join(' | ')}`);
    await ctx.close();
  }
}

async function panelEncargado(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contextoPanel(nav, vp, 'encargado');
  await p.goto(`${BASE}/panel/`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.aviso-parado');
  const v = await texto(p);
  ok(/Hay un pago pendiente del plan/.test(v) && /Solo el propietario del negocio puede pagar el plan/.test(v) && await p.locator('.aviso-parado .btn.primary').count() === 0,
    `${nombre}/${t} encargado bloqueado: sin «Pagar»`);
  ok(!/Dar de baja el negocio/.test(await menu(p)) && /Tu plan/.test(await menu(p)), `${nombre}/${t} encargado bloqueado: el menú sin la baja`);
  if (t === 'escritorio') await p.screenshot({ path: `${OUT}/web-bloqueado-encargado-${nombre}-${t}.png`, fullPage: true });
  ok(errores.length === 0, `${nombre}/${t} encargado sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function panelPausa(nav, nombre, t, vp) {
  const { ctx, p, errores, estado } = await contextoPanel(nav, vp, 'pausa');
  await p.goto(`${BASE}/panel/`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.aviso-parado');
  const v = await texto(p);
  ok(/Cerrado temporalmente hasta el 3 de noviembre de 2026/.test(v) && /días que tenías pagados se guardan/.test(v), `${nombre}/${t} en pausa: el aviso con la fecha`);
  ok(await p.locator('#volver-abrir.btn.primary').count() === 1, `${nombre}/${t} en pausa: «Volver a abrir» coral`);
  await p.screenshot({ path: `${OUT}/web-pausa-resumen-${nombre}-${t}.png`, fullPage: true });
  await p.goto(`${BASE}/panel/#/plan`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#plan-reanudar');
  ok(/EN PAUSA/.test(await texto(p)) && /Cerrado temporalmente hasta el 3 de noviembre de 2026/.test(await texto(p)) && await p.locator('#plan-pagar').count() === 0,
    `${nombre}/${t} «Tu plan» en pausa: estado, «Volver a abrir» y sin pagar`);
  await p.screenshot({ path: `${OUT}/web-pausa-tu-plan-${nombre}-${t}.png`, fullPage: true });
  await p.click('#plan-reanudar');
  await p.waitForSelector('#modal[open]');
  await p.screenshot({ path: `${OUT}/web-pausa-volver-${nombre}-${t}.png` });
  await p.click('#modal[open] button[type=submit]');
  await p.waitForTimeout(500);
  ok(estado.funciones.some(([f, b]) => f === 'billing' && b.op === 'resume' && b.business_id === BIZ), `${nombre}/${t} «Volver a abrir» manda resume`);
  ok(errores.length === 0, `${nombre}/${t} en pausa sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function panelPronto(nav, nombre, t, vp) {
  for (const caso of ['pronto', 'devuelto']) {
    const { ctx, p, errores } = await contextoPanel(nav, vp, caso);
    await p.goto(`${BASE}/panel/`, { waitUntil: 'networkidle' });
    await p.waitForSelector('.aviso-cobro');
    const v = await texto(p);
    ok(await p.locator('.aviso-cobro').count() === 1 && /Tu negocio se bloquea el/.test(v), `${nombre}/${t} ${caso}: un solo aviso arriba`);
    if (caso === 'pronto') {
      ok(/Tu prueba gratis está a punto de acabar/.test(v) && (await p.locator('.aviso-cobro a.btn.primary').getAttribute('href')) === '#/plan', `${nombre}/${t} se bloquea pronto: «Pagar» a «Tu plan»`);
      ok(/Publicaciones/.test(await menu(p)), `${nombre}/${t} se bloquea pronto: el menú de siempre`);
      await p.screenshot({ path: `${OUT}/web-pronto-resumen-${nombre}-${t}.png`, fullPage: false });
      await p.goto(`${BASE}/panel/#/plan`, { waitUntil: 'networkidle' });
      await p.waitForSelector('#plan-pagar');
      const plan = await texto(p);
      ok(/Si no se paga antes, tu negocio se bloquea el/.test(plan) && /19,90\s?€ \+ IVA al mes/.test(await p.locator('#plan-total').innerText()), `${nombre}/${t} «Tu plan» se bloquea pronto: lo dice y con IVA`);
      ok(/no durante la prueba/.test(plan) && await p.locator('#plan-pausar').count() === 0, `${nombre}/${t} en la prueba no se pausa`);
      if (t === 'escritorio') await p.screenshot({ path: `${OUT}/web-pronto-tu-plan-${nombre}-${t}.png`, fullPage: true });
    } else {
      ok(/El banco ha devuelto el recibo del plan/.test(v) && /^mailto:info@klendar\.app/.test(await p.locator('.aviso-cobro a.btn.primary').getAttribute('href')), `${nombre}/${t} recibo devuelto: «Escribir a soporte»`);
      await p.goto(`${BASE}/panel/#/plan`, { waitUntil: 'networkidle' });
      await p.waitForSelector('.plan-card');
      const plan = await texto(p);
      ok(/El banco ha devuelto el recibo\. Escríbenos a info@klendar\.app para ponerlo al día/.test(plan) && !/Pagar la factura pendiente/.test(plan), `${nombre}/${t} «Tu plan» recibo devuelto: escribir, sin factura`);
      if (t === 'escritorio') await p.screenshot({ path: `${OUT}/web-devuelto-tu-plan-${nombre}-${t}.png`, fullPage: true });
    }
    ok(errores.length === 0, `${nombre}/${t} ${caso} sin errores JS ${errores.join(' | ')}`);
    await ctx.close();
  }
}

async function panelPausar(nav, nombre, t, vp) {
  const { ctx, p, errores, estado } = await contextoPanel(nav, vp, 'pagado');
  await p.goto(`${BASE}/panel/#/plan`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#plan-pausar');
  // Sin fecha.
  await p.click('#plan-pausar');
  await p.waitForSelector('#modal[open] select[name=modo]');
  await p.selectOption('#modal[open] select[name=modo]', 'sin');
  ok(await p.locator('#modal[open] input[name=dia]').isHidden(), `${nombre}/${t} «Sin fecha» esconde el día`);
  if (t === 'escritorio') await p.screenshot({ path: `${OUT}/web-pausar-elegir-${nombre}-${t}.png` });
  await p.click('#modal[open] button[type=submit]');
  await p.waitForFunction(() => /Mientras dure, tu negocio queda parado/.test(document.querySelector('#modal')?.innerText || ''));
  ok(/Cerrado temporalmente hasta el/.test(await p.locator('#modal').innerText()), `${nombre}/${t} la confirmación con el texto de Iván`);
  if (t === 'escritorio') await p.screenshot({ path: `${OUT}/web-pausar-confirmar-${nombre}-${t}.png` });
  await p.click('#modal[open] button[type=submit]');
  await p.waitForTimeout(500);
  ok(estado.funciones.some(([f, b]) => f === 'billing' && b.op === 'pause' && b.days === null), `${nombre}/${t} pausar sin fecha: days null`);
  // Hasta un día (dentro de 10).
  await p.goto(`${BASE}/panel/#/plan`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#plan-pausar');
  await p.click('#plan-pausar');
  await p.waitForSelector('#modal[open] input[name=dia]');
  await p.fill('#modal[open] input[name=dia]', masDias(10));
  await p.click('#modal[open] button[type=submit]');
  await p.waitForFunction(() => /Mientras dure/.test(document.querySelector('#modal')?.innerText || ''));
  await p.click('#modal[open] button[type=submit]');
  await p.waitForTimeout(500);
  const dias = estado.funciones.filter(([f, b]) => f === 'billing' && b.op === 'pause').map(([, b]) => b.days);
  ok(dias.length === 2 && (dias[1] === 10 || dias[1] === 9 || dias[1] === 11), `${nombre}/${t} pausar hasta un día: days ${JSON.stringify(dias)}`);
  ok(errores.length === 0, `${nombre}/${t} pausar sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function admin(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* */ } }, [`sb-${REF}-admin-auth-token`, sesion()]);
  const estado = { llamadas: [], funciones: [], rpc: {} };
  Object.assign(estado.rpc, {
    is_admin: true,
    admin_mfa_status: { required: false, enrolled: true },
    admin_billing: {
      config: { enabled: true, block_enabled: true, pause_enabled: true, grace_days: 7, warn_days: 7, pause_max_days: 183, pause_min_days: 1,
        payment_methods: ['card', 'sepa_debit'], tax: { mode: 'rate', rate_id: 'txr_123', rate_id_exempt: 'txr_456' }, portal_configuration: '', allow_promotion_codes: false },
      prices: [], subscriptions: { total: 0, by_status: {} }, events: [], past_due: [],
      holds: [
        { id: 'h1', name: 'Cafetería Prueba Q', city: 'Madrid', hold: 'ended', since: `${hoy()}T08:00:00Z`, kind: 'trial', until: null, unblocked_until: null },
        { id: 'h2', name: 'Fiestas Lunares QA', city: 'Madrid', hold: 'paused', since: `${hoy()}T08:00:00Z`, kind: 'paused', until: '2026-11-03', unblocked_until: null },
      ],
      upcoming: [{ id: 'u1', name: 'Bar Pronto', city: 'Getafe', kind: 'free', on_date: masDias(5) }],
      unblocked: [{ id: 'x1', name: 'Bar Perdonado', until: masDias(3) }],
    },
    admin_unblock_business: (b) => { estado.desbloqueos = [...(estado.desbloqueos || []), b]; return { ok: true, hold: null }; },
    admin_billing_run: () => { estado.run = (estado.run || 0) + 1; return { ok: true, changed: 2 }; },
    admin_set_billing_config: (b) => { estado.config = b.p; return null; },
  });
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`${BASE}/admin/#/planes?tab=stripe`, { waitUntil: 'networkidle' });
  await p.waitForSelector('text=Bloqueados y en pausa');
  const v = await p.locator('#view').innerText();
  ok(/Cafetería Prueba Q/.test(v) && /bloqueado/.test(v) && /fin de la prueba/.test(v) && /Fiestas Lunares QA/.test(v) && /en pausa/.test(v), `${nombre}/${t} admin: bloqueados y en pausa con el motivo`);
  ok(/Se bloquean pronto/.test(v) && /Bar Pronto/.test(v) && /fin del gratis de lanzamiento/.test(v) && /Desbloqueados a mano/.test(v), `${nombre}/${t} admin: se bloquean pronto y desbloqueados`);
  ok(await p.locator('[data-desbloquear="h1"]').count() === 1 && await p.locator('[data-desbloquear="h2"]').count() === 0, `${nombre}/${t} admin: «Desbloquear hasta…» no vale para una pausa`);
  await p.screenshot({ path: `${OUT}/web-admin-bloqueo-${nombre}-${t}.png`, fullPage: true });
  await p.click('[data-desbloquear="h1"]');
  await p.waitForSelector('#modal[open] [name=until]');
  await p.fill('#modal[open] [name=until]', masDias(7));
  await p.fill('#modal[open] [name=note]', 'Pagó por transferencia');
  await p.click('#modal[open] button[type=submit]');
  await p.waitForTimeout(500);
  const d = estado.desbloqueos || [];
  ok(d.length === 1 && d[0].p_business === 'h1' && d[0].p_until === masDias(7) && d[0].p_note === 'Pagó por transferencia', `${nombre}/${t} admin: desbloquear hasta un día ${JSON.stringify(d)}`);
  await p.waitForSelector('#cobro-run');
  await p.click('#cobro-run');
  await p.waitForTimeout(500);
  ok(estado.run === 1, `${nombre}/${t} admin: «Comprobar ahora»`);
  await p.waitForSelector('#sbf');
  await p.uncheck('#sbf [name=pause]');
  ok(await p.locator('#sbf .pausa-campos').isHidden(), `${nombre}/${t} admin: la pausa apagada esconde sus ajustes`);
  await p.uncheck('#sbf [name=pm_sepa]');
  await p.fill('#sbf [name=ratec]', 'txr_789');
  await p.click('#sbf button');
  await p.waitForTimeout(500);
  const c = estado.config || {};
  ok(c.block_enabled === true && c.pause_enabled === false && JSON.stringify(c.payment_methods) === '["card"]' && c.tax?.rate_id_exempt === 'txr_789' && c.warn_days === 7,
    `${nombre}/${t} admin: guarda bloqueo, pausa, formas de pago e IVA no sujeto ${JSON.stringify(c)}`);
  ok(errores.length === 0, `${nombre}/${t} admin sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// ── La ficha pública, con las Functions de verdad ───────────────────────────
const FICHAS = {
  'f1000000-0000-4000-8000-00000000b10c': { name: 'Bar Bloqueado', unavailable: 'blocked', reopens_on: null },
  'f2000000-0000-4000-8000-00000000b10c': { name: 'Bar en Pausa', unavailable: 'paused', reopens_on: '2026-11-03' },
  'f3000000-0000-4000-8000-00000000b10c': { name: 'Bar Abierto', unavailable: null, reopens_on: null },
};
function supabaseFichas() {
  return createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; });
    req.on('end', () => {
      const json = (b) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
      let args = {};
      try { args = JSON.parse(cuerpo || '{}'); } catch { /* */ }
      if (url.pathname === '/rest/v1/rpc/business_profile') {
        const f = FICHAS[args.p_id];
        if (!f) return json(null);
        return json([{ id: args.p_id, ...f, city: 'Madrid', address: 'Calle Mayor 1, 28013 Madrid', lat: 40.4168, lng: -3.7038, is_verified: true,
          member_since: '2026-01-01T00:00:00Z', time_zone: 'Europe/Madrid', description: 'Un bar de prueba.', closed_indefinitely: false, social: {} }]);
      }
      if (url.pathname === '/rest/v1/business_posts') return json([{ id: 'p0000000-0000-4000-8000-00000000b10c', body: 'Hoy, croquetas caseras', created_at: new Date().toISOString() }]);
      if (url.pathname.startsWith('/rest/v1/rpc/')) return json([]);
      return json([]);
    });
  });
}

async function fichas(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  const p = await ctx.newPage();
  for (const [id, f] of Object.entries(FICHAS)) {
    const r = await p.goto(`http://localhost:${FICHA_PORT}/b/${id}`, { waitUntil: 'domcontentloaded' });
    ok(r.status() === 200, `${nombre}/${t} ficha ${f.name}: 200`);
    const html = await p.content();
    const cuerpo = await p.locator('body').innerText();
    const noindex = /<meta name="robots" content="noindex">/.test(html);
    if (f.unavailable === 'blocked') {
      ok(/No disponible ahora mismo/.test(cuerpo) && !/croquetas/.test(cuerpo) && noindex, `${nombre}/${t} ficha bloqueada: «No disponible ahora mismo», sin novedades y noindex`);
    } else if (f.unavailable === 'paused') {
      ok(/Cerrado temporalmente hasta el 3 de noviembre/.test(cuerpo) && !/croquetas/.test(cuerpo) && noindex, `${nombre}/${t} ficha en pausa: «Cerrado temporalmente hasta el 3 de noviembre» y noindex`);
    } else {
      ok(!/No disponible ahora mismo|Cerrado temporalmente/.test(cuerpo) && /croquetas/.test(cuerpo) && !noindex, `${nombre}/${t} ficha abierta: como siempre`);
    }
    if (f.unavailable) await p.screenshot({ path: `${OUT}/web-ficha-${f.unavailable}-${nombre}-${t}.png`, fullPage: false });
  }
  await ctx.close();
}

let servidorFichas = null;
let falso = null;
if (!SOLO || SOLO.includes('ficha')) {
  falso = supabaseFichas();
  await new Promise((ok2) => falso.listen(FALSO_PORT, ok2));
  servidorFichas = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(FICHA_PORT), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa' }, stdio: 'ignore',
  });
  await new Promise((ok2) => setTimeout(ok2, 1500));
}

const PRUEBAS = { idioma: panelIdioma, bloqueado: panelBloqueado, encargado: panelEncargado, pausa: panelPausa, pronto: panelPronto, pausar: panelPausar, admin, ficha: fichas };
for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    for (const [k, f] of Object.entries(PRUEBAS)) {
      if (SOLO && !SOLO.includes(k)) continue;
      await f(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} ${k}: ${e.message}`));
    }
  }
  await nav.close();
}
if (servidorFichas) servidorFichas.kill();
if (falso) falso.close();
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
