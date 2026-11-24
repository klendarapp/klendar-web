// Dónde sale el recuadro de Turnstile y cuándo se quita (Iván, 18-11: en el
// admin, en la pantalla del código de 6 cifras, salía «Verifique que es un ser
// humano» abajo del todo de la página, pegado al borde y lejos del formulario).
//
//  1. Si Cloudflare pide marcarlo, sale JUNTO AL FORMULARIO que lo pide (justo
//     encima de su botón principal), no fijo abajo: el acceso del admin,
//     «Tu cuenta» (entrar), en móvil (360 px) y escritorio, claro y oscuro.
//  2. Sin nada que marcar (`interaction-only`), no se ve nada ni mueve nada.
//  3. Al dejar el formulario se quita (`turnstile.remove`): del acceso del
//     admin a la pantalla del código; de «Entrar» a «Crear cuenta» se quita el
//     de antes y se pone en el nuevo; en «Código por correo», al pasar al
//     código se va con «Enviar otro código».
//  4. Admin: tras entrar de nuevo (contraseña y código), siempre al Resumen
//     aunque la dirección traiga otra sección; con la sesión ya abierta
//     (recargar), la sección de la dirección.
//
// Turnstile simulado (aquí abajo: nada sale a Cloudflare) y la base simulada
// (tools/_web_con_datos.mjs y lo de Auth aquí): nada contra dev ni prod.
//
//   PW=<ruta a playwright> node tools/captcha_sitio_check.mjs
import { mkdirSync } from 'node:fs';
import { adminDe, playwright, REF, SUPA } from './_supabase_simulado.mjs';
import { webConDatos } from './_web_con_datos.mjs';

const { chromium } = playwright();
const web = await webConDatos({ puerto: Number(process.env.PORT || 9014) });
const BASE = web.BASE;
// El admin, en su host (admin.localhost; §4zzz-admindom).
const ADMIN = adminDe(BASE);
const OUT = process.env.OUT || 'tools/out';
mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m, extra = '') => { if (!c) { fallos++; console.log('FALLO:', m, extra); } else console.log('ok:', m); };

// ── Turnstile de mentira: `__TS.modo` = 'pasa' (se resuelve solo) o 'mirar'
// (pide marcar: un recuadro de 300 × 65 dentro de la caja).
const TURNSTILE = `(function () {
  var T = window.__TS || (window.__TS = { modo: 'pasa', log: [] });
  var w = {}; var n = 0;
  window.turnstile = {
    render: function (el, o) {
      var id = 'w' + (++n);
      var f = document.createElement('div');
      f.className = 'ts-falso';
      f.style.cssText = 'width:300px;height:0;overflow:hidden;box-sizing:border-box';
      el.appendChild(f);
      w[id] = { el: el, o: o, f: f };
      T.log.push(['render', id, o.appearance, o.theme]);
      var modo = T.modo;
      setTimeout(function () {
        if (!w[id]) return;
        if (modo === 'mirar') {
          o['before-interactive-callback'] && o['before-interactive-callback']();
          f.style.height = '65px'; f.style.border = '1px solid #888'; f.textContent = 'Verifique que es un ser humano';
        } else o.callback('TOKEN-' + id);
      }, 30);
      return id;
    },
    reset: function (id) {
      T.log.push(['reset', id]);
      setTimeout(function () { if (w[id] && !w[id].f.textContent) w[id].o.callback('TOKEN-' + id + '-' + Date.now()); }, 30);
    },
    remove: function (id) { T.log.push(['remove', id]); if (w[id]) { w[id].f.remove(); delete w[id]; } },
    marca: function () {
      Object.keys(w).forEach(function (id) {
        var x = w[id];
        if (!x.f.textContent) return;
        x.f.style.height = '0'; x.f.style.border = '0'; x.f.textContent = '';
        x.o['after-interactive-callback'] && x.o['after-interactive-callback']();
        x.o.callback('TOKEN-' + id);
      });
    },
    vivos: function () { return Object.keys(w); },
  };
})();`;

// ── Auth simulado: un administrador con 2FA (o sin, con «Ahora no»).
const U = '0e7717e0-0000-4000-8000-00000000c491';
const F = '0e7717e0-0000-4000-8000-00000000f491';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (aal) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal, session_id: 'cafe0000-0000-4000-8000-000000000491', amr: [{ method: aal === 'aal2' ? 'totp' : 'password', timestamp: Math.floor(Date.now() / 1000) }] })}.firmaa`;
const FACTOR = { id: F, factor_type: 'totp', status: 'verified', friendly_name: 'Móvil', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
const usuario = (con2fa) => ({ id: U, aud: 'authenticated', role: 'authenticated', email: 'captcha@example.com', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [{ provider: 'email' }], factors: con2fa ? [FACTOR] : [] });
const tokens = (con2fa, aal) => ({ access_token: jwt(aal), refresh_token: `r-${aal}`, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: usuario(con2fa) });

async function abre(nav, { vp = { width: 1280, height: 800 }, esquema = 'light', modo = 'pasa', con2fa = true, luego = false } = {}) {
  const ctx = await nav.newContext({ viewport: vp, colorScheme: esquema, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([m, l]) => {
    window.__TS = { modo: m, log: [] };
    if (l) { try { sessionStorage.setItem('kl_admin_mfa_luego', '1'); } catch { /* */ } }
  }, [modo, luego]);
  await ctx.route('**/config.js*', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: `window.KLENDAR_ENV = { name: 'prueba', url: '${SUPA}', key: 'x', turnstile: 'clave-de-prueba' };`,
  }));
  await ctx.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({ contentType: 'text/javascript', body: TURNSTILE }));
  const estado = { password: [], otp: [] };
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    const aal = (() => { try { return JSON.parse(Buffer.from(String(req.headers().authorization).split('.')[1], 'base64url').toString()).aal; } catch { return null; } })();
    if (p === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') { estado.password.push(body); return json(tokens(con2fa, 'aal1')); }
    if (p === '/auth/v1/otp') { estado.otp.push(body); return json({}); }
    if (p === '/auth/v1/user' && aal) return json(usuario(con2fa));
    if (p === `/auth/v1/factors/${F}/challenge`) return json({ id: 'reto-1', type: 'totp', expires_at: 4102444800 });
    if (p === `/auth/v1/factors/${F}/verify`) return body.code === '123456' ? json(tokens(con2fa, 'aal2')) : json({ code: 422, error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' }, 422);
    if (p === '/rest/v1/rpc/admin_mfa_status') return json({ admin: true, required: false, enrolled: con2fa, aal: aal || 'aal1' });
    if (p === '/rest/v1/rpc/is_admin') return json(true);
    if (p.startsWith('/rest/v1/rpc/admin_')) return json(null);
    return route.fallback();
  });
  if (ctx.routeWebSocket) await ctx.routeWebSocket(new RegExp(`^wss://${REF}\\.supabase\\.co/realtime/`), () => { /* mudo */ });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.setDefaultTimeout(15000);
  return { ctx, pg, estado, errores };
}

/** Dónde ha quedado el recuadro respecto al formulario y al botón. */
async function mide(pg, form, boton) {
  return pg.evaluate(([f, b]) => {
    const caja = document.getElementById('kl-captcha');
    const r = (el) => { const x = el.getBoundingClientRect(); return { top: x.top, bottom: x.bottom, left: x.left, right: x.right, h: x.height }; };
    return {
      hay: !!caja,
      cajas: document.querySelectorAll('#kl-captcha').length,
      fija: caja ? getComputedStyle(caja).position === 'fixed' : null,
      dentro: caja ? !!caja.closest(f) : false,
      caja: caja ? r(caja) : null,
      boton: r(document.querySelector(b)),
      ancho: innerWidth,
      scroll: document.scrollingElement.scrollWidth,
    };
  }, [form, boton]);
}
const vivos = (pg) => pg.evaluate(() => window.turnstile?.vivos() || []);
const log = (pg) => pg.evaluate(() => window.__TS.log);

const nav = await chromium.launch();

// ── 1. El recuadro junto al formulario: admin y «Tu cuenta», móvil y escritorio, claro y oscuro.
for (const [t, vp] of [['movil', { width: 360, height: 740 }], ['escritorio', { width: 1280, height: 800 }]]) {
  for (const esquema of ['light', 'dark']) {
    const n = `${t}/${esquema}`;
    {
      const { ctx, pg, errores } = await abre(nav, { vp, esquema, modo: 'mirar' });
      await pg.goto(`${ADMIN}/condiciones`);
      await pg.waitForSelector('#login .kl-captcha-sitio .ts-falso:has-text("humano")');
      const m = await mide(pg, '#login', '#doLogin');
      ok(m.dentro && !m.fija, `${n} admin: el recuadro va dentro del acceso, no fijo abajo`, JSON.stringify(m));
      ok(m.caja.bottom <= m.boton.top + 1 && m.boton.top - m.caja.bottom < 40, `${n} admin: justo encima de «Entrar»`, JSON.stringify(m));
      ok(m.caja.left >= 0 && m.caja.right <= m.ancho && m.scroll <= m.ancho, `${n} admin: cabe en la pantalla, sin barra de lado`, JSON.stringify(m));
      ok((await log(pg)).some((x) => x[0] === 'render' && x[2] === 'interaction-only' && x[3] === 'auto'), `${n} admin: interaction-only y tema del sistema`);
      await pg.screenshot({ path: `${OUT}/web-captcha-admin-${t}-${esquema}.png` });
      ok(errores.length === 0, `${n} admin: sin errores JS`, errores.join(' | '));
      await ctx.close();
    }
    {
      const { ctx, pg, errores } = await abre(nav, { vp, esquema, modo: 'mirar' });
      await pg.goto(`${BASE}/cuenta/entrar`);
      await pg.waitForSelector('#f .kl-captcha-sitio .ts-falso:has-text("humano")');
      const m = await mide(pg, '#f', '#f button[type=submit]');
      ok(m.dentro && !m.fija, `${n} «Tu cuenta» entrar: dentro del formulario, no fijo abajo`, JSON.stringify(m));
      ok(m.caja.bottom <= m.boton.top + 1 && m.boton.top - m.caja.bottom < 40, `${n} «Tu cuenta» entrar: justo encima de «Entrar»`, JSON.stringify(m));
      ok(m.caja.left >= 0 && m.caja.right <= m.ancho && m.scroll <= m.ancho, `${n} «Tu cuenta» entrar: cabe, sin barra de lado`, JSON.stringify(m));
      await pg.screenshot({ path: `${OUT}/web-captcha-cuenta-${t}-${esquema}.png` });
      ok(errores.length === 0, `${n} «Tu cuenta»: sin errores JS`, errores.join(' | '));
      await ctx.close();
    }
  }
}

// ── 2. Sin nada que marcar: no se ve nada ni mueve el botón.
{
  const { ctx, pg } = await abre(nav, { vp: { width: 360, height: 740 }, modo: 'pasa' });
  await pg.goto(`${BASE}/cuenta/recuperar`);
  await pg.waitForFunction(() => document.querySelector('#f .kl-captcha-sitio #kl-captcha'));
  await pg.waitForTimeout(100);
  const d = await pg.evaluate(() => {
    const caja = document.getElementById('kl-captcha');
    const label = document.querySelector('#f label').getBoundingClientRect();
    const boton = document.querySelector('#f button[type=submit]').getBoundingClientRect();
    return { alto: caja.getBoundingClientRect().height, hueco: boton.top - label.bottom, gap: parseFloat(getComputedStyle(document.querySelector('#f')).rowGap) };
  });
  ok(d.alto === 0 && Math.abs(d.hueco - d.gap) < 1, `recuperar (interaction-only): no se ve ni ocupa nada ${JSON.stringify(d)}`);
  await ctx.close();
}

// ── 3. Se quita al dejar el formulario y se pone en el nuevo.
{
  const { ctx, pg, estado } = await abre(nav, { modo: 'pasa' });
  await pg.goto(`${BASE}/cuenta/entrar`);
  await pg.waitForFunction(() => document.querySelector('#f .kl-captcha-sitio #kl-captcha'));
  const [antes] = await vivos(pg);
  await pg.click('a[href^="/cuenta/registro"]');
  await pg.waitForSelector('#f [name=birth]');
  await pg.waitForFunction((a) => window.turnstile.vivos().length === 1 && window.turnstile.vivos()[0] !== a, antes);
  const l = await log(pg);
  ok(l.some((x) => x[0] === 'remove' && x[1] === antes), `entrar → crear cuenta: el de «Entrar» se quita (${antes})`, JSON.stringify(l));
  ok(await pg.evaluate(() => document.querySelectorAll('#kl-captcha').length === 1 && !!document.querySelector('#f .kl-captcha-sitio #kl-captcha')),
    'crear cuenta: uno solo, en su formulario');
  // Código por correo: al pasar al código, el recuadro se va con «Enviar otro código».
  await pg.goto(`${BASE}/cuenta/codigo-correo`);
  await pg.waitForFunction(() => document.querySelector('#f1 .kl-captcha-sitio #kl-captcha'));
  await pg.fill('#f1 [name=email]', 'captcha@example.com');
  await pg.click('#f1 button[type=submit]');
  await pg.waitForSelector('#f2:not([hidden])');
  await pg.waitForFunction(() => document.querySelector('#f2 .kl-captcha-sitio #kl-captcha'));
  ok(estado.otp.length === 1 && /^TOKEN-/.test(estado.otp[0].gotrue_meta_security?.captcha_token || ''), 'código por correo: lleva el token', JSON.stringify(estado.otp));
  ok((await vivos(pg)).length === 1, 'código por correo: en el paso del código, uno solo y junto a «Enviar otro código»');
  await ctx.close();
}

// ── 4. Admin: del acceso al código (se quita) y, tras entrar, al Resumen.
{
  const { ctx, pg, estado, errores } = await abre(nav, { modo: 'mirar' });
  await pg.goto(`${ADMIN}/condiciones`);
  await pg.waitForSelector('#login .ts-falso:has-text("humano")');
  await pg.evaluate(() => window.turnstile.marca());  // la persona lo marca
  ok(await pg.evaluate(() => document.querySelector('#login .kl-captcha-sitio').style.position === 'absolute'), 'admin: marcado, el hueco deja de ocupar sitio');
  await pg.fill('#email', 'captcha@example.com');
  await pg.fill('#password', 'Prueba-Captcha-2026');
  await pg.click('#doLogin');
  await pg.waitForSelector('#mfaCode');
  ok(estado.password.length === 1 && /^TOKEN-/.test(estado.password[0].gotrue_meta_security?.captcha_token || ''), 'admin: entrar lleva el token', JSON.stringify(estado.password));
  const m = await pg.evaluate(() => ({ cajas: document.querySelectorAll('#kl-captcha, .ts-falso').length, vivos: window.turnstile.vivos() }));
  ok(m.cajas === 0 && m.vivos.length === 0, `admin, pantalla del código: ni rastro de Turnstile ${JSON.stringify(m)}`);
  ok((await log(pg)).some((x) => x[0] === 'remove'), 'admin: turnstile.remove al pasar al código');
  await pg.screenshot({ path: `${OUT}/web-captcha-admin-codigo.png` });
  await pg.fill('#mfaCode', '123456');
  await pg.waitForFunction(() => !document.querySelector('#app').hidden);
  const dir = () => pg.evaluate(() => location.pathname + location.search + location.hash);
  ok(await dir() === '/', `admin: tras entrar (con 2FA), al Resumen (/) aunque la dirección dijera /condiciones (${await dir()})`);
  // Con la sesión abierta, la sección de la dirección.
  await pg.goto(`${ADMIN}/condiciones`);
  await pg.waitForFunction(() => !document.querySelector('#app').hidden);
  await pg.reload();
  await pg.waitForFunction(() => !document.querySelector('#app').hidden);
  await pg.waitForTimeout(300);
  ok(await dir() === '/condiciones', `admin: al recargar con la sesión abierta, se queda en /condiciones (${await dir()})`);
  // Cerrar sesión: el acceso vuelve con su Turnstile.
  await pg.evaluate(() => document.querySelector('#logout').click());
  await pg.waitForSelector('#login:not([hidden]) .kl-captcha-sitio #kl-captcha', { state: 'attached' });
  ok((await vivos(pg)).length === 1, 'admin: al volver al acceso, Turnstile otra vez en su hueco');
  ok(errores.length === 0, 'admin: sin errores JS', errores.join(' | '));
  await ctx.close();
}
{
  // Sin 2FA («Ahora no» en esta pestaña): también al Resumen.
  const { ctx, pg } = await abre(nav, { modo: 'pasa', con2fa: false, luego: true });
  await pg.goto(`${ADMIN}/condiciones`);
  await pg.waitForSelector('#login:not([hidden]) #kl-captcha', { state: 'attached' });
  await pg.fill('#email', 'captcha@example.com');
  await pg.fill('#password', 'Prueba-Captcha-2026');
  await pg.click('#doLogin');
  await pg.waitForFunction(() => !document.querySelector('#app').hidden);
  ok(await pg.evaluate(() => location.pathname + location.hash) === '/', 'admin sin 2FA: tras entrar, al Resumen (/)');
  ok((await vivos(pg)).length === 0, 'admin sin 2FA: Turnstile quitado en el panel');
  await ctx.close();
}

await nav.close();
await web.cierra();
console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
