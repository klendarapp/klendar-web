// Prueba de lo publicado el 2026-10-20 con «Pregúntale al local» (PL1–PL7)
// y de lo que lo acompaña, en la web local:
//
//  1. Páginas legales (ES y EN): términos (apartado 4 y la licencia), normas
//     («Preguntas a los negocios»), condiciones para negocios (apartado 3,
//     «Preguntas de la gente», y su línea en el historial), privacidad (fila
//     nueva, notificaciones push con los dos interruptores, cuenta de negocio
//     y destinatarios) y eliminar cuenta; con la fecha nueva y sin
//     desplazamiento horizontal.
//  2. Ficha pública (`/b/` y `/en/b/`, con las Functions de verdad contra un
//     Supabase falso), hasta el 4-11-2026 (`not_yet`, migración
//     20261237100001 de la app): sin nada que enseñar, la sección «Preguntas»
//     no sale; con contestadas, sin «Preguntar» y con «Pronto podrás
//     preguntar a este local»; `?ver=preguntas`, igual.
//  3. «Tu cuenta» › Preguntar con `not_yet`: lo dice y no hay formulario.
//  4. Panel › Preguntas con `available: false`: «Desde el 4 de noviembre…».
//  5. «Tu cuenta» › Notificaciones (migración 20261237100002): «Respuestas a
//     tus preguntas» (Para ti) y, solo a quien lleva un negocio, «Preguntas en
//     tu ficha» (Tu negocio); apagarlos manda su preferencia; en inglés.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800), con un
// Supabase de mentira (no toca dev ni manda nada). Capturas en OUT.
//
//   PORT=8881 node tools/serve_dev.mjs &
//   BASE=http://localhost:8881 FICHA_PORT=8882 FALSO_PORT=8883 PW=<ruta a playwright> OUT=<carpeta> node tools/legal_pl_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8881';
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });
const SOLO = process.env.SOLO || '';
const FICHA_PORT = Number(process.env.FICHA_PORT || 8882);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8883);
const REF = 'dpbbtgwxrlqlplbrtjuq';
const SUPA = `https://${REF}.supabase.co`;
const U = '0e7717e0-0000-4000-8000-0000000071b1';
const BIZ = 'b1000000-0000-4000-8000-0000000071b1';
const VACIO = 'b1000000-0000-4000-8000-0000000071b2';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'legal.pl@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const Q = (n) => `9a000000-0000-4000-8000-0000000071b${n}`;
const CONTESTADAS = [
  { id: Q(1), business_id: BIZ, question: '¿Se puede ir con perro?', asked_at: '2026-10-15T10:00:00Z', answer: 'Sí, con correa.', answered_at: '2026-10-16T10:00:00Z', edited: false, helpful: 4, helped: false, mine: false, state: 'answered', hidden_reason: null },
  { id: Q(2), business_id: BIZ, question: '¿Hay que reservar?', asked_at: '2026-10-15T10:00:00Z', answer: 'Mejor sí.', answered_at: '2026-10-17T10:00:00Z', edited: false, helpful: 1, helped: false, mine: false, state: 'answered', hidden_reason: null },
];

function supabaseFalso(estado) {
  return async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
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
    if (p.startsWith('/rest/v1/businesses')) return json([{ id: BIZ, name: 'Bar Sonda', time_zone: 'Europe/Madrid', city: 'Madrid', logo_url: null, cover_image_url: null, gallery: [] }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, vp, rpc, lang = 'es') {
  const ctx = await nav.newContext({ viewport: vp, locale: lang === 'en' ? 'en-GB' : 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', l); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion(), lang]);
  const estado = { llamadas: [], rpc };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}
const llamadas = (estado, fn) => estado.llamadas.filter(([f]) => f === fn);
const sinScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0);

// ── 1. Páginas legales ─────────────────────────────────────────────────────
const PAGINAS = [
  ['/terminos/', 'Última actualización: 28 de octubre de 2026', [
    /Preguntas a los negocios\. En la ficha de un negocio puedes hacerle preguntas sobre el sitio/,
    /Como mucho 3 al día y una sin contestar por negocio; si eres de su equipo, no puedes preguntarle/,
    /para mostrar tus reseñas, con sus fotos y vídeos, y tus preguntas a los negocios, en la Plataforma/,
    /Preguntas a los negocios \(apartado 4\)/,
  ]],
  ['/en/terms/', 'Last updated: 28 October 2026', [
    /Questions to businesses\. On a business's page you can ask it questions about the place/,
    /to display your reviews, with their photos and videos, and your questions to businesses, on the Platform/,
  ]],
  ['/normas/', 'Última actualización: 20 de octubre de 2026', [
    /Preguntas a los negocios\s+Pregunta lo que te ayude a decidir si ir/,
    /«La respuesta ya está en la ficha», «No es sobre el local», «Lleva datos personales», «No es apropiada», «Ya no está al día»/,
    /Preguntas a los negocios: qué preguntar, qué no y cómo contestan y ocultan los negocios\./,
  ]],
  ['/en/community-guidelines/', 'Last updated: 20 October 2026', [
    /Questions to businesses\s+Ask what helps you decide whether to go/,
  ]],
  ['/negocios/', 'Última actualización: 28 de octubre de 2026', [
    /Preguntas de la gente\. Cualquier persona con cuenta puede preguntarle en su ficha/,
    /Solo ocultará una pregunta con un motivo real de la lista/,
    /los del 20 de octubre de 2026 \(apartados 2 bis, 3 y 3 undecies\), desde el 4 de noviembre de 2026/,
    /Preguntas de la gente \(apartado 3\).*Se aplica desde el 4 de noviembre de 2026\./,
  ]],
  ['/en/business-terms/', 'Last updated: 28 October 2026', [
    /Questions from people\. Anyone with an account can ask the Business questions on its page/,
    /Questions from people \(section 3\).*It applies from 4 November 2026\./,
  ]],
  ['/privacidad/', 'Última actualización: 28 de octubre de 2026', [
    /Preguntas a los negocios\s+Las preguntas que haces en la ficha de un negocio/,
    /las ocultas, 30 días; las que nadie contesta, 180 días/,
    /cuando haya sitio, respuestas a tus preguntas, preguntas en tu ficha, horas de silencio/,
    /que el negocio ha contestado u ocultado tu pregunta \(con el motivo\); si tienes un negocio, que hay una pregunta nueva en tu ficha \(como mucho una por hora\)/,
    /las preguntas que recibe en su ficha \(sin quién las hace\), sus respuestas, quién de su equipo contestó/,
    /Cuando preguntas en la ficha de un negocio, el negocio ve la pregunta, nunca quién la ha hecho\./,
  ]],
  ['/en/privacy/', 'Last updated: 28 October 2026', [
    /Questions to businesses\s+The questions you ask on a business's page/,
    /replies to your questions, questions on your page, quiet hours/,
    /When you ask a question on a business's page, the business sees the question, never who asked it\./,
  ]],
  ['/eliminar-cuenta/', 'Última actualización: 27 de octubre de 2026', [
    /Tus preguntas a los negocios \(también las contestadas, con su respuesta\) y tus «A mí también me sirve»/,
    /Lista al día: tus preguntas a los negocios y tus «me sirve»\./,
  ]],
  ['/en/delete-account/', 'Last updated: 27 October 2026', [/Your questions to businesses \(answered ones included, with their answer\)/]],
];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const txt = `${await p.locator('body').innerText()}
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    if (fecha) ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    ok(await sinScroll(p), `${nombre}/${t} ${ruta}: sin desplazamiento horizontal`);
    if (nombre === 'chromium' && /normas|community/.test(ruta)) {
      await p.locator('#preguntas').scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${OUT}/legal${ruta.replace(/\//g, '-')}${t}.png` });
    }
  }
  ok(errores.length === 0, `${nombre}/${t} legales: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

// ── 2. Ficha pública hasta el 4-11 ─────────────────────────────────────────
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
      const vacio = args.p_id === VACIO || args.p_business === VACIO;
      if (url.pathname === '/rest/v1/rpc/business_profile') {
        return json([{ id: args.p_id, name: vacio ? 'Bar Vacío' : 'Bar Sonda', city: 'Madrid', address: 'Calle Mayor 1, 28013 Madrid', lat: 40.4168, lng: -3.7038, is_verified: true,
          member_since: '2026-01-01T00:00:00Z', time_zone: 'Europe/Madrid', description: 'Un bar de prueba.', closed_indefinitely: false, social: {}, unavailable: null }]);
      }
      if (url.pathname === '/rest/v1/rpc/business_questions_summary') {
        return json(vacio ? { ok: true, total: 0, top: [], mine: [], can_ask: false, ask_block: 'not_yet', team: false }
          : { ok: true, total: 2, top: CONTESTADAS, mine: [], can_ask: false, ask_block: 'not_yet', team: false });
      }
      if (url.pathname === '/rest/v1/rpc/business_questions_page') return json(vacio ? [] : CONTESTADAS);
      return json([]);
    });
  });
}

async function ficha(nav, nombre, t, vp) {
  for (const en of [false, true]) {
    const pre = `http://localhost:${FICHA_PORT}${en ? '/en' : ''}/b/`;
    const ctx = await nav.newContext({ viewport: vp, locale: en ? 'en-GB' : 'es-ES' });
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(e.message));
    await p.goto(`${pre}${VACIO}`, { waitUntil: 'networkidle' });
    ok(await p.locator('h1').count() === 1 && await p.locator('#preguntas').count() === 0 && await p.locator('a.chip[href="#preguntas"]').count() === 0,
      `${nombre}/${t}${en ? ' EN' : ''} ficha sin nada, hasta el 4-11: sin sección «Preguntas» (ni su atajo)`);
    await p.goto(`${pre}${BIZ}`, { waitUntil: 'networkidle' });
    const sec = await p.locator('#preguntas').count();
    const html = await p.content();
    const pronto = en ? 'You’ll soon be able to ask this venue questions.' : 'Pronto podrás preguntar a este local.';
    ok(sec === 1 && /¿Se puede ir con perro\?/.test(html) && html.includes(pronto) && await p.locator('[data-preguntar]').count() === 0,
      `${nombre}/${t}${en ? ' EN' : ''} ficha con contestadas, hasta el 4-11: las contestadas, «${pronto}» y sin «Preguntar»`);
    if (!en) {
      await p.locator('#preguntas').scrollIntoViewIfNeeded();
      await p.locator('.pregunta-pronto').screenshot({ path: `${OUT}/web-ficha-pronto-${nombre}-${t}.png` }).catch(() => {});
      ok(await sinScroll(p), `${nombre}/${t} ficha: sin desplazamiento horizontal`);
      await p.goto(`${pre}${BIZ}?ver=preguntas`, { waitUntil: 'networkidle' });
      const h2 = await p.content();
      ok(h2.includes(pronto) && await p.locator('[data-preguntar]').count() === 0 && await p.locator('.pregunta').count() === 2,
        `${nombre}/${t} «Ver todas» hasta el 4-11: la lista, «Pronto…» y sin «Preguntar»`);
    }
    // Sin ninguna, `?ver=preguntas` no invita a preguntar (revisión 2026-10-21:
    // decía «¿Tienes una duda? Pregúntale al local» al lado de «Pronto…»).
    await p.goto(`${pre}${VACIO}?ver=preguntas`, { waitUntil: 'networkidle' });
    const vacia = await p.locator('.empty').innerText();
    ok(vacia === (en ? 'No questions yet.' : 'Aún no hay preguntas.') && await p.locator('[data-preguntar]').count() === 0,
      `${nombre}/${t}${en ? ' EN' : ''} «Ver todas» sin ninguna, hasta el 4-11: «${vacia}», sin invitar a preguntar`);
    ok(errores.length === 0, `${nombre}/${t} ficha sin errores JS ${errores.join(' | ')}`);
    await ctx.close();
  }
}

// ── 3. «Tu cuenta» › Preguntar, hasta el 4-11 ──────────────────────────────
async function cuentaPreguntar(nav, nombre, t, vp) {
  const { ctx, p, errores } = await contexto(nav, vp, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_businesses: [],
    business_profile: [{ id: BIZ, name: 'Bar Sonda', slug: 'bar-sonda-madrid', city: 'Madrid', time_zone: 'Europe/Madrid' }],
    business_questions_summary: { ok: true, total: 2, top: CONTESTADAS, mine: [], can_ask: false, ask_block: 'not_yet', team: false },
    my_questions: [],
  });
  await p.goto(`${BASE}/app/#/preguntar/${BIZ}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => /Pregúntale a Bar Sonda/.test(document.querySelector('#view')?.innerText || ''));
  const v = await p.locator('#view').innerText();
  ok(/Pronto podrás preguntar a este local\./.test(v) && await p.locator('#f').count() === 0,
    `${nombre}/${t} Tu cuenta › Preguntar hasta el 4-11: «Pronto podrás preguntar a este local.» sin formulario`);
  ok(errores.length === 0, `${nombre}/${t} Tu cuenta › Preguntar sin errores JS ${errores.join(' | ')}`);
  await ctx.close();
}

// ── 4. Panel › Preguntas, hasta el 4-11 ────────────────────────────────────
async function panel(nav, nombre, t, vp) {
  for (const available of [false, true]) {
    const { ctx, p, errores } = await contexto(nav, vp, {
      my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
      my_businesses: [{ id: BIZ, name: 'Bar Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
      business_is_organizer: false,
      my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
      business_tools_overview: { ok: true, can_edit: true, team: { members: 1 }, series: { rules_active: 0 }, questions: { unanswered: 0, answered: 0 } },
      business_question_counts: { unanswered: 0, answered: 0, hidden: 0, can_answer: true, available },
      business_questions_inbox: [],
    });
    await p.goto(`${BASE}/panel/#/preguntas`, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => /Sin contestar/.test(document.querySelector('#view')?.innerText || ''));
    const v = await p.locator('#view').innerText();
    if (!available) {
      ok(/Desde el 4 de noviembre, la gente podrá preguntarte en tu ficha\./.test(v) && !/No tienes preguntas sin contestar/.test(v),
        `${nombre}/${t} panel › Preguntas hasta el 4-11: «Desde el 4 de noviembre…»`);
      if (nombre === 'chromium') await p.screenshot({ path: `${OUT}/panel-preguntas-hasta-4-nov-${t}.png`, fullPage: true });
      ok(await sinScroll(p), `${nombre}/${t} panel: sin desplazamiento horizontal`);
    } else {
      ok(/No tienes preguntas sin contestar/.test(v), `${nombre}/${t} panel › Preguntas pasado el 4-11: como siempre`);
    }
    ok(errores.length === 0, `${nombre}/${t} panel (${available}) sin errores JS ${errores.join(' | ')}`);
    await ctx.close();
  }
}

// ── 5. «Tu cuenta» › Notificaciones: los dos interruptores ─────────────────
async function interruptores(nav, nombre, t, vp) {
  for (const rol of ['owner', 'staff']) {
    const { ctx, p, estado, errores } = await contexto(nav, vp, {
      my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, push_devices: 1 },
      my_notification_preferences: { notify_favorites: true, notify_room: true, notify_holiday_asks: true, business_email: true },
      my_businesses: [{ id: BIZ, name: 'Bar Sonda', role: rol, verification_status: 'verified', is_active: true }],
      my_alert_words: { words: [] },
      update_notification_preferences: null,
    });
    await p.goto(`${BASE}/app/#/ajustes/notificaciones`);
    await p.waitForSelector('input[name=respuestas]');
    const v = await p.locator('#view').innerText();
    ok(/Respuestas a tus preguntas/.test(v) && /Cuando un local contesta u oculta lo que le preguntaste/.test(v)
      && await p.locator('input[name=respuestas]').isChecked(), `${nombre}/${t} Tu cuenta (${rol}): «Respuestas a tus preguntas», encendido`);
    // En «Para ti», justo detrás de «Locales que has pedido», como la app.
    const orden = await p.$$eval('#f-avisos input[type=checkbox]', (xs) => xs.map((x) => x.name));
    ok(orden.indexOf('respuestas') === orden.indexOf('pedidos') + 1, `${nombre}/${t} Tu cuenta: detrás de «Locales que has pedido» (${orden.join(',')})`);
    if (rol === 'owner') {
      ok(/Preguntas en tu ficha/.test(v) && await p.locator('input[name=preguntasFicha]').isChecked()
        && orden.indexOf('preguntasFicha') === orden.indexOf('festivos') - 1,
      `${nombre}/${t} Tu cuenta (propietario): «Tu negocio» › «Preguntas en tu ficha», encendido y antes de «Preguntas de festivos»`);
      await p.locator('input[name=preguntasFicha]').click({ force: true });
      await p.waitForTimeout(1200);
      let u = llamadas(estado, 'update_notification_preferences').slice(-1)[0]?.[1]?.p || {};
      ok(u.notify_questions_received === false && u.notify_question_replies === true && u.notify_holiday_asks === true,
        `${nombre}/${t} Tu cuenta: apagar «Preguntas en tu ficha» manda notify_questions_received = false (y lo demás igual)`);
      await p.locator('input[name=respuestas]').click({ force: true });
      await p.waitForTimeout(1200);
      u = llamadas(estado, 'update_notification_preferences').slice(-1)[0]?.[1]?.p || {};
      ok(u.notify_question_replies === false && u.notify_questions_received === false,
        `${nombre}/${t} Tu cuenta: apagar «Respuestas a tus preguntas» manda notify_question_replies = false`);
      if (nombre === 'chromium') {
        await p.locator('input[name=preguntasFicha]').locator('xpath=ancestor::label').screenshot({ path: `${OUT}/cuenta-preguntas-en-tu-ficha-${t}.png` });
        await p.locator('input[name=respuestas]').locator('xpath=ancestor::label').screenshot({ path: `${OUT}/cuenta-respuestas-a-tus-preguntas-${t}.png` });
      }
      ok(await sinScroll(p), `${nombre}/${t} Tu cuenta: sin desplazamiento horizontal`);
    } else {
      ok(!/Preguntas en tu ficha/.test(v) && await p.locator('input[name=preguntasFicha]').count() === 0,
        `${nombre}/${t} Tu cuenta (empleado): sin «Preguntas en tu ficha»`);
      await p.locator('input[name=sitio]').click({ force: true });
      await p.waitForTimeout(1200);
      const u = llamadas(estado, 'update_notification_preferences').slice(-1)[0]?.[1]?.p || {};
      ok(!('notify_questions_received' in u) && u.notify_question_replies === true, `${nombre}/${t} Tu cuenta (empleado): guardar no toca «Preguntas en tu ficha»`);
    }
    ok(errores.length === 0, `${nombre}/${t} Tu cuenta (${rol}): sin errores de JavaScript (${errores.join(' | ')})`);
    await ctx.close();
  }
  // En inglés.
  const { ctx, p } = await contexto(nav, vp, {
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
    my_notification_preferences: { notify_question_replies: false, notify_questions_received: false },
    my_businesses: [{ id: BIZ, name: 'Bar Sonda', role: 'manager', verification_status: 'verified', is_active: true }],
    my_alert_words: { words: [] },
  }, 'en');
  await p.goto(`${BASE}/app/?lang=en#/ajustes/notificaciones`);
  await p.waitForSelector('input[name=preguntasFicha]');
  const v = await p.locator('#view').innerText();
  ok(/Replies to your questions/.test(v) && /Questions on your page/.test(v)
    && !(await p.locator('input[name=respuestas]').isChecked()) && !(await p.locator('input[name=preguntasFicha]').isChecked()),
  `${nombre}/${t} Tu cuenta en inglés: los dos, apagados`);
  await ctx.close();
}

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

const PRUEBAS = { legales, ficha, cuentaPreguntar, panel, interruptores };
for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]].filter(([n]) => !process.env.NAV || n === process.env.NAV)) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 800 }]]) {
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
