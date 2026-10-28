// Prueba de lo publicado el 2026-10-27 (PF1 y PF3, aprobados por Iván ese
// día; el orden «Recomendado» de los filtros en tres preguntas), en la web
// local:
//
//  1. Condiciones para negocios (ES y EN), 2 bis / 2a «Cómo se ordena lo que
//     se ve»: «Recomendado» de serie con el tiempo y los gustos, «Más cerca»,
//     «Empieza antes» y «Lo más nuevo» solo por eso, la agenda «Por hora» o
//     «Más cerca», Sitios con «Más cerca» o «Mejor valorados» y la
//     valoración solo con «Mejor valorados»; el aviso de arriba con «los del
//     27 de octubre de 2026 (apartados 2 bis, …), desde el 11 de noviembre
//     de 2026» y su línea en el historial (PF1).
//  2. Preguntas frecuentes (ES y EN), «¿Por qué veo unas cosas y no otras?»
//     con el orden nuevo (PF3).
//  3. Sin desplazamiento horizontal.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800). Sin
// Supabase (páginas estáticas).
//
//   PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_pf_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8871';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/negocios/', 'Última actualización: 28 de octubre de 2026', [
    /\(1\) en Descubre y en la lista de Explorar, lo destacado de pago/,
    /\(2\) el orden que elige la persona en «Ordenar por»\. De serie es «Recomendado»: con «Según el tiempo» encendido/,
    /con «Tener en cuenta tus gustos» encendido \(lo está de serie\)[\s\S]*?cuenta como si fuera dos días más nuevo/,
    /la persona puede elegir «Más cerca», «Empieza antes» o «Lo más nuevo», que ordenan solo por eso, sin el tiempo ni los gustos\. La lista de un día de la agenda va «Por hora» \(de serie\) o «Más cerca»;/,
    /En Explorar › Sitios, que enseña negocios y no publicaciones, la persona elige entre «Más cerca» \(de serie[\s\S]*?y «Mejor valorados» \(por la valoración media de sus reseñas/,
    /«Abierto ahora», «Se puede comer ahora» y el momento del día/,
    /La valoración del Negocio solo cuenta en el orden de Sitios cuando la persona elige «Mejor valorados»; la cuota o el número de publicaciones no influyen en el orden\./,
    /los del 27 de octubre de 2026 \(apartados 2 bis, 3, 3 sexies, 3 septies y 3 duodecies\), desde el 11 de noviembre de 2026, y los del 28 de octubre de 2026 \(apartados 2, 4 bis y 7\), desde el 12 de noviembre de 2026: 15 días/,
    /27 de octubre de 2026: Cómo se ordena lo que se ve \(apartado 2 bis\)[\s\S]*?Se aplica desde el 11 de noviembre de 2026\./,
  ], [/La valoración del Negocio, la cuota o el número de publicaciones no influyen/, /con «Más pronto» como si empezara seis horas antes/]],
  ['/en/business-terms/', 'Last updated: 28 October 2026', [
    /\(1\) in Discover and in the Explore list, paid featured placements/,
    /\(2\) the order the person chooses in “Sort by”\. By default it is “Recommended”: with “Based on the weather” on/,
    /with “Take your interests into account” on \(it is by default\)[\s\S]*?count as if they were two days newer/,
    /the person can choose “Nearest”, “Starts soonest” or “Newest”, which order only by that, without the weather or interests\. The list for a day in the agenda is “By time” \(by default\) or “Nearest”;/,
    /In Explore › Places, which shows businesses rather than publications, the person chooses between “Nearest” \(by default[\s\S]*?and “Top rated” \(by the average rating of their reviews/,
    /“Open now”, “Food served now” and the time of day/,
    /The Business's rating only counts in the order of Places when the person chooses “Top rated”; its fee or its number of publications don't affect the order\./,
    /those of 27 October 2026 \(sections 2a, 3, 3e, 3f and 3k\) from 11 November 2026, and those of 28 October 2026 \(sections 2, 4a and 7\) from 12 November 2026: 15 days/,
    /27 October 2026: How what people see is ordered \(section 2a\)[\s\S]*?It applies from 11 November 2026\./,
  ], [/The Business's rating, its fee or its number of publications don't affect the order/, /with “Soonest” as if they started six hours earlier/]],
  ['/privacidad/', 'Última actualización: 29 de octubre de 2026', [
    /sin esconder nada \(solo con el orden «Recomendado», el de serie, en el que cuentan como si fueran dos días más nuevas; con «Más cerca», «Empieza antes» o «Lo más nuevo» no cuentan, y puedes apagarlo en Filtros \(☰\) → «Ordenar por», con la casilla «Tener en cuenta tus gustos»\)/,
    /27 de octubre de 2026: Tus gustos: solo cuentan con el orden «Recomendado»/,
    /Se apaga en Filtros \(☰\) → «Ordenar por» → «Según el tiempo»/,
    /27 de octubre de 2026: Dónde se apagan «Según el tiempo» y «Tener en cuenta tus gustos»/,
  ], [/con «Más pronto» como si empezaran seis horas antes/]],
  ['/en/privacy/', 'Last updated: 29 October 2026', [
    /without hiding anything \(only with the “Recommended” order, the default one, where they count as if they were two days newer; with “Nearest”, “Starts soonest” or “Newest” they don't count, and you can turn this off in Filters \(☰\) → “Sort by”, with the “Take your interests into account” box\)/,
    /27 October 2026: Your interests: they only count with the “Recommended” order/,
    /Turn it off in Filters \(☰\) → “Sort by” → “Based on the weather”/,
    /27 October 2026: Where to turn off “Based on the weather”/,
  ], [/with “Soonest” as if they started six hours earlier/, /Turn it off in the sort menu/]],
  ['/preguntas/', '¿Por qué veo unas cosas y no otras?', [
    /Lo destacado de pago sale primero y siempre con la etiqueta «Destacado»\. Después, el orden que elijas en Filtros \(☰\), arriba del todo: «Ordenar por»\. De serie es «Recomendado»/,
    /También puedes elegir «Más cerca», «Empieza antes» o «Lo más nuevo»\. En la agenda, la lista del día va por hora o por cercanía, y en Sitios, por cercanía o por la mejor valoración\./,
    /Lo que se ve lo deciden las preguntas de arriba \(¿Dónde\?, ¿Cuándo\?, ¿Qué\?\) y Filtros\./,
  ], [/Por cercanía, por lo que empieza pronto y por tus favoritos\./]],
  ['/en/faq/', 'Why do I see some things and not others?', [
    /Paid featured placements come first and always carry the “Featured” label\. After that, the order you choose in Filters \(☰\), at the very top: “Sort by”\. By default it's “Recommended”/,
    /You can also choose “Nearest”, “Starts soonest” or “Newest”\. In the agenda, a day's list goes by time or by distance, and in Places, by distance or by best rating\./,
  ], [/Because of how close they are, what starts soon and your favourites\./]],
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
