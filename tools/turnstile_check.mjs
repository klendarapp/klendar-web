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
// Y «Continuar con Google» no pide Turnstile (Supabase no lo exige en OAuth ni
// en `grant_type=pkce`/`id_token`), aunque haya clave.
//
// Lee de qué Supabase va config.js (dev o prod), así que vale igual en la
// rama `web-prod`.
//
//   PORT=8797 node tools/serve_dev.mjs &
//   BASE=http://localhost:8797 PW=<ruta a playwright> node tools/turnstile_check.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8797';
const CFG = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
const SUPA = (CFG.match(/url:\s*'([^']+)'/) || [])[1];
if (!SUPA) throw new Error('config.js sin url');
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
const CLAVES = [['sin clave', ''], ['pasa', '1x00000000000000000000AA'], ['falla', '2x00000000000000000000AB']];
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const FORMULARIOS = [
  {
    nombre: 'entrar', ruta: '/app/#/entrar', api: /\/auth\/v1\/token\?grant_type=password/, err: '#err',
    rellena: async (p) => {
      await p.fill('#f [name=email]', 'turnstile.prueba@example.com');
      await p.fill('#f [name=password]', 'Prueba-Turnstile-2026');
      await p.click('#f button[type=submit]');
    },
  },
  {
    nombre: 'código por correo', ruta: '/app/#/codigo-correo', api: /\/auth\/v1\/otp/, err: '#err',
    rellena: async (p) => {
      await p.fill('#f1 [name=email]', 'turnstile.prueba@example.com');
      await p.click('#f1 button[type=submit]');
    },
  },
  {
    nombre: 'crear la cuenta', ruta: '/app/#/registro', api: /\/auth\/v1\/signup/, err: '#err',
    rellena: async (p) => {
      await p.fill('#f [name=name]', 'Prueba Turnstile');
      await p.fill('#f [name=email]', 'turnstile.prueba@example.com');
      await p.fill('#f [name=password]', 'Prueba-Turnstile-2026');
      await p.fill('#f [name=password2]', 'Prueba-Turnstile-2026');
      await p.fill('#f [name=birth]', '1990-01-01');
      await p.check('#f [name=terms]');
      await p.click('#f button[type=submit]');
    },
  },
  {
    nombre: 'recuperar la contraseña', ruta: '/app/#/recuperar', api: /\/auth\/v1\/recover/, err: '#err',
    rellena: async (p) => {
      await p.fill('#f [name=email]', 'turnstile.prueba@example.com');
      await p.click('#f button[type=submit]');
    },
  },
  {
    nombre: 'admin: entrar', ruta: '/admin/', api: /\/auth\/v1\/token\?grant_type=password/, err: '#loginErr',
    rellena: async (p) => {
      await p.waitForSelector('#login:not([hidden])');
      await p.fill('#email', 'turnstile.prueba@example.com');
      await p.fill('#password', 'Prueba-Turnstile-2026');
      await p.click('#doLogin');
    },
  },
  {
    nombre: 'admin: recuperar', ruta: '/admin/', api: /\/auth\/v1\/recover/, err: '#loginErr',
    rellena: async (p) => {
      await p.waitForSelector('#login:not([hidden])');
      await p.fill('#email', 'turnstile.prueba@example.com');
      await p.click('#doReset');
    },
  },
];

/** Un contexto con config.js cambiado al vuelo y Supabase de mentira. */
async function contexto(nav, clave, estado) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(`${BASE}/config.js*`, async (route) => {
    const r = await route.fetch();
    route.fulfill({ response: r, body: (await r.text()).replace(/turnstile:\s*'[^']*'/, `turnstile: '${clave}'`) });
  });
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
      estado.pedidos.push({ url, body });
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

  // «Continuar con Google»: a /authorize sin pasar por Turnstile, aunque haya clave.
  const estado = { pedidos: [], authorize: [], cloudflare: 0 };
  const ctx = await contexto(nav, '1x00000000000000000000AA', estado);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/app/#/entrar`, { waitUntil: 'networkidle' });
  const boton = p.locator('#google [data-prov=google]');
  await boton.waitFor({ timeout: 8000 }).catch(() => {});
  ok(await boton.count() === 1, 'Google: sale el botón (Supabase lo tiene activo)');
  if (await boton.count()) {
    await Promise.all([p.waitForURL(/\/auth\/v1\/authorize/, { timeout: 8000 }).catch(() => {}), boton.click()]);
    const a = estado.authorize[0];
    ok(Boolean(a), 'Google: va a /auth/v1/authorize');
    ok(a && a.cloudflare === 0, 'Google: sin Turnstile');
    ok(a && /code_challenge=/.test(a.url), 'Google: con PKCE (la vuelta se canjea con grant_type=pkce, sin captcha)');
  }
  await ctx.close();
} finally {
  await nav.close();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
