// Saltos entre pestañas, el logo y «Más formas de explorar» (Iván,
// 2026-11-04), en la web local, Chromium y WebKit, a 390 y 1280 px, con una
// sesión de mentira (Supabase falso para «Tu cuenta»):
//  1. Al ir de Descubre a Explorar, Planes, Cuenta y otra vez Descubre por la
//     barra de pestañas: la cabecera (logo y pestañas) está en el mismo sitio
//     en todas, del primer cuadro al último; el desplazamiento de maquetación
//     (CLS, solo Chromium: WebKit no lo mide) por debajo de 0,01; y el cambio
//     de pestaña no se funde (sin View Transition, `pagereveal`).
//  2. En Descubre, el logo no navega: sube arriba o trae la lista otra vez, y
//     «Atrás» lleva a la página de antes (sin entradas de más).
//  3. «Más formas de explorar»: sin zona, el orden de siempre (el de
//     `public_cities`); con «¿Dónde?» (municipio o posición), la más cercana
//     primero y como mucho 6; con la zona de la conexión (BASE_IP, un
//     servidor con CF_PRUEBA) también por cercanía, y con «Tu ciudad»
//     guardada en el navegador, la de tu ciudad primero.
// Capturas en OUT.
//
//   PORT=8877 node tools/serve_dev.mjs &
//   CF_PRUEBA='{"country":"ES","latitude":"41.65","longitude":"-0.88"}' PORT=8878 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> BASE=http://localhost:8877 BASE_IP=http://localhost:8878 node tools/saltos_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8877';
const BASE_IP = process.env.BASE_IP || '';
const OUT = process.env.OUT || 'tools/out';
mkdirSync(OUT, { recursive: true });
// El proyecto al que apunta la web (config.js): la sesión de otro no cuenta.
const REF = readFileSync(new URL('../config.js', import.meta.url), 'utf8').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];
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
    if (h && h.offsetParent !== null) {
      const f = JSON.stringify({ brand: r(h.querySelector('.brand')), tabs: r(h.querySelector('.pestanas')), hdr: r(h) });
      if (d.frames[d.frames.length - 1] !== f) d.frames.push(f);
    }
    if (performance.now() - t0 < 4000) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

const supabaseFalso = (route) => {
  const p = new URL(route.request().url()).pathname;
  const j = (x) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
  if (p.startsWith('/auth/v1/user')) return j(USER);
  if (p.startsWith('/rest/v1/rpc/my_consents')) return j({ terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true });
  if (p.startsWith('/rest/v1/')) return j([]);
  return j({});
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
    await page.goto(`${BASE}/descubre/`, { waitUntil: 'load' });
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

    // 2. El logo en Descubre y «Atrás».
    await page.goto(`${BASE}/explorar/`, { waitUntil: 'load' });
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
    await page.locator('header.top a.brand').first().click();
    await page.waitForTimeout(1200);
    const arriba = await page.evaluate(() => (document.querySelector('body.pagina-feed') || document.scrollingElement).scrollTop);
    ok(arriba <= 2, `${tag} logo en Descubre: sube arriba (${arriba})`);
    await page.locator('header.top a.brand').first().click();
    await page.waitForTimeout(3000);
    page.off('framenavigated', cuenta);
    ok(navegaciones === 0 && page.url() === enDescubre, `${tag} logo en Descubre: no navega (${navegaciones} navegaciones, ${page.url()})`);
    ok(await page.evaluate(() => history.length) === largo, `${tag} logo en Descubre: sin entradas de más en el historial`);
    await page.goBack();
    await page.waitForLoadState('load');
    ok(/\/explorar\//.test(page.url()), `${tag} «Atrás» tras el logo: a Explorar (${page.url()})`);
    await page.goForward();
    await page.waitForLoadState('load');
    ok(/\/descubre\//.test(page.url()), `${tag} «Adelante»: otra vez Descubre`);
    // Fuera de Descubre, el logo lleva a la portada, y «Atrás» vuelve.
    await page.goto(`${BASE}/explorar/`, { waitUntil: 'load' });
    await page.locator('header.top a.brand').first().click();
    await page.waitForLoadState('load');
    ok(new URL(page.url()).pathname === '/', `${tag} logo en Explorar: a la portada`);
    await page.goBack();
    await page.waitForLoadState('load');
    ok(/\/explorar\//.test(page.url()), `${tag} «Atrás» desde la portada: a Explorar`);

    // 3. «Más formas de explorar».
    if (w === 1280) {
      await page.goto(`${BASE}/explorar/?ciudad=zaragoza`, { waitUntil: 'load' });
      const z = await enlacesMf(page);
      ok(z[0] === 'zaragoza' && z.length <= 6, `${tag} «Más formas» con Zaragoza: Zaragoza primero (${z.join(', ')})`);
      await page.goto(`${BASE}/explorar/?ciudad=getafe`, { waitUntil: 'load' });
      const g = await enlacesMf(page);
      ok(g[0] === 'madrid', `${tag} «Más formas» con Getafe (sin nada publicado): la más cercana primero (${g.join(', ')})`);
      await page.goto(`${BASE}/explorar/?lat=41.39&lng=2.17`, { waitUntil: 'load' });
      const b = await enlacesMf(page);
      ok(b[0] === 'zaragoza', `${tag} «Más formas» cerca de Barcelona: Zaragoza primero (${b.join(', ')})`);
      await page.screenshot({ path: `${OUT}/saltos_${nombre}_mas_formas.png`, fullPage: false });
      // Sin zona (como Google): el orden de `public_cities`, todas.
      const html = await fetch(`${BASE}/explorar/?todas=1`).then((r) => r.text());
      const sinZona = [...html.matchAll(/<h3>Qué hacer hoy en<\/h3><p>(.*?)<\/p>/g)][0]?.[1] || '';
      // El orden de siempre, el de la base (si contesta; con MF_ORDEN, el
      // que se le diga).
      const deSiempre = process.env.MF_ORDEN ? process.env.MF_ORDEN.split(',') : await (async () => {
        const cfg = (await import('node:fs')).readFileSync(new URL('../config.js', import.meta.url), 'utf8');
        const url = cfg.match(/https:\/\/[a-z]+\.supabase\.co/)[0];
        const key = cfg.match(/eyJ[\w.-]+|sb_publishable_[\w-]+/)[0];
        const r = await fetch(`${url}/rest/v1/rpc/public_cities`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(20000) });
        return (await r.json()).filter((c) => c.city).slice(0, 20).map((c) => c.slug);
      })().catch(() => null);
      const enHtml = [...sinZona.matchAll(/href="[^"]*\/([^/"]+)\/"/g)].map((x) => x[1]);
      ok(!/ hidden/.test(sinZona) && (!deSiempre || JSON.stringify(enHtml) === JSON.stringify(deSiempre)), `${tag} «Más formas» sin zona: el orden de siempre (${enHtml.join(', ')})`);
      // Zona de la conexión en Zaragoza, pero «Tu ciudad» Madrid: Madrid primero.
      if (BASE_IP) {
        const ctx2 = await nav.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-ES' });
        await ctx2.route(`https://${REF}.supabase.co/**`, supabaseFalso);
        const p2 = await ctx2.newPage();
        await p2.goto(`${BASE_IP}/explorar/`, { waitUntil: 'load' });
        const ip = await enlacesMf(p2);
        ok(ip[0] === 'zaragoza', `${tag} «Más formas» con la zona de la conexión (Zaragoza): Zaragoza primero (${ip.join(', ')})`);
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
console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO BIEN');
process.exit(fallos ? 1 : 0);
