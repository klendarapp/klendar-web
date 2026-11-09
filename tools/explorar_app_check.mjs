// Explorar de la web como el de la app (Iván, 2026-11-03; revisión del
// 3-11, 1.1, opción a), en la web local contra dev y solo leyendo:
//
// - arriba, solo «Planes | Sitios» · la lista (solo web) · el botón de
//   vista, como `ExploreTopRow` pero sin lupa (en la web hay una sola, la de
//   la cabecera; Iván, 2026-11-04): sin título a la vista, sin entradilla,
//   sin «Dónde verlo» ni «Grupos y empresas», sin buscador en la página ni
//   fila de atajos y sin recuento («2699 resultados»);
// - la lupa de la cabecera abre la hoja «Buscar», la misma de Descubre (y
//   en la fila no hay otra);
// - Planes abre en el calendario; la lista sigue ahí (`?vista=lista`) y la
//   recuerda; una búsqueda sale en lista;
// - sin JavaScript: la lupa lleva a Explorar con la hoja abierta
//   (`?buscar=1`), y la página de serie tiene título, canonical, hreflang,
//   JSON-LD y enlaces a fichas (lo que lee Google);
// - Sitios y el mapa con su botón de la esquina; en inglés, los textos de la
//   app.
// Chromium a 390 y 1280 px (y WebKit a 390), sin desplazamiento lateral.
//
// Con sus propios datos (tools/_web_con_datos.mjs): antes leía los planes y
// las ciudades de dev y, desde que las pruebas no llegan a Supabase (5-11),
// el calendario, el JSON-LD y «Más formas de explorar» salían vacíos.
//
//   PW=<ruta a playwright> OUT=<carpeta> node tools/explorar_app_check.mjs
import { mkdirSync } from 'node:fs';
import { playwright } from './_supabase_simulado.mjs';
import { DATOS, webConDatos } from './_web_con_datos.mjs';

const { chromium, webkit } = playwright();
// Más planes en Madrid (uno al día, dos semanas): la lista sin JavaScript
// tiene que pasar de una página (24 por página).
const MOLDE = DATOS.PLANES.find((o) => o.kind === 'future_event' && !o.imported && o.status === 'active');
const MAS = Array.from({ length: 16 }, (_, i) => {
  const cuando = new Date(Date.now() + (i * 24 + 3) * 3600e3).toISOString();
  return { ...MOLDE, id: `a9000000-0000-4000-8000-${String(200 + i).padStart(12, '0')}`, title: `Plan de prueba ${i + 1}`, event_at: cuando, starts_at: cuando, event_end_at: null };
});
// «Más formas de explorar» sale de `public_cities` con la forma de la base
// (`{ city, slug, n }`); las de los datos de mentira no traen `city`.
const PUBLICADAS = DATOS.CIUDADES.map((c, i) => ({ city: c.name, slug: c.id, n: 30 - i }));
const web = await webConDatos({
  puerto: Number(process.env.PORT || 8986),
  datos: { ...DATOS, PLANES: [...DATOS.PLANES, ...MAS] },
  rpc: { public_cities: () => PUBLICADAS },
});
const BASE = web.BASE;
// Las capturas, en tools/out/ (git las ignora; nunca en la raíz publicada).
const OUT = process.env.OUT || 'tools/out';
mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

/** Va a la página (dev a veces da 500: se repite). */
async function ve(page, url, sel = '.que-fila') {
  for (let i = 0; i < 4; i++) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (await page.locator(sel).count()) break;
    await page.waitForTimeout(3000);
  }
  await page.waitForSelector(sel);
  await page.waitForTimeout(400);
}

/** Lo de arriba de Explorar. */
const arriba = (page) => page.evaluate(() => {
  const vis = (el) => Boolean(el) && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
    && el.getBoundingClientRect().width > 2;
  const h1 = document.querySelector('main h1, h1');
  return {
    h1: h1 ? { texto: h1.textContent.trim(), visible: vis(h1) && h1.getBoundingClientRect().height > 2 } : null,
    lead: Boolean(document.querySelector('.exp-lead')),
    enlaces: Boolean(document.querySelector('.exp-atajo')),
    buscadorPagina: [...document.querySelectorAll('form.buscador')].some((f) => !f.closest('details.hoja')),
    atajosFila: Boolean(document.querySelector('.atajos-fila')),
    recuento: Boolean(document.querySelector('.resumen-n')),
    que: [...document.querySelectorAll('.que-fila .que a')].map((a) => [a.textContent.trim(), a.classList.contains('on')]),
    botones: [...document.querySelectorAll('.que-fila .exp-acciones .exp-boton')].map((a) => a.getAttribute('aria-label')),
    calendario: Boolean(document.querySelector('.calendario')),
    lista: Boolean(document.querySelector('.tjs, .tj-grid, #resultados .tj, main .tj')) && !document.querySelector('.calendario'),
    mapa: Boolean(document.querySelector('#mapa, #mapa-sitios')),
    sitios: Boolean(document.querySelector('.sitios-lista, .sitio-fila')),
    ancho: document.documentElement.scrollWidth,
    fila: (() => { const f = document.querySelector('.que-fila').getBoundingClientRect(); return { izq: f.left, der: f.right }; })(),
    hojaBuscar: Boolean(document.querySelector('details.hoja-lupa#buscar')),
  };
});

for (const [nombre, tipo, anchos] of [['chromium', chromium, [390, 1280]], ['webkit', webkit, [390]]]) {
  const nav = await tipo.launch();
  for (const ancho of anchos) {
    const movil = ancho < 700;
    const ctx = await nav.newContext({ viewport: { width: ancho, height: movil ? 844 : 860 }, locale: 'es-ES',
      isMobile: movil && nombre === 'chromium', hasTouch: movil });
    const page = await ctx.newPage();
    const errores = [];
    // Mapbox en WebKit desde localhost («access control checks») no es nuestro.
    page.on('pageerror', (e) => { if (!/mapbox/.test(e.message)) errores.push(e.message); });
    const t = `[${nombre} ${ancho}]`;

    // ── Planes, de serie: el calendario ──
    await ve(page, `${BASE}/explorar/`);
    let a = await arriba(page);
    ok(a.h1 && a.h1.texto === 'Explorar' && !a.h1.visible, `${t} sin título a la vista (el <h1> «Explorar» solo para el lector y Google)`);
    ok(!a.lead && !a.enlaces, `${t} sin entradilla ni «Dónde verlo» / «Grupos y empresas» en la página`);
    ok(!a.buscadorPagina && !a.atajosFila, `${t} sin buscador ni atajos en la página`);
    ok(!a.recuento, `${t} sin recuento`);
    ok(JSON.stringify(a.que) === JSON.stringify([['Planes', true], ['Sitios', false]]), `${t} «Planes | Sitios» (${JSON.stringify(a.que)})`);
    ok(JSON.stringify(a.botones) === JSON.stringify(['Ver en lista', 'Ver en el mapa']), `${t} la lista (web) · «Ver en el mapa», sin lupa en la fila (${a.botones.join(' · ')})`);
    ok(a.calendario, `${t} Planes abre en el calendario`);
    ok(a.ancho <= ancho, `${t} sin desplazamiento lateral (${a.ancho})`);
    ok(a.fila.der <= ancho && a.fila.izq >= 0, `${t} la fila de arriba cabe (${JSON.stringify(a.fila)})`);
    await page.screenshot({ path: `${OUT}/explorar-app-${nombre}-${ancho}-calendario.png` });

    // ── La lupa de la cabecera (la única) abre «Buscar» (la de Descubre) ──
    ok(await page.locator('header.top [data-abre-hoja="buscar"]').isVisible(), `${t} la lupa de la cabecera se ve`);
    await page.click('header.top [data-abre-hoja="buscar"]');
    await page.waitForTimeout(700);
    let hoja = await page.evaluate(() => {
      const h = document.getElementById('buscar');
      return { abierta: h?.open, url: location.pathname + location.search, campo: Boolean(h?.querySelector('input[name=q]')),
        atajos: h ? h.querySelectorAll('.busq-sec .atajo').length : 0, accesos: [...(h?.querySelectorAll('.busq-atajo b') || [])].map((b) => b.textContent) };
    });
    ok(hoja.abierta && hoja.campo && hoja.url === '/explorar/', `${t} la lupa de Explorar abre la hoja «Buscar» sin salir de la página (${hoja.url})`);
    ok(hoja.atajos === 6, `${t} en la hoja, los atajos (${hoja.atajos})`);
    ok(hoja.accesos.includes('Dónde verlo') && hoja.accesos.includes('Grupos y empresas'), `${t} en la hoja, «Dónde verlo» y «Grupos y empresas» (${hoja.accesos.join(' · ')})`);
    await page.screenshot({ path: `${OUT}/explorar-app-${nombre}-${ancho}-buscar.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const foco = await page.evaluate(() => ({ cerrada: !document.getElementById('buscar').open,
      foco: document.activeElement?.closest('header.top') ? 'cabecera' : document.activeElement?.tagName }));
    ok(foco.cerrada && foco.foco === 'cabecera', `${t} Escape la cierra y el foco vuelve a la lupa (${foco.foco})`);
    // Buscar desde la hoja: los resultados, en lista.
    await page.click('header.top [data-abre-hoja="buscar"]');
    await page.waitForTimeout(500);
    await page.fill('#buscar input[name=q]', 'bar');
    await Promise.all([page.waitForURL(/\/explorar\/\?/, { waitUntil: 'commit' }), page.press('#buscar input[name=q]', 'Enter')]);
    await page.waitForSelector('.que-fila', { timeout: 60000 });
    a = await arriba(page);
    ok(/q=bar/.test(page.url()) && !a.calendario, `${t} una búsqueda sale en lista (${page.url().replace(BASE, '')})`);
    ok(a.botones[0] === 'Ver el calendario', `${t} con una búsqueda, el botón de la web lleva al calendario (${a.botones.join(' · ')})`);

    // ── La lista (solo web) ──
    await ve(page, `${BASE}/explorar/`);
    await Promise.all([page.waitForURL(/vista=lista/, { waitUntil: 'commit' }), page.click('.exp-acciones a[aria-label="Ver en lista"]')]);
    await page.waitForSelector('.que-fila');
    await page.waitForTimeout(400);
    a = await arriba(page);
    ok(!a.calendario && !a.recuento, `${t} «Ver en lista»: la lista, sin recuento`);
    ok(JSON.stringify(a.botones) === JSON.stringify(['Ver el calendario', 'Ver en el mapa']), `${t} en la lista: calendario · mapa (${a.botones.join(' · ')})`);
    await page.screenshot({ path: `${OUT}/explorar-app-${nombre}-${ancho}-lista.png` });
    // Se recuerda, como la app: al volver a /explorar/ sin nada, la lista.
    await page.goto(`${BASE}/explorar/`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/vista=lista/, { timeout: 8000 }).catch(() => {});
    ok(/vista=lista/.test(page.url()), `${t} recuerda la lista (${page.url().replace(BASE, '')})`);
    await page.waitForSelector('.que-fila');
    await Promise.all([page.waitForURL((u) => !/vista=/.test(u.search), { waitUntil: 'commit' }), page.click('.exp-acciones a[aria-label="Ver el calendario"]')]);
    await page.goto(`${BASE}/explorar/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.que-fila');
    await page.waitForTimeout(800);
    ok(!/vista=/.test(page.url()) && (await arriba(page)).calendario, `${t} y vuelve al calendario si se elige (${page.url().replace(BASE, '')})`);

    // ── El mapa de Planes ──
    await ve(page, `${BASE}/explorar/?vista=mapa`);
    a = await arriba(page);
    ok(JSON.stringify(a.botones) === JSON.stringify(['Ver en lista', 'Ver el calendario']), `${t} en el mapa: la lista · «Ver el calendario» (${a.botones.join(' · ')})`);

    // ── Sitios ──
    await ve(page, `${BASE}/explorar/?que=sitios`);
    a = await arriba(page);
    ok(JSON.stringify(a.botones) === JSON.stringify(['Ver en el mapa']), `${t} Sitios: «Ver en el mapa» (${a.botones.join(' · ')})`);
    ok(!a.recuento, `${t} Sitios sin «N sitios»`);
    ok(a.ancho <= ancho, `${t} Sitios sin desplazamiento lateral (${a.ancho})`);
    await page.screenshot({ path: `${OUT}/explorar-app-${nombre}-${ancho}-sitios.png` });
    await ve(page, `${BASE}/explorar/?que=sitios&vista=mapa`);
    a = await arriba(page);
    ok(JSON.stringify(a.botones) === JSON.stringify(['Ver en lista']), `${t} el mapa de Sitios: «Ver en lista» (${a.botones.join(' · ')})`);

    // ── En inglés, los textos de la app (sin la vista recordada) ──
    await page.evaluate(() => localStorage.clear());
    await ve(page, `${BASE}/en/explore/`);
    a = await arriba(page);
    ok(JSON.stringify(a.botones) === JSON.stringify(['See as a list', 'See on the map']) && a.calendario, `${t} en inglés (${a.botones.join(' · ')})`);
    ok(JSON.stringify(a.que.map((x) => x[0])) === JSON.stringify(['Plans', 'Places']), `${t} «Plans | Places»`);

    ok(errores.length === 0, `${t} sin errores de JavaScript (${errores.join(' | ')})`);
    await ctx.close();
  }

  // ── Sin JavaScript (lo que lee Google y quien lo tiene apagado) ──
  if (nombre === 'chromium') {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false, locale: 'es-ES' });
    const page = await ctx.newPage();
    await ve(page, `${BASE}/precios/`, 'header.top');
    const href = await page.getAttribute('header.top [data-abre-hoja="buscar"]', 'href');
    ok(href === '/explorar/?buscar=1', `[sin JS] la lupa de la cabecera lleva a Explorar con «Buscar» abierta (${href})`);
    await ve(page, `${BASE}${href}`);
    const s = await page.evaluate(() => {
      const h = document.getElementById('buscar');
      const r = h?.querySelector('input[name=q]')?.getBoundingClientRect();
      return { abierta: h?.open, campo: Boolean(r && r.width > 0), x: h?.querySelector('.hoja-x')?.getAttribute('href'),
        robots: document.querySelector('meta[name=robots]')?.content || '' };
    });
    ok(s.abierta && s.campo, '[sin JS] la hoja «Buscar» sale abierta con el buscador');
    ok(s.x === '/explorar/', `[sin JS] su ✕ lleva a Explorar sin la hoja (${s.x})`);
    ok(/noindex/.test(s.robots), '[sin JS] ?buscar=1 no se indexa');
    await page.screenshot({ path: `${OUT}/explorar-app-sinjs-buscar.png` });
    await page.click('#buscar input[name=q]');
    await page.fill('#buscar input[name=q]', 'bar');
    await Promise.all([page.waitForURL(/q=bar/, { waitUntil: 'commit' }), page.press('#buscar input[name=q]', 'Enter')]);
    await page.waitForSelector('.que-fila');
    ok(!(await page.locator('.calendario').count()), '[sin JS] buscar lleva a los resultados en lista');
    ok(!(await page.locator('.exp-acciones [data-abre-hoja="buscar"]').count()), '[sin JS] sin lupa en la fila (la de la cabecera es la única)');

    // Lo que ve Google en /explorar/ y /en/explore/.
    for (const [ruta, otra, h1] of [['/explorar/', '/en/explore/', 'Explorar'], ['/en/explore/', '/explorar/', 'Explore']]) {
      await ve(page, `${BASE}${ruta}`);
      const g = await page.evaluate(() => ({
        title: document.title, h1: document.querySelector('h1')?.textContent.trim(),
        canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') || '',
        hreflang: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => `${l.hreflang} ${new URL(l.href).pathname}`),
        ld: [...document.querySelectorAll('script[type="application/ld+json"]')].some((s) => /ItemList/.test(s.textContent)),
        fichas: document.querySelectorAll('a[href*="/o/"]').length,
        calendario: Boolean(document.querySelector('.calendario')),
        lista: document.querySelector('a[href*="vista=lista"], a[href*="view=list"]')?.getAttribute('href') || '',
        masFormas: document.querySelectorAll('.mas-formas a').length,
        description: document.querySelector('meta[name=description]')?.content || '',
      }));
      const n = `[sin JS ${ruta}]`;
      ok(/Klendar/.test(g.title) && g.h1 === h1 && g.description.length > 40, `${n} título, <h1> y descripción (${g.title})`);
      ok(g.canonical.endsWith(ruta) && g.hreflang.some((x) => x.endsWith(otra)), `${n} canonical y hreflang (${g.hreflang.join(', ')})`);
      ok(g.ld, `${n} JSON-LD con la lista de lo de hoy`);
      ok(g.calendario && g.fichas >= 5, `${n} el calendario, con enlaces a fichas (${g.fichas})`);
      ok(Boolean(g.lista), `${n} la lista, a un enlace (${g.lista})`);
      ok(g.masFormas >= 10, `${n} «Más formas de explorar» (${g.masFormas} enlaces)`);
    }
    await ve(page, `${BASE}/explorar/?vista=lista`);
    const l = await page.evaluate(() => ({ fichas: document.querySelectorAll('a[href*="/o/"]').length, paginas: Boolean(document.querySelector('.pager a[rel=next]')) }));
    ok(l.fichas >= 10 && l.paginas, `[sin JS] la lista, con fichas y páginas (${l.fichas})`);
    await ctx.close();
  }
  await nav.close();
}

await web.cierra();
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
