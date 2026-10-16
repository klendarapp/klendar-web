// Prueba del Menú del día, el horario de cocina y el QR de mesa con el wifi
// en la web local (tanda D), con un Supabase de mentira: no toca dev.
//
//  1. Panel, «Menú del día»: la hoja con «Repetir el de ayer», el formulario
//     (precio, línea, comida/cena, hasta cuándo) y «Todos los días»; publicar
//     manda `publish_daily_menu` con lo escrito; precio malo no se manda;
//     «Repetir el de ayer» manda `p_reuse_photo`; «Todos los días» guarda los
//     días con `save_daily_menu_plan`.
//  2. Panel, «Wifi para clientes»: guardar red y contraseña, el enlace de
//     los carteles (con `?mesas=` al numerar), los escaneos y «Cambiar el
//     enlace».
//  3. Panel, «Más herramientas» y el resumen: la tarjeta y la fila del menú,
//     la del wifi; «Crear» ofrece «Menú del día» a un sitio de comida.
//  4. Panel, «Tu ficha» › Horario: «La cocina tiene otro horario» y
//     `set_kitchen_hours` al guardar.
//  5. Panel, «Cifras»: «QR de mesa · 142 escaneos este mes».
//  6. La página del QR (`/m/<código>`, las Functions de verdad): el wifi con
//     «Copiar contraseña», lo de hoy, la carta, favoritos, `noindex` y la
//     caché de 30 s; cuenta el escaneo; un código cambiado (410, sin wifi) y
//     uno que no existe (404).
//  7. Los carteles de mesa (`/cartel/mesa/<código>?mesas=6`): dos folios,
//     «Mesa 6», «📶 Wifi gratis».
//  8. Explorar: «Menú del día» (en «Qué») y «Se puede comer ahora» (en «El
//     sitio») van a `public_explore` como `daily_menu` / `eat_now` y el
//     chip del menú sale en la fila.
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PORT=8791 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8791 node tools/mesa_check.mjs
// (lo público arranca su propio serve_dev en PUB_PORT, 8792, contra un
// Supabase de mentira en 8793)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8791';
const OUT = process.env.OUT || '.';
const SOLO = process.env.SOLO || '';
const PUB_PORT = Number(process.env.PUB_PORT || 8792);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8793);
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-00000000a5a1';
const BIZ = 'b1000000-0000-4000-8000-00000000a5a1';
const TOKEN = 'Ab3_x-9QkLmN0pQr';
const VIEJO = 'Zz9_y-8QkLmN0pQr';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'mesa.prueba@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const masHoras = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const HORARIO = { 1: [['13:00', '16:00'], ['20:00', '23:30']], 2: [['13:00', '16:00']], 3: [['13:00', '16:00']], 4: [['13:00', '16:00']], 5: [['13:00', '16:00']], 6: [], 7: [] };

const SUB = { plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: 'active', period_end: masHoras(480), payment_method: 'transfer',
  price_cents: 1990, active_offers: 0, max_active_offers: null, has_analytics: true, boosts_included: 0, boosts_used: 0,
  billing: { enabled: true, blocked: false, hold: null, block_soon: false } };

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
      estado.llamadas.push([fn, body]);
      const r = estado.rpc[fn];
      if (r !== undefined) return json(typeof r === 'function' ? r(body) : r);
      return json(null);
    }
    if (p.startsWith('/rest/v1/categories')) return json([{ id: 'c-rest', slug: 'restaurant', name: 'Restaurantes', category_group: 'food', position: 1 }]);
    if (p.startsWith('/rest/v1/businesses')) {
      return json([{ id: BIZ, name: 'Casa Prueba', time_zone: 'Europe/Madrid', category_id: 'c-rest', logo_url: null, cover_image_url: null, gallery: [],
        opening_hours: HORARIO, kitchen_hours: null, amenities: [], address: 'Calle Mayor 1', city: 'Madrid' }]);
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contextoPanel(nav, vp) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
  const estado = { llamadas: [], rpc: {} };
  Object.assign(estado.rpc, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: [{ id: BIZ, name: 'Casa Prueba', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
    business_is_organizer: false,
    my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
    my_subscription: SUB,
    business_stats: { redemptions_30d: 3 },
    my_business_offers: [],
    business_loyalty: { ok: true },
    business_tools_overview: { ok: true, can_edit: true, team: { members: 1 }, series: { rules_active: 0 },
      daily_menu: { suggested: true, live_until: masHoras(3), plan_days: 5 }, table_qr: { wifi: true, has: true, scans_month: 142 } },
    daily_menu_setup: {
      suggested: true, can_publish: true, blocked: false, kitchen: true,
      last: { id: 'm1', price_cents: 1250, note: 'Primeros, segundos, bebida y postre', meal: 'lunch', image: null },
      live: null,
      until: { lunch: { until: masHoras(3), at_close: true }, dinner: { until: masHoras(9), at_close: true }, both: { until: masHoras(9), at_close: true } },
      plan: { weekdays: [1, 2, 3, 4, 5], price_cents: 1250, meal: 'lunch', note: 'Con postre', at: '11:30' },
    },
    publish_daily_menu: (b) => (Number(b.p_price_cents) >= 100 ? { ok: true, id: 'nuevo', until: masHoras(3) } : { ok: false, error: 'invalid_price' }),
    save_daily_menu_plan: (b) => ({ ok: true, weekdays: b.p_weekdays, at: b.p_at }),
    business_table_qr: { ok: true, token: TOKEN, can_change: true, ssid: 'Casa_Clientes', password: 'tortilla2026', scans_month: 142, scans_30d: 168,
      business: { id: BIZ, name: 'Casa Prueba' } },
    save_business_wifi: (b) => ({ ok: true, ssid: b.p_ssid, password: b.p_password }),
    rotate_table_qr: { ok: true, token: 'Nn1_n-1QkLmN0pQr' },
    table_qr_stats: { ok: true, has: true, month: 142, d30: 168 },
    set_kitchen_hours: { ok: true },
    business_private: { tax_id: '' },
    business_menu: [],
    business_links: { links: [], menu_files: [] },
    business_report: { ok: true, totals: {}, daily: [], offers: [], by_hour: [], redemptions: [] },
    business_audience: null,
    business_link_taps_report: [],
  });
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  return { ctx, p, estado, errores };
}
const vista = (p) => p.locator('#view').innerText();
const llamada = (estado, fn) => estado.llamadas.filter(([f]) => f === fn).map(([, b]) => b);

async function panel(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contextoPanel(nav, vp);
  // 1. Menú del día
  await p.goto(`${BASE}/panel/#/menu-del-dia`);
  await p.waitForSelector('#publicar', { timeout: 15000 });
  let txt = await vista(p);
  ok(/Repetir el de ayer \(12,50/.test(txt), `${nombre}/${t} menú: «Repetir el de ayer (12,50 €)»`);
  ok(/Al cerrar la cocina/.test(txt), `${nombre}/${t} menú: «Al cerrar la cocina (…)»`);
  ok(/Todos los días/.test(txt) && await p.locator('#planOn').isChecked(), `${nombre}/${t} menú: «Todos los días» encendido`);
  await p.screenshot({ path: `${OUT}/panel-menu-del-dia-${nombre}-${t}.png`, fullPage: true });
  await p.fill('#precio', '0,5');
  await p.click('#publicar');
  await p.waitForTimeout(300);
  ok(llamada(estado, 'publish_daily_menu').length === 0, `${nombre}/${t} menú: precio de menos de 1 € no se manda`);
  await p.fill('#precio', '13,90');
  await p.fill('#linea', 'Con vino');
  await p.check('input[name=comida][value=both]');
  await p.click('#publicar');
  await p.waitForTimeout(500);
  const pub = llamada(estado, 'publish_daily_menu')[0] || {};
  ok(pub.p_price_cents === 1390 && pub.p_note === 'Con vino' && pub.p_meal === 'both' && pub.p_reuse_photo === false,
    `${nombre}/${t} menú: publica 13,90 €, «Con vino», comida y cena (${JSON.stringify(pub)})`);
  await p.goto(`${BASE}/panel/#/menu-del-dia`);
  await p.waitForSelector('#repetir');
  await p.click('#repetir');
  await p.waitForTimeout(500);
  const rep = llamada(estado, 'publish_daily_menu').slice(-1)[0] || {};
  ok(rep.p_reuse_photo === true && rep.p_price_cents === 1250, `${nombre}/${t} menú: «Repetir el de ayer» con su foto`);
  await p.goto(`${BASE}/panel/#/menu-del-dia`);
  await p.waitForSelector('#planOn');
  await p.uncheck('input[name=dia][value="5"]');
  await p.waitForTimeout(400);
  const plan = llamada(estado, 'save_daily_menu_plan').slice(-1)[0] || {};
  ok(JSON.stringify(plan.p_weekdays) === '[1,2,3,4]' && plan.p_at === '11:30', `${nombre}/${t} menú: «Todos los días» sin el viernes (${JSON.stringify(plan)})`);

  // 2. Wifi para clientes
  await p.goto(`${BASE}/panel/#/wifi-clientes`);
  await p.waitForSelector('#guardaWifi', { timeout: 15000 });
  txt = await vista(p);
  ok(/142 escaneos este mes/.test(txt), `${nombre}/${t} wifi: «142 escaneos este mes»`);
  ok(await p.locator('#ssid').inputValue() === 'Casa_Clientes', `${nombre}/${t} wifi: la red guardada`);
  await p.fill('#clave', 'nueva clave');
  await p.click('#guardaWifi');
  await p.waitForTimeout(400);
  const w = llamada(estado, 'save_business_wifi').slice(-1)[0] || {};
  ok(w.p_ssid === 'Casa_Clientes' && w.p_password === 'nueva clave', `${nombre}/${t} wifi: guarda red y contraseña`);
  ok((await p.getAttribute('#imprimir', 'href')).endsWith(`/cartel/mesa/${TOKEN}`), `${nombre}/${t} wifi: enlace de los carteles`);
  await p.check('#numerar');
  await p.fill('#mesas', '6');
  ok((await p.getAttribute('#imprimir', 'href')).endsWith(`/cartel/mesa/${TOKEN}?mesas=6`), `${nombre}/${t} wifi: numerados (?mesas=6)`);
  ok(await p.locator('#qr svg').count() === 1, `${nombre}/${t} wifi: el QR dibujado`);
  await p.screenshot({ path: `${OUT}/panel-wifi-clientes-${nombre}-${t}.png`, fullPage: true });

  // 3. Más herramientas, resumen y «Crear»
  await p.goto(`${BASE}/panel/#/herramientas`);
  await p.waitForSelector('.fiel-card', { timeout: 15000 });
  txt = await vista(p);
  ok(/Menú del día/.test(txt) && /Publicado hasta las/.test(txt), `${nombre}/${t} herramientas: tarjeta del Menú del día`);
  ok(/Wifi para clientes/.test(txt) && /142 escaneos este mes/.test(txt), `${nombre}/${t} herramientas: tarjeta del wifi`);
  await p.goto(`${BASE}/panel/#/resumen`);
  await p.waitForSelector('.fila-inicio', { timeout: 15000 }).catch(() => null);
  txt = await vista(p);
  ok(/Menú del día · hasta las/.test(txt), `${nombre}/${t} resumen: fila del Menú del día`);
  const crear = p.locator('[data-go=crear]').first();
  if (await crear.count()) {
    await crear.click();
    await p.waitForSelector('#modal[open] .crear-op');
    ok(/Menú del día/.test(await p.locator('#modal').innerText()), `${nombre}/${t} crear: ofrece «Menú del día»`);
    await p.keyboard.press('Escape');
  } else ok(false, `${nombre}/${t} crear: no se encuentra el botón`);

  // 4. Tu ficha › Horario
  await p.goto(`${BASE}/panel/#/ficha/horario`);
  await p.waitForSelector('#cocinaOn', { timeout: 15000 });
  ok(await p.locator('[data-cocina]').isHidden(), `${nombre}/${t} ficha: sin horario de cocina, plegado`);
  await p.check('#cocinaOn');
  ok(await p.locator('[data-cocina]').isVisible(), `${nombre}/${t} ficha: «La cocina tiene otro horario» abre su horario`);
  await p.screenshot({ path: `${OUT}/panel-horario-cocina-${nombre}-${t}.png`, fullPage: true });
  await p.locator('#parte button[type=submit]').click();
  await p.waitForTimeout(600);
  const k = llamada(estado, 'set_kitchen_hours').slice(-1)[0];
  ok(k && k.p_hours && typeof k.p_hours === 'object', `${nombre}/${t} ficha: guarda el horario de cocina`);

  // 5. Cifras
  await p.goto(`${BASE}/panel/#/informe`);
  await p.waitForSelector('#informeMesa', { timeout: 15000 }).catch(() => null);
  await p.waitForTimeout(500);
  ok(/142 escaneos este mes/.test(await vista(p)), `${nombre}/${t} cifras: «142 escaneos este mes»`);

  ok(errores.length === 0, `${nombre}/${t} panel: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

// ── Lo público, con las Functions de verdad ────────────────────────────────
function supabasePublico(estado) {
  return createServer((req, res) => {
    let datos = '';
    req.on('data', (c) => { datos += c; });
    req.on('end', () => {
      const p = new URL(req.url, 'http://x').pathname;
      let body = {};
      try { body = JSON.parse(datos || '{}'); } catch { /* */ }
      const json = (b) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
      const fn = p.startsWith('/rest/v1/rpc/') ? p.slice('/rest/v1/rpc/'.length) : null;
      if (fn) estado.llamadas.push([fn, body]);
      if (fn === 'table_qr_info') {
        if (body.p_token === TOKEN) {
          return json({ ok: true, visible: true, has_wifi: true, wifi: { ssid: 'Casa_Clientes', password: 'tortilla2026' },
            business: { id: BIZ, name: 'Casa Prueba', slug: 'casa-prueba-madrid', city: 'Madrid', time_zone: 'Europe/Madrid' } });
        }
        if (body.p_token === VIEJO) return json({ ok: false, error: 'token_changed', business_name: 'Casa Prueba', business_id: BIZ, slug: 'casa-prueba-madrid' });
        return json({ ok: false, error: 'bad_token' });
      }
      if (fn === 'business_offers') {
        return json([{ id: '0f000000-0000-4000-8000-000000000001', kind: 'flash_offer', title: 'Menú de hoy · 12,50 €', price_cents: 1250, currency: 'EUR',
          redeem_start_at: new Date(Date.now() - 3600e3).toISOString(), redeem_end_at: masHoras(3), business_id: BIZ, business_name: 'Casa Prueba',
          style: { template: 'photo', badge: 'daily_menu', meal: 'lunch' }, images: [] }]);
      }
      if (fn === 'business_menu') return json([{ id: 's1', name: 'Para picar', items: [{ id: 'i1', name: 'Croquetas', price_cents: 600, allergens: ['gluten'] }] }]);
      if (fn === 'public_explore') return json([]);
      if (fn) return json(null);
      return json([]);
    });
  });
}

async function publico(nav, nombre, t, vp, estado) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  const escaneos = [];
  // La página no cuenta a los navegadores automáticos (`navigator.webdriver`):
  // aquí se hace pasar por uno normal para comprobar que cuenta.
  await ctx.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); });
  await ctx.route(/table_qr_scan/, (r) => { escaneos.push(r.request().postData()); r.fulfill({ status: 204, body: '' }); });
  const PUB = `http://localhost:${PUB_PORT}`;
  // 6. La página del QR
  const r = await p.goto(`${PUB}/m/${TOKEN}`, { waitUntil: 'load' });
  ok(r.status() === 200, `${nombre}/${t} /m/: 200${r.status() === 200 ? '' : ` (${r.status()}: ${(await p.locator('body').innerText()).slice(0, 200)})`}`);
  const h = r.headers();
  ok(/noindex/.test(h['x-robots-tag'] || '') && /<meta name="robots" content="noindex, nofollow">/.test(await p.content()), `${nombre}/${t} /m/: noindex (cabecera y meta)`);
  ok(/max-age=30/.test(h['cache-control'] || '') && /s-maxage=30/.test(h['cache-control'] || ''), `${nombre}/${t} /m/: caché de 30 s (${h['cache-control']})`);
  const cuerpo = await p.locator('body').innerText();
  ok(/Wifi gratis/.test(cuerpo) && /Casa_Clientes/.test(cuerpo) && /tortilla2026/.test(cuerpo), `${nombre}/${t} /m/: red y contraseña`);
  ok(/Copiar contraseña/.test(cuerpo), `${nombre}/${t} /m/: «Copiar contraseña»`);
  ok(/Hoy aquí/.test(cuerpo) && /Menú del día/.test(cuerpo), `${nombre}/${t} /m/: lo de hoy con el sello «Menú del día»`);
  ok(/Carta/.test(cuerpo) && /Croquetas/.test(cuerpo) && /Gluten/.test(cuerpo), `${nombre}/${t} /m/: la carta con alérgenos`);
  ok(/Añadir a favoritos/.test(cuerpo) && /Descarga Klendar/.test(cuerpo), `${nombre}/${t} /m/: favoritos y «Descarga Klendar»`);
  ok(!/canonical/.test(await p.content()), `${nombre}/${t} /m/: sin canonical`);
  await p.waitForTimeout(300);
  ok(escaneos.length === 1 && /"p_token":"Ab3_x-9QkLmN0pQr"/.test(escaneos[0] || ''), `${nombre}/${t} /m/: cuenta el escaneo`);
  // Sin horizontal scroll en el móvil.
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(ancho <= 0, `${nombre}/${t} /m/: sin desplazamiento horizontal`);
  await p.screenshot({ path: `${OUT}/web-qr-de-mesa-${nombre}-${t}.png`, fullPage: true });
  if (nombre === 'chromium') {
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    await p.click('[data-copiar]');
    await p.waitForTimeout(200);
    const copiado = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    ok(copiado === 'tortilla2026', `${nombre}/${t} /m/: «Copiar contraseña» copia`);
    ok(/Contraseña copiada/.test(await p.locator('[data-copiar]').innerText()), `${nombre}/${t} /m/: «Contraseña copiada»`);
  }
  const en = await p.goto(`${PUB}/en/m/${TOKEN}`);
  ok(en.status() === 200 && /Free Wi-Fi/.test(await p.locator('body').innerText()) && /Copy password/.test(await p.locator('body').innerText()), `${nombre}/${t} /en/m/: en inglés`);
  const viejo = await p.goto(`${PUB}/m/${VIEJO}`);
  const tv = await p.locator('body').innerText();
  ok(viejo.status() === 410 && /Este cartel ya no vale/.test(tv) && !/tortilla2026/.test(tv) && /Ver la ficha/.test(tv), `${nombre}/${t} /m/ cambiado: 410, sin wifi, con la ficha`);
  const malo = await p.goto(`${PUB}/m/corto`);
  ok(malo.status() === 404 && /Este código no existe/.test(await p.locator('body').innerText()), `${nombre}/${t} /m/ mal: 404`);
  // 7. Carteles de mesa
  const c = await p.goto(`${PUB}/cartel/mesa/${TOKEN}?mesas=6`);
  const tc = await p.locator('body').innerText();
  ok(c.status() === 200 && await p.locator('main.folio').count() === 2 && /Mesa 6/i.test(tc) && /Wifi gratis/i.test(tc), `${nombre}/${t} carteles: dos folios, «Mesa 6», «Wifi gratis»`);
  ok(await p.locator('.qr svg').count() === 6, `${nombre}/${t} carteles: seis QR`);
  await p.screenshot({ path: `${OUT}/web-carteles-mesa-${nombre}-${t}.png`, fullPage: true });
  // 8. Explorar
  estado.llamadas.length = 0;
  await p.goto(`${PUB}/explorar/?menu-del-dia=1&comer-ahora=1`);
  const f = estado.llamadas.filter(([fn]) => fn === 'public_explore').map(([, b]) => b)[0] || {};
  const traits = f.p_filters?.traits || [];
  ok(traits.includes('daily_menu') && traits.includes('eat_now'), `${nombre}/${t} explorar: daily_menu y eat_now a public_explore (${JSON.stringify(traits)})`);
  ok(await p.locator('.chip-quitar', { hasText: 'Menú del día' }).count() === 1, `${nombre}/${t} explorar: chip «Menú del día» con ×`);
  ok(await p.locator('input[type=checkbox][name="menu-del-dia"]').isChecked() && await p.locator('input[type=checkbox][name="comer-ahora"]').isChecked(), `${nombre}/${t} explorar: las dos casillas marcadas en la hoja`);
  ok(errores.length === 0, `${nombre}/${t} público: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

let servidor = null;
let falso = null;
const estadoPub = { llamadas: [] };
if (!SOLO || SOLO.includes('publico')) {
  falso = supabasePublico(estadoPub);
  await new Promise((r) => falso.listen(FALSO_PORT, r));
  servidor = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(PUB_PORT), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa' }, stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 1500));
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    if (!SOLO || SOLO.includes('panel')) await panel(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} panel: ${e.message}`));
    if (!SOLO || SOLO.includes('publico')) await publico(nav, nombre, t, vp, estadoPub).catch((e) => ok(false, `${nombre}/${t} público: ${e.message}`));
  }
  await nav.close();
}
if (servidor) servidor.kill();
if (falso) falso.close();
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
