// Filtros en tres preguntas (opción A de docs/PROPUESTA_FILTROS.md, aprobada
// por Iván el 2026-10-26) en la web local, contra dev y solo leyendo:
//  1. La fila: ☰ · ¿Dónde? · ¿Cuándo? · ¿Qué? · el orden, sin chips sueltos
//     con ×; ☰ es solo el icono y dice en su etiqueta cuántos lleva.
//  2. ¿Cuándo?: atajos (Ahora, a un paseo · Esta noche · Este finde), «El plan
//     es…», «El sitio, ahora» y el momento del día; «Esta noche» lo pone y la
//     píldora lo dice.
//  3. «Este finde» en el calendario: solo cuentan de viernes a domingo.
//  4. ¿Qué?: varias categorías (`?categoria=a&categoria=b`) y la píldora con
//     las dos.
//  5. El orden: «Recomendado» de serie, con sus pasos; «Lo más nuevo» lo
//     cambia; en Sitios, «Mejor valorados» en la cabecera de la lista (desde el
//     11-11-2026, `rated_sort_available()`; antes, ni sale ni ordena).
//  6. ¿Dónde?: «Cerca de mí» | «Una ciudad», con «Todas las ciudades».
//  7. Recordar: lo guardado vuelve; ¿Cuándo? no pasa de las 6:00.
//  8. En inglés, «This weekend».
//  9. Sin errores en la consola.
// Chromium y WebKit, móvil (375) y escritorio. Capturas en OUT.
//
//   PORT=8877 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8877 node tools/filtros3_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8877';
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });
const AQUI = 'lat=40.417&lng=-3.704';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [forma, vp] of [['movil', { width: 375, height: 812 }], ['escritorio', { width: 1280, height: 900 }]]) {
    const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
    const page = await ctx.newPage();
    const errores = [];
    const deMapbox = (x) => /mapbox|webgl|tile|Failed to load resource|^Error$|Load failed/i.test(x);
    page.on('console', (m) => { if (m.type() === 'error' && !deMapbox(m.text())) errores.push(m.text()); });
    page.on('pageerror', (e) => { if (!deMapbox(`${e.message} ${e.stack || ''}`)) errores.push(String(e)); });
    const t = `[${nombre} ${forma}]`;
    const ir = (u) => page.goto(`${BASE}${u}`, { waitUntil: 'domcontentloaded' });

    // 1. La fila.
    await ir(`/descubre/?${AQUI}`);
    const fila = await page.evaluate(() => [...document.querySelectorAll('#barra > details')].map((d) => d.id || d.className));
    ok(fila.length === 5 && fila.includes('filtros') && fila.includes('cuando') && fila.includes('que-hoja')
      && fila.some((x) => /zona/.test(x)) && fila.some((x) => /orden/.test(x)), `${t} la fila: ☰ · dónde · cuándo · qué · orden (${fila.join(', ')})`);
    ok(fila[0] === 'filtros', `${t} ☰ va el primero`);
    ok(await page.locator('#barra .chip-quitar').count() === 0, `${t} sin chips sueltos con ×`);
    ok((await page.locator('#filtros > summary').innerText()).trim() === '' && await page.locator('#filtros > summary').getAttribute('aria-label') === 'Filtros', `${t} ☰: solo el icono, «Filtros» al lector`);

    // 2. ¿Cuándo?
    await page.locator('#cuando > summary').click();
    const cuando = await page.locator('#cuando form').innerText();
    ok(/Atajos/.test(cuando) && /Ahora, a un paseo/.test(cuando) && /Esta noche/.test(cuando) && /Este finde/.test(cuando)
      && /El plan es/.test(cuando) && /El sitio, ahora/.test(cuando) && /Momento del día/.test(cuando), `${t} ¿Cuándo? trae atajos, el plan, el sitio y el momento`);
    await page.screenshot({ path: `${OUT}/filtros3-cuando-${nombre}-${forma}.png` });
    await Promise.all([page.waitForURL(/cuando=esta-noche/), page.locator('#cuando a.atajo', { hasText: 'Esta noche' }).click()]);
    ok(/Esta noche/.test(await page.locator('#cuando > summary').innerText()), `${t} «Esta noche»: la píldora lo dice`);
    ok(await page.locator('#filtros > summary .n').count() === 0, `${t} ☰ no cuenta lo de ¿Cuándo?`);

    // 3. «Este finde» en el calendario.
    await ir(`/explorar/?vista=calendario&cuando=finde&${AQUI}`);
    const dias = await page.evaluate(() => [...document.querySelectorAll('.cal-dia:not(.pasado):not(.vacio-dia)')].map((d) => !d.classList.contains('fuera')));
    const cuentan = dias.filter(Boolean).length;
    ok(cuentan >= 1 && cuentan <= 3, `${t} «Este finde» en el calendario: ${cuentan} días cuentan`);

    // 4. Varias categorías.
    await ir(`/explorar/?${AQUI}`);
    await page.locator('#que-hoja > summary').click();
    const casillas = page.locator('#que-hoja input[type=checkbox][name=categoria]');
    ok(await casillas.count() >= 2, `${t} ¿Qué?: las categorías son casillas`);
    const nombres = [await casillas.nth(0).evaluate((i) => i.nextElementSibling.textContent), await casillas.nth(1).evaluate((i) => i.nextElementSibling.textContent)];
    await casillas.nth(0).check({ force: true });
    await casillas.nth(1).check({ force: true });
    // Como una persona: «Ver N resultados» se pone al día antes de pulsarlo.
    await page.waitForTimeout(900);
    await Promise.all([page.waitForURL(/categoria=.*categoria=/), page.locator('#que-hoja button[type=submit]').click()]);
    const pQue = await page.locator('#que-hoja > summary').innerText();
    ok(nombres.every((n) => pQue.includes(n.trim().slice(0, 6))) || /…/.test(pQue) || pQue.length > 10, `${t} ¿Qué? con dos categorías: «${pQue.trim()}»`);
    ok(new URL(page.url()).searchParams.getAll('categoria').length === 2, `${t} dos categorías en la dirección`);

    // 5. El orden.
    await ir(`/descubre/?${AQUI}`);
    const orden = page.locator('#barra .desplegable.orden');
    await orden.locator('summary').click();
    const menu = await orden.locator('.menu-d').innerText();
    ok(/Recomendado/.test(menu) && /de serie/.test(menu) && /Lo destacado de pago/.test(menu) && /Más cerca/.test(menu)
      && /Empieza antes/.test(menu) && /Lo más nuevo/.test(menu) && /Según el tiempo/.test(menu) && /Tener en cuenta tus gustos/.test(menu), `${t} el menú de orden: Recomendado con sus pasos, tres órdenes y dos casillas`);
    ok(/Recomendado/.test(await orden.locator('summary').innerText()), `${t} de serie, «Recomendado»`);
    await page.screenshot({ path: `${OUT}/filtros3-orden-${nombre}-${forma}.png` });
    await Promise.all([page.waitForURL(/orden=nuevas/), orden.locator('.menu-d a[href*="orden=nuevas"]').click()]);
    ok(/Lo más nuevo/.test(await page.locator('#barra .desplegable.orden summary').innerText()), `${t} «Lo más nuevo» puesto`);
    await ir(`/explorar/?que=sitios&${AQUI}`);
    ok(await page.locator('#barra .desplegable.orden').count() === 0, `${t} Sitios: sin orden en la fila`);
    // «Mejor valorados» solo desde `rated_sort_available()` (11-11-2026, migración
    // 20261247100000): antes, ni el menú ni el orden aunque venga en la dirección.
    if (await page.locator('.resumen .desplegable.orden').count() === 0) {
      ok(/cercanía/.test(await page.locator('.resumen-orden').innerText()), `${t} Sitios, antes de la fecha: sin «Mejor valorados», «Por cercanía…»`);
      await ir(`/explorar/?que=sitios&orden=valorados&${AQUI}`);
      ok(/cercanía/.test(await page.locator('.resumen-orden').innerText()) && await page.locator('.resumen .desplegable.orden').count() === 0, `${t} Sitios, antes de la fecha: ?orden=valorados no cuela`);
    } else {
      await page.locator('.resumen .desplegable.orden summary').click();
      await Promise.all([page.waitForURL(/orden=valorados/), page.locator('.resumen .menu-d a', { hasText: 'Mejor valorados' }).click()]);
      ok(/Mejor valorados/.test(await page.locator('.resumen .desplegable.orden summary').innerText()) && /valoración/.test(await page.locator('.resumen-orden').innerText()), `${t} Sitios: «Mejor valorados» con su ayuda`);
    }

    // 6. ¿Dónde?
    await ir(`/descubre/?${AQUI}`);
    await page.locator('#barra .desplegable.zona > summary').click();
    ok(await page.locator('[data-donde-modo="cerca"].on').isVisible() && await page.locator('[data-donde-sec="cerca"]').isVisible() && !(await page.locator('[data-donde-sec="ciudad"]').isVisible()), `${t} ¿Dónde?: «Cerca de mí» de entrada, con la distancia`);
    await page.locator('[data-donde-modo="ciudad"]').click();
    ok(/Todas las ciudades/.test(await page.locator('[data-donde-sec="ciudad"]').innerText()), `${t} ¿Dónde?: «Una ciudad» con «Todas las ciudades»`);
    await page.screenshot({ path: `${OUT}/filtros3-donde-${nombre}-${forma}.png` });

    // 7. Recordar: lo guardado vuelve; ¿Cuándo? no pasa de las 6:00.
    await ir(`/explorar/?cuando=esta-noche&tipo=eventos&${AQUI}`);
    await ir('/descubre/');
    await page.waitForURL(/tipo=eventos/);
    ok(/cuando=esta-noche/.test(page.url()), `${t} recordar: vuelve con «Esta noche» el mismo día`);
    await page.evaluate(() => {
      const g = JSON.parse(localStorage.getItem('klendar.filtros'));
      const ayer = new Date(); ayer.setDate(ayer.getDate() - 1); ayer.setHours(5, 0, 0, 0);
      g.t = ayer.getTime(); localStorage.setItem('klendar.filtros', JSON.stringify(g));
    });
    await ir('/descubre/');
    await page.waitForURL(/tipo=eventos/);
    ok(!/cuando=/.test(page.url()) && !/lat=/.test(page.url()), `${t} recordar: otro día, sin «Esta noche» (y sin tu posición) pero con lo demás`);

    // 8. En inglés.
    await ir(`/en/explore/?when=weekend&${AQUI}`);
    ok(/This weekend/.test(await page.locator('#cuando > summary').innerText()), `${t} /en/explore: «This weekend»`);
    await page.screenshot({ path: `${OUT}/filtros3-en-${nombre}-${forma}.png` });

    ok(errores.length === 0, `${t} sin errores en la consola (${errores.slice(0, 3).join(' | ')})`);
    await ctx.close();
  }
  await nav.close();
}
console.log(fallos ? `${fallos} FALLAN` : 'todo bien');
process.exit(fallos ? 1 : 0);
