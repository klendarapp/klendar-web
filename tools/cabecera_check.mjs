// La cabecera fija se ve entera y por encima del contenido al hacer scroll
// (fallo que vio Iván el 2026-10-21: en Descubre, en el escritorio, al pasar
// de publicación desaparecía la cabecera de Klendar y la tarjeta asomaba por
// encima de la fila de filtros, con solo el botón de ampliar). La causa: el
// aviso `.sr` de «Ver solo la foto» colgaba del <body> sin posicionar, el
// documento pasaba a tener scroll y el `scrollIntoView` de las flechas lo
// movía. Contra dev y solo leyendo (el panel y «Tu cuenta», con un Supabase
// de mentira):
//
//  1. Descubre: rueda, ↓ del teclado y scroll programático (del <body> y de
//     la ventana). El documento no se mueve (`scrollY` y `scrollTop` a 0),
//     la cabecera entera arriba y la fila de filtros justo debajo, sin
//     hueco; en el escritorio, lo que hay justo debajo de la cabecera es la
//     fila de filtros, no la tarjeta.
//  2. Explorar (Planes y Sitios; lista, mapa y calendario), la agenda de una
//     ciudad, la ficha /b/, «Tu cuenta» y el panel (en el móvil; en el
//     escritorio el panel va con la barra lateral): tras la rueda y el
//     scroll programático, la cabecera entera en la ventana (top 0) y
//     `elementFromPoint` en varios puntos de la cabecera cae dentro de ella
//     (está por encima de fotos, chips y tarjetas) y es casi opaca (≥ 95 %:
//     con `--glass`, 7 % en oscuro, lo de debajo se leía a través de ella).
//  3. Sin errores en la consola.
// Chromium y WebKit, móvil (375) y escritorio (1280). Capturas en OUT.
//
//   PORT=8893 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8893 node tools/cabecera_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8893';
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const AQUI = 'lat=40.417&lng=-3.704';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

// Sesión y Supabase de mentira para el panel y «Tu cuenta».
const U = '0e7717e0-0000-4000-8000-0000000cab01';
const BIZ = 'b1000000-0000-4000-8000-0000000cab01';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'cabecera.prueba@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const RPC = {
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: 'Sala Cabecera', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
  business_is_organizer: false,
  my_subscription: { plan_slug: 'standard', status: 'active', price_cents: 1990, active_offers: 0, has_analytics: true,
    billing: { enabled: true, blocked: false, hold: null, block_soon: false } },
  business_stats: { redemptions_30d: 3 },
  my_business_offers: [],
  business_tools_overview: { ok: true, can_edit: true, team: { members: 1 } },
};
const falso = async (route) => {
  const p = new URL(route.request().url()).pathname;
  const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (p.startsWith('/auth/v1/user')) return json(USER);
  if (p.startsWith('/auth/v1/')) return json({});
  if (p.startsWith('/rest/v1/rpc/')) { const f = p.slice(13); return json(f in RPC ? RPC[f] : null); }
  if (p.startsWith('/rest/v1/')) return json([]);
  return json({});
};

/** La opacidad del fondo de un elemento («rgba(…, .92)», «color(srgb … / .92)»). */
const opacidad = (page, sel) => page.evaluate((s) => {
  const c = getComputedStyle(document.querySelector(s)).backgroundColor;
  const m = /\/\s*([\d.]+)\s*\)$/.exec(c) || /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(c);
  return m ? Number(m[1]) : (/^rgb\(/.test(c) ? 1 : 0);
}, sel);

/** La cabecera: arriba, entera y por encima de lo que pasa por debajo (y
 * casi opaca: lo de debajo no se lee a través de ella). */
async function cabeceraBien(page, sel, t, { opaca = true } = {}) {
  if (opaca) {
    const a = await opacidad(page, sel);
    ok(a >= 0.95, `${t} la cabecera, casi opaca (${a})`);
  }
  const r = await page.evaluate((s) => {
    const h = document.querySelector(s);
    if (!h) return null;
    const b = h.getBoundingClientRect();
    const y = b.top + b.height / 2;
    const encima = [0.04, 0.3, 0.5, 0.7, 0.96].map((f) => {
      const el = document.elementFromPoint(Math.round(b.left + b.width * f), Math.round(y));
      return !!el && h.contains(el);
    });
    return { top: b.top, bottom: b.bottom, alto: b.height, vh: innerHeight, encima };
  }, sel);
  ok(r && Math.abs(r.top) < 1 && r.alto > 40 && r.bottom <= r.vh, `${t} la cabecera, arriba y entera (${r && `${Math.round(r.top)}–${Math.round(r.bottom)}`})`);
  ok(r && r.encima.every(Boolean), `${t} la cabecera, por encima del contenido (${r && r.encima.join(',')})`);
}

async function rueda(page, vp, veces = 4) {
  await page.mouse.move(vp.width / 2, vp.height / 2);
  for (let i = 0; i < veces; i++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(350); }
  await page.waitForTimeout(700);
}

const PAGINAS = [
  ['explorar-planes', `/explorar/?${AQUI}`],
  ['explorar-sitios', `/explorar/?que=sitios&${AQUI}`],
  ['explorar-mapa', `/explorar/?vista=map&${AQUI}`],
  ['explorar-calendario', `/explorar/?vista=calendar&${AQUI}`],
  ['sitios-mapa', `/explorar/?que=sitios&vista=map&${AQUI}`],
  ['agenda', '/agenda/madrid/'],
  ['ficha', '/b/nails-co-madrid'],
  ['explore-en', `/en/explore/?${AQUI}`],
];

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [forma, vp] of [['movil', { width: 375, height: 812 }], ['escritorio', { width: 1280, height: 900 }]]) {
    const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
    // Sin «Explorar recuerda lo último» de una pasada a otra.
    const page = await ctx.newPage();
    const errores = [];
    const ajeno = (x) => /mapbox|webgl|tile|Failed to load resource|^Error$|Load failed/i.test(x);
    page.on('console', (m) => { if (m.type() === 'error' && !ajeno(m.text())) errores.push(m.text()); });
    page.on('pageerror', (e) => { if (!ajeno(`${e.message} ${e.stack || ''}`)) errores.push(String(e)); });
    const t = `[${nombre} ${forma}]`;

    // 1. Descubre.
    await page.goto(`${BASE}/descubre/`);
    await page.waitForSelector('.feed > .tj');
    await page.waitForTimeout(800);
    const quieto = async (como) => {
      const d = await page.evaluate(() => {
        const h = document.querySelector('header.top').getBoundingClientRect();
        const c = document.querySelector('.feed-cab').getBoundingClientRect();
        const x = Math.round(innerWidth / 2);
        const bajo = document.elementFromPoint(x, Math.round(h.bottom + 2));
        const cab = document.querySelector('.feed-cab');
        return { y: scrollY, st: document.documentElement.scrollTop, body: document.body.scrollTop, hb: h.bottom, ct: c.top,
          bajoCab: !!bajo && (cab.contains(bajo) || document.querySelector('header.top').contains(bajo)) };
      });
      ok(d.y === 0 && d.st === 0, `${t} Descubre (${como}): el documento no se mueve (scrollY ${d.y})`);
      ok(Math.abs(d.ct - d.hb) <= 1, `${t} Descubre (${como}): la fila de filtros justo debajo de la cabecera (${Math.round(d.hb)} / ${Math.round(d.ct)})`);
      if (forma === 'escritorio') ok(d.bajoCab, `${t} Descubre (${como}): sin la tarjeta asomando entre la cabecera y los filtros`);
      // En el móvil va transparente encima de la foto (como la app).
      await cabeceraBien(page, 'header.top', `${t} Descubre (${como}):`, { opaca: forma === 'escritorio' });
      return d;
    };
    await quieto('al abrir');
    await rueda(page, vp, 2);
    const d1 = await quieto('rueda');
    ok(d1.body > 0, `${t} Descubre: la rueda pasa de publicación (body ${d1.body})`);
    await page.screenshot({ path: `${OUT}/cabecera-${nombre}-${forma}-descubre.png` });
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(1200);
    await quieto('teclado ↓');
    await page.evaluate(() => { document.body.scrollTop += 900; window.scrollTo(0, 400); document.documentElement.scrollTop = 400; });
    await page.waitForTimeout(800);
    await quieto('scroll programático');
    // Las flechas del escritorio (también usan scrollIntoView).
    if (forma === 'escritorio' && await page.locator('.feed-ir').count()) {
      await page.locator('.feed-ir').last().click(); await page.waitForTimeout(1200);
      await quieto('flecha');
    }

    // 2. Las páginas con cabecera fija.
    for (const [n, ruta] of PAGINAS) {
      await page.goto(`${BASE}${ruta}`);
      await page.waitForLoadState('load');
      await page.waitForTimeout(600);
      await cabeceraBien(page, 'header.top', `${t} ${n} (al abrir):`);
      await rueda(page, vp);
      await cabeceraBien(page, 'header.top', `${t} ${n} (rueda):`);
      await page.screenshot({ path: `${OUT}/cabecera-${nombre}-${forma}-${n}.png` });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
      await page.waitForTimeout(400);
      await cabeceraBien(page, 'header.top', `${t} ${n} (scroll programático):`);
    }
    ok(errores.length === 0, `${t} sin errores en la consola${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
    await ctx.close();

    // «Tu cuenta» y el panel, con sesión de mentira y contenido largo.
    const ctx2 = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
    await ctx2.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
    await ctx2.route(`${SUPA}/**`, falso);
    const p2 = await ctx2.newPage();
    // Contenido largo con fotos y chips posicionados (como las tarjetas),
    // para ver que pasan por debajo de la cabecera.
    const relleno = (sel) => p2.evaluate((s) => {
      const m = document.querySelector(s);
      const d = document.createElement('div');
      d.innerHTML = Array.from({ length: 12 }, () => '<div style="position:relative;height:260px;margin:12px 0;border-radius:20px;background:linear-gradient(#456,#123)"><span style="position:absolute;top:8px;left:8px;z-index:4;background:#fff;padding:4px 8px;border-radius:99px">Chip</span></div>').join('');
      m.append(d);
    }, sel);
    await p2.goto(`${BASE}/app/`);
    await p2.waitForTimeout(1500);
    await relleno('main');
    await rueda(p2, vp);
    await cabeceraBien(p2, 'header.top', `${t} Tu cuenta (rueda):`);
    await p2.screenshot({ path: `${OUT}/cabecera-${nombre}-${forma}-cuenta.png` });
    if (forma === 'movil') {
      await p2.goto(`${BASE}/panel/#/resumen`);
      await p2.waitForSelector('.topbar');
      await p2.waitForTimeout(1500);
      await relleno('#view');
      await rueda(p2, vp);
      await cabeceraBien(p2, '.topbar', `${t} panel (rueda):`);
      await p2.screenshot({ path: `${OUT}/cabecera-${nombre}-${forma}-panel.png` });
    }
    await ctx2.close();
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
