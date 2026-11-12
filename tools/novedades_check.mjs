// «Novedades» y «Última versión en las tiendas» (Iván, 12-11-2026), con
// Supabase contestado aquí (no toca dev ni prod ni manda nada):
//
//  1. /novedades y /en/whats-new: «Novedades · Klendar», cada versión con sus
//     puntos y la que aún no está en las tiendas, «próximamente».
//  2. «Tu cuenta» › Ayuda (sin sesión): la fila «Novedades» con su icono,
//     a /novedades (en inglés, a /en/whats-new).
//  3. Admin › Configuración: la tarjeta «Última versión en las tiendas»;
//     rechaza «0.1» y una por debajo de la mínima; guarda tres números (o
//     null si se deja vacía); sin la migración en la base, lo explica.
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   SUPABASE_BLOQUEADO=1 PORT=8788 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> node tools/novedades_check.mjs
import { playwright, REF, SUPA, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8788';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
const U = '0e7717e0-0000-4000-8000-00000000a7e5';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'admin.novedades@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

function supabaseFalso(estado) {
  return async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return estado.conSesion ? json(USER) : json({}, 401);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/functions/v1/')) return json({ ok: true });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      estado.llamadas.push([fn, body]);
      const r = estado.rpc[fn];
      if (typeof r === 'function') return r(body, json);
      if (r !== undefined) return json(r);
      return json(null);
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, vp, { clave = null, rpc = {}, lang = 'es' } = {}) {
  const ctx = await nav.newContext({ viewport: vp, locale: lang === 'en' ? 'en-GB' : 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l]) => {
    try { if (k) localStorage.setItem(k, v); localStorage.setItem('klendar_lang', l); } catch { /* */ }
  }, [clave, sesion(), lang]);
  const estado = { llamadas: [], rpc, conSesion: !!clave };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

async function paginas(nav, nombre, t, vp) {
  for (const [ruta, titulo, prox, version, lang] of [
    ['/novedades', 'Novedades · Klendar', 'Versión 0.1.9 · próximamente', 'Versión 0.1.7', 'es'],
    ['/en/whats-new', "What's new · Klendar", 'Version 0.1.9 · coming soon', 'Version 0.1.7', 'en'],
  ]) {
    // Cada una con su idioma: la web pasa sola a la versión del idioma elegido.
    const { ctx, p, errores } = await contexto(nav, vp, { lang });
    const r = await p.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    ok(await p.title() === titulo, `${nombre}/${t} ${ruta}: «${titulo}»`);
    const v = await p.locator('main').innerText();
    ok(v.includes(prox) && v.includes(version), `${nombre}/${t} ${ruta}: las versiones, la 0.1.9 «próximamente»`);
    ok(await p.locator('main li').count() >= 9, `${nombre}/${t} ${ruta}: sus puntos`);
    ok(!/€|IVA|VAT|Madrid/.test(v), `${nombre}/${t} ${ruta}: sin precios ni Madrid`);
    await p.screenshot({ path: `${OUT}/web${ruta.replace(/\//g, '-')}-${nombre}-${t}.png`, fullPage: true });
    ok(errores.length === 0, `${nombre}/${t} ${ruta} sin errores JS ${errores.join(' | ')}`);
    await ctx.close();
  }
}

async function cuenta(nav, nombre, t, vp) {
  for (const [lang, href, texto] of [['es', '/novedades', 'Novedades'], ['en', '/en/whats-new', "What's new"]]) {
    const { ctx, p, errores } = await contexto(nav, vp, { lang });
    await p.goto(`${BASE}/cuenta`, { waitUntil: 'networkidle' });
    const fila = p.locator(`a.fila[href="${href}"]`);
    await fila.waitFor();
    ok((await fila.innerText()).includes(texto), `${nombre}/${t} Tu cuenta (${lang}): fila «${texto}» → ${href}`);
    // El icono es de la fuente (si faltara, saldría su nombre en letras de 24 px).
    const ancho = await fila.locator('.ms').first().evaluate((e) => e.getBoundingClientRect().width);
    ok(ancho <= 30, `${nombre}/${t} Tu cuenta (${lang}): el icono se pinta (${ancho}px)`);
    if (lang === 'es') await fila.screenshot({ path: `${OUT}/web-cuenta-novedades-${nombre}-${t}.png` });
    ok(errores.length === 0, `${nombre}/${t} Tu cuenta (${lang}) sin errores JS ${errores.join(' | ')}`);
    await ctx.close();
  }
}

async function admin(nav, nombre, t, vp) {
  let conMigracion = true;
  const rpc = {
    is_admin: true,
    admin_mfa_status: { required: false, enrolled: true },
    admin_kpis: {},
    admin_rate_limits: [],
    storage_cleanup_count: null,
    admin_config: () => null,
    admin_set_config: (b, json) => (conMigracion
      ? json(null)
      : json({ code: 'P0001', message: 'unknown_key', details: null, hint: null }, 400)),
  };
  const cfg = {
    min_version: { value: { android: '0.1.8', ios: '0.1.8' }, updated_at: '2026-11-01T10:00:00Z' },
    maintenance: { value: { enabled: false } },
    latest_version: { value: { android: null, ios: null }, updated_at: '2026-11-12T10:00:00Z' },
  };
  rpc.admin_config = (b, json) => json(cfg);
  const { ctx, p, estado, errores } = await contexto(nav, vp, { clave: `sb-${REF}-admin-auth-token`, rpc });
  await p.goto(`${BASE}/admin#/configuracion`, { waitUntil: 'networkidle' });
  const form = p.locator('#lvf');
  await form.waitFor();
  const tarjeta = await form.locator('xpath=..').innerText();
  ok(/Última versión en las tiendas/.test(tarjeta) && /No bloquea nada/.test(tarjeta) && /iOS/.test(tarjeta), `${nombre}/${t} admin: la tarjeta con su explicación`);
  await form.locator('xpath=..').screenshot({ path: `${OUT}/web-admin-ultima-version-${nombre}-${t}.png` });
  const guardar = async (android, ios) => {
    await form.locator('[name=android]').fill(android);
    await form.locator('[name=ios]').fill(ios);
    await form.locator('button').click();
    await p.waitForTimeout(500);
  };
  const toasts = () => p.locator('#toasts').innerText();
  const llamadas = () => estado.llamadas.filter(([fn, b]) => fn === 'admin_set_config' && b.p_key === 'latest_version');

  await guardar('0.1', '');
  ok(/no es una versión/.test(await toasts()) && llamadas().length === 0, `${nombre}/${t} admin: «0.1» no se manda`);
  await guardar('0.1.7', '');
  ok(/no puede ser menor que la mínima/.test(await toasts()) && llamadas().length === 0, `${nombre}/${t} admin: por debajo de la mínima no se manda`);
  await guardar('0.1.9', '');
  const l = llamadas().at(-1);
  ok(l && l[1].p_value.android === '0.1.9' && l[1].p_value.ios === null, `${nombre}/${t} admin: guarda {android: 0.1.9, ios: null} ${JSON.stringify(l)}`);

  conMigracion = false;
  await p.goto(`${BASE}/admin#/configuracion`, { waitUntil: 'networkidle' });
  await form.waitFor();
  await guardar('0.1.9', '0.1.9');
  ok(/falta aplicar la migración 20261277600000/.test(await toasts()), `${nombre}/${t} admin: sin la migración, lo explica`);
  ok(errores.length === 0, `${nombre}/${t} admin sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const PRUEBAS = { paginas, cuenta, admin };
const SOLO = process.env.SOLO || '';
for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    for (const [k, f] of Object.entries(PRUEBAS)) {
      if (SOLO && !SOLO.includes(k)) continue;
      await f(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} ${k}: ${e.message.split('\n')[0]}`));
    }
  }
  await nav.close();
}
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
