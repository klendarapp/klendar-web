// Prueba de lo publicado el 2026-11-03 (AO1–AO4 y GP1, aprobados por Iván
// ese día; aforo sin enseñarlo, «¿Has abierto hoy?» y el «Gratis de
// lanzamiento» por provincia), en la web local:
//
//  1. Condiciones para negocios (ES y EN): 3 decies / 3i con las dos frases
//     nuevas (AO1); apartado 4, «Gratis de lanzamiento» por provincia (GP1);
//     el aviso de arriba (3-11, desde el 18-11) y el historial.
//  2. Privacidad (ES y EN): «Avísame cuando haya sitio» (AO2),
//     «Notificaciones push» (AO3), «Cuenta de negocio» (AO4) y el historial.
//  3. Precios (ES y EN): el «Gratis de lanzamiento» dice provincia, como las
//     condiciones.
//  4. Sin desplazamiento horizontal ni errores de JavaScript.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_ao_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';
import { NUNCA_PRECIO, PRECIOS_APAGADO, segunPrecios } from './_precios.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/negocios', 'Última actualización: 12 de noviembre de 2026', [
    /En tu ficha se ve solo el nivel, nunca la cifra\. Si lo prefieres, puedes contar sin enseñarlo \(«Enseñar en mi ficha si hay sitio», en los ajustes del aforo\): entonces solo lo ve tu equipo, nadie puede pedir que le avisemos y a quien ya lo había pedido se lo quitamos y se lo decimos\./,
    /se guardan 14 meses\. Si tu equipo cuenta gente cuando Klendar muestra tu local cerrado, te preguntamos si has abierto\. Solo si contestas que sí lo marcamos abierto ese día \(quitando ese día de tus días cerrados y poniéndole un horario desde ese momento hasta tu cierre habitual o hasta las 6:00\); lo puedes cambiar cuando quieras y que tu horario sea correcto sigue siendo tu responsabilidad\./,
    /Gratis de lanzamiento\. Mientras Klendar arranca en una provincia, podemos dar a los negocios de esa provincia más tiempo gratis \(«Gratis de lanzamiento»\)\./,
    /los del 3 de noviembre de 2026 \(apartados 3, 3 decies y 4\), desde el 18 de noviembre de 2026, y los del 5 de noviembre de 2026 \(apartado 2 bis\), desde el 20 de noviembre de 2026: 15 días/,
    /3 de noviembre de 2026: Aforo en directo \(apartado 3 decies\): puedes contar sin enseñarlo; «¿Has abierto hoy\?» solo marca tu local abierto si dices que sí\. «Gratis de lanzamiento» \(apartado 4\): va por provincia, no por ciudad\. Se aplica desde el 18 de noviembre de 2026\./,
  ], [/arranca en una ciudad/]],
  ['/en/business-terms', 'Last updated: 12 November 2026', [
    /Your page only shows the level, never the figure\. If you prefer, you can count without showing it \(“Show on my page if there’s room”, in the capacity settings\): then only your team sees it, nobody can ask us to notify them, and anyone who had already asked has their request removed and is told so\./,
    /are kept for 14 months\. If your team counts people while Klendar shows your venue as closed, we ask you whether you've opened\. Only if you answer yes do we mark it open that day[\s\S]*?keeping your opening hours accurate remains your responsibility\./,
    /Launch, free\. While Klendar is starting in a province, we may give businesses in that province more free time \(“Launch, free”\)\./,
    /those of 3 November 2026 \(sections 3, 3i and 4\) from 18 November 2026, and those of 5 November 2026 \(section 2a\) from 20 November 2026: 15 days/,
    /3 November 2026: Live capacity \(section 3i\)[\s\S]*?It applies from 18 November 2026\./,
  ], [/starting in a city/]],
  ['/privacidad', 'Última actualización: 12 de noviembre de 2026', [
    /Avísame cuando haya sitio\s+Que pediste[\s\S]*?nunca quiénes\. Si el local deja de enseñar si hay sitio, la quitamos y te lo decimos con un aviso\s+Ejecución/,
    /\(lo apagas con «Cuando haya sitio»\); también el aviso de que hemos quitado tu petición porque el local ha dejado de enseñar si hay sitio\. Y «Tu pedido está listo»/,
    /\(solo números: nunca quién entra\); si alguien del equipo contesta «¿Has abierto hoy\?», quién y qué contestó \(se borra a los 7 días\);/,
    /3 de noviembre de 2026: Aforo en directo: si un local deja de enseñar si hay sitio/,
  ], []],
  ['/en/privacy', 'Last updated: 12 November 2026', [
    /never who\. If the venue stops showing whether there's room, we remove it and let you know with a notification\s+Performance/,
    /\(turn it off with “When there's room”\); so does the notification that we've removed your request because the venue stopped showing whether there's room\. And “Your order is ready”/,
    /\(numbers only: never who comes in\); if someone on the team answers “Are you open today\?”, who answered and what \(deleted after 7 days\);/,
  ], []],
  // Con los precios apagados (PRECIOS, 11-11), /precios no lo cuenta (las
  // condiciones, arriba, sí).
  ...segunPrecios([
    ['/precios', '', [/Gratis de lanzamiento\. Mientras Klendar arranca en una provincia, podemos dar a los negocios de esa provincia más tiempo gratis:/], [/arranca en una ciudad/]],
    ['/en/pricing', '', [/Launch, free\. While Klendar is starting in a province, we may give businesses in that province more free time:/], [/starting in a city/]],
  ], [
    ['/precios', '', PRECIOS_APAGADO.es, [...NUNCA_PRECIO, /arranca en una ciudad/]],
    ['/en/pricing', '', PRECIOS_APAGADO.en, [...NUNCA_PRECIO, /starting in a city/]],
  ]),
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
