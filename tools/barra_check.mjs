// La barra de desplazamiento que ocupa sitio (Windows, Linux) y lo fijo de
// Descubre (revisión del 9-11): `--sb` (/assets/tarjetas.js) mide la barra y
// la cabecera fija, la fila de filtros y las flechas la restan. Comprueba, en
// Chromium (barras clásicas en Windows) y WebKit, con y sin «Reducir
// movimiento», a 1280 y a 390 (ventana y móvil):
//  - la cabecera y ☰, en el mismo sitio en Descubre y en Explorar (no saltan
//    al cambiar de pestaña);
//  - en el escritorio, la fila de filtros empieza donde la tarjeta y las
//    flechas van 20 px a su derecha;
//  - en el móvil (barras que flotan), `--sb` es 0.
// Con sus propios datos (tools/_web_con_datos.mjs).
//
//   PW=<ruta a playwright> node tools/barra_check.mjs
import { playwright } from './_supabase_simulado.mjs';
import { webConDatos } from './_web_con_datos.mjs';
const { chromium, webkit } = playwright();
const web = await webConDatos({ puerto: Number(process.env.PORT || 8931) });
let fallos = 0;
for (const [n, t] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await t.launch();
  for (const rm of ['no-preference', 'reduce']) for (const [w, movil] of [[1280, false], [390, false], [390, true]]) {
    const ctx = await nav.newContext({ viewport: { width: w, height: 844 }, reducedMotion: rm, isMobile: movil && n === 'chromium', hasTouch: movil });
    await ctx.addCookies([{ name: 'klendar_18', value: '1', url: web.BASE }]);
    const p = await ctx.newPage();
    const mide = async (ruta) => { await p.goto(web.BASE + ruta, { waitUntil: 'networkidle' }); await p.waitForTimeout(400); return p.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left * 10) / 10, Math.round(b.right * 10) / 10]; };
      return { sb: getComputedStyle(document.documentElement).getPropertyValue('--sb'), cab: r('header.top'), menu: r('header.top .menu-toggle'), fila: r('.feed-cab .barra-filtros'), tj: r('.feed > .tj'), nav: r('.feed-nav') };
    }); };
    const d = await mide('/descubre/?ciudad=madrid');
    const e = await mide('/explorar/?ciudad=madrid&vista=lista');
    const ok = JSON.stringify(d.cab) === JSON.stringify(e.cab) && JSON.stringify(d.menu) === JSON.stringify(e.menu)
      && (w < 761 || (Math.abs(d.fila[0] - d.tj[0]) < 1 && d.nav[0] - d.tj[1] > 19 && d.nav[0] - d.tj[1] < 21));
    // Móvil de verdad: barras que flotan, nada que restar.
    if (movil && n === 'chromium' && d.sb !== '0px') { fallos++; console.log('MAL', n, rm, 'móvil: --sb', d.sb); }
    if (!ok) fallos++;
    console.log(ok ? 'ok ' : 'MAL', n, rm, w, movil ? 'móvil' : 'ventana', 'sb', d.sb, '/', e.sb, 'cab', d.cab, e.cab, 'menu', d.menu, e.menu, w > 760 ? `fila ${d.fila} tj ${d.tj} nav ${d.nav}` : '');
    await ctx.close();
  }
  await nav.close();
}
await web.cierra();
console.log(fallos ? `${fallos} MAL` : 'todo bien');
process.exit(fallos ? 1 : 0);
