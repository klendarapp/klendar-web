// El asistente de ayuda en la web local, con Supabase contestado aquí (no toca dev ni prod ni llama a ninguna IA): apagado o
// sin la migración no sale nada y no se llama a nadie; dice que es una IA antes de la primera pregunta; sin aceptar no se
// pregunta; sin cuenta, el permiso se queda en el navegador; contesta con su cita y su enlace; no lo sabe: el correo, y la
// conversación solo si se marca; grave; los turnos; sin red, al tope o si falla: la Ayuda y el correo; lo que contesta nunca
// se pinta como HTML; en francés; a 320 px sin desbordar; la entrada de «Sugerencias y mejoras», el permiso en Ajustes y el admin.
//
//   SUPABASE_BLOQUEADO=1 PORT=8874 node tools/serve_dev.mjs &
//   BASE=http://localhost:8874 PW=<ruta a playwright> OUT=<carpeta> node tools/asistente_check.mjs
import { claveSesion, playwright, SUPA, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium } = playwright();
const BASE = process.env.BASE || 'http://localhost:8874';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });

const U = '0e7717e0-0000-4000-8000-00000000a0a0';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'asistente@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const ANON = { available: true, signed_in: false, consent: false, asked: false, max_turns: 6, max_chars: 500 };
const CON = { available: true, signed_in: true, consent: true, asked: true, max_turns: 6, max_chars: 500 };
const SIN_PERMISO = { ...CON, consent: false, asked: false };
const RESP = {
  ok: true, state: 'answer', text: 'Pide el código en la oferta y enséñaselo al negocio.', lang: 'es',
  sources: [{ id: 'canjear', title: '¿Cómo se canjea una oferta?', kind: 'help', url: '/preguntas/#canjear' }], screen: 'ajustes', email: false, redacted: false,
};
const NOLOSE = { ok: true, state: 'unknown', text: 'No lo sé: eso no está en lo que tenemos publicado.', lang: 'es', sources: [], screen: null, email: true };

function supabaseFalso(e) {
  return async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p === '/functions/v1/help-assistant') {
      e.ia.push({ body, auth: req.headers().authorization || '' });
      const r = e.ayuda(body, e.ia.length);
      if (r === 'red') return route.abort('failed');
      return json(r);
    }
    if (p.startsWith('/functions/v1/')) return json({ ok: true });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      e.llamadas.push([fn, body]);
      if (fn === 'assistant_status') {
        if (e.status === 404) return json({ code: 'PGRST202', message: 'not found' }, 404);
        return json(e.status);
      }
      const r = e.rpc[fn];
      return json(r === undefined ? null : typeof r === 'function' ? r(body) : r);
    }
    if (p.startsWith('/rest/v1/admin_users')) return json([{ user_id: U }]);
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

async function contexto(nav, { status, lang = '', sesionada = false, ayuda = () => RESP, rpc = {}, width = 390 }) {
  const ctx = await nav.newContext({ viewport: { width, height: 800 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l, conSesion, a]) => {
    try {
      if (conSesion) { localStorage.setItem(k, v); localStorage.setItem(a, v); }
      if (l) localStorage.setItem('klendar_lang', l);
    } catch { /* */ }
  }, [claveSesion(), sesion(), lang, sesionada, claveSesion('admin')]);
  const estado = { llamadas: [], ia: [], status, ayuda, rpc };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (x) => errores.push(x.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

const preguntas = async (p, ruta = '/preguntas/') => {
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
};
const abre = async (p) => {
  await p.click('.asis-entrada');
  await p.waitForSelector('dialog.asis[open]');
  await p.waitForFunction(() => document.querySelector('.asis-cuerpo')?.childElementCount > 0);
};
const pregunta = async (p, q) => {
  await p.fill('#asis-q', q);
  await p.click('.asis-form button[type=submit]');
  await p.waitForFunction(() => !document.querySelector('.asis-espera'));
};

const nav = await chromium.launch();

// ── Apagado y sin migración ─────────────────────────────────────────────
for (const [nombre, status] of [['apagado', { ...ANON, available: false }], ['sin la migración (prod hoy)', 404]]) {
  const { ctx, p, estado, errores } = await contexto(nav, { status });
  await preguntas(p);
  await p.waitForTimeout(200);
  ok(await p.locator('.asis-entrada').count() === 0, `${nombre}: no sale la entrada`);
  ok(estado.ia.length === 0, `${nombre}: no se llama a la función`);
  ok(await p.locator('details.faq').count() > 20, `${nombre}: la Ayuda sigue igual`);
  ok(await p.locator('[data-asistente]').evaluate((n) => n.hidden), `${nombre}: el hueco no se ve`);
  ok(errores.length === 0, `${nombre}: sin errores (${errores})`);
  await ctx.close();
}

// ── Sin cuenta: el aviso y el permiso ───────────────────────────────────
{
  const { ctx, p, estado, errores } = await contexto(nav, { status: ANON });
  await preguntas(p);
  await p.waitForSelector('.asis-entrada');
  ok((await p.locator('.asis-entrada').innerText()).includes('Una IA'), 'la entrada ya dice que es una IA');
  await abre(p);
  const texto = await p.locator('.asis-cuerpo').innerText();
  ok(texto.includes('Antes de empezar: esto es una IA'), 'el aviso, antes de la primera pregunta');
  ok(texto.includes('inteligencia artificial, no una persona'), 'dice que no es una persona');
  ok(texto.includes('Anthropic') && texto.includes('30 días'), 'a quién va');
  ok(texto.includes('no obliga a Klendar'), 'no obliga a Klendar');
  ok(texto.includes('No pongas datos personales'), 'no poner datos personales');
  ok(texto.includes('112'), 'el 112');
  ok(await p.locator('#asis-q').count() === 0, 'sin aceptar no se puede escribir');
  await p.screenshot({ path: `${OUT}/asistente-aviso.png` });
  await p.click('.asis-botones .pill:not(.accent)');
  ok(!(await p.locator('dialog.asis').evaluate((d) => d.open)), '«Ahora no» cierra');
  ok(estado.ia.length === 0 && !(await p.evaluate(() => localStorage.getItem('klendar.asistente.permiso'))), '…sin dar permiso ni preguntar');
  await abre(p);
  await p.click('.asis-botones .pill.accent');
  await p.waitForSelector('#asis-q');
  ok(await p.evaluate(() => localStorage.getItem('klendar.asistente.permiso')) === '1', 'sin cuenta el permiso se queda aquí');
  ok(!estado.llamadas.some(([f]) => f === 'set_ai_consent'), '…y no va a la base');
  ok((await p.locator('.asis-nota').first().innerText()).includes('Es una IA y puede equivocarse'), 'el aviso se queda a la vista');
  ok(await p.locator('.asis-log[role=log][aria-live=polite]').count() === 1, 'el lector de pantalla oye las respuestas');
  ok(await p.locator('label[for=asis-q]').count() === 1, 'el campo tiene su nombre');

  await pregunta(p, 'pepe@correo.es ¿cómo canjeo?');
  ok(estado.ia[0].body.consent === true && estado.ia[0].body.platform === 'web' && estado.ia[0].body.lang === 'es', 'la petición dice web, idioma y permiso');
  ok(estado.ia[0].auth === '', 'sin cuenta no lleva sesión');
  ok(!Object.keys(estado.ia[0].body).some((k) => /user|email|name|id/.test(k)), 'ni nombre, ni correo, ni ids');
  ok((await p.locator('.asis-a').innerText()).includes('Pide el código'), 'contesta');
  const cita = p.locator('.asis-a a').first();
  ok((await cita.innerText()).includes('Sacado de: ¿Cómo se canjea una oferta?') && await cita.getAttribute('href') === '/preguntas/#canjear', 'con su cita y su enlace');
  ok(await p.locator('.asis-a a', { hasText: 'Ir a Ajustes' }).getAttribute('href') === '/cuenta/ajustes', 'y la pantalla donde hacerlo');
  ok(await p.locator('.asis-salidas').count() === 0, 'con respuesta no insiste con el correo');
  await p.screenshot({ path: `${OUT}/asistente-respuesta.png` });
  ok(errores.length === 0, `sin errores (${errores})`);
  await ctx.close();
}

// ── Lo que contesta nunca es HTML, ni enlaces de fuera, ni pantallas raras ─
{
  const malo = {
    ok: true, state: 'answer', text: '<img src=x onerror="window.colado=1"><b>hola</b>', lang: 'es', screen: 'pagar',
    sources: [{ id: 'x', title: '<i>t</i>', kind: 'help', url: 'https://malo.example/' }, { id: 'y', title: 'Bien', kind: 'help', url: 'javascript:alert(1)' }],
  };
  const { ctx, p } = await contexto(nav, { status: CON, sesionada: true, ayuda: () => malo });
  await preguntas(p);
  await p.waitForSelector('.asis-entrada');
  await abre(p);
  await pregunta(p, 'Hola');
  ok(await p.evaluate(() => !window.colado && !document.querySelector('.asis-a img') && !document.querySelector('.asis-a b')), 'lo que contesta se pinta como texto');
  ok((await p.locator('.asis-a').innerText()).includes('<b>hola</b>'), '…y se lee tal cual');
  ok(await p.locator('.asis-a a').count() === 0, 'un enlace de fuera o una pantalla rara no salen');
  await ctx.close();
}

// ── Con cuenta y sin permiso ────────────────────────────────────────────
{
  const { ctx, p, estado } = await contexto(nav, { status: SIN_PERMISO, sesionada: true, rpc: { set_ai_consent: { ok: true } } });
  await preguntas(p);
  await p.waitForSelector('.asis-entrada');
  await abre(p);
  await p.click('.asis-botones .pill.accent');
  await p.waitForSelector('#asis-q');
  const c = estado.llamadas.find(([f]) => f === 'set_ai_consent');
  ok(c && c[1].p_granted === true && c[1].p_use === 'help_assistant', 'con cuenta el permiso se guarda, en su uso');
  await pregunta(p, 'Hola');
  ok(estado.ia[0].auth.startsWith('Bearer ') && estado.ia[0].body.consent === undefined, 'la pregunta lleva su sesión y no el permiso local');
  await ctx.close();
}

// ── No lo sabe: el correo, y la conversación solo si quiere ─────────────
{
  const { ctx, p } = await contexto(nav, { status: CON, sesionada: true, ayuda: () => NOLOSE });
  await preguntas(p);
  await p.waitForSelector('.asis-entrada');
  await abre(p);
  await pregunta(p, 'Algo que no está');
  const correo = p.locator('.asis-salidas a[href^="mailto:"]');
  ok((await correo.innerText()).includes('info@klendar.app'), 'ofrece el correo');
  ok(!(await correo.getAttribute('href')).includes('body='), 'sin adjuntar nada de serie');
  const caja = p.locator('.asis-casilla input');
  ok(!(await caja.isChecked()), 'la casilla, sin marcar');
  await caja.check();
  const con = await correo.getAttribute('href');
  ok(con.includes('body=') && decodeURIComponent(con).includes('Algo que no está'), 'marcada, va la conversación');
  await caja.uncheck();
  ok(!(await correo.getAttribute('href')).includes('body='), 'desmarcada, ya no');
  ok(await p.locator('.asis-salidas a', { hasText: 'Ver la Ayuda' }).getAttribute('href') === '/preguntas/', 'y la Ayuda');
  await ctx.close();
}

// ── Sin red, al tope, si falla ──────────────────────────────────────────
for (const [nombre, r, texto] of [
  ['sin red', 'red', 'Ahora no puedo responder'],
  ['al tope por el camino', { ok: false, why: 'cap' }, 'no está disponible ahora'],
  ['apagado por el camino', { ok: false, why: 'off' }, 'no está disponible ahora'],
  ['al máximo del día', { ok: false, why: 'daily' }, 'máximo de preguntas de hoy'],
  ['si falla', { ok: false, why: 'failed' }, 'Ahora no puedo responder'],
]) {
  const { ctx, p } = await contexto(nav, { status: CON, sesionada: true, ayuda: () => r });
  await preguntas(p);
  await p.waitForSelector('.asis-entrada');
  await abre(p);
  await pregunta(p, 'Hola');
  const t = await p.locator('.asis-error').innerText();
  ok(t.includes(texto), `${nombre}: lo dice`);
  ok(await p.locator('.asis-salidas a[href^="mailto:"]').count() === 1 && await p.locator('.asis-salidas a', { hasText: 'Ver la Ayuda' }).count() === 1, `${nombre}: la Ayuda y el correo`);
  ok(await p.locator('#asis-q').isEnabled(), `${nombre}: se puede seguir`);
  await ctx.close();
}

// ── Se acaba el tope entre abrir la página y entrar ─────────────────────
{
  const { ctx, p, estado } = await contexto(nav, { status: CON, sesionada: true });
  await preguntas(p);
  await p.waitForSelector('.asis-entrada');
  estado.status = { ...CON, available: false };
  await p.click('.asis-entrada');
  await p.waitForSelector('.asis-salidas');
  ok((await p.locator('.asis-cuerpo').innerText()).includes('no está disponible ahora'), 'al tope: la Ayuda de siempre y el correo');
  ok(await p.locator('#asis-q').count() === 0, '…sin campo');
  await ctx.close();
}

// ── Máximo de turnos ────────────────────────────────────────────────────
{
  const { ctx, p, estado } = await contexto(nav, { status: { ...CON, max_turns: 2 }, sesionada: true });
  await preguntas(p);
  await p.waitForSelector('.asis-entrada');
  await abre(p);
  await pregunta(p, 'Uno');
  await pregunta(p, 'Dos');
  ok(estado.ia[1].body.history.length === 1 && estado.ia[1].body.history[0].q === 'Uno', 'lleva la conversación');
  ok(!(await p.locator('.asis-form').isVisible()), 'al máximo de turnos no deja seguir');
  await p.click('.asis-log button');
  ok(await p.locator('.asis-form').isVisible() && await p.locator('.asis-q').count() === 0, '«Empezar otra conversación»');
  await ctx.close();
}

// ── Mientras contesta, la aguja ─────────────────────────────────────────
{
  const { ctx, p } = await contexto(nav, { status: CON, sesionada: true });
  await preguntas(p);
  await p.waitForSelector('.asis-entrada');
  await ctx.route(`${SUPA}/functions/v1/help-assistant`, async (route) => {
    await new Promise((r) => { setTimeout(r, 400); });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RESP) });
  });
  await abre(p);
  await p.fill('#asis-q', 'Hola');
  await p.click('.asis-form button[type=submit]');
  ok(await p.locator('.asis-espera .mov-ocupado').count() === 1, 'la aguja mientras contesta');
  ok((await p.locator('.asis-espera .asis-lector').innerText()).includes('Buscando'), '…con su texto para el lector de pantalla');
  await p.waitForFunction(() => !document.querySelector('.asis-espera'));
  await ctx.close();
}

// ── Inglés y francés; 320 px ────────────────────────────────────────────
{
  const { ctx, p, estado } = await contexto(nav, { status: ANON, lang: 'fr', width: 320 });
  await preguntas(p, '/en/faq/');
  await p.waitForSelector('.asis-entrada');
  ok((await p.locator('.asis-entrada').innerText()).includes('Demande à l\'assistant'), 'en francés');
  await abre(p);
  ok((await p.locator('.asis-cuerpo').innerText()).includes('Avant de commencer'), 'el aviso, en francés');
  const ancho = await p.evaluate(() => {
    const d = document.querySelector('dialog.asis');
    return d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= innerWidth + 1;
  });
  ok(ancho, 'a 320 px no se sale');
  await p.click('.asis-botones .pill.accent');
  await p.waitForSelector('#asis-q');
  await pregunta(p, 'Bonjour');
  ok(estado.ia[0].body.lang === 'fr', 'pregunta en francés');
  await p.screenshot({ path: `${OUT}/asistente-320-fr.png` });
  await ctx.close();
}
{
  const { ctx, p } = await contexto(nav, { status: ANON });
  await preguntas(p, '/en/faq/');
  await p.waitForSelector('.asis-entrada');
  ok((await p.locator('.asis-entrada').innerText()).includes('Ask the assistant'), '/en/faq/ en inglés');
  await ctx.close();
}

// ── «Sugerencias y mejoras» y Ajustes ───────────────────────────────────
{
  const cuenta = { my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true } };
  const { ctx, p, errores } = await contexto(nav, { status: CON, sesionada: true, rpc: cuenta });
  await p.goto(`${BASE}/cuenta/sugerencias`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.asis-entrada');
  ok(true, '«Sugerencias y mejoras» tiene la entrada');
  await abre(p);
  await pregunta(p, 'Hola');
  ok((await p.locator('.asis-a').innerText()).includes('Pide el código'), '…y funciona igual');
  ok(errores.length === 0, `sin errores (${errores})`);
  await ctx.close();
}
{
  const cuenta = { my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true }, set_ai_consent: { ok: true } };
  const { ctx, p, estado } = await contexto(nav, { status: CON, sesionada: true, rpc: cuenta });
  await p.goto(`${BASE}/cuenta/ajustes`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#permiso-ia-asistente', { state: 'attached' });
  await p.waitForFunction(() => !document.querySelector('#dd-ia-asistente').hidden);
  ok(await p.locator('#permiso-ia-asistente').isChecked(), 'en Ajustes, el permiso, si ya ha contestado');
  await p.locator('#permiso-ia-asistente').uncheck();
  await p.waitForTimeout(150);
  const c = estado.llamadas.filter(([f]) => f === 'set_ai_consent').pop();
  ok(c && c[1].p_granted === false && c[1].p_use === 'help_assistant', '…y se quita');
  await ctx.close();
}
{
  const cuenta = { my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true } };
  const { ctx, p } = await contexto(nav, { status: { ...CON, asked: false }, sesionada: true, rpc: cuenta });
  await p.goto(`${BASE}/cuenta/ajustes`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#dd-ia-asistente', { state: 'attached' });
  await p.waitForTimeout(150);
  ok(await p.locator('#dd-ia-asistente').evaluate((n) => n.hidden), 'sin haber contestado no sale');
  await ctx.close();
}

// ── Admin › Sistema › Automático ────────────────────────────────────────
{
  let encendido = false;
  const resumen = () => ({
    enabled: encendido, at_cap: false, cap_eur: 1, spent_eur: 0.0123, calls: 20, avg_eur: 0.0006, estimate_warm_eur: 0.0003, estimate_cold_eur: 0.0015, only_users: 0,
    max_turns: 6, user_day_cap: 15, anon_day_cap: 5, anon_global_day_cap: 200, states: { answer: 12, unknown: 5, injection: 2, grave: 1 },
    gaps: [{ topic: 'canjes', near: 'canjear', n: 3 }, { topic: 'otro', near: 'norma-resenas', n: 1 }, { topic: 'equipo', near: '', n: 1 }],
  });
  const { ctx, p, errores, estado } = await contexto(nav, { status: CON, sesionada: true, rpc: {
    admin_piloto_overview: { config: {}, ai: {}, week: { total: 0, undone: 0, by_kind: {} }, month: {}, actions: [], lists: { brand: 0, official_domain: 0 } },
    admin_piloto_list: [],
    admin_photo_fill_overview: { enabled: false, only_users: 0, cap_eur: 1, spent_eur: 0, calls: 0, avg_eur: null, estimate_offer_eur: 0.0006, estimate_menu_photo_eur: 0.002, max_edge: 1600, ok_rate: null },
    admin_ai_help_overview: { only_users: 0, min_chars: 25, suggest_day_cap: 40, reply_day_cap: 20, review_notice_from: null, ideas_businesses: 0, uses: [] },
    admin_assistant_overview: () => resumen(),
    admin_assistant_set: (b) => { encendido = b.p_enabled; return { ok: true, enabled: b.p_enabled }; },
  } });
  await p.goto(`${BASE}/admin/#/automatico`);
  await p.waitForSelector('[data-asistente-on]');
  const caja = p.locator('[data-asistente-on]').locator('xpath=ancestor::div[contains(@class,"card")]');
  const txt = await caja.innerText();
  ok(/Asistente de ayuda/.test(txt) && /apagado/.test(txt), 'admin: apagado');
  ok(/0,012/.test(txt) && /1,00\s€/.test(txt) && /20 llamadas/.test(txt), 'admin: lo gastado, contra su tope');
  ok(/Estimado, sin medir/.test(txt), 'admin: el coste estimado');
  ok(/Contestadas: 12/.test(txt) && /No lo sabía: 5/.test(txt) && /Intentos de engañarlo: 2/.test(txt), 'admin: los resultados del mes');
  ok(/Lo que no supo responder/.test(txt), 'admin: lo que no supo');
  ok(/Canjes/.test(txt) && /¿Cómo se canjea una oferta\?/.test(txt), 'admin: agrupado, con su tema y el apartado cercano');
  ok(await caja.locator('a[href="/preguntas/#canjear"]').count() === 1, 'admin: enlaza a ese apartado');
  await p.click('[data-asistente-on]');
  await p.waitForFunction(() => document.querySelector('[data-asistente-on]')?.dataset.asistenteOn === '1');
  ok(estado.llamadas.some(([f, b]) => f === 'admin_assistant_set' && b.p_enabled === true), 'admin: se enciende');
  await p.click('[data-asistente-on]');
  await p.waitForFunction(() => document.querySelector('[data-asistente-on]')?.dataset.asistenteOn === '');
  ok(estado.llamadas.some(([f, b]) => f === 'admin_assistant_set' && b.p_enabled === false), 'admin: se apaga');
  ok(errores.length === 0, `admin: sin errores (${errores.join(' | ')})`);
  await p.screenshot({ path: `${OUT}/asistente-admin.png`, fullPage: true });
  await ctx.close();
}

await nav.close();
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
