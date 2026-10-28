// Prueba de lo publicado el 2026-10-28 (aprobado por Iván ese día): RF24
// (traducción automática con Google Cloud Translation, con T2, S1 y N1/N4),
// RF18b (Mapbox en encargados) y UA1–UA4 (ubicación aproximada por la
// conexión en klendar.app), en la web local:
//
//  (Al día con TR1–TR4, del mismo día: ver tools/legal_tp_check.mjs.)
//  1. Privacidad (ES y EN): la fila «Traducción automática» con Google, el
//     encargado Google Cloud Translation, Mapbox con los nombres de lugares y
//     la librería, la fila nueva «Ubicación aproximada por la conexión»
//     detrás de «Ubicación», Cloudflare con la zona aproximada y el
//     historial.
//  2. Cookies (ES y EN): la zona aproximada no se guarda (UA3).
//  3. Términos (ES y EN), apartado 3: la traducción puede tener errores (T2).
//  4. Condiciones para negocios (ES y EN): apartados 2 y 7 (N1/N4), el aviso
//     de arriba (apartados 2, 4 bis y 7, desde el 12-11) y el historial.
//  5. Soporte y preguntas frecuentes (ES y EN): «La traducción no es
//     correcta» (S1).
//  6. Fecha y sin desplazamiento horizontal.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_tr_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8871';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/privacidad/', 'Última actualización: 29 de octubre de 2026', [
    /Traducción automática\s+Lo que pides traducir[\s\S]*?Lo traduce nuestro servidor con Google Cloud Translation, que solo recibe los textos de los negocios \(sin tus datos ni tu cuenta\)[\s\S]*?las de un negocio que se elimina, en ese momento/,
    /Google Cloud Translation \(Google Cloud EMEA Ltd\., Irlanda: traducción automática de los textos que publican los negocios, solo si alguien la ha pedido; no recibe datos de las personas usuarias;/,
    /Mapbox \(Mapbox, Inc\., EE\. UU\.: mapas, rutas a pie y nombres de lugares;[\s\S]*?en la web, tu navegador le pide también la librería que dibuja los mapas; nunca tu nombre ni tu correo;/,
    /En la web, tu navegador la borra a las 6 horas\s+Ubicación aproximada por la conexión \(solo klendar\.app\)\s+La ciudad y un punto aproximado que Cloudflare deduce de la dirección IP[\s\S]*?Interés legítimo \(art\. 6\.1\.f RGPD\)[\s\S]*?No se guarda: se usa en el momento de pedir la página y se descarta/,
    /al denunciar sin cuenta; y, sin guardarla, la ciudad y la zona aproximadas de tu conexión cuando no nos has dado tu ubicación/,
    /28 de octubre de 2026: Traducción automática: qué se traduce, que lo hace Google Cloud Translation/,
  ], [/cuando el servicio esté disponible/]],
  ['/en/privacy/', 'Last updated: 29 October 2026', [
    /Automatic translation\s+What you ask to translate[\s\S]*?Our server translates them with Google Cloud Translation, which only receives the businesses' text \(not your data or your account\)/,
    /Google Cloud Translation \(Google Cloud EMEA Ltd\., Ireland: automatic translation of the text businesses publish/,
    /Mapbox \(Mapbox, Inc\., USA: maps, walking directions and place names;[\s\S]*?the library that draws the maps; never your name or email;/,
    /On the website, your browser deletes it after 6 hours\s+Approximate location from your connection \(klendar\.app only\)[\s\S]*?Legitimate interest \(Art\. 6\(1\)\(f\) GDPR\)[\s\S]*?Not stored: used when the page is requested and discarded/,
    /without storing it, the approximate city and area of your connection when you haven't shared your location/,
    /28 October 2026: Automatic translation: what is translated/,
  ], [/when the service is available/]],
  ['/cookies/', 'Última actualización: 28 de octubre de 2026', [
    /La zona aproximada de tu conexión \(si no nos das tu ubicación\) no se guarda en tu navegador ni en ningún sitio: se usa solo para hacer la página que pides\./,
    /28 de octubre de 2026: La zona aproximada de tu conexión/,
  ], []],
  ['/en/cookies/', 'Last updated: 28 October 2026', [
    /The approximate area of your connection \(if you don't share your location\) isn't stored in your browser or anywhere else: it's only used to build the page you request\./,
  ], []],
  ['/terminos/', 'Última actualización: 28 de octubre de 2026', [
    /la traducción es automática, la hace Google Translate y puede tener errores: lo que vale es el texto original del negocio, que siempre puedes ver con «Ver original»\./,
    /28 de octubre de 2026: Traducción automática \(apartado 3\)/,
  ], []],
  ['/en/terms/', 'Last updated: 28 October 2026', [
    /the translation is automatic, it's done by Google Translate and it may contain mistakes: what counts is the business's original text/,
  ], []],
  ['/negocios/', 'Última actualización: 28 de octubre de 2026', [
    /\(enlace e imagen para historias\) y, si lo piden, ver sus textos traducidos automáticamente\./,
    /licencia para mostrarlos en la Plataforma, traducirlos automáticamente para quien lo pida,/,
    /y los del 28 de octubre de 2026 \(apartados 2, 4 bis y 7\), desde el 12 de noviembre de 2026: 15 días/,
    /28 de octubre de 2026: Traducción automática \(apartados 2 y 7\)[\s\S]*?Se aplica desde el 12 de noviembre de 2026\./,
  ], []],
  ['/en/business-terms/', 'Last updated: 28 October 2026', [
    /\(a link and a stories image\) and, if they ask, see its text translated automatically\./,
    /a licence to display it on the Platform, translate it automatically for those who ask,/,
    /and those of 28 October 2026 \(sections 2, 4a and 7\) from 12 November 2026: 15 days/,
  ], []],
  ['/soporte/', 'Última actualización: 28 de octubre de 2026', [
    /La traducción no es correcta\s+Pulsa «Ver original»: lo que vale es lo que escribió el negocio\./,
    /28 de octubre de 2026: Una pregunta nueva: qué hacer si la traducción automática no es correcta\./,
  ], []],
  ['/en/support/', '', [/The translation is wrong\s+Tap “See original”: what counts is what the business wrote\./], []],
  ['/preguntas/', '', [/La traducción no es correcta/], []],
  ['/en/faq/', '', [/The translation is wrong/], []],
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
