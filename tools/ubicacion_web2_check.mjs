// La ubicación en la web como en la app, segunda parte (Iván, 25-11-2026;
// RUNBOOK §4zzz-ubicacion-web2), con las Functions de verdad contra el
// Supabase falso (tools/_web_con_datos.mjs) y, en el navegador, Chromium y
// WebKit con el permiso de ubicación concedido, pendiente o denegado:
//
//  1. Partidos, Grupos, Sorteos y las guías: «Cerca de mí» con la CELDA en la
//     dirección (`?celda=` / `?cell=`), nunca `lat`/`lng`; los enlaces de
//     antes con `?lat=&lng=` van a su celda (301); Explorar y Descubre les
//     pasan la celda; con el permiso YA dado, solos a tu celda (una vez y sin
//     entrada nueva en el historial), sin pisar lo elegido (una ciudad en la
//     dirección o guardada, «Todas las ciudades», tocar la página antes) y
//     sin guardar tu punto; sin permiso, ni se pide.
//  2. El sello por visita (la ficha desde el QR): al abrir, nunca se pide la
//     ubicación; con el permiso ya dado, se usa; si no, «Usar mi ubicación»
//     (y, denegado, cómo permitirlo en el navegador).
//  3. «Estaba cerrado» en la ficha (`/b/`): `geolocation=(self)` en esa ruta
//     (antes `()` salvo con `?visita=`, y la web nunca comprobaba que estás
//     cerca) y la posición va si el permiso ya está dado; si no, sin ella y
//     sin pedirla.
//  5. «Avísame si…» en «Tu cuenta»: sin tu ubicación (denegada o sin dar),
//     se ofrece tu ciudad de «Tus gustos» (centro y radio), como la app.
//
// (El 4, la franja «Mira lo que hay cerca de ti», en tools/aviso_ubicacion_check.mjs.)
//
//   node tools/ubicacion_web2_check.mjs        (UBIC2_RAPIDO=1: solo Chromium)
import { webConDatos, DATOS } from './_web_con_datos.mjs';
import { conSesionCuenta } from './_cuenta_simulado.mjs';
import { SUPA } from './_supabase_simulado.mjs';

const KCe = (await import('../assets/celda.js')).default;
// (Dinámico: con el código de antes no existe y la prueba tiene que fallar, no romperse.)
const politicaPermisos = await import('../functions/_lib/permisos.js').then((m) => m.politicaPermisos, () => () => '');
let fallos = 0;
const ok = (c, m, extra = '') => { if (c) console.log(`ok: ${m}`); else { fallos += 1; console.log(`FALLO: ${m} ${extra}`); } };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const MADRID = { lat: 40.41123, lng: -3.70687 };
const CELDA = KCe.de(MADRID.lat, MADRID.lng);

let PW = process.env.PW;
if (!PW) {
  try {
    const { readdirSync } = await import('node:fs');
    const base = `${process.env.LOCALAPPDATA || ''}\\npm-cache\\_npx`;
    for (const d of readdirSync(base)) { try { readdirSync(`${base}\\${d}\\node_modules\\playwright`); PW = `${base}\\${d}\\node_modules\\playwright`; break; } catch { /* otra */ } }
  } catch { /* sin caché de npx */ }
}
if (PW) process.env.PW = PW;

// Un negocio con horario abierto todo el día (para «Estaba cerrado») y una guía.
const SIEMPRE = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [String(d), [['00:00', '23:59']]]));
const NEGOCIOS = DATOS.NEGOCIOS.map((b, i) => (i === 0 ? { ...b, opening_hours: SIEMPRE } : b));
const BAR = NEGOCIOS[0];
const PLANES_EV = DATOS.PLANES.filter((o) => o.kind === 'future_event');
const web = await webConDatos({
  puerto: Number(process.env.PORT || 8981),
  datos: { ...DATOS, NEGOCIOS },
  tablas: { app_config: [{ key: 'giveaways', value: { enabled: true, platforms: ['web', 'app'] } }] },
  rpc: {
    guide_info: (a) => (a.p_slug === 'navidad' ? { id: 'g1', slug: 'navidad', title: { es: 'Navidad', en: 'Christmas' }, title_place: true, text: { es: 'Luces.' },
      cover_url: null, place_name: a.p_lat != null ? 'Madrid' : null, scope_name: null, starts_on: '2026-12-01', ends_on: '2027-01-06', status: 'live', count: 5 } : null),
    guide_places: (a) => (a.p_slug === 'navidad' ? [{ code: '28079', slug: 'madrid', name: 'Madrid', province: 'Madrid', count: 4 }] : []),
    guide_offers: () => ({ total: 2, items: PLANES_EV.slice(0, 2) }),
  },
});
const BASE = web.BASE;
const ultima = (fn) => [...web.llamadas].reverse().find((l) => l.fn === fn)?.args;

// ── 1. El servidor ───────────────────────────────────────────────────────
{
  const pide = (r) => fetch(BASE + r, { redirect: 'manual' });
  for (const [vieja, buena] of [
    ['/partidos?lat=40.411&lng=-3.707&deporte=football', `/partidos?deporte=football&celda=${CELDA}`],
    ['/en/matches?lat=40.411&lng=-3.707', `/en/matches?cell=${CELDA}`],
    ['/grupos?lat=40.411&lng=-3.707&km=25', `/grupos?km=25&celda=${CELDA}`],
    ['/en/groups?lat=40.411&lng=-3.707', `/en/groups?cell=${CELDA}`],
    ['/sorteos?lat=40.411&lng=-3.707', `/sorteos?celda=${CELDA}`],
    ['/guia/navidad?lat=40.411&lng=-3.707&km=5', `/guia/navidad?km=5&celda=${CELDA}`],
  ]) {
    const r = await pide(vieja);
    ok(r.status === 301 && r.headers.get('location') === buena, `servidor: ${vieja} → 301 a su celda`, `${r.status} ${r.headers.get('location')}`);
  }
  for (const [ruta, clave, rpc] of [[`/partidos?celda=${CELDA}`, 'celda', 'where_to_watch'], [`/en/matches?cell=${CELDA}`, 'cell', 'where_to_watch'],
    [`/grupos?celda=${CELDA}`, 'celda', 'group_venues'], [`/sorteos?celda=${CELDA}`, 'celda', 'giveaways_near'], [`/guia/navidad?celda=${CELDA}&km=5`, 'celda', 'guide_offers']]) {
    const r = await pide(ruta);
    const h = await r.text();
    const a = ultima(rpc);
    const c = KCe.centro(CELDA);
    const radio = a?.p_radius_m ?? a?.p_filters?.radius_m;
    const km = rpc === 'where_to_watch' || rpc === 'guide_offers' ? 5 : 10;
    ok(r.status === 200 && a && a.p_lat === c.lat && a.p_lng === c.lng && radio === km * 1000 + KCe.margenM(CELDA),
      `servidor: ${ruta}: desde el centro de la celda, ${km} km y su margen`, JSON.stringify(a));
    ok(!/[?&;](lat|lng)=/.test(h.replace(/data-(lat|lng)="[^"]*"/g, '')) && (rpc === 'guide_offers' || rpc === 'giveaways_near' || h.includes(`name="${clave}" value="${CELDA}"`)),
      `servidor: ${ruta}: los enlaces y los formularios llevan la celda, no el punto`);
    ok(/\bpublic\b/.test(r.headers.get('cache-control') || '') && /s-maxage/.test(r.headers.get('cache-control') || ''), `servidor: ${ruta}: la misma para toda la celda (caché compartida)`, r.headers.get('cache-control'));
    ok(!h.includes('cloudflareinsights'), `servidor: ${ruta}: con la zona en la dirección, sin contador de visitas`);
  }
  const ex = await (await pide(`/explorar?celda=${CELDA}&vista=lista`)).text();
  ok(ex.includes(`/grupos?celda=${CELDA}`) && !/\/(partidos|grupos|sorteos)\?lat=/.test(ex), 'servidor: Explorar pasa la celda a Grupos y Sorteos');
  const de = await (await pide(`/descubre?celda=${CELDA}`)).text();
  ok(!/\/guia\/[^"]*\?lat=/.test(de), 'servidor: Descubre no pasa el punto a la guía');
  ok((await (await pide('/guia/navidad')).text()).includes('/assets/recupera-zona.js?v=2'), 'servidor: la guía sin municipio recupera la zona');
  // 3. La cabecera (la de functions/_middleware.js).
  for (const [ruta, si] of [['/b/bar-sonda-madrid', true], ['/en/b/bar-sonda-madrid', true], ['/b/bar-sonda-madrid?visita=x', true], ['/guia/navidad', true], ['/en/guide/navidad', true],
    ['/partidos', true], ['/o/123', false], ['/agenda', false], ['/m/abc', false]]) {
    ok(politicaPermisos(ruta).startsWith(si ? 'geolocation=(self)' : 'geolocation=()') && /camera=\(\)/.test(politicaPermisos(ruta)), `cabecera: ${ruta} ${si ? 'puede' : 'no puede'} usar la ubicación (solo klendar.app)`);
  }
  const mw = (await import('node:fs')).readFileSync(new URL('../functions/_middleware.js', import.meta.url), 'utf8');
  ok(/politicaPermisos\(pathname\)/.test(mw), 'cabecera: el middleware usa _lib/permisos.js');
  const pb = await pide(`/b/${BAR.slug}`);
  ok(/^geolocation=\(self\)/.test(pb.headers.get('permissions-policy') || ''), 'cabecera: la ficha, en local también', pb.headers.get('permissions-policy'));
}

if (!PW) { console.log('(sin Playwright: me salto el navegador)'); await web.cierra(); process.exit(fallos ? 1 : 0); }
const { playwright } = await import('./_supabase_simulado.mjs');
const pw = playwright();

// Cada página apunta su dirección y `history.length`, cuántas veces se ha
// pedido la posición y, con `estado`, lo que dice la API de permisos
// (denegado: el navegador de prueba no sabe ponerlo; se simula).
const espia = ({ estado = '' } = {}) => {
  try {
    const l = JSON.parse(sessionStorage.getItem('__nav') || '[]');
    l.push(`${location.pathname}${location.search}|${history.length}`);
    sessionStorage.setItem('__nav', JSON.stringify(l));
  } catch { /* nada */ }
  window.__geo = 0;
  if (navigator.geolocation) {
    const g = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (bien, mal, o) => {
      window.__geo += 1;
      if (estado === 'denied') { setTimeout(() => mal && mal({ code: 1, message: 'denied' }), 10); return undefined; }
      return g(bien, mal, o);
    };
  }
  if (estado && navigator.permissions) {
    const q = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d) => (d && d.name === 'geolocation' ? Promise.resolve({ state: estado, onchange: null, addEventListener() {} }) : q(d));
  }
};
async function contexto(nav, { permiso = 'granted', vp = { width: 1280, height: 800 } } = {}) {
  const ctx = await nav.newContext({ geolocation: { latitude: MADRID.lat, longitude: MADRID.lng, accuracy: 10 }, ...(permiso === 'granted' ? { permissions: ['geolocation'] } : {}), locale: 'es-ES', viewport: vp });
  await ctx.addInitScript(espia, { estado: permiso === 'denied' ? 'denied' : '' });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  return { ctx, p, errores };
}
const nav0 = (p) => p.evaluate(() => JSON.parse(sessionStorage.getItem('__nav') || '[]'));
const quieto = async (p) => { await p.waitForLoadState('networkidle').catch(() => {}); await espera(2000); return p.url(); };
/** Las llamadas a la base de «Tu cuenta» en este contexto (con sesión). */
const conSesion = async (ctx, rpc) => {
  const llam = [];
  const R = Object.fromEntries(Object.entries(rpc).map(([k, v]) => [k, (a) => { llam.push([k, a]); return typeof v === 'function' ? v(a) : v; }]));
  await conSesionCuenta(ctx, R);
  return llam;
};

const TOKEN = 'Abcdefghij012345';
const tipos = process.env.UBIC2_RAPIDO ? ['chromium'] : ['chromium', 'webkit'];
for (const tipo of tipos) {
  const nav = await pw[tipo].launch();
  try {
    // 1. Con el permiso ya dado: a su celda, una vez, con replace y sin guardar tu punto.
    for (const [ruta, clave] of [['/partidos', 'celda'], ['/en/matches', 'cell'], ['/grupos?tipo=company', 'celda'], ['/en/groups', 'cell'], ['/sorteos', 'celda'], ['/guia/navidad', 'celda']]) {
      const { ctx, p, errores } = await contexto(nav);
      await p.goto(`${BASE}/sobre`);
      const concedido = await p.evaluate(async () => { try { return (await navigator.permissions.query({ name: 'geolocation' })).state; } catch (e) { return String(e); } });
      if (concedido !== 'granted') { ok(false, `${tipo}: el navegador de prueba dice el permiso concedido`, concedido); await ctx.close(); continue; }
      await p.goto(`${BASE}${ruta}`);
      await p.waitForURL(new RegExp(`[?&]${clave}=${CELDA}`), { timeout: 10000 }).catch(() => {});
      const u = new URL(await quieto(p));
      const l = await nav0(p);
      const largos = l.map((x) => x.split('|')[1]);
      ok(u.searchParams.get(clave) === CELDA && !u.searchParams.has('lat'), `${tipo} ${ruta}: con el permiso, a su celda sin pulsar nada`, p.url());
      ok(l.length === 3 && largos[1] === largos[2], `${tipo} ${ruta}: una sola recarga y sin entrada nueva en el historial`, JSON.stringify(l));
      ok(!/tipo=company/.test(ruta) || u.searchParams.get('tipo') === 'company', `${tipo} ${ruta}: lo demás de la dirección se queda`, u.search);
      ok(!(await p.evaluate(() => localStorage.getItem('klendar.cerca'))), `${tipo} ${ruta}: tu punto no se guarda (solo la celda en la dirección)`);
      ok(!errores.length, `${tipo} ${ruta}: sin errores`, errores.join(' | '));
      await ctx.close();
    }
    // Lo elegido no se pisa.
    {
      const { ctx, p } = await contexto(nav);
      for (const ruta of ['/partidos?ciudad=madrid', '/grupos?ciudad=madrid', `/sorteos?celda=${KCe.de(36.72, -4.42)}`, '/guia/navidad?ciudad=sevilla']) {
        await p.goto(`${BASE}${ruta}`);
        ok(await quieto(p) === `${BASE}${ruta}`, `${tipo} ${ruta}: se queda como está`, p.url());
      }
      // Guardado en Explorar: una ciudad (aunque sea de hace días) o «Todas las ciudades».
      await p.evaluate(() => localStorage.setItem('klendar.filtros', JSON.stringify({ t: Date.now() - 30 * 3600e3, es: 'ciudad=malaga', en: 'city=malaga' })));
      await p.goto(`${BASE}/partidos`);
      await p.waitForURL(/ciudad=malaga/, { timeout: 8000 }).catch(() => {});
      ok(new URL(await quieto(p)).searchParams.get('ciudad') === 'malaga', `${tipo}: con una ciudad guardada en Explorar, esa ciudad (no tu celda)`, p.url());
      await p.evaluate(() => localStorage.setItem('klendar.filtros', JSON.stringify({ t: Date.now(), es: 'todas=1', en: 'todas=1' })));
      await p.goto(`${BASE}/grupos`);
      ok(await quieto(p) === `${BASE}/grupos`, `${tipo}: con «Todas las ciudades» guardado, se queda en todas`, p.url());
      // La celda guardada (menos de 6 h), con su distancia.
      await p.evaluate((c) => localStorage.setItem('klendar.filtros', JSON.stringify({ t: Date.now(), es: `celda=${c}&km=12`, en: `cell=${c}&km=12` })), KCe.de(36.72, -4.42));
      await p.goto(`${BASE}/en/matches`);
      await p.waitForURL(/cell=/, { timeout: 8000 }).catch(() => {});
      const g = new URL(await quieto(p));
      ok(g.searchParams.get('cell') === KCe.de(36.72, -4.42) && g.searchParams.get('km') === '12' && !g.searchParams.has('lat'), `${tipo}: la celda guardada en Explorar, como celda (no lat/lng)`, g.search);
      await ctx.close();
    }
    {
      // «Todas las ciudades» desde la propia página (marca de tarjetas.js) y recargar.
      const { ctx, p } = await contexto(nav);
      await p.goto(`${BASE}/partidos?celda=${CELDA}`);
      await quieto(p);
      // (Sin abrir el desplegable: el WebKit de Playwright en Windows se cae al
      // navegar desde un <details> abierto, también con el código de antes.)
      await p.evaluate(() => [...document.querySelectorAll('.menu-d a.op')].find((a) => /Todas las ciudades/.test(a.textContent)).click());
      await p.waitForURL(`${BASE}/partidos`, { timeout: 8000 }).catch(() => {});
      ok(await quieto(p) === `${BASE}/partidos`, `${tipo}: «Todas las ciudades» en Partidos se queda (no vuelve a tu celda)`, p.url());
      // (Recargar ahí tumba el WebKit de Playwright en Windows, también con el código de antes: solo Chromium.)
      if (tipo === 'chromium') {
        await p.reload();
        ok(await quieto(p) === `${BASE}/partidos`, `${tipo}: al recargar, tampoco`, p.url());
      }
      await ctx.close();
    }
    {
      // Tocar la página antes de tener la posición (aquí tarda 2,5 s).
      const { ctx, p } = await contexto(nav);
      await ctx.addInitScript(() => {
        const g = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
        navigator.geolocation.getCurrentPosition = (bien, mal, o) => g((x) => setTimeout(() => bien(x), 2500), mal, o);
      });
      await p.goto(`${BASE}/grupos`);
      await p.mouse.click(5, 300);
      await espera(4000);
      ok(!new URL(p.url()).searchParams.has('celda'), `${tipo}: si tocas antes de tener la posición, no se mueve nada`, p.url());
      await ctx.close();
    }
    // Sin el permiso (pendiente o denegado): ni se pide ni se mueve; «Cerca de mí», con la celda.
    for (const permiso of ['prompt', 'denied']) {
      const { ctx, p, errores } = await contexto(nav, { permiso });
      for (const ruta of ['/partidos', '/grupos', '/sorteos', '/guia/navidad']) {
        await p.goto(`${BASE}${ruta}`);
        const u = await quieto(p);
        ok(u === `${BASE}${ruta}` && (await p.evaluate(() => window.__geo)) === 0, `${tipo} ${permiso} ${ruta}: ni se pide ni se mueve`, `${u} geo=${await p.evaluate(() => window.__geo)}`);
      }
      if (permiso === 'prompt') {
        await ctx.grantPermissions(['geolocation']);
        await p.goto(`${BASE}/partidos?ciudad=madrid`);
        await quieto(p);
        await p.evaluate(() => document.querySelector('[data-cerca]').click());
        await p.waitForURL(/celda=/, { timeout: 10000 }).catch(() => {});
        const u = new URL(p.url());
        ok(u.searchParams.get('celda') === CELDA && !u.searchParams.has('lat') && !u.searchParams.has('ciudad'), `${tipo}: «Cerca de mí» en Partidos, a tu celda (antes, lat/lng)`, p.url());
      }
      ok(!errores.length, `${tipo} ${permiso}: sin errores`, errores.join(' | '));
      await ctx.close();
    }

    // 2. El sello por visita.
    const visitaRpc = () => ({
      visit_qr_info: { ok: true, business_id: BAR.id, visit_cards: [{ id: 'c1', name: 'Cafés', goal: 10 }] },
      scan_visit_qr: (a) => (a.p_lat == null ? { ok: true, stamp: 'no_location', cards: [] } : { ok: true, stamp: 'stamped', cards: [{ name: 'Cafés', stamps: 4, goal: 10, added: true }] }),
    });
    for (const permiso of ['granted', 'prompt', 'denied']) {
      const { ctx, p, errores } = await contexto(nav, { permiso });
      const llam = await conSesion(ctx, visitaRpc());
      await p.goto(`${BASE}/b/${BAR.slug}?visita=${TOKEN}`);
      await p.waitForSelector('.visita:not([hidden])', { timeout: 10000 }).catch(() => {});
      await espera(800);
      const txt = await p.locator('.visita').innerText().catch(() => '');
      const scan = llam.filter(([f]) => f === 'scan_visit_qr');
      if (permiso === 'granted') {
        ok(scan.length === 1 && typeof scan[0][1].p_lat === 'number' && /\+1 sello/.test(txt), `${tipo} sello, con permiso: se usa la ubicación sin preguntar`, `${JSON.stringify(scan)} ${txt}`);
      } else {
        ok((await p.evaluate(() => window.__geo)) === 0, `${tipo} sello, ${permiso}: al abrir, la ubicación ni se pide`, `geo=${await p.evaluate(() => window.__geo)}`);
        ok(scan.length === 1 && scan[0][1].p_lat == null, `${tipo} sello, ${permiso}: se pregunta a la base sin posición`, JSON.stringify(scan));
        if (permiso === 'prompt') {
          ok(/no tenemos tu ubicación/.test(txt) && /Usar mi ubicación/.test(txt), `${tipo} sello, pendiente: «Usar mi ubicación»`, txt);
          if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/sello-usar-ubicacion-${tipo}.png` });
          await ctx.grantPermissions(['geolocation']);
          await p.locator('.visita .v-go').click();
          await p.waitForFunction(() => /\+1 sello/.test(document.querySelector('.visita')?.innerText || ''), null, { timeout: 10000 }).catch(() => {});
          const s2 = llam.filter(([f]) => f === 'scan_visit_qr');
          ok(s2.length === 2 && typeof s2[1][1].p_lat === 'number' && /\+1 sello/.test(await p.locator('.visita').innerText()), `${tipo} sello, al pulsar «Usar mi ubicación»: se pide y cae el sello`, JSON.stringify(s2));
        } else {
          ok(/Permite la ubicación a klendar\.app en los ajustes del navegador/.test(txt), `${tipo} sello, denegado: cómo permitirlo en el navegador`, txt);
          if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/sello-denegado-${tipo}.png` });
        }
      }
      ok(!errores.length, `${tipo} sello ${permiso}: sin errores`, errores.join(' | '));
      await ctx.close();
    }

    // 3. «Estaba cerrado».
    for (const permiso of ['granted', 'prompt']) {
      const { ctx, p, errores } = await contexto(nav, { permiso });
      const llam = await conSesion(ctx, {
        business_hours_status: { ok: true, open_now: true, unconfirmed: false, reported_today: false, can_report: true },
        report_closed: { ok: true, unconfirmed: false },
      });
      const r = await p.goto(`${BASE}/b/${BAR.slug}`);
      ok(/^geolocation=\(self\)/.test(r.headers()['permissions-policy'] || ''), `${tipo} cerrado: la ficha puede usar la ubicación`, r.headers()['permissions-policy']);
      await p.waitForSelector('[data-cerrado-boton]', { timeout: 10000 }).catch(() => {});
      if (!(await p.locator('[data-cerrado-boton]').count())) { ok(false, `${tipo} cerrado: sale «Estaba cerrado»`); await ctx.close(); continue; }
      await p.click('[data-cerrado-boton]');
      await p.click('.horario-check [data-si]');
      await p.waitForFunction(() => /Se lo hemos dicho/.test(document.querySelector('.horario-check')?.innerText || ''), null, { timeout: 10000 }).catch(() => {});
      const rc = llam.find(([f]) => f === 'report_closed');
      if (permiso === 'granted') {
        ok(rc && Math.abs(rc[1].p_lat - MADRID.lat) < 1e-6 && Math.abs(rc[1].p_lng - MADRID.lng) < 1e-6, `${tipo} cerrado, con permiso: manda dónde estás (para comprobar que estás cerca)`, JSON.stringify(rc));
      } else {
        ok(rc && rc[1].p_lat == null && (await p.evaluate(() => window.__geo)) === 0, `${tipo} cerrado, sin permiso: sin la posición y sin pedirla`, JSON.stringify(rc));
      }
      ok(!errores.length, `${tipo} cerrado ${permiso}: sin errores`, errores.join(' | '));
      await ctx.close();
    }

    // 5. «Avísame si…»: sin tu ubicación, tu ciudad.
    const MALAGA = { code: '29067', slug: 'malaga', name: 'Málaga', lat: 36.7213, lng: -4.4214, radius_m: 18000 };
    for (const permiso of ['granted', 'prompt', 'denied']) {
      const { ctx, p, errores } = await contexto(nav, { permiso });
      const llam = await conSesion(ctx, {
        my_offer_alerts: [], save_offer_alert: { ok: true, id: 'x' },
        my_tastes: { category_slugs: [], home_city: 'malaga', home_municipality: MALAGA, asked_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' },
      });
      await p.goto(`${BASE}/cuenta/alerta/nueva`, { waitUntil: 'networkidle' });
      await p.waitForSelector('#f input[name=fija]');
      await p.check('#f input[name=fija]');
      await p.click('#guardar');
      await espera(1200);
      let g = llam.find(([f]) => f === 'save_offer_alert');
      if (permiso === 'granted') {
        ok(g && Math.abs(g[1].p_lat - MADRID.lat) < 1e-6 && g[1].p_place_label === 'Aquí', `${tipo} «Avísame si…», con permiso: «Aquí»`, JSON.stringify(g));
      } else {
        const oferta = await p.locator('#ciudad-oferta').innerText().catch(() => '');
        ok(!g && /vigilamos Málaga, tu ciudad/.test(oferta), `${tipo} «Avísame si…», ${permiso}: se ofrece tu ciudad`, oferta);
        if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/avisame-ciudad-${permiso}-${tipo}.png` });
        ok(permiso !== 'denied' || (await p.evaluate(() => window.__geo)) === 0, `${tipo} «Avísame si…», denegado: ni se intenta`);
        await p.click('#usa-ciudad');
        await espera(1200);
        g = llam.find(([f]) => f === 'save_offer_alert');
        ok(g && g[1].p_lat === MALAGA.lat && g[1].p_lng === MALAGA.lng && g[1].p_place_label === 'Málaga' && g[1].p_radius_m === MALAGA.radius_m,
          `${tipo} «Avísame si…», ${permiso}: guarda tu ciudad con su centro y su radio`, JSON.stringify(g && g[1]));
      }
      ok(!errores.length, `${tipo} «Avísame si…» ${permiso}: sin errores`, errores.join(' | '));
      await ctx.close();
    }
    {
      // Sin ciudad y sin ubicación: el error de siempre, sin guardar.
      const { ctx, p } = await contexto(nav, { permiso: 'denied' });
      const llam = await conSesion(ctx, { my_offer_alerts: [], save_offer_alert: { ok: true, id: 'x' }, my_tastes: { category_slugs: [], home_municipality: null } });
      await p.goto(`${BASE}/cuenta/alerta/nueva`, { waitUntil: 'networkidle' });
      await p.waitForSelector('#f input[name=fija]');
      await p.check('#f input[name=fija]');
      await p.click('#guardar');
      await espera(1200);
      ok(!llam.some(([f]) => f === 'save_offer_alert') && (await p.locator('#ciudad-oferta').isHidden()), `${tipo} «Avísame si…», sin ciudad ni ubicación: no se guarda`);
      await ctx.close();
    }
  } finally {
    await nav.close();
  }
}
void SUPA;

await web.cierra();
console.log(fallos ? `\n${fallos} fallo(s).` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
