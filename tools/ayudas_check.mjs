// Ayudas de IA para negocios en el panel, «Tu cuenta» y el admin, en la web local, con Supabase contestado aquí (no toca
// dev ni prod ni llama a ninguna IA): apagado no sale nada y no se llama a nadie; el permiso, una casilla sin marcar; la
// propuesta llena categoría y marcas sin pisar lo tocado y se deshace; con el texto corto ni se llama; la tarjeta de ideas
// abre el formulario relleno y nunca publica; el borrador de una reseña se abre para editarlo y no se envía solo; si
// falla, un mensaje y se sigue a mano; en francés; los interruptores de «Tu cuenta» y el del admin.
//
//   SUPABASE_BLOQUEADO=1 PORT=8873 node tools/serve_dev.mjs &
//   BASE=http://localhost:8873 PW=<ruta a playwright> OUT=<carpeta> node tools/ayudas_check.mjs
import { claveSesion, playwright, SUPA, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium } = playwright();
const BASE = process.env.BASE || 'http://localhost:8873';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });

const U = '0e7717e0-0000-4000-8000-00000000a070';
const BIZ = 'b1000000-0000-4000-8000-00000000a070';
const R = 'c1000000-0000-4000-8000-00000000a070';
const CATS = [
  { id: 'c0000000-0000-4000-8000-000000000001', slug: 'cafe', names: { es: 'Cafeterías', en: 'Cafés', fr: 'Cafés' }, position: 1 },
  { id: 'c0000000-0000-4000-8000-000000000002', slug: 'music', names: { es: 'Música', en: 'Music', fr: 'Musique' }, position: 2 },
];

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'ayudas@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const USO_ON = { available: true, consent: true, asked: true };
const USO_OFF = { available: false, consent: false, asked: false };
const ST = (x = {}) => ({ suggest: USO_ON, ideas: USO_ON, replies: USO_ON, min_chars: 25, review_optout: false, ...x });
const APAGADO = ST({ suggest: USO_OFF, ideas: USO_OFF, replies: USO_OFF });
const SUGERENCIA = { category_id: CATS[1].id, category_name: 'Música', tags: { solo: true, kids: false, setting: 'outdoor', charity: false, cards: [] } };
const IDEA = { i: 0, title: 'Merienda de partido', description: 'Café y bizcocho antes del partido.', kind: 'flash_offer', discount: { type: 'percent', value: '20' }, day: null, start_time: null, end_time: null, reason_kind: 'match', reason: 'El sábado juega el Málaga y lo pones' };
const SEMANA = (x = {}) => ({ available: true, enabled: true, consent: true, state: 'done', week_start: '2026-11-09', ideas: [IDEA], ...x });
const RESENA = { id: R, rating: 2, comment: 'Tardaron mucho en servirnos', display_name: 'Marta', created_at: '2026-11-01T10:00:00Z', reply: null, reply_at: null, reply_pending: null, photo_url: null };

function supabaseFalso(e) {
  return async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p === '/functions/v1/ai-help') {
      e.ia.push(body);
      const r = e.ayuda(body, e.ia.length);
      if (r === 'red') return route.abort('failed');
      return json(r);
    }
    if (p.startsWith('/functions/v1/')) return json({ ok: true });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      e.llamadas.push([fn, body]);
      const r = e.rpc[fn];
      return json(r === undefined ? null : typeof r === 'function' ? r(body) : r);
    }
    if (p.startsWith('/rest/v1/admin_users')) return json([{ user_id: U }]);
    if (p.startsWith('/rest/v1/categories')) return json(CATS);
    if (p.startsWith('/rest/v1/offers')) {
      if (req.method() === 'POST') { e.insertadas.push(body); return json({ id: 'o1' }, 201); }
      return json([]);
    }
    if (p.startsWith('/rest/v1/businesses')) {
      return json([{ id: BIZ, time_zone: 'Europe/Madrid', category_id: CATS[0].id, logo_url: null, cover_image_url: null, gallery: [], opening_hours: null, menu_url: null, menu_images: [], created_at: '2020-01-01T00:00:00Z' }]);
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

const PANEL = (x = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: 'Café Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Málaga' }],
  my_business_offer_counts: { total: 3, todas: 3, activa: 1 },
  business_is_organizer: false,
  my_entity_application: { entity_kind: null, application: null, can_apply: true },
  photo_fill_status: { available: false, consent: false, asked: false },
  business_reviews: [RESENA],
  business_review_summary: { count: 1, avg: 2, unanswered: 1 },
  ai_help_status: ST(),
  business_ideas_week: SEMANA(),
  review_ai_notice: false,
  reply_to_review: { ok: true, status: 'published' },
  ...x,
});

async function contexto(nav, { lang = 'es', rpc = {}, ayuda = () => ({ ok: true, kind: 'suggest', suggestion: SUGERENCIA }) } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l, a]) => {
    try {
      localStorage.setItem(k, v);
      localStorage.setItem(a, v);
      localStorage.setItem('klendar_lang', l);
    } catch { /* */ }
  }, [claveSesion(), sesion(), lang, claveSesion('admin')]);
  const estado = { llamadas: [], insertadas: [], ia: [], rpc: PANEL(rpc), ayuda };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (x) => errores.push(x.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

const nueva = async (p) => {
  await p.goto(`${BASE}/panel/#/publicaciones/nueva-flash`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[name=title]');
};
const TEXTO = 'Noche de jazz en directo con el trío de la casa';
const espera = (p, ms = 2600) => p.waitForTimeout(ms);

const nav = await chromium.launch();
const estado3 = { dado: false };

// ── Apagado ──────────────────────────────────────────────────────────────
{
  const { ctx, p, errores, estado } = await contexto(nav, { rpc: { ai_help_status: APAGADO, business_ideas_week: { available: false } } });
  await nueva(p);
  await p.fill('[name=title]', TEXTO);
  await espera(p);
  ok(estado.ia.length === 0, 'apagado: en el formulario no se llama a nadie');
  ok(await p.locator('.ia-oferta, .ia-puesto').count() === 0, 'apagado: en el formulario no sale nada');
  // Con lo escrito, el formulario pregunta antes de salir: de una página en blanco.
  await p.goto('about:blank');
  await p.goto(`${BASE}/panel/#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  ok(await p.locator('.ia-ideas').count() === 0, 'apagado: en el resumen no hay tarjeta');
  await p.goto('about:blank');
  await p.goto(`${BASE}/panel/#/resenas`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-resp]');
  ok(await p.locator('[data-prop]').count() === 0, 'apagado: en las reseñas no hay «Proponer respuesta»');
  ok(await p.locator('[data-resp]').count() === 1, 'apagado: «Responder» sigue igual');
  ok(errores.length === 0, `apagado: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── Categoría y etiquetas ────────────────────────────────────────────────
{
  const { ctx, p, errores, estado } = await contexto(nav);
  await nueva(p);
  await p.fill('[name=title]', '2x1 hoy');
  await espera(p);
  ok(estado.ia.length === 0, 'con el texto corto no se llama a nadie');
  await p.fill('[name=title]', TEXTO);
  ok(estado.ia.length === 0, 'mientras escribe, no se llama: el formulario no espera');
  await p.waitForSelector('.ia-puesto', { timeout: 6000 });
  const pedido = estado.ia[0];
  ok(pedido.kind === 'suggest' && pedido.title === TEXTO && pedido.business_id === BIZ && pedido.offer_kind === 'flash_offer', 'manda el título y la descripción, con su negocio');
  const linea = await p.locator('.ia-puesto').innerText();
  ok(/Propuesto con IA/.test(linea) && /Música/.test(linea) && /Al aire libre/.test(linea), 'dice lo que ha puesto y que es IA');
  ok(await p.locator('[name=category_id]').inputValue() === CATS[1].id, 'pone la categoría');
  ok(await p.locator('[name=solo_friendly]').isChecked(), 'pone la marca «Ideal para ir solo»');
  ok(await p.locator('[name=setting][value=outdoor]').isChecked(), 'pone «Al aire libre»');
  ok(estado.insertadas.length === 0, 'NO publica solo');
  await p.screenshot({ path: `${OUT}/ayudas-propuesta.png`, fullPage: true });
  await p.click('#iaDeshacer');
  ok(await p.locator('.ia-puesto').count() === 0, 'se deshace');
  ok(await p.locator('[name=category_id]').count() === 0 || await p.locator('[name=category_id]').inputValue() === '', 'deshacer: la categoría, como estaba');
  ok(!await p.locator('[name=solo_friendly]').isChecked(), 'deshacer: la marca, como estaba');
  await p.fill('[name=description]', 'y un rato largo de música de la buena para terminar la noche');
  await espera(p);
  ok(estado.ia.length === 1, 'deshecho: no se vuelve a proponer');
  ok(errores.length === 0, `propuesta: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}
{
  const { ctx, p, estado } = await contexto(nav);
  await nueva(p);
  await p.evaluate(() => { document.querySelector('[name=solo_friendly]').checked = false; document.querySelector('[name=setting][value=indoor]').checked = true; });
  await p.fill('[name=title]', TEXTO);
  await p.waitForSelector('.ia-puesto', { timeout: 6000 });
  ok(await p.locator('[name=setting][value=indoor]').isChecked(), 'lo que ha tocado el dueño no se pisa');
  ok(estado.ia.length === 1, 'una sola llamada');
  await ctx.close();
}
{
  // Sin permiso: se ofrece, una casilla sin marcar y no sale nada hasta aceptar.
  const { ctx, p, errores, estado } = await contexto(nav, { rpc: { ai_help_status: () => ST({ suggest: { available: true, consent: estado3.dado, asked: estado3.dado } }), set_ai_consent: (b) => { estado3.dado = b.p_granted; return { ok: true }; } } });
  await nueva(p);
  await p.waitForSelector('.ia-oferta');
  await p.fill('[name=title]', TEXTO);
  await espera(p);
  ok(estado.ia.length === 0, 'sin permiso no sale nada');
  await p.click('#iaActivar');
  await p.waitForSelector('#modal[open]');
  const txt = await p.locator('#modal').innerText();
  ok(/Claude/.test(txt) && /Anthropic/.test(txt) && /Estados Unidos/.test(txt), 'permiso: dice a quién va y dónde');
  ok(!await p.locator('#modal [name=ia_permiso]').isChecked(), 'permiso: la casilla, sin marcar');
  await p.click('#modal button[type=submit]');
  ok(await p.locator('#modal[open]').count() === 1, 'permiso: sin marcarla no sigue');
  await p.check('#modal [name=ia_permiso]');
  await p.click('#modal button[type=submit]');
  await p.waitForSelector('.ia-puesto', { timeout: 6000 });
  const dado = estado.llamadas.find(([f]) => f === 'set_ai_consent');
  ok(dado?.[1]?.p_use === 'suggest_category' && dado?.[1]?.p_granted === true, 'permiso: se guarda, para este uso');
  ok(errores.length === 0, `permiso: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}
{
  // «No, gracias»: se apunta y no vuelve.
  const { ctx, p, estado } = await contexto(nav, { rpc: { ai_help_status: ST({ suggest: { available: true, consent: false, asked: false } }), set_ai_consent: { ok: true } } });
  await nueva(p);
  await p.waitForSelector('.ia-oferta');
  await p.click('#iaNo');
  ok(await p.locator('.ia-oferta').count() === 0, '«No, gracias» lo quita');
  await p.waitForTimeout(200);
  ok(estado.llamadas.some(([f, b]) => f === 'set_ai_consent' && b.p_granted === false && b.p_use === 'suggest_category'), '«No, gracias» se apunta');
  await ctx.close();
}
{
  // Si falla: como si nada, sin mensajes.
  for (const r of [{ ok: false, why: 'cap' }, { ok: false, why: 'failed' }, 'red']) {
    const { ctx, p, errores } = await contexto(nav, { ayuda: () => r });
    await nueva(p);
    await p.fill('[name=title]', TEXTO);
    await espera(p, 3000);
    ok(await p.locator('.ia-puesto').count() === 0 && await p.inputValue('[name=title]') === TEXTO, `si falla (${r.why || r}), el formulario sigue`);
    ok(errores.length === 0, `si falla: sin errores (${errores.join(' | ')})`);
    await ctx.close();
  }
}

// ── Ideas ────────────────────────────────────────────────────────────────
{
  const { ctx, p, errores, estado } = await contexto(nav);
  await p.goto(`${BASE}/panel/#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.ia-ideas');
  const txt = await p.locator('.ia-ideas').innerText();
  ok(/Ideas para esta semana/.test(txt) && txt.includes(IDEA.title) && txt.includes(IDEA.reason), 'la tarjeta: la idea y su motivo');
  ok(/Propuestas con IA/.test(txt), 'la tarjeta dice que es IA');
  await p.screenshot({ path: `${OUT}/ayudas-ideas.png`, fullPage: true });
  await p.click('[data-idea-ia]');
  await p.waitForSelector('[name=title]');
  await p.waitForFunction(() => document.querySelector('[name=title]')?.value);
  ok(await p.inputValue('[name=title]') === IDEA.title, 'un toque abre el formulario relleno');
  ok(await p.inputValue('[name=description]') === IDEA.description, '…con la descripción');
  ok(await p.inputValue('[name=price]') === '', '…sin precio');
  ok(/Idea propuesta con IA/.test(await p.locator('#ideaIA').innerText()), '…y dice que es una propuesta');
  ok(estado.insertadas.length === 0, 'NO publica sola');
  await espera(p, 2400);
  ok(estado.ia.length === 0, 'lo que trae la idea no se manda a proponer');
  ok(errores.length === 0, `ideas: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}
{
  const { ctx, p, estado } = await contexto(nav, { rpc: { business_ideas_week: SEMANA({ ideas: [{ ...IDEA, reason_kind: 'weather' }] }), dismiss_business_idea: { ok: true } } });
  await p.goto(`${BASE}/panel/#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.ia-ideas');
  ok(/MET Norway/.test(await p.locator('.ia-ideas').innerText()), 'el tiempo lleva su fuente');
  await p.click('[data-quita-ia]');
  await p.waitForTimeout(200);
  ok(estado.llamadas.some(([f, b]) => f === 'dismiss_business_idea' && b.p_index === 0), 'se puede quitar una idea');
  await ctx.close();
}
{
  // Sin encender: se ofrece; encender pide el permiso.
  const { ctx, p, estado } = await contexto(nav, { rpc: { business_ideas_week: SEMANA({ enabled: false, consent: false, state: 'none', ideas: [] }), set_ai_consent: { ok: true }, set_business_ideas: { ok: true, enabled: true } } });
  await p.goto(`${BASE}/panel/#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#iaEncender');
  await p.click('#iaEncender');
  await p.waitForSelector('#modal[open]');
  ok(/No se envía el nombre de tu negocio/.test(await p.locator('#modal').innerText()), 'el permiso de ideas dice qué no se manda');
  await p.click('#modal [data-cancel]');
  ok(!estado.llamadas.some(([f]) => f === 'set_business_ideas'), 'sin permiso no se encienden');
  await p.click('#iaEncender');
  await p.check('#modal [name=ia_permiso]');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(300);
  ok(estado.llamadas.some(([f, b]) => f === 'set_business_ideas' && b.p_on === true && b.p_business === BIZ), 'se encienden por negocio');
  await ctx.close();
}
{
  // Apagarlas por negocio.
  const { ctx, p, estado } = await contexto(nav, { rpc: { set_business_ideas: { ok: true, enabled: false } } });
  await p.goto(`${BASE}/panel/#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#iaApagar');
  await p.click('#iaApagar');
  await p.waitForSelector('#modal[open]');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(300);
  ok(estado.llamadas.some(([f, b]) => f === 'set_business_ideas' && b.p_on === false), 'se apagan por negocio');
  await ctx.close();
}

// ── Reseñas ──────────────────────────────────────────────────────────────
{
  const { ctx, p, errores, estado } = await contexto(nav, { ayuda: () => ({ ok: true, kind: 'reply', reply: { draft: 'Lamentamos la espera. Hablamos cuando quieras.', lang: 'es', delicate: true } }) });
  await p.goto(`${BASE}/panel/#/resenas`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-prop]');
  await p.click('[data-prop]');
  await p.waitForSelector('#modal[open]');
  ok(estado.ia[0].kind === 'reply' && estado.ia[0].review_id === R, 'solo manda el id de la reseña');
  ok(!JSON.stringify(estado.ia[0]).includes('Marta') && !JSON.stringify(estado.ia[0]).includes('Tardaron'), 'ni el nombre ni el texto salen del navegador');
  ok(await p.inputValue('#modal [name=reply]') === 'Lamentamos la espera. Hablamos cuando quieras.', 'el borrador, en el cuadro de responder');
  const txt = await p.locator('#modal').innerText();
  ok(/Borrador propuesto con IA/.test(txt), 'avisa de que es IA');
  ok(/algo serio/.test(txt), 'avisa si es delicada');
  ok(!estado.llamadas.some(([f]) => f === 'reply_to_review'), 'NO se envía sola');
  await p.screenshot({ path: `${OUT}/ayudas-respuesta.png`, fullPage: true });
  await p.fill('#modal [name=reply]', 'Lo mío, cambiado');
  await p.click('#modal button[type=submit]');
  await p.waitForTimeout(300);
  ok(estado.llamadas.some(([f, b]) => f === 'reply_to_review' && b.p_reply === 'Lo mío, cambiado'), 'se envía lo que ha editado el dueño, por lo de siempre');
  ok(errores.length === 0, `respuesta: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}
{
  for (const [why, msg] of [['author_out', 'hay que contestarla a mano'], ['before_notice', 'hay que contestarla a mano'], ['cap', 'no se pueden proponer más'], ['failed', 'No hemos podido proponer']]) {
    const { ctx, p } = await contexto(nav, { ayuda: () => ({ ok: false, why }) });
    await p.goto(`${BASE}/panel/#/resenas`, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-prop]');
    await p.click('[data-prop]');
    await p.waitForFunction((m) => document.body.innerText.includes(m), msg);
    ok(await p.locator('#modal[open]').count() === 0, `${why}: un mensaje y se contesta a mano`);
    ok(await p.locator('[data-resp]').isEnabled(), `${why}: «Responder» sigue`);
    await ctx.close();
  }
}

// ── En francés ───────────────────────────────────────────────────────────
{
  const { ctx, p, errores } = await contexto(nav, { lang: 'fr' });
  await p.goto(`${BASE}/panel/#/resumen`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.ia-ideas');
  await p.waitForTimeout(400);
  ok(/Idées pour cette semaine/.test(await p.locator('.ia-ideas').innerText()), 'en francés');
  ok(errores.length === 0, `francés: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── «Tu cuenta» ──────────────────────────────────────────────────────────
const CUENTA = (x = {}) => ({ my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, share_plans: true }, ...x });
{
  const { ctx, p, errores, estado } = await contexto(nav, { rpc: { ...CUENTA(), ai_help_status: ST({ suggest: { available: false, consent: true, asked: true }, ideas: USO_OFF, replies: USO_OFF }), review_ai_notice: true, set_ai_consent: { ok: true }, set_review_ai_optout: { ok: true } } });
  await p.goto(`${BASE}/cuenta/ajustes`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#dt-ia-sugiere:not([hidden])');
  ok(await p.locator('#permiso-ia-sugiere').isChecked(), '«Tu cuenta»: el permiso que ha dado');
  ok(await p.locator('#dt-ia-ideas:not([hidden])').count() === 0, '«Tu cuenta»: sin contestar, no sale');
  await p.uncheck('#permiso-ia-sugiere');
  await p.waitForTimeout(200);
  ok(estado.llamadas.some(([f, b]) => f === 'set_ai_consent' && b.p_granted === false && b.p_use === 'suggest_category'), '«Tu cuenta»: se retira');
  await p.check('#opone-ia-resena');
  await p.waitForTimeout(200);
  ok(estado.llamadas.some(([f, b]) => f === 'set_review_ai_optout' && b.p_out === true), '«Tu cuenta»: quien escribe reseñas se opone');
  ok(errores.length === 0, `cuenta: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}
{
  const { ctx, p } = await contexto(nav, { rpc: { ...CUENTA(), ai_help_status: APAGADO, review_ai_notice: false } });
  await p.goto(`${BASE}/cuenta/ajustes`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  ok(await p.locator('#dt-ia-resena:not([hidden])').count() === 0, '«Tu cuenta»: sin el aviso, la oposición no sale');
  await ctx.close();
}

// ── El admin ─────────────────────────────────────────────────────────────
{
  const on = { suggest_category: false, business_ideas: false, review_replies: false };
  let aviso = null;
  const resumen = () => ({
    only_users: 0, min_chars: 25, suggest_day_cap: 40, reply_day_cap: 20, review_notice_from: aviso, ideas_businesses: 2,
    uses: Object.keys(on).map((u) => ({ use: u, enabled: on[u], cap_eur: u === 'business_ideas' ? 1 : 0.5, spent_eur: 0.0123, calls: 20, avg_eur: 0.0006, estimate_eur: 0.00015 })),
  });
  const { ctx, p, errores, estado } = await contexto(nav, { rpc: {
    admin_piloto_overview: { config: {}, ai: {}, week: { total: 0, undone: 0, by_kind: {} }, month: {}, actions: [], lists: { brand: 0, official_domain: 0 } },
    admin_piloto_list: [],
    admin_photo_fill_overview: { enabled: false, only_users: 0, cap_eur: 1, spent_eur: 0, calls: 0, avg_eur: null, estimate_offer_eur: 0.0006, estimate_menu_photo_eur: 0.002, offer_day_cap: 10, menu_day_cap: 12 },
    admin_ai_help_overview: () => resumen(),
    admin_ai_help_set: (b) => { on[b.p_use] = b.p_enabled; return { ok: true, enabled: b.p_enabled }; },
    admin_review_notice_set: (b) => { aviso = b.p_on ? '2026-11-05T10:00:00Z' : null; return { ok: true, from: aviso }; },
  } });
  await p.goto(`${BASE}/admin/#/automatico`);
  await p.waitForSelector('[data-uso=suggest_category]');
  const caja = p.locator('[data-uso=suggest_category]').locator('xpath=ancestor::div[contains(@class,"card")]');
  const txt = await caja.innerText();
  ok(/Ayudas de IA para negocios/.test(txt) && /apagado/.test(txt), 'admin: apagadas');
  ok(/0,012/.test(txt) && /0,50\s€/.test(txt) && /20 llamadas/.test(txt), 'admin: lo gastado, contra su tope');
  ok(/Estimado, sin medir/.test(txt), 'admin: el coste estimado');
  ok(await p.locator('[data-uso=review_replies]').isDisabled(), 'admin: las respuestas no se encienden sin el aviso');
  await p.click('[data-uso=suggest_category]');
  await p.waitForFunction(() => document.querySelector('[data-uso=suggest_category]')?.dataset.on === '1');
  ok(estado.llamadas.some(([f, b]) => f === 'admin_ai_help_set' && b.p_use === 'suggest_category' && b.p_enabled === true), 'admin: se enciende una');
  await p.click('[data-aviso]');
  await p.waitForFunction(() => !document.querySelector('[data-uso=review_replies]')?.disabled);
  ok(estado.llamadas.some(([f, b]) => f === 'admin_review_notice_set' && b.p_on === true), 'admin: se pone el aviso');
  await p.screenshot({ path: `${OUT}/ayudas-admin.png`, fullPage: true });
  ok(errores.length === 0, `admin: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

await nav.close();
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
