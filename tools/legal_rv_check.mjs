// Prueba de lo publicado el 2026-11-03 (RV1–RV3, revisión del 3-11, aprobado
// por Iván ese día), en la web local:
//
//  1. Cookies (ES y EN): las claves de sesión `klendar.sorteosWeb` y
//     `klendar.tab`, con la línea del historial.
//  2. Privacidad (ES y EN): «Cuenta de negocio» cuenta quién puso «Poner
//     siempre» y la provincia del local; «Amigos y planes» dice «Ajustes →
//     Privacidad y datos» (ya no «Ajustes → Privacidad;»).
//  3. Sin desplazamiento horizontal ni errores de JavaScript.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_rv_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/cookies/', 'Última actualización: 9 de noviembre de 2026', [
    /klendar\.sorteosWeb\s+Todo klendar\.app \(almacenamiento de sesión\)\s+Recordar si los sorteos están encendidos/,
    /klendar\.tab\s+Todo klendar\.app \(almacenamiento de sesión\)\s+Que la barra de abajo deje marcada la pestaña de la que vienes/,
    /3 de noviembre de 2026: Dos claves de sesión más/,
  ], []],
  ['/en/cookies/', 'Last updated: 9 November 2026', [
    /klendar\.sorteosWeb\s+All of klendar\.app \(session storage\)\s+Remember whether giveaways are on/,
    /klendar\.tab\s+All of klendar\.app \(session storage\)\s+Keep the bottom bar on the tab you came from/,
    /3 November 2026: Two more session keys/,
  ], []],
  ['/privacidad/', 'Última actualización: 11 de noviembre de 2026', [
    /las que oculta, con el motivo; y, en «Dónde verlo», quién del equipo puso «Poner siempre» un equipo, un deportista o una competición; si es una entidad y conecta su agenda, [\s\S]*?Se borra al desconectarla o al eliminar el negocio\. Para el «Gratis de lanzamiento», la provincia del local, que se calcula por su punto en el mapa/,
    /habéis ido juntos se apaga en Ajustes → Privacidad y datos; las invitaciones/,
    /3 de noviembre de 2026: La fila «Cuenta de negocio» cuenta también/,
  ], [
    /se apaga en Ajustes → Privacidad;/,
  ]],
  ['/en/privacy/', 'Last updated: 11 November 2026', [
    /the ones it hides, with the reason; and, in “Where to watch”, which team member set “Always show” for a team, an athlete or a competition; if it is an organisation and connects its calendar, [\s\S]*?It is deleted when the calendar is disconnected or the business is deleted\. For the launch free period, the province of the venue, worked out from its point on the map/,
    /can be turned off in Settings → Privacy and data; invitations/,
    /3 November 2026: The “Business account” row also covers/,
  ], [
    /turned off in Settings → Privacy;/,
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
