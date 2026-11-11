// Prueba de lo publicado el 2026-11-04 (SC1–SC3 e IC4, aprobados por Iván ese
// día), en la web local:
//
//  1. Privacidad (ES y EN), fila «Equipos y deportistas que sigues» (SC1):
//     equipos, deportistas y competiciones («Fórmula 1»), «partido, carrera o
//     velada» y un aviso por evento; su línea en el historial (SC2).
//  2. Privacidad (ES y EN), fila «Correos que no llegan y cambio de correo»
//     (IC4): la dirección de quien no tiene cuenta, que al cambiar de correo se
//     borra la marca de la anterior y los 12 meses de las que no son de
//     ninguna cuenta; su línea en el historial.
//  3. Condiciones para negocios (ES y EN), apartado 3 (SC3): «Poner siempre»
//     de «un equipo, un deportista o una competición»; aclaración sin versión
//     nueva (la cabecera sigue en 2026-11-03-b y la tabla de versiones no
//     cambia) y su línea del 4-11 en el historial.
//  4. Privacidad (ES y EN), fila «Cuenta de negocio» (aprobado por Iván el
//     4-11, después de SC): «Poner siempre» un equipo, un deportista o una
//     competición; su línea del 4-11 en el historial.
//  5. Sin desplazamiento horizontal ni errores de JavaScript.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_sc_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/privacidad', 'Última actualización: 11 de noviembre de 2026', [
    /Equipos y deportistas que sigues\s+Los equipos, deportistas y competiciones que sigues \(«Real Madrid», «Fernando Alonso», «Fórmula 1»\), desde cuándo, de qué partidos o carreras te hemos avisado ya y, mientras sigas alguno, la zona de tus filtros/,
    /Avisarte unas horas antes de un partido, una carrera o una velada de lo que sigues con los bares de tu zona que lo ponen \(como mucho dos avisos al día, uno por evento aunque sigas al equipo o al deportista y a su competición, y nunca si con tus horas de silencio llegaría con el evento empezado\)\./,
    /Los bares no saben quién sigue qué\s/,
    /Correos que no llegan y cambio de correo\s+Tu email \(o, si no tienes cuenta, la dirección a la que te escribimos\), la fecha, el motivo \(rebote o marcado como spam\)/,
    /Hasta que cambies de correo \(al cambiarlo, se borra la marca de la dirección anterior\), nos digas que ya funciona o elimines tu cuenta\. Si la dirección no es de ninguna cuenta de Klendar \(por ejemplo, si denuncias sin cuenta, te invitan a un equipo o pides «Avísame cuando Klendar llegue» sin cuenta\), 12 meses desde el último correo que nos devolvió o que se marcó como spam\. El registro de administración, 2 años/,
    /4 de noviembre de 2026: En «Equipos y deportistas que sigues» también se pueden seguir competiciones enteras \(como la Fórmula 1\) y deportistas de cualquier deporte; te avisamos antes de cada partido, carrera o velada\. No cambia qué datos tratamos ni para qué\./,
    /4 de noviembre de 2026: La fila «Correos que no llegan y cambio de correo» dice cuánto guardamos la marca de una dirección que no es de ninguna cuenta \(12 meses desde el último rebote o queja\)/,
    /y, en «Dónde verlo», quién del equipo puso «Poner siempre» un equipo, un deportista o una competición; si es una entidad y conecta su agenda, la dirección de cada calendario/,
    /4 de noviembre de 2026: La fila «Cuenta de negocio» nombra también a los deportistas en «Poner siempre» de «Dónde verlo»: un equipo, un deportista o una competición\. No cambia qué datos tratamos ni para qué\./,
  ], [
    /puso «Poner siempre» un equipo o una competición\. Para/,
    /Los equipos o participantes que sigues/,
    /un partido de tu equipo con los bares/,
    /quién sigue a qué equipo/,
    /elimines tu cuenta; el registro de administración, 2 años/,
  ]],
  ['/en/privacy', 'Last updated: 11 November 2026', [
    /Teams and athletes you follow\s+The teams, athletes and competitions you follow \(“Real Madrid”, “Fernando Alonso”, “Formula 1”\), since when, which matches or races we've already told you about and, while you follow any, your filters' area/,
    /Let you know a few hours before a match, race or fight night of what you follow which bars in your area are showing it \(two notifications a day at most, one per event even if you follow both the team or athlete and its competition, and never if your quiet hours would deliver it after it has started\)\./,
    /Bars don't know who follows what\s/,
    /Emails that bounce and changing your email\s+Your email \(or, if you don't have an account, the address we write to\), the date, the reason \(bounce or marked as spam\)/,
    /Until you change your email \(when you do, the mark on the previous address is deleted\), tell us it works again or delete your account\. If the address isn't linked to any Klendar account \(for example, if you report something without an account, you're invited to a team or you ask ‘Let me know when Klendar arrives’ without an account\), 12 months from the last email that bounced or was marked as spam\. The admin log, 2 years/,
    /4 November 2026: In “Teams and athletes you follow” you can now also follow whole competitions \(such as Formula 1\) and athletes from any sport; we let you know before each match, race or fight night\. What data we process and why doesn't change\./,
    /4 November 2026: The “Emails that bounce and changing your email” row now says how long we keep the mark on an address that isn't linked to any account \(12 months from the last bounce or complaint\)/,
    /and, in “Where to watch”, which team member set “Always show” for a team, an athlete or a competition; if it is an organisation and connects its calendar, the address of each calendar/,
    /4 November 2026: The “Business account” row now also names athletes in “Always show” in “Where to watch”: a team, an athlete or a competition\. What data we process and why doesn't change\./,
  ], [
    /set “Always show” for a team or a competition\. For/,
    /The teams or competitors you follow/,
    /before your team's match/,
    /who follows which team/,
    /delete your account; the admin log, 2 years/,
  ]],
  ['/negocios', 'Última actualización: 11 de noviembre de 2026 · Versión 2026-11-05', [
    /o pide ponerlos siempre los de un equipo, un deportista o una competición \(«Poner siempre»\), tener los derechos para emitir cada uno en su local/,
    /4 de noviembre de 2026: «Poner siempre» \(apartado 3\) nombra también a los deportistas: «los de un equipo, un deportista o una competición»\. Es una aclaración que solo te favorece[\s\S]*?se aplica al publicarse, sin los 15 días de aviso\. El resto de «Poner siempre» se aplica desde el 18 de noviembre de 2026, como estaba\./,
    /Versión\s+Publicada\s+Se aplica desde\s+2026-11-05\s+5-11-2026\s+20-11-2026\s+2026-11-04\s+4-11-2026\s+19-11-2026\s+2026-11-03-b\s+3-11-2026\s+18-11-2026/,
  ], [
    /ponerlos siempre los de un equipo o una competición/,
  ]],
  ['/en/business-terms', 'Last updated: 11 November 2026 · Version 2026-11-05', [
    /or asks to always show those of a team, an athlete or a competition \(“Always show”\), hold the rights to show each one at its venue/,
    /4 November 2026: “Always show” \(section 3\) now also names athletes: “those of a team, an athlete or a competition”\. It's a clarification that only benefits you[\s\S]*?so it applies on publication, without the 15 days' notice\. The rest of “Always show” applies from 18 November 2026, as before\./,
    /Version\s+Published\s+Applies from\s+2026-11-05\s+5 Nov 2026\s+20 Nov 2026\s+2026-11-04\s+4 Nov 2026\s+19 Nov 2026\s+2026-11-03-b\s+3 Nov 2026\s+18 Nov 2026/,
  ], [
    /always show those of a team or a competition/,
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
