// Crecer (2026-10-14): «Pedir un local» y «Avísame cuando Klendar llegue» en
// la web, en Chromium y WebKit, móvil (375) y escritorio. Sin sesión (no se
// teclean contraseñas): comprueba
//  1. Explorar con una búsqueda sin negocios: el bloque «Pide que esté en
//     Klendar» lleva a «Tu cuenta» con el nombre;
//  2. Descubre en Teruel (sin Klendar): el estado vacío centrado con
//     «Avísame cuando llegue», «Elegir una ciudad» y «Pedir un local»; al
//     pulsar, el formulario de correo; con un correo de @example.com (no se
//     manda nada) dice «Mira tu correo»;
//  3. Descubre en Madrid: el vacío de siempre no sale (hay Klendar);
//  4. /avisame/confirmar|baja/<token falso>: pregunta (GET) y, al pulsar,
//     «Ese enlace ya no vale»;
//  5. sin errores en la consola. Capturas en OUT.
//
//   PORT=8811 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> node tools/crecer_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8811';
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });

let fallos = 0;
const ok = (nombre, cond, detalle = '') => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}${cond || !detalle ? '' : ` — ${detalle}`}`);
  if (!cond) fallos++;
};

const TERUEL = 'lat=40.346&lng=-1.107';
const MADRID = 'lat=40.417&lng=-3.704';

for (const [nombreNav, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [disp, vp] of [['movil', { width: 375, height: 812 }], ['escritorio', { width: 1280, height: 900 }]]) {
    const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
    const page = await ctx.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|mapbox|Failed to load resource/i.test(m.text())) errores.push(m.text()); });
    const pre = `${nombreNav}-${disp}`;
    console.log(`\n${pre}`);

    // 1. Explorar con una búsqueda sin negocios.
    await page.goto(`${BASE}/explorar/?q=Casa%20Pruebacrecer`, { waitUntil: 'networkidle' });
    const pide = page.locator('a[href*="#/pedir-local?nombre=Casa%20Pruebacrecer"]').first();
    ok('Explorar: «Pide que esté en Klendar» con el nombre', await pide.count() > 0);
    await page.screenshot({ path: join(OUT, `web_explorar_sin_negocio_${pre}.png`), fullPage: false });

    // 2. Descubre en Teruel.
    await page.goto(`${BASE}/descubre/?${TERUEL}`, { waitUntil: 'networkidle' });
    const vacio = page.locator('[data-avisame]');
    ok('Descubre en Teruel: estado «sin Klendar»', await vacio.count() === 1);
    const titulo = (await page.locator('[data-avisame-titulo]').textContent().catch(() => '')) || '';
    ok('dice que Klendar aún no ha llegado', /no ha llegado/i.test(titulo), titulo);
    const botones = await page.locator('[data-avisame-botones] a').allTextContents();
    ok('tres salidas: avísame, elegir ciudad, pedir un local', botones.length === 3, botones.join(' | '));
    const centrado = await vacio.evaluate((el) => getComputedStyle(el).textAlign);
    ok('centrado', centrado === 'center', centrado);
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    ok('sin scroll horizontal', ancho);
    await page.screenshot({ path: join(OUT, `web_descubre_sin_klendar_${pre}.png`) });
    await page.locator('[data-avisame-si]').click();
    const correo = page.locator('[data-avisame-caja] input[type=email]');
    await correo.waitFor({ timeout: 5000 }).catch(() => {});
    ok('sin sesión: pide un correo', await correo.count() === 1);
    await page.screenshot({ path: join(OUT, `web_descubre_avisame_correo_${pre}.png`) });
    if (await correo.count()) {
      // La Edge Function, simulada (la de verdad la prueba tool/crecer_smoke.py
      // y tiene tope por conexión): se mira qué le llega.
      let cuerpo = null;
      await page.route('**/functions/v1/city-waitlist-join', async (route) => {
        cuerpo = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'check_email', zone: 'Teruel' }) });
      });
      // Turnstile con la clave de prueba de Cloudflare que siempre pasa.
      await page.route('**/config.js*', (route) => route.fulfill({
        contentType: 'text/javascript',
        body: "window.KLENDAR_ENV = { name: 'dev', url: 'https://dpbbtgwxrlqlplbrtjuq.supabase.co', key: 'x', turnstile: '1x00000000000000000000AA' };",
      }));
      await correo.fill(`prueba.web.${nombreNav}.${disp}@example.com`);
      await page.locator('[data-avisame-caja] button[type=submit]').click();
      await page.locator('[data-avisame-titulo]', { hasText: /correo/i }).waitFor({ timeout: 20000 }).catch(() => {});
      const tit = (await page.locator('[data-avisame-titulo]').textContent()) || '';
      ok('«Mira tu correo»', /correo/i.test(tit), tit.trim().slice(0, 120));
      ok('va por la Edge Function con el token anti-robots', cuerpo && cuerpo.captcha === 'XXXX.DUMMY.TOKEN.XXXX'
        && cuerpo.email === `prueba.web.${nombreNav}.${disp}@example.com` && cuerpo.source === 'web', JSON.stringify(cuerpo));
      await page.screenshot({ path: join(OUT, `web_descubre_avisame_hecho_${pre}.png`) });
      await page.unroute('**/functions/v1/city-waitlist-join');
      await page.unroute('**/config.js*');
    }

    // 3. Madrid: hay Klendar.
    await page.goto(`${BASE}/descubre/?${MADRID}`, { waitUntil: 'networkidle' });
    ok('Descubre en Madrid: sin el estado «sin Klendar»', await page.locator('[data-avisame]').count() === 0);

    // 4. Las páginas del correo, con un enlace falso.
    for (const que of ['confirmar', 'baja']) {
      await page.goto(`${BASE}/avisame/${que}/enlace-falso-de-prueba-0000000?lang=es`, { waitUntil: 'networkidle' });
      const robots = await page.locator('meta[name=robots]').getAttribute('content');
      ok(`/avisame/${que}: noindex`, /noindex/.test(robots || ''), robots);
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.locator('form button[type=submit]').click()]);
      const h1 = (await page.locator('h1').first().textContent()) || '';
      ok(`/avisame/${que}: un enlace falso «ya no vale»`, /ya no vale/i.test(h1), h1);
      if (que === 'confirmar') await page.screenshot({ path: join(OUT, `web_avisame_enlace_malo_${pre}.png`) });
    }

    ok('sin errores en la consola', errores.length === 0, errores.slice(0, 3).join(' · '));
    await ctx.close();
  }
  await nav.close();
}
console.log(`\n${fallos ? `${fallos} fallo(s)` : 'todo bien'}`);
process.exit(fallos ? 1 : 0);
