// «Cerca de mí» como celda de 5 km (Iván, 23-11-2026; RUNBOOK §4zzz-explorar):
// tu punto exacto no sale del navegador y Explorar va en la caché del borde.
//
//  1. Sin navegador (las Functions de verdad contra el Supabase falso):
//     - la base recibe el CENTRO de la celda, nunca el punto, y el radio más
//       la media diagonal de la celda;
//     - los enlaces de la página no llevan `lat=`/`lng=` a Explorar ni a
//       Descubre; uno de antes con el punto va a su celda con un 301;
//     - «Ver N resultados» (`?contar=1`) trae dónde está cada una;
//     - con la zona de la conexión, la página sale con `x-klendar-borde`.
//  2. En el navegador (con Playwright: PW=<ruta>, o el de la caché de npx):
//     - «Usar mi ubicación» con una posición de 5 decimales: NINGUNA petición
//       (la página, la base, nada) lleva ese punto, ni redondeado a 3;
//     - con 1 km: solo lo que queda a 1 km de tu punto, con su distancia y
//       por cercanía; la lista de Sitios igual; el calendario cuenta igual;
//       sin nada a 1 km, la pantalla vacía; «Ver N resultados», lo de tu punto;
//     - el mapa (si hay token de Mapbox): de Planes a Sitios, mismo sitio y zoom.
//
//   node tools/celda_check.mjs
import { webConDatos } from './_web_con_datos.mjs';

const KCe = (await import('../assets/celda.js')).default;
let fallos = 0;
const ok = (c, m, extra = '') => { if (c) console.log(`ok: ${m}`); else { fallos += 1; console.log(`FALLO: ${m} ${extra}`); } };

// Tu punto (5 decimales) y su celda. Ningún negocio de los datos de prueba
// tiene «40.411» en su latitud: si aparece en una petición, es tu punto.
const AQUI = { lat: 40.41123, lng: -3.70687 };
const CELDA = KCe.de(AQUI.lat, AQUI.lng);
const CENTRO = KCe.centro(CELDA);
const MARGEN = KCe.margenM(CELDA);
// En la misma celda y a más de 2 km de cualquier negocio de prueba.
const VACIO = { lat: 40.38774, lng: -3.73335 };
const LLEVA_PUNTO = (t) => /40\.411|-3\.7068/.test(String(t || ''));

const web = await webConDatos({ puerto: Number(process.env.PORT || 8941) });
const ultima = (fn) => [...web.llamadas].reverse().find((l) => l.fn === fn)?.args;
try {
  ok(CELDA === KCe.de(VACIO.lat, VACIO.lng) && !LLEVA_PUNTO(JSON.stringify(CENTRO)), `la celda de prueba (${CELDA}) y su centro no se parecen al punto`);

  // 1a. Lo que recibe la base.
  web.llamadas.length = 0;
  const h = await (await fetch(`${web.BASE}/explorar?celda=${CELDA}&vista=lista&km=1&orden=cerca`)).text();
  const pe = ultima('public_explore');
  ok(pe?.p_lat === CENTRO.lat && pe?.p_lng === CENTRO.lng, 'la base recibe el centro de la celda', JSON.stringify([pe?.p_lat, pe?.p_lng]));
  ok(pe?.p_filters?.radius_m === 1000 + MARGEN, 'y el radio más la media diagonal (1 km + ~3 km)', JSON.stringify(pe?.p_filters));
  ok(!web.llamadas.some((l) => LLEVA_PUNTO(JSON.stringify(l.args))), 'ninguna llamada a la base lleva el punto');
  const enlaces = [...h.matchAll(/href="([^"]*\/(?:explorar|descubre)\?[^"]*)"/g)].map((m) => m[1]);
  ok(enlaces.length > 10 && !enlaces.some((u) => /[?&;](lat|lng)=/.test(u)) && enlaces.some((u) => u.includes(`celda=${CELDA}`)),
    'los enlaces a Explorar y Descubre llevan la celda, nunca lat/lng', enlaces.find((u) => /[?&;](lat|lng)=/.test(u)) || String(enlaces.length));
  const cfg = JSON.parse((/<script type="application\/json" id="klCelda">([^<]*)<\/script>/.exec(h) || [])[1] || 'null');
  ok(cfg?.c === CELDA && cfg?.km === 1 && cfg?.vista === 'list' && cfg?.orden === 'nearest', 'la página dice al navegador su celda, la distancia y el orden', JSON.stringify(cfg));
  ok(/<div data-celda-vacio hidden>/.test(h), 'y trae la pantalla vacía, oculta');
  ok(/public, max-age=60, s-maxage=180/.test((await fetch(`${web.BASE}/explorar?celda=${CELDA}`, { method: 'HEAD' })).headers.get('cache-control') || ''), 'pública: 3 min en el borde');

  // 1b. Un enlace de antes con el punto.
  const r = await fetch(`${web.BASE}/explorar?lat=${AQUI.lat}&lng=${AQUI.lng}&km=3&vista=lista`, { redirect: 'manual' });
  ok(r.status === 301 && r.headers.get('location') === `/explorar?km=3&vista=lista&celda=${CELDA}`, 'un enlace de antes con el punto: 301 a su celda', `${r.status} ${r.headers.get('location')}`);
  const ren = await fetch(`${web.BASE}/en/explore?lat=${AQUI.lat}&lng=${AQUI.lng}`, { redirect: 'manual' });
  ok(ren.status === 301 && ren.headers.get('location') === `/en/explore?cell=${CELDA}`, 'en inglés, `cell`', ren.headers.get('location'));

  // 1c. «Ver N resultados».
  const n = await (await fetch(`${web.BASE}/explorar?celda=${CELDA}&vista=lista&km=1&contar=1`)).json();
  ok(typeof n.total === 'number' && Array.isArray(n.pts) && n.pts.length === n.total, '«Ver N resultados» trae dónde está cada una', JSON.stringify(n).slice(0, 120));
} finally {
  await web.cierra();
}

// 1d. La zona de la conexión: en su celda y con `x-klendar-borde`.
{
  const ap = await webConDatos({ puerto: Number(process.env.PORT || 8941) + 2, entorno: { CF_PRUEBA: JSON.stringify({ country: 'ES', latitude: '40.42', longitude: '-3.70' }) } });
  try {
    ap.llamadas.length = 0;
    const r = await fetch(`${ap.BASE}/explorar?vista=lista`);
    const c = KCe.centro(KCe.de(40.4, -3.7));
    const pe = [...ap.llamadas].reverse().find((l) => l.fn === 'public_explore')?.args;
    ok(/private/.test(r.headers.get('cache-control') || '') && r.headers.get('x-klendar-borde') === 's-maxage=180', 'zona de la conexión: privada y con `x-klendar-borde`', `${r.headers.get('cache-control')} ${r.headers.get('x-klendar-borde')}`);
    ok(pe?.p_lat === c.lat && pe?.p_lng === c.lng && pe?.p_filters?.radius_m === 5000, 'zona de la conexión: el centro de su celda y el radio de siempre', JSON.stringify([pe?.p_lat, pe?.p_lng, pe?.p_filters?.radius_m]));
  } finally {
    await ap.cierra();
  }
}

// 2. En el navegador.
let PW = process.env.PW;
if (!PW) {
  try {
    const { readdirSync } = await import('node:fs');
    const base = `${process.env.LOCALAPPDATA || ''}\\npm-cache\\_npx`;
    for (const d of readdirSync(base)) { try { readdirSync(`${base}\\${d}\\node_modules\\playwright`); PW = `${base}\\${d}\\node_modules\\playwright`; break; } catch { /* otra */ } }
  } catch { /* sin caché de npx */ }
}
if (!PW) {
  console.log('(sin Playwright: me salto la parte del navegador)');
} else {
  process.env.PW = PW;
  const { playwright } = await import('./_supabase_simulado.mjs');
  const web2 = await webConDatos({ puerto: Number(process.env.PORT || 8941) + 4 });
  const nav = await playwright().chromium.launch();
  try {
    const ctx = await nav.newContext({ geolocation: { latitude: AQUI.lat, longitude: AQUI.lng, accuracy: 10 }, permissions: ['geolocation'], locale: 'es-ES' });
    const peticiones = [];
    ctx.on('request', (q) => peticiones.push(`${q.url()} ${q.postData() || ''}`));
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(String(e)));

    // «Usar mi ubicación».
    await p.goto(`${web2.BASE}/explorar?vista=lista`, { waitUntil: 'networkidle' });
    await p.locator('[data-cerca-aviso] [data-cerca]').first().click();
    await p.waitForURL(/celda=/, { timeout: 8000 });
    await p.waitForLoadState('networkidle');
    const u = new URL(p.url());
    ok(u.searchParams.get('celda') === CELDA && !u.searchParams.has('lat') && !u.searchParams.has('lng'), '«Usar mi ubicación» va a tu celda, sin el punto', p.url());
    const guardado = await p.evaluate(() => JSON.parse(localStorage.getItem('klendar.cerca') || 'null'));
    ok(Math.abs(guardado?.lat - AQUI.lat) < 1e-9, 'tu punto se queda en este navegador (`klendar.cerca`)');

    // Con 1 km y «Más cerca».
    await p.goto(`${web2.BASE}/explorar?celda=${CELDA}&vista=lista&km=1&orden=cerca`, { waitUntil: 'networkidle' });
    const lista = await p.evaluate(() => [...document.querySelectorAll('.tjs:not(.fin .tjs) > .tj')].map((el) => ({
      m: Number(el.getAttribute('data-m')), d: (el.querySelector('.tj-dist')?.textContent || '').trim(), n: el.querySelector('.tj-negocio')?.textContent || '',
    })));
    ok(lista.length > 2 && lista.every((x) => x.m <= 1000), 'con 1 km: solo lo que queda a 1 km de tu punto', JSON.stringify(lista.map((x) => x.m)));
    ok(lista.every((x, i) => i === 0 || lista[i - 1].m <= x.m), '…por cercanía a tu punto', JSON.stringify(lista.map((x) => x.m)));
    ok(lista.every((x) => /^\d[\d,]* ?(m|km)$/.test(x.d.replace(/^·\s*/, ''))), '…cada una con su distancia', JSON.stringify(lista.map((x) => x.d)));
    ok(!lista.some((x) => /Restaurante Ensayo|Panadería|Centro Cultural/.test(x.n)), '…y nada de lo que queda a más de 1 km');
    const cuenta = await p.evaluate(async (c) => {
      const d = await (await fetch(`/explorar?celda=${c}&vista=lista&km=1&contar=1`)).json();
      return window.KlendarCeldaExacta ? window.KlendarCeldaExacta.cuenta(d.pts, 1) : null;
    }, CELDA);
    ok(cuenta === lista.length, '«Ver N resultados»: lo que queda a 1 km de tu punto', `${cuenta} ≠ ${lista.length}`);

    // Sitios.
    await p.goto(`${web2.BASE}/explorar?celda=${CELDA}&que=sitios&km=1`, { waitUntil: 'networkidle' });
    const sitios = await p.evaluate(() => [...document.querySelectorAll('.sitios-lista > .sitio-fila')].map((el) => ({
      m: Number(el.getAttribute('data-m')), d: (el.querySelector('.tj-dist')?.textContent || '').trim(),
    })));
    ok(sitios.length > 1 && sitios.every((x, i) => x.m <= 1000 && (i === 0 || sitios[i - 1].m <= x.m) && /\d ?(m|km)$/.test(x.d)), 'Sitios con 1 km: los de tu punto, por cercanía y con su distancia', JSON.stringify(sitios));

    // El calendario: el número del día es lo que se ve.
    await p.goto(`${web2.BASE}/explorar?celda=${CELDA}&km=1`, { waitUntil: 'networkidle' });
    const cal = await p.evaluate(() => {
      const cab = document.querySelector('.cal-lista-cab .cal-n');
      const sel = document.querySelector('a.cal-dia.sel');
      const cfg = JSON.parse(document.getElementById('klCelda')?.textContent || 'null');
      return { n: document.querySelectorAll('#dia .tj-filas > .tj').length, cab: cab && !cab.hidden ? cab.textContent : '', label: sel?.getAttribute('aria-label') || '',
        dia: sel?.getAttribute('data-dia'), pts: cfg?.pts || [],
        lejos: [...document.querySelectorAll('#dia .tj-filas > .tj')].some((el) => Number(el.getAttribute('data-m')) > 1000) };
    });
    const nTxt = (t) => Number((/(\d+)/.exec(t) || [])[1] || 0);
    // (El Supabase falso no filtra por día: la lista del día trae de todos; se cuenta aparte.)
    const delDia = cal.pts.filter((x) => x[2] === cal.dia && KCe.metros(AQUI.lat, AQUI.lng, x[0], x[1]) <= 1000).length;
    const enCelda = cal.pts.filter((x) => x[2] === cal.dia).length;
    ok(!cal.lejos && delDia > 0 && delDia < enCelda && nTxt(cal.cab) === delDia && Number((/: (\d+)/.exec(cal.label) || [])[1]) === delDia,
      'el calendario cuenta lo de tu punto (la cabecera y el día), no lo de la celda', JSON.stringify({ ...cal, pts: cal.pts.length, delDia, enCelda }));

    // Sin nada a 1 km de tu punto (aunque sí desde el centro de la celda).
    await p.evaluate((v) => localStorage.setItem('klendar.cerca', JSON.stringify({ lat: v.lat, lng: v.lng, t: Date.now() })), VACIO);
    await p.goto(`${web2.BASE}/explorar?celda=${CELDA}&vista=lista&km=1`, { waitUntil: 'networkidle' });
    const vacio = await p.evaluate(() => ({ tarjetas: document.querySelectorAll('.tjs:not(.fin .tjs) > .tj').length, visible: !document.querySelector('[data-celda-vacio]')?.hidden,
      titulo: document.querySelector('[data-celda-vacio] h2')?.textContent || '' }));
    ok(vacio.tarjetas === 0 && vacio.visible && /Aún no hay nada/.test(vacio.titulo), 'sin nada a 1 km de tu punto: la pantalla vacía de siempre', JSON.stringify(vacio));

    // Un enlace de otra celda (te lo pasan): la página tal cual, sin quitar nada.
    const otra = KCe.de(36.72, -4.42);
    await p.goto(`${web2.BASE}/explorar?celda=${otra}&vista=lista`, { waitUntil: 'networkidle' });
    ok(await p.evaluate(() => !window.KlendarCeldaExacta && document.querySelectorAll('.tjs > .tj').length > 0), 'una celda que no es la tuya: tal cual (nada se quita)');

    ok(!peticiones.some(LLEVA_PUNTO), 'ninguna petición del navegador lleva tu punto (ni redondeado a 3 decimales)', peticiones.find(LLEVA_PUNTO) || '');
    ok(!errores.length, 'sin errores de JavaScript', errores.join(' | '));

    // El mapa: de Planes a Sitios, en el mismo sitio y con el mismo zoom.
    const tk = await (await fetch(`${web2.BASE}/api/mapbox-token`)).json().catch(() => ({}));
    if (!tk?.token) console.log('(sin token de Mapbox: me salto el mapa)');
    else {
      const pm = await ctx.newPage();
      await pm.goto(`${web2.BASE}/explorar?celda=${CELDA}&vista=mapa`, { waitUntil: 'domcontentloaded' });
      await pm.waitForFunction(() => window.KlendarMapa && window.KlendarMapa.loaded && window.KlendarMapa.loaded(), null, { timeout: 30000 });
      await pm.evaluate(() => new Promise((ok2) => { window.KlendarMapa.once('moveend', ok2); window.KlendarMapa.jumpTo({ center: [-3.6991, 40.4203], zoom: 14.25 }); }));
      await pm.locator('.que a', { hasText: 'Sitios' }).click();
      await pm.waitForURL(/que=sitios/);
      await pm.waitForFunction(() => window.KlendarMapaSitios, null, { timeout: 30000 });
      const cam = await pm.evaluate(() => { const m = window.KlendarMapaSitios; const c = m.getCenter(); return { lng: c.lng, lat: c.lat, z: m.getZoom() }; });
      ok(Math.abs(cam.lng + 3.6991) < 1e-4 && Math.abs(cam.lat - 40.4203) < 1e-4 && Math.abs(cam.z - 14.25) < 1e-3, 'mapa: de Planes a Sitios, mismo centro y zoom', JSON.stringify(cam));
      await pm.evaluate(() => new Promise((ok2) => { window.KlendarMapaSitios.once('moveend', ok2); window.KlendarMapaSitios.jumpTo({ center: [-3.7101, 40.4111], zoom: 13.5 }); }));
      await pm.locator('.que a', { hasText: 'Planes' }).click();
      await pm.waitForURL((x) => !/que=sitios/.test(String(x)));
      await pm.waitForFunction(() => window.KlendarMapa && window.KlendarMapa.loaded && window.KlendarMapa.loaded(), null, { timeout: 30000 });
      const cam2 = await pm.evaluate(() => { const m = window.KlendarMapa; const c = m.getCenter(); return { lng: c.lng, lat: c.lat, z: m.getZoom() }; });
      ok(Math.abs(cam2.lng + 3.7101) < 1e-4 && Math.abs(cam2.lat - 40.4111) < 1e-4 && Math.abs(cam2.z - 13.5) < 1e-3, 'mapa: y de Sitios a Planes, igual', JSON.stringify(cam2));
      await pm.goto(`${web2.BASE}/explorar?ciudad=malaga&vista=mapa`, { waitUntil: 'domcontentloaded' });
      await pm.waitForFunction(() => window.KlendarMapa && window.KlendarMapa.loaded && window.KlendarMapa.loaded(), null, { timeout: 30000 });
      const cam3 = await pm.evaluate(() => window.KlendarMapa.getCenter());
      ok(cam3.lat < 38, 'mapa: con otra zona («Málaga»), el mapa va a la suya', JSON.stringify(cam3));
    }
  } finally {
    await nav.close();
    await web2.cierra();
  }
}

console.log(fallos ? `\n${fallos} fallo(s).` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
