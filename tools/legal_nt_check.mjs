// Prueba de lo publicado el 2026-11-05 de «Normas de las tiendas» (NT1–NT5,
// aprobados por Iván el 5-11; docs/LEGAL_PENDIENTE_2026-10.md, apartado NT), en
// la web local:
//
//  1. Normas (ES y EN): «Tolerancia cero» al principio de «Para todo el mundo»
//     (NT1); 72 horas y 24 si es contenido objetable, afecta a menores o es
//     claramente ilegal (NT3, la alternativa que eligió Iván); denunciar un
//     perfil y bloquear desde una pregunta (NT4). Fecha y línea en el historial.
//  2. Términos (ES y EN), apartado 5: ninguna tolerancia, con enlace a las Normas
//     (NT2). Fecha y línea en el historial; la versión sigue siendo la misma.
//  3. Privacidad (ES y EN), fila «Amigos y planes»: el bloqueo desde una pregunta
//     (NT5). Fecha y línea en el historial.
//  4. Sin desplazamiento horizontal ni errores de JavaScript.
//
// Y lo que se retuvo y se publicó después el mismo 5-11 (Iván: el destacado de pago
// no se vende hoy; N-14):
//
//  5. Normas (ES y EN), «Las medidas posibles»: retirar el nombre Y la foto (NT4).
//  6. Condiciones para negocios (ES y EN), 2 bis: «hoy no se vende ninguna posición»,
//     versión 2026-11-05, se aplica el 20-11-2026 (NT6.3), con su historial y el aviso.
//  7. Preguntas frecuentes (por-que-veo-esto y orden; NT6.2 y NT6.4), también en
//     assets/ayuda.json, que es lo que descarga la app.
//  8. Lo que no estaba en NT6: /precios, /para-negocios y /sobre, y whyText, recLine
//     y recSteps en las Functions (estos, en el código: sus páginas piden datos).
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800). Solo HTML estático.
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_nt_check.mjs
//
// Con BASE=https://klendar.app … --en-vivo mira lo publicado (Supabase, simulado igual).
import { readFileSync } from 'node:fs';
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

// Lo que ya no puede decir ninguna página de la web pública (fuera del historial).
const YA_NO_ES = [/va aparte y se pide por correo/, /Se pueden destacar publicaciones/, /Un negocio puede destacar/,
  /si un negocio paga por destacar/, /Lo destacado de pago sale primero/];
const YA_NO_EN = [/charged separately and you request it by email/, /Publications can be featured/, /A business can feature/,
  /if a business pays to feature/, /Paid featured placements come first/];

// [ruta, cabecera, lo que tiene que decir, lo que ya no, enlaces que tiene que haber]
const PAGINAS = [
  ['/normas', 'Última actualización: 5 de noviembre de 2026 · Versión 2026-09-29', [
    /Para todo el mundo\s*Tolerancia cero\. En Klendar no se admite ningún contenido objetable ni ninguna conducta abusiva\. Lo retiramos y, según la gravedad, avisamos, suspendemos o damos de baja a quien lo publica\./,
    /Revisamos las denuncias en un plazo máximo de 72 horas \(24 horas si es contenido objetable, afecta a menores o es claramente ilegal\)\./,
    /En la app también puedes denunciar el perfil de una persona \(su nombre o su foto\), desde su reseña o desde tu lista de amigos\./,
    /Las preguntas a los negocios son anónimas, y siguen siéndolo: en la app puedes bloquear a quien ha hecho una pregunta sin llegar a saber quién es\. Solo dejas de ver sus preguntas: no cambia nada con tus amigos ni con las reseñas\. Si lo bloquea quien gestiona el negocio, además no puede volver a preguntarle\. No se le avisa\./,
    /5 de noviembre de 2026: Para todo el mundo: tolerancia cero con el contenido objetable y la conducta abusiva\./,
    /Las medidas posibles son: retirar el contenido, retirar el nombre y la foto de un perfil, avisar, suspender temporalmente o dar de baja la cuenta o el negocio\./,
    /5 de noviembre de 2026: Las medidas posibles: también retirar el nombre y la foto de un perfil\./,
  ], [/24 horas si afectan a menores/, /el nombre o la foto de un perfil/], []],
  ['/en/community-guidelines', 'Last updated: 5 November 2026 · Version 2026-09-29', [
    /For everyone\s*Zero tolerance\. Klendar doesn't allow objectionable content or abusive behaviour of any kind\. We remove it and, depending on how serious it is, we warn, suspend or close the account of whoever posted it\./,
    /We review reports within 72 hours at most \(24 hours if it's objectionable content, involves minors or is clearly illegal\)\./,
    /In the app you can also report someone's profile \(their name or photo\), from their review or your friends list\./,
    /Questions to businesses are anonymous, and they stay that way: in the app you can block whoever asked a question without ever finding out who they are\. You just stop seeing their questions: nothing changes with your friends or with reviews\. If someone who runs the business blocks them, they also can't ask it anything else\. They aren't told\./,
    /5 November 2026: For everyone: zero tolerance for objectionable content and abusive behaviour\./,
    /Possible measures: remove the content, remove a profile's name and photo, issue a warning, temporarily suspend, or close the account or business\./,
    /5 November 2026: Possible measures: also removing a profile's name and photo\./,
  ], [/24 hours if they involve minors/, /profile's name or photo/], []],
  ['/terminos', 'Última actualización: 5 de noviembre de 2026 · Versión 2026-09-29', [
    /No hay ninguna tolerancia con el contenido objetable ni con las personas que abusan de otras: lo que incumple las Normas de la comunidad se retira y puede acabar en la suspensión o la baja de la cuenta\.\s*6\. Disponibilidad y cambios/,
    /5 de noviembre de 2026: Uso permitido \(apartado 5\): no hay ninguna tolerancia con el contenido objetable ni con las personas que abusan de otras\. Tus derechos y obligaciones no cambian, así que no hace falta volver a aceptarlos\./,
  ], [], ['main a[href="/normas"]']],
  ['/en/terms', 'Last updated: 5 November 2026 · Version 2026-09-29', [
    /There is no tolerance for objectionable content or for people who abuse others: anything that breaks the Community guidelines is removed and can lead to the account being suspended or closed\.\s*6\. Availability and changes/,
    /5 November 2026: Acceptable use \(section 5\): there is no tolerance for objectionable content or for people who abuse others\. Your rights and obligations don't change, so there's no need to accept them again\./,
  ], [], ['main a[href="/en/community-guidelines"]']],
  ['/privacidad', 'Última actualización: 11 de noviembre de 2026 · Versión 2026-09-29', [
    /y las personas que bloqueas y, si bloqueas a quien hizo una pregunta, ese bloqueo y en qué negocio preguntó \(nunca sabrás quién es; sale en la descarga de tus datos y se borra con tu cuenta\)/,
    /5 de noviembre de 2026: La fila «Amigos y planes» dice también que, si bloqueas a quien hizo una pregunta, guardamos ese bloqueo y en qué negocio preguntó\./,
  ], [], []],
  ['/en/privacy', 'Last updated: 11 November 2026 · Version 2026-09-29', [
    /and the people you block and, if you block whoever asked a question, that block and which business they asked \(you'll never find out who they are; it's in your data download and is deleted with your account\)/,
    /5 November 2026: The “Friends and plans” row now also says that, if you block whoever asked a question, we keep that block and which business they asked\./,
  ], [], []],
  ['/negocios', 'Última actualización: 11 de noviembre de 2026 · Versión 2026-11-05', [
    /\(1\) hoy no se vende ninguna posición: si algún día se ofrece destacar publicaciones de pago, saldrán primero en Descubre y en la lista de Explorar, siempre con la etiqueta «Destacado», y lo avisaremos antes con el plazo de estas condiciones; en las selecciones/,
    /los del 5 de noviembre de 2026 \(apartado 2 bis\), desde el 20 de noviembre de 2026:/,
    /2026-11-05\s+5-11-2026\s+20-11-2026\s+2026-11-04\s+4-11-2026\s+19-11-2026/,
    /5 de noviembre de 2026: Cómo se ordena lo que se ve \(apartado 2 bis\): hoy no se vende ninguna posición;[^\n]*?Se aplica desde el 20 de noviembre de 2026\./,
  ], [/\(1\) en Descubre y en la lista de Explorar, lo destacado de pago/], []],
  ['/en/business-terms', 'Last updated: 11 November 2026 · Version 2026-11-05', [
    /\(1\) no position is sold today: if paid featured publications are ever offered, they will come first in Discover and the Explore list, always labelled “Featured”, and we'll give notice first within the period in these terms; in the collections/,
    /those of 5 November 2026 \(section 2a\) from 20 November 2026:/,
    /2026-11-05\s+5 Nov 2026\s+20 Nov 2026\s+2026-11-04\s+4 Nov 2026\s+19 Nov 2026/,
    /5 November 2026: How what people see is ordered \(section 2a\): no position is sold today;[^\n]*?It applies from 20 November 2026\./,
  ], [/\(1\) in Discover and in the Explore list, paid featured placements/], []],
  ['/preguntas', '¿Por qué veo unas cosas y no otras?', [
    /Hoy nadie paga por salir antes\. Lo que ves va en el orden que elijas en Filtros \(☰\), arriba del todo: «Ordenar por»\./,
    /no ponemos tu oferta por delante de otra porque pagues más[\s\S]*?Hoy no se vende destacar publicaciones; si algún día se puede, se dirá en cada una\./,
  ], YA_NO_ES, []],
  ['/en/faq', 'Why do I see some things and not others?', [
    /Today nobody pays to appear earlier\. What you see comes in the order you choose in Filters \(☰\), at the very top: “Sort by”\./,
    /we don't put your offer ahead of another because you pay more[\s\S]*?Featuring publications isn't sold today; if it ever is, each one will say so\./,
  ], YA_NO_EN, []],
  ['/precios', 'Nunca cobramos por canje', [
    /Hoy nadie puede pagar por salir antes\. De serie, el orden es «Recomendado»/,
    /Ni la cuota ni el número de publicaciones cuentan en el orden\./,
  ], [...YA_NO_ES, /Qué es un «destacado»/, /más allá de eso/], []],
  ['/en/pricing', 'We never charge per redemption', [
    /Today nobody can pay to appear earlier\. By default the order is ‘Recommended’/,
    /Neither the fee nor the number of publications affects the order\./,
  ], [...YA_NO_EN, /What “featured” means/, /beyond that/], []],
  ['/para-negocios', 'Lo que no hacemos', [
    /la cuota no cuenta\. Hoy no se vende destacar publicaciones; si algún día se puede, se dirá en cada una\./,
  ], YA_NO_ES, []],
  ['/en/for-business', "What we don't do", [
    /your plan doesn't count\. Featuring publications isn't sold today; if it ever is, each one will say so\./,
  ], YA_NO_EN, []],
  ['/sobre', 'Lo que no vamos a hacer', [
    /no hay publicidad de terceros\. Hoy nadie puede pagar por salir antes\./,
    /Colar lo pagado sin decirlo: hoy nadie puede pagar por salir antes y, si algún día se puede, se dirá en cada publicación\. El orden no depende de pagar: lo marcan tus filtros,/,
  ], YA_NO_ES, []],
  ['/en/about', 'Sneak in paid placements', [
    /there's no third-party advertising\. Today nobody can pay to appear earlier\./,
    /Sneak in paid placements: today nobody can pay to appear earlier and, if that ever changes, each publication will say so\. The order doesn't depend on paying: it comes from your filters,/,
  ], YA_NO_EN, []],
];

// Lo que no se ve sin datos: las Functions y la copia de la ayuda para la app, en el código.
const raiz = new URL('../', import.meta.url);
const views = readFileSync(new URL('functions/_lib/views.js', raiz), 'utf8');
const explore = readFileSync(new URL('functions/_lib/explore.js', raiz), 'utf8');
const ayudaApp = readFileSync(new URL('assets/ayuda.json', raiz), 'utf8');
ok(views.includes('Hoy nadie paga por salir antes. El orden lo eliges en «Ordenar por».'), 'whyText ES');
ok(views.includes('Today nobody pays to appear earlier. You choose the order in “Sort by”.'), 'whyText EN');
ok(!/Lo destacado de pago sale primero|Paid featured publications come first/.test(views), 'whyText ya no habla de pago');
ok(views.includes("boostedBadge: 'Destacado'") && views.includes("boostedBadge: 'Featured'"), 'la etiqueta sigue por si algún día se vende');
ok(!/destacado de pago|Paid featured/i.test(explore.split('\n').filter((l) => /recLine|recSteps/.test(l)).join('\n')), 'recLine y recSteps ya no hablan de pago');
ok(explore.includes("recLine: 'Lo más nuevo cerca y, si dejas encendidas sus casillas, según el tiempo y tus gustos.'"), 'recLine ES');
ok(explore.includes("recLine: 'The newest nearby and, if you leave their boxes ticked, based on the weather and what you like.'"), 'recLine EN');
ok(ayudaApp.includes('Hoy nadie paga por salir antes. Lo que ves va en el orden que elijas') && ayudaApp.includes('Today nobody pays to appear earlier. What you see comes in the order you choose'), 'assets/ayuda.json: por-que-veo-esto');
ok(!/Lo destacado de pago|Paid featured/.test(ayudaApp), 'assets/ayuda.json ya no habla de pago');

async function paginas(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(`${p.url()}: ${e.message}`));
  for (const [ruta, cabecera, esperas, nunca, enlaces] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const txt = `${await p.locator('body').innerText()}
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    ok(txt.includes(cabecera), `${nombre}/${t} ${ruta}: «${cabecera}»`);
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
