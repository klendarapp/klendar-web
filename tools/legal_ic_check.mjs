// Prueba de lo publicado el 2026-11-04 (IC1–IC3, incoherencias del paquete
// del abogado, aprobado por Iván ese día), en la web local:
//
//  1. Condiciones para negocios (ES y EN): la cabecera dice la versión de las
//     condiciones (2026-11-03-b), ya no la de los términos (2026-09-29), y
//     enlaza con el apartado nuevo «Versiones y desde cuándo se aplican»
//     mientras quede alguna por aplicarse; el apartado tiene la tabla, y el
//     historial su línea del 4-11. Los términos siguen con la 2026-09-29.
//  2. Precios (ES y EN): «puede bloquearse» (IC2) y el orden de serie es
//     «Recomendado» (IC3); ya no dicen «se bloquea» ni «el orden lo elige
//     cada persona en los filtros».
//     Con los precios apagados (`PRECIOS`, 11-11), /precios dice «Te lo
//     explicamos en persona» y nada de precios ni de bloqueos.
//  3. Sin desplazamiento horizontal ni errores de JavaScript.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_ic_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';
import { NUNCA_PRECIO, PRECIOS_APAGADO, segunPrecios } from './_precios.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

// La nota «Algunos cambios aún no se aplican» sale mientras quede alguna
// versión por aplicarse (la última, el 19-11-2026) y se va al regenerar.
const pendientes = new Date().toISOString().slice(0, 10) < '2026-11-20';

const PAGINAS = [
  ['/negocios', 'Última actualización: 12 de noviembre de 2026 · Versión 2026-11-05', [
    ...(pendientes ? [/Versión 2026-11-05 · Algunos cambios aún no se aplican: mira «Versiones y desde cuándo se aplican», al final\./] : []),
    /Versiones y desde cuándo se aplican\s+Cada versión de estas condiciones se aplica desde la fecha de la tabla; hasta ese día vale la anterior\. Los cambios que te afectan te los avisamos con al menos 15 días de antelación \(apartado 10\)/,
    /2026-11-03-b\s+3-11-2026\s+18-11-2026/,
    /2026-11-02\s+2-11-2026\s+17-11-2026/,
    /2026-10-14\s+14-10-2026\s+29-10-2026/,
    /2026-09-29\s+29-9-2026\s+29-9-2026/,
    /4 de noviembre de 2026: La cabecera dice la versión de estas condiciones \(2026-11-03-b\)/,
  ], [
    /Versión 2026-09-29 ·|Versión 2026-09-29\s*$/m,
  ]],
  ['/en/business-terms', 'Last updated: 12 November 2026 · Version 2026-11-05', [
    ...(pendientes ? [/Version 2026-11-05 · Some changes don't apply yet: see ‘Versions and when they apply’, at the end\./] : []),
    /Versions and when they apply\s+Each version of these terms applies from the date in the table; until that day, the previous one applies\./,
    /2026-11-03-b\s+3 Nov 2026\s+18 Nov 2026/,
    /2026-09-29\s+29 Sep 2026\s+29 Sep 2026/,
    /4 November 2026: The header shows the version of these terms \(2026-11-03-b\)/,
  ], [
    /Version 2026-09-29/,
  ]],
  ['/terminos', 'Versión 2026-09-29', [], [/Versiones y desde cuándo se aplican/]],
  // Con los precios a la vista (PRECIOS), lo de IC2 e IC3; apagados, /precios
  // es «¿Cuánto cuesta? Te lo explicamos en persona» y no enseña nada de eso
  // (lo del bloqueo sigue en las condiciones, arriba).
  ...segunPrecios([
    ['/precios', '', [
      /Si no eliges cómo pagar, tu negocio puede bloquearse \(no se borra nada\)/,
      /Si no pagas, tu negocio puede bloquearse hasta que pagues: no se borra nada y puedes seguir validando lo que ya tiene la gente\. Si va a pasar, te avisamos 7 días y 1 día antes \(apartado 4 bis de las condiciones\)\./,
      /Hoy nadie puede pagar por salir antes\. De serie, el orden es «Recomendado» \(con el tiempo de hoy y los gustos de cada persona\) y cada persona puede cambiarlo en los filtros; cómo se ordena todo, también lo ya visto, está en el apartado 2 bis de las condiciones\. Ni la cuota ni el número de publicaciones cuentan en el orden\./,
    ], [
      /tu negocio se bloquea/,
      /el orden lo elige cada persona en los filtros/,
    ]],
    ['/en/pricing', '', [
      /If you don't choose how to pay, your business may be blocked \(nothing is deleted\)/,
      /If you don't pay, your business may be blocked until you do: nothing is deleted and you can still validate what people already have\. If it's going to happen, we remind you 7 days and 1 day before \(section 4a of the business terms\)\./,
      /Today nobody can pay to appear earlier\. By default the order is ‘Recommended’ \(with today's weather and each person's interests\) and anyone can change it in the filters; how everything is ordered, including what someone has already seen, is in section 2a of the business terms\. Neither the fee nor the number of publications affects the order\./,
    ], [
      /your business is blocked/,
      /the order is chosen by each person in the filters/,
    ]],
  ], [
    ['/precios', '', PRECIOS_APAGADO.es, [...NUNCA_PRECIO, /tu negocio se bloquea/]],
    ['/en/pricing', '', PRECIOS_APAGADO.en, [...NUNCA_PRECIO, /your business is blocked/]],
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
    if (/negocios|business-terms/.test(ruta) && pendientes) {
      // El enlace de la cabecera lleva al apartado.
      ok(await p.evaluate(() => !!document.querySelector('.meta a[href="#versiones"]') && document.getElementById('versiones')?.tagName === 'H2'),
        `${nombre}/${t} ${ruta}: la cabecera enlaza con #versiones`);
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
