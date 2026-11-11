// Lo de las normas de las tiendas en la web (revisión N-01 y N-10, 5-11-2026):
//
//  1. la Ayuda que descarga la app no habla de precios ni enlaza a pagar, y
//     /preguntas sí (la web puede): `assets/ayuda.json` frente a la página;
//  2. «Tu cuenta» → Ajustes → «Personas bloqueadas» enseña también a quien se
//     bloqueó desde una pregunta en la app (sin nombre) y se puede desbloquear;
//  3. y aguanta un `my_blocks` sin `anonymous` (prod antes de la migración).
//
// Con Supabase contestado aquí: no toca dev ni prod ni manda nada.
//
//   SUPABASE_BLOQUEADO=1 PORT=8873 node tools/serve_dev.mjs &
//   BASE=http://localhost:8873 PW=<ruta a playwright> node tools/normas_tiendas_check.mjs
import { playwright, REF, SUPA, realtimeMudo, servidorSeguro } from './_supabase_simulado.mjs';
import { PRECIOS } from './_precios.mjs';

const { chromium } = playwright();
const BASE = process.env.BASE || 'http://localhost:8873';
await servidorSeguro(BASE);

let fallos = 0;
function ok(cond, nombre, extra = '') {
  if (cond) console.log(`  ok  ${nombre}`);
  else { fallos += 1; console.log(`  MAL ${nombre} ${extra}`); }
}

// ── 1. La Ayuda de la app frente a la de la web ─────────────────────────────
const ayudaApp = await (await fetch(`${BASE}/assets/ayuda.json`)).text();
const paginaEs = await (await fetch(`${BASE}/preguntas`)).text();
const paginaEn = await (await fetch(`${BASE}/en/faq`)).text();
for (const [nombre, patron] of [['el precio', /19,90|19\.90|24,08|24\.08|€/], ['/precios', /\/precios|\/pricing/], ['el panel', /\/panel/], ['Stripe', /stripe/i]]) {
  ok(!patron.test(ayudaApp), `la Ayuda de la app no lleva ${nombre}`);
}
const datos = JSON.parse(ayudaApp);
const ids = [...datos.es.ti, ...datos.es.negocios].map((e) => e.id);
for (const id of ['precio-negocio', 'si-no-pago', 'pausar-plan', 'permanencia', 'orden']) ok(!ids.includes(id), `«${id}» no sale en la app`);
ok(ids.includes('cuanto-cuesta') && ids.includes('publicar'), 'lo demás sigue');
ok(datos.es.negocios.find((e) => e.id === 'publicar').a.every((t) => !t.u), 'el panel se queda en texto, sin enlace');
// La web sí puede hablar de precios, si están a la vista (PRECIOS en
// functions/_lib/chrome.js); apagados (11-11), «te lo explicamos en persona».
if (PRECIOS) {
  ok(paginaEs.includes('19,90') && paginaEs.includes('/precios'), '/preguntas sigue hablando de precios');
  ok(paginaEn.includes('19.90') && paginaEn.includes('/en/pricing'), '/en/faq también');
} else {
  ok(/te lo explicamos en persona/i.test(paginaEs) && !/19,90|24,08/.test(paginaEs), '/preguntas: «te lo explicamos en persona», sin precio');
  ok(/explain it in person/i.test(paginaEn) && !/19\.90|24\.08/.test(paginaEn), '/en/faq también');
}

// ── 2 y 3. «Personas bloqueadas» ────────────────────────────────────────────
const U = '0e7717e0-0000-4000-8000-0000000097d3';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', exp: 4102444800 })}.x`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'normas@example.com', app_metadata: { provider: 'email' }, user_metadata: {} };
const SESION = JSON.stringify({ access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const ANONIMA = '77777777-0000-4000-8000-000000000001';

async function abre(nav, misBloqueos) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, SESION]);
  const estado = { rpc: [] };
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (url.pathname.startsWith('/auth/v1/user')) return json(USER);
    if (url.pathname.startsWith('/auth/v1/')) return json({});
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.slice('/rest/v1/rpc/'.length);
      estado.rpc.push([fn, body]);
      if (fn === 'my_consents') return json({ terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, has_birth_date: true });
      if (fn === 'my_blocks') return json(misBloqueos);
      if (fn === 'unblock_question_author') { misBloqueos.anonymous = []; return json({ ok: true, unblocked: true }); }
      return json(null);
    }
    if (url.pathname.startsWith('/rest/v1/profiles')) {
      const fila = { id: U, display_name: 'Ana', avatar_url: null, birth_date: '1990-01-01' };
      return json(req.headers().accept?.includes('vnd.pgrst.object') ? fila : [fila]);
    }
    if (url.pathname.startsWith('/rest/v1/')) return json([]);
    return json({});
  });
  await realtimeMudo(ctx);
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  await p.goto(`${BASE}/cuenta/ajustes/bloqueadas`, { waitUntil: 'load' });
  await p.waitForFunction(() => {
    const c = document.querySelector('#dd-bloqueadas');
    return c && !/Un momento/.test(c.textContent);
  });
  return { ctx, p, estado, errores };
}

const nav = await chromium.launch();
{
  const { ctx, p, estado, errores } = await abre(nav, {
    ok: true,
    blocks: [{ id: '88888888-0000-4000-8000-000000000002', name: 'Bea Sonda', avatar: null, since: '2026-11-01T10:00:00Z' }],
    anonymous: [{ id: ANONIMA, business: 'La Taberna', since: '2026-11-02T10:00:00Z' }],
  });
  const texto = await p.locator('#dd-bloqueadas').textContent();
  ok(texto.includes('Bea Sonda'), 'sale quien se bloqueó con nombre');
  ok(texto.includes('Alguien que preguntó en La Taberna'), 'sale quien se bloqueó desde una pregunta, sin nombre', texto);
  await p.click(`[data-desbloquear-anonima="${ANONIMA}"]`);
  await p.getByRole('button', { name: 'Desbloquear' }).last().click();
  await p.waitForFunction(() => !document.querySelector('[data-desbloquear-anonima]'));
  const llamada = estado.rpc.find(([fn]) => fn === 'unblock_question_author');
  ok(llamada?.[1]?.p_id === ANONIMA, 'desbloquear va con el id del bloqueo, no con el de la persona', JSON.stringify(llamada));
  ok(!errores.length, 'sin errores en la página', errores.join(' | '));
  await ctx.close();
}
{
  const { ctx, p, errores } = await abre(nav, { ok: true, blocks: [{ id: '88888888-0000-4000-8000-000000000002', name: 'Bea Sonda', avatar: null, since: '2026-11-01T10:00:00Z' }] });
  ok((await p.locator('#dd-bloqueadas').textContent()).includes('Bea Sonda'), 'sin `anonymous` (prod antes de la migración), igual que antes');
  ok(!errores.length, 'sin errores en la página', errores.join(' | '));
  await ctx.close();
}
await nav.close();

console.log(fallos ? `\n${fallos} MAL` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
