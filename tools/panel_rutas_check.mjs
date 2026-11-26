// El panel de negocios con direcciones limpias, sin `#` (Iván, 24-11; RUNBOOK
// §4zzz-panellimpio), con el mismo patrón que el admin (tools/admin_dominio_check.mjs).
// Sin navegador (menos de 1 s) y en Chromium y WebKit con la base simulada
// (unos 30 s):
//
//  1. El servidor (functions/_lib/panel.js y el middleware de verdad):
//     `/panel` y `/panel/<pantalla>…` sirven `panel.html` sin cambiar la
//     dirección y con las cabeceras del panel; con barra final, `.html` o
//     `/index.html`, un 301 a la buena (con su `?…`); sus JS, su CSS y sus
//     diccionarios, tal cual; lo que no es una pantalla, la 404 normal. Las
//     pantallas del servidor son los `PAGES.x` de panel/*.js.
//  2. Cabeceras, rutas y ficheros: la CSP de `_headers` (`/panel` y
//     `/panel/*`) es CSP_PANEL y CABECERAS_PANEL las de `/panel`; cada JS y
//     CSS de panel/ va fuera de las Functions en `_routes.json` (uno a uno; un
//     `/panel/*` se llevaría las pantallas); en el panel no queda ningún
//     `#/`, `href="#"`, `location.hash =` ni `hashchange` que pinte; los
//     enlaces al panel de «Tu cuenta», la web pública y las Functions, sin `#`.
//  3. En el navegador, con sesión: `/panel` abre Hoy; cada sección del menú
//     y de la barra de abajo, en su ruta, sin `#` y sin recargar; un enlace
//     de dentro (una baldosa de Negocio) también; «Atrás» y «Adelante»;
//     recargar en una pantalla de dentro (con su `?…`) la vuelve a abrir;
//     un `#…` escrito a mano se quita sin moverse; `/panel/hoy/` → 301 a
//     `/panel/hoy`; `/panel#/validar` abre `/panel` (Hoy) y quita el `#`; sin
//     sesión, la vuelta de «Entrar» lleva la ruta del panel (sin `#`).
//
//   PW=<ruta a playwright> node tools/panel_rutas_check.mjs
//   node tools/panel_rutas_check.mjs --sin-navegador
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideHost } from '../functions/_lib/admin.js';
import { SECCIONES_PANEL } from '../functions/_lib/panel.js';
import { CABECERAS_PANEL, CSP_PANEL } from '../functions/_lib/csp.js';
import { direccionBuena } from '../functions/_lib/direccion.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lee = (f) => readFileSync(path.join(RAIZ, f), 'utf8');
let fallos = 0;
const ok = (nombre, c, extra = '') => {
  if (c) { if (!process.env.CALLADO) console.log(`  ok  ${nombre}`); } else { fallos += 1; console.log(`  MAL ${nombre}${extra ? `\n      ${extra}` : ''}`); }
};
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── 1. El servidor ──────────────────────────────────────────────────────────
const d = (u) => { const url = new URL(u); return decideHost(url, direccionBuena(url.pathname)); };
const PANEL = { reescribe: '/panel', zona: 'panel' };
const NO = { noExiste: true };
const CASOS = [
  ['https://klendar.app/panel', PANEL],
  ['https://klendar.app/panel?alta=1', PANEL],
  ['https://klendar.app/panel/hoy', PANEL],
  ['https://klendar.app/panel/validar?codigo=abc12345', PANEL],
  ['https://klendar.app/panel/publicar?estado=draft', PANEL],
  ['https://klendar.app/panel/negocio/en-el-local', PANEL],
  ['https://klendar.app/panel/publicaciones/0e7717e0-0000-4000-8000-000000000001?biz=x', PANEL],
  ['https://klendar.app/panel/sellos/abc/editar', PANEL],
  ['https://klendar.app/panel/alta/entidad/1', PANEL],
  ['https://klendar.app/panel/calendario/2026-12-24', PANEL],
  ['https://klendar.app/panel/', { salto: 'https://klendar.app/panel' }],
  ['https://klendar.app/panel/?lang=en', { salto: 'https://klendar.app/panel?lang=en' }],
  ['https://klendar.app/panel/hoy/', { salto: 'https://klendar.app/panel/hoy' }],
  ['https://klendar.app/panel/sellos/abc/?biz=1', { salto: 'https://klendar.app/panel/sellos/abc?biz=1' }],
  ['https://klendar.app/panel.html', { salto: 'https://klendar.app/panel' }],
  ['https://klendar.app/panel/index.html?x=1', { salto: 'https://klendar.app/panel?x=1' }],
  ['https://klendar.app/panel/panel.js', null],
  ['https://klendar.app/panel/panel.css', null],
  ['https://klendar.app/panel/i18n/ca.js', null],
  ['https://klendar.app/panel/resumen', NO],
  ['https://klendar.app/panel/herramientas', NO],
  ['https://klendar.app/panel/loquesea', NO],
  ['https://klendar.app/panel/i18n', NO],
  ['https://klendar.app/panelx', null],
  ['https://klendar.app/para-negocios', null],
  ['https://klendar.app/cuenta/entrar', null],
  // www va antes a klendar.app (el middleware); el admin, a la web pública.
  ['https://www.klendar.app/panel/hoy', null],
  ['https://admin.klendar.app/panel/hoy', { salto: 'https://klendar.app/panel/hoy' }],
  ['http://localhost:8788/panel/validar', PANEL],
];
for (const [u, esperado] of CASOS) ok(`decideHost ${u}`, igual(d(u), esperado), `${JSON.stringify(d(u))} ≠ ${JSON.stringify(esperado)}`);
const FICHEROS_PANEL = readdirSync(path.join(RAIZ, 'panel')).filter((f) => f.endsWith('.js')).map((f) => `panel/${f}`);
{
  // Las pantallas del servidor son las de panel/*.js (`PAGES.x = …` y `PAGES['x-y'] = …`).
  const paginas = new Set();
  for (const f of FICHEROS_PANEL) {
    for (const m of lee(f).matchAll(/\bPAGES(?:\.([a-z][a-z0-9]*)|\['([a-z0-9-]+)'\])\s*=(?!=)/g)) paginas.add(m[1] || m[2]);
  }
  const servidor = [...SECCIONES_PANEL].sort().join();
  ok('SECCIONES_PANEL son las pantallas de panel/*.js', servidor === [...paginas].sort().join(), `servidor: ${servidor}\n      panel: ${[...paginas].sort().join()}`);
}

// El middleware de verdad.
{
  const { onRequest } = await import('../functions/_middleware.js');
  const pedidos = [];
  const PAGINA_404 = '<!doctype html><title>Esta página no existe · Klendar</title>';
  const pide = async (u, metodo = 'GET') => onRequest({
    request: new Request(u, { method: metodo }),
    env: {
      ASSETS: {
        fetch: async (r) => {
          const ruta = new URL(r.url || r).pathname;
          pedidos.push(ruta);
          return ruta === '/esta-direccion-no-existe/'
            ? new Response(PAGINA_404, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "script-src 'self'" } })
            : new Response(`<!doctype html><p>fichero ${ruta}`, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "script-src 'self' https://otra.example" } });
        },
      },
    },
    next: async () => new Response(metodo === 'HEAD' ? null : '<!doctype html><p>siguiente', { headers: { 'content-type': 'text/javascript; charset=utf-8' } }),
  });
  for (const u of ['https://klendar.app/panel', 'https://klendar.app/panel/hoy', 'https://klendar.app/panel/sellos/abc/editar?biz=1', 'https://klendar.app/panel/alta/entidad/2']) {
    const r = await pide(u);
    const html = await r.text();
    ok(`middleware: ${u} sirve el panel (panel.html por dentro, sin saltar)`, r.status === 200 && pedidos.at(-1) === '/panel' && !r.headers.get('location') && /fichero \/panel/.test(html), `${r.status} ${pedidos.at(-1)}`);
    ok(`middleware: …${u} con las cabeceras del panel`, Object.entries(CABECERAS_PANEL).every(([k, v]) => r.headers.get(k) === v),
      Object.keys(CABECERAS_PANEL).filter((k) => r.headers.get(k) !== CABECERAS_PANEL[k]).map((k) => `${k}: ${r.headers.get(k)}`).join(' | '));
    ok(`middleware: …${u} sin nonce (Cloudflare no le mete nada: no-transform)`, !/'nonce-/.test(r.headers.get('content-security-policy') || ''));
  }
  const h = await pide('https://klendar.app/panel/validar', 'HEAD');
  ok('middleware: HEAD de una pantalla del panel, 200 y sin cuerpo', h.status === 200 && h.body === null);
  for (const [u, l] of [
    ['https://klendar.app/panel/', 'https://klendar.app/panel'],
    ['https://klendar.app/panel/hoy/', 'https://klendar.app/panel/hoy'],
    ['https://klendar.app/panel/publicar/?estado=draft', 'https://klendar.app/panel/publicar?estado=draft'],
    ['https://klendar.app/panel.html', 'https://klendar.app/panel'],
    ['https://klendar.app/panel/index.html', 'https://klendar.app/panel'],
    ['https://www.klendar.app/panel/hoy', 'https://klendar.app/panel/hoy'],
  ]) {
    const r = await pide(u);
    ok(`middleware: ${u} → 301 ${l}`, r.status === 301 && r.headers.get('location') === l, `${r.status} ${r.headers.get('location')}`);
  }
  for (const u of ['https://klendar.app/panel/resumen', 'https://klendar.app/panel/loquesea', 'https://klendar.app/panel/i18n']) {
    const r = await pide(u);
    ok(`middleware: ${u} → la 404 normal`, r.status === 404 && (await r.text()) === PAGINA_404);
  }
  const antes = pedidos.length;
  const js = await pide('https://klendar.app/panel/panel.js?v=1');
  ok('middleware: un JS del panel (si llegara), tal cual', js.status === 200 && /siguiente/.test(await js.text()) && pedidos.length === antes);
}

// ── 2. Cabeceras, rutas y ficheros ─────────────────────────────────────────
{
  const cab = lee('_headers');
  const bloqueDe = (z) => new RegExp(`^${z.replace(/[*]/g, '\\*')}\\r?\\n((?: {2}.*\\r?\\n)+)`, 'm').exec(cab)?.[1] || '';
  for (const z of ['/panel', '/panel/*']) {
    const csp = /^ {2}Content-Security-Policy: (.+)$/m.exec(bloqueDe(z))?.[1] || '';
    ok(`${z}: la CSP de _headers es CSP_PANEL`, csp === CSP_PANEL, csp);
  }
  const pagina = bloqueDe('/panel');
  const de = (k) => new RegExp(`^ {2}${k}: (.+)$`, 'mi').exec(pagina)?.[1] || '';
  for (const k of ['Cache-Control', 'X-Robots-Tag', 'Permissions-Policy']) {
    ok(`CABECERAS_PANEL: ${k} como /panel en _headers`, CABECERAS_PANEL[k.toLowerCase()] === de(k), `${CABECERAS_PANEL[k.toLowerCase()]} ≠ ${de(k)}`);
  }
  ok("CSP_PANEL: frame-ancestors 'none', default-src 'self', object-src 'none', base-uri y form-action 'self'",
    ["frame-ancestors 'none'", "default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].every((x) => CSP_PANEL.includes(x)));
  ok("CSP_PANEL: sin 'unsafe-inline' ni 'unsafe-eval' en script-src", !/script-src[^;]*'unsafe-(inline|eval)'/.test(CSP_PANEL));
  ok('CABECERAS_PANEL: sin dejarse enmarcar', CABECERAS_PANEL['x-frame-options'] === 'DENY');
  const rutas = JSON.parse(lee('_routes.json'));
  const ficheros = readdirSync(path.join(RAIZ, 'panel')).filter((f) => /\.(js|css)$/.test(f)).map((f) => `/panel/${f}`);
  const faltan = ficheros.filter((f) => !rutas.exclude.includes(f));
  ok('_routes.json: cada JS y CSS del panel, fuera de las Functions (uno a uno)', !faltan.length, faltan.join(', '));
  ok('_routes.json: los diccionarios del panel, fuera (/panel/i18n/*)', rutas.exclude.includes('/panel/i18n/*'));
  ok('_routes.json: ni /panel/* ni /panel fuera (las pantallas pasan por el middleware)', !rutas.exclude.some((r) => r === '/panel/*' || r === '/panel'));
  ok('_routes.json: dentro del tope de Cloudflare (100 reglas)', rutas.include.length + rutas.exclude.length <= 100, String(rutas.include.length + rutas.exclude.length));
  ok('_redirects: sin reglas del panel (no se aplican a lo que pasa por las Functions)', !/^\/panel/m.test(lee('_redirects')));
  // Sin `#` en el panel: ni `#/`, ni `href="#"`, ni moverse con `location.hash`, ni pintar con `hashchange`.
  const conHash = ['panel.html', ...FICHEROS_PANEL]
    .filter((f) => /#\//.test(lee(f)) || /href="#"/.test(lee(f))
      || /location\.hash\s*=|location\.(replace|assign)\(['"`]#/.test(lee(f)));
  ok('el panel sin `#/`, `href="#"` ni `location.hash =`', !conHash.length, conHash.join(', '));
  const js = lee('panel/panel.js');
  ok('panel.js: pinta con popstate, no con hashchange', /addEventListener\('popstate'/.test(js) && !/addEventListener\('hashchange', async/.test(js));
  ok('panel.js: currentRoute lee location.pathname', /const currentRoute = \(\) => \(location\.pathname/.test(js));
  ok('panel.js: go() con history.pushState', /history\[reemplaza \? 'replaceState' : 'pushState'\]/.test(js));
  // Los enlaces al panel desde fuera (la web pública, «Tu cuenta», las Functions), sin `#`.
  const fuera = [];
  const mira = (dir) => {
    for (const n of readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
      const f = `${dir}/${n.name}`;
      if (n.isDirectory()) { if (!['node_modules', 'tools', 'fonts', 'vendor', 'img'].includes(n.name)) mira(f); continue; }
      if (!/\.(js|html|py)$/.test(n.name)) continue;
      lee(f).split('\n').forEach((l, i) => {
        if (/\/panel(\?[^#\s'"`]*)?#\/|\/panel\/#/.test(l) && !/no llevan|ya no|abre `\/panel`|`#` ya no/.test(l)) fuera.push(`${f}:${i + 1}`);
      });
    }
  };
  for (const dir of ['assets', 'functions', 'en']) mira(dir);
  for (const f of readdirSync(RAIZ).filter((n) => /\.(html|py)$/.test(n))) {
    lee(f).split('\n').forEach((l, i) => { if (/\/panel(\?[^#\s'"`]*)?#\//.test(l)) fuera.push(`${f}:${i + 1}`); });
  }
  ok('ningún enlace al panel con `#/` en la web', !fuera.length, fuera.join(', '));
  // `?code=` es el de Supabase (la vuelta de Google con PKCE): supabase-js lo
  // canjearía y lo quitaría. El código de un QR va en `?codigo=`.
  ok('el panel no usa `?code=` en sus direcciones (es el de Supabase)', !/get\('code'\)/.test(js) && !/Location: [^,]*[?&]code=/.test(lee('functions/r/[code].js')));
  ok('/r/<código>, /c/<…> y /tv/enlazar/<…> van al panel sin `#`', /Location: `\/panel\/validar\?codigo=/.test(lee('functions/r/[code].js'))
    && /Location: `\/panel\/validar\?cliente=/.test(lee('functions/c/[token].js')) && /`\/panel\/tele\?codigo=/.test(lee('functions/tv/enlazar/[code].js')));
}

if (process.argv.includes('--sin-navegador')) {
  console.log(fallos ? `\n${fallos} fallos.` : '\nTodo bien (sin navegador).');
  process.exit(fallos ? 1 : 0);
}

// ── 3. En el navegador ──────────────────────────────────────────────────────
const { playwright, REF, SUPA } = await import('./_supabase_simulado.mjs');
const { webConDatos, NEGOCIOS } = await import('./_web_con_datos.mjs');
const pw = playwright();
const web = await webConDatos({ puerto: Number(process.env.PORT || 9393) });
const BASE = web.BASE;

const U = '0e7717e0-0000-4000-8000-0000000c1e01';
const BIZ = NEGOCIOS[0].id;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal1', amr: [{ method: 'password', timestamp: 1 }] })}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'panel.rutas@example.com', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Ana' }, created_at: '2026-01-01T00:00:00Z' };
const SESION = JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const ahora = Date.now();
const iso = (h) => new Date(ahora + h * 3600e3).toISOString();
const OFERTA = {
  id: '0ff00000-0000-4000-8000-0000000c1e01', business_id: BIZ, title: 'Café + tostada', kind: 'flash_offer', status: 'active', panel_state: 'activa',
  redeem_start_at: iso(-1), redeem_end_at: iso(4), views: 12, redemptions_count: 1, audience: 'all', price_cents: 250, moderation_status: 'approved',
};
const RPC = {
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: 'Bar Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Málaga' }],
  business_is_organizer: false,
  my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
  my_subscription: { plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: 'active', period_end: '2027-01-01T00:00:00Z', payment_method: 'transfer', price_cents: 1990, active_offers: 1, has_analytics: true, billing: { enabled: true, blocked: false } },
  business_tools_overview: { ok: true, features: {}, can_edit: true, team: { members: 1 }, stamps: { active: 1 }, series: { rules_active: 0 } },
  my_business_offer_counts: { todas: 1, activa: 1, total: 1, publicadas: 1 },
  my_business_offers_page: [OFERTA],
  business_today: { validated: 1, views: 12, today: [OFERTA], next: [], recent: [] },
  business_crowd_status: { enabled: false }, business_venue_demand: { people: 0 },
  business_terms_notice: null, business_closure_state: null, business_recent_validations: [],
  my_offer_rules: [], my_publishable_businesses: [], assistant_status: { available: false }, my_stamp_cards: [], my_redemptions: [],
  business_loyalty: { ok: true, can_edit: true, coupon: {}, thanks: {} },
};

async function abre(nav, { sesion = true } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await web.conDatos(ctx);
  await ctx.addInitScript(([k, v, con]) => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.effectiveDirective} ${e.blockedURI}`));
    try { if (!sessionStorage.getItem('__puesta')) { localStorage.clear(); if (con) localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); sessionStorage.setItem('__puesta', '1'); } } catch { /* */ }
  }, [`sb-${REF}-auth-token`, SESION, sesion]);
  await ctx.route(`${SUPA}/**`, async (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (sesion && p.startsWith('/auth/v1/user')) return json(USER);
    if (sesion && p.startsWith('/auth/v1/token')) return json(JSON.parse(SESION));
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      if (fn in RPC) return json(RPC[fn]);
    }
    return route.fallback();
  });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.setDefaultTimeout(15000);
  return { ctx, pg, errores };
}
const cspDe = (pg) => pg.evaluate(() => window.__csp || []).catch(() => []);

try {
  for (const [nombre, tipo] of [['Chromium', pw.chromium], ['WebKit', pw.webkit]]) {
    const nav = await tipo.launch();
    try {
      const { ctx, pg, errores } = await abre(nav);
      const aqui = () => pg.evaluate(() => ({
        ruta: location.pathname, q: location.search, hash: location.hash, url: location.href, marca: window.__sinRecargar === 1,
        on: document.querySelector('#nav a.nav[aria-current]')?.getAttribute('href') || '', pagina: document.querySelector('#view > div')?.dataset.pagina || '',
      }));
      // Que la pantalla `pagina` se haya pintado (y no siga «Cargando…»).
      const pintada = (pagina) => pg.waitForFunction((x) => document.querySelector('#view > div')?.dataset.pagina === x && !document.querySelector('#view .loading, #view .esq-p'), pagina, { timeout: 10000 }).catch(() => {});
      // a) /panel abre Hoy, en /panel.
      await pg.goto(`${BASE}/panel`);
      await pg.waitForSelector('#view h1');
      await pintada('hoy');
      let a = await aqui();
      ok(`${nombre}: /panel abre Hoy y se queda en /panel`, a.ruta === '/panel' && !a.hash && a.pagina === 'hoy' && a.on === '/panel/hoy', JSON.stringify(a));
      await pg.evaluate(() => { window.__sinRecargar = 1; });
      // b) Las cuatro secciones del menú, en su ruta, sin # y sin recargar.
      const hrefs = await pg.$$eval('#nav a.nav', (as) => as.map((x) => x.getAttribute('href')));
      ok(`${nombre}: el menú, con las cuatro en su ruta`, igual(hrefs, ['/panel/hoy', '/panel/validar', '/panel/publicar', '/panel/negocio']), hrefs.join(' '));
      const malos = [];
      for (const h of [...hrefs.slice(1), hrefs[0]]) {
        await pg.click(`#nav a.nav[href="${h}"]`);
        await pintada(h.split('/')[2]);
        a = await aqui();
        if (a.ruta !== h || a.hash || a.url.includes('#') || !a.marca || a.on !== h) malos.push(`${h} → ${a.url} (${a.on}${a.marca ? '' : ', recargada'})`);
      }
      ok(`${nombre}: cada sección del menú, en su ruta, sin # en la barra y sin recargar`, !malos.length, malos.join(' | '));
      // c) Un enlace de dentro: Negocio › una baldosa (Sellos), sin recargar.
      await pg.click('#nav a.nav[href="/panel/negocio"]');
      await pintada('negocio');
      await pg.waitForSelector('[data-neg="stamps"]');
      const sellos = await pg.getAttribute('[data-neg="stamps"]', 'href');
      ok(`${nombre}: la baldosa «Sellos» lleva a /panel/sellos`, sellos === '/panel/sellos', String(sellos));
      await pg.click('[data-neg="stamps"]');
      await pintada('sellos');
      a = await aqui();
      ok(`${nombre}: …y la abre sin recargar, marcando Negocio`, a.ruta === '/panel/sellos' && a.marca && a.on === '/panel/negocio', JSON.stringify(a));
      // d) Atrás y adelante.
      await pg.goBack();
      await pintada('negocio');
      a = await aqui();
      ok(`${nombre}: «Atrás» vuelve a Negocio`, a.ruta === '/panel/negocio' && a.pagina === 'negocio' && a.marca, JSON.stringify(a));
      await pg.goBack();
      await pintada('hoy');
      a = await aqui();
      ok(`${nombre}: …y otra vez, a Hoy`, a.ruta === '/panel/hoy' && a.pagina === 'hoy' && a.marca, JSON.stringify(a));
      await pg.goForward();
      await pintada('negocio');
      await pg.goForward();
      await pintada('sellos');
      a = await aqui();
      ok(`${nombre}: «Adelante» dos veces, otra vez en Sellos`, a.ruta === '/panel/sellos' && a.pagina === 'sellos' && a.marca, JSON.stringify(a));
      // e) Un `#…` escrito a mano: se quita y no salta.
      await pg.evaluate(() => { location.hash = '#/validar'; });
      await pg.waitForFunction(() => !location.hash, null, { timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(300);
      a = await aqui();
      ok(`${nombre}: un #/validar escrito a mano se quita y no salta`, a.ruta === '/panel/sellos' && !a.hash && !a.url.includes('#') && a.pagina === 'sellos', JSON.stringify(a));
      // f) Recargar en una pantalla de dentro, con su `?…`.
      await pg.goto(`${BASE}/panel/publicar?estado=borrador`);
      await pintada('publicar');
      await pg.reload();
      await pintada('publicar');
      a = await aqui();
      ok(`${nombre}: recargar en /panel/publicar?estado=borrador la vuelve a abrir`, a.ruta === '/panel/publicar' && /estado=borrador/.test(a.q) && a.on === '/panel/publicar', JSON.stringify(a));
      await pg.goto(`${BASE}/panel/negocio/en-el-local`);
      await pintada('negocio');
      await pg.reload();
      await pintada('negocio');
      a = await aqui();
      ok(`${nombre}: recargar en /panel/negocio/en-el-local, ahí`, a.ruta === '/panel/negocio/en-el-local' && a.pagina === 'negocio', JSON.stringify(a));
      // g) Con barra final, un 301 a la misma sin barra.
      const r301 = await pg.goto(`${BASE}/panel/hoy/`);
      await pintada('hoy');
      a = await aqui();
      ok(`${nombre}: /panel/hoy/ → /panel/hoy (301)`, a.ruta === '/panel/hoy' && r301.request().redirectedFrom()?.url() === `${BASE}/panel/hoy/`, JSON.stringify(a));
      // h) Un enlace viejo con `#/x`: /panel (Hoy) y sin el `#`.
      await pg.goto(`${BASE}/panel#/validar`);
      await pintada('hoy');
      a = await aqui();
      ok(`${nombre}: /panel#/validar abre /panel (Hoy) y quita el #`, a.ruta === '/panel' && !a.hash && !a.url.includes('#') && a.pagina === 'hoy', JSON.stringify(a));
      ok(`${nombre}: sin violaciones de CSP`, !(await cspDe(pg)).length, (await cspDe(pg)).join(' | '));
      ok(`${nombre}: sin errores`, !errores.length, errores.join(' | '));
      await ctx.close();
      // i) Sin sesión: a entrar, con la ruta del panel (sin `#`) en la vuelta.
      //    (Solo en Chromium: en el WebKit de Windows ese salto tumba la página,
      //    como dice tools/movil_check.mjs.)
      if (nombre === 'Chromium') {
        const s = await abre(nav, { sesion: false });
        await s.pg.goto(`${BASE}/panel/validar?codigo=abc12345`);
        await s.pg.waitForURL(/\/cuenta\/entrar/, { timeout: 15000 }).catch(() => {});
        const u = new URL(s.pg.url());
        ok(`${nombre}: sin sesión, a entrar con destino=/panel/validar?codigo=…`, u.pathname === '/cuenta/entrar' && u.searchParams.get('destino') === '/panel/validar?codigo=abc12345', s.pg.url());
        await s.ctx.close();
      }
    } finally {
      await nav.close();
    }
  }
} finally {
  await web.cierra();
}
console.log(fallos ? `\n${fallos} fallos.` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
