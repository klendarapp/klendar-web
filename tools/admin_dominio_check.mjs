// El admin en la raíz de su propio subdominio, https://admin.klendar.app/
// (Iván, 23-11; RUNBOOK §4zzz-admindom). Sin navegador (unos 0,5 s) y en
// Chromium y WebKit con la base simulada (unos 30 s):
//
//  1. Qué hace cada host (functions/_lib/admin.js y el middleware de verdad):
//     en admin.klendar.app, `/` y `/carta` se reescriben a sus ficheros sin
//     cambiar la dirección, sus JS se sirven y lo demás va a klendar.app;
//     `/admin…`, en los dos hosts, da la 404 normal (sin pistas).
//  2. Las cabeceras: la CSP del admin, igual o más estricta (sin Mapbox ni
//     WebSocket, `frame-ancestors 'none'`, `Cross-Origin-Opener-Policy`), la
//     misma en `_headers` y en el middleware (CSP_ADMIN); robots.txt no nombra
//     el admin.
//  3. En el navegador (localhost hace de klendar.app y admin.localhost de
//     admin.klendar.app, como tools/serve_dev.mjs):
//     - las direcciones viejas dan la 404 normal;
//     - cualquier página de klendar.app borra en silencio la sesión vieja del
//       admin (assets/errores.js) sin tocar la de «Tu cuenta» ni el idioma;
//     - entrar con contraseña y el segundo factor (código de 6 cifras) en la
//       raíz de admin.localhost: la sesión se guarda allí y no en localhost, y
//       en la barra nunca sale `/admin`;
//     - «Confirma que eres tú» (contraseña con sesión aparte y
//       `confirm_identity`);
//     - «¿Has olvidado la contraseña?» vuelve por «Tu cuenta» de la web
//       pública (`/cuenta/nueva-clave?destino=/admin`) y de ahí a la raíz del
//       admin;
//     - el logo de «Entrar» lleva a la web pública; sin violaciones de CSP.
//
//   PW=<ruta a playwright> node tools/admin_dominio_check.mjs
//   node tools/admin_dominio_check.mjs --sin-navegador
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideHost, origenAdmin, origenPublico } from '../functions/_lib/admin.js';
import { CABECERAS_ADMIN, CSP_ADMIN } from '../functions/_lib/csp.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lee = (f) => readFileSync(path.join(RAIZ, f), 'utf8');
let fallos = 0;
const ok = (nombre, c, extra = '') => {
  if (c) { if (!process.env.CALLADO) console.log(`  ok  ${nombre}`); } else { fallos += 1; console.log(`  MAL ${nombre}${extra ? `\n      ${extra}` : ''}`); }
};

// ── 1. Cada host ────────────────────────────────────────────────────────────
const d = (u) => decideHost(new URL(u));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const NO = { noExiste: true };
const CASOS = [
  ['https://klendar.app/admin', NO],
  ['https://klendar.app/admin/', NO],
  ['https://klendar.app/admin?x=1', NO],
  ['https://klendar.app/admin/carta', NO],
  ['https://klendar.app/admin/admin.js', NO],
  ['https://www.klendar.app/admin', NO],
  ['https://klendar-web.pages.dev/admin/x', NO],
  ['https://klendar.app/administracion', null],
  ['https://klendar.app/privacidad', null],
  ['https://klendar.app/', null],
  ['https://admin.klendar.app/', { reescribe: '/admin' }],
  ['https://admin.klendar.app/?inactividad=20', { reescribe: '/admin' }],
  ['https://admin.klendar.app/carta', { reescribe: '/admin/carta' }],
  ['https://admin.klendar.app/admin/admin.js', null],
  ['https://admin.klendar.app/admin/admin.css', null],
  ['https://admin.klendar.app/admin', NO],
  ['https://admin.klendar.app/admin/', NO],
  ['https://admin.klendar.app/admin/carta', NO],
  ['https://admin.klendar.app/privacidad?x=1', { salto: 'https://klendar.app/privacidad?x=1' }],
  ['https://admin.klendar.app/o/abc', { salto: 'https://klendar.app/o/abc' }],
  ['https://admin.klendar.app/cuenta/nueva-clave?destino=%2Fadmin', { salto: 'https://klendar.app/cuenta/nueva-clave?destino=%2Fadmin' }],
  ['https://admin.klendar.app/panel', { salto: 'https://klendar.app/panel' }],
  ['http://localhost:8788/admin', NO],
  ['http://admin.localhost:8788/', { reescribe: '/admin' }],
  ['http://admin.localhost:8788/privacidad', { salto: 'http://localhost:8788/privacidad' }],
  // Un host que solo empieza por «admin.» no es el del admin.
  ['https://admin.klendar.app.evil.example/', null],
  ['https://admin.klendar-web.pages.dev/admin/x', NO],
];
for (const [u, esperado] of CASOS) ok(`decideHost ${u}`, igual(d(u), esperado), `${JSON.stringify(d(u))} ≠ ${JSON.stringify(esperado)}`);
ok('decideHost: /carta.html del admin, a /carta', igual(decideHost(new URL('https://admin.klendar.app/carta.html?n=1'), '/carta'), { salto: 'https://admin.klendar.app/carta?n=1' }));
ok('decideHost: /admin.html de klendar.app, la 404', igual(decideHost(new URL('https://klendar.app/admin.html'), '/admin'), NO));
ok('origenAdmin de klendar.app', origenAdmin(new URL('https://klendar.app/x')) === 'https://admin.klendar.app');
ok('origenPublico de admin.klendar.app', origenPublico(new URL('https://admin.klendar.app/')) === 'https://klendar.app');
ok('origenPublico de admin.localhost', origenPublico(new URL('http://admin.localhost:9/')) === 'http://localhost:9');

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
    next: async () => new Response(metodo === 'HEAD' ? null : '<!doctype html><p>siguiente', { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "script-src 'self'" } }),
  });
  for (const u of ['https://klendar.app/admin', 'https://klendar.app/admin/', 'https://klendar.app/admin.html', 'https://klendar.app/admin/admin.js',
    'https://klendar.app/admin/carta.html?n=2', 'https://www.klendar.app/admin', 'https://admin.klendar.app/admin', 'https://admin.klendar.app/admin/', 'https://admin.klendar.app/admin.html']) {
    const r = await pide(u);
    const html = await r.text();
    ok(`middleware: ${u} → la 404 normal (sin saltos ni pistas)`, r.status === 404 && !r.headers.get('location') && html === PAGINA_404, `${r.status} ${r.headers.get('location') || ''}`);
    ok(`middleware: …${u} con la CSP de lo público (nonce), no la del admin`, /'nonce-/.test(r.headers.get('content-security-policy') || '') && r.headers.get('content-security-policy') !== CSP_ADMIN);
  }
  const a = await pide('https://admin.klendar.app/');
  ok('middleware: admin.klendar.app/ sirve el admin (fichero /admin, sin saltar)', a.status === 200 && pedidos.at(-1) === '/admin' && !a.headers.get('location') && /fichero \/admin/.test(await a.text()));
  for (const [k, v] of Object.entries(CABECERAS_ADMIN)) ok(`middleware: el admin con ${k}: ${v.slice(0, 40)}`, a.headers.get(k) === v, a.headers.get(k));
  ok('middleware: el admin sin nonce', !/'nonce-/.test(a.headers.get('content-security-policy') || ''));
  const c = await pide('https://admin.klendar.app/carta?n=3');
  ok('middleware: admin.klendar.app/carta, la carta (fichero /admin/carta)', c.status === 200 && pedidos.at(-1) === '/admin/carta' && c.headers.get('content-security-policy') === CSP_ADMIN);
  const h = await pide('https://admin.klendar.app/', 'HEAD');
  ok('middleware: HEAD del admin, sin cuerpo', h.status === 200 && h.body === null);
  const js = await pide('https://admin.klendar.app/admin/admin.js');
  ok('middleware: los JS del admin en su host, tal cual', js.status === 200 && /siguiente/.test(await js.text()));
  for (const [u, l] of [
    ['https://admin.klendar.app/index.html', 'https://admin.klendar.app/'],
    ['https://admin.klendar.app/carta.html?n=2', 'https://admin.klendar.app/carta?n=2'],
    ['https://admin.klendar.app/privacidad/', 'https://klendar.app/privacidad'],
    ['https://admin.klendar.app/explorar?que=sitios', 'https://klendar.app/explorar?que=sitios'],
  ]) {
    const r = await pide(u);
    ok(`middleware: ${u} → 301 ${l}`, r.status === 301 && r.headers.get('location') === l, `${r.status} ${r.headers.get('location')}`);
    ok(`middleware: …${u}, el 301 sin buscadores`, /noindex/.test(r.headers.get('x-robots-tag') || ''));
  }
  const pub = await pide('https://klendar.app/privacidad');
  ok('middleware: lo público en klendar.app, igual que antes', pub.status === 200 && /siguiente/.test(await pub.text()));
}

// ── 2. Cabeceras, rutas y textos ───────────────────────────────────────────
{
  const cab = lee('_headers');
  for (const z of ['/admin', '/admin/*']) {
    const bloque = new RegExp(`^${z.replace(/[*]/g, '\\*')}\\r?\\n((?: {2}.*\\r?\\n)+)`, 'm').exec(cab)?.[1] || '';
    const csp = /^ {2}Content-Security-Policy: (.+)$/m.exec(bloque)?.[1] || '';
    ok(`${z}: la CSP de _headers es CSP_ADMIN`, csp === CSP_ADMIN, csp);
    ok(`${z}: Cross-Origin-Opener-Policy: same-origin`, /^ {2}Cross-Origin-Opener-Policy: same-origin$/m.test(bloque));
    ok(`${z}: sin caché ni buscadores`, /no-store/.test(bloque) && /X-Robots-Tag: noindex, nofollow/.test(bloque));
  }
  ok("CSP_ADMIN con frame-ancestors 'none'", /frame-ancestors 'none'/.test(CSP_ADMIN));
  ok("CSP_ADMIN con default-src 'self', object-src 'none', base-uri 'self' y form-action 'self'", ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].every((x) => CSP_ADMIN.includes(x)));
  ok("CSP_ADMIN: script-src solo 'self' y Turnstile", /script-src 'self' https:\/\/challenges\.cloudflare\.com;/.test(CSP_ADMIN));
  ok('CSP_ADMIN: sin Mapbox ni WebSocket (el admin no los usa)', !/mapbox|wss:/.test(CSP_ADMIN));
  ok('CABECERAS_ADMIN: sin dejarse enmarcar, sin caché, sin buscadores', CABECERAS_ADMIN['x-frame-options'] === 'DENY' && /no-store/.test(CABECERAS_ADMIN['cache-control']) && /noindex/.test(CABECERAS_ADMIN['x-robots-tag']));
  const rutas = JSON.parse(lee('_routes.json'));
  ok('_routes.json: del admin, fuera del middleware solo su CSS (lo usa el panel)', rutas.exclude.filter((r) => r.startsWith('/admin')).join() === '/admin/admin.css');
  ok('el panel sigue con /admin/admin.css (y klendar.app se lo sirve)', /href="\/admin\/admin\.css\?v=/.test(lee('panel.html')) && decideHost(new URL('https://klendar.app/admin/admin.css')) === null);
  ok('robots.txt no nombra el admin', !/admin/i.test(lee('robots.txt')));
  ok('sin página puente', !/puente/.test(lee('functions/_middleware.js')) && !/puente/.test(lee('functions/_lib/admin.js')));
  const js = lee('admin/admin.js');
  ok('admin.js: la contraseña nueva, por «Tu cuenta» de la web pública', /redirectTo: `\$\{WEB\}\/cuenta\/nueva-clave\?destino=%2Fadmin`/.test(js) && !/location\.origin\}\/cuenta/.test(js));
  ok('admin.js: sin /admin a la vista (ni klendar.app/admin ni admin.klendar.app/admin)', !/klendar\.app\/admin/.test(js));
  ok('admin.js: admin.localhost cuenta como local', /\(admin\\\.\)\?localhost/.test(js));
  ok('crecer.js: la carta en /carta', /`\/carta\?\$\{/.test(lee('admin/crecer.js')) && !/\/admin\/carta/.test(lee('admin/crecer.js')));
  const err = lee('assets/errores.js');
  ok('errores.js: borra la sesión vieja del admin fuera de su host', /VIEJO_ADMIN = \/\^\(sb-\[a-z0-9\]\+-admin-auth-token\|klendar\\\.admin\\\.\|kl_admin_\)\//.test(err) && /if \(!\/\^admin\\\.\/i\.test\(location\.hostname\)\)/.test(err));
  const v = /ERRORES_V = '([^']+)'/.exec(lee('functions/_lib/page.js'))?.[1];
  ok('errores.js: versión nueva (la vieja se guardaba un año)', v && v !== '20261112cadena' && lee('build_site.py').includes(`errores.js?v=${v}`), v);
  const cuenta = lee('assets/cuenta/app.js');
  ok('«Tu cuenta»: tras la contraseña nueva, destino=/admin va a la raíz de admin.klendar.app', /'https:\/\/admin\.klendar\.app\/'/.test(cuenta));
}

if (process.argv.includes('--sin-navegador')) {
  console.log(fallos ? `\n${fallos} fallos.` : '\nTodo bien (sin navegador).');
  process.exit(fallos ? 1 : 0);
}

// ── 3. En el navegador ──────────────────────────────────────────────────────
const { adminDe, playwright, REF, SUPA } = await import('./_supabase_simulado.mjs');
const { webConDatos } = await import('./_web_con_datos.mjs');
const pw = playwright();
const web = await webConDatos({ puerto: Number(process.env.PORT || 9387) });
const BASE = web.BASE;
const ADMIN = adminDe(BASE);

const U = '0e7717e0-0000-4000-8000-00000000ad01';
const F = '0e7717e0-0000-4000-8000-00000000fd01';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (aal) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal, session_id: 'cafe0000-0000-4000-8000-00000000ad01', amr: [{ method: aal === 'aal2' ? 'totp' : 'password', timestamp: Math.floor(Date.now() / 1000) }] })}.firmaa`;
const FACTOR = { id: F, factor_type: 'totp', status: 'verified', friendly_name: 'Móvil', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
const USUARIO = { id: U, aud: 'authenticated', role: 'authenticated', email: 'admindom@example.com', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [{ provider: 'email' }], factors: [FACTOR] };
const tokens = (aal) => ({ access_token: jwt(aal), refresh_token: `r-${aal}`, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USUARIO });
const CLAVE_ADMIN = `sb-${REF}-admin-auth-token`;
const CLAVE_CUENTA = `sb-${REF}-auth-token`;

async function abre(nav) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  // Lo que salte de la CSP, en cualquier página.
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.effectiveDirective} ${e.blockedURI}`));
  });
  await ctx.route(/\/config\.js(\?|$)/, (route) => route.fulfill({
    contentType: 'text/javascript', body: `window.KLENDAR_ENV = { name: 'prueba', url: '${SUPA}', key: 'x', turnstile: '' };`,
  }));
  const estado = { password: 0, recover: [], verify: [], confirm: [] };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    const aal = (() => { try { return JSON.parse(Buffer.from(String(req.headers().authorization).split('.')[1], 'base64url').toString()).aal; } catch { return null; } })();
    if (p === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') { estado.password += 1; return body.password === 'buena' ? json(tokens('aal1')) : json({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400); }
    if (p === '/auth/v1/recover') { estado.recover.push(url.searchParams.get('redirect_to')); return json({}); }
    if (p === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (p === '/auth/v1/user' && aal) return json(USUARIO);
    if (p === `/auth/v1/factors/${F}/challenge`) return json({ id: 'reto-1', type: 'totp', expires_at: 4102444800 });
    if (p === `/auth/v1/factors/${F}/verify`) { estado.verify.push(body.code); return body.code === '123456' ? json(tokens('aal2')) : json({ code: 422, error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' }, 422); }
    if (p === '/rest/v1/rpc/admin_mfa_status') return json({ admin: true, required: true, enrolled: true, aal: aal || 'aal1', expires_at: new Date(Date.now() + 6 * 3600e3).toISOString() });
    if (p === '/rest/v1/rpc/confirm_identity') { estado.confirm.push(body.p_session); return json(null); }
    if (p === '/rest/v1/rpc/is_admin') return json(true);
    if (p.startsWith('/rest/v1/admin_users')) return json([{ user_id: U }]);
    if (p.startsWith('/rest/v1/rpc/admin_')) return json(null);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.setDefaultTimeout(15000);
  return { ctx, pg, estado, errores };
}
const cspDe = (pg) => pg.evaluate(() => window.__csp || []).catch(() => []);

try {
  for (const [nombre, tipo] of [['Chromium', pw.chromium], ['WebKit', pw.webkit]]) {
    const nav = await tipo.launch();
    try {
      // a) Las direcciones viejas: la 404 normal; y la sesión vieja del admin,
      //    fuera de klendar.app en cuanto se abre cualquier página suya.
      {
        const { ctx, pg, errores } = await abre(nav);
        for (const u of [`${BASE}/admin#/negocios?status=pending`, `${BASE}/admin/`, `${BASE}/admin/admin.js`, `${ADMIN}/admin#/resumen`, `${ADMIN}/admin/`]) {
          const r = await pg.goto(u);
          ok(`${nombre}: ${u} → la 404 normal`, r.status() === 404 && /no existe/i.test(await pg.title()) && new URL(pg.url()).pathname.startsWith('/admin'), `${r.status()} ${pg.url()} «${await pg.title()}»`);
        }
        await pg.goto(`${BASE}/privacidad`);
        await pg.evaluate(([a, c]) => {
          localStorage.setItem(a, '{"vieja":1}');
          localStorage.setItem(`${a}-code-verifier`, 'x');
          localStorage.setItem('klendar.admin.actividad', '1');
          localStorage.setItem('klendar.admin.bandeja.filtro', 'negocio');
          sessionStorage.setItem('kl_admin_login_nuevo', '1');
          localStorage.setItem(c, '{"cuenta":1}');
          localStorage.setItem('klendar_lang', 'es');
        }, [CLAVE_ADMIN, CLAVE_CUENTA]);
        for (const r of ['/', '/explorar', '/para-negocios']) {
          await pg.goto(`${BASE}${r}`, { waitUntil: 'load' });
          await pg.waitForFunction(() => window.__klendarErrores === true, null, { timeout: 8000 }).catch(() => {});
          const quedan = await pg.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].sort());
          ok(`${nombre}: ${r} borra la sesión vieja del admin de klendar.app`, !quedan.some((k) => /admin/.test(k)), quedan.join(', '));
          ok(`${nombre}: …${r} sin tocar «Tu cuenta» ni el idioma`, quedan.includes(CLAVE_CUENTA) && quedan.includes('klendar_lang'), quedan.join(', '));
          await pg.evaluate(([a]) => { localStorage.setItem(a, '{"vieja":1}'); sessionStorage.setItem('kl_admin_login_nuevo', '1'); }, [CLAVE_ADMIN]);
        }
        ok(`${nombre}: sin errores`, !errores.length, errores.join(' | '));
        await ctx.close();
      }
      // b) Entrar con contraseña y segundo factor en el subdominio.
      {
        const { ctx, pg, estado, errores } = await abre(nav);
        // Las direcciones por las que pasa la pestaña (la barra).
        const visitas = [];
        pg.on('framenavigated', (f) => { if (f === pg.mainFrame() && /admin\.localhost/.test(f.url())) visitas.push(f.url()); });
        await pg.goto(`${ADMIN}/#/negocios`);
        await pg.waitForSelector('#login:not([hidden])');
        const logo = await pg.getAttribute('#login a.brand', 'href');
        ok(`${nombre}: el logo de «Entrar» lleva a la web pública`, logo === BASE, logo);
        // «¿Has olvidado la contraseña?»: la vuelta, por «Tu cuenta» de la web pública.
        await pg.fill('#email', 'admindom@example.com');
        await pg.click('#doReset');
        await pg.waitForFunction(() => document.querySelector('#toasts')?.textContent.trim(), null, { timeout: 8000 }).catch(() => {});
        ok(`${nombre}: recuperar vuelve a ${BASE}/cuenta/nueva-clave?destino=/admin`, estado.recover[0] === `${BASE}/cuenta/nueva-clave?destino=%2Fadmin`, String(estado.recover[0]));
        // Contraseña y código.
        await pg.fill('#password', 'buena');
        await pg.click('#doLogin');
        await pg.waitForSelector('#mfa:not([hidden]) #mfaCode');
        ok(`${nombre}: tras la contraseña, el código de 6 cifras`, await pg.isVisible('#mfaCode'));
        await pg.fill('#mfaCode', '000000');
        await pg.waitForFunction(() => document.querySelector('#mfaErr')?.textContent.trim(), null, { timeout: 8000 }).catch(() => {});
        ok(`${nombre}: un código malo no vale`, /incorrecto/i.test(await pg.textContent('#mfaErr')) && await pg.isHidden('#app'));
        await pg.fill('#mfaCode', '123456');
        await pg.waitForSelector('#app:not([hidden])');
        ok(`${nombre}: con el bueno, al admin (y al Resumen)`, (await pg.evaluate(() => location.hash)) === '#/resumen' && estado.verify.includes('123456'));
        const sesion = await pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, CLAVE_ADMIN);
        ok(`${nombre}: la sesión (aal2) se guarda en admin.localhost`, !!sesion && JSON.parse(Buffer.from(sesion.access_token.split('.')[1], 'base64url').toString()).aal === 'aal2');
        // «Confirma que eres tú»: contraseña con sesión aparte y confirm_identity.
        const antes = estado.password;
        const confirmado = pg.evaluate(() => window.confirmaIdentidad());
        await pg.waitForSelector('dialog[open] input[type="password"]');
        await pg.fill('dialog[open] input[type="password"]', 'mala');
        await pg.click('dialog[open] button[type="submit"]');
        await pg.waitForFunction(() => /no es correcta/.test(document.querySelector('#toasts')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
        ok(`${nombre}: «Confirma que eres tú» con la contraseña mala, no`, /no es correcta/.test(await pg.textContent('#toasts')) && !estado.confirm.length);
        await pg.waitForSelector('dialog[open] input[type="password"]');
        await pg.fill('dialog[open] input[type="password"]', 'buena');
        await pg.click('dialog[open] button[type="submit"]');
        ok(`${nombre}: «Confirma que eres tú» con la buena, sí`, await confirmado === true);
        ok(`${nombre}: …con su sesión aparte y confirm_identity de la del navegador`, estado.password - antes === 2 && estado.confirm[0] === 'cafe0000-0000-4000-8000-00000000ad01', `${estado.password - antes} ${estado.confirm}`);
        const sigue = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null')?.refresh_token, CLAVE_ADMIN);
        ok(`${nombre}: …y la del navegador sigue siendo la del segundo factor`, sigue === 'r-aal2', String(sigue));
        ok(`${nombre}: admin sin violaciones de CSP`, !(await cspDe(pg)).length, (await cspDe(pg)).join(' | '));
        // En klendar.app no queda nada del admin.
        await pg.goto(`${BASE}/privacidad`);
        const publica = await pg.evaluate(() => Object.keys(localStorage));
        ok(`${nombre}: en klendar.app, ni rastro de la sesión del admin`, !publica.some((k) => /admin/.test(k)), publica.join(', '));
        // En el subdominio, lo que no es admin, a la web pública.
        await pg.goto(`${ADMIN}/privacidad`);
        ok(`${nombre}: admin.localhost/privacidad → localhost/privacidad`, pg.url() === `${BASE}/privacidad`, pg.url());
        await pg.goto(`${ADMIN}/`);
        await pg.waitForSelector('#app:not([hidden])');
        ok(`${nombre}: admin.localhost/ es el admin, en la raíz`, new URL(pg.url()).pathname === '/', pg.url());
        ok(`${nombre}: en la barra nunca sale /admin`, !visitas.some((u) => new URL(u).pathname.startsWith('/admin')), visitas.join(' '));
        ok(`${nombre}: entrar sin errores`, !errores.length, errores.join(' | '));
        await ctx.close();
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
