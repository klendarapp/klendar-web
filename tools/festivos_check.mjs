// Prueba de «festivos que se mantienen casi solos» en el admin (migración
// 20261238100000 de la app), con una sesión simulada (Supabase contestado
// aquí: no toca dev ni manda nada):
//
//  1. «Festivos»: arriba, el año que se vigila («2028: nacionales propuestos
//     sin confirmar · locales 16 de 18 ciudades») y el que se ve; los locales
//     por ciudad con su boletín; «Confirmar los N propuestos» manda
//     `admin_confirm_holidays` con los ids; «Añadir los dos…» de Zaragoza
//     manda `admin_save_city_holidays` con los dos días y la fuente;
//     «Buscar ahora» llama a la Edge Function `holidays` con `importar`.
//  2. «Resumen»: la línea «Festivos: faltan los locales de …» en «Pendiente
//     de ti».
//  3. «Dónde crecer»: encender una ciudad pide la comunidad, la guarda
//     (`admin_set_city_holiday_info`) y avisa de que le faltan los locales.
//  4. «Gratis de lanzamiento» por provincia: «Málaga · gratis hasta el 31 mar
//     2027 · 12 negocios · 0 en prueba», «Sin provincia», encender con fecha
//     (mínimo mañana), «Otra provincia…», «Cambiar la fecha…» y «Quitar el
//     gratis…» (`admin_set_province_launch_free`).
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PORT=8843 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8843 node tools/festivos_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8843';
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-00000000f357';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'admin.festivos@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const BOA = { name: 'BOA', url: 'https://www.boa.aragon.es/' };
const ciudad = (id, name, region, dias, bulletin) => ({
  id, name, region, confirmed: dias.filter((d) => d.status === 'confirmed').length,
  proposed: dias.filter((d) => d.status === 'proposed').length,
  ok: dias.filter((d) => d.status === 'confirmed').length >= 2 && !dias.some((d) => d.status === 'proposed'),
  days: dias, bulletin,
});
const P1 = 'f0000000-0000-4000-8000-000000000001';
const P2 = 'f0000000-0000-4000-8000-000000000002';
const P3 = 'f0000000-0000-4000-8000-000000000003';
const ESTADO_2028 = {
  year: 2028,
  national: { state: 'proposed', confirmed: 0, proposed: 2 },
  regions_missing: [],
  cities: [
    ciudad('madrid', 'Madrid', 'MD', [{ id: P3, day: '2028-05-15', name: 'San Isidro', status: 'proposed' }, { id: 'x', day: '2028-11-09', name: 'Almudena', status: 'confirmed' }], { name: 'BOCM', url: 'https://www.bocm.es/' }),
    ciudad('zaragoza', 'Zaragoza', 'AR', [], BOA),
    ciudad('valencia', 'Valencia', 'VC', [{ id: 'y', day: '2028-01-22', name: 'San Vicente Mártir', status: 'confirmed' }, { id: 'z', day: '2028-04-24', name: 'San Vicente Ferrer', status: 'confirmed' }], { name: 'DOGV', url: 'https://dogv.gva.es/' }),
  ],
  cities_ok: 1, cities_total: 3, cities_missing: ['Madrid', 'Zaragoza'], proposed: 3, complete: false,
  summary: '2028: nacionales propuestos sin confirmar · locales 1 de 3 ciudades',
};
const FILAS_2028 = [
  { id: P1, day: '2028-01-01', name: 'Año Nuevo', scope: 'national', region: null, city: null, source: 'BOE-A-2027-00001, 13-10-2027', status: 'proposed', origin: 'boe' },
  { id: P2, day: '2028-01-06', name: 'Epifanía del Señor', scope: 'national', region: null, city: null, source: 'BOE-A-2027-00001, 13-10-2027', status: 'proposed', origin: 'boe' },
  { id: P3, day: '2028-05-15', name: 'San Isidro', scope: 'local', region: 'MD', city: 'madrid', city_name: 'Madrid', source: 'Ayuntamiento de Madrid, datos abiertos', status: 'proposed', origin: 'opendata:datos.madrid.es' },
];
const CIUDADES = [
  { id: 'madrid', name: 'Madrid', region: 'MD', active: true, bulletin: { name: 'BOCM', url: 'https://www.bocm.es/' } },
  { id: 'zaragoza', name: 'Zaragoza', region: 'AR', active: true, bulletin: BOA },
  { id: 'valencia', name: 'Valencia', region: 'VC', active: true, bulletin: { name: 'DOGV', url: 'https://dogv.gva.es/' } },
];

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
    if (p.startsWith('/functions/v1/')) {
      estado.funciones.push([p.slice('/functions/v1/'.length), body, req.headers().authorization || '']);
      return json({ ok: true, year: 2028, proposed: 2, notes: [] });
    }
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

async function contexto(nav, vp, rpc) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-admin-auth-token`, sesion()]);
  const estado = { llamadas: [], funciones: [], rpc };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  if (process.env.TRAZA) {
    p.on('console', (m) => console.log('  console', m.type(), m.text().slice(0, 200)));
    p.on('framenavigated', (f) => console.log('  nav', f.url()));
  }
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

const BASE_RPC = {
  is_admin: true,
  admin_mfa_status: { required: false, enrolled: true },
  admin_kpis: {},
};

async function festivos(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, {
    ...BASE_RPC,
    admin_holidays: (b) => ({
      holidays: b.p_year === 2028 ? FILAS_2028 : [],
      cities: CIUDADES,
      years: [2026, 2027, 2028],
      status: b.p_year === 2028 ? ESTADO_2028 : { ...ESTADO_2028, year: b.p_year, summary: `${b.p_year}: nacionales confirmados · locales 3 de 3 ciudades`, complete: true, proposed: 0, cities_missing: [] },
      watch: ESTADO_2028,
      import: { year: 2028, checked_at: '2027-10-18T06:43:00Z', boe: 'BOE-A-2027-00001' },
    }),
    admin_confirm_holidays: (b) => ({ ok: true, confirmed: (b.p_ids || []).length }),
    admin_save_city_holidays: { ok: true, saved: 2 },
  });
  await p.goto(`${BASE}/admin/#/festivos/2028`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.fest-estado').catch(async (e) => { console.log('VISTA:', await p.evaluate(() => [typeof PAGES.festivos, location.hash, document.querySelector('#view').innerText.slice(0, 200)]), errores); throw e; });
  const v = await p.locator('#view').innerText();
  ok(/2028: nacionales propuestos sin confirmar · locales 1 de 3 ciudades/.test(v), `${nombre}/${t} festivos: arriba, cómo va el año`);
  ok(/3 propuestos sin confirmar/.test(v) && /Faltan los locales de Madrid, Zaragoza/.test(v), `${nombre}/${t} festivos: qué falta`);
  ok(/Última búsqueda automática/.test(v) && /BOE-A-2027-00001/.test(v), `${nombre}/${t} festivos: la última búsqueda`);
  ok(await p.locator('a[href="https://www.boa.aragon.es/"]').count() >= 1, `${nombre}/${t} festivos: el enlace al BOA de Zaragoza`);
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok(ancho, `${nombre}/${t} festivos: sin scroll horizontal de la página`);
  await p.screenshot({ path: `${OUT}/web-admin-festivos-${nombre}-${t}.png`, fullPage: true });

  // Confirmar todos.
  await p.click('#confirmarTodos');
  await p.waitForTimeout(400);
  const conf = estado.llamadas.find(([fn]) => fn === 'admin_confirm_holidays');
  ok(conf && JSON.stringify(conf[1].p_ids) === JSON.stringify([P1, P2, P3]), `${nombre}/${t} festivos: «Confirmar los 3 propuestos» con sus ids ${JSON.stringify(conf)}`);

  // Los dos de Zaragoza.
  await p.waitForSelector('[data-ciudad="1"]');
  await p.click('[data-ciudad="1"]');
  await p.waitForSelector('#modal input[name=d1]');
  const dlg = await p.locator('#modal').innerText();
  ok(/Locales de 2028 · Zaragoza/.test(dlg) && /BOA/.test(dlg), `${nombre}/${t} festivos: el diálogo de la ciudad con su boletín`);
  await p.screenshot({ path: `${OUT}/web-admin-festivos-ciudad-${nombre}-${t}.png` });
  await p.fill('#modal input[name=d1]', '2028-01-29');
  await p.fill('#modal input[name=n1]', 'San Valero');
  await p.fill('#modal input[name=d2]', '2028-03-06');
  await p.fill('#modal input[name=n2]', 'Cincomarzada');
  await p.fill('#modal input[name=source]', 'BOA núm. 220, 15-11-2027 — https://www.boa.aragon.es/');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(400);
  const dos = estado.llamadas.find(([fn]) => fn === 'admin_save_city_holidays');
  ok(dos && dos[1].p_city === 'zaragoza' && dos[1].p_days.length === 2 && dos[1].p_days[0].day === '2028-01-29'
    && dos[1].p_days[1].name === 'Cincomarzada' && /BOA núm. 220/.test(dos[1].p_source), `${nombre}/${t} festivos: guarda los dos con la fuente ${JSON.stringify(dos?.[1])}`);

  // Buscar ahora.
  await p.waitForSelector('#buscar');
  await p.click('#buscar');
  await p.waitForTimeout(600);
  const f = estado.funciones.find(([fn]) => fn === 'holidays');
  ok(f && f[1].accion === 'importar' && /^Bearer /.test(f[2]), `${nombre}/${t} festivos: «Buscar ahora» llama a la función con la sesión`);
  ok(errores.length === 0, `${nombre}/${t} festivos sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function resumen(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, {
    ...BASE_RPC,
    admin_holiday_alert: { year: 2028, count: 2, text: 'Festivos: faltan los locales de 2028 en Zaragoza y Valladolid', summary: '2028: nacionales confirmados · locales 16 de 18 ciudades' },
  });
  await p.goto(`${BASE}/admin/#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.pend-lista');
  const fila = p.locator('a.pend[href="#/festivos/2028"]');
  ok(await fila.count() === 1 && /faltan los locales de 2028 en Zaragoza y Valladolid/.test(await fila.innerText()), `${nombre}/${t} resumen: la línea de festivos en «Pendiente de ti»`);
  await p.screenshot({ path: `${OUT}/web-admin-resumen-festivos-${nombre}-${t}.png` });
  ok(errores.length === 0, `${nombre}/${t} resumen sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function crecer(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, {
    ...BASE_RPC,
    admin_city_waitlist: [],
    admin_klendar_cities: [
      { id: 'zaragoza', name: 'Zaragoza', lat: 41.6488, lng: -0.8891, position: 5, active: true, region: 'AR', postal_prefix: '500' },
      { id: 'teruel', name: 'Teruel', lat: 40.3456, lng: -1.1065, position: 19, active: false, region: null, postal_prefix: null },
    ],
    admin_activate_city: { id: 'teruel', notified: 0 },
    admin_set_city_holiday_info: { ok: true, holidays: { city: 'teruel', missing_years: [2026, 2027], bulletin: BOA } },
  });
  await p.goto(`${BASE}/admin/#/crecer`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-enciende]');
  const v = await p.locator('#view').innerText();
  ok(/sin comunidad/.test(v) && /Aragón/.test(v), `${nombre}/${t} crecer: la columna «Comunidad»`);
  await p.click('[data-enciende]');
  await p.waitForSelector('#modal select[name=region]');
  const reg = await p.locator('#modal select[name=region]').inputValue();
  ok(reg === 'AR', `${nombre}/${t} crecer: propone la comunidad de la ciudad más cercana (${reg})`);
  await p.fill('#modal input[name=cp]', '440');
  await p.screenshot({ path: `${OUT}/web-admin-crecer-alta-${nombre}-${t}.png` });
  await p.click('#modal button[type=submit]');
  await p.waitForSelector('#modal[open] button[type=submit]');
  await p.click('#modal button[type=submit]'); // «Activar y avisar»
  await p.waitForFunction(() => /le faltan los festivos locales/.test(document.querySelector('#modal')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
  const aviso = await p.locator('#modal').innerText();
  ok(/A «Teruel» le faltan los festivos locales/.test(aviso) && /2026 y 2027/.test(aviso) && /BOA/.test(aviso), `${nombre}/${t} crecer: avisa de que le faltan los locales`);
  await p.screenshot({ path: `${OUT}/web-admin-crecer-aviso-festivos-${nombre}-${t}.png` });
  const info = estado.llamadas.find(([fn]) => fn === 'admin_set_city_holiday_info');
  ok(info && info[1].p_id === 'teruel' && info[1].p_region === 'AR' && info[1].p_postal_prefix === '440', `${nombre}/${t} crecer: guarda comunidad y código postal ${JSON.stringify(info?.[1])}`);
  await p.click('#modal button[type=submit]'); // «Añadirlos ahora»
  await p.waitForTimeout(300);
  ok(/#\/festivos\/2026$/.test(p.url()), `${nombre}/${t} crecer: «Añadirlos ahora» lleva a Festivos (${p.url()})`);
  ok(errores.length === 0, `${nombre}/${t} crecer sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

/** «Gratis de lanzamiento» por provincia hasta una fecha (migración
 * 20261260100003 de la app). */
const SIN_PROV = 'b0000000-0000-4000-8000-0000000000aa';
async function gratis(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, {
    ...BASE_RPC,
    admin_city_waitlist: [],
    admin_klendar_cities: [
      { id: 'madrid', name: 'Madrid', lat: 40.4168, lng: -3.7038, position: 1, active: true, region: 'MD', postal_prefix: '280' },
      { id: 'malaga', name: 'Málaga', lat: 36.7213, lng: -4.4214, position: 6, active: true, region: 'AN', postal_prefix: '290' },
    ],
    admin_launch_free_provinces: {
      provinces: [
        { code: '29', name: 'Málaga', region: 'AN', region_name: 'Andalucía', launch_free_until: '2027-03-31', signups_free: true, businesses: 12, free_launch: 12, free_open: 0, trials: 0 },
        { code: '28', name: 'Madrid', region: 'MD', region_name: 'Comunidad de Madrid', launch_free_until: null, signups_free: false, businesses: 4, free_launch: 0, free_open: 0, trials: 4 },
      ],
      unknown: { businesses: 1, trials: 1, list: [{ id: SIN_PROV, name: 'Bar Sonda Lisboa', city: 'Lisboa', plan: 'standard', status: 'trial', period_end: '2026-12-03' }] },
      all: [{ code: '18', name: 'Granada' }, { code: '28', name: 'Madrid' }, { code: '29', name: 'Málaga' }, { code: '44', name: 'Teruel' }],
    },
    admin_set_province_launch_free: (b) => ({ code: b.p_province, until: b.p_until, converted: 4, moved: 0, businesses: 4 }),
  });
  await p.goto(`${BASE}/admin/#/crecer`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#crProvincias [data-gratis]');
  const v = (await p.locator('#crProvincias').innerText()).replace(/\s+/g, ' ');
  ok(/Málaga · gratis hasta el 31 mar 2027 · 12 negocios · 0 en prueba/.test(v), `${nombre}/${t} gratis: «Málaga · gratis hasta el 31 mar 2027 · 12 negocios · 0 en prueba»`);
  ok(/Madrid · altas con prueba · 4 negocios · 4 en prueba/.test(v), `${nombre}/${t} gratis: Madrid, altas con prueba`);
  ok(/Sin provincia · 1 negocio · 1 en prueba/.test(v) && await p.locator(`#crProvincias a[href="#/negocios/${SIN_PROV}"]`).count() === 1,
    `${nombre}/${t} gratis: «Sin provincia» con el enlace a la ficha`);
  ok(await p.locator('#crProvincias [data-gratis-fecha]').count() === 1 && await p.locator('#crProvincias [data-gratis-quita]').count() === 1
    && await p.locator('#crCiudades [data-gratis], #crCiudades [data-gratis-fecha]').count() === 0,
  `${nombre}/${t} gratis: «Cambiar la fecha…» y «Quitar el gratis…» en la provincia; nada del gratis en las ciudades`);
  const opciones = await p.locator('#crProvOtra option').allTextContents();
  ok(opciones.join('|') === 'Otra provincia…|Granada|Teruel' && await p.locator('#crProvOtraBtn').isDisabled(),
    `${nombre}/${t} gratis: el selector trae solo las que no están (${opciones.join('|')})`);
  await p.screenshot({ path: `${OUT}/web-admin-crecer-gratis-${nombre}-${t}.png`, fullPage: true });
  // Encender Madrid: pide la fecha (mañana como pronto).
  await p.click('#crProvincias [data-gratis="1"]');
  await p.waitForSelector('#modal input[name=until]');
  const min = await p.locator('#modal input[name=until]').getAttribute('min');
  const manana = new Date(Date.now() + 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const dlg = await p.locator('#modal').innerText();
  ok(min === manana && /provincia de Madrid/.test(dlg) && /código postal/.test(dlg) && /prueba de 30 días/.test(dlg),
    `${nombre}/${t} gratis: el diálogo explica qué cambia y la fecha mínima es mañana (${min})`);
  await p.screenshot({ path: `${OUT}/web-admin-crecer-gratis-dialogo-${nombre}-${t}.png` });
  await p.locator('#modal input[name=until]').fill('2027-03-31');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(400);
  const enc = estado.llamadas.find(([fn, a]) => fn === 'admin_set_province_launch_free' && a.p_province === '28');
  ok(enc && enc[1].p_until === '2027-03-31', `${nombre}/${t} gratis: encender manda provincia y fecha ${JSON.stringify(enc?.[1])}`);
  // Otra provincia desde el selector.
  await p.waitForSelector('#crProvOtra');
  await p.selectOption('#crProvOtra', '44');
  ok(!await p.locator('#crProvOtraBtn').isDisabled(), `${nombre}/${t} gratis: al elegir una, el botón se enciende`);
  await p.click('#crProvOtraBtn');
  await p.waitForSelector('#modal input[name=until]');
  ok(/Gratis de lanzamiento en Teruel/.test(await p.locator('#modal').innerText()), `${nombre}/${t} gratis: «Otra provincia…» abre el diálogo de Teruel`);
  await p.locator('#modal input[name=until]').fill('2027-06-30');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(400);
  const otra = estado.llamadas.find(([fn, a]) => fn === 'admin_set_province_launch_free' && a.p_province === '44');
  ok(otra && otra[1].p_until === '2027-06-30', `${nombre}/${t} gratis: Teruel con su fecha ${JSON.stringify(otra?.[1])}`);
  // Cambiar la fecha: parte de la que hay.
  await p.waitForSelector('#crProvincias [data-gratis-fecha]');
  await p.click('#crProvincias [data-gratis-fecha]');
  await p.waitForSelector('#modal input[name=until]');
  const actual = await p.locator('#modal input[name=until]').inputValue();
  ok(actual === '2027-03-31', `${nombre}/${t} gratis: «Cambiar la fecha…» parte de la que hay (${actual})`);
  await p.screenshot({ path: `${OUT}/web-admin-crecer-fecha-${nombre}-${t}.png` });
  await p.locator('#modal input[name=until]').fill('2027-04-15');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(400);
  const cam = estado.llamadas.find(([fn, a]) => fn === 'admin_set_province_launch_free' && a.p_province === '29' && a.p_until);
  ok(cam && cam[1].p_until === '2027-04-15', `${nombre}/${t} gratis: «Cambiar la fecha» manda la nueva ${JSON.stringify(cam?.[1])}`);
  // Quitar el gratis: sin fecha.
  await p.waitForSelector('#crProvincias [data-gratis-quita]');
  await p.click('#crProvincias [data-gratis-quita]');
  await p.waitForSelector('#modal[open] button[type=submit]');
  ok(/31 mar 2027/.test(await p.locator('#modal').innerText()), `${nombre}/${t} gratis: «Quitar» dice hasta cuándo lo conservan`);
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(400);
  const quita = estado.llamadas.find(([fn, a]) => fn === 'admin_set_province_launch_free' && a.p_province === '29' && a.p_until === null);
  ok(!!quita, `${nombre}/${t} gratis: «Quitar el gratis» manda la fecha vacía`);
  ok(!estado.llamadas.some(([fn]) => /city_launch_free/.test(fn)), `${nombre}/${t} gratis: nada de las funciones de por ciudad`);
  ok(errores.length === 0, `${nombre}/${t} gratis sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    await festivos(nav, nombre, t, vp);
    await resumen(nav, nombre, t, vp);
    await crecer(nav, nombre, t, vp);
    await gratis(nav, nombre, t, vp);
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
