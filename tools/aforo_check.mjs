// Prueba del «Aforo en directo» y de «Avísame cuando haya sitio» en la web
// local, con un Supabase de mentira (no toca dev ni manda nada):
//
//  1. Panel › #/aforo (la puerta): «84 / 120» y «Casi lleno»; +1, +1, −1
//     → 85, y la cifra cuadra con `capacity_status`; un doble toque rápido
//     cuenta 1; un envío que falla por la red se repite con el mismo
//     `p_op` y no cuenta dos veces; se pone al día sola (sondeo de 4 s);
//     las líneas (ficha, esta noche, quién espera, eventos de hoy) y
//     «Poner a 0» con su pregunta.
//  2. Panel › #/aforo/ajustes: validación (sin mandar) y `set_capacity_settings`.
//     Un empleado ve la puerta sin ajustes.
//  3. Panel › «Más herramientas», el resumen (fila de acceso rápido y «¿Hay
//     sitio ahora?» con «Marcado a mano · vuelve al contador…» y «Volver al
//     contador») y «Cifras» (el plegable «Aforo»).
//  4. «Tu cuenta» › Notificaciones: «Cuando haya sitio» → `notify_room`.
//  5. Ficha pública (las Functions de verdad contra un Supabase falso): sin
//     sesión no hay botón; con sesión, «Avísame cuando haya sitio», el
//     diálogo de `alerts_off`, «Te avisaremos… · Quitar», `too_many`,
//     `not_full`, `team` (se esconde), con sitio no sale; en inglés.
//  6. Explorar › mapa: la tarjeta del negocio con el botón (si carga Mapbox).
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800). Capturas en OUT.
//
//   PORT=8796 node tools/serve_dev.mjs &
//   BASE=http://localhost:8796 PW=<ruta a playwright> OUT=<carpeta> node tools/aforo_check.mjs
// (lo público arranca su propio serve_dev en PUB_PORT, 8797, contra un
// Supabase de mentira en 8798)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8796';
const OUT = process.env.OUT || '.';
const SOLO = process.env.SOLO || '';
const PUB_PORT = Number(process.env.PUB_PORT || 8797);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8798);
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-0000000af0a1';
const BIZ = 'b1000000-0000-4000-8000-0000000af0a1';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'aforo.prueba@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const masMin = (m) => new Date(Date.now() + m * 60e3).toISOString();
const ABIERTO = { 1: [['00:00', '00:00']], 2: [['00:00', '00:00']], 3: [['00:00', '00:00']], 4: [['00:00', '00:00']], 5: [['00:00', '00:00']], 6: [['00:00', '00:00']], 7: [['00:00', '00:00']] };
const SUB = { plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: 'active', period_end: masMin(60 * 480), payment_method: 'transfer',
  price_cents: 1990, active_offers: 0, max_active_offers: null, has_analytics: true, boosts_included: 0, boosts_used: 0,
  billing: { enabled: true, blocked: false, hold: null, block_soon: false } };
const pgError = (message) => ({ __error: { code: 'P0001', message, details: null, hint: null } });

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
      // Una caída de la red, una vez (para ver que se repite con el mismo p_op).
      if (estado.cortaUna === fn) { estado.cortaUna = null; estado.llamadas.push([fn, body, 'cortada']); return route.abort('failed'); }
      estado.llamadas.push([fn, body]);
      const r = estado.rpc[fn];
      if (r !== undefined) {
        const v = typeof r === 'function' ? r(body) : r;
        if (v && v.__error) return json(v.__error, 400);
        return json(v);
      }
      return json(null);
    }
    if (p.startsWith('/rest/v1/categories')) return json([{ id: 'c-bar', slug: 'bar', name: 'Bares', category_group: 'drinks', position: 1 }]);
    if (p.startsWith('/rest/v1/businesses')) {
      return json([{ id: BIZ, name: 'Sala Prueba', time_zone: 'Europe/Madrid', category_id: 'c-bar', logo_url: null, cover_image_url: null, gallery: [],
        opening_hours: ABIERTO, amenities: [], address: 'Calle Mayor 1', city: 'Madrid', crowd_enabled: true, price_level: 2 }]);
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

/** El aforo de mentira: lo mismo que `capacity_status` en la base. */
function aforoFalso(rol = 'owner') {
  const k = { enabled: true, max: 120, almost_pct: 70, full_pct: 95, people: 84, ops: new Set() };
  const nivel = (n) => (n * 100 < k.max * k.almost_pct ? 'quiet' : n * 100 < k.max * k.full_pct ? 'lively' : 'full');
  const estado = () => ({
    enabled: k.enabled, can_edit: rol !== 'staff', organizer: false, max: k.max, almost_pct: k.almost_pct, full_pct: k.full_pct,
    people: k.people, day: '2026-10-17', counted_at: masMin(-1), counter_level: k.enabled ? nivel(k.people) : null,
    crowd_enabled: true, open_now: true, shown_level: k.enabled ? nivel(k.people) : null, shown_at: masMin(-1), shown_source: 'counter',
    manual_level: null, manual_at: null, manual_until: null,
    tonight: { peak: 118, peak_at: '2026-10-17T22:30:00Z', almost_at: '2026-10-17T21:10:00Z', full_at: '2026-10-17T21:40:00Z' },
    alerts_waiting: 3,
    events_today: [{ id: 'e1', title: 'Jazz', event_at: '2026-10-17T20:00:00Z', seats: 40, waiting: 14, arrived: 20 }],
    now: new Date().toISOString(),
  });
  return { k, estado, rpc: {
    capacity_status: () => estado(),
    capacity_bump: (b) => {
      if (b.p_op && k.ops.has(b.p_op)) return estado();
      if (b.p_op) k.ops.add(b.p_op);
      if (!b.p_delta || Math.abs(b.p_delta) > 50) return pgError('invalid_delta');
      k.people = Math.max(0, k.people + b.p_delta);
      return estado();
    },
    capacity_reset: () => { k.people = 0; return estado(); },
    set_capacity_settings: (b) => { k.enabled = b.p_enabled; if (b.p_max) k.max = b.p_max; k.almost_pct = b.p_almost; k.full_pct = b.p_full; return estado(); },
    capacity_stats: { enabled: true, max: 120, time_zone: 'Europe/Madrid', nights: [
      { day: '2026-10-17', peak: 118, peak_at: '2026-10-17T22:30:00Z', almost_at: '2026-10-17T21:10:00Z', full_at: '2026-10-17T21:40:00Z', max: 120,
        slots: Array.from({ length: 24 }, (_, i) => ({ at: new Date(Date.UTC(2026, 9, 17, 19, 0) + i * 900e3).toISOString(), peak: Math.round(118 * Math.sin((i + 1) / 25 * Math.PI)) })) },
      { day: '2026-10-16', peak: 64, peak_at: '2026-10-16T22:00:00Z', almost_at: null, full_at: null, max: 120,
        slots: Array.from({ length: 16 }, (_, i) => ({ at: new Date(Date.UTC(2026, 9, 16, 19, 0) + i * 900e3).toISOString(), peak: 10 + i * 3 })) },
    ] },
  } };
}

async function contextoPanel(nav, vp, { rol = 'owner', extra = {} } = {}) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
  const af = aforoFalso(rol);
  const estado = { llamadas: [], rpc: {}, af };
  Object.assign(estado.rpc, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: [{ id: BIZ, name: 'Sala Prueba', role: rol, verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
    business_is_organizer: false,
    my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
    my_subscription: SUB,
    business_stats: { redemptions_30d: 3 },
    my_business_offers: [],
    business_loyalty: { ok: true },
    business_tools_overview: () => ({ ok: true, can_edit: rol !== 'staff', team: { members: 2 }, series: { rules_active: 0 }, crowd: { enabled: true },
      capacity: { enabled: af.k.enabled, max: af.k.max, people: af.k.people } }),
    business_crowd_status: { enabled: true, level: 'full', set_at: masMin(-5), live: true, open_now: true, capacity_on: true,
      shown_level: 'full', shown_at: masMin(-5), shown_source: 'manual', manual_until: masMin(25) },
    set_business_crowd: { enabled: true, level: null, set_at: null, live: false, open_now: true, capacity_on: true,
      shown_level: 'lively', shown_at: masMin(-1), shown_source: 'counter', manual_until: null },
    business_private: { tax_id: '' },
    business_report: { ok: true, totals: {}, daily: [], offers: [], by_hour: [], redemptions: [], loyalty: {} },
    business_audience: null,
    business_link_taps_report: [],
    table_qr_stats: { ok: true, has: false },
    ...af.rpc,
    ...extra,
  });
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}
const vista = (p) => p.locator('#view').innerText();
const llamadas = (estado, fn) => estado.llamadas.filter(([f]) => f === fn);

async function puerta(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contextoPanel(nav, vp);
  const af = estado.af;
  await p.goto(`${BASE}/panel/#/aforo`);
  await p.waitForSelector('.afd-btn');
  const cifra = async () => (await p.locator('#afdCifra').innerText()).replace(/\s+/g, ' ').trim();
  ok(await cifra() === '84 / 120', `${nombre}/${t} puerta: «84 / 120» (${await cifra()})`);
  ok((await p.locator('#afdNivel').innerText()) === 'Casi lleno', `${nombre}/${t} puerta: «Casi lleno»`);
  const caja = await p.locator('.afd-btn').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(b).backgroundColor]; }));
  ok(caja.length === 2 && caja[0][0] === caja[1][0] && caja[0][1] === caja[1][1] && caja[0][2] === caja[1][2] && caja[0][1] >= 140,
    `${nombre}/${t} puerta: −1 y +1 iguales y enormes (${JSON.stringify(caja)})`);
  ok((await p.locator('.afd-btn').first().innerText()) === '−1', `${nombre}/${t} puerta: −1 a la izquierda`);
  let txt = await vista(p);
  ok(/En tu ficha: Casi lleno/.test(txt), `${nombre}/${t} puerta: «En tu ficha: Casi lleno»`);
  ok(/Esta noche: máximo 118 a las 0:30 · lleno a las 23:40/.test(txt), `${nombre}/${t} puerta: «Esta noche: máximo 118 a las 0:30 · lleno a las 23:40»`);
  ok(/3 personas esperan que haya sitio/.test(txt), `${nombre}/${t} puerta: «3 personas esperan que haya sitio»`);
  ok(/Hoy: «Jazz» a las 22:00 · 14 con reserva por llegar/.test(txt) && /El aforo no cierra las reservas del evento\./.test(txt), `${nombre}/${t} puerta: evento de hoy y su aviso`);
  ok(await p.locator('a[href="#/aforo/ajustes"]').count() === 1, `${nombre}/${t} puerta: «Ajustes del aforo» arriba`);
  const anchoPagina = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(anchoPagina <= 0, `${nombre}/${t} puerta: sin desplazamiento horizontal`);
  await p.screenshot({ path: `${OUT}/panel-puerta-${nombre}-${t}.png`, fullPage: true });

  // +1, +1, −1 (tocados con calma): 85 en pantalla y en la base.
  for (const d of ['1', '1', '-1']) { await p.click(`.afd-btn[data-d="${d}"]`); await p.waitForTimeout(160); }
  ok(await cifra() === '85 / 120', `${nombre}/${t} puerta: +1 +1 −1 → 85 al momento (${await cifra()})`);
  await p.waitForTimeout(900);
  const suma = llamadas(estado, 'capacity_bump').reduce((a, [, b]) => a + b.p_delta, 0);
  ok(af.k.people === 85 && suma === 1 && llamadas(estado, 'capacity_bump').every(([, b]) => /^[0-9a-f-]{36}$/.test(b.p_op || '')),
    `${nombre}/${t} puerta: se manda agrupado con su p_op y la base dice 85 (${af.k.people}, ${llamadas(estado, 'capacity_bump').length} envío/s)`);
  // Doble toque rápido = 1.
  await p.dblclick('.afd-btn[data-d="1"]');
  await p.waitForTimeout(900);
  ok(await cifra() === '86 / 120' && af.k.people === 86, `${nombre}/${t} puerta: doble toque rápido cuenta 1 (${await cifra()}, base ${af.k.people})`);
  // La red se cae en el envío: se repite con el mismo p_op y cuenta una vez.
  estado.cortaUna = 'capacity_bump';
  await p.click('.afd-btn[data-d="1"]');
  await p.waitForTimeout(600);
  ok(await p.locator('#afdRed').isVisible(), `${nombre}/${t} puerta: «Sin conexión: lo mandamos en cuanto vuelva.»`);
  await p.waitForTimeout(2600);
  const env = llamadas(estado, 'capacity_bump').slice(-2);
  ok(env.length === 2 && env[0][2] === 'cortada' && env[0][1].p_op === env[1][1].p_op && af.k.people === 87 && await cifra() === '87 / 120',
    `${nombre}/${t} puerta: reintento con el mismo p_op, cuenta una vez (${af.k.people})`);
  ok(await p.locator('#afdRed').isHidden(), `${nombre}/${t} puerta: vuelve la red, sin aviso`);
  // Otro del equipo cuenta desde su móvil: en 4 s se ve aquí.
  af.k.people = 100;
  await p.waitForTimeout(4600);
  ok(await cifra() === '100 / 120' && (await p.locator('#afdNivel').innerText()) === 'Casi lleno', `${nombre}/${t} puerta: se pone al día sola (${await cifra()})`);
  // Poner a 0, con su pregunta.
  await p.click('#afdCero');
  await p.waitForSelector('#modal[open]');
  const dlg = await p.locator('#modal').innerText();
  ok(/¿Poner el aforo a 0\?/.test(dlg) && /Hazlo al cerrar\. Al empezar otro día vuelve a 0 solo\./.test(dlg) && /Cancelar/.test(dlg), `${nombre}/${t} puerta: «¿Poner el aforo a 0?»`);
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(500);
  ok(llamadas(estado, 'capacity_reset').length === 1 && await cifra() === '0 / 120' && (await p.locator('#afdNivel').innerText()) === 'Hay sitio', `${nombre}/${t} puerta: «Poner a 0» → 0 / 120 · Hay sitio`);
  // −1 en 0 no hace nada.
  const antes = llamadas(estado, 'capacity_bump').length;
  await p.click('.afd-btn[data-d="-1"]');
  await p.waitForTimeout(700);
  ok(llamadas(estado, 'capacity_bump').length === antes && await cifra() === '0 / 120', `${nombre}/${t} puerta: −1 en 0 no baja`);
  ok(errores.length === 0, `${nombre}/${t} puerta: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

async function ajustes(nav, nombre, t, vp) {
  let { ctx, p, estado, errores } = await contextoPanel(nav, vp);
  await p.goto(`${BASE}/panel/#/aforo/ajustes`);
  await p.waitForSelector('#afdForm');
  const txt = await vista(p);
  ok(/Ajustes del aforo/.test(txt) && /Aforo máximo/.test(txt) && /personas/.test(txt) && /Casi lleno desde/.test(txt) && /Lleno desde/.test(txt),
    `${nombre}/${t} ajustes: campos`);
  ok(/Por debajo del 70 %, «Hay sitio»\./.test(txt), `${nombre}/${t} ajustes: «Por debajo del 70 %, «Hay sitio».»`);
  ok(/El aforo lo pones y lo cuentas tú, y tiene que ser real\. Klendar no controla el aforo legal de tu local\./.test(txt), `${nombre}/${t} ajustes: el aviso`);
  await p.screenshot({ path: `${OUT}/panel-aforo-ajustes-${nombre}-${t}.png`, fullPage: true });
  await p.fill('input[name=max]', '0');
  await p.click('#afdForm button[type=submit]');
  await p.waitForTimeout(300);
  ok(llamadas(estado, 'set_capacity_settings').length === 0 && /entre 1 y 100\.000 personas/.test(await vista(p)), `${nombre}/${t} ajustes: aforo 0 no se manda`);
  await p.fill('input[name=max]', '150');
  await p.fill('input[name=almost]', '80');
  await p.fill('input[name=full]', '82');
  await p.click('#afdForm button[type=submit]');
  await p.waitForTimeout(300);
  ok(llamadas(estado, 'set_capacity_settings').length === 0 && /al menos 5 puntos más/.test(await vista(p)), `${nombre}/${t} ajustes: «Lleno» a menos de 5 puntos no se manda`);
  ok(/Por debajo del 80 %/.test(await vista(p)), `${nombre}/${t} ajustes: la ayuda sigue al porcentaje`);
  await p.fill('input[name=almost]', '60');
  await p.fill('input[name=full]', '90');
  await p.click('#afdForm button[type=submit]');
  await p.waitForTimeout(600);
  const s = llamadas(estado, 'set_capacity_settings')[0]?.[1] || {};
  ok(s.p_business === BIZ && s.p_enabled === true && s.p_max === 150 && s.p_almost === 60 && s.p_full === 90 && /#\/aforo$/.test(p.url()),
    `${nombre}/${t} ajustes: guarda y vuelve a la puerta (${JSON.stringify(s)})`);
  ok(errores.length === 0, `${nombre}/${t} ajustes: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
  // Un empleado: la puerta, sin ajustes.
  ({ ctx, p, estado, errores } = await contextoPanel(nav, vp, { rol: 'staff' }));
  await p.goto(`${BASE}/panel/#/aforo/ajustes`);
  await p.waitForSelector('.afd-btn');
  ok(/#\/aforo$/.test(p.url()) && await p.locator('a[href="#/aforo/ajustes"]').count() === 0, `${nombre}/${t} empleado: ve la puerta sin ajustes`);
  await p.goto(`${BASE}/panel/#/herramientas`);
  await p.waitForSelector('.fiel-card');
  ok(/Aforo en directo/.test(await vista(p)), `${nombre}/${t} empleado: la herramienta en «Más herramientas»`);
  ok(errores.length === 0, `${nombre}/${t} empleado: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

async function resumenYCifras(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contextoPanel(nav, vp);
  await p.goto(`${BASE}/panel/#/herramientas`);
  await p.waitForSelector('.fiel-card');
  let txt = await vista(p);
  ok(/Aforo en directo/.test(txt) && /Cuenta en la puerta con \+1 y −1, y «¿Hay sitio ahora\?» se pone solo\./.test(txt) && /84 \/ 120 ahora/.test(txt),
    `${nombre}/${t} herramientas: «Aforo en directo · 84 / 120 ahora»`);
  ok(/Para decir con un toque cómo está el local: Hay sitio, Casi lleno o Lleno/.test(txt) && !/tranquilo|animado/i.test(txt), `${nombre}/${t} herramientas: niveles con su nombre nuevo`);
  ok(await p.locator('.fiel-card a[href="#/aforo"]').count() === 1, `${nombre}/${t} herramientas: «Abrir» lleva a la puerta`);
  await p.goto(`${BASE}/panel/#/resumen`);
  await p.waitForSelector('.fila-inicio');
  await p.waitForTimeout(500);
  txt = await vista(p);
  ok(/Aforo en directo · 84 \/ 120/.test(txt), `${nombre}/${t} resumen: fila «Aforo en directo · 84 / 120»`);
  // Con el aforo encendido, «¿Hay sitio ahora?» no se repite en el resumen
  // (2026-10-22): marcarlo a mano está en la puerta.
  ok(await p.locator('#aforoCaja .card.aforo').count() === 0, `${nombre}/${t} resumen: sin «¿Hay sitio ahora?» repetido con el aforo encendido`);
  await p.goto(`${BASE}/panel/#/aforo`);
  await p.waitForSelector('#afdSitio .card.aforo');
  txt = await vista(p);
  ok(/Marcado a mano · vuelve al contador a las/.test(txt) && /Volver al contador/.test(txt), `${nombre}/${t} puerta: «Marcado a mano · vuelve al contador…» y «Volver al contador»`);
  const botones = await p.locator('.aforo-botones .btn').allInnerTexts();
  ok(JSON.stringify(botones) === JSON.stringify(['Hay sitio', 'Casi lleno', 'Lleno']), `${nombre}/${t} puerta: Hay sitio · Casi lleno · Lleno (${botones})`);
  await p.locator('#afdSitio .card.aforo').screenshot({ path: `${OUT}/panel-hay-sitio-puerta-${nombre}-${t}.png` });
  await p.click('#afdSitio .card.aforo .linkbtn');
  await p.waitForTimeout(400);
  const c = llamadas(estado, 'set_business_crowd')[0]?.[1] || {};
  ok(c.p_level === null && /Con el aforo en directo, lo que marques manda 30 minutos\./.test(await vista(p)), `${nombre}/${t} puerta: «Volver al contador» quita lo marcado`);
  // Cifras
  await p.goto(`${BASE}/panel/#/informe`);
  await p.waitForSelector('#informeAforo details.plegable');
  const d = p.locator('#informeAforo details');
  ok(/Aforo/.test(await d.locator('summary').innerText()) && /Máximo: 118 a las 0:30/.test(await d.locator('summary').innerText()), `${nombre}/${t} cifras: plegable «Aforo» con su resumen`);
  await d.locator('summary').click();
  txt = await d.innerText();
  ok(/A qué hora se llenó/.test(txt) && /sáb 17 oct/.test(txt) && /vie 16 oct/.test(txt) && /Lleno a las 23:40/.test(txt) && /Casi lleno a las 23:10/.test(txt), `${nombre}/${t} cifras: la noche elegida (${JSON.stringify(txt.slice(0, 300))})`);
  ok(await d.locator('svg.afd-grafica rect').count() === 24 && await d.locator('svg.afd-grafica line.afd-tope').count() === 1, `${nombre}/${t} cifras: 24 barras y la línea del aforo`);
  const relleno = await d.locator('svg.afd-grafica rect').first().evaluate((r) => getComputedStyle(r).fill);
  ok(!/255, 9|255, 8|coral/i.test(relleno), `${nombre}/${t} cifras: barras en tinta (${relleno})`);
  await d.screenshot({ path: `${OUT}/panel-cifras-aforo-${nombre}-${t}.png` });
  await d.locator('[data-noche="1"]').click();
  ok(/No llegó a llenarse/.test(await d.innerText()) && /Máximo: 64 a las 0:00/.test(await d.innerText()), `${nombre}/${t} cifras: otra noche, «No llegó a llenarse»`);
  ok(errores.length === 0, `${nombre}/${t} resumen y cifras: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

async function cuentaAjustes(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contextoPanel(nav, vp, { extra: {
    my_notification_preferences: { notify_favorites: true, notify_room: true }, my_businesses: [], update_notification_preferences: null,
  } });
  await p.goto(`${BASE}/app/#/ajustes/notificaciones`);
  await p.waitForSelector('input[name=sitio]');
  const v = await p.locator('#view').innerText();
  ok(/Cuando haya sitio/.test(v) && /Llega aunque estés en horas de silencio, porque lo has pedido tú\./.test(v) && await p.locator('input[name=sitio]').isChecked(),
    `${nombre}/${t} Tu cuenta: «Cuando haya sitio», encendido, con su ayuda`);
  await p.locator('input[name=sitio]').click({ force: true });
  await p.waitForTimeout(1200);
  const u = llamadas(estado, 'update_notification_preferences').slice(-1)[0]?.[1]?.p || {};
  ok(u.notify_room === false, `${nombre}/${t} Tu cuenta: apagarlo manda notify_room = false`);
  if (nombre === 'chromium' && t === 'movil') await p.locator('input[name=sitio]').locator('xpath=ancestor::label').screenshot({ path: `${OUT}/cuenta-cuando-haya-sitio.png` });
  ok(errores.length === 0, `${nombre}/${t} Tu cuenta: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

// ── Lo público, con las Functions de verdad ────────────────────────────────
const PUB = { marca: 'full' };
function supabasePublico() {
  return createServer((req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    let datos = '';
    req.on('data', (c) => { datos += c; });
    req.on('end', () => {
      const p = new URL(req.url, 'http://x').pathname;
      let body = {};
      try { body = JSON.parse(datos || '{}'); } catch { /* */ }
      const json = (b) => { res.writeHead(200, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(b)); };
      const fn = p.startsWith('/rest/v1/rpc/') ? p.slice('/rest/v1/rpc/'.length) : null;
      if (fn === 'business_profile') {
        return json([{ id: body.p_id, name: 'Sala Prueba', city: 'Madrid', address: 'Calle Mayor 1, 28013 Madrid', lat: 40.4168, lng: -3.7038, is_verified: true,
          member_since: '2026-01-01T00:00:00Z', time_zone: 'Europe/Madrid', description: 'Una sala de prueba.', closed_indefinitely: false, social: {}, opening_hours: ABIERTO }]);
      }
      if (fn === 'business_marks') {
        return json(PUB.marca ? [{ business_id: BIZ, price_level: 2, crowd: PUB.marca, crowd_at: masMin(-5) }] : []);
      }
      if (fn === 'business_hours_status') return json({ ok: true, open_now: true, unconfirmed: false, reported_today: false, can_report: false });
      if (fn === 'public_explore') {
        return json({ total: 1, items: [{ id: '0f000000-0000-4000-8000-0000000af0a1', kind: 'flash_offer', title: 'Dos cañas 3 €', price_cents: 300, currency: 'EUR',
          redeem_start_at: masMin(-60), redeem_end_at: masMin(180), business_id: BIZ, business_name: 'Sala Prueba', lat: 40.4168, lng: -3.7038, images: [], style: {} }] });
      }
      if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, amenities: [], price_level: 2, crowd_enabled: true, entity_kind: null, kitchen_hours: null }]);
      if (fn) return json([]);
      return json([]);
    });
  });
}

async function contextoFicha(nav, vp, { conSesion, rpc = {}, locale = 'es-ES' }) {
  const ctx = await nav.newContext({ viewport: vp, locale, timezoneId: 'Europe/Madrid' });
  if (conSesion) await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
  const estado = { llamadas: [], rpc: { my_businesses: [], my_blocks: [], ...rpc } };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

// «Avísame cuando haya sitio» va dentro de la línea de estado de la ficha
// (2026-10-22): se despliega antes de buscarlo.
const abreEstado = (p) => p.locator('details.estado-neg:not([open]) > summary').click({ timeout: 3000 }).catch(() => {});

async function ficha(nav, nombre, t, vp) {
  const FICHA = `http://localhost:${PUB_PORT}/b/${BIZ}`;
  PUB.marca = 'full';
  // Sin sesión: «Lleno · hace 5 min», sin botón.
  let { ctx, p, estado, errores } = await contextoFicha(nav, vp, { conSesion: false });
  await p.goto(FICHA, { waitUntil: 'networkidle' });
  await p.waitForSelector('.sitio-ahora:not([hidden])');
  ok(/Lleno · hace 5 min/.test(await p.locator('.sitio-ahora').innerText()), `${nombre}/${t} ficha sin sesión: «Lleno · hace 5 min»`);
  await p.waitForTimeout(400);
  ok(await p.locator('[data-hay-sitio]').isHidden() && await p.locator('[data-hs-pedir]').count() === 0, `${nombre}/${t} ficha sin sesión: sin «Avísame cuando haya sitio»`);
  ok(errores.length === 0, `${nombre}/${t} ficha sin sesión: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();

  // Con sesión: el botón, alerts_off, «Te avisaremos…» y «Quitar».
  let pedido = false;
  let intento = 0;
  ({ ctx, p, estado, errores } = await contextoFicha(nav, vp, { conSesion: true, rpc: {
    my_room_alerts: () => (pedido ? [{ business_id: BIZ, from_level: 'full', created_at: masMin(0), expires_at: '2026-10-18T00:30:00Z' }] : []),
    request_room_alert: (b) => {
      intento += 1;
      if (!b.p_enable) return pgError('alerts_off');
      pedido = true;
      return { ok: true, business_id: BIZ, from_level: 'full', expires_at: '2026-10-18T00:30:00Z', created_at: masMin(0) };
    },
    cancel_room_alert: () => { pedido = false; return { ok: true }; },
  } }));
  await p.goto(FICHA, { waitUntil: 'networkidle' });
  await abreEstado(p); await p.waitForSelector('[data-hs-pedir]');
  const boton = p.locator('[data-hs-pedir]');
  ok(/Avísame cuando haya sitio/.test(await boton.innerText()) && !(await boton.evaluate((b) => b.classList.contains('accent'))), `${nombre}/${t} ficha: «Avísame cuando haya sitio», sin coral`);
  await p.locator('.d-head').screenshot({ path: `${OUT}/web-ficha-avisame-${nombre}-${t}.png` });
  await boton.click();
  await p.waitForSelector('dialog.hs-dialogo[open]');
  const dlg = await p.locator('dialog.hs-dialogo').innerText();
  ok(/Tienes apagados los avisos «Cuando haya sitio»\./.test(dlg) && /Activar y avisarme/.test(dlg) && /Ahora no/.test(dlg), `${nombre}/${t} ficha: diálogo de alerts_off`);
  const anchos = await p.locator('dialog.hs-dialogo .pill').evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().width)));
  ok(anchos.length === 2 && Math.abs(anchos[0] - anchos[1]) <= 1, `${nombre}/${t} ficha: los dos botones del diálogo iguales (${anchos})`);
  await p.screenshot({ path: `${OUT}/web-ficha-alerts-off-${nombre}-${t}.png` });
  await p.click('dialog.hs-dialogo [data-si]');
  await p.waitForSelector('[data-hs-quitar]');
  const caja = await p.locator('[data-hay-sitio]').innerText();
  const pide = llamadas(estado, 'request_room_alert').map(([, b]) => b.p_enable);
  ok(/Te avisaremos cuando haya sitio/.test(caja) && /Quitar/.test(caja) && /Te avisaremos una vez, hasta las 2:30\./.test(caja) && JSON.stringify(pide) === '[false,true]',
    `${nombre}/${t} ficha: «Te avisaremos cuando haya sitio · Quitar» y la nota (${caja.replace(/\s+/g, ' ')}; ${pide})`);
  await p.locator('.d-head').screenshot({ path: `${OUT}/web-ficha-te-avisaremos-${nombre}-${t}.png` });
  await p.click('[data-hs-quitar]');
  await abreEstado(p); await p.waitForSelector('[data-hs-pedir]');
  ok(llamadas(estado, 'cancel_room_alert').length === 1, `${nombre}/${t} ficha: «Quitar» → cancel_room_alert y vuelve el botón`);
  ok(errores.length === 0, `${nombre}/${t} ficha con sesión: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();

  // too_many, not_full, team y con sitio.
  for (const [err, re] of [['too_many', /Ya esperas aviso de 5 sitios\. Quita alguno para pedir otro\./], ['not_full', /Ya hay sitio: no hace falta avisarte\./], ['team', null]]) {
    ({ ctx, p, estado, errores } = await contextoFicha(nav, vp, { conSesion: true, rpc: { my_room_alerts: [], request_room_alert: pgError(err) } }));
    await p.goto(FICHA, { waitUntil: 'networkidle' });
    await abreEstado(p); await p.waitForSelector('[data-hs-pedir]');
    await p.click('[data-hs-pedir]');
    await p.waitForTimeout(600);
    if (re) ok(re.test(await p.locator('[data-hay-sitio]').innerText()), `${nombre}/${t} ficha: ${err} lo dice`);
    else ok(await p.locator('[data-hay-sitio]').isHidden(), `${nombre}/${t} ficha: team lo esconde`);
    ok(errores.length === 0, `${nombre}/${t} ficha ${err}: sin errores de JavaScript (${errores.join(' | ')})`);
    await ctx.close();
  }
  PUB.marca = 'quiet';
  ({ ctx, p, estado, errores } = await contextoFicha(nav, vp, { conSesion: true, rpc: { my_room_alerts: [] } }));
  await p.goto(FICHA, { waitUntil: 'networkidle' });
  await p.waitForSelector('.sitio-ahora:not([hidden])');
  await p.waitForTimeout(500);
  ok(/Hay sitio · hace 5 min/.test(await p.locator('.sitio-ahora').innerText()) && await p.locator('[data-hs-pedir]').count() === 0, `${nombre}/${t} ficha con sitio: «Hay sitio», sin botón`);
  await ctx.close();
  // En inglés.
  PUB.marca = 'lively';
  ({ ctx, p, estado, errores } = await contextoFicha(nav, vp, { conSesion: true, rpc: { my_room_alerts: [] }, locale: 'en-GB' }));
  await p.goto(`http://localhost:${PUB_PORT}/en/b/${BIZ}`, { waitUntil: 'networkidle' });
  await abreEstado(p); await p.waitForSelector('[data-hs-pedir]');
  ok(/Nearly full · 5 min ago/.test(await p.locator('.sitio-ahora').innerText()) && /Tell me when there’s room/.test(await p.locator('[data-hs-pedir]').innerText()), `${nombre}/${t} ficha en inglés: «Nearly full» y «Tell me when there’s room»`);
  ok(errores.length === 0, `${nombre}/${t} ficha en inglés: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
  PUB.marca = 'full';
}

async function mapa(nav, nombre, t, vp) {
  PUB.marca = 'full';
  const { ctx, p, errores } = await contextoFicha(nav, vp, { conSesion: true, rpc: { my_room_alerts: [] } });
  await p.goto(`http://localhost:${PUB_PORT}/explorar/?vista=mapa&ciudad=Madrid`, { waitUntil: 'load' });
  const hay = await p.waitForSelector('.chincheta', { timeout: 20000 }).then(() => true).catch(() => false);
  if (!hay) { console.log(`aviso: ${nombre}/${t} mapa: Mapbox no ha cargado aquí; no se prueba la tarjeta`); await ctx.close(); return; }
  await p.waitForTimeout(800);
  await p.locator('.chincheta').first().click();
  const sale = await p.waitForSelector('.pop-caja [data-hs-pedir]', { timeout: 8000 }).then(() => true).catch(() => false);
  ok(sale && /Lleno · hace 5 min/.test(await p.locator('.pop-caja').innerText()), `${nombre}/${t} mapa: la tarjeta con «Lleno» y «Avísame cuando haya sitio»`);
  await p.locator('.mapboxgl-popup').screenshot({ path: `${OUT}/web-mapa-tarjeta-${nombre}-${t}.png` }).catch(() => {});
  if (nombre === 'chromium') await p.screenshot({ path: `${OUT}/web-mapa-${nombre}-${t}.png` });
  ok(errores.length === 0, `${nombre}/${t} mapa: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

let servidor = null;
let falso = null;
if (!SOLO || /ficha|mapa/.test(SOLO)) {
  falso = supabasePublico();
  await new Promise((r) => falso.listen(FALSO_PORT, r));
  servidor = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(PUB_PORT), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa' }, stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 2000));
}

const PRUEBAS = { puerta, ajustes, resumenYCifras, cuentaAjustes, ficha, mapa };
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
if (servidor) servidor.kill();
if (falso) falso.close();
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
