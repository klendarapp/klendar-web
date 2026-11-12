// Prueba de lo publicado el 2026-11-04 (DV1–DV2 y EN1–EN3, aprobados por Iván
// ese día), en la web local. EN2 («Conecta tu agenda») y EN3 se quitaron el
// 12-11 (QA, tools/legal_qa_check.mjs): aquí se comprueba que ya no salen.
//
//  1. Privacidad (ES y EN), fila «Cuenta de negocio»: «deshizo una validación
//     hecha por error» entre lo que hace cada uno en las herramientas del
//     negocio (DV1) y, detrás de «Poner siempre» de «un equipo, un deportista
//     o una competición», lo que guardamos cuando una entidad conecta su
//     agenda (EN3); sus dos líneas del 4-11 en el historial.
//  2. Términos (ES y EN), apartado 3: el negocio puede deshacer en 10 minutos
//     una validación hecha por error (DV2); fecha y línea del 4-11.
//  3. Condiciones para negocios (ES y EN), 3 bis: las cuentas de entidad no
//     pagan cuota, ni ahora ni más adelante (EN1, se aplica al publicarse) y
//     «Conecta tu agenda» (EN2, versión 2026-11-04, desde el 19-11-2026): la
//     cabecera, la tabla de versiones, el aviso de arriba y el historial.
//  4. Sin desplazamiento horizontal ni errores de JavaScript.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_dv_en_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';
import { fechaLegal } from './_fecha_ia.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/privacidad', fechaLegal('/privacidad', 'Última actualización: 12 de noviembre de 2026'), [
    /qué hace cada uno en las herramientas del negocio \(quién validó, deshizo una validación hecha por error, vendió o descontó, apuntó a alguien en la cola o dio algo en el momento\)/,
    /y, en «Dónde verlo», quién del equipo puso «Poner siempre» un equipo, un deportista o una competición\. Para el «Gratis de lanzamiento», la provincia del local/,
    /4 de noviembre de 2026: La fila «Cuenta de negocio» nombra también quién del equipo deshace una validación hecha por error\./,
    /4 de noviembre de 2026: La fila «Cuenta de negocio» cuenta lo que guardamos cuando una entidad conecta su agenda\./,
  ], [
    /\(quién validó, vendió o descontó/,
    /si es una entidad y conecta su agenda/,
  ]],
  ['/en/privacy', fechaLegal('/en/privacy', 'Last updated: 12 November 2026'), [
    /what each of them does in the business tools \(who validated, undid a validation made by mistake, sold or recorded a use, added someone to the queue or gave something on the spot\)/,
    /and, in “Where to watch”, which team member set “Always show” for a team, an athlete or a competition\. For the launch free period, the province of the venue/,
    /4 November 2026: The “Business account” row now also mentions who in the team undoes a validation made by mistake\./,
    /4 November 2026: The “Business account” row now explains what we keep when an organisation connects its calendar\./,
  ], [
    /\(who validated, sold or recorded a use/,
    /if it is an organisation and connects its calendar/,
  ]],
  ['/terminos', fechaLegal('/terminos', 'Última actualización: 12 de noviembre de 2026'), [
    /Si el negocio valida tu código por error, puede deshacerlo en los 10 minutos siguientes \(una vez por código\): tu código vuelve a valer, salvo que la oferta ya haya terminado, y se quitan el sello o el cupón que te hubiera dado ese canje, si aún no los has usado\./,
    /4 de noviembre de 2026: Ofertas y canjes \(apartado 3\): si el negocio valida tu código por error, puede deshacerlo en los 10 minutos siguientes, una vez por código/,
  ], []],
  ['/en/terms', fechaLegal('/en/terms', 'Last updated: 12 November 2026'), [
    /If the business validates your code by mistake, it can undo it within the next 10 minutes \(once per code\): your code is valid again, unless the offer has already ended, and any stamp or coupon that redemption gave you is removed, if you haven't used it yet\./,
    /4 November 2026: Deals and redemptions \(section 3\): if the business validates your code by mistake, it can undo it within the next 10 minutes, once per code/,
  ], []],
  ['/negocios', fechaLegal('/negocios', 'Última actualización: 12 de noviembre de 2026 · Versión 2026-11-05'), [
    /Las cuentas de entidad no pagan cuota, ni ahora ni más adelante: Klendar no les cobrará por publicar ni por las funciones que hoy tienen\. Si algún día hubiera funciones nuevas de pago, serían opcionales y la Entidad podría seguir usando gratis todo lo demás\./,
    /y los del 5 de noviembre de 2026 \(apartado 2 bis\), desde el 20 de noviembre de 2026: 15 días/,
    /y que las cuentas de entidad no paguen cuota, ni ahora ni más adelante \(apartado 3 bis\), también, porque solo favorece a la Entidad\./,
    /Versión\s+Publicada\s+Se aplica desde\s+(?:.+\n\s*)?2026-11-05\s+5-11-2026\s+20-11-2026\s+2026-11-04\s+4-11-2026\s+19-11-2026 \(sin «Conecta tu agenda», que se retiró el 12-11-2026\)\s+2026-11-03-b\s+3-11-2026\s+18-11-2026/,
    /4 de noviembre de 2026: Cuentas de entidad \(apartado 3 bis\): no pagan cuota, ni ahora ni más adelante[\s\S]*?se aplica al publicarse, sin los 15 días de aviso\./,
  ], [
    /Mientras Klendar no diga otra cosa, las cuentas de entidad no pagan cuota/,
    /Conecta tu agenda\. La Entidad puede conectar/,
    /4 de noviembre de 2026: «Conecta tu agenda» \(apartado 3 bis\)/,
    /desde el 19 de noviembre de 2026, y los del 5/,
  ]],
  ['/en/business-terms', fechaLegal('/en/business-terms', 'Last updated: 12 November 2026 · Version 2026-11-05'), [
    /Organisation accounts pay no fee, now or later: Klendar will not charge them for publishing or for the features they have today\. If paid features are ever added, they will be optional and the Organisation may keep using everything else for free\./,
    /and those of 5 November 2026 \(section 2a\) from 20 November 2026: 15 days/,
    /and so does the fact that organisation accounts pay no fee, now or later \(section 3a\), as it only benefits the Organisation\./,
    /Version\s+Published\s+Applies from\s+(?:.+\n\s*)?2026-11-05\s+5 Nov 2026\s+20 Nov 2026\s+2026-11-04\s+4 Nov 2026\s+19 Nov 2026 \(without “Connect your calendar”, withdrawn on 12 Nov 2026\)\s+2026-11-03-b\s+3 Nov 2026\s+18 Nov 2026/,
    /4 November 2026: Organisation accounts \(section 3a\): they pay no fee, now or later[\s\S]*?so it applies on publication, without the 15 days' notice\./,
  ], [
    /Until Klendar says otherwise, organisation accounts pay no fee/,
    /Connect your calendar\. The Organisation may connect/,
    /4 November 2026: “Connect your calendar” \(section 3a\)/,
    /from 19 November 2026, and those of 5/,
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
