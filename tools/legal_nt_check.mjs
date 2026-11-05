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
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800). Solo HTML estático.
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_nt_check.mjs
//
// Con BASE=https://klendar.app … --en-vivo mira lo publicado (Supabase, simulado igual).
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

// [ruta, cabecera, lo que tiene que decir, lo que ya no, enlaces que tiene que haber]
const PAGINAS = [
  ['/normas/', 'Última actualización: 5 de noviembre de 2026 · Versión 2026-09-29', [
    /Para todo el mundo\s*Tolerancia cero\. En Klendar no se admite ningún contenido objetable ni ninguna conducta abusiva\. Lo retiramos y, según la gravedad, avisamos, suspendemos o damos de baja a quien lo publica\./,
    /Revisamos las denuncias en un plazo máximo de 72 horas \(24 horas si es contenido objetable, afecta a menores o es claramente ilegal\)\./,
    /En la app también puedes denunciar el perfil de una persona \(su nombre o su foto\), desde su reseña o desde tu lista de amigos\./,
    /Las preguntas a los negocios son anónimas, y siguen siéndolo: en la app puedes bloquear a quien ha hecho una pregunta sin llegar a saber quién es\. Solo dejas de ver sus preguntas: no cambia nada con tus amigos ni con las reseñas\. Si lo bloquea quien gestiona el negocio, además no puede volver a preguntarle\. No se le avisa\./,
    /5 de noviembre de 2026: Para todo el mundo: tolerancia cero con el contenido objetable y la conducta abusiva\./,
  ], [/24 horas si afectan a menores/], []],
  ['/en/community-guidelines/', 'Last updated: 5 November 2026 · Version 2026-09-29', [
    /For everyone\s*Zero tolerance\. Klendar doesn't allow objectionable content or abusive behaviour of any kind\. We remove it and, depending on how serious it is, we warn, suspend or close the account of whoever posted it\./,
    /We review reports within 72 hours at most \(24 hours if it's objectionable content, involves minors or is clearly illegal\)\./,
    /In the app you can also report someone's profile \(their name or photo\), from their review or your friends list\./,
    /Questions to businesses are anonymous, and they stay that way: in the app you can block whoever asked a question without ever finding out who they are\. You just stop seeing their questions: nothing changes with your friends or with reviews\. If someone who runs the business blocks them, they also can't ask it anything else\. They aren't told\./,
    /5 November 2026: For everyone: zero tolerance for objectionable content and abusive behaviour\./,
  ], [/24 hours if they involve minors/], []],
  ['/terminos/', 'Última actualización: 5 de noviembre de 2026 · Versión 2026-09-29', [
    /No hay ninguna tolerancia con el contenido objetable ni con las personas que abusan de otras: lo que incumple las Normas de la comunidad se retira y puede acabar en la suspensión o la baja de la cuenta\.\s*6\. Disponibilidad y cambios/,
    /5 de noviembre de 2026: Uso permitido \(apartado 5\): no hay ninguna tolerancia con el contenido objetable ni con las personas que abusan de otras\. Tus derechos y obligaciones no cambian, así que no hace falta volver a aceptarlos\./,
  ], [], ['main a[href="/normas/"]']],
  ['/en/terms/', 'Last updated: 5 November 2026 · Version 2026-09-29', [
    /There is no tolerance for objectionable content or for people who abuse others: anything that breaks the Community guidelines is removed and can lead to the account being suspended or closed\.\s*6\. Availability and changes/,
    /5 November 2026: Acceptable use \(section 5\): there is no tolerance for objectionable content or for people who abuse others\. Your rights and obligations don't change, so there's no need to accept them again\./,
  ], [], ['main a[href="/en/community-guidelines/"]']],
  ['/privacidad/', 'Última actualización: 5 de noviembre de 2026 · Versión 2026-09-29', [
    /y las personas que bloqueas y, si bloqueas a quien hizo una pregunta, ese bloqueo y en qué negocio preguntó \(nunca sabrás quién es; sale en la descarga de tus datos y se borra con tu cuenta\)/,
    /5 de noviembre de 2026: La fila «Amigos y planes» dice también que, si bloqueas a quien hizo una pregunta, guardamos ese bloqueo y en qué negocio preguntó\./,
  ], [], []],
  ['/en/privacy/', 'Last updated: 5 November 2026 · Version 2026-09-29', [
    /and the people you block and, if you block whoever asked a question, that block and which business they asked \(you'll never find out who they are; it's in your data download and is deleted with your account\)/,
    /5 November 2026: The “Friends and plans” row now also says that, if you block whoever asked a question, we keep that block and which business they asked\./,
  ], [], []],
];

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
