// Prueba de lo publicado el 2026-10-20 con «Te aviso cuando esté listo»
// (TL1–TL7) y de lo que lo acompaña, en la web local:
//
//  1. Páginas legales (ES y EN): condiciones para negocios (3 undecies / 3j,
//     el aviso de arriba con el 4 de noviembre y su línea en el historial),
//     términos (3 ter / 3b «Cola virtual y avisos de pedido»), privacidad
//     (fila nueva, notificaciones push y cuenta de negocio), normas, eliminar
//     cuenta y las dos preguntas del centro de ayuda; con la fecha nueva y
//     sin desplazamiento horizontal.
//  2. Panel, hasta el 4-11-2026 (migración 20261235100001 de la app): la
//     tarjeta de «Más herramientas» dice «Disponible desde el 4 de
//     noviembre» y no tiene botón; «Pedidos de hoy» lo dice en vez de
//     «Activar el avisador». Con `available` (pasada la fecha), el botón de
//     siempre.
//  3. «Tu cuenta» › Notificaciones: «Tu negocio» › «Preguntas de festivos»
//     (migración 20261233100006) solo a quien lleva un negocio; apagarlo
//     manda `notify_holiday_asks = false`.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800), con un
// Supabase de mentira (no toca dev ni manda nada). Capturas en OUT.
//
//   PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> OUT=<carpeta> node tools/legal_tl_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8871';
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });
const SOLO = process.env.SOLO || '';
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-0000000071a1';
const BIZ = 'b1000000-0000-4000-8000-0000000071a1';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'legal.tl@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const masMin = (m) => new Date(Date.now() + m * 60e3).toISOString();
const SUB = { plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: 'active', period_end: masMin(60 * 480), payment_method: 'transfer',
  price_cents: 1990, active_offers: 0, max_active_offers: null, has_analytics: true, boosts_included: 0, boosts_used: 0,
  billing: { enabled: true, blocked: false, hold: null, block_soon: false } };

function supabaseFalso(estado) {
  return async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
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
    if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, name: 'Café Norte', time_zone: 'Europe/Madrid', category_id: null, amenities: [], address: 'Calle Mayor 1', city: 'Madrid' }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, vp, rpc, lang = 'es') {
  const ctx = await nav.newContext({ viewport: vp, locale: lang === 'en' ? 'en-GB' : 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', l); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion(), lang]);
  const estado = { llamadas: [], rpc };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}
const llamadas = (estado, fn) => estado.llamadas.filter(([f]) => f === fn);
const sinScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0);

// ── 1. Páginas legales ─────────────────────────────────────────────────────
const PAGINAS = [
  ['/negocios/', 'Última actualización: 27 de octubre de 2026', [
    /3 undecies\. Te aviso cuando esté listo/,
    /Solo marcarás «Listo» cuando el pedido lo esté de verdad/,
    /los del 20 de octubre de 2026 \(apartados 2 bis, 3 y 3 undecies\), desde el 4 de noviembre de 2026/,
    /Te aviso cuando esté listo \(apartado 3 undecies nuevo\).*Se aplica desde el 4 de noviembre de 2026\./,
  ]],
  ['/en/business-terms/', 'Last updated: 27 October 2026', [
    /3j\. Ready alert/,
    /You will only mark “Ready” when the order really is ready/,
    /those of 20 October 2026 \(sections 2a, 3 and 3j\) from 4 November 2026/,
    /Ready alert \(new section 3j\).*It applies from 4 November 2026\./,
  ]],
  ['/terminos/', 'Última actualización: 27 de octubre de 2026', [
    /3 ter\. Cola virtual y avisos de pedido/,
    /Algunos locales te avisan cuando tu pedido está listo/,
    /si no lo recoges, se cierra solo a las 2 horas/,
    /Avisos de pedido \(«Te aviso cuando esté listo», apartado 3 ter\)/,
  ]],
  ['/en/terms/', 'Last updated: 27 October 2026', [
    /3b\. Virtual queue and order alerts/,
    /Some venues tell you when your order is ready/,
  ]],
  ['/privacidad/', 'Última actualización: 26 de octubre de 2026', [
    /Te aviso cuando esté listo\s+Si pides que un local te avise de tu pedido/,
    /Qué ve el local: tu número, la primera palabra del nombre de tu perfil/,
    /Todo se borra a las 6:00 \(hora del local\)/,
    /y tu pedido de «Te aviso cuando esté listo» \(está listo, el local lo quitó o terminó por hoy\)/,
    /«Tu pedido está listo»: lo acabas de pedir en el mostrador/,
    /si usa «Te aviso cuando esté listo», el código de su cartel y cuántos pedidos avisó cada día y la espera media \(solo números\)/,
  ]],
  ['/en/privacy/', 'Last updated: 26 October 2026', [
    /Ready alert\s+If you ask a venue to tell you when your order is ready/,
    /“Your order is ready”: you've just asked for it at the counter/,
    /if it uses “Ready alert”, its poster code/,
  ]],
  ['/normas/', 'Última actualización: 20 de octubre de 2026', [
    /En «Te aviso cuando esté listo», marca «Listo» solo cuando el pedido lo esté/,
    /Para negocios: «Te aviso cuando esté listo», solo cuando lo esté\./,
  ]],
  ['/en/community-guidelines/', 'Last updated: 20 October 2026', [/In “Ready alert”, mark “Ready” only when the order is ready/]],
  ['/eliminar-cuenta/', 'Última actualización: 20 de octubre de 2026', [
    /Tu pedido de hoy en «Te aviso cuando esté listo»\./,
    /Lista al día: tu pedido de hoy en «Te aviso cuando esté listo»\./,
  ]],
  ['/en/delete-account/', 'Last updated: 20 October 2026', [/Your order today in “Ready alert”\./]],
  ['/preguntas/', null, [
    /¿Cómo funciona «Te aviso cuando esté listo»\?/,
    /¿Cómo aviso a quien pide en el mostrador de que su pedido está listo\?/,
  ]],
  ['/en/faq/', null, [/How does “Ready alert” work\?/]],
];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    // Los <details> del historial y las preguntas, abiertos para leerlos.
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    // innerText (con los saltos entre celdas) y textContent (las pestañas
    // ocultas del centro de ayuda).
    const txt = `${await p.locator('body').innerText()}
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    if (fecha) ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    ok(await sinScroll(p), `${nombre}/${t} ${ruta}: sin desplazamiento horizontal`);
    if (nombre === 'chromium' && /negocios|business-terms/.test(ruta)) {
      const h = p.locator('h2', { hasText: /3 undecies|3j\./ });
      await h.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${OUT}/legal${ruta.replace(/\//g, '-')}${t}.png` });
    }
  }
  ok(errores.length === 0, `${nombre}/${t} legales: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

// ── 2. Panel: la tarjeta y «Pedidos de hoy» hasta el 4-11 ──────────────────
function rpcPanel({ available }) {
  const k = { enabled: false };
  const pedidos = () => ({
    ok: true, enabled: k.enabled, available, can_manage: true, blocked: false, paused: false, code: 'Ab3_-Ab3_-Ab3_-A',
    stats: { today: { notified: 0, avg_wait_minutes: null }, month: { notified: 0, avg_wait_minutes: null } },
    board: k.enabled ? { status: 'open', waiting: 0, ready: 0, picked_up: 0, entries: [] } : null, now: new Date().toISOString(),
  });
  return {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: [{ id: BIZ, name: 'Café Norte', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
    business_is_organizer: false,
    my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
    my_subscription: SUB,
    business_stats: { redemptions_30d: 3 },
    my_business_offers: [],
    business_loyalty: { ok: true },
    // Un negocio que nunca lo ha abierto: `orders` es null (no hay fila).
    business_tools_overview: () => ({ ok: true, can_edit: true, team: { members: 2 }, series: { rules_active: 0 },
      orders_available: available, orders: k.enabled ? { enabled: true, waiting: 0, ready: 0, notified_today: 0 } : null }),
    business_private: { tax_id: '' },
    business_report: { ok: true, totals: {}, daily: [], offers: [], by_hour: [], redemptions: [], loyalty: {} },
    business_recent_validations: [],
    business_orders: () => pedidos(),
    set_orders_enabled: (b) => {
      if (b.p_enabled && !available) return { ok: false, error: 'not_yet', available_from: '2026-11-04' };
      k.enabled = b.p_enabled; return pedidos();
    },
  };
}

async function tarjeta(nav, nombre, t, vp) {
  for (const available of [false, true]) {
    const { ctx, p, errores } = await contexto(nav, vp, rpcPanel({ available }));
    await p.goto(`${BASE}/panel/#/herramientas`);
    await p.waitForSelector('.fiel-card');
    const card = p.locator('.fiel-card', { hasText: 'Te aviso cuando esté listo' });
    const txt = await card.innerText();
    if (!available) {
      ok(/Disponible desde el 4 de noviembre/.test(txt) && await card.locator('a, button').count() === 0,
        `${nombre}/${t} herramientas hasta el 4-11: «Disponible desde el 4 de noviembre», sin botón`);
      await card.screenshot({ path: `${OUT}/panel-tarjeta-listo-hasta-4-nov-${nombre}-${t}.png` });
    } else {
      ok(/Apagado/.test(txt) && await card.locator('a[href="#/pedidos"]').count() === 1,
        `${nombre}/${t} herramientas pasado el 4-11: «Apagado» y el botón de activar`);
    }
    await p.goto(`${BASE}/panel/#/pedidos`);
    await p.waitForSelector('.listo-apagado');
    const v = await p.locator('#view').innerText();
    if (!available) {
      ok(/Disponible desde el 4 de noviembre/.test(v) && await p.locator('[data-listo="activar"]').count() === 0,
        `${nombre}/${t} pedidos hasta el 4-11: lo dice en vez de «Activar el avisador»`);
      ok(await sinScroll(p), `${nombre}/${t} pedidos hasta el 4-11: sin desplazamiento horizontal`);
      await p.screenshot({ path: `${OUT}/panel-pedidos-hasta-4-nov-${nombre}-${t}.png`, fullPage: true });
    } else {
      ok(await p.locator('[data-listo="activar"]').count() === 1, `${nombre}/${t} pedidos pasado el 4-11: «Activar el avisador»`);
    }
    ok(errores.length === 0, `${nombre}/${t} tarjeta (${available}): sin errores de JavaScript (${errores.join(' | ')})`);
    await ctx.close();
  }
}

// ── 3. «Tu cuenta» › Notificaciones: «Preguntas de festivos» ───────────────
async function interruptor(nav, nombre, t, vp) {
  for (const rol of ['owner', 'staff']) {
    const { ctx, p, estado, errores } = await contexto(nav, vp, {
      my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, push_devices: 1 },
      my_notification_preferences: { notify_favorites: true, notify_room: true, notify_holiday_asks: true, business_email: true },
      my_businesses: [{ id: BIZ, name: 'Café Norte', role: rol, verification_status: 'verified', is_active: true }],
      my_alert_words: { words: [] },
      update_notification_preferences: null,
    });
    await p.goto(`${BASE}/app/#/ajustes/notificaciones`);
    await p.waitForSelector('input[name=sitio]');
    const v = await p.locator('#view').innerText();
    if (rol === 'owner') {
      ok(/Tu negocio/.test(v) && /Preguntas de festivos/.test(v) && /Unos días antes de cada festivo, si abres\. La pregunta sigue en Mi negocio\./.test(v)
        && await p.locator('input[name=festivos]').isChecked(), `${nombre}/${t} Tu cuenta (propietario): «Tu negocio» › «Preguntas de festivos», encendido`);
      // Detrás de «Para ti» y antes de «Por correo», como la app.
      const orden = await p.$$eval('h2.seccion-t', (hs) => hs.map((h) => h.textContent.trim()));
      ok(orden.indexOf('Tu negocio') === orden.indexOf('Para ti') + 1 && orden.indexOf('Por correo') === orden.indexOf('Tu negocio') + 1,
        `${nombre}/${t} Tu cuenta: el grupo va entre «Para ti» y «Por correo» (${orden.join(' · ')})`);
      await p.locator('input[name=festivos]').click({ force: true });
      await p.waitForTimeout(1200);
      const u = llamadas(estado, 'update_notification_preferences').slice(-1)[0]?.[1]?.p || {};
      ok(u.notify_holiday_asks === false && u.notify_room === true, `${nombre}/${t} Tu cuenta: apagarlo manda notify_holiday_asks = false (y lo demás igual)`);
      if (nombre === 'chromium') await p.locator('input[name=festivos]').locator('xpath=ancestor::label').screenshot({ path: `${OUT}/cuenta-preguntas-de-festivos-${t}.png` });
      ok(await sinScroll(p), `${nombre}/${t} Tu cuenta: sin desplazamiento horizontal`);
    } else {
      ok(!/Preguntas de festivos/.test(v) && await p.locator('input[name=festivos]').count() === 0,
        `${nombre}/${t} Tu cuenta (empleado): sin «Preguntas de festivos»`);
      await p.locator('input[name=sitio]').click({ force: true });
      await p.waitForTimeout(1200);
      const u = llamadas(estado, 'update_notification_preferences').slice(-1)[0]?.[1]?.p || {};
      ok(!('notify_holiday_asks' in u) && u.notify_room === false, `${nombre}/${t} Tu cuenta (empleado): guardar no toca el interruptor`);
    }
    ok(errores.length === 0, `${nombre}/${t} Tu cuenta (${rol}): sin errores de JavaScript (${errores.join(' | ')})`);
    await ctx.close();
  }
  // En inglés.
  const { ctx, p } = await contexto(nav, vp, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_notification_preferences: { notify_holiday_asks: false },
    my_businesses: [{ id: BIZ, name: 'Café Norte', role: 'manager', verification_status: 'verified', is_active: true }],
    my_alert_words: { words: [] },
  }, 'en');
  await p.goto(`${BASE}/app/?lang=en#/ajustes/notificaciones`);
  await p.waitForSelector('input[name=festivos]');
  const v = await p.locator('#view').innerText();
  ok(/Your business/.test(v) && /Public holiday questions/.test(v) && !(await p.locator('input[name=festivos]').isChecked()),
    `${nombre}/${t} Tu cuenta en inglés: «Public holiday questions», apagado`);
  await ctx.close();
}

const PRUEBAS = { legales, tarjeta, interruptor };
for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]].filter(([n]) => !process.env.NAV || n === process.env.NAV)) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 800 }]]) {
    for (const [k, f] of Object.entries(PRUEBAS)) {
      if (SOLO && !SOLO.split(',').includes(k)) continue;
      await f(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} ${k}: ${e.message.split('\n')[0]}`));
    }
  }
  await nav.close();
}
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
