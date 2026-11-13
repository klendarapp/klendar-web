// Cambiar el correo o la contraseña con 2FA y «¿Has olvidado la contraseña?» de
// un administrador con 2FA (Iván, 6-11). Supabase contestado aquí, como lo hace
// de verdad (app: tool/cambio_2fa_smoke.py lo comprueba contra dev): sin `aal2`,
// cambiar correo o contraseña da 401 `insufficient_aal`.
//
//  1. El enlace de recuperar (?destino=/admin): pide el código, un código malo
//     no vale, con el bueno guarda (con aal2) y vuelve al admin. Cancelar no
//     guarda nada.
//  2. Sin 2FA: ni rastro del código.
//  3. Ajustes › Cambiar correo: «Confirma que eres tú», el código y el correo.
//  4. Ajustes › contraseña: igual.
//  5. Si Supabase responde `insufficient_aal`: el mensaje que dice qué hacer.
//
//   SUPABASE_BLOQUEADO=1 PORT=8874 node tools/serve_dev.mjs &
//   BASE=http://localhost:8874 PW=<ruta a playwright> node tools/dos_pasos_check.mjs
import { playwright, REF, SUPA, realtimeMudo, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();
const BASE = process.env.BASE || 'http://localhost:8874';
await servidorSeguro(BASE);

const U = '0e7717e0-0000-4000-8000-0000000097d5';
const F = '0e7717e0-0000-4000-8000-00000000f001';
const CODIGO = '123456';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (aal, amr = 'password') => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal, session_id: 'cafe0000-0000-4000-8000-000000000001', amr: [{ method: amr, timestamp: Math.floor(Date.now() / 1000) }] })}.firmaa`;
const FACTOR = { id: F, factor_type: 'totp', status: 'verified', friendly_name: 'Móvil', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
const usuario = (con2fa) => ({ id: U, aud: 'authenticated', role: 'authenticated', email: 'admin2fa@example.com', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [{ provider: 'email' }], factors: con2fa ? [FACTOR] : [] });
const tokens = (con2fa, aal, amr) => ({ access_token: jwt(aal, amr), refresh_token: `r-${aal}`, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: usuario(con2fa) });
const TOKEN_HASH = 'pruebaDeTokenHash1234567890';

let fallos = 0;
function ok(cond, nombre, extra = '') {
  if (cond) console.log(`  ok  ${nombre}`);
  else { fallos += 1; console.log(`  MAL ${nombre} ${extra}`); }
}

async function abre(nav, { con2fa = true, sesion = false, rechaza = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { if (v) { try { localStorage.setItem(k, v); } catch { /* */ } } },
    [`sb-${REF}-auth-token`, sesion ? JSON.stringify(tokens(con2fa, 'aal1')) : '']);
  const estado = { put: [], verify: [], retos: 0 };
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (url.pathname.startsWith('/auth/v1/')) {
      const que = url.pathname.slice('/auth/v1/'.length);
      if (que === 'settings') return json({ external: { email: true } });
      if (que === 'token') return json(tokens(con2fa, 'aal1', 'password'));
      if (que === 'verify') return json(tokens(con2fa, 'aal1', body.type === 'recovery' ? 'otp' : 'otp'));
      if (que === 'logout') return json({});
      if (que === `factors/${F}/challenge`) { estado.retos += 1; return json({ id: `reto-${estado.retos}`, type: 'totp', expires_at: 4102444800 }); }
      if (que === `factors/${F}/verify`) {
        estado.verify.push(body);
        if (body.code !== CODIGO) return json({ code: 422, error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' }, 422);
        return json(tokens(con2fa, 'aal2', 'totp'));
      }
      if (que === 'user' && req.method() === 'PUT') {
        const aal = JSON.parse(Buffer.from(String(req.headers().authorization).split('.')[1], 'base64url').toString()).aal;
        estado.put.push({ body, aal });
        if ((con2fa && aal !== 'aal2') || rechaza) {
          return json({ code: 401, error_code: 'insufficient_aal', msg: 'AAL2 session is required to update email or password when MFA is enabled.' }, 401);
        }
        return json({ ...usuario(con2fa), new_email: body.email });
      }
      if (que === 'user') return json(usuario(rechaza ? false : con2fa));
      return json({});
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.slice('/rest/v1/rpc/'.length);
      if (fn === 'my_consents') return json({ terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, has_birth_date: true, name_asked_at: null, terms_current: '1' });
      if (fn === 'my_tastes') return json({ c: [], city: null });
      if (fn === 'my_auth_methods') return json({ has_password: true });
      if (fn === 'my_email_status') return json({ email: 'admin2fa@example.com' });
      if (fn === 'confirm_identity') return json(null);
      return json(null);
    }
    if (url.pathname.startsWith('/rest/v1/profiles')) {
      const fila = { id: U, display_name: 'Ana', avatar_url: null, birth_date: '1990-01-01', locale: null };
      return json(req.headers().accept?.includes('vnd.pgrst.object') ? fila : [fila]);
    }
    if (url.pathname.startsWith('/rest/v1/')) return json(req.headers().accept?.includes('vnd.pgrst.object') ? {} : []);
    return json({});
  });
  await realtimeMudo(ctx);
  const p = await ctx.newPage();
  const errores = [];
  // Al navegar con una transición de vista a medias (no es de esto).
  p.on('pageerror', (e) => { if (!/Transition was aborted/.test(e.message)) errores.push(e.message); });
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

async function clavesNuevas(p) {
  await p.waitForSelector('[name=p1]');
  await p.fill('[name=p1]', 'clave-nueva-123');
  await p.click('#f button[type=submit]');
}

const DIALOGO = 'dialog[aria-labelledby=dos-pasos-t]';
async function escribeCodigo(p, codigo) {
  await p.fill(`${DIALOGO} [name=codigo]`, codigo);
  await p.click(`${DIALOGO} button[type=submit]`);
}

for (const [motor, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  console.log(motor);
  const nav = await tipo.launch();

  // 1. El enlace de recuperar de un administrador con 2FA.
  {
    const { ctx, p, estado, errores } = await abre(nav);
    await p.goto(`${BASE}/cuenta/nueva-clave?destino=%2Fadmin%2F&token_hash=${TOKEN_HASH}&type=recovery`);
    await clavesNuevas(p);
    await p.waitForSelector(DIALOGO);
    ok(estado.put.length === 0, `${motor} recuperar: sin el código no se intenta guardar`);
    await escribeCodigo(p, '000000');
    await p.waitForFunction((d) => document.querySelector(`${d} .err`)?.textContent.trim(), DIALOGO);
    ok(/no vale o ha caducado/.test(await p.textContent(`${DIALOGO} .err`)), `${motor} recuperar: un código malo lo dice`);
    ok(estado.put.length === 0, `${motor} recuperar: un código malo no guarda`);
    await escribeCodigo(p, CODIGO);
    await p.waitForFunction(() => location.pathname === '/admin');
    const put = estado.put.at(-1);
    ok(put?.aal === 'aal2' && put?.body.password === 'clave-nueva-123', `${motor} recuperar: guarda con aal2 y vuelve al admin`, JSON.stringify(put));
    ok(errores.length === 0, `${motor} recuperar: sin errores`, errores.join(' | '));
    await ctx.close();
  }
  // Cancelar el código: no guarda y se puede volver a intentar.
  {
    const { ctx, p, estado } = await abre(nav);
    await p.goto(`${BASE}/cuenta/nueva-clave?destino=%2Fadmin%2F&token_hash=${TOKEN_HASH}&type=recovery`);
    await clavesNuevas(p);
    await p.waitForSelector(DIALOGO);
    await p.click(`${DIALOGO} button[value=no]`);
    await p.waitForSelector(DIALOGO, { state: 'detached' });
    ok(estado.put.length === 0 && new URL(p.url()).pathname === '/cuenta/nueva-clave', `${motor} recuperar: cancelar no guarda`);
    await ctx.close();
  }
  // 2. Sin 2FA, como siempre.
  {
    const { ctx, p, estado } = await abre(nav, { con2fa: false });
    await p.goto(`${BASE}/cuenta/nueva-clave?token_hash=${TOKEN_HASH}&type=recovery`);
    await clavesNuevas(p);
    await p.waitForFunction(() => location.pathname === '/cuenta');
    ok(estado.retos === 0 && estado.put.at(-1)?.aal === 'aal1', `${motor} sin 2FA: ni rastro del código`);
    await ctx.close();
  }
  // 3. Cambiar correo en Ajustes.
  {
    const { ctx, p, estado, errores } = await abre(nav, { sesion: true });
    await p.goto(`${BASE}/cuenta/ajustes`);
    await p.click('#correo-cambiar');
    await p.fill('dialog.identidad [name=clave]', 'la-de-ahora');
    await p.click('dialog.identidad button[type=submit]');
    await p.waitForSelector(DIALOGO);
    await escribeCodigo(p, CODIGO);
    await p.waitForSelector('dialog[aria-labelledby=correo-nuevo-t]');
    await p.fill('dialog[aria-labelledby=correo-nuevo-t] [name=correo]', 'nuevo@example.com');
    await p.click('dialog[aria-labelledby=correo-nuevo-t] button[type=submit]');
    await p.waitForSelector('dialog[aria-labelledby=correo-codigos-t]');
    const put = estado.put.at(-1);
    ok(put?.aal === 'aal2' && put?.body.email === 'nuevo@example.com', `${motor} cambiar correo: con aal2 y a los códigos`, JSON.stringify(put));
    ok(errores.length === 0, `${motor} cambiar correo: sin errores`, errores.join(' | '));
    await ctx.close();
  }
  // 4. Cambiar la contraseña en Ajustes.
  {
    const { ctx, p, estado } = await abre(nav, { sesion: true });
    await p.goto(`${BASE}/cuenta/nueva-clave?siguiente=ajustes`);
    await clavesNuevas(p);
    await p.fill('dialog.identidad [name=clave]', 'la-de-ahora');
    await p.click('dialog.identidad button[type=submit]');
    await p.waitForSelector(DIALOGO);
    await escribeCodigo(p, CODIGO);
    await p.waitForFunction(() => location.pathname === '/cuenta/ajustes');
    const put = estado.put.at(-1);
    ok(put?.aal === 'aal2' && put?.body.password === 'clave-nueva-123', `${motor} cambiar contraseña: con aal2`, JSON.stringify(put));
    await ctx.close();
  }
  // 5. Si aun así Supabase dice que no: el mensaje, no «Algo ha fallado».
  {
    const { ctx, p } = await abre(nav, { rechaza: true });
    await p.goto(`${BASE}/cuenta/nueva-clave?token_hash=${TOKEN_HASH}&type=recovery`);
    await clavesNuevas(p);
    await p.waitForFunction(() => document.querySelector('#err')?.textContent.trim());
    const msg = await p.textContent('#err');
    ok(/verificación en dos pasos/.test(msg) && /klendar\.app\/cuenta/.test(msg), `${motor} insufficient_aal: dice qué hacer`, msg);
    await ctx.close();
  }
  await nav.close();
}

console.log(fallos ? `${fallos} fallos` : 'Todo bien');
process.exit(fallos ? 1 : 0);
