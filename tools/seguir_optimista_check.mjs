// «Seguir a …» optimista en las páginas públicas (revisión del 3-11-2026,
// 3.1, como la app): al tocarlo cambia al momento a «Sigues a …» con su
// latido (`.mov-late`), sin esperar a la base; si la base dice que no, vuelve
// atrás y el aviso lo dice («Demasiados intentos…» con `rate_limited`). Y si
// dice que sí, se queda y avisa con el texto de la app.
// Contra dev para la página y con la base simulada para lo personal (no se
// escribe nada de verdad).
//
//   PORT=8821 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> BASE=http://localhost:8821 node tools/seguir_optimista_check.mjs
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8821';
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-00000000f001';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'seguir@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const nav = await chromium.launch();
// Un partido de verdad de dev con su «Seguir a …».
const p0 = await nav.newPage();
await p0.goto(`${BASE}/partidos/`, { waitUntil: 'networkidle' });
const enlaces = await p0.locator('a.partido').evaluateAll((l) => l.map((a) => a.getAttribute('href')).slice(0, 8));
let ruta = null;
for (const h of enlaces) {
  await p0.goto(`${BASE}${h}`, { waitUntil: 'networkidle' });
  // Uno de un equipo («Seguir a …»; la competición va sin «a»).
  if (await p0.locator('[data-seguir-equipo]', { hasText: /^Seguir a / }).count()) { ruta = h; break; }
}
await p0.close();
ok(Boolean(ruta), `un partido con «Seguir a …» (${ruta})`);

for (const [caso, respuesta] of [['falla', { ok: false, error: 'rate_limited' }], ['bien', { ok: true }]]) {
  if (!ruta) break;
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion]);
  let contestar;
  const espera = new Promise((r) => { contestar = r; });
  await ctx.route(`${SUPA}/**`, async (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.endsWith('/rpc/my_followed_teams') || p.endsWith('/rpc/my_followed_artists')) return json([]);
    if (p.endsWith('/rpc/follow_broadcast_team')) { await espera; return json(respuesta); }
    if (p.startsWith('/rest/v1/rpc/')) return json(null);
    return json([]);
  });
  const p = await ctx.newPage();
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
  const b = p.locator('[data-seguir-equipo]', { hasText: /^Seguir a / }).first();
  await p.waitForFunction(() => document.querySelector('[data-seguir-equipo]')?.getAttribute('data-directo') === '1', null, { timeout: 15000 }).catch(() => {});
  const antes = await b.getAttribute('aria-pressed');
  await b.click();
  await p.waitForTimeout(150);
  const durante = { pulsado: await b.getAttribute('aria-pressed'), texto: await b.innerText(), late: await b.evaluate((x) => x.classList.contains('mov-late')) };
  ok(antes === 'false' && durante.pulsado === 'true' && /^Sigues a/.test(durante.texto), `${caso}: cambia al momento, sin esperar a la base («${durante.texto}»)`);
  ok(durante.late, `${caso}: con su latido`);
  contestar();
  await p.waitForTimeout(600);
  const despues = await b.getAttribute('aria-pressed');
  const aviso = await p.locator('.am-toast').innerText().catch(() => '');
  if (caso === 'falla') {
    ok(despues === 'false', `${caso}: si la base dice que no, vuelve atrás`);
    ok(/Demasiados intentos/.test(aviso), `${caso}: y lo dice («${aviso}»)`);
  } else {
    ok(despues === 'true', `${caso}: se queda en «Sigues a …»`);
    ok(/^Sigues a .+: te avisamos antes de sus (partidos|carreras|combates)$/.test(aviso), `${caso}: el aviso de la app («${aviso}»)`);
  }
  await ctx.close();
}
await nav.close();
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
