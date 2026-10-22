// Revisión de la tanda D (2026-10-22): los fallos de paridad y seguridad que
// se arreglaron en la web, cada uno con su prueba. El panel y «Tu cuenta»
// con un Supabase de mentira (no tocan dev ni mandan nada); Explorar, contra
// dev y solo leyendo; la ficha de una publicación, con las Functions de
// verdad contra un Supabase de mentira.
//
//  Panel
//   1. Quishing: un QR (o enlace pegado) que lleva a otra web no se valida:
//      «Este QR lleva a otra-web.com» (y en alemán); uno de klendar.app sí.
//   2. `team_code`: «No puedes validar un código tuyo ni de tu equipo.»
//   3. Equipo: el encargado no se ve botones para cambiarse ni quitarse.
//   4. «Cerrar por hoy» de madrugada cierra hasta las 5:00 de hoy (no 27 h);
//      por la tarde, hasta las 5:00 de mañana.
//   5. Con el negocio bloqueado, el QR de cliente no ofrece «Cargar un bono».
//   6. Con 3 sorteos abiertos o 20 bonos, «Crear…» desactivado y por qué.
//   7. Un empleado en «Listas de esta noche» sin nadie apuntado: lo dice.
//   8. «Primera visita» no sale en una publicación de RRPP.
//   9. Una entidad no abre aforo, wifi, menú del día ni pedidos escribiendo
//      la dirección: vuelve al resumen.
//  Tu cuenta
//  10. `#/recibo/<id>` de un canje de hace más de 50: lo encuentra. Y «Escanear
//      un QR» de la persona solo abre klendar.app (otra web: «Este QR lleva a …»).
//  11. Con solo un turno de cola o un pedido, sin la pantalla vacía (Planes
//      y Tus códigos).
//  Explorar (contra dev)
//  12. Calendario: «Ver resultados» conserva «¿Cuándo?» (F2).
//  13. Planes → Sitios → Planes conserva ¿Cuándo?, Precio y el Calendario
//      (F3), y Explorar recuerda el Calendario (F4).
//  Ficha de la publicación
//  14. Agotada sin código (entradas fuera): sin «Apuntarme a la lista de
//      espera»; agotada con reserva, con ella.
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PORT=8894 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8894 node tools/revision_d_check.mjs
// (la ficha arranca su propio serve_dev en FICHA_PORT, 8905, contra un
// Supabase de mentira en FALSO_PORT, 8906)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8894';
const OUT = process.env.OUT || '.';
const SOLO = process.env.SOLO || '';
const FICHA_PORT = Number(process.env.FICHA_PORT || 8905);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8906);
mkdirSync(OUT, { recursive: true });
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-0000000d0e01';
const BIZ = 'b1000000-0000-4000-8000-0000000d0e01';
const AQUI = 'lat=40.417&lng=-3.704';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'revision.d@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const sub = (blocked = false) => ({ plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: blocked ? 'past_due' : 'active',
  period_end: '2027-01-01T00:00:00Z', payment_method: 'transfer', price_cents: 1990, active_offers: 0, max_active_offers: null, has_analytics: true,
  billing: { enabled: true, blocked, hold: blocked ? 'unpaid' : null, block_soon: false, block_kind: blocked ? 'trial' : null } });

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
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, vp, { rol = 'owner', blocked = false, rpc = {}, idioma = 'es', hora = null } = {}) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', l); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion(), idioma]);
  const estado = { llamadas: [], rpc: {} };
  Object.assign(estado.rpc, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: [{ id: BIZ, name: 'Bar Revisión', role: rol, verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
    business_is_organizer: false,
    my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
    my_subscription: sub(blocked),
    business_stats: { redemptions_30d: 0 },
    my_business_offers: [],
    business_tools_overview: { ok: true, can_edit: rol !== 'staff', team: { members: 2 }, series: { rules_active: 0 } },
    my_blocks: [],
    ...rpc,
  });
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  if (hora) await p.clock.setFixedTime(new Date(hora));
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}
const vista = (p) => p.locator('#view').innerText();
const llamadas = (estado, fn) => estado.llamadas.filter(([f]) => f === fn);

// ── 1 y 2. Validar: quishing y `team_code` ───────────────────────────────────
async function validar(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, {
    rpc: { validate_redemption: (b) => (b.p_code === 'abcdef12' ? { ok: false, error: 'team_code' } : { ok: false, error: 'invalid_code' }) },
  });
  await p.goto(`${BASE}/panel/#/validar`);
  await p.waitForSelector('#code');
  const valida = async (texto) => { await p.fill('#code', texto); await p.click('#go'); await p.waitForTimeout(500); return p.locator('#result').innerText(); };
  let r = await valida('https://otra-web.com/r/abcdef12');
  ok(/Este QR lleva a otra-web\.com/.test(r) && llamadas(estado, 'validate_redemption').length === 0, `${nombre}/${t} quishing: «Este QR lleva a otra-web.com» y no se valida (${r.replace(/\s+/g, ' ')})`);
  await p.locator('#result').screenshot({ path: `${OUT}/rev-quishing-${nombre}-${t}.png` }).catch(() => {});
  r = await valida('http://klendar.app.otra-web.com/r/abcdef12');
  ok(/Este QR lleva a klendar\.app\.otra-web\.com/.test(r) && llamadas(estado, 'validate_redemption').length === 0, `${nombre}/${t} quishing: un dominio que se hace pasar por klendar.app tampoco`);
  r = await valida('www.otra-web.com/r/abcdef12');
  ok(/Este QR lleva a otra-web\.com/.test(r), `${nombre}/${t} quishing: «www.» sin http`);
  // Uno de klendar.app sí llega a la base; la base dice `team_code`.
  r = await valida('https://klendar.app/r/abcdef12');
  const l = llamadas(estado, 'validate_redemption');
  ok(l.length === 1 && l[0][1].p_code === 'abcdef12', `${nombre}/${t} un QR de klendar.app se valida (${JSON.stringify(l)})`);
  ok(/No puedes validar un código tuyo ni de tu equipo\./.test(r), `${nombre}/${t} team_code: su texto (${r.replace(/\s+/g, ' ')})`);
  // Un código a mano, como siempre.
  r = await valida('0882 7EC7');
  ok(/Ese código no existe/.test(r) && llamadas(estado, 'validate_redemption').length === 2, `${nombre}/${t} un código tecleado, como siempre`);
  ok(errores.length === 0, `${nombre}/${t} validar sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
  // En alemán.
  const de = await contexto(nav, vp, { idioma: 'de', rpc: { validate_redemption: { ok: false, error: 'team_code' } } });
  await de.p.goto(`${BASE}/panel/#/validar`);
  await de.p.waitForSelector('#code');
  await de.p.waitForTimeout(800);
  await de.p.fill('#code', 'https://otra-web.com/x');
  await de.p.click('#go');
  await de.p.waitForTimeout(500);
  r = await de.p.locator('#result').innerText();
  ok(/Dieser QR-Code führt zu otra-web\.com/.test(r), `${nombre}/${t} quishing en alemán (${r.replace(/\s+/g, ' ')})`);
  await de.p.fill('#code', 'abcdef12');
  await de.p.click('#go');
  await de.p.waitForTimeout(500);
  r = await de.p.locator('#result').innerText();
  ok(/Du kannst keinen Code von dir oder deinem Team prüfen/.test(r), `${nombre}/${t} team_code en alemán`);
  await de.ctx.close();
}

// ── 3. Equipo ───────────────────────────────────────────────────────────────
async function equipo(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, {
    rol: 'manager',
    rpc: {
      business_team: [
        { user_id: 'f0000000-0000-4000-8000-000000000001', role: 'owner', display_name: 'Dueña', email: 'duena@example.com' },
        { user_id: U, role: 'manager', display_name: 'Yo', email: 'revision.d@example.com' },
        { user_id: 'f0000000-0000-4000-8000-000000000003', role: 'staff', display_name: 'Otro', email: 'otro@example.com' },
      ],
      business_invites_list: [],
    },
  });
  await p.goto(`${BASE}/panel/#/equipo`);
  await p.waitForSelector('[data-remove]');
  ok(await p.locator(`[data-user="${U}"], [data-remove="${U}"]`).count() === 0, `${nombre}/${t} equipo: el encargado no puede cambiarse ni quitarse`);
  ok(await p.locator('[data-remove="f0000000-0000-4000-8000-000000000003"]').count() === 1, `${nombre}/${t} equipo: a los demás, sí`);
  ok(errores.length === 0, `${nombre}/${t} equipo sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// ── 4. «Cerrar por hoy» ─────────────────────────────────────────────────────
async function cerrarHoy(nav, nombre, t, vp) {
  for (const [hora, espera, txt] of [['2026-10-22T00:30:00Z', '2026-10-22T03:00:00.000Z', 'de madrugada (2:30)'], ['2026-10-22T12:00:00Z', '2026-10-23T03:00:00.000Z', 'a las 14:00']]) {
    const { ctx, p, estado, errores } = await contexto(nav, vp, { hora, rpc: { set_business_pause: null } });
    await p.goto(`${BASE}/panel/#/resumen`);
    await p.waitForSelector('#pausa');
    await p.click('#pausa');
    await p.waitForTimeout(600);
    const l = llamadas(estado, 'set_business_pause')[0];
    ok(l && l[1].p_until === espera, `${nombre}/${t} «Cerrar por hoy» ${txt}: hasta ${espera} (${l && l[1].p_until})`);
    ok(errores.length === 0, `${nombre}/${t} cerrar por hoy sin errores JS ${errores.join(' | ')}`);
    await ctx.close();
  }
}

// ── 5. Bonos con el negocio bloqueado ───────────────────────────────────────
async function bonosParado(nav, nombre, t, vp) {
  const scan = { scan_id: 's1', scan_until: '2099-01-01T00:00:00Z', customer: { name: 'Ana' }, can_manage: true,
    passes: [{ id: 'p1', name: '10 cafés', uses_left: 4, uses_total: 10, state: 'active', uses: [] }],
    types: [{ id: 't1', name: '10 cafés', uses: 10, price_cents: 1200 }] };
  for (const blocked of [true, false]) {
    const { ctx, p, errores } = await contexto(nav, vp, { blocked, rpc: { pass_scan: scan } });
    await p.goto(`${BASE}/panel/#/validar`);
    await p.waitForSelector('#code');
    await p.fill('#code', '0123456789abcdef.1234567890.0123456789ab');
    await p.click('#go');
    await p.waitForSelector('.bono-cliente');
    const caja = await p.locator('.bono-cliente').innerText();
    if (blocked) {
      ok(await p.locator('#bono-cargar').count() === 0 && /no cargar bonos nuevos/.test(caja) && await p.locator('[data-usa]').count() === 1,
        `${nombre}/${t} bloqueado: descontar sí, «Cargar un bono» no, y lo dice`);
      await p.locator('.bono-cliente').screenshot({ path: `${OUT}/rev-bono-parado-${nombre}-${t}.png` }).catch(() => {});
    } else {
      ok(await p.locator('#bono-cargar').count() === 1, `${nombre}/${t} sin bloquear: «Cargar un bono»`);
    }
    ok(errores.length === 0, `${nombre}/${t} bonos sin errores JS ${errores.join(' | ')}`);
    await ctx.close();
  }
}

// ── 6. Topes de sorteos y bonos ─────────────────────────────────────────────
async function topes(nav, nombre, t, vp) {
  const g = (i) => ({ id: `g${i}`, prize: `Premio ${i}`, status: 'active', ends_at: '2099-01-01T00:00:00Z', stats: {} });
  const ty = (i) => ({ id: `t${i}`, name: `Bono ${i}`, uses: 5, price_cents: 1000, status: 'active', stats: {} });
  const { ctx, p, errores } = await contexto(nav, vp, {
    rpc: { business_giveaways: { can_manage: true, giveaways: [g(1), g(2), g(3)] }, business_pass_types: { can_manage: true, types: Array.from({ length: 20 }, (_, i) => ty(i)), totals: {} } },
  });
  await p.goto(`${BASE}/panel/#/sorteos`);
  await p.waitForSelector('.page-head');
  ok(await p.locator('.page-head button[disabled]', { hasText: 'Crear un sorteo' }).count() === 1 && await p.locator('a[href="#/sorteos/nuevo"]').count() === 0
    && /Puedes tener 3 sorteos abiertos a la vez/.test(await vista(p)), `${nombre}/${t} 3 sorteos abiertos: «Crear un sorteo» desactivado y por qué`);
  await p.goto(`${BASE}/panel/#/bonos`);
  await p.waitForSelector('.kpis');
  ok(await p.locator('.page-head button[disabled]', { hasText: 'Crear un bono' }).count() === 1 && await p.locator('a[href="#/bonos/nuevo"]').count() === 0
    && /Como mucho 20 bonos/.test(await vista(p)), `${nombre}/${t} 20 bonos: «Crear un bono» desactivado y por qué`);
  ok(errores.length === 0, `${nombre}/${t} topes sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// ── 7. Listas de esta noche (empleado) ──────────────────────────────────────
async function listas(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, { rol: 'staff', rpc: { door_list: { ok: true, items: [] } } });
  await p.goto(`${BASE}/panel/#/resumen`);
  await p.waitForSelector('.esencial');
  const enlace = p.locator('.esencial a', { hasText: 'Listas de esta noche' });
  ok(await enlace.count() === 1, `${nombre}/${t} empleado: «Listas de esta noche» en Lo esencial`);
  await enlace.click();
  await p.waitForSelector('#code');
  await p.waitForTimeout(800);
  ok(/Nadie se ha apuntado aún esta noche/.test(await vista(p)), `${nombre}/${t} empleado sin nadie apuntado: lo dice`);
  // Validar a secas (sin venir de ahí): sin la caja vacía.
  await p.goto(`${BASE}/panel/#/resumen`);
  await p.waitForSelector('.esencial');
  await p.goto(`${BASE}/panel/#/validar`);
  await p.waitForSelector('#code');
  await p.waitForTimeout(800);
  ok(!/Nadie se ha apuntado aún esta noche/.test(await vista(p)), `${nombre}/${t} «Validar códigos» a secas: sin la caja vacía`);
  ok(errores.length === 0, `${nombre}/${t} listas sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// ── 8. «Primera visita» y RRPP ──────────────────────────────────────────────
async function primeraVisita(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, { rpc: { business_promoters_list: [{ id: 'r1', name: 'Rafa', status: 'active' }] } });
  await p.goto(`${BASE}/panel/#/publicaciones/nueva-flash`);
  await p.waitForSelector('#primeraRow', { state: 'attached' });
  const visible = () => p.locator('#primeraRow').evaluate((el) => !el.hidden);
  ok(await visible(), `${nombre}/${t} formulario: «Primera visita» con «Todo el mundo»`);
  const rrpp = p.locator('input[name="audience"][value="promoters"]');
  if (await rrpp.count()) {
    await rrpp.evaluate((el) => { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); });
    ok(!(await visible()), `${nombre}/${t} formulario: con «Solo con el enlace de un RRPP», sin «Primera visita»`);
    await p.locator('input[name="audience"][value="all"]').evaluate((el) => { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); });
    ok(await visible(), `${nombre}/${t} formulario: vuelve con «Todo el mundo»`);
  } else ok(false, `${nombre}/${t} formulario: sin la opción de RRPP`);
  ok(errores.length === 0, `${nombre}/${t} formulario sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// ── 9. Entidad ──────────────────────────────────────────────────────────────
async function entidad(nav, nombre, t, vp) {
  // Lo que pide cada herramienta al abrirse (pedidos usa lo mismo que el resumen).
  const PIDE = { aforo: 'capacity_status', 'wifi-clientes': 'business_table_qr', 'menu-del-dia': 'daily_menu_setup', pedidos: null };
  const { ctx, p, estado, errores } = await contexto(nav, vp, { rpc: { my_entity_application: { entity_kind: 'association', can_apply: false, why: null, application: null } } });
  await p.goto(`${BASE}/panel/#/resumen`);
  await p.waitForSelector('#view h1, #view .page-head');
  for (const r of ['aforo', 'wifi-clientes', 'menu-del-dia', 'pedidos']) {
    await p.goto(`${BASE}/panel/#/${r}`);
    await p.waitForTimeout(900);
    // El resumen lleva «Lo esencial»; la herramienta, no.
    const resumen = await p.locator('#view nav.esencial').count();
    ok(resumen === 1 && (!PIDE[r] || llamadas(estado, PIDE[r]).length === 0), `${nombre}/${t} entidad: #/${r} vuelve al resumen${PIDE[r] ? ` (sin pedir ${PIDE[r]})` : ''}`);
  }
  ok(errores.length === 0, `${nombre}/${t} entidad sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// ── 10 y 11. «Tu cuenta» ────────────────────────────────────────────────────
const canje = (i, extra = {}) => ({ id: `c0000000-0000-4000-8000-${String(i).padStart(12, '0')}`, offer_id: 'o1', offer_title: `Café ${i}`, business_name: 'Bar Revisión',
  business_id: BIZ, status: 'validated', code: 'abcdef1234', created_at: '2026-01-01T10:00:00Z', validated_at: '2026-01-01T10:05:00Z', expires_at: '2026-01-01T11:00:00Z', seats: 1, ...extra });
async function cuenta(nav, nombre, t, vp) {
  const objetivo = canje(73);
  let { ctx, p, errores } = await contexto(nav, vp, {
    rpc: { my_redemptions: (b) => { const off = Number(b.p_offset) || 0; const n = Number(b.p_limit) || 50; return Array.from({ length: Math.max(0, Math.min(n, 120 - off)) }, (_, i) => canje(off + i)); } },
  });
  await p.goto(`${BASE}/app/#/recibo/${objetivo.id}`);
  await p.waitForTimeout(1500);
  // «Escanear un QR» de la persona: solo abre klendar.app; otra web con la
  // misma ruta dice adónde lleva (quishing), como la app y el panel.
  const qr = await p.evaluate(() => ({
    ajena: webAjenaQr('https://otra-web.com/m/Ab3_dE5-gH7jK9mN'),
    disfrazada: webAjenaQr('https://klendar.app.evil.io/v/Ab3_dE5-gH7jK9mN'),
    buena: webAjenaQr('https://klendar.app/m/Ab3_dE5-gH7jK9mN'),
    destinoAjena: destinoQr('https://otra-web.com/m/Ab3_dE5-gH7jK9mN'),
    mesa: destinoQr('https://klendar.app/m/Ab3_dE5-gH7jK9mN'),
  }));
  ok(qr.ajena === 'otra-web.com' && qr.disfrazada === 'klendar.app.evil.io' && qr.buena === null && qr.destinoAjena === null
    && qr.mesa === '/m/Ab3_dE5-gH7jK9mN', `${nombre}/${t} escanear: solo klendar.app; otra web, «Este QR lleva a …» (${JSON.stringify(qr)})`);
  let v = await p.locator('#view').innerText().catch(() => '');
  ok(/Recibo/.test(v) && /Café 73/.test(v), `${nombre}/${t} recibo de un canje de hace más de 50: lo encuentra`);
  await p.goto(`${BASE}/app/#/recibo/c0000000-0000-4000-8000-999999999999`);
  await p.waitForTimeout(1500);
  v = await p.locator('#view').innerText().catch(() => '');
  ok(/Ese recibo no está/.test(v), `${nombre}/${t} recibo que no existe: «Ese recibo no está.»`);
  ok(errores.length === 0, `${nombre}/${t} recibo sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
  // Solo un pedido en marcha.
  const pedido = { code: 'ABC123', number: 7, status: 'waiting', business: { name: 'Café Sonda' } };
  ({ ctx, p, errores } = await contexto(nav, vp, { rpc: { my_orders: [pedido], my_queue_turns: [], my_redemptions: [], my_saved_offers: [], my_followed_series: [] } }));
  for (const [ruta, vacio] of [['planes', 'Aún no tienes planes'], ['codigos', 'Todavía no tienes códigos']]) {
    await p.goto(`${BASE}/app/#/${ruta}`);
    await p.waitForTimeout(1500);
    v = await p.locator('#view').innerText().catch(() => '');
    ok(/Tu pedido en Café Sonda/.test(v) && await p.locator('.vacio, .pantalla-vacia, .estado-vacio').count() === 0 && !new RegExp(`^${vacio}$`, 'm').test(v),
      `${nombre}/${t} ${ruta} con solo un pedido: el pedido, sin la pantalla vacía`);
  }
  await p.screenshot({ path: `${OUT}/rev-codigos-pedido-${nombre}-${t}.png` }).catch(() => {});
  ok(errores.length === 0, `${nombre}/${t} cuenta sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// ── 12 y 13. Explorar (contra dev, solo leyendo) ────────────────────────────
async function explorar(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  // Con dev lento, la página puede tardar: se espera a la hoja antes de leerla.
  const datosHoja = async () => {
    await p.waitForSelector('form.hoja-cuerpo', { state: 'attached', timeout: 15000 });
    return p.evaluate(() => [...new FormData(document.querySelector('form.hoja-cuerpo')).entries()].map(([k, v]) => `${k}=${v}`));
  };
  // F2: el calendario conserva «¿Cuándo?» al «Ver resultados».
  await p.goto(`${BASE}/explorar/?cuando=hoy&vista=calendario&${AQUI}`);
  let d = await datosHoja();
  ok(d.includes('cuando=hoy') && d.includes('vista=calendario'), `${nombre}/${t} calendario: la hoja conserva «¿Cuándo?» (${d.join('&')})`);
  // F3: Planes → Sitios → Planes.
  await p.goto(`${BASE}/explorar/?cuando=hoy&precio=gratis&vista=calendario&${AQUI}`);
  await p.click('nav.que a:nth-child(2)');
  await p.waitForLoadState('load');
  let u = new URL(p.url());
  ok(u.searchParams.get('que') === 'sitios' && u.searchParams.get('cuando') === 'hoy' && u.searchParams.get('precio') === 'gratis',
    `${nombre}/${t} Planes → Sitios: ¿Cuándo? y Precio siguen en la dirección (${u.search})`);
  d = await datosHoja();
  ok(d.includes('cuando=hoy') && d.includes('precio=gratis'), `${nombre}/${t} Sitios: la hoja los conserva al «Ver resultados»`);
  ok(/sitio/.test(await p.locator('.resumen-n').innerText()), `${nombre}/${t} Sitios: los sitios, sin filtrar por lo de Planes`);
  await p.click('nav.que a:nth-child(1)');
  await p.waitForLoadState('load');
  u = new URL(p.url());
  ok(!u.searchParams.get('que') && u.searchParams.get('cuando') === 'hoy' && u.searchParams.get('precio') === 'gratis' && u.searchParams.get('vista') === 'calendario',
    `${nombre}/${t} Sitios → Planes: vuelven ¿Cuándo?, Precio y el Calendario (${u.search})`);
  // F4: Explorar recuerda el Calendario.
  await p.goto(`${BASE}/explorar/`);
  // La vuelta a lo último es un `location.replace` del script de la página:
  // se espera a que llegue (en WebKit, a veces después del `load`).
  await p.waitForURL(/[?&]vista=calendario/, { timeout: 8000 }).catch(() => {});
  u = new URL(p.url());
  ok(u.searchParams.get('vista') === 'calendario', `${nombre}/${t} /explorar/ sin nada: abre el Calendario, lo último (${u.search})`);
  // Y vuelve a la lista cuando se elige.
  await p.click('nav.vistas a.vista:nth-child(2)');
  await p.waitForLoadState('load');
  await p.goto(`${BASE}/explorar/`);
  await p.waitForLoadState('load');
  await p.waitForTimeout(500);
  ok(!new URL(p.url()).searchParams.get('vista'), `${nombre}/${t} tras elegir Lista, /explorar/ abre la lista`);
  ok(errores.length === 0, `${nombre}/${t} explorar sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// ── 14. La ficha de una publicación agotada ─────────────────────────────────
const OFERTAS = {
  'e1000000-0000-4000-8000-0000000d0e01': { title: 'Concierto con entradas fuera', reservations_enabled: false, external_url: 'https://dice.fm/event/x' },
  'e2000000-0000-4000-8000-0000000d0e01': { title: 'Cena con reserva', reservations_enabled: true, external_url: null },
};
function supabaseFicha() {
  return createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; });
    req.on('end', () => {
      const json = (b) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
      let args = {};
      try { args = JSON.parse(cuerpo || '{}'); } catch { /* */ }
      if (url.pathname === '/rest/v1/rpc/offer_detail') {
        const o = OFERTAS[args.p_id];
        if (!o) return json(null);
        return json({ id: args.p_id, kind: 'future_event', status: 'sold_out', seats_left: 0, max_seats: 1, audience: 'all', business_id: BIZ, business_name: 'Sala Sonda',
          business_city: 'Madrid', event_at: '2099-06-01T19:00:00Z', event_end_at: '2099-06-01T22:00:00Z', images: [], time_zone: 'Europe/Madrid', ...o });
      }
      if (url.pathname.startsWith('/rest/v1/rpc/')) return json(null);
      return json([]);
    });
  });
}
async function ficha(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  const p = await ctx.newPage();
  for (const [id, o] of Object.entries(OFERTAS)) {
    const r = await p.goto(`http://localhost:${FICHA_PORT}/o/${id}`, { waitUntil: 'domcontentloaded' });
    const espera = await p.locator('a[href*="#/espera/"]').count();
    if (o.reservations_enabled) ok(r.status() === 200 && espera === 1, `${nombre}/${t} agotada con reserva: «Apuntarme a la lista de espera»`);
    else ok(r.status() === 200 && espera === 0 && /Entradas en|Conseguir entradas/.test(await p.locator('body').innerText()), `${nombre}/${t} agotada con entradas fuera: sin lista de espera, «Conseguir entradas»`);
  }
  await ctx.close();
}

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

const PRUEBAS = { validar, equipo, cerrarHoy, bonosParado, topes, listas, primeraVisita, entidad, cuenta, explorar, ficha };
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
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
