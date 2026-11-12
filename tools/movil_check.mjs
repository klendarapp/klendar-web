// La web en el móvil (Iván, 2026-11-11, en su iPhone): el menú lateral del
// admin no se cerraba y entrar en el admin ampliaba la página al tocar el
// correo. Con una sesión de mentira y Supabase simulado (no sale nada):
//
//  1. El menú del admin y el del panel (assets/cajon.js), a 390 px: se abre
//     con «Menú» (y «Más» en el panel) y se cierra con la X, tocando el fondo
//     oscurecido, con Escape, al elegir una opción (también la pantalla en la
//     que ya se está) y deslizándolo a la izquierda (Chromium). Cada vez: el
//     foco vuelve al botón que lo abrió, la página no se queda bloqueada
//     (`con-menu`, `inert`) y el botón dice si está abierto (aria-expanded).
//     Abierto, la lista empieza arriba (antes, `.open` de site.css la
//     centraba y lo de arriba no se alcanzaba).
//  2. Ningún campo de texto, desplegable o área de texto con letra de menos
//     de 16 px en el móvil (Safari amplía la página al tocarlos): entrar en
//     el admin, el admin, el panel, «Tu cuenta» y lo público. Y el viewport
//     sin `maximum-scale` ni `user-scalable=no`.
//  3. Nada se sale por la derecha a 360, 390 y 430 px (lo ancho se desplaza
//     dentro de su caja).
//  4. «Más» (☰) de la cabecera de toda la web se cierra tocando fuera.
//  5. Como la app: pestaña elegida rellena, «Tu cuenta» sin sesión y el
//     orden y los iconos del menú del panel.
//
// Chromium (como un móvil) y WebKit.
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> BASE=http://localhost:8871 node tools/movil_check.mjs
import { playwright, REF, SUPA, servidorSeguro, supabaseVacio } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();
const BASE = process.env.BASE || 'http://localhost:8871';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

const U = '0e7717e0-0000-4000-8000-0000000a0b11';
const BIZ = 'b1000000-0000-4000-8000-0000000a0b11';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2', amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] })}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'movil.check@example.com', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Prueba' }, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const RPC = {
  is_admin: true, admin_mfa_status: { required: false, enrolled: true }, admin_kpis: {},
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: 'Bar Móvil', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
  business_is_organizer: false,
  my_subscription: { plan_slug: 'standard', status: 'active', price_cents: 1990, active_offers: 0, has_analytics: true, billing: { enabled: true, blocked: false, hold: null, block_soon: false } },
  business_stats: { redemptions_30d: 0 }, my_business_offers: [], business_tools_overview: { ok: true, can_edit: true, team: { members: 1 } },
};
const falso = (conSesion) => async (route) => {
  const req = route.request();
  const p = new URL(req.url()).pathname;
  const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'content-range': '*/0', 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(b) });
  if (p === '/auth/v1/settings') return json({ external: { email: true, google: true }, disable_signup: false });
  if (p.startsWith('/auth/v1/user')) return conSesion ? json(USER) : json({ code: 401, msg: 'sin sesión' }, 401);
  if (p.startsWith('/auth/v1/factors')) return json({ all: [], totp: [] });
  if (p.startsWith('/auth/v1/')) return json({});
  if (p.startsWith('/functions/v1/')) return json({ ok: true });
  if (p.startsWith('/rest/v1/rpc/')) {
    const f = p.slice(13);
    if (f in RPC) return json(RPC[f]);
    if (f.startsWith('admin_')) return json({ rows: [], total: 0, counts: {} });
    return json(null);
  }
  if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '*/0' }, body: '' });
  if (p.startsWith('/rest/v1/')) return json([]);
  return json({});
};

async function contexto(nav, nombre, { ancho = 390, alto = 844, conSesion = false } = {}) {
  const ctx = await nav.newContext({
    viewport: { width: ancho, height: alto }, isMobile: nombre === 'chromium', hasTouch: true,
    deviceScaleFactor: 2, locale: 'es-ES', timezoneId: 'Europe/Madrid',
  });
  await supabaseVacio(ctx);
  if (conSesion) {
    await ctx.addInitScript(([r, v]) => {
      try { for (const k of [`sb-${r}-admin-auth-token`, `sb-${r}-auth-token`]) localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ }
    }, [REF, sesion()]);
  }
  await ctx.route(`${SUPA}/**`, falso(conSesion));
  await ctx.routeWebSocket(new RegExp(`^wss://${REF}\\.supabase\\.co/realtime/`), () => { /* mudo */ });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  return { ctx, p, errores };
}

const estado = (p) => p.evaluate(() => {
  const side = document.querySelector('#side');
  const r = side.getBoundingClientRect();
  return {
    abierto: side.classList.contains('open'),
    dentro: r.right > 10,
    bloqueado: document.body.classList.contains('con-menu'),
    inert: document.querySelectorAll('[inert]').length,
    foco: document.activeElement?.id || document.activeElement?.tagName,
    expandido: document.querySelector('#menuBtn')?.getAttribute('aria-expanded'),
    expandidoMas: document.querySelector('#masBtn')?.getAttribute('aria-expanded') ?? null,
    arriba: side.scrollTop === 0 && side.querySelector('.brand').getBoundingClientRect().top >= 0,
  };
});
const espera = (p) => p.waitForTimeout(350);

/** Desliza el cajón hacia la izquierda con el dedo (Chromium: eventos táctiles de verdad). */
async function desliza(p) {
  const cdp = await p.context().newCDPSession(p);
  const y = 420;
  const punto = (x) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(240) });
  for (const x of [225, 200, 160, 120, 80, 40]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punto(x) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function pruebaMenu(nav, nombre, zona) {
  const { ctx, p, errores } = await contexto(nav, nombre, { conSesion: true });
  await p.goto(`${BASE}/${zona}#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#nav a.nav', { state: 'attached' });
  await espera(p);
  // En el admin, «Menú» arriba; en el panel, «Más» en la barra de abajo.
  const boton = zona === 'panel' ? 'masBtn' : 'menuBtn';
  const abre = async () => { await p.tap(`#${boton}`); await espera(p); };
  const t = `${nombre}/${zona}`;

  await abre();
  let e = await estado(p);
  ok(e.abierto && e.dentro && e.bloqueado && e.expandido === 'true' && e.expandidoMas !== 'false', `${t}: «${zona === 'panel' ? 'Más' : 'Menú'}» lo abre (aria-expanded y la página quieta detrás)`);
  ok(e.arriba, `${t}: abierto, la lista empieza arriba (el logo a la vista)`);
  ok(await p.locator('#menuCerrar').isVisible(), `${t}: tiene una X visible`);
  const x = await p.locator('#menuCerrar').boundingBox();
  ok(x && x.width >= 44 && x.height >= 44, `${t}: la X mide 44 px o más (${x && `${Math.round(x.width)}×${Math.round(x.height)}`})`);
  await p.screenshot({ path: `${OUT}/movil-menu-${zona}-${nombre}.png` });

  const cerrado = async (como) => {
    await espera(p);
    const c = await estado(p);
    ok(!c.abierto && !c.dentro && !c.bloqueado && !c.inert && c.expandido === 'false' && c.expandidoMas !== 'true', `${t}: se cierra ${como} sin dejar la página bloqueada${c.abierto || c.bloqueado || c.inert ? ` (${JSON.stringify(c)})` : ''}`);
    return c;
  };
  await p.tap('#menuCerrar');
  e = await cerrado('con la X');
  ok(e.foco === boton, `${t}: tras la X, el foco vuelve al botón que lo abrió (${e.foco})`);

  await abre();
  await p.touchscreen.tap(375, 500);
  e = await cerrado('tocando el fondo oscurecido');
  ok(e.foco === boton, `${t}: tras tocar fuera, el foco vuelve al botón (${e.foco})`);

  await abre();
  await p.keyboard.press('Escape');
  e = await cerrado('con Escape');
  ok(e.foco === boton, `${t}: tras Escape, el foco vuelve al botón (${e.foco})`);

  // La pantalla en la que ya se está: no cambia la dirección y aun así se cierra.
  await abre();
  await p.locator('#nav a.nav.on').first().tap();
  await cerrado('al elegir la pantalla en la que ya se está');

  await abre();
  await p.locator('#nav a.nav:not(.on)').first().tap();
  await cerrado('al elegir otra pantalla');
  ok(!/#\/resumen/.test(p.url()), `${t}: y va a la pantalla elegida (${new URL(p.url()).hash})`);

  if (nombre === 'chromium') {
    await abre();
    await desliza(p);
    e = await cerrado('deslizándolo hacia la izquierda');
    ok(e.foco === boton, `${t}: tras deslizar, el foco vuelve al botón (${e.foco})`);
  }

  // En el escritorio el menú es una columna fija: sin fondo oscuro ni X, y si
  // se pasa de móvil a escritorio con él abierto, nada se queda bloqueado.
  await abre();
  await p.setViewportSize({ width: 1280, height: 800 });
  await espera(p);
  e = await estado(p);
  const x2 = await p.locator('#menuCerrar').isVisible();
  ok(!e.bloqueado && !e.inert && !x2, `${t}: al pasar al escritorio con él abierto, nada queda bloqueado (${JSON.stringify({ ...e, x: x2 })})`);
  ok(errores.length === 0, `${t}: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

const PAGINAS = [
  ['/admin', false], ['/admin#/configuracion', true], ['/admin#/negocios', true], ['/admin#/usuarios', true],
  // Sin sesión, /panel lleva a entrar (en el WebKit de Windows ese salto tumba la página).
  ['/cuenta/entrar?destino=%2Fpanel', false], ['/panel#/ficha', true], ['/panel#/validar', true],
  ['/cuenta/entrar', false], ['/cuenta/crear', false], ['/cuenta/ajustes', true],
  ['/', false], ['/descubre', false], ['/explorar', false], ['/para-negocios', false], ['/soporte', false], ['/agenda', false],
];
const mide = () => {
  const vw = document.documentElement.clientWidth;
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
  const campos = [...document.querySelectorAll('input, select, textarea')]
    .filter((el) => visible(el) && !/^(checkbox|radio|range|file|hidden|submit|button|color|image|reset)$/.test(el.type))
    .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
    .map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}[${el.name || el.type}] ${getComputedStyle(el).fontSize}`);
  const fuera = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right <= vw + 1) continue;
    let suelto = true;
    for (let q = el; q && q !== document.body; q = q.parentElement) {
      const s = getComputedStyle(q);
      if (s.position === 'fixed' || (q !== el && /(auto|scroll|hidden|clip)/.test(s.overflowX))) { suelto = false; break; }
    }
    if (suelto) fuera.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.right)}`);
  }
  const vp = document.querySelector('meta[name=viewport]')?.content || '';
  return { campos, fuera: fuera.slice(0, 5), zoom: !/maximum-scale|user-scalable/.test(vp) };
};
async function pruebaPaginas(nav, nombre) {
  for (const ancho of [360, 390, 430]) {
    for (const conSesion of [false, true]) {
      for (const [ruta, s] of PAGINAS.filter((x) => x[1] === conSesion)) {
        // Una página nueva cada vez (WebKit se cae a veces tras muchas seguidas).
        const { ctx, p } = await contexto(nav, nombre, { ancho, conSesion });
        await p.goto(BASE + ruta, { waitUntil: 'networkidle' }).catch(() => {});
        await p.waitForTimeout(500);
        const m = await p.evaluate(mide);
        await ctx.close();
        const t = `${nombre}/${ancho} ${ruta}${s ? ' (con sesión)' : ''}`;
        ok(m.campos.length === 0, `${t}: campos a 16 px o más${m.campos.length ? ` (${m.campos.slice(0, 4).join(', ')})` : ''}`);
        ok(m.fuera.length === 0, `${t}: nada se sale por la derecha${m.fuera.length ? ` (${m.fuera.join(', ')})` : ''}`);
        ok(m.zoom, `${t}: se puede ampliar (sin maximum-scale ni user-scalable)`);
      }
    }
  }
}

/** «Más» (☰) de la cabecera de toda la web: se cierra tocando fuera y al elegir. */
async function pruebaMas(nav, nombre) {
  const { ctx, p } = await contexto(nav, nombre);
  await p.goto(`${BASE}/soporte`, { waitUntil: 'networkidle' });
  const marcado = () => p.evaluate(() => document.querySelector('input#menu:not([hidden])')?.checked ?? [...document.querySelectorAll('input#menu')].some((c) => c.checked));
  await p.locator('input#menu').first().tap();
  ok(await marcado(), `${nombre}: «Más» se abre`);
  await p.touchscreen.tap(30, 700);
  await espera(p);
  ok(!(await marcado()), `${nombre}: «Más» se cierra tocando fuera`);
  await ctx.close();
}

/** Como la app (Iván, 2026-11-12): la pestaña elegida con su icono relleno,
 * «Tu cuenta» sin sesión («Aún no has entrado», Ajustes con el idioma y
 * Ayuda) y el panel con el orden y los iconos de «Mi negocio». */
async function pruebaComoLaApp(nav, nombre) {
  let { ctx, p } = await contexto(nav, nombre);
  await p.goto(`${BASE}/descubre`, { waitUntil: 'networkidle' });
  const relleno = await p.evaluate(() => {
    const a = [...document.querySelectorAll('.tabbar a[data-tab]')].filter((x) => x.getClientRects().length);
    const vis = (el) => el && getComputedStyle(el).display !== 'none';
    return a.map((x) => `${x.dataset.tab}:${x.hasAttribute('aria-current') ? 'elegida' : 'no'}:${vis(x.querySelector('.ic-on')) ? 'llena' : 'contorno'}`).join(' ');
  });
  ok(/descubre:elegida:llena/.test(relleno) && /planes:no:contorno/.test(relleno) && /cuenta:no:contorno/.test(relleno), `${nombre}: la pestaña elegida, rellena; las demás, en contorno (${relleno})`);
  await p.goto(`${BASE}/cuenta`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.invitado');
  const v = await p.locator('#view').innerText();
  ok(/Aún no has entrado/.test(v) && /Entrar o crear cuenta/.test(v) && /Ajustes/.test(v) && /Preguntas frecuentes/.test(v) && !/Sugerencias y mejoras/.test(v), `${nombre}: «Tu cuenta» sin sesión, como la app`);
  await p.click('#legal');
  const legal = await p.locator('dialog[open]').innerText();
  ok(['Términos de uso', 'Política de privacidad', 'Normas de la comunidad', 'Aviso legal', 'Fuentes y licencias'].every((x) => legal.includes(x)), `${nombre}: «Legal» con los cinco textos`);
  await p.keyboard.press('Escape');
  await p.locator('#view a[href="/cuenta/idioma"]').click();
  await p.waitForSelector('#view a[data-lang="en"]');
  await p.locator('#view a[data-lang="en"]').click();
  await p.waitForFunction(() => /Settings/.test(document.querySelector('#view')?.innerText || ''));
  ok(/\/cuenta\/idioma/.test(p.url()), `${nombre}: sin sesión, Ajustes cambia el idioma y se queda en Ajustes`);
  await ctx.close();
  ({ ctx, p } = await contexto(nav, nombre, { conSesion: true }));
  await p.goto(`${BASE}/panel#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#nav a.nav', { state: 'attached' });
  const orden = await p.evaluate(() => ({
    menu: [...document.querySelectorAll('#nav a.nav')].map((a) => a.getAttribute('href').slice(2)).join(' '),
    barra: [...document.querySelectorAll('#tabbar a')].map((a) => a.getAttribute('href').slice(2)).join(' '),
    iconos: ['informe', 'rrpp', 'preguntas', 'ayuda'].map((k) => document.querySelector(`#nav a[href="#/${k}"] .ms`)?.textContent).join(' '),
  }));
  ok(/^resumen calendario validar publicaciones ficha fidelizar informe rrpp herramientas equipo resenas preguntas cerrados ayuda plan$/.test(orden.menu.replace(/ ?agenda/, '')), `${nombre}: el menú del panel en el orden de la app (${orden.menu})`);
  ok(orden.barra === 'resumen calendario validar publicaciones', `${nombre}: la barra de abajo, en el mismo orden (${orden.barra})`);
  ok(orden.iconos === 'insights badge contact_support help_outline', `${nombre}: los iconos de Cifras, RRPP, Preguntas y Preguntas frecuentes (${orden.iconos})`);
  await ctx.close();
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  await pruebaComoLaApp(nav, nombre);
  await pruebaMas(nav, nombre);
  await pruebaMenu(nav, nombre, 'admin');
  await pruebaMenu(nav, nombre, 'panel');
  await pruebaPaginas(nav, nombre);
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
