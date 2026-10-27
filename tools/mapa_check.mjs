// El mapa de Explorar con varios planes en el mismo sitio (2026-10-25), en la
// web local contra dev y solo leyendo:
//  1. Planes: lo del mismo punto es UN marcador con su logo (o icono) y
//     «N planes»; al tocarlo se abre su hoja con Cómo llegar y sus planes por
//     partes (8 y «Ver N más»), cada uno con su día y hora.
//  2. El número dice siempre planes: la suma de burbujas, insignias y
//     chinchetas es el total de puntos, a cualquier zoom.
//  3. Una burbuja (sitios distintos cerca) acerca el mapa hasta separarlos.
//  4. Al acercar «con los dedos» (zoom), las burbujas se separan; desde el 17
//     no queda ninguna.
//  5. En oscuro se lee (captura).
//  5b. Marcadores pequeños (32 px, la cifra en la esquina) y los nombres
//     solo desde el zoom 15, en una línea y sin pisarse (2026-10-27).
//  6. Sitios: la fuente agrupa con los mismos marcadores que Planes (mismo tamaño y anillo).
//  7. Sin errores en la consola.
// Chromium y WebKit, móvil (375) y escritorio. Capturas en OUT.
//
//   PORT=8863 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8863 node tools/mapa_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8863';
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });
// Usera y Arganzuela (Madrid): la agenda pública tiene muchos planes en los
// mismos centros culturales.
const AQUI = 'lat=40.39&lng=-3.70';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

/** Espera a que el mapa haya terminado de moverse y de pintar marcadores. */
const quieto = (page) => page.evaluate(() => new Promise((r) => {
  const m = window.KlendarMapa;
  if (!m.isMoving()) setTimeout(r, 250);
  else m.once('idle', () => setTimeout(r, 250));
}));

/** Lo que dice cada marcador: burbujas, insignias y chinchetas. */
const cuenta = (page) => page.evaluate(() => {
  const num = (t) => Number(String(t).match(/\d+/)?.[0] || 0);
  const burbujas = [...document.querySelectorAll('.grupo-marca')].map((b) => num(b.textContent));
  const sitios = [...document.querySelectorAll('#mapa .marca .mc-n')].map((b) => num(b.textContent));
  const chinchetas = [...document.querySelectorAll('#mapa .marca')].filter((x) => !x.querySelector('.mc-n')).length;
  return { burbujas, sitios, chinchetas, total: burbujas.reduce((a, b) => a + b, 0) + sitios.reduce((a, b) => a + b, 0) + chinchetas };
});

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [forma, vp] of [['movil', { width: 375, height: 812 }], ['escritorio', { width: 1280, height: 900 }]]) {
    for (const tema of ['light', 'dark']) {
      const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', colorScheme: tema });
      const page = await ctx.newPage();
      const errores = [];
      const deMapbox = (x) => /mapbox|webgl|tile|Failed to load resource|^Error$|Load failed/i.test(x);
      page.on('console', (m) => { if (m.type() === 'error' && !deMapbox(m.text())) errores.push(m.text()); });
      page.on('pageerror', (e) => { if (!deMapbox(`${e.message} ${e.stack || ''}`)) errores.push(String(e)); });
      const t = `[${nombre} ${forma} ${tema}]`;

      await page.goto(`${BASE}/explorar/?vista=mapa&${AQUI}`);
      const puntos = await page.evaluate(() => JSON.parse(document.getElementById('mapaPuntos').textContent));
      const conMapa = await page.waitForFunction(() => window.KlendarMapa && window.KlendarMapa.loaded()
        && document.querySelector('.grupo-marca, .marca'), null, { timeout: 30000 }).then(() => true).catch(() => false);
      if (!conMapa) {
        // WebKit sin GPU no siempre pinta Mapbox: entonces sale el aviso.
        ok(await page.locator('#mapa.sin-mapa, #mapa .empty').count() > 0 || nombre === 'webkit', `${t} sin mapa, con aviso`);
        await page.screenshot({ path: `${OUT}/web-planes-sin-mapa-${nombre}-${forma}-${tema}.png` });
        await ctx.close();
        continue;
      }
      await quieto(page);
      // 2. El número son planes.
      for (const z of [11, 13, 15, 16.5]) {
        await page.evaluate((zz) => window.KlendarMapa.jumpTo({ zoom: zz }), z);
        await quieto(page);
        const c = await cuenta(page);
        ok(c.total === puntos.length, `${t} zoom ${z}: burbujas + sitios + chinchetas = ${c.total} planes de ${puntos.length}`);
      }
      // 5b. Los nombres: de lejos ninguno; de cerca, en una línea y sin
      // pisarse entre ellos.
      const nombres = () => page.evaluate(() => [...document.querySelectorAll('.marca-nombre')]
        .filter((n) => !n.hidden).map((n) => { const r = n.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, h: r.height }; }));
      await page.evaluate(() => window.KlendarMapa.jumpTo({ zoom: 13 }));
      await quieto(page);
      ok((await nombres()).length === 0, `${t} de lejos (zoom 13), sin nombres`);
      const tam = await page.evaluate(() => { const e = document.querySelector('.marca .mc-cara, .grupo-marca'); const r = e && e.getBoundingClientRect(); return r ? Math.max(r.width, r.height) : 0; });
      ok(tam > 0 && tam <= 34, `${t} marcadores pequeños (${Math.round(tam)} px)`);
      await page.evaluate(() => window.KlendarMapa.jumpTo({ zoom: 16 }));
      await quieto(page);
      await page.waitForTimeout(100);
      const ns = await nombres();
      const pisan = ns.some((a, i) => ns.some((b, j) => j > i && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b));
      ok(!pisan && ns.every((n) => n.h < 26), `${t} de cerca (zoom 16): ${ns.length} nombres, en una línea y sin pisarse`);
      // 5c. Identidad: coral solo en lo de oferta. Un anillo coral por cada
      // sitio con una oferta flash, como mucho; los demás, en tinta.
      const colores = await page.evaluate(() => {
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        const hex = (h) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
        const coralEn = [...document.querySelectorAll('#mapa .marca .mc-cara, #mapa .grupo-marca')]
          .filter((e) => getComputedStyle(e).boxShadow.includes(hex(accent)));
        const ofertas = coralEn.every((e) => e.closest('.anillo-oferta'));
        const flash = JSON.parse(document.getElementById('mapaPuntos').textContent).filter((p) => p.k === 'f').length;
        return { coral: coralEn.length, ofertas, flash, ambar: [...document.querySelectorAll('#mapa .anillo-flash')].length };
      });
      ok(colores.ofertas && colores.coral <= colores.flash && colores.ambar === 0, `${t} coral solo en las ofertas (${JSON.stringify(colores)})`);
      // 4. Desde el 17, ni una burbuja (se separan solas al acercar).
      await page.evaluate(() => window.KlendarMapa.jumpTo({ zoom: 17.2 }));
      await quieto(page);
      ok((await cuenta(page)).burbujas.length === 0, `${t} desde el zoom 17, sin burbujas`);

      // 3. Una burbuja acerca hasta separar.
      await page.evaluate(() => window.KlendarMapa.jumpTo({ center: [-3.70, 40.385], zoom: 12 }));
      await quieto(page);
      const antes = await page.evaluate(() => window.KlendarMapa.getZoom());
      const burbuja = page.locator('.grupo-marca').first();
      if (await burbuja.count()) {
        const n = Number(await burbuja.innerText());
        await page.evaluate(() => {
          const b = document.querySelector('.grupo-marca');
          b.scrollIntoView();
          b.click();
        });
        await page.waitForTimeout(700);
        await quieto(page);
        const despues = await page.evaluate(() => window.KlendarMapa.getZoom());
        ok(despues > antes, `${t} la burbuja de ${n} acerca (${antes.toFixed(2)} → ${despues.toFixed(2)})`);
      } else ok(false, `${t} hay alguna burbuja a zoom 12`);
      await page.screenshot({ path: `${OUT}/web-planes-${nombre}-${forma}-${tema}.png` });

      // 1. El sitio con más planes: su marcador y su hoja.
      const KA = await page.evaluate(() => {
        const s = window.KlendarAgrupa.sitios(JSON.parse(document.getElementById('mapaPuntos').textContent))
          .sort((a, b) => b.items.length - a.items.length)[0];
        return { lat: s.lat, lng: s.lng, n: s.items.length, nombre: s.items[0].sn };
      });
      await page.evaluate((s) => window.KlendarMapa.jumpTo({ center: [s.lng, s.lat], zoom: 18 }), KA);
      await quieto(page);
      const marca = page.locator(`.marca[aria-label$=", ${KA.n} planes"]`).first();
      ok(await marca.count() === 1, `${t} «${KA.nombre}»: un marcador con «${KA.n} planes»`);
      await page.screenshot({ path: `${OUT}/web-planes-sitio-${nombre}-${forma}-${tema}.png` });
      await marca.click();
      const hoja = page.locator('.pop-lugar');
      await hoja.waitFor({ timeout: 5000 }).catch(() => {});
      ok(await hoja.count() === 1, `${t} tocarlo abre la hoja del sitio`);
      ok(/Cómo llegar/.test(await hoja.innerText()), `${t} con «Cómo llegar»`);
      const filas = await hoja.locator('.pl-lista li').count();
      ok(filas === Math.min(8, KA.n), `${t} la primera parte: ${filas} de ${KA.n}`);
      ok(/\d{2}:\d{2}/.test(await hoja.locator('.pl-cuando').first().innerText()), `${t} cada plan con su día y hora`);
      await page.screenshot({ path: `${OUT}/web-planes-hoja-${nombre}-${forma}-${tema}.png` });
      if (KA.n > 8) {
        ok(new RegExp(`Ver ${KA.n - 8} más`).test(await hoja.locator('.pl-mas').innerText()), `${t} «Ver ${KA.n - 8} más»`);
        while (await hoja.locator('.pl-mas').count()) await hoja.locator('.pl-mas').click();
        ok(await hoja.locator('.pl-lista li').count() === KA.n, `${t} por partes hasta los ${KA.n}`);
      }
      if (forma === 'movil') {
        const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
        ok(ancho <= 375, `${t} sin desbordar a lo ancho (${ancho})`);
      }

      // 6. Sitios.
      if (tema === 'light') {
        const pide = page.waitForResponse((r) => r.url().includes('/rpc/map_places'), { timeout: 30000 }).catch(() => null);
        await page.goto(`${BASE}/explorar/?que=sitios&vista=mapa&lat=40.4168&lng=-3.7038`);
        ok(Boolean(await pide), `${t} Sitios pide map_places`);
        const capas = await page.waitForFunction(() => {
          const c = document.getElementById('mapa-sitios');
          const m = c && c.querySelector('.mapboxgl-canvas') && window.mapboxgl && c._mapa;
          return m || document.querySelector('#mapa-sitios .mapboxgl-canvas');
        }, null, { timeout: 20000 }).then(() => true).catch(() => false);
        ok(capas, `${t} Sitios: el mapa sale`);
        // Los mismos marcadores que Planes: el círculo de 30 px (o la
        // burbuja), con anillo en tinta los que tienen planes hoy (nunca
        // coral: en Sitios no hay ofertas).
        const mismo = await page.waitForFunction(() => {
          const e = document.querySelector('#mapa-sitios .marca .mc-cara, #mapa-sitios .grupo-marca');
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return { tam: Math.round(Math.max(r.width, r.height)), coral: document.querySelectorAll('#mapa-sitios .anillo-oferta').length, planes: document.querySelectorAll('#mapa-sitios .marca.anillo-planes').length, sin: document.querySelectorAll('#mapa-sitios .marca:not(.anillo-planes)').length };
        }, null, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => null);
        ok(mismo && mismo.tam >= 28 && mismo.tam <= 34 && mismo.coral === 0, `${t} Sitios: los marcadores de Planes, sin coral (${JSON.stringify(mismo)})`);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUT}/web-sitios-${nombre}-${forma}.png` });
      }
      ok(errores.length === 0, `${t} sin errores en la consola${errores.length ? `: ${errores.join(' | ')}` : ''}`);
      await ctx.close();
    }
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
