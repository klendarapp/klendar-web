// El admin en su propio subdominio, admin.klendar.app (Iván, 23-11; RUNBOOK
// §4zzz-admindom). Sin navegador (unos 0,5 s) y en Chromium y WebKit con la
// base simulada (unos 30 s):
//
//  1. Qué hace cada host (functions/_lib/admin.js y el middleware de verdad):
//     klendar.app/admin → página puente; /admin/… → 301 al subdominio; en
//     admin.klendar.app, `/` → /admin y lo que no es admin → klendar.app.
//  2. Las cabeceras: la CSP del admin, igual o más estricta (sin Mapbox ni
//     WebSocket, `frame-ancestors 'none'`, `Cross-Origin-Opener-Policy`), y la
//     de la página puente.
//  3. En el navegador (localhost hace de klendar.app y admin.localhost de
//     admin.klendar.app, como tools/serve_dev.mjs):
//     - la puente lleva `?…` y `#/…` al subdominio y borra la sesión vieja del
//       admin de klendar.app sin tocar la de «Tu cuenta» ni el idioma;
//     - entrar con contraseña y el segundo factor (código de 6 cifras) en
//       admin.localhost: la sesión se guarda allí y no en localhost;
//     - «Confirma que eres tú» (contraseña con sesión aparte y
//       `confirm_identity`);
//     - «¿Has olvidado la contraseña?» vuelve por «Tu cuenta» de la web
//       pública (`/cuenta/nueva-clave?destino=/admin`), que sí está en las
//       URL de vuelta de Supabase;
//     - el logo de «Entrar» lleva a la web pública; sin violaciones de CSP.
//
//   PW=<ruta a playwright> node tools/admin_dominio_check.mjs
//   node tools/admin_dominio_check.mjs --sin-navegador
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideHost, origenAdmin, origenPublico } from '../functions/_lib/admin.js';
import { CSP_PUENTE } from '../functions/_lib/csp.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lee = (f) => readFileSync(path.join(RAIZ, f), 'utf8');
let fallos = 0;
const ok = (nombre, c, extra = '') => {
  if (c) { if (!process.env.CALLADO) console.log(`  ok  ${nombre}`); } else { fallos += 1; console.log(`  MAL ${nombre}${extra ? `\n      ${extra}` : ''}`); }
};

// ── 1. Cada host ────────────────────────────────────────────────────────────
const d = (u) => decideHost(new URL(u));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const CASOS = [
  ['https://klendar.app/admin', { puente: true }],
  ['https://www.klendar.app/admin', { puente: true }],
  ['https://klendar.app/admin?x=1', { puente: true }],
  ['https://klendar.app/admin/carta?n=3', { salto: 'https://admin.klendar.app/admin/carta?n=3' }],
  ['https://klendar.app/admin/puente', { salto: 'https://admin.klendar.app/admin' }],
  ['https://klendar-web.pages.dev/admin/x', { salto: 'https://admin.klendar.app/admin/x' }],
  ['https://klendar.app/administracion', null],
  ['https://klendar.app/privacidad', null],
  ['https://klendar.app/', null],
  ['https://admin.klendar.app/admin', null],
  ['https://admin.klendar.app/admin/carta', null],
  ['https://admin.klendar.app/', { salto: 'https://admin.klendar.app/admin' }],
  ['https://admin.klendar.app/?inactividad=20', { salto: 'https://admin.klendar.app/admin?inactividad=20' }],
  ['https://admin.klendar.app/admin/puente', { salto: 'https://admin.klendar.app/admin' }],
  ['https://admin.klendar.app/privacidad?x=1', { salto: 'https://klendar.app/privacidad?x=1' }],
  ['https://admin.klendar.app/o/abc', { salto: 'https://klendar.app/o/abc' }],
  ['https://admin.klendar.app/cuenta/nueva-clave?destino=%2Fadmin', { salto: 'https://klendar.app/cuenta/nueva-clave?destino=%2Fadmin' }],
  ['https://admin.klendar.app/panel', { salto: 'https://klendar.app/panel' }],
  ['http://localhost:8788/admin', { puente: true }],
  ['http://localhost:8788/admin/carta', { salto: 'http://admin.localhost:8788/admin/carta' }],
  ['http://admin.localhost:8788/privacidad', { salto: 'http://localhost:8788/privacidad' }],
  ['http://admin.localhost:8788/admin', null],
  // Un host que solo empieza por «admin.» no es el del admin.
  ['https://admin.klendar.app.evil.example/admin', { puente: true }],
  ['https://admin.klendar-web.pages.dev/admin/x', { salto: 'https://admin.klendar.app/admin/x' }],
];
for (const [u, esperado] of CASOS) ok(`decideHost ${u}`, igual(d(u), esperado), `${JSON.stringify(d(u))} ≠ ${JSON.stringify(esperado)}`);
ok('origenAdmin de klendar.app', origenAdmin(new URL('https://klendar.app/x')) === 'https://admin.klendar.app');
ok('origenPublico de admin.klendar.app', origenPublico(new URL('https://admin.klendar.app/admin')) === 'https://klendar.app');
ok('origenPublico de admin.localhost', origenPublico(new URL('http://admin.localhost:9/admin')) === 'http://localhost:9');

// El middleware de verdad.
{
  const { onRequest } = await import('../functions/_middleware.js');
  const pedidos = [];
  const pide = async (u, metodo = 'GET') => onRequest({
    request: new Request(u, { method: metodo }),
    env: { ASSETS: { fetch: async (r) => { pedidos.push(new URL(r.url || r).pathname); return new Response('<!doctype html><p>puente', { headers: { 'content-type': 'text/html' } }); } } },
    next: async () => new Response(metodo === 'HEAD' ? null : '<!doctype html><p>admin', { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'self'; script-src 'self'" } }),
  });
  const p = await pide('https://klendar.app/admin');
  ok('middleware: klendar.app/admin → la puente (200)', p.status === 200 && pedidos.at(-1) === '/admin/puente' && /puente/.test(await p.text()));
  ok('middleware: la puente con su CSP', p.headers.get('content-security-policy') === CSP_PUENTE);
  ok('middleware: la puente sin caché ni buscadores', /no-store/.test(p.headers.get('cache-control')) && /noindex/.test(p.headers.get('x-robots-tag')));
  ok('middleware: la puente no se deja enmarcar', p.headers.get('x-frame-options') === 'DENY' && /frame-ancestors 'none'/.test(CSP_PUENTE));
  ok('middleware: la puente no manda la dirección a nadie', p.headers.get('referrer-policy') === 'no-referrer');
  const h = await pide('https://klendar.app/admin', 'HEAD');
  ok('middleware: HEAD de la puente, sin cuerpo', h.status === 200 && h.body === null);
  for (const [u, a] of [
    ['https://klendar.app/admin/', 'https://admin.klendar.app/admin'],
    ['https://klendar.app/admin/carta.html?n=2', 'https://admin.klendar.app/admin/carta?n=2'],
    ['https://klendar.app/admin.html', 'https://admin.klendar.app/admin'],
    ['https://www.klendar.app/admin/', 'https://admin.klendar.app/admin'],
    ['https://admin.klendar.app/', 'https://admin.klendar.app/admin'],
    ['https://admin.klendar.app/admin/', 'https://admin.klendar.app/admin'],
    ['https://admin.klendar.app/admin.html', 'https://admin.klendar.app/admin'],
    ['https://admin.klendar.app/privacidad/', 'https://klendar.app/privacidad'],
    ['https://admin.klendar.app/explorar?que=sitios', 'https://klendar.app/explorar?que=sitios'],
  ]) {
    const r = await pide(u);
    ok(`middleware: ${u} → 301 ${a}`, r.status === 301 && r.headers.get('location') === a, `${r.status} ${r.headers.get('location')}`);
  }
  const ad = await pide('https://admin.klendar.app/admin');
  ok('middleware: admin.klendar.app/admin se sirve tal cual', ad.status === 200 && /admin/.test(await ad.text()));
  ok('middleware: …con su CSP y sin nonce', ad.headers.get('content-security-policy') === "default-src 'self'; script-src 'self'");
  ok('middleware: …sin dejarse enmarcar', ad.headers.get('x-frame-options') === 'DENY');
  const pub = await pide('https://klendar.app/privacidad');
  ok('middleware: lo público en klendar.app, igual que antes', pub.status === 200);
}

// ── 2. Cabeceras (`_headers`) ───────────────────────────────────────────────
{
  const cab = lee('_headers');
  for (const z of ['/admin', '/admin/*']) {
    const bloque = new RegExp(`^${z.replace(/[*]/g, '\\*')}\\r?\\n((?: {2}.*\\r?\\n)+)`, 'm').exec(cab)?.[1] || '';
    const csp = /^ {2}Content-Security-Policy: (.+)$/m.exec(bloque)?.[1] || '';
    ok(`${z}: CSP con frame-ancestors 'none'`, /frame-ancestors 'none'/.test(csp), csp);
    ok(`${z}: CSP con default-src 'self', object-src 'none', base-uri 'self' y form-action 'self'`, ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].every((x) => csp.includes(x)));
    ok(`${z}: script-src solo 'self' y Turnstile`, /script-src 'self' https:\/\/challenges\.cloudflare\.com;/.test(csp), csp);
    ok(`${z}: sin Mapbox ni WebSocket (el admin no los usa)`, !/mapbox|wss:/.test(csp), csp);
    ok(`${z}: Cross-Origin-Opener-Policy: same-origin`, /^ {2}Cross-Origin-Opener-Policy: same-origin$/m.test(bloque));
    ok(`${z}: sin caché ni buscadores`, /no-store/.test(bloque) && /X-Robots-Tag: noindex, nofollow/.test(bloque));
  }
  ok('CSP_PUENTE: nada por defecto y solo sus scripts', /^default-src 'none'; script-src 'self';/.test(CSP_PUENTE));
  const rutas = JSON.parse(lee('_routes.json'));
  ok('_routes.json: /admin pasa por el middleware', !rutas.exclude.some((r) => r === '/admin' || r === '/admin/*'));
  ok('_routes.json: admin/puente.js, estático', rutas.exclude.includes('/admin/puente.js'));
  const js = lee('admin/admin.js');
  ok('admin.js: la contraseña nueva, por «Tu cuenta» de la web pública', /redirectTo: `\$\{WEB\}\/cuenta\/nueva-clave\?destino=%2Fadmin`/.test(js) && !/location\.origin\}\/cuenta/.test(js));
  ok('admin.js: sin klendar.app/admin a mano', !/https:\/\/klendar\.app\/admin/.test(js));
  ok('admin.js: admin.localhost cuenta como local', /\(admin\\\.\)\?localhost/.test(js));
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
      // a) La puente: klendar.app/admin?…#/… → admin.klendar.app, y fuera la sesión vieja.
      {
        const { ctx, pg, errores } = await abre(nav);
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
        await pg.goto(`${BASE}/admin?inactividad=30#/negocios?status=pending`);
        await pg.waitForURL((u) => u.host === new URL(ADMIN).host, { timeout: 10000 }).catch(() => {});
        const u = new URL(pg.url());
        ok(`${nombre}: la puente lleva al subdominio`, u.origin === ADMIN && u.pathname === '/admin', pg.url());
        ok(`${nombre}: …con su ?… y su #/…`, u.search === '?inactividad=30' && u.hash === '#/negocios?status=pending', pg.url());
        await pg.waitForSelector('#login:not([hidden])');
        ok(`${nombre}: en el subdominio, sin sesión: «Entrar»`, await pg.isVisible('#login'));
        await pg.goto(`${BASE}/privacidad`);
        const quedan = await pg.evaluate(() => Object.keys(localStorage).sort());
        ok(`${nombre}: la puente borra la sesión vieja del admin de klendar.app`, !quedan.some((k) => /admin/.test(k)), quedan.join(', '));
        ok(`${nombre}: …y no toca «Tu cuenta» ni el idioma`, quedan.includes(CLAVE_CUENTA) && quedan.includes('klendar_lang'), quedan.join(', '));
        ok(`${nombre}: puente y admin sin errores`, !errores.length, errores.join(' | '));
        await ctx.close();
      }
      // b) Entrar con contraseña y segundo factor en el subdominio.
      {
        const { ctx, pg, estado, errores } = await abre(nav);
        await pg.goto(`${ADMIN}/admin#/negocios`);
        await pg.waitForSelector('#login:not([hidden])');
        const logo = await pg.getAttribute('#login a.brand', 'href');
        ok(`${nombre}: el logo de «Entrar» lleva a la web pública`, logo === `${BASE}/`, logo);
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
        ok(`${nombre}: admin.localhost/ → /admin`, pg.url().startsWith(`${ADMIN}/admin`), pg.url());
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
