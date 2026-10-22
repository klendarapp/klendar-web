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
async function favoritos(nav, nombre, t, vp) {
  const tag = `${nombre}/${t}`;
  let quitado = false;
  const { ctx, p, estado, errores } = await contexto(nav, vp, CUENTA({
    my_favorites: () => ([{ id: BIZ, name: 'Bar Sonda', logo: null, category_id: 'c1', city: 'Madrid', distance_m: 1200, active_flash: 1, upcoming_events: 0 },
      { id: BIZ2, name: 'Fiestas Luna', logo: null, category_id: 'c1', city: 'Madrid', distance_m: 300, active_flash: 0, upcoming_events: 2 }].filter((b) => !quitado || b.id !== BIZ)),
    favorites_feed: [oferta('a1000000-0000-4000-8000-0000000000e1', { kind: 'future_event', title: 'Noche de vinilos', event_at: enDias(2).toISOString() })],
    public_organizers: [BIZ2],
    toggle_favorite: () => { quitado = !quitado; return !quitado; },
  }), { categories: [{ id: 'c1', names: { es: 'Bares', en: 'Bars' } }] });
  await p.addInitScript(() => { try { localStorage.setItem('klendar.filtros', JSON.stringify({ t: Date.now(), es: 'lat=40.416&lng=-3.703&km=5' })); } catch { /* */ } });
  await p.goto(`${BASE}/app/#/favoritos`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.fav-lista');
  const txt = await p.locator('main').innerText();
  ok(/Lo nuevo de tus favoritos/.test(txt) && /Noche de vinilos/.test(txt), `${tag} favoritos: «Lo nuevo de tus favoritos»`);
  ok(/2 negocios en favoritos/.test(txt), `${tag} favoritos: «2 negocios en favoritos»`);
  ok(/Bares · 1,2 km/.test(txt) && /Bares · Organiza en distintos sitios/.test(txt), `${tag} favoritos: categoría · distancia u «Organiza en distintos sitios»`);
  ok(estado.llamadas.some(([f, b]) => f === 'my_favorites' && b.p_lat === 40.416), `${tag} favoritos: con la última posición de Explorar`);
  await p.screenshot({ path: `${OUT}/cuenta-favoritos-${nombre}-${t}.png`, fullPage: true });
  await p.locator(`[data-quitar-fav="${BIZ}"]`).click();
  const aviso = await p.waitForFunction(() => /quitado de favoritos/.test(document.getElementById('toast')?.textContent || ''), null, { timeout: 8000 }).then(() => true, () => false);
  const uno = await p.waitForFunction(() => /1 negocio en favoritos/.test(document.querySelector('main')?.textContent || ''), null, { timeout: 8000 }).then(() => true, () => false);
  ok(aviso && uno, `${tag} favoritos: ♥ quita (${uno}) y avisa «Bar Sonda quitado de favoritos» (${aviso}) ${await p.locator('#toast').textContent()}`);
  await p.locator('#toast .toast-accion').click();
  await p.waitForFunction(() => /2 negocios en favoritos/.test(document.querySelector('main')?.textContent || ''));
  ok(!quitado, `${tag} favoritos: «Deshacer» lo vuelve a añadir`);
  ok(errores.length === 0, `${tag} favoritos sin errores ${errores.join(' | ')}`);
  await ctx.close();
  const v = await contexto(nav, vp, CUENTA({ my_favorites: [], favorites_feed: [], public_organizers: [] }));
  await v.p.goto(`${BASE}/app/#/favoritos`, { waitUntil: 'networkidle' });
  await v.p.waitForSelector('.vacio, .empty, a.pill.accent');
  ok(await v.p.locator('a.pill.accent[href="/descubre/"]', { hasText: 'Descubrir negocios' }).count() === 1, `${tag} favoritos vacío: «Descubrir negocios»`);
  await v.ctx.close();
}

async function codigos(nav, nombre, t, vp) {
  const tag = `${nombre}/${t}`;
  const CARD = 'c1000000-0000-4000-8000-0000000000f1';
  const OF = 'a1000000-0000-4000-8000-0000000000f1';
  const base = {
    my_redemptions: [], my_birthday_gifts: [], my_loyalty_gifts: [], my_passes: [], my_queue_turns: [], my_spot_gifts: [], my_orders: [],
    my_stamp_rewards: [{ id: 'p1', card_id: CARD, card_name: 'Cafés', business_id: BIZ, business_name: 'Bar Sonda', reward: 'Un café', status: 'pending', code: 'ABCD1234', created_at: new Date().toISOString() }],
    my_stamp_cards: [{ id: CARD, business_id: BIZ, business_name: 'Bar Sonda', name: 'Cafés', goal: 10, card_goal: 12, reward: 'Un café', stamps: 4, pending_code: 'ABCD1234', is_active: true, applies_to: 'all' }],
    claim_stamp_reward: { ok: true, code: 'ABCD1234', reward: 'Un café' },
  };
  const { ctx, p, estado, errores } = await contexto(nav, vp, CUENTA(base));
  await p.goto(`${BASE}/app/#/codigos`, { waitUntil: 'networkidle' });
  await p.waitForSelector('h1');
  // Sin cámara en el navegador (WebKit de Playwright en Windows), el botón no sale.
  const conCamara = await p.evaluate(() => !!navigator.mediaDevices?.getUserMedia);
  ok(await p.locator('a[href="#/escanear"]', { hasText: 'Escanear un QR' }).count() === (conCamara ? 1 : 0), `${tag} códigos: «Escanear un QR» (${conCamara ? 'con' : 'sin'} cámara)`);
  ok(await p.locator(`a.ocard[href="#/sellos?premio=${CARD}"]`).count() === 1, `${tag} códigos: el premio vivo abre su QR`);
  await p.locator(`a.ocard[href="#/sellos?premio=${CARD}"]`).click();
  await p.waitForSelector('.ticket .qr');
  ok(estado.llamadas.some(([f, b]) => f === 'claim_stamp_reward' && b.p_card === CARD), `${tag} sellos: «Ver el código» sin pulsar otra vez`);
  await p.screenshot({ path: `${OUT}/cuenta-premio-qr-${nombre}-${t}.png` });
  await p.goto(`${BASE}/app/#/sellos`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.huecos');
  ok(await p.locator('.huecos').getAttribute('aria-label') === '4 de 10 sellos', `${tag} sellos: «4 de 10 sellos» para el lector`);
  ok(/la tarjeta ha subido a 12/.test(await p.locator('main').innerText()), `${tag} sellos: «la tarjeta ha subido a 12»`);
  ok(errores.length === 0, `${tag} códigos sin errores ${errores.join(' | ')}`);
  await ctx.close();

  // Canjeado: «Un sello más en Cafés: llevas 5 de 10».
  const c = await contexto(nav, vp, CUENTA({
    ...base,
    start_redemption: { code: 'abcd1234ef', expires_at: new Date(Date.now() + 1800e3).toISOString(), offer_title: 'Café y bollo', business_name: 'Bar Sonda' },
    offer_tz: 'Europe/Madrid', offer_marks: null,
    offer_detail: [{ id: OF, title: 'Café y bollo', business_name: 'Bar Sonda', max_seats: 1 }],
    my_stamp_cards: [{ id: CARD, business_id: BIZ, business_name: 'Bar Sonda', name: 'Cafés', goal: 10, reward: 'Un café', stamps: 5, is_active: true }],
  }), {
    redemptions: [{ status: 'validated', validated_at: new Date().toISOString() }],
    stamps: [{ card_id: CARD, redemptions: { code: 'abcd1234ef' } }],
  });
  await c.p.goto(`${BASE}/app/#/codigo/${OF}`, { waitUntil: 'networkidle' });
  await c.p.locator('#confirmaEnlace').click().catch(() => {});
  await c.p.waitForSelector('.canjeado', { timeout: 15000 });
  await c.p.waitForSelector('.sello-canje', { timeout: 8000 }).catch(() => {});
  ok(/Un sello más en Cafés: llevas 5 de 10/.test(await c.p.locator('.canjeado').innerText()), `${tag} canjeado: «Un sello más en Cafés: llevas 5 de 10»`);
  await c.p.screenshot({ path: `${OUT}/cuenta-canjeado-sello-${nombre}-${t}.png` });
  await c.ctx.close();

  // El escáner: sin permiso para la cámara, lo dice.
  const e = await contexto(nav, vp, CUENTA({}));
  await e.p.addInitScript(() => {
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
  });
  await e.p.goto(`${BASE}/app/#/escanear`, { waitUntil: 'networkidle' });
  await e.p.waitForSelector('#escanerError:not([hidden])');
  const msg = await e.p.locator('#escanerError').innerText();
  ok(conCamara ? /Sin permiso para la cámara/.test(msg) : /No se ha podido abrir la cámara/.test(msg), `${tag} escanear: sin permiso o sin cámara, lo dice (${msg})`);
  await e.p.screenshot({ path: `${OUT}/cuenta-escanear-${nombre}-${t}.png` });
  await e.ctx.close();
}

const PRUEBAS = { planes, favoritos, codigos };
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
