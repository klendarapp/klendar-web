// Filtros en tres preguntas (opción A de docs/PROPUESTA_FILTROS.md, aprobada
// por Iván el 2026-10-26) en la web local, contra dev y solo leyendo:
//  1. La fila (Iván, 2026-10-27): ¿Dónde? · ¿Cuándo? · ¿Qué? y ☰ fijo a la
//     derecha, la misma en Descubre, Planes (lista, calendario y mapa) y
//     Sitios (lista y mapa); sin chips sueltos con × ni el orden; ☰ es solo
//     el icono y dice en su etiqueta cuántos lleva. En 360 px, las tres
//     preguntas y ☰ dentro de la pantalla.
//  2. ¿Cuándo?: atajos (Ahora, a un paseo · Esta noche · Este finde), «El plan
//     es…», «El sitio, ahora» y el momento del día; «Esta noche» lo pone y la
//     píldora lo dice.
//  3. «Este finde» en el calendario: solo cuentan de viernes a domingo.
//  4. ¿Qué?: las categorías en una cuadrícula de iconos por grupos, varias
//     (`?categoria=a&categoria=b`) y la píldora con las dos.
//  5. El orden, dentro de ☰ y arriba: «Recomendado» de serie, con sus dos
//     casillas; «Lo más nuevo» lo cambia y ☰ lo cuenta; «Restablecer» lo
//     devuelve y no toca las casillas; en Sitios, «Mejor valorados» en la cabecera de la lista (desde el
//     11-11-2026, `rated_sort_available()`; antes, ni sale ni ordena).
//  6. ¿Dónde?: «Cerca de mí» | «Una ciudad», con «Todas las ciudades».
//  7. Recordar: lo guardado vuelve; ¿Cuándo? no pasa de las 6:00 (tampoco
//     «Abierto ahora» ni «Ahora, a un paseo» entero).
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

    // 1. La fila, la misma en todas las vistas.
    const laFila = () => page.evaluate(() => [...document.querySelectorAll('#barra details')].filter((d) => !d.parentElement.closest('details'))
      .map((d) => d.id || (/zona/.test(d.className) ? 'zona' : d.className)));
    for (const u of [`/descubre/?${AQUI}`, `/explorar/?${AQUI}`, `/explorar/?vista=calendario&${AQUI}`, `/explorar/?vista=mapa&${AQUI}`,
      `/explorar/?que=sitios&${AQUI}`, `/explorar/?que=sitios&vista=mapa&${AQUI}`]) {
      await ir(u);
      const fila = await laFila();
      const donde = (u.match(/(vista|que)=[a-z]+/g) || []).join(' ');
      ok(fila.join(',') === 'zona,cuando,que-hoja,filtros', `${t} ${u.split('?')[0]} ${donde}: dónde · cuándo · qué · ☰ (${fila.join(', ')})`);
    }
    await ir(`/descubre/?${AQUI}`);
    ok(await page.locator('#barra .desplegable.orden').count() === 0, `${t} sin el orden en la fila`);
    ok(await page.locator('#barra .chip-quitar').count() === 0, `${t} sin chips sueltos con ×`);
    // Los botones dicen lo que vale, nunca la pregunta (Iván, 2026-10-27).
    ok((await page.locator('#cuando > summary').innerText()).trim() === 'Cuando sea'
      && await page.locator('#cuando > summary').getAttribute('aria-label') === 'Cuándo: Cuando sea', `${t} ¿Cuándo? dice «Cuando sea»`);
    ok((await page.locator('#que-hoja > summary').innerText()).trim() === 'Todo'
      && await page.locator('#que-hoja > summary').getAttribute('aria-label') === 'Qué: Todo', `${t} ¿Qué? dice «Todo»`);
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
    // La hoja entra animada (Movimiento, 280 ms): como una persona, se toca
    // cuando ya está.
    await page.waitForTimeout(350);
    const casillas = page.locator('#que-hoja .cat-rejilla input[type=checkbox][name=categoria]');
    ok(await casillas.count() >= 2, `${t} ¿Qué?: las categorías son casillas en una cuadrícula`);
    ok(await page.locator('#que-hoja .hoja-cats-grupo').count() >= 4 && await page.locator('#que-hoja .cat-celda svg').count() === await casillas.count()
      && await page.locator('#que-hoja [data-ver-todas]').count() === 0, `${t} ¿Qué?: por grupos, cada una con su icono y todas a la vista`);
    await page.screenshot({ path: `${OUT}/filtros3-que-${nombre}-${forma}.png` });
    const nombres = [await casillas.nth(0).evaluate((i) => i.nextElementSibling.textContent), await casillas.nth(1).evaluate((i) => i.nextElementSibling.textContent)];
    await casillas.nth(0).check({ force: true });
    await casillas.nth(1).check({ force: true });
    // Como una persona: «Ver N resultados» se pone al día antes de pulsarlo.
    await page.waitForTimeout(900);
    await Promise.all([page.waitForURL(/categoria=.*categoria=/), page.locator('#que-hoja button[type=submit]').click()]);
    const pQue = await page.locator('#que-hoja > summary').innerText();
    ok(nombres.every((n) => pQue.includes(n.trim().slice(0, 6))) || /…/.test(pQue) || pQue.length > 10, `${t} ¿Qué? con dos categorías: «${pQue.trim()}»`);
    ok(new URL(page.url()).searchParams.getAll('categoria').length === 2, `${t} dos categorías en la dirección`);

    // 5. El orden, dentro de ☰ y arriba del todo.
    await ir(`/descubre/?${AQUI}`);
    await page.locator('#filtros > summary').click();
    await page.waitForTimeout(350);
    const hoja = page.locator('#filtros form');
    const primero = await hoja.locator('.hoja-scroll > *').first().evaluate((x) => x.className);
    ok(/hoja-orden/.test(primero), `${t} ☰: «Ordenar por» arriba del todo (${primero})`);
    const txtOrden = await hoja.locator('.hoja-orden').innerText();
    ok(/Recomendado/.test(txtOrden) && /de serie/.test(txtOrden) && /Lo destacado de pago/.test(txtOrden) && /Más cerca/.test(txtOrden)
      && /Empieza antes/.test(txtOrden) && /Lo más nuevo/.test(txtOrden) && /Según el tiempo/.test(txtOrden) && /Si llueve/.test(txtOrden)
      && /Tener en cuenta tus gustos/.test(txtOrden), `${t} «Ordenar por»: Recomendado con sus dos casillas y tres órdenes`);
    ok(await hoja.locator('input[name=orden][value=""]').isChecked(), `${t} de serie, «Recomendado»`);
    ok(!/Lo que no está aquí/.test(await hoja.innerText()), `${t} ☰ sin «Lo que no está aquí»`);
    await page.screenshot({ path: `${OUT}/filtros3-orden-${nombre}-${forma}.png` });
    await hoja.locator('label.op-orden:has(input[value=nuevas])').click();
    await page.waitForTimeout(900);
    await Promise.all([page.waitForURL(/orden=nuevas/), hoja.locator('button[type=submit]').click()]);
    ok(!/tiempo=|sin-gustos=/.test(page.url()), `${t} con las casillas encendidas, la dirección no las lleva (${page.url().split('?')[1]})`);
    ok((await page.locator('#filtros > summary .n').innerText()) === '1' && /Ordenar por: Lo más nuevo/.test(await page.locator('#filtros > summary').getAttribute('aria-label')), `${t} ☰ cuenta el orden que no es el de serie`);
    await page.locator('#filtros > summary').click();
    await page.waitForTimeout(350);
    await hoja.locator('input[name=tiempo][type=checkbox]').uncheck({ force: true });
    await hoja.locator('[data-restablecer]').click();
    ok(await hoja.locator('input[name=orden][value=""]').isChecked() && !(await hoja.locator('input[name=tiempo][type=checkbox]').isChecked())
      && await hoja.locator('input[name=sin-gustos][type=checkbox]').isChecked(), `${t} «Restablecer» vuelve a Recomendado y no toca las casillas`);
    await page.waitForTimeout(900);
    await Promise.all([page.waitForURL(/tiempo=0/), hoja.locator('button[type=submit]').click()]);
    ok(!/orden=/.test(page.url()) && /tiempo=0/.test(page.url()), `${t} «Según el tiempo» apagado viaja en la dirección`);
    for (const u of [`/explorar/?que=sitios&${AQUI}`, `/explorar/?vista=calendario&${AQUI}`, `/explorar/?vista=mapa&${AQUI}`]) {
      await ir(u);
      ok(await page.locator('#filtros .hoja-orden').count() === 0, `${t} ${u.match(/(vista|que)=[a-z]+/)[0]}: ☰ sin «Ordenar por»`);
    }
    await ir(`/explorar/?que=sitios&${AQUI}`);
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
    await page.locator('#barra details.zona > summary').click();
    ok(await page.locator('[data-donde-modo="cerca"].on').isVisible() && await page.locator('[data-donde-sec="cerca"]').isVisible() && !(await page.locator('[data-donde-sec="ciudad"]').isVisible()), `${t} ¿Dónde?: «Cerca de mí» de entrada, con la distancia`);
    await page.locator('[data-donde-modo="ciudad"]').click();
    ok(/Todas las ciudades/.test(await page.locator('[data-donde-sec="ciudad"]').innerText()), `${t} ¿Dónde?: «Una ciudad» con «Todas las ciudades»`);
    await page.screenshot({ path: `${OUT}/filtros3-donde-${nombre}-${forma}.png` });

    // 7. Recordar: lo guardado vuelve; ¿Cuándo? no pasa de las 6:00 (con
    //    «El sitio, ahora» y «Ahora, a un paseo», que también son de ¿Cuándo?).
    const ayerA5 = () => page.evaluate(() => {
      const g = JSON.parse(localStorage.getItem('klendar.filtros'));
      const ayer = new Date(); ayer.setDate(ayer.getDate() - 1); ayer.setHours(5, 0, 0, 0);
      g.t = ayer.getTime(); localStorage.setItem('klendar.filtros', JSON.stringify(g));
    });
    await ir(`/explorar/?cuando=esta-noche&abierto=1&tipo=eventos&${AQUI}`);
    await ir('/descubre/');
    await page.waitForURL(/tipo=eventos/);
    ok(/cuando=esta-noche/.test(page.url()) && /abierto=1/.test(page.url()), `${t} recordar: vuelve con «Esta noche» y «Abierto ahora» el mismo día`);
    await ayerA5();
    await ir('/descubre/');
    await page.waitForURL(/tipo=eventos/);
    ok(!/cuando=|abierto=/.test(page.url()) && !/lat=/.test(page.url()), `${t} recordar: otro día, sin «Esta noche» ni «Abierto ahora» (y sin tu posición) pero con lo demás`);
    await ir(`/explorar/?cuando=ahora&km=1&orden=cerca&tipo=eventos&${AQUI}`);
    await ir('/descubre/');
    await page.waitForURL(/tipo=eventos/);
    await ayerA5();
    await ir('/descubre/');
    await page.waitForURL(/tipo=eventos/);
    ok(!/cuando=|km=1|orden=cerca/.test(page.url()), `${t} recordar: «Ahora, a un paseo» de otro día se quita entero (la distancia y el orden también)`);

    // 8. En inglés.
    await ir(`/en/explore/?when=weekend&${AQUI}`);
    ok(/This weekend/.test(await page.locator('#cuando > summary').innerText()), `${t} /en/explore: «This weekend»`);
    await page.screenshot({ path: `${OUT}/filtros3-en-${nombre}-${forma}.png` });

    ok(errores.length === 0, `${t} sin errores en la consola (${errores.slice(0, 3).join(' | ')})`);
    await ctx.close();
  }
  // En un móvil de 360: las tres preguntas y ☰ dentro de la pantalla (☰ a la
  // derecha), sin deslizar; con «Cerca de ti», el «dónde» dice solo «5 km».
  {
    const ctx = await nav.newContext({ viewport: { width: 360, height: 740 }, locale: 'es-ES' });
    const page = await ctx.newPage();
    for (const u of [`/descubre/?${AQUI}`, `/explorar/?${AQUI}`, `/explorar/?que=sitios&${AQUI}`, `/explorar/?cuando=esta-noche&categoria=bar&categoria=music&${AQUI}`]) {
      await page.goto(`${BASE}${u}`, { waitUntil: 'domcontentloaded' });
      const r = await page.evaluate(() => [...document.querySelectorAll('#barra summary.chip')].filter((x) => !x.closest('.hoja-cuerpo, .menu-d'))
        .map((x) => { const b = x.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width }; }));
      const dentro = r.length === 4 && r.every((b) => b.l >= 0 && b.r <= 360 && b.w >= 40);
      ok(dentro && r[3].l > r[2].r, `[${nombre} 360] ${u.split('?')[0]}${u.includes('cuando') ? ' (con cuándo y qué)' : ''}: la fila cabe y ☰ va a la derecha (${r.map((b) => `${Math.round(b.l)}-${Math.round(b.r)}`).join(' ')})`);
    }
    await page.goto(`${BASE}/explorar/?${AQUI}`, { waitUntil: 'domcontentloaded' });
    ok((await page.locator('#barra details.zona > summary').innerText()).trim() === '5 km', `[${nombre} 360] «dónde» corto: «5 km»`);
    await page.screenshot({ path: `${OUT}/filtros3-360-${nombre}.png` });
    await ctx.close();
  }
  await nav.close();
}
console.log(fallos ? `${fallos} FALLAN` : 'todo bien');
process.exit(fallos ? 1 : 0);
