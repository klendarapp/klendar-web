// Prueba de lo publicado el 2026-11-04 de la revisión del 5-11 (L1, L2, L5,
// L6, L7, L8 y F2, aprobados por Iván el 4-11), en la web local:
//
//  1. Portada (ES y EN): «En la provincia de Málaga, gratis hasta el 31 de
//     marzo de 2027» en lugar de «Las primeras semanas en cada ciudad,
//     gratis», y la pregunta de las ciudades: «Klendar funciona en toda
//     España; empezamos por Málaga» (L1).
//  2. /para-negocios y /precios (ES y EN): el bloque de Málaga, con el
//     recordatorio de 7 días y 1 día antes (F2).
//  3. /precios: «¿Ayuntamiento, asociación u ONG? Gratis para siempre» con su
//     enlace; /para-entidades: «Hoy no ven nada de pago» (L7).
//  4. Aviso legal (ES y EN): fecha del 4-11, «NIF» (no «NIF/CIF») y su línea
//     en el historial; /negocios: la línea del fuero (L2).
//  5. Cookies: Turnstile en la app, en una vista web que se prepara al abrir
//     la pantalla (L5) o, desde el 9-11 (app 5b95d243), justo antes: en la
//     última pantalla de la bienvenida y en Cuenta sin sesión, con su línea
//     del 9-11 y la fecha de ese día; términos: «si aún no los has usado»
//     (L6); privacidad:
//     «y si una validación se deshizo» (L8). Cada uno con su línea del 4-11.
//  6. Sin desplazamiento horizontal ni errores de JavaScript.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_rev1105_check.mjs
//
// Con BASE=https://klendar.app … --en-vivo mira lo publicado (Supabase, simulado igual).
import { playwright, SUPA, servidorSeguro } from './_supabase_simulado.mjs';
import { fechaLegal, IA } from './_fecha_ia.mjs';
import { NUNCA_PRECIO, PRECIOS_APAGADO, segunPrecios } from './_precios.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const MALAGA_ES = /En la provincia de Málaga: gratis hasta el 31 de marzo de 2027 \(te avisamos 7 días y 1 día antes\)\./;
const MALAGA_EN = /In the province of Málaga: free until 31 March 2027 \(we remind you 7 days and 1 day before\)\./;

// [ruta, fecha, lo que tiene que decir, lo que ya no, enlaces que tiene que haber]
const PAGINAS = [
  ['/', '', [
    // Con los precios apagados (PRECIOS, 11-11), sin «gratis hasta…».
    segunPrecios(/Sin comisiones por venta\. En la provincia de Málaga, gratis hasta el 31 de marzo de 2027\./,
      /Sin comisiones por venta y sin permanencia\./),
    /¿En qué ciudades está\?\s*Klendar funciona en toda España; empezamos por Málaga\./,
  ], [/primeras semanas/, /Empezamos ciudad a ciudad/], []],
  ['/en', '', [
    segunPrecios(/No sales commission\. In the province of Málaga, free until 31 March 2027\./,
      /No sales commission and no lock-in\./),
    /Which cities\?\s*Klendar works all over Spain; we're starting with Málaga\./,
  ], [/first weeks/, /starting city by city/], []],
  ['/para-negocios', '', segunPrecios([MALAGA_ES], []), segunPrecios([], NUNCA_PRECIO), []],
  ['/en/for-business', '', segunPrecios([MALAGA_EN], []), segunPrecios([], NUNCA_PRECIO), []],
  ...segunPrecios([
    ['/precios', '', [MALAGA_ES, /¿Ayuntamiento, asociación u ONG\? Gratis para siempre\./], [], ['main a[href="/para-entidades"]']],
    ['/en/pricing', '', [MALAGA_EN, /Council, association or NGO\? Free, for good\./], [], ['main a[href="/en/for-organisations"]']],
  ], [
    ['/precios', '', PRECIOS_APAGADO.es, NUNCA_PRECIO, []],
    ['/en/pricing', '', PRECIOS_APAGADO.en, NUNCA_PRECIO, []],
  ]),
  ['/para-entidades', '', [
    /Hoy no ven nada de pago para los negocios y, si algún día hubiera funciones nuevas de pago, serían opcionales\./,
  ], [/Tampoco ven nada/], []],
  ['/en/for-organisations', '', [
    /Today they don't see anything that's paid for businesses and, if paid features are ever added, they will be optional\./,
  ], [/Nor do they see anything/], []],
  ['/aviso-legal', 'Última actualización: 4 de noviembre de 2026 · Versión 2026-09-29', [
    /NIF: 79288717N/,
    /4 de noviembre de 2026: Se completan el NIF, el domicilio y el teléfono del titular\./,
  ], [/NIF\/CIF/], []],
  ['/en/legal-notice', 'Last updated: 4 November 2026 · Version 2026-09-29', [
    /Tax ID: 79288717N/,
    /4 November 2026: The owner's tax ID, address and phone number are filled in\./,
  ], [], []],
  ['/negocios', `Versión ${IA ? IA.iso : '2026-11-05'}`, [
    /Para negocios, las partes se someten a los juzgados de Málaga\./,
    /4 de noviembre de 2026: Se completa el fuero \(apartado 9\): los juzgados de Málaga\./,
  ], [], []],
  ['/en/business-terms', `Version ${IA ? IA.iso : '2026-11-05'}`, [
    /For businesses, the parties submit to the courts of Málaga\./,
    /4 November 2026: The jurisdiction is filled in \(section 9\): the courts of Málaga\./,
  ], [], []],
  ['/cookies', fechaLegal('/cookies', 'Última actualización: 9 de noviembre de 2026'), [
    /En la app, la misma comprobación se hace en una vista web de klendar\.app\/captcha que se prepara al abrir esas pantallas o justo antes, cuando vas a usarlas \(en la última pantalla de la bienvenida y en Cuenta si no has entrado\), y solo se ve si hay que marcar la casilla\./,
    /4 de noviembre de 2026: En la app, la comprobación anti-robots se hace en una vista web de klendar\.app\/captcha/,
    /9 de noviembre de 2026: En la app, la vista web de la comprobación anti-robots se prepara también justo antes de usarla: en la última pantalla de la bienvenida y en Cuenta si no has entrado\./,
  ], [/pequeña ventana/, /misma comprobación se hace en una vista web de klendar\.app\/captcha que se prepara al abrir esas pantallas y solo/], []],
  ['/en/cookies', fechaLegal('/en/cookies', 'Last updated: 9 November 2026'), [
    /In the app, the same check runs in a web view of klendar\.app\/captcha that is prepared when you open those screens or just before, when you are about to use them \(on the last welcome screen and in Account if you are not logged in\), and only shows if you need to tick the box\./,
    /4 November 2026: In the app, the anti-bot check runs in a web view of klendar\.app\/captcha/,
    /9 November 2026: In the app, the anti-bot check's web view is also prepared just before you use it: on the last welcome screen and in Account if you're not logged in\./,
  ], [/small window/, /same check runs in a web view of klendar\.app\/captcha that is prepared when you open those screens and only/], []],
  ['/terminos', fechaLegal('/terminos', 'Última actualización: 12 de noviembre de 2026'), [
    /y se quitan el sello o el cupón que te hubiera dado ese canje, si aún no los has usado\./,
    /4 de noviembre de 2026: Ofertas y canjes \(apartado 3\): al deshacer una validación, el sello o el cupón que te hubiera dado ese canje solo se quitan si aún no los has usado\./,
  ], [], []],
  ['/en/terms', fechaLegal('/en/terms', 'Last updated: 12 November 2026'), [
    /and any stamp or coupon that redemption gave you is removed, if you haven't used it yet\./,
    /4 November 2026: Deals and redemptions \(section 3\): when a validation is undone, any stamp or coupon that redemption gave you is only removed if you haven't used it yet\./,
  ], [], []],
  ['/privacidad', fechaLegal('/privacidad', 'Última actualización: 12 de noviembre de 2026'), [
    /tarjetas de sellos \(sellos, premios y sus códigos\) y si una validación se deshizo/,
    /4 de noviembre de 2026: La fila «Favoritos, reseñas, canjes y sellos» dice también que guardamos si una validación se deshizo\./,
  ], [], []],
  ['/en/privacy', fechaLegal('/en/privacy', 'Last updated: 12 November 2026'), [
    /stamp cards \(stamps, rewards and their codes\) and whether a validation was undone/,
    /4 November 2026: The “Favourites, reviews, redemptions and stamps” row now also says we keep whether a validation was undone\./,
  ], [], []],
];

async function paginas(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  // La portada pide las ciudades a Supabase: aquí, ninguna (los textos no dependen de ellas).
  await ctx.route(`${SUPA}/rest/v1/rpc/public_cities`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(`${p.url()}: ${e.message}`));
  for (const [ruta, fecha, esperas, nunca, enlaces] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const txt = `${await p.locator('body').innerText()}
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    if (fecha) ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    for (const re of nunca) ok(!re.test(txt), `${nombre}/${t} ${ruta}: ya no dice ${re.source}`);
    for (const sel of enlaces) ok(await p.locator(sel).count() > 0, `${nombre}/${t} ${ruta}: enlace ${sel}`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0),
      `${nombre}/${t} ${ruta}: sin desplazamiento horizontal`);
  }
  ok(errores.length === 0, `${nombre}/${t}: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 800 }]]) {
    await paginas(nav, nombre, t, vp);
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
