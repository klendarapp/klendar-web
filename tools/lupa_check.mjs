// Descubre como la app (Iván, 2026-10-29), en la web local contra dev y solo
// leyendo: la cabecera de Descubre con ✨ Selecciones (si hay), la lupa y la
// campana (con sesión); la hoja «Buscar» (el buscador de Explorar con los
// atajos, que llevan a Descubre, lo buscado, lo más buscado y «O mira por
// tipo de sitio») y lo que se arregló al compararlas: la pestaña activa sin
// cuadrado, la fila de Descubre en el escritorio del ancho de la tarjeta y
// sus flechas, los iconos de la fila solo fuera si no caben, Explorar vacío
// sin «0 resultados» y sus atajos a Descubre. Chromium y WebKit, móvil (360 y
// 390) y escritorio, claro y oscuro, y con «Reducir movimiento».
//
// La campana se prueba con una sesión de mentira en el navegador y la
// cuenta de avisos simulada (no entra en ninguna cuenta ni escribe nada).
//
//   SUPABASE_BLOQUEADO=1 PORT=8857 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> OUT=<carpeta> BASE=http://localhost:8857 node tools/lupa_check.mjs
import { mkdirSync } from 'node:fs';
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();
const BASE = process.env.BASE || 'http://localhost:8857';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
// Las capturas, en tools/out/ (git las ignora): en la raíz se publicaban
// en klendar.app (revisión del 3-11-2026, 5.4).
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };
const POS = 'lat=40.417&lng=-3.704';

/** Va a la página (dev a veces da 500: se repite). */
async function ve(page, url, sel = '#barra') {
  for (let i = 0; i < 4; i++) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (await page.locator(sel).count()) break;
    await page.waitForTimeout(3000);
  }
  await page.waitForSelector(sel);
  await page.waitForTimeout(500);
}

const SESION = JSON.stringify({
  access_token: 'prueba', refresh_token: 'prueba', expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: '00000000-0000-0000-0000-000000000000', email: 'prueba@example.com', user_metadata: { display_name: 'Prueba' } },
});

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [ancho, alto] of [[360, 780], [390, 844], [1280, 800]]) {
    for (const tema of ['light', 'dark']) {
      if (ancho === 360 && tema === 'dark') continue;
      const movil = ancho < 700;
      const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, locale: 'es-ES', colorScheme: tema,
        isMobile: movil && nombre === 'chromium', hasTouch: movil });
      let page = await ctx.newPage();
      const errores = [];
      page.on('pageerror', (e) => errores.push(e.message));
      const t = `[${nombre} ${ancho} ${tema}]`;

      // ── Descubre: la cabecera ──
      await ve(page, `${BASE}/descubre/?${POS}`);
      const cab = await page.evaluate(() => {
        const lupa = document.querySelector('header.top [data-abre-hoja="buscar"]');
        const camp = document.querySelector('header.top [data-campana]');
        const sel = document.querySelector('header.top [data-abre-hoja="selecciones"]');
        const a = document.querySelector('.top-acciones').getBoundingClientRect();
        const b = document.querySelector('header.top .brand').getBoundingClientRect();
        const tab = document.querySelector('.tabbar [aria-current="page"] svg');
        return {
          lupa: lupa && { label: lupa.getAttribute('aria-label'), visible: lupa.offsetParent !== null },
          campanaOculta: camp ? camp.hidden : null,
          sel: sel ? Boolean(document.getElementById('selecciones')) : null,
          solapa: b.right > a.left, ancho: document.documentElement.scrollWidth,
          tabFondo: tab ? getComputedStyle(tab).backgroundColor : 'rgba(0, 0, 0, 0)',
          cortados: [...document.querySelectorAll('#barra .barra-preg .chip-t')].filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.innerText),
        };
      });
      ok(cab.lupa && cab.lupa.visible && cab.lupa.label === 'Buscar', `${t} la lupa en la cabecera de Descubre`);
      ok(cab.campanaOculta === true, `${t} sin sesión, sin campana`);
      ok(cab.sel !== false, `${t} ✨ abre su hoja (si hay selecciones: ${cab.sel})`);
      ok(!cab.solapa, `${t} el logo no se pisa con los botones`);
      ok(cab.ancho <= ancho, `${t} sin desplazamiento lateral (${cab.ancho})`);
      ok(cab.cortados.length === 0, `${t} la fila sin nada cortado (${cab.cortados.join(', ')})`);
      if (movil) ok(cab.tabFondo === 'rgba(0, 0, 0, 0)', `${t} la pestaña activa sin cuadrado (${cab.tabFondo})`);
      if (ancho === 390) {
        const iconos = await page.evaluate(() => [...document.querySelectorAll('#barra .barra-preg summary.chip > .ic:first-child')].filter((i) => getComputedStyle(i).display !== 'none').length);
        ok(iconos === 3, `${t} en 390, como la app, las tres preguntas con su icono (${iconos})`);
      }
      if (ancho === 1280) {
        const m = await page.evaluate(() => {
          const r = (s) => document.querySelector(s)?.getBoundingClientRect();
          const tarjeta = r('#feed > .tj'); const nav = r('.feed-nav'); const fila = r('#barra');
          const filtros = r('#barra > .hoja > summary');
          return tarjeta && nav ? { izq: fila.left - tarjeta.left, der: filtros.right - nav.right } : null;
        });
        ok(m && Math.abs(m.izq) <= 2 && Math.abs(m.der) <= 2, `${t} escritorio: la fila del ancho de la tarjeta y sus flechas, ☰ encima de ellas (${JSON.stringify(m)})`);
      }
      await page.screenshot({ path: `${OUT}/lupa-${nombre}-${ancho}-${tema}-descubre.png` });

      // ── La hoja «Buscar» ──
      await page.click('header.top [data-abre-hoja="buscar"]');
      await page.waitForTimeout(700);
      const hoja = await page.evaluate(() => {
        const h = document.getElementById('buscar');
        const atajos = [...h.querySelectorAll('.busq-sec .atajo')].filter((a) => !a.hidden);
        const tipos = h.querySelector('[data-busq-tipos]');
        return {
          abierta: h.open, foco: document.activeElement?.name,
          atajos: atajos.map((a) => [a.textContent.trim(), a.getAttribute('href') || a.getAttribute('data-cerca-a')]),
          accesos: [...h.querySelectorAll('.busq-atajo b')].map((b) => b.textContent),
          tipos: tipos && !tipos.hidden && tipos.closest('.busq-panel') ? [...tipos.querySelectorAll('.busq-grupo')].map((g) => [g.querySelector('h4').textContent,
            g.querySelectorAll('a.busq-cat:not([hidden])').length, Boolean(g.querySelector('[data-mas-grupo]:not([hidden])'))]) : null,
          nota: h.querySelector('.busq-sec .hoja-nota')?.textContent,
          anchoHoja: h.querySelector('.hoja-cuerpo').getBoundingClientRect().width,
          anim: getComputedStyle(h.querySelector('.hoja-cuerpo')).animationName,
        };
      });
      ok(hoja.abierta && hoja.foco === 'q', `${t} la lupa abre «Buscar» con el campo listo`);
      ok(hoja.atajos.length === 6, `${t} los seis atajos (${hoja.atajos.map((a) => a[0]).join(' · ')})`);
      ok(hoja.atajos.every(([n, h]) => (n === 'Para comer ya' ? /^\/explorar\/\?.*que=sitios/.test(h) : /^\/descubre\//.test(h))),
        `${t} los atajos llevan a Descubre (y «Para comer ya», a Sitios)`);
      ok(/Cada atajo pone sus filtros/.test(hoja.nota || ''), `${t} la nota de los atajos, como la app`);
      ok(hoja.accesos.includes('Dónde verlo') && hoja.accesos.includes('Pedir un local'), `${t} los accesos del buscador (${hoja.accesos.join(' · ')})`);
      ok(hoja.tipos && hoja.tipos.length >= 3 && hoja.tipos[0][1] > 0 && hoja.tipos[1][1] > 0 && hoja.tipos[2][1] === 0 && hoja.tipos[2][2],
        `${t} «O mira por tipo de sitio»: dos grupos abiertos y los demás con «N más» (${JSON.stringify(hoja.tipos)})`);
      if (!movil) ok(hoja.anchoHoja <= 562, `${t} escritorio: la hoja centrada de 560 (${Math.round(hoja.anchoHoja)})`);
      await page.screenshot({ path: `${OUT}/lupa-${nombre}-${ancho}-${tema}-buscar.png` });
      // «N más» abre el grupo y el foco va a su primera categoría.
      await page.click('#buscar [data-mas-grupo] >> nth=0');
      const abierto = await page.evaluate(() => {
        const g = document.querySelectorAll('#buscar .busq-grupo')[2];
        return { n: g.querySelectorAll('a.busq-cat:not([hidden])').length, foco: document.activeElement?.closest('.busq-grupo') === g, panel: !document.querySelector('#buscar .busq-panel').hidden };
      });
      ok(abierto.n > 0 && abierto.foco && abierto.panel, `${t} «N más» abre su grupo sin cerrar nada`);
      // Una categoría busca por su nombre en Explorar, con la misma zona.
      const cat = await page.evaluate(() => document.querySelector('#buscar a.busq-cat').getAttribute('href'));
      ok(/^\/explorar\/\?.*q=/.test(cat) && /lat=/.test(cat), `${t} tocar una categoría busca por su nombre (${cat})`);
      // Escape la cierra y el foco vuelve a la lupa.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      const tras = await page.evaluate(() => ({ abierta: document.getElementById('buscar').open, foco: document.activeElement?.getAttribute('data-abre-hoja') }));
      ok(!tras.abierta && tras.foco === 'buscar', `${t} Escape la cierra y el foco vuelve a la lupa`);
      // Buscar lleva a los resultados de Explorar con la zona de Descubre.
      await page.click('header.top [data-abre-hoja="buscar"]');
      await page.waitForTimeout(400);
      await page.fill('#buscar input[name=q]', 'bar');
      // (Solo esperamos la dirección: el «load» de una página de resultados
      // con fotos y vídeos no hace falta, y WebKit sin pantalla se cae a veces
      // cargándolos todos a la vez.)
      await Promise.all([page.waitForURL(/\/explorar\/\?/, { waitUntil: 'commit' }), page.press('#buscar input[name=q]', 'Enter')]);
      const u = new URL(page.url());
      ok(u.searchParams.get('q') === 'bar' && u.searchParams.get('lat'), `${t} «Buscar» lleva a Explorar con la palabra y la misma zona (${u.search})`);
      ok(errores.length === 0, `${t} sin errores de JavaScript (${errores.join(' | ')})`);

      // ── Explorar: atajos a Descubre, el panel con los tipos y vacío sin «0» ──
      // (En una pestaña nueva: WebKit sin pantalla, con poca memoria, se caía
      // a veces tras Descubre con sus vídeos.)
      await page.close();
      page = await ctx.newPage();
      await ve(page, `${BASE}/explorar/?${POS}`);
      // Explorar como la app (Iván, 2026-11-03): la lupa (la de la cabecera,
      // la única desde el 4-11) abre la misma hoja «Buscar», con los atajos
      // (ya no hay buscador ni atajos en la página).
      await page.click('header.top [data-abre-hoja="buscar"]');
      await page.waitForTimeout(700);
      const ex = await page.evaluate(() => [...document.querySelectorAll('#buscar .busq-sec .atajo')].map((a) => [a.textContent.trim(), a.getAttribute('href') || a.getAttribute('data-cerca-a')]));
      ok(ex.length === 6 && ex.every(([n, h]) => (n === 'Para comer ya' ? /que=sitios/.test(h) : /^\/descubre\//.test(h))), `${t} Explorar: la lupa abre «Buscar» y sus atajos llevan a Descubre, como la app`);
      ok(!(await page.locator('.atajos-fila').count()), `${t} Explorar: sin fila de atajos en la página`);
      const panel = await page.evaluate(() => { const p = document.getElementById('busq-panel'); return p && !p.hidden && Boolean(p.querySelector('[data-busq-tipos]:not([hidden])')); });
      ok(panel, `${t} Explorar: el panel del buscador con «O mira por tipo de sitio»`);
      await ve(page, `${BASE}/explorar/?${POS}&km=1&cuando=esta-noche&categoria=peluquerias`);
      const vacio = await page.evaluate(() => ({ vacio: Boolean(document.querySelector('.vacio')), resumen: document.querySelector('.resumen-n')?.textContent || '' }));
      ok(!vacio.vacio || vacio.resumen === '', `${t} Explorar vacío, sin «0 resultados» encima (${vacio.vacio ? 'vacío' : 'con algo'}: «${vacio.resumen}»)`);
      await ctx.close();
    }
  }

  // ── La campana: con sesión (de mentira) y la cuenta simulada ──
  for (const reducido of [false, true]) {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', reducedMotion: reducido ? 'reduce' : 'no-preference', hasTouch: true });
    let n = 3;
    await ctx.route(/\/rest\/v1\/notifications\?/, (r) => r.fulfill({ status: 200, headers: { 'content-range': `*/${n}`, 'access-control-expose-headers': 'content-range' }, body: '' }));
    await ctx.addInitScript((s) => { try { localStorage.setItem('sb-prueba-auth-token', s); } catch { /* nada */ } }, SESION);
    const page = await ctx.newPage();
    const t = `[${nombre} campana${reducido ? ' reducido' : ''}]`;
    await ve(page, `${BASE}/descubre/?${POS}`);
    await page.waitForTimeout(1200);
    const c1 = await page.evaluate(() => { const b = document.querySelector('[data-campana]'); return { oculta: b.hidden, n: b.querySelector('.top-n').textContent, globo: !b.querySelector('.top-n').hidden, label: b.getAttribute('aria-label'), href: b.getAttribute('href') }; });
    ok(!c1.oculta && c1.globo && c1.n === '3', `${t} con sesión, la campana con 3`);
    ok(c1.label === 'Notificaciones, 3 sin leer', `${t} el lector: «${c1.label}»`);
    ok(/\/app\/#\/notificaciones$/.test(c1.href), `${t} lleva a las notificaciones de «Tu cuenta»`);
    n = 12;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(250);
    const c2 = await page.evaluate(() => { const b = document.querySelector('[data-campana]'); return { n: b.querySelector('.top-n').textContent, anim: getComputedStyle(b.querySelector('.ic')).animationName, dur: getComputedStyle(b.querySelector('.ic')).animationDuration }; });
    ok(c2.n === '9+', `${t} desde 10, «9+» (${c2.n})`);
    if (reducido) ok(c2.anim === 'none' || parseFloat(c2.dur) < 0.01, `${t} con «Reducir movimiento», quieta (${c2.anim} ${c2.dur})`);
    else ok(c2.anim === 'mov-campana', `${t} al llegar uno nuevo, se balancea (${c2.anim})`);
    const solapa = await page.evaluate(() => document.querySelector('header.top .brand').getBoundingClientRect().right > document.querySelector('.top-acciones').getBoundingClientRect().left);
    ok(!solapa, `${t} con ✨, lupa, campana y tu inicial, el logo no se pisa`);
    await page.screenshot({ path: `${OUT}/lupa-${nombre}-campana${reducido ? '-reducido' : ''}.png`, clip: { x: 0, y: 0, width: 390, height: 140 } });
    await ctx.close();
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
