// El mapa de Explorar con varios planes en el mismo sitio (2026-10-25), con las
// Functions de verdad contra un Supabase falso y Mapbox de verdad. Desde que las
// pruebas no pueden llegar a Supabase (03abcf9, 5-11), contra la base vacía no
// había ningún plan: el mapa cargaba sin marcadores y esto decía «sin mapa, con
// aviso». Por eso lleva sus propios planes (Iván, 6-11):
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
//  8. El logo de Mapbox y la atribución, dentro del mapa y a la vista: con
//     la hoja del sitio abierta suben por encima de ella (Mapbox lo pide).
// Chromium y WebKit, móvil (375, o ANCHO_MOVIL) y escritorio. Capturas en OUT.
//
// Arranca su serve_dev (con Supabase cortado) y su Supabase falso. Mapbox pide
// un token: el de klendar/env/dev.json, como serve_dev, o MAPBOX_TOKEN.
//
//   PW=<ruta a playwright> OUT=<carpeta> node tools/mapa_check.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { SUPA, playwright, servidorSeguro, supabaseVacio } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();
const PUERTO = Number(process.env.MAPA_PORT || 8865);
const FALSO_PORT = Number(process.env.FALSO_PORT || 8866);
const BASE = `http://localhost:${PUERTO}`;
// Las capturas, en tools/out/ (git las ignora): en la raíz se publicaban
// en klendar.app (revisión del 3-11-2026, 5.4).
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
// Usera y Arganzuela (Madrid): la agenda pública tiene muchos planes en los
// mismos centros culturales.
const AQUI = 'lat=40.39&lng=-3.70';

// Los planes de la prueba: un centro cultural con 11 (su hoja va por partes) y
// sitios sueltos a unos 400 m (burbujas a zoom 12, separados a zoom 17), dos
// con una oferta de verdad (el anillo coral).
const iso = (dias) => new Date(Date.now() + dias * 864e5).toISOString();
const plan = (id, extra) => ({
  id: `a1000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  kind: 'future_event', status: 'active', time_zone: 'Europe/Madrid', images: [], ...extra,
});
const PLANES = [
  ...Array.from({ length: 11 }, (_, i) => plan(i + 1, {
    title: `Taller ${i + 1}`, starts_at: iso(i + 1), imported: true,
    business_id: 'b1000000-0000-4000-8000-000000000001', business_name: 'Centro Cultural Sonda', lat: 40.39, lng: -3.70,
  })),
  ...Array.from({ length: 16 }, (_, i) => {
    const oferta = i < 2;
    return plan(i + 20, {
      title: `Plan ${i + 1}`,
      business_id: `b1000000-0000-4000-8000-${String(i + 2).padStart(12, '0')}`, business_name: `Sitio ${i + 1}`,
      lat: 40.375 + (i % 4) * 0.0035 + Math.floor(i / 4) * 0.0005, lng: -3.712 + Math.floor(i / 4) * 0.0045,
      ...(oferta
        ? { kind: 'flash_offer', starts_at: iso(-0.1), redeem_end_at: iso(0.2), discount: { type: 'fixed', value: 3 } }
        : { starts_at: iso(i + 1) }),
    });
  }),
];
// `map_places` (lo pide el navegador): seis sitios en el centro de Madrid.
const SITIOS = Array.from({ length: 6 }, (_, i) => ({
  id: `b2000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, name: `Sitio ${i + 1}`,
  lat: 40.40 + i * 0.006, lng: -3.72 + (i % 3) * 0.012, category_slug: 'bares', has_offer: i === 0, plans_today: i < 2 ? 1 : 0,
}));

/** El Supabase de las Functions: los planes de arriba y lo demás, vacío. */
const falso = createServer((req, res) => {
  let cuerpo = '';
  req.on('data', (c) => { cuerpo += c; });
  req.on('end', () => {
    res.writeHead(200, { 'content-type': 'application/json', 'content-range': '*/0' });
    const fn = new URL(req.url, 'http://x').pathname.replace('/rest/v1/rpc/', '');
    if (fn === 'public_explore') {
      const { p_limit: n = 60, p_offset: d = 0 } = JSON.parse(cuerpo || '{}');
      res.end(JSON.stringify({ items: PLANES.slice(d, d + n), total: PLANES.length }));
    } else if (fn === 'public_places') res.end(JSON.stringify({ items: [], total: 0 }));
    else res.end('[]');
  });
});
await new Promise((r) => falso.listen(FALSO_PORT, r));
const servidor = spawn(process.execPath, [fileURLToPath(new URL('./serve_dev.mjs', import.meta.url))], {
  env: { ...process.env, PORT: String(PUERTO), SUPABASE_URL: `http://localhost:${FALSO_PORT}`, SUPABASE_KEY: 'falsa', SUPABASE_URL_NAVEGADOR: SUPA }, stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 2000));
// Su serve_dev no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

/** Espera a que el mapa haya terminado de moverse y de pintar marcadores. */
const quieto = (page) => page.evaluate(() => new Promise((r) => {
  const m = window.KlendarMapa;
  if (!m.isMoving()) setTimeout(r, 250);
  else m.once('idle', () => setTimeout(r, 250));
}));

/** Pares de marcadores o burbujas que se pisan (sus círculos) dentro de [caja]. */
const solapes = (page, caja) => page.evaluate((sel) => {
  const c = document.querySelector(sel).getBoundingClientRect();
  const rs = [...document.querySelectorAll(`${sel} .marca:not(.elegida) .mc-cara, ${sel} .grupo-marca`)]
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.right > c.left && r.left < c.right && r.bottom > c.top && r.top < c.bottom);
  const out = [];
  for (let i = 0; i < rs.length; i++) {
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i];
      const b = rs[j];
      // Un píxel de margen (el antialias del borde).
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push([Math.round(a.left), Math.round(a.top), Math.round(b.left), Math.round(b.top)]);
    }
  }
  return out;
}, caja);

/** El logo de Mapbox y la atribución de [caja]: si están dentro del mapa, se
 * ven y no los tapa la hoja del sitio. */
const atribucion = (page, caja) => page.evaluate((sel) => {
  const c = document.querySelector(sel).getBoundingClientRect();
  const hoja = document.querySelector(`${sel} .hoja-lugar`);
  const h = hoja && hoja.getBoundingClientRect();
  const mira = (q) => {
    const e = document.querySelector(`${sel} ${q}`);
    if (!e) return 'no está';
    const r = e.getBoundingClientRect();
    const st = getComputedStyle(e);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 1 || !r.width) return 'no se ve';
    if (r.left < c.left || r.right > c.right || r.top < c.top || r.bottom > c.bottom) return 'fuera del mapa';
    const pisa = (o) => o && r.left < o.right && o.left < r.right && r.top < o.bottom && o.top < r.bottom;
    if (pisa(h)) return 'tapado por la hoja';
    const zoom = document.querySelector(`${sel} .mapboxgl-ctrl-top-right .mapboxgl-ctrl-group`);
    if (pisa(zoom && zoom.getBoundingClientRect())) return 'encima de los botones de zoom';
    return 'bien';
  };
  return { logo: mira('.mapboxgl-ctrl-logo'), atribucion: mira('.mapboxgl-ctrl-attrib') };
}, caja);

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
  for (const [forma, vp] of [['movil', { width: Number(process.env.ANCHO_MOVIL || 375), height: 812 }], ['escritorio', { width: 1280, height: 900 }]]) {
    for (const tema of ['light', 'dark']) {
      const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES', colorScheme: tema });
      // Lo que lee de pasada (formas de entrar, ciudades…): base vacía simulada.
      await supabaseVacio(ctx);
      await ctx.route(`${SUPA}/rest/v1/rpc/map_places`, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(SITIOS) }));
      const page = await ctx.newPage();
      const errores = [];
      const deMapbox = (x) => /mapbox|webgl|tile|Failed to load resource|^Error$|Load failed/i.test(x);
      page.on('console', (m) => { if (m.type() === 'error' && !deMapbox(m.text())) errores.push(m.text()); });
      page.on('pageerror', (e) => { if (!deMapbox(`${e.message} ${e.stack || ''}`)) errores.push(String(e)); });
      const t = `[${nombre} ${forma} ${tema}]`;

      await page.goto(`${BASE}/explorar?vista=mapa&${AQUI}`);
      const puntos = await page.evaluate(() => JSON.parse(document.getElementById('mapaPuntos').textContent));
      // Si no llegan planes, lo de abajo no prueba nada: que se diga eso.
      ok(puntos.length === PLANES.length, `${t} la página trae los ${PLANES.length} planes (${puntos.length})`);
      const conMapa = await page.waitForFunction(() => window.KlendarMapa && window.KlendarMapa.loaded()
        && document.querySelector('.grupo-marca, .marca'), null, { timeout: 30000 }).then(() => true).catch(() => false);
      if (!conMapa) {
        // El mapa ha cargado y aun así no hay marcadores: eso no es «sin mapa».
        const cargado = await page.evaluate(() => Boolean(window.KlendarMapa?.loaded()));
        ok(!cargado, `${t} el mapa ha cargado y no pinta ningún marcador`);
        // WebKit sin GPU no siempre pinta Mapbox: entonces sale el aviso.
        if (!cargado) ok(await page.locator('#mapa.sin-mapa, #mapa .empty').count() > 0 || nombre === 'webkit', `${t} sin mapa, con aviso`);
        await page.screenshot({ path: `${OUT}/web-planes-sin-mapa-${nombre}-${forma}-${tema}.png` });
        await ctx.close();
        continue;
      }
      await quieto(page);
      // 2. El número son planes.
      for (const z of [11, 13, 15, 16.5, 17]) {
        await page.evaluate((zz) => window.KlendarMapa.jumpTo({ zoom: zz }), z);
        await quieto(page);
        const c = await cuenta(page);
        ok(c.total === puntos.length, `${t} zoom ${z}: burbujas + sitios + chinchetas = ${c.total} planes de ${puntos.length}`);
        // 1b. A ningún zoom se pisan dos marcadores o burbujas.
        const pisan = await solapes(page, '#mapa');
        ok(pisan.length === 0, `${t} zoom ${z}: ningún marcador encima de otro${pisan.length ? ` (${JSON.stringify(pisan.slice(0, 3))})` : ''}`);
      }
      // 5b. Los nombres: de lejos ninguno; de cerca, en una línea y sin
      // pisarse entre ellos.
      const nombres = () => page.evaluate(() => [...document.querySelectorAll('.marca-nombre')]
        .filter((n) => !n.hidden).map((n) => { const r = n.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, h: r.height }; }));
      await page.evaluate(() => window.KlendarMapa.jumpTo({ zoom: 13 }));
      await quieto(page);
      ok((await nombres()).length === 0, `${t} de lejos (zoom 13), sin nombres`);
      const tam = await page.evaluate(() => { const e = document.querySelector('.marca .mc-cara, .grupo-marca'); const r = e && e.getBoundingClientRect(); return r ? Math.max(r.width, r.height) : 0; });
      ok(tam >= 34 && tam <= 38, `${t} marcadores de 36 px (${Math.round(tam)} px)`);
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
        const flash = JSON.parse(document.getElementById('mapaPuntos').textContent).filter((p) => p.k === 'f' || p.d).length;
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
      const verLogo = async (cuando) => {
        await page.waitForTimeout(200);
        const a = await atribucion(page, '#mapa');
        ok(a.logo === 'bien' && a.atribucion === 'bien', `${t} ${cuando}: logo de Mapbox y atribución a la vista (${JSON.stringify(a)})`);
      };
      await verLogo('sin hoja');
      await marca.click();
      const hoja = page.locator('.pop-lugar');
      await hoja.waitFor({ timeout: 5000 }).catch(() => {});
      ok(await hoja.count() === 1, `${t} tocarlo abre la hoja del sitio`);
      ok(/Cómo llegar/.test(await hoja.innerText()), `${t} con «Cómo llegar»`);
      const filas = await hoja.locator('.pl-lista li').count();
      ok(filas === Math.min(8, KA.n), `${t} la primera parte: ${filas} de ${KA.n}`);
      ok(/\d{2}:\d{2}/.test(await hoja.locator('.pl-cuando').first().innerText()), `${t} cada plan con su día y hora`);
      await verLogo('con la hoja');
      await page.screenshot({ path: `${OUT}/web-planes-hoja-${nombre}-${forma}-${tema}.png` });
      if (KA.n > 8) {
        ok(new RegExp(`Ver ${KA.n - 8} más`).test(await hoja.locator('.pl-mas').innerText()), `${t} «Ver ${KA.n - 8} más»`);
        while (await hoja.locator('.pl-mas').count()) await hoja.locator('.pl-mas').click();
        ok(await hoja.locator('.pl-lista li').count() === KA.n, `${t} por partes hasta los ${KA.n}`);
        await verLogo('con la hoja entera');
        await page.screenshot({ path: `${OUT}/web-planes-hoja-entera-${nombre}-${forma}-${tema}.png` });
      }
      await page.keyboard.press('Escape');
      await verLogo('al cerrar la hoja');
      if (forma === 'movil') {
        const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
        ok(ancho <= vp.width, `${t} sin desbordar a lo ancho (${ancho})`);
      }

      // 6. Sitios.
      if (tema === 'light') {
        const pide = page.waitForResponse((r) => r.url().includes('/rpc/map_places'), { timeout: 30000 }).catch(() => null);
        await page.goto(`${BASE}/explorar?que=sitios&vista=mapa&lat=40.4168&lng=-3.7038`);
        ok(Boolean(await pide), `${t} Sitios pide map_places`);
        const capas = await page.waitForFunction(() => {
          const c = document.getElementById('mapa-sitios');
          const m = c && c.querySelector('.mapboxgl-canvas') && window.mapboxgl && c._mapa;
          return m || document.querySelector('#mapa-sitios .mapboxgl-canvas');
        }, null, { timeout: 20000 }).then(() => true).catch(() => false);
        ok(capas, `${t} Sitios: el mapa sale`);
        // Los mismos marcadores que Planes: el círculo de 30 px (o la
        // burbuja), con el icono de su categoría o su logo (en Planes, el del
        // tipo de plan), anillo coral si tienen oferta hoy y en tinta si
        // tienen planes.
        const mismo = await page.waitForFunction(() => {
          const e = document.querySelector('#mapa-sitios .marca .mc-cara, #mapa-sitios .grupo-marca');
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return { tam: Math.round(Math.max(r.width, r.height)), coral: document.querySelectorAll('#mapa-sitios .anillo-oferta').length, planes: document.querySelectorAll('#mapa-sitios .marca.anillo-planes').length, sin: document.querySelectorAll('#mapa-sitios .marca:not(.anillo-planes)').length };
        }, null, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => null);
        ok(mismo && mismo.tam >= 34 && mismo.tam <= 38, `${t} Sitios: los marcadores de Planes (${JSON.stringify(mismo)})`);
        const pisanS = await solapes(page, '#mapa-sitios');
        ok(pisanS.length === 0, `${t} Sitios: ningún marcador encima de otro`);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUT}/web-sitios-${nombre}-${forma}.png` });
      }
      ok(errores.length === 0, `${t} sin errores en la consola${errores.length ? `: ${errores.join(' | ')}` : ''}`);
      await ctx.close();
    }
  }
  await nav.close();
}
servidor.kill();
falso.close();
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
