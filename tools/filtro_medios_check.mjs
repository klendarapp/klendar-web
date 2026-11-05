// El filtro de fotos y vídeos en la web, con Supabase contestado aquí (no toca dev
// ni prod): la cola del admin (aprobar en un toque, rechazar en dos, con el motivo),
// «Límites gratis» y «Pendiente de ti» en el Resumen, «Lo estamos revisando» en el
// panel y en «Tu cuenta» (en francés también) y los fotogramas antes que el vídeo.
//
//   SUPABASE_BLOQUEADO=1 PORT=8896 node tools/serve_dev.mjs &
//   BASE=http://localhost:8896 PW=<ruta a playwright> OUT=<carpeta> node tools/filtro_medios_check.mjs
import { playwright, REF, SUPA, realtimeMudo, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium } = playwright();
const BASE = process.env.BASE || 'http://localhost:8896';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });

const U = '0e7717e0-0000-4000-8000-0000000097d4';
const B = '0e7717e0-0000-4000-8000-00000000b12d';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ahora = Math.floor(Date.now() / 1000);
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aal: 'aal2', exp: 4102444800, amr: [{ method: 'password', timestamp: ahora }] })}.x`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'filtro@example.com', app_metadata: {}, user_metadata: { display_name: 'Filtro' }, created_at: '2026-01-01T00:00:00Z' };
const SESION = JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let fallos = 0;
function ok(cond, nombre, extra = '') {
  if (cond) console.log(`  ok  ${nombre}`);
  else { fallos += 1; console.log(`  MAL ${nombre} ${extra}`); }
}

const fila = (over) => ({
  id: 'a0000000-0000-4000-8000-000000000001', name: `${B}/uno.jpg`, kind: 'image', state: 'held', hold_reason: 'doubt',
  labels: { adult: 'POSSIBLE', violence: 'VERY_UNLIKELY', racy: 'LIKELY' }, created_at: '2026-11-05T10:00:00Z', origin: 'upload',
  attempts: 0, in_held: true, last_error: null, business_id: B, business: 'Bar Prueba', city: 'Málaga', user_email: 'dueno@example.com',
  used_in: ['Galería de la ficha', 'Publicación: Cañas'], frames: [], ...over,
});

async function abre(nav, { lang = 'es', claveAdmin = false }) {
  const ctx = await nav.newContext({ viewport: { width: 1200, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, a, l]) => {
    try {
      localStorage.setItem(k, v);
      if (a) localStorage.setItem(a, v);
      localStorage.setItem('klendar_lang', l);
    } catch { /* */ }
  }, [`sb-${REF}-auth-token`, SESION, claveAdmin ? `sb-${REF}-admin-auth-token` : '', lang]);
  const estado = { rpc: [], subidas: [] };
  const cola = { held: [fila(), fila({ id: 'a0000000-0000-4000-8000-000000000002', name: `${B}/dos.mp4`, kind: 'video', hold_reason: 'no_frames', labels: null, used_in: [] }), fila({ id: 'a0000000-0000-4000-8000-000000000003', name: `${B}/tres.jpg`, hold_reason: 'cap', labels: null })],
    rejected: [fila({ id: 'a0000000-0000-4000-8000-000000000004', name: `${B}/cuatro.jpg`, state: 'rejected', hold_reason: null, labels: { adult: 'VERY_LIKELY' } })] };
  const textos = { held: [{ id: 'b0000000-0000-4000-8000-000000000001', kind: 'review', text: 'Texto dudoso de prueba', state: 'dudoso', grave: false, decided_by: 'ai', provider: 'claude', motive: 'hate', reason: 'Puede ser odio', created_at: '2026-11-05T10:00:00Z', business: 'Bar Prueba', business_id: B, city: 'Málaga', user_email: 'a@example.com' }], rejected: [] };
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.pathname.startsWith('/auth/v1/user')) return json(USER);
    if (url.pathname.startsWith('/auth/v1/factors') || url.pathname.startsWith('/auth/v1/')) return json({});
    if (url.pathname.startsWith('/storage/v1/object/sign/')) {
      if (req.method() === 'POST') return json({ signedURL: '/object/sign/media-held/x.jpg?token=t' });
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    if (url.pathname.startsWith('/storage/v1/object/')) {
      if (req.method() === 'POST') {
        estado.subidas.push(url.pathname.replace('/storage/v1/object/business-images/', ''));
        return json({ Key: 'x' });
      }
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.split('/').pop();
      const cuerpo = req.postData() ? JSON.parse(req.postData()) : {};
      estado.rpc.push({ fn, cuerpo });
      if (fn === 'admin_media_queue') {
        return json({ config: { enabled: false, test_users: 1, cap: 900, used: 12 }, counts: { held: cola.held.length, rejected: cola.rejected.length }, rows: cola[cuerpo.p_tab === 'rejected' ? 'rejected' : 'held'] });
      }
      if (fn === 'admin_media_decide') {
        cola.held = cola.held.filter((x) => x.id !== cuerpo.p_id);
        return json({ ok: true, state: cuerpo.p_approve ? 'approved' : 'rejected' });
      }
      if (fn === 'admin_kpis') return json({ businesses_pending: 0, reports_open: 0, offers_pending: 0 });
      if (fn === 'admin_attention') {
        return json({ pending: { media_held: 3 }, tasks: { crons: [], agenda: [], leagues: [], billing: {} }, urgent: [
          { key: 'free:resend_day:x:warn', kind: 'free_tier', title: 'Resend · correos hoy (día UTC)', pct: 82, level: 'warn', count: 1, at: '2026-11-05T00:00:00Z', due: true, detail: 'Plan Free.' },
          { key: 'media:held', kind: 'media', title: 'held', count: 3, at: '2026-11-05T10:00:00Z', due: true },
          { key: 'autohide:offer:o', kind: 'autohide', title: 'offer', target_type: 'offer', target_id: 'o', count: 3, at: '2026-11-05T10:00:00Z', due: true },
        ], alerts: { config: { email: true } }, media_filter: { enabled: false },
        free_tier_cfg: { warn_pct: 80 },
        free_tier: [
          { id: 'resend_day', service: 'Resend', metric: 'correos hoy (día UTC)', unit: 'emails', used: 82, limit: 100, pct: 82, level: 'warn' },
          { id: 'vision_month', service: 'Google Vision', metric: 'imágenes este mes', unit: 'units', used: 900, limit: 900, pct: 100, level: 'over' },
          { id: 'supabase_db', service: 'Supabase', metric: 'tamaño de la base', unit: 'bytes', used: 178261139, limit: 8589934592, pct: 2.1, level: 'ok' },
        ] });
      }
      if (fn === 'my_held_media') {
        return json([{ id: '1', name: `${B}/uno.jpg`, kind: 'image', state: 'held', in_held: true, created_at: '2026-11-05T10:00:00Z' },
          { id: '2', name: `${B}/dos.mp4`, kind: 'video', state: 'held', in_held: true, created_at: '2026-11-05T10:00:00Z' },
          { id: '3', name: `${B}/tres.jpg`, kind: 'image', state: 'rejected', in_held: true, created_at: '2026-11-05T10:00:00Z' }]);
      }
      if (fn === 'media_filter_on') return json(true);
      if (fn === 'admin_content_queue') {
        return json({ config: { enabled: false }, counts: { held: textos[cuerpo.p_tab === 'rejected' ? 'rejected' : 'held'].length, rejected: 0 }, rows: textos[cuerpo.p_tab === 'rejected' ? 'rejected' : 'held'] });
      }
      if (fn === 'admin_content_decide') {
        textos.held = textos.held.filter((x) => x.id !== cuerpo.p_id);
        return json({ ok: true, state: 'publicar' });
      }
      if (fn === 'admin_media_approve_bulk') { cola.held = cola.held.filter((x) => !['cap', 'error'].includes(x.hold_reason)); return json({ ok: true, approved: 1 }); }
      if (fn === 'ai_consent_needed') return json(true);
      if (fn === 'set_ai_consent') return json({ ok: true, granted: cuerpo.p_granted });
      if (fn === 'my_businesses') return json([{ id: B, name: 'Café Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Málaga' }]);
      if (fn === 'my_business_offer_counts') return json({ total: 1, todas: 1, activa: 1 });
      if (fn === 'business_is_organizer') return json(false);
      if (fn === 'my_entity_application') return json({ entity_kind: null, application: null, can_apply: true });
      if (fn === 'my_tastes') return json({ categories: ['bares'], asked_at: '2026-01-01T00:00:00Z' });
      if (fn === 'my_consents') return json({ terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, has_birth_date: true });
      return json(null);
    }
    if (url.pathname.startsWith('/rest/v1/admin_users')) return json([{ user_id: U }]);
    if (url.pathname.startsWith('/rest/v1/profiles')) {
      const f = { id: U, display_name: 'Ana', avatar_url: null, birth_date: '1990-01-01', locale: lang };
      return json(req.headers().accept?.includes('vnd.pgrst.object') ? f : [f]);
    }
    return json([]);
  });
  await realtimeMudo(ctx);
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  return { ctx, page, estado, errores };
}

const nav = await chromium.launch();

// ── La cola del admin ──────────────────────────────────────────────────────
{
  const { ctx, page, estado, errores } = await abre(nav, { claveAdmin: true });
  await page.goto(`${BASE}/admin/#/medios`);
  await page.waitForSelector('.med-fila', { timeout: 15000 }).catch(() => {});
  const texto = await page.locator('main, body').first().innerText();
  ok(await page.locator('.med-fila').count() === 3, 'la cola enseña lo retenido', texto.slice(0, 300));
  ok(/Texto dudoso de prueba/.test(texto) && /Reseña/.test(texto) && /Odio/.test(texto) && /IA/.test(texto), 'y los textos, con quién decidió y el motivo');
  ok(/Aprobar en bloque/.test(texto), 'con la cola por la caída o el tope, aprobar en bloque');
  await page.locator('[data-tok]').first().click();
  await page.waitForFunction(() => !document.querySelector('[data-tok]'));
  ok(estado.rpc.some((r) => r.fn === 'admin_content_decide' && r.cuerpo.p_approve === true), 'aprobar un texto: un toque');
  ok(/El filtro está apagado/.test(texto), 'dice que está apagado');
  ok(/En duda/.test(texto) && /Tope del mes/.test(texto) && /Vídeo sin fotogramas/.test(texto), 'cada una con su motivo');
  ok(/Desnudos: Posible/.test(texto) && !/VERY_UNLIKELY/.test(texto), 'las puntuaciones, en llano y solo lo que importa');
  ok(/Galería de la ficha/.test(texto), 'dónde se usa');
  ok(await page.locator('.med-fila img.med-grande').first().evaluate((i) => i.src.includes('token=t')), 'el original, con enlace firmado');
  ok(await page.locator('.med-fila video.med-grande').count() === 1, 'el vídeo se puede ver');
  await page.screenshot({ path: `${OUT}/filtro-cola.png`, fullPage: true });
  // Aprobar: un toque.
  await page.locator('[data-ok]').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.med-fila').length === 2);
  const ap = estado.rpc.find((r) => r.fn === 'admin_media_decide');
  ok(ap?.cuerpo.p_approve === true, 'aprobar: un toque');
  // Rechazar: dos.
  await page.locator('[data-no]').first().click();
  await page.waitForSelector('.med-razones .btn');
  await page.screenshot({ path: `${OUT}/filtro-motivo.png` });
  await page.locator('.med-razones .btn').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.med-fila').length === 1);
  const re = estado.rpc.filter((r) => r.fn === 'admin_media_decide')[1];
  ok(re?.cuerpo.p_approve === false && /desnudos/.test(re?.cuerpo.p_reason || ''), 'rechazar: dos toques, con el motivo', JSON.stringify(re));
  // La pestaña de lo rechazado por el filtro.
  await page.locator('#medTabs [data-t="rejected"]').click();
  await page.waitForFunction(() => document.querySelector('[data-ok]')?.textContent.includes('Recuperar')).catch(() => {});
  ok(/Recuperar/.test(await page.locator('.med-fila').first().innerText()), 'lo rechazado por el filtro se puede recuperar');
  ok(!errores.length, 'sin errores de JavaScript', errores.join(' | '));
  await ctx.close();
}

// ── El Resumen ─────────────────────────────────────────────────────────────
{
  const { ctx, page, errores } = await abre(nav, { claveAdmin: true });
  await page.goto(`${BASE}/admin/#/resumen`);
  await page.waitForSelector('#limitesGratis', { timeout: 15000 }).catch(() => {});
  const texto = await page.locator('body').innerText();
  ok(/Límites gratis/.test(texto), 'el Resumen enseña los límites gratis');
  ok(/82 \/ 100/.test(texto) && /82 %/.test(texto), '…con sus cifras');
  ok(/170 MB \/ 8\.0 GB/.test(texto), '…en MB y GB', texto.match(/[0-9.]+ [MG]B[^\n]*/)?.[0]);
  ok(/3\s*fotos o vídeos retenidos/.test(texto.replace(/\n/g, ' ')), 'y «Pendiente de ti» los cuenta', texto.slice(0, 400));
  ok(/Al 82 % del límite gratis/.test(texto), '«Para mirar ya»: el límite');
  ok(/Oculto por denuncias/.test(texto), '«Para mirar ya»: lo oculto por denuncias');
  await page.locator('#limitesGratis').screenshot({ path: `${OUT}/filtro-limites.png` }).catch(() => {});
  ok(!errores.length, 'sin errores de JavaScript', errores.join(' | '));
  await ctx.close();
}

// ── «Lo estamos revisando» y los fotogramas, sin el resto de la pantalla ───
for (const [lang, titulo, cuerpo, fuera] of [
  ['es', 'Lo estamos revisando', 'solo lo ves tú', 'No se ha publicado'],
  ['fr', 'Nous le vérifions', 'toi seul', 'Cela n’a pas été publié'],
]) {
  const { ctx, page, estado, errores } = await abre(nav, { lang });
  await page.goto(`${BASE}/cuenta/`);
  await page.waitForSelector('.retenido-fotos', { timeout: 15000 }).catch(() => {});
  const t = await page.locator('.retenido', { has: page.locator('.retenido-fotos') }).innerText().catch(() => '');
  ok(t.includes(titulo) && t.includes(cuerpo) && t.includes(fuera), `«Tu cuenta» (${lang}): el mensaje, sin culpar`, t);
  ok(await page.locator('.retenido-video').count() === 1, `«Tu cuenta» (${lang}): un vídeo sin miniatura no se rompe`);
  const permiso = await page.locator('#aviso-permiso-ia').innerText().catch(() => '');
  ok(/Google Cloud/.test(permiso), `«Tu cuenta» (${lang}): pide permiso, diciendo a quién va`, permiso);
  await page.locator('[data-ia="si"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-ia="si"]'));
  ok(estado.rpc.some((r) => r.fn === 'set_ai_consent' && r.cuerpo.p_granted === true), `«Tu cuenta» (${lang}): aceptar lo guarda`);
  if (lang === 'es') await page.screenshot({ path: `${OUT}/filtro-cuenta.png` });
  ok(!errores.length, `«Tu cuenta» (${lang}): sin errores de JavaScript`, errores.join(' | '));
  await ctx.close();
}

{
  // El Resumen del panel: lo del negocio, arriba y por encima de lo demás.
  const { ctx, page, estado, errores } = await abre(nav, {});
  await page.goto(`${BASE}/panel/#/resumen`);
  await page.waitForSelector('.retenido-fotos', { timeout: 15000 }).catch(() => {});
  const t = await page.locator('.retenido', { has: page.locator('.retenido-fotos') }).innerText().catch(() => '');
  ok(t.includes('Lo estamos revisando') && t.includes('No se ha publicado'), 'panel: el mensaje en el Resumen', t || (await page.locator('body').innerText()).slice(0, 300));
  ok(estado.rpc.some((r) => r.fn === 'my_held_media' && r.cuerpo.p_business === B), 'panel: pide lo de este negocio');
  await page.screenshot({ path: `${OUT}/filtro-panel.png` });
  ok(!errores.length, 'panel: sin errores de JavaScript', errores.join(' | '));
  await ctx.close();
}

{
  // Los fotogramas se piden antes de subir el vídeo y van con el nombre que espera la base.
  const { ctx, page, estado } = await abre(nav, {});
  await page.goto(`${BASE}/cuenta/`);
  const r = await page.evaluate(async () => {
    const lienzo = document.createElement('canvas');
    lienzo.width = 64; lienzo.height = 48;
    lienzo.getContext('2d').fillRect(0, 0, 64, 48);
    const flujo = lienzo.captureStream(10);
    const grab = new MediaRecorder(flujo, { mimeType: 'video/webm' });
    const trozos = [];
    grab.ondataavailable = (e) => trozos.push(e.data);
    const fin = new Promise((ok) => { grab.onstop = ok; });
    grab.start();
    const pinta = setInterval(() => { lienzo.getContext('2d').fillRect(Math.random() * 60, 0, 4, 48); }, 50);
    await new Promise((ok) => setTimeout(ok, 1200));
    grab.stop(); clearInterval(pinta); await fin;
    const video = new File(trozos, 'v.webm', { type: 'video/webm' });
    const hechos = [];
    const sbFalso = { rpc: async () => ({ data: true, error: null }) };
    const n = await KFotogramas.sube(sbFalso, 'neg/abc', video, async (ruta, blob) => { hechos.push([ruta, blob.type]); });
    const apagado = await KFotogramas.sube({ rpc: async () => ({ data: false }) }, 'neg/abc', video, async () => { hechos.push(['no']); });
    return { n, hechos, apagado };
  });
  ok(r.apagado === 0 && !r.hechos.some((h) => h[0] === 'no'), 'filtro apagado: no se sacan fotogramas');
  ok(r.n >= 1 && r.hechos.every((h, i) => h[0] === `neg/abc-frame${i + 1}.jpg` && h[1] === 'image/jpeg'), 'filtro encendido: JPEG con el nombre que espera la base', JSON.stringify(r));
  void estado;
  await ctx.close();
}

await nav.close();
console.log(fallos ? `\n${fallos} MAL` : '\nTODO BIEN');
process.exit(fallos ? 1 : 0);
