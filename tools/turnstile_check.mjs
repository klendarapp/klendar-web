// Turnstile en todo lo que entra a Supabase Auth desde la web, con las claves
// de prueba oficiales de Cloudflare (valen en localhost) y Supabase contestado
// aquí: no toca dev ni prod ni manda nada a nadie (solo carga el widget de
// challenges.cloudflare.com, que con estas claves no comprueba nada).
//
// Para cada formulario —«Tu cuenta»: entrar con contraseña, código por
// correo, crear la cuenta y recuperar la contraseña; administración: entrar y
// recuperar— con tres config.js:
//   · sin clave (hoy en dev): la petición sale sin token y Turnstile ni se carga;
//   · 1x… (siempre pasa): la petición lleva el token de prueba;
//   · 2x… (siempre falla): no sale ninguna petición y se dice por qué.
// Con la clave que pasa, además: el token se pide por adelantado al pintar el
// formulario (al pulsar ya está: la petición sale al momento), dos envíos
// seguidos llevan token los dos (son de un solo uso: se pide otro) y, si
// Cloudflare no contesta, a los 20 s se dice y no sale nada.
// Y «Continuar con Google» no espera a Turnstile (Supabase no lo exige en
// OAuth ni en `grant_type=pkce`/`id_token`): va igual con Cloudflare caído.
//
// Lee de qué Supabase va config.js (dev o prod), así que vale igual en la
// rama `web-prod`.
//
//   SUPABASE_BLOQUEADO=1 PORT=8797 node tools/serve_dev.mjs &
//   BASE=http://localhost:8797 PW=<ruta a playwright> node tools/turnstile_check.mjs
import { playwright, SUPA, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium } = playwright();

const BASE = process.env.BASE || 'http://localhost:8797';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
const CLAVES = [['sin clave', ''], ['pasa', '1x00000000000000000000AA'], ['falla', '2x00000000000000000000AB']];
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const FORMULARIOS = [
  {
    nombre: 'entrar', ruta: '/cuenta/entrar', api: /\/auth\/v1\/token\?grant_type=password/, err: '#err',
    rellena: async (p) => {
      await p.fill('#f [name=email]', 'turnstile.prueba@example.com');
      await p.fill('#f [name=password]', 'Prueba-Turnstile-2026');
      await p.click('#f button[type=submit]');
    },
  },
  {
    nombre: 'código por correo', ruta: '/cuenta/codigo-correo', api: /\/auth\/v1\/otp/, err: '#err',
    rellena: async (p) => {
      await p.fill('#f1 [name=email]', 'turnstile.prueba@example.com');
      await p.click('#f1 button[type=submit]');
    },
  },
  {
    nombre: 'crear la cuenta', ruta: '/cuenta/registro', api: /\/auth\/v1\/signup/, err: '#err',
    rellena: async (p) => {
      await p.fill('#f [name=name]', 'Prueba Turnstile');
      await p.fill('#f [name=email]', 'turnstile.prueba@example.com');
      await p.fill('#f [name=password]', 'Prueba-Turnstile-2026');
      await p.fill('#f [name=birth]', '1990-01-01');
      await p.check('#f [name=terms]');
      await p.click('#f button[type=submit]');
    },
  },
  {
    nombre: 'recuperar la contraseña', ruta: '/cuenta/recuperar', api: /\/auth\/v1\/recover/, err: '#err',
    rellena: async (p) => {
      await p.fill('#f [name=email]', 'turnstile.prueba@example.com');
      await p.click('#f button[type=submit]');
    },
  },
  {
    nombre: 'admin: entrar', ruta: '/admin', api: /\/auth\/v1\/token\?grant_type=password/, err: '#loginErr',
    rellena: async (p) => {
      await p.waitForSelector('#login:not([hidden])');
      await p.fill('#email', 'turnstile.prueba@example.com');
      await p.fill('#password', 'Prueba-Turnstile-2026');
      await p.click('#doLogin');
    },
  },
  {
    nombre: 'admin: recuperar', ruta: '/admin', api: /\/auth\/v1\/recover/, err: '#loginErr',
    rellena: async (p) => {
      await p.waitForSelector('#login:not([hidden])');
      await p.fill('#email', 'turnstile.prueba@example.com');
      await p.click('#doReset');
    },
  },
];

/** Un contexto con config.js cambiado al vuelo y Supabase de mentira. */
async function contexto(nav, clave, estado, { cloudflare = 'normal' } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  // Cloudflare caído ('caido': no se puede conectar) o que no contesta ('mudo').
  if (cloudflare === 'caido') await ctx.route('https://challenges.cloudflare.com/**', (route) => route.abort());
  if (cloudflare === 'mudo') await ctx.route('https://challenges.cloudflare.com/**', () => { /* nunca contesta */ });
  await ctx.route(`${BASE}/config.js*`, async (route) => {
    const r = await route.fetch();
    route.fulfill({ response: r, body: (await r.text()).replace(/turnstile:\s*'[^']*'/, `turnstile: '${clave}'`) });
  });
  // Lo que pasaría por las Functions locales (que sí hablan con Supabase): fuera.
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  ctx.on('request', (req) => { if (req.url().startsWith('https://challenges.cloudflare.com/')) estado.cloudflare++; });
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/auth/v1/settings')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { email: true, google: true } }) });
    }
    if (url.includes('/auth/v1/authorize')) {
      estado.authorize.push({ url, cloudflare: estado.cloudflare });
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Google (de mentira)</p>' });
    }
    if (req.method() === 'POST' && /\/auth\/v1\/(signup|otp|token|recover)/.test(url)) {
      let body = null;
      try { body = req.postDataJSON(); } catch { /* sin cuerpo */ }
      estado.pedidos.push({ url, body, en: Date.now() });
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'email_address_invalid', msg: 'prueba' }) });
    }
    if (url.includes('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  return ctx;
}

const nav = await chromium.launch();
try {
  for (const [modo, clave] of CLAVES) {
    for (const f of FORMULARIOS) {
      const estado = { pedidos: [], authorize: [], cloudflare: 0 };
      const ctx = await contexto(nav, clave, estado);
      const p = await ctx.newPage();
      try {
        await p.goto(BASE + f.ruta, { waitUntil: 'networkidle' });
        // Lo que se tarda en escribir (con las claves de prueba, Turnstile contesta enseguida).
        if (modo === 'pasa') await p.waitForTimeout(1500);
        const pulsa = Date.now();
        await f.rellena(p);
        // Con la clave que falla, Turnstile reintenta un rato antes de rendirse.
        await p.waitForFunction((sel) => (document.querySelector(sel)?.textContent || '').trim().length > 0,
          f.err, { timeout: modo === 'sin clave' ? 8000 : 20000 }).catch(() => {});
        const hechos = estado.pedidos.filter((x) => f.api.test(x.url));
        const token = hechos.map((x) => x.body?.gotrue_meta_security?.captcha_token).find(Boolean);
        const texto = ((await p.textContent(f.err).catch(() => '')) || '').trim();
        if (modo === 'sin clave') {
          ok(hechos.length === 1 && !token, `${modo} · ${f.nombre}: sale la petición sin token`);
          ok(estado.cloudflare === 0, `${modo} · ${f.nombre}: no se carga Turnstile`);
        } else if (modo === 'pasa') {
          ok(hechos.length === 1 && token === TOKEN, `${modo} · ${f.nombre}: la petición lleva el token (${token || 'ninguno'})`);
          const ms = hechos.length ? hechos[0].en - pulsa : -1;
          ok(ms >= 0 && ms < 1000, `${modo} · ${f.nombre}: el token ya estaba listo (sale ${ms} ms tras rellenar y pulsar)`);
        } else {
          ok(hechos.length === 0, `${modo} · ${f.nombre}: no sale ninguna petición`);
          ok(/robot/i.test(texto), `${modo} · ${f.nombre}: lo dice («${texto.slice(0, 70)}»)`);
        }
      } catch (e) {
        ok(false, `${modo} · ${f.nombre}: ${e.message.split('\n')[0]}`);
      }
      await ctx.close();
    }
  }

  // Dos envíos seguidos en la misma página: cada uno con su token.
  {
    const estado = { pedidos: [], authorize: [], cloudflare: 0 };
    const ctx = await contexto(nav, '1x00000000000000000000AA', estado);
    const p = await ctx.newPage();
    const f = FORMULARIOS[0];
    await p.goto(BASE + f.ruta, { waitUntil: 'networkidle' });
    await f.rellena(p);
    await p.waitForFunction((sel) => (document.querySelector(sel)?.textContent || '').trim().length > 0, f.err, { timeout: 15000 }).catch(() => {});
    await p.evaluate((sel) => { document.querySelector(sel).textContent = ''; }, f.err);
    await p.click('#f button[type=submit]');
    await p.waitForFunction((sel) => (document.querySelector(sel)?.textContent || '').trim().length > 0, f.err, { timeout: 15000 }).catch(() => {});
    const hechos = estado.pedidos.filter((x) => f.api.test(x.url));
    const tokens = hechos.map((x) => x.body?.gotrue_meta_security?.captcha_token);
    ok(hechos.length === 2 && tokens.every((x) => x === TOKEN), `pasa · ${f.nombre} dos veces: las dos peticiones llevan token (${tokens.join(', ') || 'ninguna'})`);
    await ctx.close();
  }

  // Cloudflare no contesta: a los 20 s se dice (lo de «no eres un robot») y no sale nada.
  {
    const estado = { pedidos: [], authorize: [], cloudflare: 0 };
    const ctx = await contexto(nav, '1x00000000000000000000AA', estado, { cloudflare: 'mudo' });
    const p = await ctx.newPage();
    const f = FORMULARIOS[0];
    await p.goto(BASE + f.ruta, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#f');
    const t0 = Date.now();
    await f.rellena(p);
    await p.waitForFunction((sel) => (document.querySelector(sel)?.textContent || '').trim().length > 0, f.err, { timeout: 40000 }).catch(() => {});
    const s = (Date.now() - t0) / 1000;
    const texto = ((await p.textContent(f.err).catch(() => '')) || '').trim();
    ok(/robot/i.test(texto) && s < 35, `Cloudflare mudo · ${f.nombre}: lo dice a los ${s.toFixed(1)} s («${texto.slice(0, 50)}»)`);
    ok(estado.pedidos.length === 0, `Cloudflare mudo · ${f.nombre}: no sale ninguna petición`);
    await ctx.close();
  }

  // «Continuar con Google»: a /authorize sin esperar a Turnstile, aunque haya
  // clave (con Cloudflare caído, va igual).
  const estado = { pedidos: [], authorize: [], cloudflare: 0 };
  const ctx = await contexto(nav, '1x00000000000000000000AA', estado, { cloudflare: 'caido' });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/cuenta/entrar`, { waitUntil: 'networkidle' });
  const boton = p.locator('#google [data-prov=google]');
  await boton.waitFor({ timeout: 8000 }).catch(() => {});
  ok(await boton.count() === 1, 'Google: sale el botón (Supabase lo tiene activo)');
  if (await boton.count()) {
    await Promise.all([p.waitForURL(/\/auth\/v1\/authorize/, { timeout: 8000 }).catch(() => {}), boton.click()]);
    const a = estado.authorize[0];
    ok(Boolean(a), 'Google: va a /auth/v1/authorize');
    ok(Boolean(a), 'Google: no espera a Turnstile (va con Cloudflare caído)');
    ok(a && /code_challenge=/.test(a.url), 'Google: con PKCE (la vuelta se canjea con grant_type=pkce, sin captcha)');
  }
  await ctx.close();
} finally {
  await nav.close();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
