// Saltos entre pestañas, el logo y «Más formas de explorar» (Iván,
// 2026-11-04), en la web local, Chromium y WebKit, a 390 y 1280 px, con una
// sesión de mentira (Supabase falso para «Tu cuenta»):
//  1. Al ir de Descubre a Explorar, Planes, Cuenta y otra vez Descubre por la
//     barra de pestañas: la cabecera (logo y pestañas) está en el mismo sitio
//     en todas, del primer cuadro al último; el desplazamiento de maquetación
//     (CLS, solo Chromium: WebKit no lo mide) por debajo de 0,01; y el cambio
//     de pestaña no se funde (sin View Transition, `pagereveal`).
//  2. En Descubre, tocar otra vez «Descubre» no navega: sube arriba o trae la
//     lista otra vez, y «Atrás» lleva a la página de antes (sin entradas de
//     más). El logo lleva siempre a la portada, también desde Descubre
//     (Iván, 2026-11-05), y «Atrás» vuelve.
//  3. «Más formas de explorar»: sin zona, el orden de siempre (el de
//     `public_cities`); con «¿Dónde?» (municipio o posición), la más cercana
//     primero y como mucho 6; con la zona de la conexión (BASE_IP, otro
//     serve_dev con CF_PRUEBA) también por cercanía, y con «Tu ciudad»
//     guardada en el navegador, la de tu ciudad primero.
// Capturas en OUT.
//
// Con sus propios datos (tools/_web_con_datos.mjs) y dos webs: la de siempre
// y otra con la zona de la conexión en Zaragoza (CF_PRUEBA). Antes leía las
// ciudades de dev y, desde que las pruebas no llegan a Supabase (5-11),
// «Más formas de explorar» salía vacío.
//
//   PW=<ruta a playwright> OUT=<carpeta> node tools/saltos_check.mjs
import { mkdirSync } from 'node:fs';
import { playwright, REF } from './_supabase_simulado.mjs';
import { DATOS, webConDatos } from './_web_con_datos.mjs';

const { chromium, webkit } = playwright();

// Las ciudades con algo publicado (`public_cities`, la forma de la base:
// `{ city, slug, n }`, de más a menos): más de 6, para ver el tope. Barcelona
// y Getafe, sin nada (como en dev cuando se escribió la prueba).
const PUBLICADAS = [
  ['zaragoza', 'Zaragoza', 41.6488, -0.8891], ['madrid', 'Madrid', 40.4168, -3.7038], ['malaga', 'Málaga', 36.7213, -4.4214],
  ['sevilla', 'Sevilla', 37.3891, -5.9845], ['valencia', 'Valencia', 39.4699, -0.3763], ['bilbao', 'Bilbao', 43.263, -2.935],
  ['valladolid', 'Valladolid', 41.6523, -4.7245], ['granada', 'Granada', 37.1773, -3.5986],
];
const yaEsta = new Set(DATOS.CIUDADES.map((c) => c.id));
const CIUDADES = [...DATOS.CIUDADES, ...PUBLICADAS.filter(([id]) => !yaEsta.has(id)).map(([id, name, lat, lng], i) => ({
  id, name, lat, lng, position: 10 + i, active: true, province: name, time_zone: 'Europe/Madrid', radius_m: 25000,
}))];
const MUNICIPIOS = [...DATOS.MUNICIPIOS,
  ...PUBLICADAS.filter(([id]) => !DATOS.MUNICIPIOS.some((m) => m.slug === id)).map(([slug, name, lat, lng], i) => ({
    code: `990${i}`, slug, name, province: name, lat, lng, population: 500000, city_id: slug, radius_m: 25000, active: true })),
  { code: '28065', slug: 'getafe', name: 'Getafe', province: 'Madrid', lat: 40.3083, lng: -3.7327, population: 185000, city_id: null, radius_m: 15000, active: false },
];
const conDatos = (puerto, entorno = {}) => webConDatos({
  puerto, entorno, datos: { ...DATOS, CIUDADES, MUNICIPIOS },
  rpc: {
    public_cities: () => PUBLICADAS.map(([slug, city], i) => ({ city, slug, n: 40 - i * 4 })),
    // La forma de la base (`returns table (municipality jsonb, match text)`).
    resolve_municipality: (a) => MUNICIPIOS.filter((m) => m.slug === String(a.p_slug || '').toLowerCase())
      .map((m) => ({ municipality: { ...m, popular: Boolean(m.city_id) }, match: 'slug' })),
  },
});
// La de la conexión primero: los contextos hablan con el último falso
// arrancado, y los dos tienen los mismos datos.
const webIp = await conDatos(Number(process.env.PORT_IP || 8994), { CF_PRUEBA: '{"country":"ES","latitude":"41.65","longitude":"-0.88"}' });
const web = await conDatos(Number(process.env.PORT || 8992));
const BASE = web.BASE;
const BASE_IP = webIp.BASE;
const OUT = process.env.OUT || 'tools/out';
mkdirSync(OUT, { recursive: true });
const U = '0e7717e0-0000-4000-8000-0000000094a1';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'saltos@example.com', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Iván' }, created_at: '2026-01-01T00:00:00Z' };
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2' })}.firma`;
const SESION = JSON.stringify({ access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

// Lo que se mide en cada página, desde antes de pintar nada.
function medir() {
  const d = { cls: 0, shifts: [], frames: [], vt: null };
  window.__m = d;
  addEventListener('pagereveal', (e) => { d.vt = Boolean(e.viewTransition); });
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        d.cls += e.value;
        d.shifts.push(`${e.value.toFixed(4)} ${(e.sources || []).map((s) => (s.node && s.node.nodeType === 1 ? s.node.tagName + '.' + String(s.node.className).split(' ')[0] : '?')).join(',')}`);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch { /* WebKit: sin layout-shift */ }
  const t0 = performance.now();
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  const paso = () => {
    const h = document.querySelector('header.top');
    // Visible (no `offsetParent`: en Descubre del móvil la cabecera es
    // `position: fixed`, encima de la foto, desde 4e6c9ad, y entonces es null;
    // con dev vacío no había tarjetas y no se notaba).
    if (h && h.getClientRects().length && getComputedStyle(h).visibility !== 'hidden') {
      const f = JSON.stringify({ brand: r(h.querySelector('.brand')), tabs: r(h.querySelector('.pestanas')), hdr: r(h) });
      if (d.frames[d.frames.length - 1] !== f) d.frames.push(f);
    }
    if (performance.now() - t0 < 4000) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// La sesión de mentira; lo demás (Descubre, Explorar…), a los datos de
// mentira de webConDatos (`fallback`: el enrutado de antes).
const supabaseFalso = (route) => {
  const p = new URL(route.request().url()).pathname;
  const j = (x) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
  if (p.startsWith('/auth/v1/user')) return j(USER);
  if (p.startsWith('/rest/v1/rpc/my_consents')) return j({ terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true });
  if (p.startsWith('/rest/v1/rpc/my_')) return j([]);
  if (p.startsWith('/auth/v1/') && p !== '/auth/v1/settings') return j({});
  return route.fallback();
};

const enlacesMf = (p) => p.evaluate(() => {
  const fila = [...document.querySelectorAll('.mas-formas .mf-fila')][0];
  return fila ? [...fila.querySelectorAll('a')].filter((a) => !a.hidden).map((a) => a.getAttribute('href').split('/').filter(Boolean).pop()) : [];
});

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const w of [390, 1280]) {
    const tag = `${nombre}/${w}`;
    const ctx = await nav.newContext({ viewport: { width: w, height: w < 500 ? 844 : 800 }, colorScheme: 'dark', locale: 'es-ES', timezoneId: 'Europe/Madrid' });
    await ctx.addInitScript(([k, v]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, SESION]);
    await ctx.addInitScript(medir);
    await ctx.route(`https://${REF}.supabase.co/**`, supabaseFalso);
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));

    // 1. Las pestañas.
    await page.goto(`${BASE}/descubre`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    let cab = null;
    for (const tab of ['explorar', 'planes', 'cuenta', 'descubre', 'explorar']) {
      await page.locator(`a[data-tab="${tab}"]:visible`).first().click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(3000);
      const m = await page.evaluate(() => window.__m);
      const primero = JSON.parse(m.frames[0] || '{}');
      const ultimo = JSON.parse(m.frames[m.frames.length - 1] || '{}');
      const pos = JSON.stringify([primero.brand?.slice(0, 2), primero.tabs, primero.hdr?.[2]]);
      ok(JSON.stringify([ultimo.brand?.slice(0, 2), ultimo.tabs, ultimo.hdr?.[2]]) === pos, `${tag} → ${tab}: la cabecera no se mueve al cargar (${m.frames.length} posiciones)`);
      if (cab) ok(cab === pos, `${tag} → ${tab}: la cabecera, donde en la pestaña anterior ${cab === pos ? '' : `${cab} → ${pos}`}`);
      cab = pos;
      if (nombre === 'chromium') {
        ok(m.cls < 0.01, `${tag} → ${tab}: CLS ${m.cls.toFixed(4)}${m.shifts.length ? ` (${m.shifts.slice(0, 3).join(' | ')})` : ''}`);
        ok(m.vt === false, `${tag} → ${tab}: sin fundido entre pestañas (View Transition: ${m.vt})`);
      }
      await page.screenshot({ path: `${OUT}/saltos_${nombre}_${w}_${tab}.png` });
    }

    // 2. Tocar otra vez «Descubre» y «Atrás».
    await page.goto(`${BASE}/explorar`, { waitUntil: 'load' });
    await page.locator('a[data-tab="descubre"]:visible').first().click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);
    const enDescubre = page.url();
    const largo = await page.evaluate(() => history.length);
    let navegaciones = 0;
    const cuenta = (f) => { if (f === page.mainFrame()) navegaciones++; };
    page.on('framenavigated', cuenta);
    await page.evaluate(() => { const c = document.querySelector('body.pagina-feed') || document.scrollingElement; c.scrollTo(0, 900); });
    await page.waitForTimeout(400);
    await page.locator('a[data-tab="descubre"]:visible').first().click();
    await page.waitForTimeout(1200);
    const arriba = await page.evaluate(() => (document.querySelector('body.pagina-feed') || document.scrollingElement).scrollTop);
    ok(arriba <= 2, `${tag} «Descubre» en Descubre: sube arriba (${arriba})`);
    await page.locator('a[data-tab="descubre"]:visible').first().click();
    await page.waitForTimeout(3000);
    page.off('framenavigated', cuenta);
    ok(navegaciones === 0 && page.url() === enDescubre, `${tag} «Descubre» en Descubre: no navega (${navegaciones} navegaciones, ${page.url()})`);
    ok(await page.evaluate(() => history.length) === largo, `${tag} «Descubre» en Descubre: sin entradas de más en el historial`);
    await page.goBack();
    await page.waitForLoadState('load');
    ok(/\/explorar([/?]|$)/.test(page.url()), `${tag} «Atrás» tras «Descubre»: a Explorar (${page.url()})`);
    await page.goForward();
    await page.waitForLoadState('load');
    ok(/\/descubre([/?]|$)/.test(page.url()), `${tag} «Adelante»: otra vez Descubre`);
    // Desde Descubre, el logo lleva a la portada, y «Atrás» vuelve.
    await page.goto(`${BASE}/descubre`, { waitUntil: 'load' });
    await page.locator('header.top a.brand').first().click();
    await page.waitForLoadState('load');
    // Como una persona, «Atrás» cuando la portada ya ha pintado «Ahora
    // mismo»: si no, WebKit corta su petición y lo cuenta como error de la
    // página («Fetch API cannot load … access control checks»).
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    ok(new URL(page.url()).pathname === '/', `${tag} logo en Descubre: a la portada (${page.url()})`);
    await page.goBack();
    await page.waitForLoadState('load');
    ok(/\/descubre([/?]|$)/.test(page.url()), `${tag} «Atrás» desde la portada: a Descubre`);
    // Fuera de Descubre, igual.
    await page.goto(`${BASE}/explorar`, { waitUntil: 'load' });
    await page.locator('header.top a.brand').first().click();
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    ok(new URL(page.url()).pathname === '/', `${tag} logo en Explorar: a la portada`);
    await page.goBack();
    await page.waitForLoadState('load');
    ok(/\/explorar([/?]|$)/.test(page.url()), `${tag} «Atrás» desde la portada: a Explorar`);

    // 3. «Más formas de explorar».
    if (w === 1280) {
      await page.goto(`${BASE}/explorar?ciudad=zaragoza`, { waitUntil: 'load' });
      const z = await enlacesMf(page);
      ok(z[0] === 'zaragoza' && z.length <= 6, `${tag} «Más formas» con Zaragoza: Zaragoza primero (${z.join(', ')})`);
      await page.goto(`${BASE}/explorar?ciudad=getafe`, { waitUntil: 'load' });
      const g = await enlacesMf(page);
      ok(g[0] === 'madrid', `${tag} «Más formas» con Getafe (sin nada publicado): la más cercana primero (${g.join(', ')})`);
      await page.goto(`${BASE}/explorar?lat=41.39&lng=2.17`, { waitUntil: 'load' });
      const b = await enlacesMf(page);
      ok(b[0] === 'zaragoza', `${tag} «Más formas» cerca de Barcelona: Zaragoza primero (${b.join(', ')})`);
      await page.screenshot({ path: `${OUT}/saltos_${nombre}_mas_formas.png`, fullPage: false });
      // Sin zona (como Google): el orden de `public_cities`, todas.
      const html = await fetch(`${BASE}/explorar?todas=1`).then((r) => r.text());
      const sinZona = [...html.matchAll(/<h3>Qué hacer hoy en<\/h3><p>(.*?)<\/p>/g)][0]?.[1] || '';
      // El orden de siempre: el de `public_cities` de los datos de mentira,
      // y todas (antes, con MF_ORDEN, porque no se sabía el de dev).
      const deSiempre = PUBLICADAS.map(([slug]) => slug);
      const enHtml = [...sinZona.matchAll(/href="[^"]*\/([^/"]+)"/g)].map((x) => x[1]);
      ok(!/ hidden/.test(sinZona) && JSON.stringify(enHtml) === JSON.stringify(deSiempre), `${tag} «Más formas» sin zona: el orden de siempre (${enHtml.join(', ')})`);
      // Zona de la conexión en Zaragoza, pero «Tu ciudad» Madrid: Madrid primero.
      {
        const ctx2 = await nav.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-ES' });
        await ctx2.route(`https://${REF}.supabase.co/**`, supabaseFalso);
        const p2 = await ctx2.newPage();
        await p2.goto(`${BASE_IP}/explorar`, { waitUntil: 'load' });
        const ip = await enlacesMf(p2);
        ok(ip[0] === 'zaragoza' && ip.length <= 6, `${tag} «Más formas» con la zona de la conexión (Zaragoza): Zaragoza primero (${ip.join(', ')})`);
        await p2.evaluate(() => localStorage.setItem('klendar.gustos', JSON.stringify({ c: [], home: { slug: 'madrid', name: 'Madrid', lat: 40.4168, lng: -3.7038 } })));
        await p2.reload({ waitUntil: 'load' });
        const casa = await enlacesMf(p2);
        ok(casa[0] === 'madrid', `${tag} «Más formas» con «Tu ciudad» Madrid: Madrid primero (${casa.join(', ')})`);
        await ctx2.close();
      }
    }
    ok(errores.length === 0, `${tag} sin errores en la página${errores.length ? `: ${errores.slice(0, 2).join(' | ')}` : ''}`);
    await ctx.close();
  }
  await nav.close();
}
await web.cierra();
await webIp.cierra();
console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO BIEN');
process.exit(fallos ? 1 : 0);
