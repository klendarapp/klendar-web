// «Tu cuenta» en /cuenta/ con direcciones normales (Iván, 5-11): cada ruta en
// carga directa y al recargar, atrás y adelante, entrar, crear la cuenta, el
// código, recuperar y la contraseña nueva, el cambio de correo (enlaces con
// `token_hash`), «Confirma que eres tú», `?destino=`, panel y admin que vuelven
// y `/app/…`, que da la 404 normal. Supabase contestado aquí: no toca dev ni
// prod ni manda nada.
//
// Chromium y WebKit, móvil y escritorio, español e inglés.
//
//   SUPABASE_BLOQUEADO=1 PORT=8873 node tools/serve_dev.mjs &
//   BASE=http://localhost:8873 PW=<ruta a playwright> node tools/cuenta_rutas_check.mjs
import { playwright, REF, SUPA, realtimeMudo, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();
const BASE = process.env.BASE || 'http://localhost:8873';
await servidorSeguro(BASE);

const U = '0e7717e0-0000-4000-8000-0000000097d4';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (amr = 'password') => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', exp: 4102444800, amr: [{ method: amr, timestamp: Math.floor(Date.now() / 1000) }], session_id: 'a0000000-0000-4000-8000-000000000001' })}.x`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'rutas@example.com', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const tokens = (amr) => ({ access_token: jwt(amr), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const SESION = JSON.stringify(tokens());
const TOKEN_HASH = 'pruebaDeTokenHash1234567890';

let fallos = 0;
function ok(cond, nombre, extra = '') {
  if (cond) console.log(`  ok  ${nombre}`);
  else { fallos += 1; console.log(`  MAL ${nombre} ${extra}`); }
}

async function abre(nav, { ancho = 390, lang = '', sesion = false, consents = {}, panel = false, negocios = [] } = {}) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l]) => {
    try {
      if (v && !sessionStorage.getItem('sin-sesion-ya')) localStorage.setItem(k, v);
      if (l) localStorage.setItem('klendar_lang', l);
    } catch { /* */ }
  }, [`sb-${REF}-auth-token`, sesion ? SESION : '', lang]);
  const estado = { auth: [], rpc: [] };
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (url.pathname.startsWith('/auth/v1/')) {
      const que = url.pathname.slice('/auth/v1/'.length);
      if (que !== 'settings' && !(que === 'user' && req.method() === 'GET')) estado.auth.push({ que, metodo: req.method(), redirect: url.searchParams.get('redirect_to'), body });
      if (que === 'settings') return json({ external: { email: true, google: true } });
      if (que === 'token') return json(tokens(url.searchParams.get('grant_type') === 'password' ? 'password' : 'otp'));
      if (que === 'verify') return json(body.type === 'email_change' && body.token_hash === `${TOKEN_HASH}a` ? { msg: 'Confirmation link accepted' } : tokens(body.type === 'recovery' ? 'recovery' : 'otp'));
      if (que === 'user') return json(USER);
      if (que === 'signup') return json({ ...USER, identities: [{ id: 'i' }], confirmation_sent_at: '2026-01-01T00:00:00Z' });
      return json({});
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.slice('/rest/v1/rpc/'.length);
      estado.rpc.push([fn, body]);
      if (fn === 'my_consents') return json({ terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, has_birth_date: true, name_asked_at: null, terms_current: '2026-09-29', ...consents });
      if (fn === 'display_name_allowed') return json(true);
      if (fn === 'my_businesses') return json(negocios);
      if (fn === 'my_tastes') return json({ c: [], city: null });
      if (fn === 'my_notification_preferences') return json({});
      if (fn === 'my_friend_link') return json({ code: 'abcd1234abcd1234' });
      if (fn === 'customer_qr_key') return json({ key: 'k', secret: 'cafecafecafecafe', now: Math.floor(Date.now() / 1000) });
      return json(null);
    }
    if (url.pathname.startsWith('/rest/v1/profiles')) {
      const fila = { id: U, display_name: 'Ana', avatar_url: null, birth_date: '1990-01-01', locale: lang || null };
      return json(req.headers().accept?.includes('vnd.pgrst.object') ? fila : [fila]);
    }
    if (url.pathname.startsWith('/rest/v1/')) return json(req.headers().accept?.includes('vnd.pgrst.object') ? {} : []);
    return json({});
  });
  await realtimeMudo(ctx);
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

const dir = (p) => { const u = new URL(p.url()); return u.pathname + u.search; };
const pintada = (p) => p.waitForFunction(() => {
  const v = document.getElementById('view');
  return v && !v.querySelector('.esq') && v.textContent.trim() && !/^(Cargando|Loading)…?$/.test(v.textContent.trim());
});
/** Lo que no debe quedar en ninguna pantalla: `#/` de «Tu cuenta» ni `/app/`. */
const enlacesViejos = (p) => p.evaluate(() => [...document.querySelectorAll('a[href]')]
  .map((a) => a.getAttribute('href'))
  .filter((h) => /^#\/|^\/app(\/|$)|klendar\.app\/app/.test(h) || (/#\//.test(h) && !/^\/panel\/|^\/admin\//.test(h))));

// ── Con sesión: cada ruta, en carga directa y al recargar ─────────────────
const CON_SESION = [
  ['', /Hola|Hello|Ana/], ['planes', /planes|plans/i], ['favoritos', /Favoritos|Favourites/], ['codigos', /Tus códigos|Your codes/],
  ['sellos', /sellos|stamp/i], ['notificaciones', /Notificaciones|Notifications/], ['alertas', /Avísame|Alert/i], ['series', /Series/i],
  ['ajustes', /Ajustes|Settings/], ['ajustes/notificaciones', /Notificaciones|Notifications/], ['ajustes/calendario', /calendario|calendar/i], ['ajustes/lo-que-ves', /Lo que ves|What you see/i],
  ['ajustes/bloqueadas', /bloquead|blocked/i], ['perfil', /perfil|profile/i], ['amigos', /Amigos|Friends/], ['gustos', /gustos|interests/i],
  ['equipos', /Equipos|Teams/], ['artistas', /Artistas|Artists/], ['pedidos', /pedido|asked|request/i], ['ahorro', /ahorrado|saved/i],
  ['grupos', /peticiones|requests/i], ['invitaciones', /Invitaciones|Invitations/], ['sugerencias', /sugerencia|suggest/i], ['qr-cliente', /QR/],
  ['pedir-local', /local|venue|place/i], ['alerta/nueva', /Avísame|Alert/i],
];
const SIN_SESION = [
  ['entrar', /Entrar|Log in/], ['registro', /Crea tu cuenta|Create your account/], ['recuperar', /contraseña|password/i],
  ['codigo-correo', /código|code/i], ['denunciar', /Denunciar|Report/],
];

async function pruebaRutas(nav, motor) {
  for (const [ancho, disp] of [[390, 'móvil'], [1280, 'escritorio']]) {
    for (const [lang, q] of [['es', ''], ['en', '?lang=en']]) {
      const et = `${motor}/${disp}/${lang}`;
      const { ctx, p, errores } = await abre(nav, { ancho, sesion: true });
      let viejos = 0;
      for (const [ruta, re] of CON_SESION) {
        const url = `/cuenta/${ruta}${q}`;
        const r = await p.goto(`${BASE}${url}`);
        await pintada(p);
        const t1 = await p.locator('#view').innerText();
        ok(r.status() === 200 && dir(p) === url && re.test(t1), `${et} ${url}: carga directa`, `${r.status()} ${dir(p)} «${t1.slice(0, 80)}»`);
        await p.reload();
        await pintada(p);
        ok(dir(p) === url && re.test(await p.locator('#view').innerText()), `${et} ${url}: al recargar`, dir(p));
        viejos += (await enlacesViejos(p)).length;
      }
      ok(viejos === 0, `${et}: ningún enlace con #/ ni /app/ en las pantallas`);
      ok(await p.locator(`[data-only="${lang}"] .top-entrar, [data-only="${lang}"] a[data-tab="cuenta"]`).first().count() > 0, `${et}: cabecera en su idioma`);
      const propios = errores.filter((e) => !/access control checks|Load failed/.test(e));
      ok(propios.length === 0, `${et}: sin errores de página`, propios.slice(0, 3).join(' | '));
      await ctx.close();
      const sin = await abre(nav, { ancho });
      for (const [ruta, re] of SIN_SESION) {
        const url = `/cuenta/${ruta}${q}`;
        await sin.p.goto(`${BASE}${url}`);
        await pintada(sin.p);
        ok(dir(sin.p) === url && re.test(await sin.p.locator('#view').innerText()), `${et} ${url}: sin sesión`, dir(sin.p));
      }
      // Lo que pide sesión manda a entrar y vuelve a la ruta.
      await sin.p.goto(`${BASE}/cuenta/favoritos${q}`);
      await sin.p.waitForFunction(() => location.pathname === '/cuenta/entrar');
      ok(new URL(sin.p.url()).searchParams.get('siguiente') === 'favoritos' && (lang === 'es' || new URL(sin.p.url()).searchParams.get('lang') === 'en'), `${et} /cuenta/favoritos sin sesión: a entrar con ?siguiente=`, dir(sin.p));
      await sin.ctx.close();
    }
  }
}

// ── Atrás, adelante y los enlaces de dentro, sin recargar ─────────────────
async function pruebaHistoria(nav, motor) {
  const { ctx, p, errores } = await abre(nav, { sesion: true });
  await p.goto(`${BASE}/cuenta/`);
  await pintada(p);
  await p.evaluate(() => { window.__sinRecargar = 1; });
  await p.click('a[href="/cuenta/favoritos"]');
  await p.waitForFunction(() => location.pathname === '/cuenta/favoritos');
  await pintada(p);
  ok(/Favoritos/.test(await p.locator('#view').innerText()), `${motor} enlace: pinta la pantalla`);
  await p.click('nav.tabbar a[data-tab="cuenta"]:visible');
  await p.waitForFunction(() => location.pathname === '/cuenta/');
  await p.goBack();
  await p.waitForFunction(() => location.pathname === '/cuenta/favoritos');
  await p.waitForFunction(() => /Favoritos/.test(document.getElementById('view').innerText));
  ok(true, `${motor} atrás: vuelve y pinta`);
  await p.goForward();
  await p.waitForFunction(() => location.pathname === '/cuenta/');
  await pintada(p);
  ok(await p.evaluate(() => window.__sinRecargar === 1), `${motor} atrás y adelante sin recargar la página`);
  // La pestaña de abajo sigue a la dirección.
  await p.click('nav.tabbar a[data-tab="planes"]:visible');
  await p.waitForFunction(() => location.pathname === '/cuenta/planes');
  await p.waitForFunction(() => [...document.querySelectorAll('nav.tabbar a[data-tab="planes"]')].some((a) => a.getAttribute('aria-current') === 'page'));
  ok(true, `${motor} pestaña «Planes» marcada`);
  await p.goBack();
  await p.waitForFunction(() => [...document.querySelectorAll('nav.tabbar a[data-tab="cuenta"]')].some((a) => a.getAttribute('aria-current') === 'page'));
  ok(true, `${motor} atrás: la pestaña «Cuenta» marcada`);
  // El mismo enlace otra vez: repinta. Y `#view` («Saltar al contenido») no es otra pantalla.
  await p.goto(`${BASE}/cuenta/ajustes`);
  await pintada(p);
  await p.evaluate(() => { document.getElementById('view').dataset.marca = '1'; document.getElementById('view').firstElementChild.dataset.marca = '1'; });
  await p.evaluate(() => { location.hash = '#view'; });
  await p.waitForTimeout(300);
  ok(await p.locator('#view > [data-marca="1"]').count() === 1, `${motor} un #ancla no repinta la pantalla`);
  // (WebKit se queja de lo que se corta al cambiar de página; no es de la web.)
  const propios = errores.filter((e) => !/access control checks|Load failed/.test(e));
  ok(propios.length === 0, `${motor} historia: sin errores`, propios.join(' | '));
  await ctx.close();
}

// ── Lo que se conserva y lo que no sale de /cuenta/ ───────────────────────
async function pruebaDireccion(nav, motor) {
  const { ctx, p } = await abre(nav);
  await p.goto(`${BASE}/cuenta/entrar?lang=en&destino=%2Fpanel%2F`);
  await pintada(p);
  await p.locator('a[href*="/cuenta/registro"]').first().click();
  await p.waitForFunction(() => location.pathname === '/cuenta/registro');
  const u = new URL(p.url());
  ok(u.searchParams.get('lang') === 'en' && u.searchParams.get('destino') === '/panel/' && u.searchParams.get('para') === 'negocio', `${motor} ?lang= y ?destino= siguen al cambiar de pantalla`, dir(p));
  // rutaInterna: solo direcciones propias y sin datos.
  const casos = await p.evaluate(() => ({
    panel: rutaInterna('/panel/'),
    panelRuta: rutaInterna('/panel/#/validar?code=abc12345&biz=0e7717e0-0000-4000-8000-0000000097d4&x=1'),
    panelAlta: rutaInterna('/panel/?alta=1'),
    cuenta: rutaInterna('/cuenta/'),
    cuentaRuta: rutaInterna('/cuenta/ajustes/notificaciones?lang=en&x=1'),
    fuera: rutaInterna('https://evil.example/panel/'),
    dobles: rutaInterna('//evil.example/panel/'),
    subir: rutaInterna('/cuenta/../admin/'),
    subir2: rutaInterna('/cuenta/%2e%2e/admin/'),
    vieja: rutaInterna('/app/'),
    admin: rutaInterna('/admin/'),
    seguro1: urlCuenta('../panel/'),
    seguro2: urlCuenta('//evil.example/'),
    seguro3: urlCuenta('..%2f..%2fpanel'),
    seguro4: urlCuenta('a\\b'),
    seguro5: urlCuenta('%2e%2e/panel/'),
    normal: urlCuenta('/cuenta/codigo/x.y.z?rp=1'),
  }));
  ok(casos.panel === '/panel/' && casos.panelAlta === '/panel/?alta=1' && casos.cuenta === '/cuenta/', `${motor} rutaInterna: las propias`, JSON.stringify(casos));
  ok(casos.panelRuta === '/panel/#/validar?biz=0e7717e0-0000-4000-8000-0000000097d4&code=abc12345', `${motor} rutaInterna: el panel con su ruta y sin lo demás`, casos.panelRuta);
  ok(casos.cuentaRuta === '/cuenta/ajustes/notificaciones?lang=en', `${motor} rutaInterna: la cuenta con su ruta`, casos.cuentaRuta);
  ok(![casos.fuera, casos.dobles, casos.subir, casos.subir2, casos.vieja, casos.admin].some(Boolean), `${motor} rutaInterna: nada de fuera ni /app/`, JSON.stringify(casos));
  ok([casos.seguro1, casos.seguro2, casos.seguro4, casos.seguro5].every((x) => /^\/cuenta\/(\?|$)/.test(x)) && casos.seguro3.startsWith('/cuenta/'), `${motor} urlCuenta: nunca sale de /cuenta/`, JSON.stringify(casos));
  ok(casos.normal.startsWith('/cuenta/codigo/x.y.z?') && /rp=1/.test(casos.normal), `${motor} urlCuenta: rutas con puntos`, casos.normal);
  await ctx.close();
  // `siguiente` raro en la vuelta de Google: dentro de /cuenta/.
  const c = await abre(nav, { sesion: true });
  await c.p.goto(`${BASE}/cuenta/?siguiente=..%2F..%2Fpanel%2F`);
  await pintada(c.p);
  ok(new URL(c.p.url()).pathname === '/cuenta/', `${motor} ?siguiente= con .. no sale de /cuenta/`, dir(c.p));
  await c.p.goto(`${BASE}/cuenta/?siguiente=guardar%2Fabc%3Frp%3Dxy`);
  await c.p.waitForFunction(() => location.pathname === '/cuenta/guardar/abc');
  ok(new URL(c.p.url()).searchParams.get('rp') === 'xy', `${motor} ?siguiente= con su ruta y parámetros`, dir(c.p));
  await c.ctx.close();
}

// ── Entrar, crear cuenta, código, recuperar ───────────────────────────────
async function pruebaAcceso(nav, motor) {
  // Entrar con contraseña y volver a ?siguiente=.
  {
    const { ctx, p, errores } = await abre(nav);
    await p.goto(`${BASE}/cuenta/entrar?siguiente=favoritos`);
    await pintada(p);
    await p.fill('[name=email]', 'rutas@example.com');
    await p.fill('[name=password]', 'clave-de-prueba');
    await p.click('#f button[type=submit]');
    await p.waitForFunction(() => location.pathname === '/cuenta/favoritos');
    ok(new URL(p.url()).search === '', `${motor} entrar: a ?siguiente=, con la dirección limpia`, dir(p));
    ok(errores.length === 0, `${motor} entrar: sin errores`, errores.join(' | '));
    await ctx.close();
  }
  // Entrar desde el panel: al panel.
  {
    const { ctx, p } = await abre(nav);
    await p.goto(`${BASE}/cuenta/entrar?destino=%2Fpanel%2F`);
    await pintada(p);
    await p.fill('[name=email]', 'rutas@example.com');
    await p.fill('[name=password]', 'clave-de-prueba');
    await p.click('#f button[type=submit]');
    await p.waitForFunction(() => location.pathname === '/panel/');
    ok(true, `${motor} entrar con ?destino=/panel/: vuelve al panel`);
    await ctx.close();
  }
  // Crear cuenta: la vuelta del correo es /cuenta/.
  {
    const { ctx, p, estado } = await abre(nav);
    await p.goto(`${BASE}/cuenta/registro`);
    await p.waitForSelector('[name=password]');
    await p.fill('[name=name]', 'Ana');
    await p.fill('[name=email]', 'nueva@example.com');
    await p.fill('[name=password]', 'clave-de-prueba');
    await p.fill('[name=password2]', 'clave-de-prueba');
    await p.fill('[name=birth]', '01/01/1990');
    await p.check('[name=terms]');
    await p.click('#f button[type=submit]');
    await p.waitForSelector('#fc');
    const alta = estado.auth.find((x) => x.que === 'signup');
    ok(alta && /\/cuenta\/$/.test(alta.redirect || ''), `${motor} crear cuenta: redirect_to a /cuenta/`, alta?.redirect);
    await ctx.close();
  }
  // Código por correo.
  {
    const { ctx, p, estado } = await abre(nav);
    await p.goto(`${BASE}/cuenta/codigo-correo`);
    await pintada(p);
    await p.fill('#f1 [name=email]', 'rutas@example.com');
    await p.click('#f1 button[type=submit]');
    await p.waitForSelector('#f2:not([hidden])');
    const otp = estado.auth.find((x) => x.que === 'otp');
    ok(otp && /\/cuenta\/$/.test(otp.redirect || ''), `${motor} código: redirect_to a /cuenta/`, otp?.redirect);
    await ctx.close();
  }
  // Recuperar: el correo vuelve a /cuenta/nueva-clave.
  {
    const { ctx, p, estado } = await abre(nav);
    await p.goto(`${BASE}/cuenta/recuperar`);
    await pintada(p);
    await p.fill('[name=email]', 'rutas@example.com');
    await p.click('#f button[type=submit]');
    await p.waitForSelector('a[href="/cuenta/entrar"]');
    const rec = estado.auth.find((x) => x.que === 'recover');
    ok(rec && /\/cuenta\/nueva-clave$/.test(rec.redirect || ''), `${motor} recuperar: redirect_to a /cuenta/nueva-clave`, rec?.redirect);
    await ctx.close();
  }
  // El enlace del correo de recuperar (`enlaceWeb`): token_hash fuera de la
  // dirección nada más cargar, canje, formulario y guardar.
  {
    const { ctx, p, estado, errores } = await abre(nav);
    await p.goto(`${BASE}/cuenta/nueva-clave?token_hash=${TOKEN_HASH}&type=recovery`);
    await p.waitForSelector('[name=p1]');
    ok(dir(p) === '/cuenta/nueva-clave', `${motor} enlace de recuperar: sin token_hash en la dirección`, dir(p));
    ok(estado.auth.some((x) => x.que === 'verify' && x.body.token_hash === TOKEN_HASH && x.body.type === 'recovery'), `${motor} enlace de recuperar: verifyOtp`);
    await p.fill('[name=p1]', 'clave-nueva-123');
    await p.fill('[name=p2]', 'clave-nueva-123');
    await p.click('#f button[type=submit]');
    await p.waitForFunction(() => location.pathname === '/cuenta/');
    ok(estado.auth.some((x) => x.que === 'user' && x.metodo === 'PUT' && x.body.password === 'clave-nueva-123'), `${motor} contraseña nueva: guardada y a «Tu cuenta»`);
    ok(errores.length === 0, `${motor} enlace de recuperar: sin errores`, errores.join(' | '));
    await ctx.close();
  }
  // Recuperar pedido desde el panel y desde el admin: vuelve a su sitio.
  for (const [q, dest, nombre] of [['%2Fadmin%2F', '/admin/', 'admin'], ['%2Fpanel%2F', '/panel/', 'panel']]) {
    const { ctx, p } = await abre(nav);
    await p.goto(`${BASE}/cuenta/nueva-clave?destino=${q}&token_hash=${TOKEN_HASH}&type=recovery`);
    await p.waitForSelector('[name=p1]');
    await p.fill('[name=p1]', 'clave-nueva-123');
    await p.fill('[name=p2]', 'clave-nueva-123');
    await p.click('#f button[type=submit]');
    await p.waitForFunction((d) => location.pathname === d, dest);
    ok(true, `${motor} nueva contraseña con ?destino=${dest}: vuelve a ${nombre}`);
    await ctx.close();
  }
  // El admin pide recuperar con la vuelta a /cuenta/nueva-clave?destino=/admin/.
  // (El propio formulario lo prueba tools/turnstile_check.mjs.)
  // Un enlace caducado: el aviso, y a entrar.
  {
    const { ctx, p } = await abre(nav);
    await ctx.route(`${SUPA}/auth/v1/verify`, (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 403, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' }) }));
    await p.goto(`${BASE}/cuenta/ajustes?token_hash=${TOKEN_HASH}&type=recovery`);
    await p.waitForFunction(() => location.pathname === '/cuenta/entrar');
    ok(!/token_hash/.test(p.url()), `${motor} enlace caducado: sin token en la dirección y a entrar`, dir(p));
    await ctx.close();
  }
  // Cambio de correo: los dos enlaces (`token_hash`, type=email_change).
  {
    // Primero, el de la dirección de ahora: aún no hay sesión; a entrar con ?siguiente=ajustes.
    const { ctx, p, estado } = await abre(nav);
    await p.goto(`${BASE}/cuenta/ajustes?token_hash=${TOKEN_HASH}a&type=email_change`);
    await p.waitForFunction(() => location.pathname === '/cuenta/entrar');
    ok(estado.auth.some((x) => x.que === 'verify' && x.body.type === 'email_change') && new URL(p.url()).searchParams.get('siguiente') === 'ajustes', `${motor} cambio de correo, primer enlace: a entrar y luego a Ajustes`, dir(p));
    await ctx.close();
    // El segundo: con sesión, a Ajustes.
    const b = await abre(nav);
    await b.p.goto(`${BASE}/cuenta/ajustes?token_hash=${TOKEN_HASH}&type=email_change`);
    await b.p.waitForFunction(() => /Ajustes/.test(document.getElementById('view').innerText));
    ok(dir(b.p) === '/cuenta/ajustes', `${motor} cambio de correo, segundo enlace: en Ajustes y sin token`, dir(b.p));
    await b.ctx.close();
  }
  // «Confirma que eres tú»: el código sale con la vuelta /cuenta/?reauth=1, y
  // la vuelta del cambio de correo es /cuenta/ajustes.
  {
    const { ctx, p, estado } = await abre(nav, { sesion: true });
    await p.goto(`${BASE}/cuenta/ajustes`);
    await pintada(p);
    await p.goto(`${BASE}/cuenta/nueva-clave?siguiente=ajustes`);
    await p.waitForSelector('[name=p1]');
    await p.fill('[name=p1]', 'clave-nueva-123');
    await p.fill('[name=p2]', 'clave-nueva-123');
    await p.click('#f button[type=submit]');
    // (Antes, 400 ms a ciegas: en WebKit a veces el diálogo aún no estaba.)
    await p.waitForSelector('dialog[open] [data-modo="codigo"]');
    await p.click('dialog [data-modo="codigo"]');
    await p.click('dialog button[type=submit]');
    await p.waitForFunction(() => document.querySelector('dialog [data-reenvio]'));
    const otp = estado.auth.find((x) => x.que === 'otp');
    ok(otp && /\/cuenta\/\?reauth=1$/.test(otp.redirect || ''), `${motor} «Confirma que eres tú»: redirect_to /cuenta/?reauth=1`, otp?.redirect);
    await ctx.close();
  }
}

// ── Propietario que quiere eliminar su cuenta (revisión 9-11, I6) ─────────
// «Ir a mi negocio» lleva a «Dar de baja el negocio» del panel (`/panel/#/baja?biz=`),
// no a `/panel//cuenta/baja` (el 5-11 se cambió `#/` por `/cuenta/` también aquí).
async function pruebaPropietario(nav, motor) {
  const BIZ = 'b0000000-0000-4000-8000-0000000000b1';
  for (const [negocios, esperado, que] of [
    [[{ id: BIZ, name: 'Bar Uno', role: 'owner' }], `/panel/#/baja?biz=${BIZ}`, 'un negocio'],
    [[{ id: BIZ, name: 'Bar Uno', role: 'owner' }, { id: `${BIZ.slice(0, -1)}2`, name: 'Bar Dos', role: 'owner' }], '/panel/', 'dos negocios'],
  ]) {
    const { ctx, p, estado } = await abre(nav, { sesion: true, negocios });
    // El panel, una página vacía: así la dirección (con su `#/`) se queda y se puede leer.
    await p.route('**/panel/**', (r) => (r.request().isNavigationRequest()
      ? r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>panel</title>' })
      : r.continue()));
    await p.goto(`${BASE}/cuenta/ajustes`);
    await pintada(p);
    await p.click('#borrar');
    await p.waitForSelector('dialog[open] button[value=si]');
    ok(/Bar Uno/.test(await p.locator('dialog[open]').innerText()), `${motor} eliminar la cuenta con ${que}: «Primero, tu negocio» y su nombre`);
    await p.click('dialog[open] button[value=si]');
    await p.waitForURL(/\/panel\//).catch(() => {});
    const u = new URL(p.url());
    ok(`${u.pathname}${u.hash}` === esperado, `${motor} eliminar la cuenta con ${que}: «Ir a mi negocio» a ${esperado}`, p.url());
    ok(!estado.rpc.some(([fn]) => fn === 'delete_my_account'), `${motor} eliminar la cuenta con ${que}: no se borra nada`);
    await ctx.close();
  }
}

// ── /app/, panel, /m/ y las fichas ────────────────────────────────────────
async function pruebaFuera(nav, motor) {
  const { ctx, p, estado } = await abre(nav);
  for (const ruta of ['/app', '/app/', '/app/favoritos', '/app/?lang=en', '/app/app.js', '/app/i18n/ca.js', '/cuenta/app.js']) {
    const r = await p.goto(`${BASE}${ruta}`);
    ok(r.status() === 404 && new URL(p.url()).pathname === ruta.split('?')[0] && /no existe|doesn.t exist|not found/i.test(await p.locator('body').innerText()), `${motor} ${ruta}: la 404 de la web, sin redirigir`, `${r.status()} ${p.url()}`);
  }
  const r = await p.goto(`${BASE}/cuenta`);
  ok(r.status() === 200 && new URL(p.url()).pathname === '/cuenta/', `${motor} /cuenta sin barra: a /cuenta/`, p.url());
  ok((await p.request.get(`${BASE}/cuenta/favoritos`)).headers()['x-robots-tag'] === 'noindex, nofollow', `${motor} noindex en cualquier ruta`);
  const pp = (await p.request.get(`${BASE}/cuenta/ajustes`)).headers();
  ok(/camera=\(self\)/.test(pp['permissions-policy'] || '') && /script-src 'self'/.test(pp['content-security-policy'] || ''), `${motor} CSP y Permissions-Policy en cualquier ruta`);
  // Panel sin sesión: a entrar en /cuenta/ (y «Dar de alta»: a crear la cuenta).
  // (WebKit de Windows se cae con este `location.replace` en mitad de la carga,
  // ver idiomas_check: se mira adónde va y se abre aparte.)
  const adonde = async (url) => {
    let destino = null;
    await p.route('**/cuenta/**', (r) => {
      if (r.request().isNavigationRequest() && !destino) { destino = r.request().url(); return r.abort(); }
      return r.continue();
    });
    await p.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    await p.unroute('**/cuenta/**');
    return destino ? new URL(destino) : new URL(`${BASE}/`);
  };
  const a1 = await adonde('/panel/');
  ok(a1.pathname === '/cuenta/entrar' && a1.searchParams.get('destino') === '/panel/', `${motor} panel sin sesión: /cuenta/entrar?destino=`, a1.href);
  const a2 = await adonde('/panel/?alta=1');
  ok(a2.pathname === '/cuenta/registro' && a2.searchParams.get('para') === 'negocio' && /^\/panel\/\?alta=1/.test(a2.searchParams.get('destino') || ''), `${motor} panel ?alta=1: /cuenta/registro?para=negocio&destino=`, a2.href);
  await p.goto(`${BASE}/alta/`);
  await p.waitForFunction(() => location.pathname === '/cuenta/registro');
  ok(new URL(p.url()).searchParams.get('para') === 'negocio', `${motor} klendar.app/alta: a crear la cuenta de negocio`, dir(p));
  // El admin: su formulario de recuperar pide la vuelta a /cuenta/nueva-clave?destino=/admin/.
  await p.goto(`${BASE}/admin/`);
  await p.waitForLoadState('domcontentloaded');
  const adminJs = await (await p.request.get(`${BASE}/admin/admin.js`)).text();
  ok(/\/cuenta\/nueva-clave\?destino=%2Fadmin%2F/.test(adminJs) && !/\/app\//.test(adminJs), `${motor} admin: la vuelta es /cuenta/nueva-clave?destino=/admin/`);
  void estado;
  // «Dar en el momento» por el QR, con puntos en la ruta.
  const m = await p.request.get(`${BASE}/m/0123456789abcdef.2949000.0123456789ab`, { maxRedirects: 0 });
  ok(m.status() === 302 && m.headers().location === '/cuenta/momento/0123456789abcdef.2949000.0123456789ab', `${motor} /m/<clave>.<ventana>.<firma> a /cuenta/momento/…`, `${m.status()} ${m.headers().location}`);
  const r2 = await p.request.get(`${BASE}/cuenta/momento/0123456789abcdef.2949000.0123456789ab`);
  ok(r2.status() === 200 && /text\/html/.test(r2.headers()['content-type']), `${motor} /cuenta/momento/<…>: la página (con puntos en la ruta)`);
  await ctx.close();
}

// ── Lo que en local no pasa por Cloudflare: el middleware y HEAD ──────────
{
  console.log('\nFunctions');
  const { onRequest } = await import('../functions/_middleware.js');
  const pide = async (ruta, metodo = 'GET') => {
    const a = [];
    const ctx = {
      request: new Request(`https://klendar.app${ruta}`, { method: metodo }),
      env: { ASSETS: { fetch: async (u) => { a.push(new URL(u.url || u).pathname); return new Response('la 404', { status: 404, headers: { 'content-type': 'text/html' } }); } } },
      next: async () => new Response('la de antes', { status: 200, headers: { 'content-type': 'text/html' } }),
    };
    return { r: await onRequest(ctx), a };
  };
  for (const ruta of ['/app', '/app/', '/app/favoritos', '/app/?lang=en', '/app/app.js?v=1', '//app/', '/%61pp/']) {
    const { r, a } = await pide(ruta);
    ok(r.status === 404 && await r.text() === 'la 404' && a.length === 1, `middleware ${ruta}: la 404, aunque Pages aún guarde lo de antes`);
  }
  const h = await pide('/app/', 'HEAD');
  ok(h.r.status === 404 && (await h.r.text()) === '', 'middleware HEAD /app/: 404 sin cuerpo');
  for (const ruta of ['/cuenta/', '/apple/', '/app-store/', '/panel/']) ok((await pide(ruta)).r.status === 200, `middleware ${ruta}: sigue su camino`);
  const f = await import('../functions/cuenta/[[ruta]].js');
  ok(f.onRequestHead === f.onRequestGet, '/cuenta/…: HEAD igual que GET (sin esto Cloudflare da 404 a los vigilantes)');
}

const SOLO_FUNCTIONS = process.argv.includes("--functions");
for (const [motor, nav] of SOLO_FUNCTIONS ? [] : [["Chromium", await chromium.launch()], ["WebKit", await webkit.launch()]]) {
  console.log(`\n${motor} · rutas`);
  try {
    await pruebaFuera(nav, motor);
    await pruebaPropietario(nav, motor);
    await pruebaDireccion(nav, motor);
    await pruebaHistoria(nav, motor);
    await pruebaAcceso(nav, motor);
    await pruebaRutas(nav, motor);
  } catch (e) {
    fallos += 1;
    console.log(`  MAL ${motor}: se cortó: ${e.message.split('\n').slice(0, 3).join(' ')}`);
  }
  await nav.close();
}

console.log(fallos ? `\n${fallos} fallo(s).` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
