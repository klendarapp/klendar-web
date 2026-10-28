// Prueba de lo publicado el 2026-10-27 (MY1–MY4, aprobados por Iván ese
// día; contenido +18 sin cuenta), en la web local:
//
//  1. Cookies (ES y EN): «una sola cookie», la fila `klendar_18` (1 año) y
//     la frase de la app (MY1).
//  2. Privacidad (ES y EN): el apartado de la edad (MY2) y la fila nueva
//     «Si eres mayor de edad (sin cuenta)» (MY3).
//  3. Términos (ES y EN), apartado 2: la autodeclaración (MY4).
//  4. Fecha, historial y sin desplazamiento horizontal.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_my_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8871';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/cookies/', 'Última actualización: 28 de octubre de 2026', [
    /En resumen\. klendar\.app usa una sola cookie, y solo si contestas a «¿Tienes 18 años o más\?»: guarda tu respuesta para no volver a preguntarte\./,
    /klendar_18 \(cookie\)\s+Todo klendar\.app\s+Tu respuesta a «¿Tienes 18 años o más\?» \(«1» sí, «0» no\)[\s\S]*?según tu fecha de nacimiento\s+1 año, o hasta que cierres sesión\s+Preferencia elegida por ti/,
    /Tu respuesta a «¿Tienes 18 años o más\?» se guarda en el móvil, no en una cookie\./,
    /27 de octubre de 2026: La cookie klendar_18/,
  ], [/klendar\.app no usa cookies/]],
  ['/en/cookies/', 'Last updated: 28 October 2026', [
    /In short\. klendar\.app uses a single cookie, and only if you answer “Are you 18 or over\?”: it stores your answer so we don't ask again\./,
    /klendar_18 \(cookie\)\s+All of klendar\.app\s+Your answer to “Are you 18 or over\?” \(“1” yes, “0” no\)[\s\S]*?from your date of birth\s+1 year, or until you log out\s+Preference you chose/,
    /Your answer to “Are you 18 or over\?” is stored on your phone, not in a cookie\./,
    /27 October 2026: The klendar_18 cookie/,
  ], [/klendar\.app does not use cookies/]],
  ['/privacidad/', 'Última actualización: 29 de octubre de 2026', [
    /sin cuenta, si respondes «Tengo 18 años o más» a la pregunta que te hacemos una vez\. Esa respuesta se guarda solo en tu móvil o en tu navegador;[\s\S]*?aunque en ese dispositivo se respondiera otra cosa\./,
    /Si eres mayor de edad \(sin cuenta\)\s+Tu respuesta a «¿Tienes 18 años o más\?» \(sí o no\)[\s\S]*?\(en la web, un año\); no la guardamos/,
    /27 de octubre de 2026: Contenido \+18 sin cuenta/,
  ], [/solo se muestran a personas que han indicado con su fecha de nacimiento/]],
  ['/en/privacy/', 'Last updated: 29 October 2026', [
    /without an account, if you answer “I'm 18 or over” to the question we ask once\. That answer is stored only on your phone or in your browser;[\s\S]*?even if a different answer was given on that device\./,
    /If you're an adult \(without an account\)\s+Your answer to “Are you 18 or over\?” \(yes or no\)[\s\S]*?\(on the web, one year\); we don't store it/,
    /27 October 2026: 18\+ content without an account/,
  ], [/is only shown to people who have stated through their date of birth/]],
  ['/terminos/', 'Última actualización: 28 de octubre de 2026', [
    /Los contenidos "\+18" solo se muestran a mayores de 18: con cuenta, según tu fecha de nacimiento; sin cuenta, si declaras que tienes 18 años o más\. Si lo declaras sin tenerlos, eres tú quien falta a estos términos\./,
    /27 de octubre de 2026: Contenido \+18 sin cuenta \(apartado 2\)/,
  ], []],
  ['/en/terms/', 'Last updated: 28 October 2026', [
    /"18\+" content is only shown to people over 18: with an account, based on your date of birth; without an account, if you state that you are 18 or over\. If you state it without being so, you are the one breaching these terms\./,
    /27 October 2026: 18\+ content without an account \(section 2\)/,
  ], []],
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
