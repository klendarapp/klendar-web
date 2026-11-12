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
//   SUPABASE_BLOQUEADO=1 PORT=8843 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8843 node tools/festivos_check.mjs
import { mkdirSync } from 'node:fs';
import { playwright, REF, SUPA, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8843';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
// Las capturas, en tools/out/ (git las ignora): en la raíz se publicaban
// en klendar.app (revisión del 3-11-2026, 5.4).
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
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

async function contexto(nav, vp, rpc, lang = 'es') {
  const ctx = await nav.newContext({ viewport: vp, locale: lang === 'en' ? 'en-GB' : 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', l); } catch { /* */ } }, [`sb-${REF}-admin-auth-token`, sesion(), lang]);
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
  await p.goto(`${BASE}/admin#/festivos/2028`, { waitUntil: 'networkidle' });
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

/** «Cualquier municipio» (migración 20261260100020 de la app): buscar un
 * municipio (homónimos con su provincia), sus locales, «Añadir los dos…»,
 * «Añadir uno…», confirmar, cambiar y quitar; «Otros municipios». */
const T1 = 'f0000000-0000-4000-8000-000000000041';
const T2 = 'f0000000-0000-4000-8000-000000000042';
const TORRENT = { code: '46244', slug: 'torrent-valencia', name: 'Torrent', province: 'Valencia/València', region: 'VC', city_id: null, city_name: null, city_active: false, key: '46244' };
const DIAS_TORRENT = [
  { id: T1, day: '2028-02-03', name: 'Sant Blai', scope: 'local', region: 'VC', city: null, municipality: '46244', municipality_name: 'Torrent', municipality_slug: 'torrent-valencia', province: 'Valencia/València', source: 'DOGV núm. 1', status: 'proposed', origin: 'admin' },
  { id: T2, day: '2028-08-25', name: 'Mare de Déu del Rebollet', scope: 'local', region: 'VC', city: null, municipality: '46244', municipality_name: 'Torrent', municipality_slug: 'torrent-valencia', province: 'Valencia/València', source: 'DOGV núm. 1', status: 'confirmed', origin: 'admin' },
];
const GIRONA = { code: '17197', slug: 'torrent-girona', name: 'Torrent', province: 'Girona', region: 'CT', confirmed: 1, proposed: 0, ok: false,
  days: [{ id: 'g1', day: '2028-07-25', name: 'Sant Jaume', status: 'confirmed' }], bulletin: { name: 'DOGC', url: 'https://dogc.gencat.cat/' } };

async function municipio(nav, nombre, t, vp, lang = 'es') {
  const en = lang === 'en';
  const { ctx, p, estado, errores } = await contexto(nav, vp, {
    ...BASE_RPC,
    admin_holidays: () => ({
      holidays: [...FILAS_2028, ...DIAS_TORRENT],
      cities: CIUDADES,
      municipalities: [GIRONA, { code: '46244', slug: 'torrent-valencia', name: 'Torrent', province: 'Valencia/València', region: 'VC', confirmed: 1, proposed: 1, ok: false,
        days: DIAS_TORRENT.map(({ id, day, name, status }) => ({ id, day, name, status })), bulletin: { name: 'DOGV', url: 'https://dogv.gva.es/' } }],
      years: [2027, 2028],
      status: ESTADO_2028,
      watch: ESTADO_2028,
      import: null,
    }),
    admin_holiday_place: (b) => (b.p_place === 'torrent-valencia'
      ? { ok: true, place: TORRENT, bulletin: { name: 'DOGV', url: 'https://dogv.gva.es/' }, days: DIAS_TORRENT, national: 8, regional: 3 }
      : { ok: false, error: 'invalid_city' }),
    search_municipalities: (b) => (/^torr/i.test(b.p_q || '') ? [
      { code: '46244', slug: 'torrent-valencia', name: 'Torrent', province: 'Valencia/València', city_id: null, popular: false },
      { code: '17197', slug: 'torrent-girona', name: 'Torrent', province: 'Girona', city_id: null, popular: false },
      { code: '22234', slug: 'torrente-de-cinca', name: 'Torrente de Cinca', province: 'Huesca', city_id: null, popular: false },
    ] : []),
    admin_save_city_holidays: { ok: true, saved: 2 },
    admin_save_holiday: { ok: true, id: 'nuevo' },
    admin_confirm_holidays: (b) => ({ ok: true, confirmed: (b.p_ids || []).length }),
    admin_delete_holiday: { ok: true },
  }, lang);
  await p.goto(`${BASE}/admin#/festivos/2028`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#festMuniQ');
  const card = async () => (await p.locator('.fest-muni').innerText()).replace(/\s+/g, ' ');
  let c = await card();
  ok((en ? /Any town/ : /Cualquier municipio/).test(c) && (en ? /Popular/ : /Populares/).test(c) && /Madrid/.test(c) && /Zaragoza/.test(c),
    `${nombre}/${t}/${lang} municipio: «Cualquier municipio» con las Populares`);
  const otros = (await p.locator('#festOtros').innerText()).replace(/\s+/g, ' ');
  ok(/Torrent Girona · (Cataluña|Catalonia)/.test(otros) && /Torrent Valencia\/València · Comunitat Valenciana/.test(otros) && (en ? /1 of 2/ : /1 de 2/).test(otros),
    `${nombre}/${t}/${lang} municipio: «Otros municipios» con los dos Torrent y su provincia (${otros.slice(0, 160)})`);
  const todo = await p.locator('#view').innerText();
  ok(/Torrent \(Valencia\/València\)/.test(todo), `${nombre}/${t}/${lang} municipio: en «Todo», el local de Torrent con su provincia`);

  // Buscar: homónimos con su provincia y sin las Populares mientras se escribe.
  await p.fill('#festMuniQ', 'torrent');
  await p.waitForSelector('#festMuniRes a.fest-op');
  const res = (await p.locator('#festMuniRes').innerText()).replace(/\s+/g, ' ');
  ok(/Torrent Valencia\/València/.test(res) && /Torrent Girona/.test(res) && /Torrente de Cinca Huesca/.test(res) && await p.locator('#festPop').isHidden(),
    `${nombre}/${t}/${lang} municipio: el buscador con los homónimos y su provincia (${res})`);
  ok(estado.llamadas.some(([fn, a]) => fn === 'search_municipalities' && a.p_q === 'torrent' && a.p_limit === 8), `${nombre}/${t}/${lang} municipio: usa search_municipalities`);
  await p.screenshot({ path: `${OUT}/web-admin-festivos-buscar-${nombre}-${t}-${lang}.png` });
  await p.click('#festMuniRes a.fest-op >> nth=0');
  await p.waitForSelector('#festLugar');
  ok(/#\/festivos\/2028\?m=torrent-valencia$/.test(p.url()), `${nombre}/${t}/${lang} municipio: el elegido va en la dirección (${p.url()})`);
  c = await card();
  ok(/Torrent Valencia\/València · Comunitat Valenciana/.test(c) && /46244/.test(c) && /8 (nacionales|national)/.test(c) && /3 (de su comunidad|regional)/.test(c)
    && /Sant Blai/.test(c) && /Mare de Déu del Rebollet/.test(c) && await p.locator('#festLugar a[href="https://dogv.gva.es/"]').count() === 1,
  `${nombre}/${t}/${lang} municipio: el elegido con provincia, comunidad, código, lo que le toca, sus días y el DOGV (${c.slice(0, 260)})`);
  ok(await p.locator('a.btn[href="#/festivos/2027?m=torrent-valencia"]').count() === 1, `${nombre}/${t}/${lang} municipio: el año de al lado conserva el municipio`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nombre}/${t}/${lang} municipio: sin scroll horizontal`);
  await p.locator('.fest-muni').screenshot({ path: `${OUT}/web-admin-festivos-municipio-${nombre}-${t}-${lang}.png` });

  // «Añadir los dos…» del elegido: con su código.
  await p.click('#lugarDos');
  await p.waitForSelector('#modal input[name=d1]');
  const dlg = await p.locator('#modal').innerText();
  ok((en ? /Local holidays 2028 · Torrent \(Valencia\/València\)/ : /Locales de 2028 · Torrent \(Valencia\/València\)/).test(dlg) && /DOGV/.test(dlg),
    `${nombre}/${t}/${lang} municipio: «Añadir los dos…» con el municipio y su boletín`);
  ok(await p.locator('#modal input[name=d1]').inputValue() === '2028-02-03', `${nombre}/${t}/${lang} municipio: parte de los días que hay`);
  await p.fill('#modal input[name=source]', 'DOGV núm. 9999, 20-12-2027');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(400);
  const dos = estado.llamadas.find(([fn]) => fn === 'admin_save_city_holidays');
  ok(dos && dos[1].p_city === '46244' && dos[1].p_days.length === 2 && dos[1].p_days[1].name === 'Mare de Déu del Rebollet',
    `${nombre}/${t}/${lang} municipio: guarda los dos con el código del municipio ${JSON.stringify(dos?.[1])}`);

  // «Añadir uno…»: local y el municipio ya elegido.
  await p.waitForSelector('#lugarUno');
  await p.click('#lugarUno');
  await p.waitForSelector('#modal select[name=city]');
  ok(await p.locator('#modal select[name=city]').inputValue() === '46244' && await p.locator('#modal select[name=scope]').inputValue() === 'local',
    `${nombre}/${t}/${lang} municipio: «Añadir uno…» parte de local y de Torrent`);
  await p.fill('#modal input[name=day]', '2028-09-08');
  await p.fill('#modal input[name=name]', 'Fira de Torrent');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(400);
  const uno = estado.llamadas.find(([fn]) => fn === 'admin_save_holiday');
  ok(uno && uno[1].p_city === '46244' && uno[1].p_scope === 'local' && uno[1].p_day === '2028-09-08', `${nombre}/${t}/${lang} municipio: «Añadir uno…» manda el municipio ${JSON.stringify(uno?.[1])}`);

  // Confirmar, cambiar y quitar uno de sus días.
  await p.waitForSelector(`#festLugar [data-confirmar="${T1}"]`);
  await p.click(`#festLugar [data-confirmar="${T1}"]`);
  await p.waitForTimeout(400);
  const conf = estado.llamadas.find(([fn]) => fn === 'admin_confirm_holidays');
  ok(conf && JSON.stringify(conf[1].p_ids) === JSON.stringify([T1]), `${nombre}/${t}/${lang} municipio: «Confirmar» con su id`);
  await p.waitForSelector(`#festLugar [data-editar="${T2}"]`);
  await p.click(`#festLugar [data-editar="${T2}"]`);
  await p.waitForSelector('#modal select[name=city]');
  ok(await p.locator('#modal select[name=city]').inputValue() === '46244', `${nombre}/${t}/${lang} municipio: «Cambiar» se queda en Torrent (no en Madrid)`);
  await p.click('#modal [data-cancel]');
  await p.click(`#festLugar [data-quitar="${T2}"]`);
  await p.waitForSelector('#modal[open] button[type=submit]');
  ok(/Torrent \(Valencia\/València\)/.test(await p.locator('#modal').innerText()), `${nombre}/${t}/${lang} municipio: «Quitar» dice qué municipio`);
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(400);
  ok(estado.llamadas.some(([fn, a]) => fn === 'admin_delete_holiday' && a.p_id === T2), `${nombre}/${t}/${lang} municipio: «Quitar» con su id`);

  // «Otros municipios» › «Añadir los dos…» de Torrent (Girona).
  await p.waitForSelector('[data-muni="0"]');
  await p.click('[data-muni="0"]');
  await p.waitForSelector('#modal input[name=d1]');
  ok(/Torrent \(Girona\)/.test(await p.locator('#modal').innerText()), `${nombre}/${t}/${lang} municipio: «Otros municipios» › «Añadir los dos…» de Torrent (Girona)`);
  await p.fill('#modal input[name=d2]', '2028-12-26');
  await p.fill('#modal input[name=n2]', 'Sant Esteve');
  await p.fill('#modal input[name=source]', 'DOGC núm. 1, 1-1-2028');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(400);
  ok(estado.llamadas.some(([fn, a]) => fn === 'admin_save_city_holidays' && a.p_city === '17197' && a.p_days.length === 2),
    `${nombre}/${t}/${lang} municipio: guarda los de Girona con su código`);

  // Un municipio que no existe.
  await p.goto(`${BASE}/admin#/festivos/2028?m=atlantida`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.fest-lugar');
  ok((en ? /isn’t in the official list/ : /no está en la lista oficial/).test(await p.locator('.fest-lugar').innerText()), `${nombre}/${t}/${lang} municipio: uno que no existe lo dice`);
  ok(errores.length === 0, `${nombre}/${t}/${lang} municipio sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function resumen(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, {
    ...BASE_RPC,
    admin_holiday_alert: { year: 2028, count: 2, text: 'Festivos: faltan los locales de 2028 en Zaragoza y Valladolid', summary: '2028: nacionales confirmados · locales 16 de 18 ciudades' },
  });
  await p.goto(`${BASE}/admin#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#bandeja');
  const fila = p.locator('#bandeja .bj[data-k="festivo:aviso"]');
  ok(await fila.count() === 1 && /faltan los locales de 2028 en Zaragoza y Valladolid/.test(await fila.innerText())
    && await fila.locator('a[href="#/festivos/2028"]').count() === 1, `${nombre}/${t} resumen: los festivos en «Pendiente de ti»`);
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
  await p.goto(`${BASE}/admin#/crecer`, { waitUntil: 'networkidle' });
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
  await p.goto(`${BASE}/admin#/crecer`, { waitUntil: 'networkidle' });
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
    await municipio(nav, nombre, t, vp);
    if (t === 'escritorio') await municipio(nav, nombre, t, vp, 'en');
    await resumen(nav, nombre, t, vp);
    await crecer(nav, nombre, t, vp);
    await gratis(nav, nombre, t, vp);
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
