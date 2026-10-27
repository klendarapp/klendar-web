// Contenido +18 sin cuenta y decisiones de la revisión de filtros (Iván,
// 2026-10-27), en la web local contra dev y solo leyendo:
//  1. Sin contestar, una línea «Hay N resultados solo para mayores de 18.
//     ¿Tienes 18 años o más?» solo donde hay algo +18 (Explorar y Sitios).
//  2. «Tengo 18 años o más»: se guarda (cookie `klendar_18`), la página se
//     vuelve a pedir, salen los +18 y la pregunta no vuelve.
//  3. «Soy menor»: desaparece, no vuelve y no sale nada +18.
//  4. Ficha de una publicación +18: la pregunta en su lugar; con «18 o más»,
//     la ficha.
//  5. «Una ciudad» con «Más cerca»: ordena desde su centro, sin pedir nada;
//     «Más cerca» sin posición ni ciudad: lo dice y ofrece la ubicación.
//  6. Sin errores en la consola.
//
//   PORT=8931 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8931 OFERTA18=<id> node tools/mayores_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8931';
const OUT = process.env.OUT || '.';
const OFERTA18 = process.env.OFERTA18 || '';
mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };
const totalDe = async (page) => Number(((await page.locator('.resumen-n').first().innerText().catch(() => '')) || '').replace(/\D/g, '')) || 0;

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [forma, vp] of [['movil', { width: 375, height: 812 }], ['escritorio', { width: 1280, height: 900 }]]) {
    const t = `[${nombre} ${forma}]`;
    const nuevo = async () => {
      const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
      const page = await ctx.newPage();
      const errores = [];
      const deFuera = (x) => /mapbox|webgl|tile|Failed to load resource|^Error$|Load failed/i.test(x);
      page.on('console', (m) => { if (m.type() === 'error' && !deFuera(m.text())) errores.push(m.text()); });
      return { ctx, page, errores };
    };

    // 1–2. «Tengo 18 años o más».
    {
      const { ctx, page, errores } = await nuevo();
      await page.goto(`${BASE}/explorar/?ciudad=Madrid`);
      const aviso = page.locator('[data-edad]');
      ok(await aviso.isVisible() && /solo para mayores de 18/.test(await aviso.innerText()), `${t} sin contestar: la línea de la edad`);
      const antes = await totalDe(page);
      await page.screenshot({ path: `${OUT}/mayores-aviso-${nombre}-${forma}.png` });
      await Promise.all([page.waitForLoadState('load'), page.waitForEvent('framenavigated'), page.locator('[data-edad-si]').click()]);
      await page.waitForLoadState('load');
      const despues = await totalDe(page);
      ok(!(await page.locator('[data-edad]').count()) && despues > antes, `${t} «18 o más»: sin pregunta y más resultados (${antes} → ${despues})`);
      await page.goto(`${BASE}/explorar/?que=sitios&ciudad=Madrid`);
      ok(!(await page.locator('[data-edad]').count()), `${t} «18 o más»: tampoco en Sitios`);
      if (OFERTA18) {
        await page.goto(`${BASE}/o/${OFERTA18}`);
        ok(!(await page.locator('[data-edad]').count()) && (await page.locator('h1').first().innerText()) !== '¿Tienes 18 años o más?', `${t} «18 o más»: la ficha +18 se ve`);
      }
      ok(errores.length === 0, `${t} sin errores en la consola (${errores.slice(0, 3).join(' | ')})`);
      await ctx.close();
    }

    // 3. «Soy menor».
    {
      const { ctx, page } = await nuevo();
      await page.goto(`${BASE}/explorar/?ciudad=Madrid`);
      const antes = await totalDe(page);
      await page.locator('[data-edad-no]').click();
      ok(!(await page.locator('[data-edad]').count()), `${t} «Soy menor»: la línea se va`);
      await page.reload();
      ok(!(await page.locator('[data-edad]').count()) && (await totalDe(page)) === antes, `${t} «Soy menor»: no vuelve y nada +18`);
      if (OFERTA18) {
        await page.goto(`${BASE}/o/${OFERTA18}`);
        ok(/ya no está/.test(await page.locator('h1').first().innerText()), `${t} «Soy menor»: la ficha +18 no se ve`);
      }
      await ctx.close();
    }

    // 4. Ficha +18 sin contestar.
    if (OFERTA18) {
      const { ctx, page } = await nuevo();
      await page.goto(`${BASE}/o/${OFERTA18}`);
      ok((await page.locator('h1').first().innerText()) === '¿Tienes 18 años o más?', `${t} ficha +18 sin contestar: la pregunta`);
      await Promise.all([page.waitForEvent('framenavigated'), page.locator('[data-edad-si]').click()]);
      await page.waitForLoadState('load');
      ok((await page.locator('h1').first().innerText()) !== '¿Tienes 18 años o más?', `${t} ficha +18: con «18 o más», la ficha`);
      await ctx.close();
    }

    // 5. «Más cerca».
    {
      const { ctx, page } = await nuevo();
      await page.goto(`${BASE}/explorar/?ciudad=Madrid&orden=cerca`);
      ok(!(await page.locator('[data-cerca-falta]').count()) && /Más cerca/.test(await page.locator('#barra').innerText()), `${t} «Más cerca» con una ciudad: desde su centro, sin pedir nada`);
      await page.goto(`${BASE}/explorar/?orden=cerca`);
      ok(await page.locator('[data-cerca-falta]').isVisible(), `${t} «Más cerca» sin dónde: lo dice y ofrece la ubicación`);
      await page.screenshot({ path: `${OUT}/mayores-cerca-${nombre}-${forma}.png` });
      await ctx.close();
    }
  }
  await nav.close();
}
console.log(fallos ? `${fallos} FALLAN` : 'todo bien');
process.exit(fallos ? 1 : 0);
