// «Lo ya visto, al final» (Iván, 2026-10-28) en la web local, contra dev y
// solo leyendo. El interruptor (`app_config.seen_last`) está apagado hasta
// que se publique lo legal: el servidor local lo enciende con
// VISTOS_FORZADO=1.
//  1. Sin nada visto, Descubre y la lista salen en el orden de la base (la
//     misma página sin /assets/vistos.js).
//  2. Cuenta como vista a los 1,5 s con la mitad a la vista (1 s no basta) y
//     solo se guarda en el navegador (`klendar.vistos`), sin peticiones.
//  3. Al volver a cargar, lo visto va al final: detrás de la separación «Ya
//     has visto todo lo nuevo · Esto ya lo viste», en el mismo orden, y no
//     se esconde nada ni se repite (también al traer las páginas siguientes:
//     Descubre sola, la lista con «Ver más»).
//  4. Con otra huella (ha bajado de precio…) vuelve a ser nueva; con más de
//     7 días, también.
//  5. Con «Reducir movimiento», la separación sin animación.
//  6. Sin errores en la consola.
// Chromium y WebKit, móvil (375) y escritorio. Capturas en OUT.
//
//   VISTOS_FORZADO=1 PORT=8879 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8879 node tools/vistos_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8879';
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

// Las ofertas flash de Madrid (una página: unas 14) y 124 «Visitas y experiencias»
// (seis páginas de 24).
const UNA = '?ciudad=Madrid&tipo=offers';
const VARIAS = '?ciudad=Madrid&categoria=experiences';

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [forma, vp] of [['movil', { width: 375, height: 812 }], ['escritorio', { width: 1280, height: 900 }]]) {
    const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
    const page = await ctx.newPage();
    const errores = [];
    const ruido = (x) => /mapbox|webgl|tile|Failed to load resource|^Error$|Load failed/i.test(x);
    page.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) errores.push(m.text()); });
    page.on('pageerror', (e) => { if (!ruido(`${e.message}`)) errores.push(String(e)); });
    const fuera = [];
    page.on('request', (r) => { if (/vistos/.test(r.postData() || '')) fuera.push(r.url()); });
    const t = `[${nombre} ${forma}]`;
    const ir = (u) => page.goto(`${BASE}${u}`, { waitUntil: 'load' });
    const ids = (sel) => page.$$eval(sel, (l) => l.map((e) => e.getAttribute('data-o')));
    const guardado = () => page.evaluate(() => JSON.parse(localStorage.getItem('klendar.vistos') || '{}'));
    const pon = (m) => page.evaluate((x) => localStorage.setItem('klendar.vistos', JSON.stringify(x)), m);

    // 1. Sin nada visto: el orden de la base.
    await page.route('**/assets/vistos.js*', (r) => r.fulfill({ body: '', contentType: 'text/javascript' }));
    await ir(`/descubre/${UNA}`);
    const base = await ids('#feed > .tj');
    await ir(`/explorar/${VARIAS}`);
    const baseLista = await ids('.tjs[data-vistos] > .tj');
    // Cuántas hay en total («124 resultados»).
    const TOTAL = Number((await page.$eval('.resumen-n', (e) => e.textContent)).replace(/\D/g, ''));
    await page.unroute('**/assets/vistos.js*');
    ok(base.length >= 6 && base.length < 24 && baseLista.length === 24, `${t} la base: ${base.length} en Descubre (una sola página) y 24 en la primera página de la lista`);
    await ir(`/descubre/${UNA}`);
    await page.evaluate(() => localStorage.removeItem('klendar.vistos'));
    await ir(`/descubre/${UNA}`);
    ok(JSON.stringify(await ids('#feed > .tj')) === JSON.stringify(base), `${t} Descubre sin nada visto: el orden de la base`);
    ok(!(await page.$('.feed-sep')), `${t} sin nada visto, sin separación`);

    // 2. 1 s no basta; 1,5 s sí.
    await page.evaluate(() => localStorage.removeItem('klendar.vistos'));
    await ir(`/descubre/${UNA}`);
    await page.waitForTimeout(900);
    ok(!(base[0] in (await guardado())), `${t} a la vista menos de 1,5 s: aún no cuenta`);
    await page.waitForTimeout(1100);
    const g = await guardado();
    ok(base[0] in g && Array.isArray(g[base[0]]) && g[base[0]][1].length === 8, `${t} a la vista 2 s: vista (con su huella)`);
    ok(!(base[1] in g), `${t} la de debajo, que no se ha visto, no cuenta`);

    // 3. Lo visto, al final (una página).
    const vh = await page.$$eval('#feed > .tj', (l) => Object.fromEntries(l.map((e) => [e.getAttribute('data-o'), e.getAttribute('data-vh')])));
    const ahora = Math.floor(Date.now() / 1000);
    const vistas = [base[0], base[2], base[5]];
    await pon(Object.fromEntries(vistas.map((id) => [id, [ahora - 60, vh[id]]])));
    await ir(`/descubre/${UNA}`);
    const orden = await page.$$eval('#feed > .tj, #feed > .feed-sep', (l) => l.map((e) => (e.classList.contains('feed-sep') ? 'SEP' : e.getAttribute('data-o'))));
    const sep = orden.indexOf('SEP');
    ok(sep === base.length - vistas.length, `${t} la separación, detrás de lo nuevo`);
    ok(JSON.stringify(orden.slice(sep + 1)) === JSON.stringify(vistas), `${t} lo visto, al final y en el mismo orden`);
    ok(JSON.stringify(orden.slice(0, sep)) === JSON.stringify(base.filter((id) => !vistas.includes(id))), `${t} lo nuevo, en el orden de la base`);
    ok(new Set(orden).size === orden.length && orden.length === base.length + 1, `${t} nada escondido ni repetido`);
    const texto = await page.$eval('.feed-sep', (e) => e.textContent.replace(/\s+/g, ' ').trim());
    ok(/Ya has visto todo lo nuevo/.test(texto) && /Esto ya lo viste/.test(texto), `${t} los textos de la separación`);
    await page.$eval('.feed-sep', (e) => e.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/vistos-descubre-${nombre}-${forma}.png` });

    // 4. Otra huella, o más de 7 días: otra vez nueva.
    await pon({ [base[0]]: [ahora - 60, '00000000'], [base[2]]: [ahora - 8 * 86400, vh[base[2]]] });
    await ir(`/descubre/${UNA}`);
    ok(!(await page.$('.feed-sep')), `${t} con otra huella o de hace 8 días: nueva (sin separación)`);

    // 3b. Varias páginas: Descubre trae las siguientes sola.
    await page.evaluate(() => localStorage.removeItem('klendar.vistos'));
    await ir(`/explorar/${VARIAS}`);
    const vhL = await page.$$eval('.tjs[data-vistos] > .tj', (l) => Object.fromEntries(l.map((e) => [e.getAttribute('data-o'), e.getAttribute('data-vh')])));
    const vistasL = baseLista.slice(0, 20);
    await pon(Object.fromEntries(vistasL.map((id) => [id, [ahora - 60, vhL[id]]])));
    await ir(`/descubre/${VARIAS}`);
    for (let i = 0; i < 15 && !(await page.$('#feed > .feed-sep')); i++) {
      await page.evaluate(() => { const m = document.querySelector('[data-feed-mas]'); if (m) m.scrollIntoView(); });
      await page.waitForTimeout(700);
    }
    const ordenD = await page.$$eval('#feed > .tj, #feed > .feed-sep', (l) => l.map((e) => (e.classList.contains('feed-sep') ? 'SEP' : e.getAttribute('data-o'))));
    const sepD = ordenD.indexOf('SEP');
    ok(sepD > 0 && JSON.stringify(ordenD.slice(sepD + 1)) === JSON.stringify(vistasL), `${t} Descubre por partes: lo visto, al final de todo (${ordenD.length - 1} publicaciones)`);
    ok(new Set(ordenD).size === ordenD.length && ordenD.length - 1 === TOTAL, `${t} Descubre por partes: todas (${TOTAL}), sin repetir ninguna`);
    ok(ordenD.slice(0, 4).every((id) => !vistasL.includes(id)), `${t} Descubre por partes: arriba, lo nuevo`);

    // 3c. La lista: «Ver más» en vez de las páginas.
    await ir(`/explorar/${VARIAS}`);
    ok(await page.$eval('nav.pager', (n) => n.hidden), `${t} la lista: sin las páginas numeradas`);
    for (let i = 0; i < 10; i++) {
      if (!(await page.$('.vistos-mas button'))) break;
      // (Como un toque; la cabecera fija tapa el botón al bajar a él.)
      await page.evaluate(() => document.querySelector('.vistos-mas button').click());
      await page.waitForTimeout(800);
    }
    const ordenL = await page.$$eval('.tjs[data-vistos] > .tj, .tjs[data-vistos] > .vistos-sep', (l) => l.map((e) => (e.classList.contains('vistos-sep') ? 'SEP' : e.getAttribute('data-o'))));
    const sepL = ordenL.indexOf('SEP');
    ok(sepL > 0 && JSON.stringify(ordenL.slice(sepL + 1)) === JSON.stringify(vistasL), `${t} la lista: lo visto, al final`);
    ok(new Set(ordenL).size === ordenL.length && ordenL.length - 1 === TOTAL, `${t} la lista: todas (${TOTAL}), sin repetir ninguna`);
    ok(Boolean(await page.$('section.fin')), `${t} la lista: el final de siempre al acabar`);
    await page.$eval('.vistos-sep', (e) => e.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/vistos-lista-${nombre}-${forma}.png` });

    // 5. Reducir movimiento: sin animación.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await pon(Object.fromEntries(vistas.map((id) => [id, [ahora - 60, vh[id]]])));
    await ir(`/descubre/${UNA}`);
    const quieto = await page.$eval('.feed-sep .vs-in', (e) => {
      const c = getComputedStyle(e);
      return c.opacity === '1' && c.transform === 'none' && (c.transitionDuration === '0s' || c.transitionProperty === 'all' || c.transitionDuration === '');
    });
    ok(quieto, `${t} con «Reducir movimiento», la separación sin animación`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    ok(fuera.length === 0, `${t} lo visto no se manda a ningún sitio`);
    ok(errores.length === 0, `${t} sin errores en la consola${errores.length ? `: ${errores.slice(0, 3).join(' | ')}` : ''}`);
    await ctx.close();
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
