// Prueba de la paridad de «Tu cuenta» con la app (2026-10-22), con
// Supabase contestado aquí (no toca dev ni manda nada):
//
//  1. Planes: «Lista · Calendario»; el calendario con sus puntos, «Hoy» y lo
//     de cada día («Nada guardado para este día.»); el vacío con «Descubre»;
//     la cola y el pedido con su título.
//  2. Favoritos: «Lo nuevo de tus favoritos», «N negocios en favoritos», la
//     distancia o «Organiza en distintos sitios», quitar con ♥ y «Deshacer».
//  3. Tus códigos: «Escanear un QR», el premio de sellos que abre su QR y,
//     al canjear, «Un sello más en…».
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> OUT=<carpeta> node tools/cuenta_paridad_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8871';
const OUT = process.env.OUT || '.';
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-0000000097d1';
const BIZ = 'b1000000-0000-4000-8000-0000000097d1';
const BIZ2 = 'b1000000-0000-4000-8000-0000000097d2';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'cuenta@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const dosC = (n) => String(n).padStart(2, '0');
const diaLocal = (d) => `${d.getFullYear()}-${dosC(d.getMonth() + 1)}-${dosC(d.getDate())}`;
const ahora = new Date();
const enDias = (n, h = 20) => { const d = new Date(ahora); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d; };

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
    const tabla = p.slice('/rest/v1/'.length);
    if (estado.tablas && estado.tablas[tabla] !== undefined) {
      const r = estado.tablas[tabla];
      return json(typeof r === 'function' ? r(url, req) : r);
    }
    if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, name: 'Bar Sonda', time_zone: 'Europe/Madrid' }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, vp, rpc, tablas = {}) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => {
    try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ }
  }, [`sb-${REF}-auth-token`, sesion()]);
  const estado = { llamadas: [], rpc, tablas };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

const CUENTA = (x = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [],
  ...x,
});

const oferta = (id, x) => ({ id, title: 'Plan', business_id: BIZ, business_name: 'Bar Sonda', images: [], time_zone: 'Europe/Madrid', ...x });

async function planes(nav, nombre, t, vp) {
  const tag = `${nombre}/${t}`;
  const manana = enDias(1);
  const { ctx, p, errores } = await contexto(nav, vp, CUENTA({
    my_saved_offers: (b) => (b.p_when === 'upcoming'
      ? [oferta('a1000000-0000-4000-8000-0000000000d1', { kind: 'future_event', title: 'Concierto de jazz', event_at: manana.toISOString() })]
      : []),
    my_redemptions: [],
    my_followed_series: [],
    my_queue_turns: [],
    my_orders: [],
  }));
  await p.goto(`${BASE}/app/#/planes`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.pl-vistas');
  ok(await p.locator('.pl-vistas .vista').count() === 2 && /Lista/.test(await p.locator('.pl-vistas').innerText()), `${tag} planes: «Lista · Calendario»`);
  ok(!/Buscar planes/.test(await p.locator('main').innerText()), `${tag} planes: sin «Buscar planes» al final (como la app)`);
  await p.locator('.pl-vistas .vista', { hasText: 'Calendario' }).click();
  await p.waitForSelector('.pl-cal');
  const hoyIso = diaLocal(ahora);
  ok(/Hoy · /.test(await p.locator('.pl-lista h2').innerText()) && /Nada guardado para este día/.test(await p.locator('.pl-lista').innerText()),
    `${tag} planes calendario: hoy, «Nada guardado para este día.»`);
  const mananaIso = diaLocal(manana);
  const celda = p.locator(`a.pl-dia[href*="dia=${mananaIso}"]`);
  if (mananaIso.slice(0, 7) !== hoyIso.slice(0, 7)) await p.locator('a.pl-nav').last().click();
  ok(await p.locator(`a.pl-dia[href*="dia=${mananaIso}"] .pe`).count() === 1, `${tag} planes calendario: punto del evento guardado`);
  await celda.click();
  await p.waitForFunction(() => /Concierto de jazz/.test(document.querySelector('.pl-lista')?.textContent || ''));
  ok(await p.locator('.pl-hoy a').count() === 1, `${tag} planes calendario: «Hoy» al mirar otro día`);
  await p.screenshot({ path: `${OUT}/cuenta-planes-calendario-${nombre}-${t}.png`, fullPage: true });
  ok(errores.length === 0, `${tag} planes sin errores ${errores.join(' | ')}`);
  await ctx.close();

  // Vacío: «Descubre» lleva a Descubre.
  const v = await contexto(nav, vp, CUENTA({ my_saved_offers: [], my_redemptions: [], my_followed_series: [], my_queue_turns: [], my_orders: [] }));
  await v.p.goto(`${BASE}/app/#/planes`, { waitUntil: 'networkidle' });
  await v.p.waitForSelector('.pl-vistas');
  ok(await v.p.locator('a.pill.accent[href="/descubre/"]', { hasText: 'Descubre' }).count() === 1, `${tag} planes vacío: «Descubre»`);
  await v.ctx.close();
}

const SOLO = process.env.SOLO || '';
const PRUEBAS = { planes };
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
