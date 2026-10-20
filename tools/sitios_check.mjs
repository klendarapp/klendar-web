// «Sitios en Explorar» (tanda D, 2026-10-20) en la web local, contra dev y
// solo leyendo (sin sesión, no escribe nada):
//  1. /explorar/?que=sitios: «Planes | Sitios» con Sitios puesto, Lista | Mapa,
//     las filas (foto, nombre, categoría y distancia, el horario de ahora) y
//     «N sitios»; sin desbordar a lo ancho en un móvil.
//  2. La hoja de filtros en Sitios: solo lo del sitio (Abierto ahora, Se puede
//     comer ahora, Momento del día, Precio del local, Cómo es, Menú del día y
//     Categorías); ni «¿Cuándo?» ni «Para quién».
//  3. El mapa de Sitios pide `map_places` (y otra vez al moverlo).
//  4. Explorar recuerda lo último: tras ver Sitios, /explorar/ sin nada abre
//     Sitios; tras volver a Planes, Planes.
//  5. La lupa: con «nails», «Solo sitios» lleva a `?que=sitios&q=nails`.
//  6. Los enlaces de antes (`?tipo=negocios`) llevan a Sitios.
//  7. Sin errores en la consola.
// Chromium y WebKit, móvil (375) y escritorio. Capturas en OUT.
//
//   PORT=8857 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8857 node tools/sitios_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8857';
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
    // Lo de Mapbox (teselas, fuentes que WebKit sin GPU no deja cargar) no es
    // de la página.
    // («Load failed» es como WebKit dice que no ha podido bajar una fuente del
    // mapa; las peticiones de la página van con su try/catch.)
    const deMapbox = (x) => /mapbox|webgl|tile|Failed to load resource|^Error$|Load failed/i.test(x);
    page.on('console', (m) => { if (m.type() === 'error' && !deMapbox(m.text())) errores.push(m.text()); });
    page.on('pageerror', (e) => { if (!deMapbox(`${e.message} ${e.stack || ''}`)) errores.push(String(e)); });
    const t = `[${nombre} ${forma}]`;

    // 1. La lista.
    await page.goto(`${BASE}/explorar/?que=sitios&${AQUI}`);
    ok(await page.locator('.que a.on').innerText() === 'Sitios', `${t} «Planes | Sitios» con Sitios puesto`);
    ok(await page.locator('.vistas .vista').count() === 2, `${t} Lista | Mapa`);
    const filas = await page.locator('.sitio-fila').count();
    ok(filas > 0, `${t} filas de sitios (${filas})`);
    ok(/sitio/.test(await page.locator('.resumen-n').innerText()), `${t} «N sitios»`);
    const hora = await page.locator('.sitio-hora').first().innerText();
    ok(/^(Abierto|Cerrado)/.test(hora), `${t} el horario de ahora («${hora}»)`);
    ok(/\d+(,\d)?\s?(m|km)/.test(await page.locator('.sitio-fila .muted').first().innerText()), `${t} categoría y distancia`);
    if (forma === 'movil') {
      const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
      ok(ancho <= 375, `${t} sin desbordar a lo ancho (${ancho})`);
    }
    await page.screenshot({ path: `${OUT}/web-sitios-${nombre}-${forma}.png`, fullPage: false });

    // 2. La hoja de filtros.
    await page.locator('#filtros > summary').click();
    const hoja = await page.locator('#filtros form').innerText();
    ok(/Abierto ahora/.test(hoja) && /Se puede comer ahora/.test(hoja) && /Momento del día/.test(hoja)
      && /Precio del local/.test(hoja) && /Cómo es/.test(hoja) && /Menú del día/.test(hoja) && /Categorías/.test(hoja),
    `${t} la hoja trae lo del sitio`);
    ok(!/¿Cuándo\?/.test(hoja) && !/Para quién/.test(hoja), `${t} la hoja no trae lo de los planes`);
    await page.screenshot({ path: `${OUT}/web-sitios-filtros-${nombre}-${forma}.png` });

    // 3. El mapa.
    const pide = page.waitForResponse((r) => r.url().includes('/rpc/map_places'), { timeout: 30000 }).catch(() => null);
    await page.goto(`${BASE}/explorar/?que=sitios&vista=mapa&${AQUI}`);
    const r = await pide;
    ok(r && r.ok(), `${t} el mapa pide map_places`);
    await page.waitForTimeout(1500);
    await page.locator('#mapa-sitios').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/web-sitios-mapa-${nombre}-${forma}.png` });

    // 4. Recuerda lo último.
    await page.goto(`${BASE}/explorar/`);
    await page.waitForURL(/que=sitios/, { timeout: 10000 }).catch(() => {});
    ok(/que=sitios/.test(page.url()), `${t} /explorar/ abre en Sitios tras verlo (${page.url().replace(BASE, '')})`);
    await page.locator('.que a', { hasText: 'Planes' }).click();
    await page.waitForLoadState('domcontentloaded');
    ok(!/que=sitios/.test(page.url()), `${t} «Planes» vuelve a los planes`);
    await page.goto(`${BASE}/explorar/`);
    await page.waitForTimeout(800);
    ok(!/que=sitios/.test(page.url()), `${t} y /explorar/ se queda en Planes`);

    // 5. La lupa.
    await page.goto(`${BASE}/explorar/?q=nails`);
    await page.locator('.chip-solo a').click();
    await page.waitForURL(/que=sitios/, { timeout: 10000 }).catch(() => {});
    ok(/que=sitios/.test(page.url()) && /q=nails/.test(page.url()), `${t} «Solo sitios» en la búsqueda`);
    ok(await page.locator('.sitio-fila').count() >= 1, `${t} «nails» encuentra Nails & Co`);

    // 6. Los enlaces de antes.
    await page.goto(`${BASE}/explorar/?tipo=negocios`);
    ok(await page.locator('.que a.on').innerText() === 'Sitios', `${t} ?tipo=negocios → Sitios`);

    ok(errores.length === 0, `${t} sin errores en la consola ${errores.join(' | ')}`);
    await ctx.close();
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
