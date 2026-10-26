// Prueba de lo publicado el 2026-10-26 (RD1 y RD2, aprobados por Iván ese
// día), en la web local:
//
//  1. Privacidad (ES y EN), fila «Notificaciones push»: el aviso al negocio
//     de un código escaneado sin conexión que no valía, detrás del de las
//     preguntas, y su línea en el historial (RD1).
//  2. Condiciones para negocios (ES y EN), 4 bis / 4a «Cuándo se bloquea»:
//     «con el motivo; cómo pagar se lo indicamos por correo y en «Mi negocio»
//     en klendar.app» (ya no «con el motivo y cómo pagar»), el aviso de
//     arriba con «los del 26 de octubre de 2026 (apartado 4 bis), desde el
//     10 de noviembre de 2026» y su línea en el historial (RD2).
//  3. Fecha nueva y sin desplazamiento horizontal.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800). Sin
// Supabase (páginas estáticas).
//
//   PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_rd_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8871';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/privacidad/', 'Última actualización: 27 de octubre de 2026', [
    /si tienes un negocio, que hay una pregunta nueva en tu ficha \(como mucho una por hora\); si tienes un negocio, que un código que tu equipo escaneó sin conexión no era válido al comprobarlo \(para que puedas revisar si se dio algo\);/,
    /26 de octubre de 2026: En las notificaciones, si tienes un negocio, que un código que tu equipo escaneó sin conexión no era válido al comprobarlo\./,
  ], []],
  ['/en/privacy/', 'Last updated: 27 October 2026', [
    /if you have a business, that there's a new question on your page \(at most one an hour\); if you have a business, that a code your team scanned offline turned out not to be valid when it was checked \(so you can review whether anything was given\);/,
    /26 October 2026: In notifications, if you have a business, that a code your team scanned offline turned out not to be valid when it was checked\./,
  ], []],
  ['/negocios/', 'Última actualización: 27 de octubre de 2026', [
    /el día que se bloquea, con el motivo; cómo pagar se lo indicamos por correo y en «Mi negocio» en klendar\.app\./,
    /los del 20 de octubre de 2026 \(apartados 2 bis, 3 y 3 undecies\), desde el 4 de noviembre de 2026, los del 26 de octubre de 2026 \(apartado 4 bis\), desde el 10 de noviembre de 2026/,
    /26 de octubre de 2026: Pagos pendientes y bloqueo \(apartado 4 bis\).*Se aplica desde el 10 de noviembre de 2026\./,
  ], [/con el motivo y cómo pagar/]],
  ['/en/business-terms/', 'Last updated: 27 October 2026', [
    /on the day it's blocked, with the reason; we tell it how to pay by email and in “My business” at klendar\.app\./,
    /those of 20 October 2026 \(sections 2a, 3 and 3j\) from 4 November 2026, those of 26 October 2026 \(section 4a\) from 10 November 2026/,
    /26 October 2026: Outstanding payments and blocking \(section 4a\).*It applies from 10 November 2026\./,
  ], [/with the reason and how to pay/]],
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
