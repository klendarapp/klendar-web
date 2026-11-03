// Prueba de lo publicado el 2026-11-02 (VI1–VI4, aprobados por Iván el 29-10;
// lo ya visto, al final, con el interruptor «Poner al final lo que ya he
// visto»), en la web local:
//
//  1. Condiciones para negocios (ES y EN), 2 bis / 2a: el criterio nuevo (2)
//     de lo ya visto, la numeración (3) y (4), «también dentro de cada uno de
//     los dos bloques del punto 2», el aviso de arriba (2-11, desde el
//     17-11) y el historial (VI1).
//  2. Privacidad (ES y EN): la fila «Lo que ya has visto en Descubre» detrás
//     de «Búsquedas», con el interruptor (VI2), y el historial.
//  3. Cookies (ES y EN): la fila `klendar.vistos` detrás de
//     `klendar.busquedas`, «off» y «Preferencia elegida por ti» (VI3).
//  4. Pregunta frecuente (ES y EN): lo ya visto, al final, y dónde se apaga
//     (VI4).
//  5. Sin desplazamiento horizontal.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_vi_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8871';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/negocios/', 'Última actualización: 3 de noviembre de 2026', [
    /\(2\) en Descubre y en la lista de Explorar, lo que la persona aún no ha visto va antes que lo que ya ha visto en ese mismo dispositivo en los últimos 7 días, que sale después, en el mismo orden y tras una separación \(«Ya has visto todo lo nuevo · Esto ya lo viste»\)\./,
    /Una publicación cuenta como vista cuando ha estado al menos 1,5 segundos seguidos en la pantalla[\s\S]*?Lo que ha visto cada persona se guarda solo en su dispositivo y Klendar no lo recibe; no esconde nada ni cambia qué publicaciones se ven; \(3\) el orden que elige la persona en «Ordenar por»\./,
    /\(4\) los eventos que Klendar importa[\s\S]*?\(también dentro de cada uno de los dos bloques del punto 2\)/,
    /los del 2 de noviembre de 2026 \(apartado 2 bis\), desde el 17 de noviembre de 2026, y los del 3 de noviembre de 2026 \(apartados 3, 3 decies y 4\), desde el 18 de noviembre de 2026: 15 días/,
    /2 de noviembre de 2026: Cómo se ordena lo que se ve \(apartado 2 bis\)[\s\S]*?Se aplica desde el 17 de noviembre de 2026\./,
  ]],
  ['/en/business-terms/', 'Last updated: 3 November 2026', [
    /\(2\) in Discover and in the Explore list, what the person hasn't seen yet comes before what they have already seen on that same device in the last 7 days/,
    /What each person has seen is stored only on their device and Klendar doesn't receive it; it doesn't hide anything or change which publications are shown; \(3\) the order the person chooses in “Sort by”\./,
    /\(also within each of the two groups in point 2\)/,
    /those of 2 November 2026 \(section 2a\) from 17 November 2026, and those of 3 November 2026 \(sections 3, 3i and 4\) from 18 November 2026: 15 days/,
    /“Food served now”/,
  ]],
  ['/privacidad/', 'Última actualización: 3 de noviembre de 2026', [
    /Lo que ya has visto en Descubre\s+Qué publicaciones de Descubre \(y, en la web, de la lista de Explorar\) has tenido en pantalla al menos 1,5 segundos[\s\S]*?Se guarda solo en tu móvil o en tu navegador; no nos llega/,
    /Puedes apagarlo en Ajustes › Lo que ves \(en la web, también sin entrar\): entonces no se guarda nada y se borra lo guardado\s+No lo tratamos nosotros \(está en tu dispositivo\)\s+7 días desde que viste cada publicación/,
    /2 de noviembre de 2026: Lo que ya has visto en Descubre/,
  ]],
  ['/en/privacy/', 'Last updated: 3 November 2026', [
    /What you've already seen in Discover\s+Which publications in Discover[\s\S]*?It's stored only on your phone or in your browser; it never reaches us/,
    /You can turn it off in Settings › What you see \(on the website, also without logging in\): then nothing is stored and what was stored is deleted/,
  ]],
  ['/cookies/', 'Última actualización: 2 de noviembre de 2026', [
    /klendar\.busquedas[\s\S]*?klendar\.vistos\s+Descubre y Explorar \(almacenamiento local\)\s+Qué publicaciones has visto[\s\S]*?No se envía a Klendar\. Se apaga en «Tu cuenta» → Ajustes → Lo que ves \(«Poner al final lo que ya he visto»\), también sin entrar\s+7 días desde que viste cada una \(como mucho 2\.000\); si apagas «Poner al final lo que ya he visto», solo guarda «off»\s+Preferencia elegida por ti/,
    /2 de noviembre de 2026: Una clave más: klendar\.vistos/,
  ]],
  ['/en/cookies/', 'Last updated: 2 November 2026', [
    /klendar\.vistos\s+Discover and Explore \(local storage\)[\s\S]*?It's not sent to Klendar\. Turn it off in “Your account” → Settings → What you see \(“Put what I've already seen at the end”\), also without logging in\s+7 days from when you saw each one \(at most 2,000\); if you turn off “Put what I've already seen at the end”, it only stores “off”\s+Preference you chose/,
  ]],
  ['/preguntas/', '', [/Al volver a cargar Descubre, lo que ya viste en los últimos 7 días pasa al final, detrás de «Ya has visto todo lo nuevo»;[\s\S]*?\(se apaga en Ajustes → Lo que ves\)\./]],
  ['/en/faq/', '', [/When you reload Discover, what you've seen in the last 7 days moves to the end, after “You've seen everything new”;[\s\S]*?\(turn it off in Settings → What you see\)\./]],
];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const txt = `${await p.locator('body').innerText()}
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    if (fecha) ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
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
