// «Cerca de mí» sola y el mapa en su zona (Iván, 24-11-2026; RUNBOOK
// §4zzz-ubicacion-web), con las Functions de verdad contra el Supabase falso
// (tools/_web_con_datos.mjs), en Chromium y WebKit:
//
//  1. Con el permiso de ubicación YA concedido, Explorar y Descubre (es y en)
//     sin zona en la dirección se vuelven a pedir con su celda (`?celda=` /
//     `?cell=`), una sola vez y sin entrada nueva en el historial.
//  2. Lo elegido no se pisa: ciudad, «Todas las ciudades», la visita de «Más
//     planes en …», una página (`p`), los filtros guardados con una ciudad; ni
//     si se toca la página antes de tener la posición.
//  3. Sin el permiso: nada se pide al cargar (ni una llamada a la
//     geolocalización); «Usar mi ubicación» sigue como siempre.
//  4. Con el idioma guardado en inglés, primero al otro idioma y luego la celda.
//  5. El mapa (con token de Mapbox; si no, se salta): sin planes ni sitios
//     (una celda en Huelva, el municipio de Teruel), en su zona y con los
//     5 km a la vista, no en Madrid; con planes y sitios (Madrid), igual de
//     bien. Planes y Sitios, móvil y escritorio. Con UBIC_RAPIDO=1 (el
//     pre-push), el mapa solo en Chromium.
//
//   node tools/ubicacion_sola_check.mjs
import { webConDatos } from './_web_con_datos.mjs';

const KCe = (await import('../assets/celda.js')).default;
let fallos = 0;
const ok = (c, m, extra = '') => { if (c) console.log(`ok: ${m}`); else { fallos += 1; console.log(`FALLO: ${m} ${extra}`); } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const MADRID = { lat: 40.41123, lng: -3.70687 };
const CELDA = KCe.de(MADRID.lat, MADRID.lng);
const HUELVA = { lat: 37.2614, lng: -6.9447 };
const CELDA_HUELVA = KCe.de(HUELVA.lat, HUELVA.lng);
const TERUEL = { lat: 40.3456, lng: -1.1065 };

let PW = process.env.PW;
if (!PW) {
  try {
    const { readdirSync } = await import('node:fs');
    const base = `${process.env.LOCALAPPDATA || ''}\\npm-cache\\_npx`;
    for (const d of readdirSync(base)) { try { readdirSync(`${base}\\${d}\\node_modules\\playwright`); PW = `${base}\\${d}\\node_modules\\playwright`; break; } catch { /* otra */ } }
  } catch { /* sin caché de npx */ }
}
if (!PW) { console.log('(sin Playwright: me salto la prueba)'); process.exit(0); }
process.env.PW = PW;
const { playwright } = await import('./_supabase_simulado.mjs');
const pw = playwright();
const web = await webConDatos({ puerto: Number(process.env.PORT || 8971) });
const BASE = web.BASE;

// Cada página apunta su dirección y `history.length` (en esta pestaña) y
// cuántas veces se ha pedido la posición; con `lenta`, la posición tarda.
const espia = ({ lenta = 0 } = {}) => {
  try {
    const l = JSON.parse(sessionStorage.getItem('__nav') || '[]');
    l.push(`${location.pathname}${location.search}|${history.length}`);
    sessionStorage.setItem('__nav', JSON.stringify(l));
  } catch { /* nada */ }
  window.__geo = 0;
  if (navigator.geolocation) {
    const g = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (ok2, ko, o) => {
      window.__geo += 1;
      return g((p) => (lenta ? setTimeout(() => ok2(p), lenta) : ok2(p)), ko, o);
    };
  }
};

async function contexto(nav, { permiso = true, lenta = 0, donde = MADRID, vp = { width: 1280, height: 800 } } = {}) {
  const ctx = await nav.newContext({ geolocation: { latitude: donde.lat, longitude: donde.lng, accuracy: 10 }, ...(permiso ? { permissions: ['geolocation'] } : {}), locale: 'es-ES', viewport: vp });
  await ctx.addInitScript(espia, { lenta });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  return { ctx, p, errores };
}
const nav0 = (p) => p.evaluate(() => JSON.parse(sessionStorage.getItem('__nav') || '[]'));
// Lo que pasa en 2,5 s después de cargar (la posición llega enseguida).
const quieto = async (p) => { await p.waitForLoadState('networkidle').catch(() => {}); await espera(2500); return p.url(); };

for (const tipo of ['chromium', 'webkit']) {
  const nav = await pw[tipo].launch();
  try {
    // 1. Con el permiso ya dado: a la celda, una vez y con replace.
    for (const [ruta, clave] of [['/explorar?vista=lista', 'celda'], ['/descubre', 'celda'], ['/en/explore?view=list', 'cell'], ['/en/discover', 'cell']]) {
      const { ctx, p, errores } = await contexto(nav);
      const concedido = await (async () => { await p.goto(`${BASE}/sobre`); return p.evaluate(async () => { try { return (await navigator.permissions.query({ name: 'geolocation' })).state; } catch (e) { return String(e); } }); })();
      if (concedido !== 'granted') { ok(false, `${tipo}: el navegador de prueba dice el permiso concedido`, concedido); await ctx.close(); continue; }
      await p.goto(`${BASE}${ruta}`);
      await p.waitForURL(new RegExp(`[?&]${clave}=${CELDA}`), { timeout: 10000 }).catch(() => {});
      const u = new URL(await quieto(p));
      const l = await nav0(p);
      const largos = l.map((x) => x.split('|')[1]);
      ok(u.searchParams.get(clave) === CELDA && !u.searchParams.has('lat'), `${tipo} ${ruta}: con el permiso, a su celda sin pulsar nada`, p.url());
      ok(l.length === 3 && largos[1] === largos[2], `${tipo} ${ruta}: una sola recarga y sin entrada nueva en el historial`, JSON.stringify(l));
      ok(/vista=lista|view=list/.test(u.search) === /vista|view/.test(ruta), `${tipo} ${ruta}: lo demás de la dirección se queda`, u.search);
      const guardado = await p.evaluate(() => JSON.parse(localStorage.getItem('klendar.cerca') || 'null'));
      ok(guardado && Math.abs(guardado.lat - MADRID.lat) < 1e-9, `${tipo} ${ruta}: tu punto, en este navegador como con «Cerca de mí»`);
      ok(!errores.length, `${tipo} ${ruta}: sin errores`, errores.join(' | '));
      await ctx.close();
    }

    // 2. Lo elegido no se pisa.
    {
      const { ctx, p, errores } = await contexto(nav);
      for (const ruta of ['/explorar?ciudad=malaga&vista=lista', '/explorar?todas=1&vista=lista', '/descubre?ciudad=malaga&visita=1', '/explorar?vista=lista&p=2', '/en/explore?city=malaga', '/descubre?celda=' + KCe.de(36.72, -4.42)]) {
        // (Sin los filtros que ha guardado la anterior: esos sí se recuperan, como siempre.)
        await p.goto(`${BASE}/sobre`);
        await p.evaluate(() => localStorage.removeItem('klendar.filtros'));
        await p.goto(`${BASE}${ruta}`);
        const u = await quieto(p);
        ok(u === `${BASE}${ruta}`, `${tipo} ${ruta}: se queda como está`, u);
      }
      // Filtros guardados con una ciudad: los recupera y no se pisan.
      await p.evaluate(() => localStorage.setItem('klendar.filtros', JSON.stringify({ t: Date.now(), es: 'ciudad=malaga', en: 'city=malaga' })));
      await p.goto(`${BASE}/descubre`);
      const g = new URL(await quieto(p));
      ok(g.searchParams.get('ciudad') === 'malaga' && !g.searchParams.has('celda'), `${tipo}: con una ciudad guardada, la ciudad (no tu celda)`, g.search);
      ok(!errores.length, `${tipo}: lo elegido, sin errores`, errores.join(' | '));
      await ctx.close();
    }
    {
      // Tocar la página antes de tener la posición (aquí tarda 2,5 s).
      const { ctx, p } = await contexto(nav, { lenta: 2500 });
      await p.goto(`${BASE}/explorar?vista=lista`);
      await p.mouse.click(5, 300);
      await espera(4000);
      ok(!new URL(p.url()).searchParams.has('celda'), `${tipo}: si tocas antes de tener la posición, no se mueve nada`, p.url());
      await ctx.close();
    }

    // 3. Sin el permiso: nada se pide al cargar; el botón, como siempre.
    {
      const { ctx, p, errores } = await contexto(nav, { permiso: false });
      for (const ruta of ['/explorar?vista=lista', '/descubre', '/en/discover']) {
        await p.goto(`${BASE}${ruta}`);
        const u = await quieto(p);
        ok(u === `${BASE}${ruta}` && (await p.evaluate(() => window.__geo)) === 0, `${tipo} ${ruta}: sin permiso, ni se pide ni se mueve`, `${u} geo=${await p.evaluate(() => window.__geo)}`);
      }
      await p.goto(`${BASE}/explorar?vista=lista`);
      await quieto(p);
      ok(await p.locator('[data-cerca-aviso] [data-cerca]').first().isVisible(), `${tipo}: sin permiso, el aviso «Usar mi ubicación» de siempre`);
      await ctx.grantPermissions(['geolocation']);
      await p.locator('[data-cerca-aviso] [data-cerca]').first().click();
      await p.waitForURL(/celda=/, { timeout: 10000 }).catch(() => {});
      ok(new URL(p.url()).searchParams.get('celda') === CELDA, `${tipo}: al pulsarlo, a tu celda`, p.url());
      ok(!errores.length, `${tipo}: sin permiso, sin errores`, errores.join(' | '));
      await ctx.close();
    }

    // 4. El idioma guardado manda primero.
    {
      const { ctx, p } = await contexto(nav);
      await p.goto(`${BASE}/sobre`);
      await p.evaluate(() => localStorage.setItem('klendar_lang', 'en'));
      await p.goto(`${BASE}/explorar?vista=lista`);
      await p.waitForURL(/\/en\/explore\?.*cell=/, { timeout: 10000 }).catch(() => {});
      const u = new URL(await quieto(p));
      ok(u.pathname === '/en/explore' && u.searchParams.get('cell') === CELDA, `${tipo}: con el inglés guardado, /en/explore con su celda`, p.url());
      await ctx.close();
    }
  } finally {
    await nav.close();
  }
}

// 5. El mapa en su zona.
const tk = await (await fetch(`${BASE}/api/mapbox-token`)).json().catch(() => ({}));
if (!tk?.token) console.log('(sin token de Mapbox: me salto el mapa)');
else {
  // ¿Se ve entero el círculo de [r] m alrededor de [c] y está el centro cerca?
  const mira = (p, cual) => p.evaluate((n) => {
    const m = window[n];
    const b = m.getBounds();
    const c = m.getCenter();
    return { w: b.getWest(), e: b.getEast(), s: b.getSouth(), n: b.getNorth(), lat: c.lat, lng: c.lng, z: m.getZoom() };
  }, cual);
  // (Mapbox da los bordes sin el margen de `fitBounds`: el círculo justo; un 1 % de holgura.)
  const dentro = (v, c, r) => {
    const dLat = (r * 0.99) / 111320; const dLng = (r * 0.99) / (111320 * Math.cos(c.lat * Math.PI / 180));
    return v.s <= c.lat - dLat && v.n >= c.lat + dLat && v.w <= c.lng - dLng && v.e >= c.lng + dLng;
  };
  const cerca = (v, c, m) => KCe.metros(v.lat, v.lng, c.lat, c.lng) <= m;
  const casos = [
    { nombre: 'Planes, Huelva sin planes', ruta: `/explorar?celda=${CELDA_HUELVA}&vista=mapa`, mapa: 'KlendarMapa', c: HUELVA, r: 5000, punto: HUELVA },
    { nombre: 'Planes, Huelva sin planes, sin tu punto', ruta: `/explorar?celda=${CELDA_HUELVA}&vista=mapa`, mapa: 'KlendarMapa', c: KCe.centro(CELDA_HUELVA), r: 5000 },
    { nombre: 'Planes, Teruel (municipio) sin planes', ruta: '/explorar?ciudad=teruel&vista=mapa', mapa: 'KlendarMapa', c: TERUEL, r: 0 },
    { nombre: 'Planes, Madrid con planes', ruta: `/explorar?celda=${CELDA}&vista=mapa`, mapa: 'KlendarMapa', c: MADRID, r: 0, lejos: 15000, punto: MADRID },
    { nombre: 'Sitios, Huelva sin sitios', ruta: `/explorar?celda=${CELDA_HUELVA}&que=sitios&vista=mapa`, mapa: 'KlendarMapaSitios', c: HUELVA, r: 5000, punto: HUELVA },
    { nombre: 'Sitios, Teruel (municipio) sin sitios', ruta: '/explorar?ciudad=teruel&que=sitios&vista=mapa', mapa: 'KlendarMapaSitios', c: TERUEL, r: 0 },
    { nombre: 'Sitios, Madrid con sitios', ruta: `/explorar?celda=${CELDA}&que=sitios&vista=mapa`, mapa: 'KlendarMapaSitios', c: MADRID, r: 5000, punto: MADRID },
  ];
  const tipos = process.env.UBIC_RAPIDO ? ['chromium'] : ['chromium', 'webkit'];
  for (const tipo of tipos) {
    const nav = await pw[tipo].launch();
    try {
      for (const [vpn, vp] of [['móvil', { width: 375, height: 812 }], ['escritorio', { width: 1280, height: 800 }]]) {
        for (const k of casos) {
          const ctx = await nav.newContext({ locale: 'es-ES', viewport: vp, colorScheme: 'dark' });
          const p = await ctx.newPage();
          const errores = [];
          p.on('pageerror', (e) => errores.push(String(e)));
          await p.goto(`${BASE}/sobre`);
          await p.evaluate((pt) => { sessionStorage.clear(); if (pt) localStorage.setItem('klendar.cerca', JSON.stringify({ lat: pt.lat, lng: pt.lng, t: Date.now() })); else localStorage.removeItem('klendar.cerca'); }, k.punto || null);
          await p.goto(`${BASE}${k.ruta}`, { waitUntil: 'domcontentloaded' });
          const listo = await p.waitForFunction((n) => window[n] && window[n].loaded && window[n].loaded(), k.mapa, { timeout: 30000 }).then(() => true).catch(() => false);
          if (!listo) { ok(false, `${tipo} ${vpn} ${k.nombre}: el mapa carga`); await ctx.close(); continue; }
          const v = await mira(p, k.mapa);
          ok(cerca(v, k.c, k.lejos || 1500), `${tipo} ${vpn} ${k.nombre}: centrado en su zona`, JSON.stringify(v));
          if (k.r) ok(dentro(v, k.c, k.r), `${tipo} ${vpn} ${k.nombre}: los ${k.r / 1000} km enteros a la vista`, JSON.stringify(v));
          ok(!errores.length, `${tipo} ${vpn} ${k.nombre}: sin errores`, errores.join(' | '));
          if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/ubic-${tipo}-${vpn}-${k.nombre.replace(/[^a-z]+/gi, '-')}.png` });
          await ctx.close();
        }
      }
    } finally {
      await nav.close();
    }
  }
}

await web.cierra();
console.log(fallos ? `\n${fallos} fallo(s).` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
