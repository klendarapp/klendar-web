// Prueba de lo publicado el 2026-10-28 (TR1–TR4, aprobados por Iván ese día;
// traducción a petición), en la web local:
//
//  1. Privacidad (ES y EN): la fila «Traducción automática» a petición
//     («Traducir» o «Traducir siempre automáticamente»), con «Qué pedir aquí»,
//     «Google Translate» y sin las preguntas (TR1), y el historial.
//  2. Términos (ES y EN), apartado 3: Google Translate y el descargo de
//     garantías de Google tal cual, sin limitar los derechos (TR2).
//  3. Soporte y preguntas frecuentes (ES y EN): «La traducción no es
//     correcta» con el enlace a Google Translate (TR3).
//  4. Cookies (ES y EN): `klendar.traducir` guarda «Traducir siempre
//     automáticamente» (TR4) y la fila `klendar.traducir.ok`.
//  5. Sin desplazamiento horizontal (el descargo es largo y en mayúsculas).
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_tp_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8871';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const DESCARGO = /THIS SERVICE MAY CONTAIN TRANSLATIONS POWERED BY GOOGLE\. GOOGLE DISCLAIMS ALL WARRANTIES RELATED TO THE TRANSLATIONS, EXPRESS OR IMPLIED, INCLUDING ANY WARRANTIES OF ACCURACY, RELIABILITY, AND ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT\./;

const PAGINAS = [
  ['/privacidad/', [
    /Traducción automática\s+Lo que pides traducir \(al tocar «Traducir» debajo de un texto de un negocio que está en otro idioma\), sin guardar quién lo pidió; y, si la enciendes, la preferencia «Traducir siempre automáticamente»/,
    /la descripción del negocio, «Qué pedir aquí» y su carta, con «Traducido automáticamente · Google Translate» y «Ver original»\. Nunca se traducen las reseñas, las preguntas ni los nombres\./,
    /Ejecución del contrato \(lo pides tú; «Traducir siempre automáticamente» empieza apagado\)\s+La preferencia, hasta que la cambies o elimines la cuenta\./,
    /28 de octubre de 2026: La traducción automática es a petición/,
  ], [/Traducir publicaciones a mi idioma/]],
  ['/en/privacy/', [
    /Automatic translation\s+What you ask to translate \(by tapping “Translate” under a business's text that is in another language\), without storing who asked/,
    /“What to order here” and its menu, with “Translated automatically · Google Translate” and “See original”\. Reviews, questions and names are never translated\./,
    /28 October 2026: Automatic translation is on request/,
  ], [/Translate publications into my language/]],
  ['/terminos/', [
    /Si pides ver traducidos los textos de los negocios \(con «Traducir» o con «Traducir siempre automáticamente»\), la traducción es automática, la hace Google Translate y puede tener errores/,
    DESCARGO,
    /\(En español: este servicio puede contener traducciones hechas por Google;[\s\S]*?y no infracción\.\) Esto no limita los derechos que te da la ley frente a Klendar\./,
    /28 de octubre de 2026: Traducción automática \(apartado 3\): la hace Google Translate, a petición/,
  ], []],
  ['/en/terms/', [
    /If you ask to see businesses' text translated \(with “Translate” or with “Always translate automatically”\), the translation is automatic, it's done by Google Translate/,
    DESCARGO,
    /This doesn't limit your statutory rights against Klendar\./,
  ], []],
  ['/soporte/', [/Las traducciones las hace Google Translate, solo cuando tocas «Traducir» o si tienes encendido «Traducir siempre automáticamente» \(Ajustes\)\./], []],
  ['/en/support/', [/Translations are done by Google Translate, only when you tap “Translate” or if you have “Always translate automatically” on \(Settings\)\./], []],
  ['/preguntas/', [/Las traducciones las hace Google Translate/], []],
  ['/en/faq/', [/Translations are done by Google Translate/], []],
  ['/cookies/', [
    /klendar\.traducir\s+«Tu cuenta» y las fichas \(almacenamiento local\)\s+Recordar si has encendido «Traducir siempre automáticamente» cuando no has entrado/,
    /klendar\.traducir\.ok\s+Las fichas \(almacenamiento de sesión\)\s+Si la traducción automática está disponible ahora/,
  ], []],
  ['/en/cookies/', [
    /klendar\.traducir\s+“Your account” and publication pages \(local storage\)\s+Remember whether you've turned on “Always translate automatically”/,
    /klendar\.traducir\.ok\s+Publication and business pages \(session storage\)/,
  ], []],
];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, esperas, nunca] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const txt = `${await p.locator('body').innerText()}
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    for (const re of nunca) ok(!re.test(txt), `${nombre}/${t} ${ruta}: sin ${re.source}`);
    if (/preguntas|faq|soporte|support/.test(ruta)) {
      ok(await p.locator('a[href="https://cloud.google.com/translate"]').count() > 0, `${nombre}/${t} ${ruta}: enlace a Google Translate`);
    }
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
