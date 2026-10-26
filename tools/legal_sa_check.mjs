// Prueba de lo publicado el 2026-10-27 (SA1 y SA2, aprobados por Iván ese
// día; los sorteos están apagados al lanzar, Apple 5.3), en la web local:
//
//  1. Condiciones para negocios (ES y EN), 3 sexies / 3e «Sorteos»: una
//     función que Klendar puede tener activada o no; «Mientras esté
//     activada, el Negocio puede organizar sorteos» (ya no «El Negocio puede
//     organizar sorteos en Klendar.» a secas), el aviso de arriba con «los del
//     27 de octubre de 2026 (…), desde el 11 de noviembre de 2026» y su línea
//     en el historial (SA1).
//  2. Términos de uso (ES y EN), 3 quinquies / 3d: «Cuando Klendar tiene
//     activada esta función (…), algunos negocios organizan sorteos» y su
//     línea en el historial (SA2).
//  3. Fecha nueva y sin desplazamiento horizontal.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800). Sin
// Supabase (páginas estáticas).
//
//   PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_sa_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8871';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/negocios/', 'Última actualización: 27 de octubre de 2026', [
    /Los sorteos son una función que Klendar puede tener activada o no, y no necesariamente en todas partes \(la web, la app de Android o la de iPhone\)\. Klendar decide si la activa y dónde, y puede desactivarla en cualquier momento sin que eso cambie el precio\. Mientras esté activada, el Negocio puede organizar sorteos en Klendar\. Si se desactiva con algún sorteo abierto, Klendar avisará al Negocio y a quienes participan de cómo se resuelve\. Al crear uno el Negocio es el organizador/,
    /los del 26 de octubre de 2026 \(apartado 4 bis\), desde el 10 de noviembre de 2026, y los del 27 de octubre de 2026 \(apartado[^)]*3 sexies[^)]*\), desde el 11 de noviembre de 2026: 15 días/,
    /27 de octubre de 2026: Sorteos \(apartado 3 sexies\): son una función que Klendar puede tener activada o no.*Se aplica desde el 11 de noviembre de 2026\./,
  ], [/(^|\. )El Negocio puede organizar sorteos en Klendar\./m]],
  ['/en/business-terms/', 'Last updated: 27 October 2026', [
    /Giveaways are a feature that Klendar may or may not have switched on, and not necessarily everywhere \(the website, the Android app or the iPhone app\)\. Klendar decides whether to switch it on and where, and can switch it off at any time without that changing the price\. While it is on, the Business can run giveaways on Klendar\. If it is switched off while a giveaway is open, Klendar will tell the Business and the people who entered how it will be settled\. When it creates one the Business is the organiser/,
    /those of 26 October 2026 \(section 4a\) from 10 November 2026, and those of 27 October 2026 \(sections? [^)]*3e[^)]*\) from 11 November 2026: 15 days/,
    /27 October 2026: Giveaways \(section 3e\): they are a feature that Klendar may or may not have switched on.*It applies from 11 November 2026\./,
  ], [/(^|\. )The Business can run giveaways on Klendar\./m]],
  ['/terminos/', 'Última actualización: 27 de octubre de 2026', [
    /Cuando Klendar tiene activada esta función \(no siempre ni en todas partes: la web, la app de Android o la de iPhone\), algunos negocios organizan sorteos en Klendar\. Participar es gratis y sin compra/,
    /27 de octubre de 2026: Sorteos de los negocios \(apartado 3 quinquies\): una función que puede estar activada o no/,
  ], [/(^|\. )Algunos negocios organizan sorteos en Klendar\./m]],
  ['/en/terms/', 'Last updated: 27 October 2026', [
    /When Klendar has this feature switched on \(not always, and not necessarily everywhere: the website, the Android app or the iPhone app\), some businesses run giveaways on Klendar\. Entering is free with no purchase/,
    /27 October 2026: Giveaways from businesses \(section 3d\): a feature that may or may not be switched on/,
  ], [/(^|\. )Some businesses run giveaways on Klendar\./m]],
];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas, nunca] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const txt = `${await p.locator('body').innerText()}
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    for (const re of nunca) ok(!re.test(txt), `${nombre}/${t} ${ruta}: sin ${re.source}`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0),
      `${nombre}/${t} ${ruta}: sin desplazamiento horizontal`);
  }
  ok(errores.length === 0, `${nombre}/${t}: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 800 }]]) {
    await legales(nav, nombre, t, vp);
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
