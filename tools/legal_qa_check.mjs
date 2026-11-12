// Prueba de QA1–QA4 (12-11-2026): la agenda pública importada y «Conecta tu
// agenda» fuera de los textos legales (docs/LEGAL_PENDIENTE_2026-10.md del
// repo de la app, «QA»), en la web local:
//
//  1. Términos (ES y EN), apartado 3: sin el punto «Agenda pública» ni el
//     enlace a «Fuentes y licencias»; fecha y línea del 12-11 (QA1).
//  2. Condiciones para negocios (ES y EN): el 2 bis sin el punto (4), lo
//     importado «uno de cada cinco» (QA2); el 3 bis sin «Conecta tu agenda»
//     (EN2), el aviso de arriba sin el 19-11 y diciendo que se retiró, la nota
//     de la versión 2026-11-04 en la tabla, el historial sin la línea del 4-11
//     de EN2 y con la del 12-11; la versión sigue siendo la 2026-11-05 (QA3).
//  3. Privacidad (ES y EN), fila «Cuenta de negocio»: sin las agendas
//     conectadas (EN3); fecha y línea del 12-11 (QA4).
//  4. Sin desplazamiento horizontal ni errores de JavaScript.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_qa_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';
import { fechaLegal } from './_fecha_ia.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/terminos', fechaLegal('/terminos', 'Última actualización: 12 de noviembre de 2026 · Versión 2026-09-29'), [
    /Historial de cambios\s+(?:.+\n\s*){0,2}?12 de noviembre de 2026: Ofertas y canjes \(apartado 3\): se quita el punto «Agenda pública»\. Klendar ya no enseña actividades importadas de los datos abiertos de los ayuntamientos: todo lo que ves lo publica un negocio, un ayuntamiento, una asociación o una ONG con su propio perfil\. Tus derechos y obligaciones no cambian, así que no hace falta volver a aceptarlos\./,
  ], [
    /Agenda pública: en algunas ciudades enseñamos actividades/,
    /confirma la hora, el precio y las condiciones en la fuente/,
  ], ['a[href="/fuentes"]']],
  ['/en/terms', fechaLegal('/en/terms', 'Last updated: 12 November 2026 · Version 2026-09-29'), [
    /Change history\s+(?:.+\n\s*){0,2}?12 November 2026: Deals and redemptions \(section 3\): the “Public listings” point is removed\. Klendar no longer shows activities imported from councils' open data: everything you see is published by a business, a council, an association or an NGO with its own profile\. Your rights and obligations don't change, so there's no need to accept them again\./,
  ], [
    /Public listings: in some cities we show activities/,
    /check the time, price and conditions at the source/,
  ], ['a[href="/en/sources"]']],
  ['/negocios', fechaLegal('/negocios', 'Última actualización: 12 de noviembre de 2026 · Versión 2026-11-05'), [
    /La lista de un día de la agenda va «Por hora» \(de serie\) o «Más cerca»\. Lo que publica una entidad cuenta como cualquier publicación\. En Explorar › Sitios/,
    /y que las cuentas de entidad no paguen cuota, ni ahora ni más adelante \(apartado 3 bis\), también, porque solo favorece a la Entidad\. «Conecta tu agenda» \(apartado 3 bis\), que se publicó el 4 de noviembre de 2026 para aplicarse desde el 19 de noviembre de 2026, se retiró el 12 de noviembre de 2026 y no llega a aplicarse\. Si no está de acuerdo/,
    /los del 3 de noviembre de 2026 \(apartados 3, 3 decies y 4\), desde el 18 de noviembre de 2026, y los del 5 de noviembre de 2026/,
    /Las cuentas de entidad no pagan cuota, ni ahora ni más adelante/,
    /2026-11-04\s+4-11-2026\s+19-11-2026 \(sin «Conecta tu agenda», que se retiró el 12-11-2026\)/,
    /Historial de cambios\s+(?:.+\n\s*){0,2}?12 de noviembre de 2026: Se retira «Conecta tu agenda» \(apartado 3 bis\), que se publicó el 4 de noviembre de 2026 para aplicarse desde el 19 de noviembre: no llega a aplicarse y las entidades no tienen las obligaciones que traía\. En «Cómo se ordena lo que se ve» \(apartado 2 bis\) se quita el punto de los eventos importados de la agenda pública de los ayuntamientos, que ya no hay: todo lo que se ve lo publica un negocio o una entidad con su propio perfil\. Los dos cambios solo te favorecen, así que se aplican al publicarse, sin los 15 días de aviso\./,
    /4 de noviembre de 2026: Cuentas de entidad \(apartado 3 bis\): no pagan cuota/,
  ], [
    /salen como mucho uno de cada cinco, intercalados/,
    /\(4\) los eventos que Klendar importa/,
    /por sí misma cuenta/,
    /Conecta tu agenda\. La Entidad/,
    /calendarios en formato iCal/,
    /4 de noviembre de 2026: «Conecta tu agenda»/,
    /\(apartado 3 bis, «Conecta tu agenda»\), desde el 19/,
  ], []],
  ['/en/business-terms', fechaLegal('/en/business-terms', 'Last updated: 12 November 2026 · Version 2026-11-05'), [
    /The list for a day in the agenda is “By time” \(by default\) or “Nearest”\. What an organisation publishes counts like any other publication\. In Explore › Places/,
    /as it only benefits the Organisation\. “Connect your calendar” \(section 3a\), published on 4 November 2026 to apply from 19 November 2026, was withdrawn on 12 November 2026 and never applies\. If the Business does not agree/,
    /those of 3 November 2026 \(sections 3, 3i and 4\) from 18 November 2026, and those of 5 November 2026/,
    /2026-11-04\s+4 Nov 2026\s+19 Nov 2026 \(without “Connect your calendar”, withdrawn on 12 Nov 2026\)/,
    /Change history\s+(?:.+\n\s*){0,2}?12 November 2026: “Connect your calendar” \(section 3a\), published on 4 November 2026 to apply from 19 November, is withdrawn: it never applies and organisations don't have the obligations it brought\. In “How what people see is ordered” \(section 2a\), the point about events imported from councils' public listings is removed, as there are none any more: everything shown is published by a business or an organisation with its own profile\. Both changes only benefit you, so they apply on publication, without the 15 days' notice\./,
  ], [
    /appear at most one in every five, interleaved/,
    /\(4\) events Klendar imports/,
    /publishes itself counts/,
    /Connect your calendar\. The Organisation/,
    /calendars in iCal/,
    /4 November 2026: “Connect your calendar”/,
    /\(section 3a, “Connect your calendar”\) from 19/,
  ], []],
  ['/privacidad', fechaLegal('/privacidad', 'Última actualización: 12 de noviembre de 2026 · Versión 2026-09-29'), [
    /un equipo, un deportista o una competición\. Para el «Gratis de lanzamiento», la provincia del local/,
    /Historial de cambios\s+(?:.+\n\s*){0,2}?12 de noviembre de 2026: La fila «Cuenta de negocio» ya no habla de las agendas que conectaban las entidades: «Conecta tu agenda» se ha quitado y no guardamos nada de ella\./,
  ], [
    /si es una entidad y conecta su agenda/,
    /la dirección de cada calendario/,
  ], []],
  ['/en/privacy', fechaLegal('/en/privacy', 'Last updated: 12 November 2026 · Version 2026-09-29'), [
    /an athlete or a competition\. For the launch free period, the province of the venue/,
    /Change history\s+(?:.+\n\s*){0,2}?12 November 2026: The “Business account” row no longer mentions the calendars organisations connected: “Connect your calendar” has been removed and we keep nothing from it\./,
  ], [
    /if it is an organisation and connects its calendar/,
    /the address of each calendar/,
  ], []],
];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas, nunca, enlacesNo] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const txt = `${await p.locator('body').innerText()}
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    for (const re of nunca) ok(!re.test(txt), `${nombre}/${t} ${ruta}: ya no dice ${re.source}`);
    // Lo quitado iba dentro de <main>; el pie de toda la web puede enlazar a «Fuentes y licencias».
    for (const sel of enlacesNo) ok(await p.locator(`main ${sel}`).count() === 0, `${nombre}/${t} ${ruta}: sin ${sel} en el texto`);
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
