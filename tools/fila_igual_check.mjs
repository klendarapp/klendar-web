// La fila de filtros idéntica en las cinco vistas (Iván, 2026-10-28), en la
// web local contra dev y solo leyendo: Descubre, Planes (lista, calendario y
// mapa) y Sitios (lista y mapa). En un mismo ancho, los mismos textos, los
// mismos iconos y cada botón en el mismo sitio y del mismo tamaño (como la
// app, `test/fila_filtros_igual_test.dart`). Con «Cerca de ti» y sin
// ubicación («Todas las ciudades»), en 360 y 390 px, Chromium y WebKit.
// En 360 px sin ubicación, «Todo» entero y el dónde dice «Todas».
//
//   PORT=8857 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8857 node tools/fila_igual_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8857';
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

const VISTAS = [
  ['descubre', '/descubre/'],
  ['planes-lista', '/explorar/?vista=lista'],
  ['planes-calendario', '/explorar/?vista=calendario'],
  ['planes-mapa', '/explorar/?vista=mapa'],
  ['sitios-lista', '/explorar/?que=sitios'],
  ['sitios-mapa', '/explorar/?que=sitios&vista=mapa'],
];

/** Lo que se ve de la fila: los textos y la caja de cada botón. */
const fila = (page) => page.evaluate(() => {
  const barra = document.querySelector('#barra');
  const caja = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; };
  const botones = [...barra.querySelectorAll('.barra-preg > .desplegable > summary, .barra-preg > .hoja > summary, :scope > .hoja > summary')]
    .filter((s) => s.offsetParent !== null);
  return {
    textos: botones.map((s) => s.innerText.replace(/\s+/g, ' ').trim()),
    cajas: botones.map(caja),
    iconos: botones.map((s) => s.querySelectorAll('.ic').length),
    // Textos cortados con «…» (innerText los da enteros).
    cortados: [...barra.querySelectorAll('.chip-t')].filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.innerText),
  };
});

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const ancho of [360, 390]) {
    for (const [zona, qs] of [['cerca', 'lat=40.417&lng=-3.704'], ['todas', '']]) {
      // Como un móvil: sin la barra de desplazamiento de escritorio (15 px que
      // solo tenían las páginas que se desplazan y estrechaban su fila).
      const ctx = await nav.newContext({ viewport: { width: ancho, height: 780 }, locale: 'es-ES', isMobile: nombre === 'chromium', hasTouch: true });
      const page = await ctx.newPage();
      const t = `[${nombre} ${ancho} ${zona}]`;
      let primera = null;
      for (const [vista, ruta] of VISTAS) {
        const url = `${BASE}${ruta}${ruta.includes('?') ? '&' : '?'}${qs}`;
        // Sin lo guardado de la página de antes (cada vista con su dirección).
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => { try { sessionStorage.setItem('klendar.filtros.sin', '1'); localStorage.clear(); } catch {} });
        // Dev a veces da 500 (la página sale sin la fila): se repite.
        for (let i = 0; i < 4; i++) {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          if (await page.locator('#barra').count()) break;
          await page.waitForTimeout(3000);
        }
        await page.waitForSelector('#barra');
        await page.waitForTimeout(400);
        const f = await fila(page);
        if (ancho === 360) await page.screenshot({ path: `${OUT}/web-${nombre}-${zona}-${vista}.png`, clip: { x: 0, y: 0, width: ancho, height: 260 } });
        if (!primera) {
          primera = f;
          ok(f.textos.length === 4, `${t} ${vista}: cuatro botones (${f.textos.join(' | ')})`);
          ok(f.cortados.length === 0, `${t} ${vista}: nada cortado de serie (${f.cortados.join(', ')})`);
          const anchoFila = f.cajas.at(-1)[0] + f.cajas.at(-1)[1];
          ok(anchoFila <= ancho, `${t} ☰ dentro de la pantalla (${anchoFila})`);
          if (ancho === 360) {
            ok(f.textos.includes('Todo'), `${t} «Todo» entero`);
            if (zona === 'todas') ok(f.textos[0] === 'Todas', `${t} el dónde dice «Todas» (${f.textos[0]})`);
            else ok(f.textos[0] === '5 km', `${t} el dónde dice «5 km» (${f.textos[0]})`);
          }
          continue;
        }
        ok(JSON.stringify(f.textos) === JSON.stringify(primera.textos), `${t} ${vista}: los mismos textos (${f.textos.join(' | ')})`);
        ok(JSON.stringify(f.iconos) === JSON.stringify(primera.iconos), `${t} ${vista}: los mismos iconos`);
        ok(JSON.stringify(f.cajas) === JSON.stringify(primera.cajas), `${t} ${vista}: cada botón en el mismo sitio (${JSON.stringify(f.cajas)} / ${JSON.stringify(primera.cajas)})`);
      }
      await ctx.close();
    }
  }
  await nav.close();
}
console.log(fallos ? `${fallos} fallo(s)` : 'todo bien');
process.exit(fallos ? 1 : 0);
