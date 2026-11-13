// La bandeja del admin (Resumen › «Pendiente de ti», admin/bandeja.js), con Supabase contestado aquí
// (tools/_bandeja_datos.mjs; no toca dev ni prod): una tarjeta por caso, lo que dice la máquina, decidir
// allí mismo con los diálogos de siempre, «Aprobar todos los que cuadran», el filtro, el orden por
// urgencia y el móvil (sin desplazamiento lateral, campos de 16 px). Deja capturas en OUT.
//
//   SUPABASE_BLOQUEADO=1 PORT=8897 node tools/serve_dev.mjs &
//   BASE=http://localhost:8897 PW=<ruta a playwright> OUT=<carpeta> node tools/bandeja_check.mjs
import { playwright, REF, SUPA, realtimeMudo, servidorSeguro } from './_supabase_simulado.mjs';
import { contesta, estadoInicial, IDS } from './_bandeja_datos.mjs';

const { chromium } = playwright();
const BASE = process.env.BASE || 'http://localhost:8897';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });

const U = IDS.admin;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ahora = Math.floor(Date.now() / 1000);
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aal: 'aal2', exp: 4102444800, amr: [{ method: 'password', timestamp: ahora }] })}.x`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: {}, user_metadata: { display_name: 'Admin' }, created_at: '2026-01-01T00:00:00Z' };
const SESION = JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

let fallos = 0;
function ok(cond, nombre, extra = '') {
  if (cond) console.log(`  ok  ${nombre}`);
  else { fallos += 1; console.log(`  MAL ${nombre} ${String(extra).slice(0, 400)}`); }
}

async function abre(nav, { ancho = 1280, alto = 900, movil = false, lang = 'es' } = {}) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: movil ? 3 : 1, isMobile: movil, hasTouch: movil, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, a, l]) => {
    try { localStorage.setItem(k, v); localStorage.setItem(a, v); localStorage.setItem('klendar_lang', l); localStorage.removeItem('klendar.admin.bandeja.filtro'); } catch { /* */ }
  }, [`sb-${REF}-auth-token`, SESION, `sb-${REF}-admin-auth-token`, lang]);
  const estado = estadoInicial();
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.pathname.startsWith('/auth/v1/user')) return json(USER);
    if (url.pathname.startsWith('/auth/v1/')) return json({});
    if (url.pathname.startsWith('/storage/v1/object/sign/')) return json({ signedURL: '/storage/v1/object/sign/x.jpg?token=t' });
    if (url.pathname.startsWith('/storage/v1/')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#bbb"/></svg>' });
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.split('/').pop();
      const cuerpo = req.postData() ? JSON.parse(req.postData()) : {};
      return json(contesta(fn, cuerpo, estado));
    }
    if (url.pathname.startsWith('/rest/v1/admin_users')) return json([{ user_id: U }]);
    if (url.pathname.startsWith('/rest/v1/')) return json([]);
    return json({});
  });
  await realtimeMudo(ctx);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  return { ctx, page, estado, errs };
}

const tarjeta = (page, texto) => page.locator('#bandeja .bj', { hasText: texto }).first();
const enviaModal = async (page, campos = {}) => {
  await page.waitForSelector('#modal[open] form', { timeout: 8000 });
  for (const [k, v] of Object.entries(campos)) await page.fill(`#modal [name="${k}"]`, v);
  await page.click('#modal [type=submit]');
  await page.waitForSelector('#modal:not([open])', { state: 'attached', timeout: 8000 });
};
const cuantas = (page) => page.$$eval('#bandeja .bj', (xs) => xs.length);

const nav = await chromium.launch();

console.log('Escritorio');
{
  const { ctx, page, estado, errs } = await abre(nav);
  await page.goto(`${BASE}/admin#/resumen`, { waitUntil: 'load' });
  await page.waitForSelector('#bandeja .bj', { timeout: 15000 });
  const n0 = await cuantas(page);
  ok(n0 >= 18, 'una tarjeta por caso, de todos los tipos', n0);
  ok((await page.textContent('#bandejaN')).trim() === String(n0), 'el número de arriba cuenta las tarjetas');
  const llamadas = new Set(estado.rpc.map((x) => x.fn));
  ok(['admin_inbox_extra', 'admin_pending_now', 'admin_entity_applications', 'admin_business_claims', 'admin_report_groups', 'admin_media_queue', 'admin_content_queue',
    'admin_offers_page', 'admin_text_reviews', 'admin_business_messages', 'admin_duplicate_alerts', 'admin_feedback'].every((f) => llamadas.has(f)), 'pide cada cola con su función de siempre');
  ok((await page.$$('#view .loading')).length === 0, 'una sola rueda de carga, y se va');
  const primera = await page.locator('#bandeja .bj').first().textContent();
  ok(primera.includes('Fiesta de fin de semana') && primera.includes('grave'), 'lo grave, lo primero', primera.slice(0, 120));
  ok((await tarjeta(page, 'Taberna La Esquina').textContent()).includes('Todo cuadra ✔'), 'negocio que cuadra: «Todo cuadra ✔»');
  ok((await tarjeta(page, 'Burguer Kin').textContent()).includes('Por qué te llega'), 'negocio que no: «Por qué te llega»');
  const den = await tarjeta(page, 'El servicio fue lento').textContent();
  ok(den.includes('La IA cree que no pasa nada') && den.includes('92 %') && den.includes('decides tú'), 'la denuncia, con lo que opina la IA y su confianza', den);
  ok((await tarjeta(page, 'Asociación Vecinal El Palo').textContent()).includes('El documento coincide ✔'), 'entidad: «El documento coincide ✔»');
  ok((await tarjeta(page, 'Café Central').textContent()).includes('Código correcto ✔'), 'reclamación: «Código correcto ✔»');
  ok((await tarjeta(page, 'Ronda').textContent()).includes('Faltan las fiestas locales de Ronda (Málaga)'), 'festivos: «Faltan las fiestas locales de <municipio> (<año>)»');
  ok((await page.$$('#bandeja .bj a.bj-abrir')).length >= n0 - 1, 'cada tarjeta, «Abrir en su apartado»');
  // Coral, solo en el botón principal.
  const corales = await page.$$eval('#bandeja .btn.primary', (xs) => xs.filter((x) => !x.hidden).length);
  ok(corales === 1, 'coral solo en «Aprobar todos los que cuadran»', corales);
  await page.screenshot({ path: `${OUT}/bandeja_escritorio.png`, fullPage: false });
  const caja = await page.$('#bandeja');
  await caja.screenshot({ path: `${OUT}/bandeja_escritorio_entera.png` });

  console.log('  filtro');
  await page.click('#bandejaFiltros [data-f="denuncia"]');
  const visibles = await page.$$eval('#bandeja .bj', (xs) => xs.filter((x) => !x.hidden).map((x) => x.dataset.tipo));
  ok(visibles.length === 2 && visibles.every((t) => t === 'denuncia'), 'filtrar por tipo', visibles.join(','));
  await page.click('#bandejaFiltros [data-f=""]');

  console.log('  aprobar todos los que cuadran');
  ok((await page.textContent('#bandejaListosN')).trim() === '2', 'cuenta los dos que cuadran (la entidad con documento no)');
  await page.click('#bandejaListos');
  await page.waitForSelector('#modal[open]', { timeout: 8000 });
  const lista = await page.textContent('#modal');
  ok(lista.includes('Taberna La Esquina') && lista.includes('Peluquería Sol') && !lista.includes('El Palo'), 'la lista de lo que se va a aprobar', lista.slice(0, 300));
  await page.click('#modal [type=submit]');
  await page.waitForFunction((k) => !document.querySelector(`#bandeja .bj[data-k="${k}"]`), `negocio:${IDS.negocioListo}`, { timeout: 8000 });
  const r = estado.rpc.find((x) => x.fn === 'admin_approve_ready');
  ok(r && r.cuerpo.p_businesses.length === 2 && r.cuerpo.p_entities.length === 0, 'manda los dos a la base, que lo vuelve a mirar', JSON.stringify(r?.cuerpo));
  ok((await tarjeta(page, 'Peluquería Sol').textContent()).includes('Ya no cuadra'), 'el que ya no cuadra se queda, con su motivo');
  ok(await page.isHidden('#bandejaListos'), 'sin más que cuadren, el botón se va');
  ok((await page.textContent('#bandejaN')).trim() === String(n0 - 1), 'los números, al día');

  console.log('  decidir en la tarjeta');
  await tarjeta(page, 'Burguer Kin').locator('button', { hasText: 'Rechazar' }).click();
  await enviaModal(page, { reason: 'No encontramos el local en esa dirección.' });
  await page.waitForFunction(() => ![...document.querySelectorAll('#bandeja .bj')].some((x) => x.textContent.includes('Burguer Kin')), null, { timeout: 8000 });
  const rech = estado.rpc.find((x) => x.fn === 'admin_set_verification' && x.cuerpo.p_status === 'rejected');
  ok(rech && rech.cuerpo.p_id === IDS.negocioNo && rech.cuerpo.p_reason.includes('No encontramos'), 'rechazar con motivo, con el diálogo de siempre');
  await tarjeta(page, 'El servicio fue lento').locator('button', { hasText: 'Cerrar sin retirar' }).click();
  await enviaModal(page);
  await page.waitForFunction(() => ![...document.querySelectorAll('#bandeja .bj')].some((x) => x.textContent.includes('El servicio fue lento')), null, { timeout: 8000 });
  ok(estado.rpc.some((x) => x.fn === 'admin_resolve_report_group' && x.cuerpo.p_decision === 'keep' && x.cuerpo.p_id === IDS.denunciaNada), 'denuncia: «Cerrar sin retirar» decide Iván');
  await tarjeta(page, 'Ronda').locator('button', { hasText: 'Añadir las fiestas' }).click();
  const anio = new Date().getFullYear();
  await enviaModal(page, { d1: `${anio}-05-20`, n1: 'Feria de Mayo', d2: `${anio}-09-08`, n2: 'Feria de Pedro Romero', source: 'BOJA núm. 1, 2026' });
  await page.waitForFunction(() => ![...document.querySelectorAll('#bandeja .bj')].some((x) => x.textContent.includes('Ronda')), null, { timeout: 8000 });
  const fest = estado.rpc.find((x) => x.fn === 'admin_save_city_holidays');
  ok(fest && fest.cuerpo.p_city === '29084' && fest.cuerpo.p_days.length === 2, 'festivos: dos fechas y se guardan como en «Festivos»', JSON.stringify(fest?.cuerpo));
  await tarjeta(page, 'hay que pagar una comisión').locator('button', { hasText: 'Visto' }).click();
  await page.waitForFunction(() => ![...document.querySelectorAll('#bandeja .bj')].some((x) => x.textContent.includes('hay que pagar una comisión')), null, { timeout: 8000 });
  ok(estado.rpc.some((x) => x.fn === 'admin_ai_report_seen' && x.cuerpo.p_id === IDS.avisoIA), 'respuesta de la IA: «Visto» la quita');
  await tarjeta(page, 'Mesón Andaluz').locator('button', { hasText: 'No es duplicado' }).click();
  await enviaModal(page);
  await page.waitForFunction(() => ![...document.querySelectorAll('#bandeja .bj')].some((x) => x.textContent.includes('Mesón Andaluz')), null, { timeout: 8000 });
  ok(estado.rpc.some((x) => x.fn === 'admin_dismiss_duplicate'), 'duplicado: «No es duplicado»');
  await tarjeta(page, 'Noche de póker').locator('button', { hasText: 'Enviar' }).click();
  await enviaModal(page);
  await page.waitForFunction(() => ![...document.querySelectorAll('#bandeja .bj')].some((x) => x.textContent.includes('Noche de póker')), null, { timeout: 8000 });
  ok(estado.rpc.some((x) => x.fn === 'admin_review_business_message' && x.cuerpo.p_approve === true), 'mensaje a clientes: enviar');
  // Cancelar un diálogo no quita nada.
  const antes = await cuantas(page);
  await tarjeta(page, 'Floristería Rosa').locator('button', { hasText: 'Marcar gestionada' }).click();
  await page.waitForSelector('#modal[open]', { timeout: 8000 });
  await page.click('#modal [data-cancel]');
  ok(await cuantas(page) === antes, 'cancelar el diálogo no quita la tarjeta');
  ok((await page.textContent('#bandejaN')).trim() === String(antes), 'y el número sigue igual');
  ok(errs.length === 0, 'sin errores de JavaScript', errs.join(' | '));
  await ctx.close();
}

for (const [nombre, ancho, alto] of [['iPhone (390)', 390, 844], ['móvil estrecho (320)', 320, 640]]) {
  console.log(`Móvil · ${nombre}`);
  const { ctx, page, errs } = await abre(nav, { ancho, alto, movil: true });
  await page.goto(`${BASE}/admin#/resumen`, { waitUntil: 'load' });
  await page.waitForSelector('#bandeja .bj', { timeout: 15000 });
  const lateral = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(lateral <= 0, 'sin desplazamiento lateral', lateral);
  const anchas = await page.$$eval('#bandeja .bj', (xs) => xs.filter((x) => x.getBoundingClientRect().right > window.innerWidth + 1).length);
  ok(anchas === 0, 'ninguna tarjeta se sale', anchas);
  ok(await page.isVisible('#bandejaSel') && await page.isHidden('.bandeja-chips'), 'en el móvil, el filtro es un desplegable');
  await page.selectOption('#bandejaSel', 'denuncia');
  const vis = await page.$$eval('#bandeja .bj', (xs) => xs.filter((x) => !x.hidden).map((x) => x.dataset.tipo));
  ok(vis.length === 2 && vis.every((t) => t === 'denuncia'), 'y filtra', vis.join(','));
  await page.selectOption('#bandejaSel', '');
  const pequenos = await page.$$eval('#bandeja .bj-acc .btn', (xs) => xs.filter((x) => x.getBoundingClientRect().height < 36).length);
  ok(pequenos === 0, 'botones de al menos 36 px de alto', pequenos);
  if (ancho === 390) {
    await page.screenshot({ path: `${OUT}/bandeja_movil.png` });
    await page.addStyleTag({ content: '.topbar { position: static !important; }' });
    await page.locator('#bandeja').screenshot({ path: `${OUT}/bandeja_movil_entera.png` });
  }
  await tarjeta(page, 'Burguer Kin').locator('button', { hasText: 'Rechazar' }).click();
  await page.waitForSelector('#modal[open] textarea', { timeout: 8000 });
  const letra = await page.$eval('#modal textarea', (x) => parseFloat(getComputedStyle(x).fontSize));
  ok(letra >= 16, 'los campos del diálogo, de 16 px (el iPhone no amplía)', letra);
  if (ancho === 390) await page.screenshot({ path: `${OUT}/bandeja_movil_dialogo.png` });
  await page.click('#modal [data-cancel]');
  ok(errs.length === 0, 'sin errores de JavaScript', errs.join(' | '));
  await ctx.close();
}

console.log('En inglés');
{
  const { ctx, page, errs } = await abre(nav, { lang: 'en' });
  await page.goto(`${BASE}/admin#/resumen`, { waitUntil: 'load' });
  await page.waitForSelector('#bandeja .bj', { timeout: 15000 });
  const t = await page.textContent('#bandeja');
  ok(t.includes('Waiting for you') && t.includes('Approve all that check out') && t.includes('Everything checks out'), 'los textos en inglés', t.slice(0, 200));
  ok(errs.length === 0, 'sin errores de JavaScript', errs.join(' | '));
  await ctx.close();
}

await nav.close();
console.log(fallos ? `\n${fallos} MAL` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
