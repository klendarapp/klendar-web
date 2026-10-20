// Prueba de «Pregúntale al local» en la web local, con Supabase contestado
// aquí (no toca dev ni manda nada):
//
//  1. Tu cuenta › `#/preguntar/<negocio>`: preguntar (`ask_business_question`),
//     «Tus preguntas» con su estado (Esperando respuesta · Oculta por el
//     negocio: motivo · la respuesta) y «Borrar mi pregunta»; los avisos
//     llevan aquí (`destinoWeb`); con una esperando, por qué no se puede.
//  2. Tu cuenta › Denunciar una pregunta y una respuesta (`report_target`).
//  3. Panel › `#/preguntas`: Sin contestar · Contestadas · Ocultas,
//     «Contestar» (`answer_business_question`) y «Ocultar» con motivo
//     (`hide_business_question`); la fila «Preguntas · 2 sin contestar» del
//     resumen.
//  4. Ficha pública (Functions de verdad contra un Supabase falso): la
//     sección con las contestadas, «Ver todas (5)» y «Preguntar»; con sesión,
//     «Tus preguntas» y «A mí también me sirve» (`set_question_helpful`);
//     `?ver=preguntas`; un negocio que no recibe preguntas, sin «Preguntar».
//
// Chromium y WebKit, móvil y escritorio. Capturas en OUT.
//
//   PORT=8851 node tools/serve_dev.mjs &
//   BASE=http://localhost:8851 PW=<ruta a playwright> OUT=<carpeta> node tools/preguntas_check.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8851';
const OUT = process.env.OUT || '.';
const FICHA_PORT = Number(process.env.FICHA_PORT || 8852);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8853);
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-0000000097b2';
const BIZ = 'b1000000-0000-4000-8000-0000000097b2';
const PARADO = 'b1000000-0000-4000-8000-0000000097b3';
const Q = (n) => `9a000000-0000-4000-8000-00000000000${n}`;
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'preguntas@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const pregunta = (n, texto, x = {}) => ({
  id: Q(n), business_id: BIZ, question: texto, asked_at: '2026-10-15T10:00:00Z', answer: null, answered_at: null,
  edited: false, helpful: 0, helped: false, mine: false, state: 'pending', hidden_reason: null, ...x,
});
const CONTESTADAS = [
  pregunta(1, '¿Se puede ir con perro?', { answer: 'Sí, con correa.', answered_at: '2026-10-16T10:00:00Z', helpful: 4, state: 'answered' }),
  pregunta(2, '¿Hay que reservar para cenar?', { answer: 'Mejor sí, el sábado.', answered_at: '2026-10-17T10:00:00Z', helpful: 2, state: 'answered', edited: true }),
  pregunta(3, '¿Tenéis opciones sin gluten?', { answer: 'Casi toda la carta.', answered_at: '2026-10-18T10:00:00Z', state: 'answered' }),
];
const MIA = pregunta(4, '¿Abrís el 1 de noviembre?', { mine: true });

function supabaseFalso(estado) {
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p.startsWith('/functions/v1/')) return json({ ok: true });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      estado.llamadas.push([fn, body]);
      const r = estado.rpc[fn];
      if (r !== undefined) return json(typeof r === 'function' ? r(body) : r);
      return json(null);
    }
    if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, name: 'Bar Sonda', city: 'Madrid', time_zone: 'Europe/Madrid', logo_url: null, cover_image_url: null, gallery: [] }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, vp, rpc, { conSesion = true } = {}) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, con]) => {
    try { if (con) localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ }
  }, [`sb-${REF}-auth-token`, sesion(), conSesion]);
  const estado = { llamadas: [], rpc };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

const CUENTA = (x = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [],
  business_profile: [{ id: BIZ, name: 'Bar Sonda', slug: 'bar-sonda-madrid', city: 'Madrid', time_zone: 'Europe/Madrid' }],
  ...x,
});

async function cuentaPreguntar(nav, nombre, t, vp) {
  let mias = [];
  const { ctx, p, estado, errores } = await contexto(nav, vp, CUENTA({
    business_questions_summary: () => ({ ok: true, total: 3, top: CONTESTADAS, mine: mias.filter((q) => q.state !== 'answered'),
      can_ask: !mias.some((q) => q.state === 'pending'), ask_block: mias.some((q) => q.state === 'pending') ? 'pending' : null, team: false }),
    my_questions: () => mias,
    ask_business_question: (b) => {
      const q = pregunta(5, b.p_text, { mine: true });
      mias = [q, pregunta(6, '¿Me pasáis el móvil del camarero?', { mine: true, state: 'hidden', hidden_reason: 'personal_data' }),
        pregunta(7, '¿Hacéis menú infantil?', { mine: true, state: 'answered', answer: 'Sí, a mediodía.', answered_at: '2026-10-18T10:00:00Z' })];
      return { ok: true, item: q };
    },
    delete_my_question: (b) => { mias = mias.filter((q) => q.id !== b.p_id); return { ok: true }; },
  }));
  await p.goto(`${BASE}/app/#/`, { waitUntil: 'networkidle' });
  const d1 = await p.evaluate((b) => destinoWeb(`/business/${b}/questions?q=9a000000-0000-4000-8000-000000000005`), BIZ);
  const d2 = await p.evaluate((b) => destinoWeb(`/my-business/${b}/questions`), BIZ);
  ok(d1 === `#/preguntar/${BIZ}?q=9a000000-0000-4000-8000-000000000005` && d2 === `/panel/#/preguntas?biz=${BIZ}`, `${nombre}/${t} los avisos llevan a «Tus preguntas» y a la bandeja del panel (${d1} · ${d2})`);
  await p.goto(`${BASE}/app/#/preguntar/${BIZ}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#f textarea');
  ok(/Pregúntale a Bar Sonda/.test(await p.locator('#view h1').innerText()), `${nombre}/${t} «Pregúntale a Bar Sonda»`);
  await p.fill('#f textarea', 'corta');
  await p.click('#enviar');
  ok(/al menos 8/.test(await p.locator('#err').innerText()), `${nombre}/${t} menos de 8 caracteres: lo dice sin llamar a la base`);
  await p.fill('#f textarea', '¿Hay   terraza en verano?');
  await p.screenshot({ path: `${OUT}/web-cuenta-preguntar-${nombre}-${t}.png`, fullPage: true });
  await p.click('#enviar');
  await p.waitForSelector('[data-borrar]');
  const l = estado.llamadas.find(([fn]) => fn === 'ask_business_question');
  ok(l && l[1].p_business === BIZ && l[1].p_text === '¿Hay terraza en verano?', `${nombre}/${t} pregunta enviada, sin espacios de más ${JSON.stringify(l && l[1])}`);
  const v = await p.locator('#view').innerText();
  ok(/Tus preguntas/.test(v) && /Esperando respuesta/.test(v) && /Oculta por el negocio: Lleva datos personales/.test(v) && /Respuesta de Bar Sonda/.test(v) && /Sí, a mediodía/.test(v),
    `${nombre}/${t} «Tus preguntas»: esperando, oculta con motivo y la contestada`);
  ok(/Ya tienes una pregunta esperando respuesta aquí/.test(v) && await p.locator('#f').count() === 0, `${nombre}/${t} con una esperando: no deja otra y dice por qué`);
  await p.screenshot({ path: `${OUT}/web-cuenta-tus-preguntas-${nombre}-${t}.png`, fullPage: true });
  await p.locator('[data-borrar]').first().click();
  await p.click('dialog.dialogo button[value=si]');
  await p.waitForTimeout(800);
  ok(estado.llamadas.some(([fn, b]) => fn === 'delete_my_question' && b.p_id === Q(5)), `${nombre}/${t} «Borrar mi pregunta» (con confirmación)`);
  ok(errores.length === 0, `${nombre}/${t} Tu cuenta sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

async function cuentaDenunciar(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, CUENTA({ report_target: null }));
  await p.goto(`${BASE}/app/#/denunciar/question_answer/${Q(1)}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#f');
  ok(/Denunciar una respuesta/.test(await p.locator('#view h1').innerText()), `${nombre}/${t} Denunciar una respuesta`);
  await p.locator('input[name=motivo][value=misleading]').check({ force: true });
  await p.click('#enviar');
  await p.waitForTimeout(800);
  const l = estado.llamadas.find(([fn]) => fn === 'report_target');
  ok(l && l[1].p_type === 'question_answer' && l[1].p_id === Q(1), `${nombre}/${t} denuncia enviada (${JSON.stringify(l && l[1])})`);
  await p.goto(`${BASE}/app/#/denunciar/question/${Q(1)}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => /Denunciar una pregunta/.test(document.querySelector('#view h1')?.textContent || ''));
  ok(true, `${nombre}/${t} Denunciar una pregunta`);
  ok(errores.length === 0, `${nombre}/${t} denunciar sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

const PANEL = (x = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: 'Bar Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid', opening_hours: { 1: [['09:00', '14:00']] } }],
  business_is_organizer: false,
  my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
  business_tools_overview: { ok: true, can_edit: true, team: { members: 1 }, series: { rules_active: 0 }, questions: { unanswered: 2, answered: 3 } },
  ...x,
});
async function panelPreguntas(nav, nombre, t, vp) {
  const { ctx, p, estado, errores } = await contexto(nav, vp, PANEL({
    business_question_counts: { unanswered: 2, answered: 3, hidden: 1, can_answer: true },
    business_questions_inbox: (b) => (b.p_state === 'answered' ? CONTESTADAS.map((q) => ({ ...q, at: q.answered_at }))
      : b.p_state === 'hidden' ? [pregunta(6, '¿Me pasáis el móvil del camarero?', { state: 'hidden', hidden_reason: 'personal_data', at: '2026-10-18T10:00:00Z' })]
        : [pregunta(8, '¿Se puede aparcar cerca?', { at: '2026-10-19T10:00:00Z', reported: true }), pregunta(9, '¿Tenéis trona?', { at: '2026-10-18T10:00:00Z' })]),
    answer_business_question: { ok: true, first: true },
    hide_business_question: { ok: true },
  }));
  await p.goto(`${BASE}/panel/#/preguntas`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-contestar]');
  const v = await p.locator('#view').innerText();
  ok(/Sin contestar · 2/.test(v) && /Contestadas · 3/.test(v) && /Ocultas · 1/.test(v) && /¿Se puede aparcar cerca\?/.test(v) && /Denunciada/.test(v),
    `${nombre}/${t} panel Preguntas: pestañas con cuántas, la lista y «Denunciada»`);
  await p.screenshot({ path: `${OUT}/web-panel-preguntas-${nombre}-${t}.png`, fullPage: true });
  await p.locator('[data-contestar]').first().click();
  await p.fill('textarea[name=answer]', 'Sí, hay un parking a 100 m.');
  await p.locator('form button[type=submit]').last().click();
  await p.waitForTimeout(800);
  const a = estado.llamadas.find(([fn]) => fn === 'answer_business_question');
  ok(a && a[1].p_id === Q(8) && a[1].p_text === 'Sí, hay un parking a 100 m.', `${nombre}/${t} panel: contestar ${JSON.stringify(a && a[1])}`);
  await p.waitForSelector('[data-ocultar]');
  await p.locator('[data-ocultar]').nth(1).click();
  await p.selectOption('select[name=reason]', 'not_about_us');
  await p.screenshot({ path: `${OUT}/web-panel-ocultar-${nombre}-${t}.png` });
  await p.locator('form button[type=submit]').last().click();
  await p.waitForTimeout(800);
  const h = estado.llamadas.find(([fn]) => fn === 'hide_business_question');
  ok(h && h[1].p_id === Q(9) && h[1].p_reason === 'not_about_us', `${nombre}/${t} panel: ocultar con motivo ${JSON.stringify(h && h[1])}`);
  await p.click('[data-pestana=hidden]');
  await p.waitForFunction(() => /Oculta: Lleva datos personales/.test(document.querySelector('#view')?.innerText || ''));
  ok(await p.locator('[data-contestar]').count() === 0, `${nombre}/${t} panel Ocultas: el motivo y sin botones`);
  await p.goto(`${BASE}/panel/#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => /Preguntas · 2 sin contestar/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
  ok(/Preguntas · 2 sin contestar/.test(await p.locator('body').innerText()), `${nombre}/${t} panel resumen: «Preguntas · 2 sin contestar»`);
  ok(errores.length === 0, `${nombre}/${t} panel sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// ── La ficha pública, con las Functions de verdad ───────────────────────────
function supabaseFicha() {
  return createServer((req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    const url = new URL(req.url, 'http://x');
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; });
    req.on('end', () => {
      const json = (b) => { res.writeHead(200, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(b)); };
      let args = {};
      try { args = JSON.parse(cuerpo || '{}'); } catch { /* */ }
      const parado = args.p_id === PARADO || args.p_business === PARADO;
      if (url.pathname === '/rest/v1/rpc/business_profile') {
        return json([{ id: args.p_id, name: parado ? 'Bar Parado' : 'Bar Sonda', city: 'Madrid', address: 'Calle Mayor 1, 28013 Madrid', lat: 40.4168, lng: -3.7038, is_verified: true,
          member_since: '2026-01-01T00:00:00Z', time_zone: 'Europe/Madrid', description: 'Un bar de prueba.', closed_indefinitely: false, social: {},
          unavailable: parado ? 'paused' : null }]);
      }
      if (url.pathname === '/rest/v1/rpc/business_questions_summary') {
        return json(parado ? { ok: true, total: 1, top: [CONTESTADAS[0]], mine: [], can_ask: false, ask_block: 'unavailable', team: false }
          : { ok: true, total: 5, top: CONTESTADAS, mine: [], can_ask: false, ask_block: 'auth', team: false });
      }
      if (url.pathname === '/rest/v1/rpc/business_questions_page') return json(CONTESTADAS);
      if (url.pathname.startsWith('/rest/v1/rpc/')) return json([]);
      return json([]);
    });
  });
}

async function ficha(nav, nombre, t, vp) {
  // Sin sesión: la sección, «Ver todas (5)», «Preguntar» y «A mí también me
  // sirve» que lleva a entrar.
  let ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  let p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`http://localhost:${FICHA_PORT}/b/${BIZ}`, { waitUntil: 'networkidle' });
  const sec = await p.locator('#preguntas').innerText().catch(() => '');
  const html = await p.content();
  ok(/Preguntas/.test(sec) && /¿Se puede ir con perro\?/.test(html) && /Respuesta de Bar Sonda/.test(html) && /editada/.test(html),
    `${nombre}/${t} ficha: «Preguntas» con las contestadas y la respuesta`);
  ok(await p.locator(`a[href$="?ver=preguntas"]`).filter({ hasText: 'Ver todas (5)' }).count() === 1, `${nombre}/${t} ficha: «Ver todas (5)»`);
  ok(await p.locator(`[data-preguntar] a[href*="#/preguntar/${BIZ}"]`).count() === 1, `${nombre}/${t} ficha: «Preguntar» a «Tu cuenta»`);
  ok(await p.locator(`a[href*="#/denunciar/question/${Q(1)}"]`).count() === 1 && await p.locator(`a[href*="#/denunciar/question_answer/${Q(1)}"]`).count() === 1,
    `${nombre}/${t} ficha: denunciar la pregunta y la respuesta`);
  await p.waitForSelector('[data-sirve]:not([hidden])', { timeout: 8000 }).catch(() => null);
  ok(await p.locator('[data-sirve]:not([hidden])').count() === 3, `${nombre}/${t} ficha sin sesión: «A mí también me sirve» a la vista`);
  await p.locator('#preguntas').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/web-ficha-preguntas-${nombre}-${t}.png`, fullPage: true });
  await ctx.close();

  // Con sesión: «Tus preguntas» y «me sirve» encendido/apagado.
  ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion()]);
  const estado = { llamadas: [], rpc: {
    business_questions_summary: { ok: true, total: 5, top: [{ ...CONTESTADAS[0], helped: true }, CONTESTADAS[1], { ...CONTESTADAS[2], mine: true }],
      mine: [MIA], can_ask: false, ask_block: 'pending', team: false },
    business_questions_page: CONTESTADAS,
    set_question_helpful: (b) => ({ ok: true, helped: b.p_on, helpful: b.p_on ? 3 : 1 }),
    business_hours_status: { ok: false },
    my_businesses: [], my_blocks: [],
  } };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`http://localhost:${FICHA_PORT}/b/${BIZ}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-preguntas-mias]:not([hidden])', { timeout: 10000 }).catch(() => null);
  const mias = await p.locator('[data-preguntas-mias]').first().innerText().catch(() => '');
  ok(/Tus preguntas/.test(mias) && /Esperando respuesta/.test(mias) && /¿Abrís el 1 de noviembre\?/.test(mias), `${nombre}/${t} ficha con sesión: «Tus preguntas» esperando`);
  ok(/Ya tienes una pregunta esperando respuesta aquí/.test(await p.locator('[data-preguntar]').first().innerText()), `${nombre}/${t} ficha con sesión: por qué no puede preguntar otra`);
  const b1 = p.locator(`[data-sirve="${Q(1)}"]`);
  const b3 = p.locator(`[data-sirve="${Q(3)}"]`);
  ok(await b1.getAttribute('aria-pressed') === 'true' && await b3.isHidden(), `${nombre}/${t} ficha: «me sirve» encendido donde ya lo dijo y no en la suya`);
  await p.locator(`[data-sirve="${Q(2)}"]`).click();
  await p.waitForTimeout(600);
  const l = estado.llamadas.find(([fn]) => fn === 'set_question_helpful');
  ok(l && l[1].p_id === Q(2) && l[1].p_on === true && /· 3/.test(await p.locator(`[data-sirve="${Q(2)}"]`).innerText()), `${nombre}/${t} ficha: «A mí también me sirve» ${JSON.stringify(l && l[1])}`);
  await p.locator('#preguntas').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/web-ficha-preguntas-sesion-${nombre}-${t}.png`, fullPage: true });
  await p.goto(`http://localhost:${FICHA_PORT}/b/${BIZ}?ver=preguntas`, { waitUntil: 'networkidle' });
  ok(/Preguntas · Bar Sonda/.test(await p.locator('h1').innerText()) && await p.locator('.pregunta').count() >= 3, `${nombre}/${t} «Ver todas»: la lista entera`);
  ok(errores.length === 0, `${nombre}/${t} ficha sin errores JS ${errores.join(' | ')}`);
  await ctx.close();

  // En pausa: lo contestado se ve, sin «Preguntar».
  ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  p = await ctx.newPage();
  await p.goto(`http://localhost:${FICHA_PORT}/b/${PARADO}`, { waitUntil: 'networkidle' });
  const h2 = await p.content();
  ok(/¿Se puede ir con perro\?/.test(h2) && await p.locator('[data-preguntar]').count() === 0, `${nombre}/${t} ficha en pausa: lo contestado, sin «Preguntar»`);
  await ctx.close();
}

const SOLO = process.env.SOLO || '';
let servidorFicha = null;
let falso = null;
if (!SOLO || SOLO.includes('ficha')) {
  falso = supabaseFicha();
  await new Promise((r) => falso.listen(FALSO_PORT, r));
  servidorFicha = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(FICHA_PORT), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa' }, stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 2000));
}

const PRUEBAS = { cuentaPreguntar, cuentaDenunciar, panelPreguntas, ficha };
for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    for (const [k, f] of Object.entries(PRUEBAS)) {
      if (SOLO && !SOLO.split(',').includes(k)) continue;
      await f(nav, nombre, t, vp).catch((e) => ok(false, `${nombre}/${t} ${k}: ${e.message.split('\n')[0]}`));
    }
  }
  await nav.close();
}
if (servidorFicha) servidorFicha.kill();
if (falso) falso.close();
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
