// «Ya la canjeaste» en las tarjetas de la web (Iván, 25-11; como la app,
// RUNBOOK §4zzz-canjeada de la app). Con los datos de mentira
// (tools/_web_con_datos.mjs) y `my_offer_states` simulada:
//
//   1. Sin sesión: ni se pregunta (`my_offer_states` no se llama) y las
//      tarjetas, como siempre. La página que sirve el borde no lleva nada
//      personal (es la misma para todos y va en caché).
//   2. Con sesión, en Descubre: lo que ya no puedes volver a sacar, fuera;
//      con tu código vivo, «Ver tu código» (lleva a tu código, por encima
//      del enlace de la tarjeta); en un evento con plaza, «Ver tu entrada».
//   3. Con sesión, en Explorar: lo gastado sigue a la vista, con «Ya la
//      canjeaste» en gris y sin enlace.
//   4. Un código que ya ha caducado no cuenta: el botón de siempre.
//   5. La lupa (Explorar con `?q=`): lo gastado sale (se ha buscado), con
//      «Ya la canjeaste» (Iván, 25-11, visto en la 0.1.11).
//   6. «Tu cuenta» › Planes: «Ver tu entrada» (lleva al código) y «Ya has
//      entrado» en las tarjetas.
//
//   PW=<ruta a playwright> node tools/ya_canjeada_check.mjs
import { playwright, REF, SUPA } from './_supabase_simulado.mjs';
import { webConDatos, PLANES } from './_web_con_datos.mjs';
import { conSesionCuenta } from './_cuenta_simulado.mjs';

const { chromium } = playwright();
// Lo tuyo, por publicación (se rellena al ver qué tarjetas hay).
const MIOS = {};
const web = await webConDatos({
  puerto: Number(process.env.PORT || 9034),
  rpc: {
    my_offer_states: (a) => (a.p_offers || []).map((id) => MIOS[id]).filter(Boolean),
  },
});
const BASE = web.BASE;
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };
const llamadasEstados = () => web.llamadas.filter((l) => l.fn === 'my_offer_states').length;

const U = '0e7717e0-0000-4000-8000-00000000ca7e';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'canjeada@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const nav = await chromium.launch();
const contexto = async (conSesion) => {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  if (conSesion) {
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion]);
    await ctx.route(`${SUPA}/auth/v1/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(new URL(route.request().url()).pathname.startsWith('/auth/v1/user') ? USER : {}) }));
  }
  return ctx;
};
const ids = (p, sel) => p.locator(sel).evaluateAll((l) => [...new Set(l.map((e) => e.getAttribute('data-o')))]);

// ── 1. Sin sesión ──────────────────────────────────────────────────────────
let ctx = await contexto(false);
let p = await ctx.newPage();
await p.goto(`${BASE}/descubre`, { waitUntil: 'networkidle' });
const enFeed = await ids(p, '#feed [data-o]');
ok(enFeed.length >= 3, `Descubre con tarjetas (${enFeed.length})`);
await p.goto(`${BASE}/explorar`, { waitUntil: 'networkidle' });
const enExplorar = await ids(p, '[data-o]');
ok(enExplorar.length >= 1, `Explorar con tarjetas (${enExplorar.length})`);
ok(llamadasEstados() === 0, 'sin sesión no se pregunta por lo tuyo');
ok(await p.locator('.tj-mio').count() === 0, 'sin sesión, las tarjetas como siempre');
await ctx.close();
const html = await (await fetch(`${BASE}/descubre`)).text();
ok(!/tj-mio|Ya la canjeaste|Ver tu código/.test(html), 'la página del borde no lleva nada personal');

const [GASTADA, CODIGO, ENTRADA, CADUCADO] = enFeed;
const hora = (h) => new Date(Date.now() + h * 3600e3).toISOString();
MIOS[GASTADA] = { offer_id: GASTADA, state: 'used_up', kind: 'flash_offer', expires_at: null, used: 1, max_per_user: 1 };
MIOS[CODIGO] = { offer_id: CODIGO, state: 'code', kind: 'flash_offer', expires_at: hora(1), used: 0, max_per_user: 1 };
MIOS[ENTRADA] = { offer_id: ENTRADA, state: 'code', kind: 'future_event', expires_at: hora(5), used: 0, max_per_user: 1 };
if (CADUCADO) MIOS[CADUCADO] = { offer_id: CADUCADO, state: 'code', kind: 'flash_offer', expires_at: hora(-1), used: 0, max_per_user: 2 };

// ── 2. Con sesión, en Descubre ─────────────────────────────────────────────
ctx = await contexto(true);
p = await ctx.newPage();
await p.goto(`${BASE}/descubre`, { waitUntil: 'networkidle' });
await p.waitForFunction((id) => document.querySelector(`[data-o="${id}"] .tj-mio`), CODIGO, { timeout: 15000 }).catch(() => {});
ok(llamadasEstados() > 0, 'con sesión se pregunta por lo tuyo (my_offer_states)');
ok(await p.locator(`#feed [data-o="${GASTADA}"]`).count() === 0, 'Descubre: la gastada no sale');
const codigo = p.locator(`#feed [data-o="${CODIGO}"] a.tj-mio--codigo`);
ok(await codigo.count() === 1 && /Ver tu código/.test(await codigo.innerText()), 'Descubre: con tu código, «Ver tu código»');
ok((await codigo.getAttribute('href') || '').endsWith(`/cuenta/codigo/${CODIGO}`), 'y lleva a tu código');
ok(await p.locator(`#feed [data-o="${CODIGO}"] .tj-cta:not(.tj-mio)`).isHidden(), 'y en lugar del botón de siempre');
// Por encima del enlace de la tarjeta (que abre la ficha): el toque es suyo.
await codigo.scrollIntoViewIfNeeded().catch(() => {});
const encima = await codigo.evaluate((a) => {
  const r = a.getBoundingClientRect();
  const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return Boolean(e && a.contains(e));
});
ok(encima, 'el toque en «Ver tu código» va al código, no a la ficha');
const entrada = p.locator(`#feed [data-o="${ENTRADA}"] a.tj-mio--codigo`);
ok(await entrada.count() === 1 && /Ver tu entrada/.test(await entrada.innerText()), 'Descubre: evento con plaza, «Ver tu entrada»');
if (CADUCADO) {
  ok(await p.locator(`#feed [data-o="${CADUCADO}"] .tj-mio`).count() === 0
    && await p.locator(`#feed [data-o="${CADUCADO}"] .tj-cta`).first().isVisible(), 'un código caducado no cuenta: el botón de siempre');
}

// ── 3. Con sesión, en Explorar ─────────────────────────────────────────────
const OTRA = enExplorar.find((id) => !MIOS[id]) || enExplorar[0];
MIOS[OTRA] = { offer_id: OTRA, state: 'used_up', kind: 'flash_offer', expires_at: null, used: 2, max_per_user: 2 };
await p.goto(`${BASE}/explorar`, { waitUntil: 'networkidle' });
await p.waitForFunction((id) => document.querySelector(`[data-o="${id}"] .tj-mio`), OTRA, { timeout: 15000 }).catch(() => {});
const hecha = p.locator(`[data-o="${OTRA}"] .tj-mio--hecha`).first();
ok(await p.locator(`[data-o="${OTRA}"]`).count() >= 1, 'Explorar: la gastada sigue a la vista');
ok(await hecha.count() === 1 && /Ya la canjeaste/.test(await hecha.innerText()), 'Explorar: «Ya la canjeaste»');
ok(await hecha.evaluate((e) => e.tagName) === 'SPAN', 'sin enlace (no se puede pulsar para sacar otro)');

// ── 5. La lupa ─────────────────────────────────────────────────────────────
const buscada = PLANES.find((o) => o.kind === 'flash_offer' && enExplorar.includes(o.id)) || PLANES.find((o) => enExplorar.includes(o.id));
const palabra = String(buscada.title).split(/\s+/)[0];
MIOS[buscada.id] = { offer_id: buscada.id, state: 'used_up', kind: buscada.kind, expires_at: null, used: 1, max_per_user: 1 };
await p.goto(`${BASE}/explorar?q=${encodeURIComponent(palabra)}`, { waitUntil: 'networkidle' });
await p.waitForFunction((id) => document.querySelector(`[data-o="${id}"] .tj-mio`), buscada.id, { timeout: 15000 }).catch(() => {});
ok(await p.locator(`[data-o="${buscada.id}"]`).count() >= 1, `la lupa («${palabra}»): la gastada sale`);
ok(/Ya la canjeaste|Ya has entrado/.test(await p.locator(`[data-o="${buscada.id}"] .tj-mio--hecha`).first().innerText().catch(() => '')),
  'la lupa: con «Ya la canjeaste»');
await ctx.close();

// ── 6. «Tu cuenta» › Planes ────────────────────────────────────────────────
const eventos = PLANES.filter((o) => o.kind === 'future_event' && !o.imported);
const conEntrada = eventos[0].id;
const entrado = eventos[1].id;
ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
await web.conDatos(ctx);
await conSesionCuenta(ctx, {
  my_offer_states: (a) => (a.p_offers || []).filter((id) => id === conEntrada || id === entrado).map((id) => (id === conEntrada
    ? { offer_id: id, state: 'code', kind: 'future_event', expires_at: hora(30), used: 0, max_per_user: 1 }
    : { offer_id: id, state: 'used_up', kind: 'future_event', expires_at: null, used: 1, max_per_user: 1 })),
});
p = await ctx.newPage();
await p.goto(`${BASE}/cuenta/planes`, { waitUntil: 'networkidle' });
await p.waitForSelector('a.ocard .tag-mio', { timeout: 15000 }).catch(() => {});
const tarjetaEntrada = p.locator(`a.ocard[data-o="${conEntrada}"]`).first();
ok(/Ver tu entrada/.test(await tarjetaEntrada.innerText().catch(() => '')), '«Tu cuenta»: «Ver tu entrada»');
ok((await tarjetaEntrada.getAttribute('href').catch(() => '') || '').endsWith(`/cuenta/codigo/${conEntrada}`), 'y la tarjeta lleva a tu código');
ok(/Ya has entrado/.test(await p.locator(`a.ocard[data-o="${entrado}"]`).first().innerText().catch(() => '')), '«Tu cuenta»: «Ya has entrado»');
await ctx.close();

await nav.close();
await web.cierra();
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
