// Prueba de lo publicado el 2026-11-03 (ES1–ES3 y TS1–TS3, aprobados por
// Iván ese día; «Toda España»: cualquier municipio, y «Dónde verlo»: todos
// los deportes con TheSportsDB), en la web local:
//
//  1. Privacidad (ES y EN): «Tus gustos y tu ciudad» con el municipio (ES1),
//     «Ubicación» con la posición que se manda sin guardarla (ES2) y el
//     historial.
//  2. Fuentes y licencias (ES y EN): TheSportsDB en «Partidos y eventos
//     televisados» (TS1), sin football-data.org, y el apartado nuevo
//     «Municipios» con el IGN y Wikidata (ES3).
//  3. Condiciones para negocios (ES y EN): «Poner siempre» en el apartado 3
//     (TS2), el aviso de arriba (3-11, desde el 18-11) y el historial.
//  4. Términos (ES y EN): «Dónde verlo» (TS3), la fecha y el historial.
//  5. Sin desplazamiento horizontal ni errores de JavaScript.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_es_ts_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/privacidad', 'Última actualización: 11 de noviembre de 2026', [
    /y, si quieres, tu ciudad habitual: un municipio de España, con su nombre y su punto \(el del municipio, nunca tu dirección ni tu posición\)\./,
    /con el punto redondeado\. Saber en qué municipio estás cuando eliges «Usar mi ubicación» en «Tu ciudad» o para avisarte de que estás de viaje \(se envía tu posición —en la app, redondeada a unos 100 m—, se mira en qué municipio cae y no se guarda\)/,
    /3 de noviembre de 2026: Tu ciudad puede ser cualquier municipio de España/,
  ], [/una de las ciudades de Klendar/]],
  ['/en/privacy', 'Last updated: 11 November 2026', [
    /and, if you like, your home town: a town in Spain, with its name and its point \(the town's, never your address or your position\)\./,
    /using the rounded point\. Work out which town you are in when you choose “Use my location” in “Your city” or to let you know you are travelling \(your position is sent —rounded to about 100 m in the app—, matched to a town and not stored\)/,
    /3 November 2026: Your city can be any town in Spain/,
  ], [/one of Klendar's cities/]],
  ['/fuentes', '', [
    /Los partidos y eventos de todos los deportes \(fútbol, baloncesto, Fórmula 1, MotoGP, balonmano, UFC…\) y sus horarios vienen de TheSportsDB \(thesportsdb\.com\), con su plan de pago, que permite usarlos citándoles como fuente: «Datos deportivos: TheSportsDB»\./,
    /No usamos sus imágenes ni enseñamos el canal de televisión: lo que importa es si el bar lo pone\. Los horarios pueden cambiar: confírmalos con el bar\./,
    /Municipios\s+Los nombres, los códigos y los contornos de los municipios y las provincias son de las Líneas límite municipales del Instituto Geográfico Nacional \(© Instituto Geográfico Nacional, IGN\/CNIG, centrodedescargas\.cnig\.es\), con licencia CC BY 4\.0, simplificados por es-atlas \(Martín González, MIT\)\./,
    /El punto de cada pueblo y su población \(solo para ordenar la búsqueda\) son de Wikidata, con licencia CC0\./,
  ], [/football-data/i]],
  ['/en/sources', '', [
    /Matches and events in every sport \(football, basketball, Formula 1, MotoGP, handball, UFC…\) and their times come from TheSportsDB \(thesportsdb\.com\), under its paid plan, which allows them to be used crediting them as the source: “Sports data: TheSportsDB”\./,
    /We don't use their images or show the TV channel: what matters is whether the bar is showing it\. Times can change: check with the bar\./,
    /Towns\s+The names, codes and boundaries of Spanish towns and provinces come from the municipal boundary lines of the Instituto Geográfico Nacional \(© IGN\/CNIG, centrodedescargas\.cnig\.es\), licensed under CC BY 4\.0, simplified by es-atlas \(Martín González, MIT\)\./,
    /Each town's point and population \(only used to sort search results\) come from Wikidata, licensed CC0\./,
  ], [/football-data/i]],
  ['/negocios', 'Última actualización: 5 de noviembre de 2026', [
    /Si marca que pone un partido o un evento \(«Lo ponemos»\) o pide ponerlos siempre los de un equipo, un deportista o una competición \(«Poner siempre»\), tener los derechos para emitir cada uno en su local \(por ejemplo, la suscripción para hostelería de la plataforma que lo emite\) y ponerlo de verdad; los que marque «Poner siempre» y no vaya a poner, quitarlos\. Klendar no lo comprueba y puede quitar la marca si recibe quejas\./,
    /los del 3 de noviembre de 2026 \(apartados 3, 3 decies y 4\), desde el 18 de noviembre de 2026, los del 4 de noviembre de 2026 \(apartado 3 bis, «Conecta tu agenda»\), desde el 19 de noviembre de 2026, y los del 5 de noviembre de 2026 \(apartado 2 bis\), desde el 20 de noviembre de 2026: 15 días/,
    /3 de noviembre de 2026: «Poner siempre» \(apartado 3\)[\s\S]*?Se aplica desde el 18 de noviembre de 2026\./,
  ], [/tener los derechos para emitirlo en su local/]],
  ['/en/business-terms', 'Last updated: 5 November 2026', [
    /If it marks that it's showing a match or an event \(“We're showing it”\) or asks to always show those of a team, an athlete or a competition \(“Always show”\), hold the rights to show each one at its venue \(for example, the hospitality subscription of the platform that broadcasts it\) and really show it; remove those that “Always show” marks and it isn't going to show\. Klendar doesn't check this and may remove the mark if it receives complaints\./,
    /those of 3 November 2026 \(sections 3, 3i and 4\) from 18 November 2026, those of 4 November 2026 \(section 3a, “Connect your calendar”\) from 19 November 2026, and those of 5 November 2026 \(section 2a\) from 20 November 2026: 15 days/,
    /3 November 2026: “Always show” \(section 3\)[\s\S]*?It applies from 18 November 2026\./,
  ], [/hold the rights to show it at its venue/]],
  ['/terminos', 'Última actualización: 5 de noviembre de 2026', [
    /Dónde verlo: los partidos y sus horarios vienen de fuentes externas y de lo que dicen los bares/,
    /3 de noviembre de 2026: «Dónde ver el partido» pasa a llamarse «Dónde verlo»/,
  ], [/Dónde ver el partido: los partidos/]],
  ['/en/terms', 'Last updated: 5 November 2026', [
    /Where to watch: matches and their times come from external sources and from what bars say/,
    /3 November 2026: “Where to watch the match” is now called “Where to watch”/,
  ], [/Where to watch the match: matches/]],
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
