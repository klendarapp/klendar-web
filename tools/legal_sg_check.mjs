// Prueba de lo publicado el 2026-11-03 (SG, aprobado por Iván ese día:
// «Sigues», se sigue a equipos y a deportistas), en la web local:
//
//  1. Privacidad (ES y EN): la fila «Equipos y deportistas que sigues», su
//     interruptor con el nombre nuevo, «Notificaciones push» con «los equipos
//     y deportistas que sigues» y la línea del historial; el nombre viejo ya
//     no sale fuera del historial antiguo.
//  2. Sin desplazamiento horizontal ni errores de JavaScript.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_sg_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8871';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/privacidad/', 'Última actualización: 3 de noviembre de 2026', [
    /Equipos y deportistas que sigues\s+Los equipos o participantes que sigues/,
    /se apagan en Ajustes → Notificaciones → «Equipos y deportistas que sigues»/,
    /series que sigues, partidos de los equipos y deportistas que sigues, artistas que sigues/,
    /fechas nuevas de las series que sigues, los partidos de los equipos y deportistas que sigues \(con los bares/,
    /la misma zona que la de «Equipos y deportistas que sigues»/,
    /3 de noviembre de 2026: «Equipos que sigues» pasa a llamarse «Equipos y deportistas que sigues»/,
  ], [
    /«Partidos de tus equipos»/,
    /series que sigues, partidos de tus equipos/,
    /los partidos de tus equipos \(con los bares/,
    /Equipos que sigues\s+Los equipos o participantes/,
    /la misma zona que la de «Equipos que sigues»/,
  ]],
  ['/en/privacy/', 'Last updated: 3 November 2026', [
    /Teams and athletes you follow\s+The teams or competitors you follow/,
    /turn them off in Settings → Notifications → “Teams and athletes you follow”/,
    /series you follow, matches of the teams and athletes you follow, artists you follow/,
    /new dates of the series you follow, matches of the teams and athletes you follow \(with the bars/,
    /the same area as for “Teams and athletes you follow”/,
    /3 November 2026: “Teams you follow” is now called “Teams and athletes you follow”/,
  ], [
    /“Your teams' matches”/,
    /series you follow, your teams' matches/,
    /your teams' matches \(with the bars/,
    /Teams you follow\s+The teams or competitors/,
    /the same area as for “Teams you follow”/,
  ]],
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
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    if (fecha) ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    for (const re of nunca) ok(!re.test(txt), `${nombre}/${t} ${ruta}: ya no dice ${re.source}`);
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
