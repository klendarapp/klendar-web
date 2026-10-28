// Prueba de lo publicado el 2026-10-28 y el 2026-10-29 (RS1 y RS4, aprobados
// por Iván; los perfiles de Klendar en Instagram, TikTok y LinkedIn), en la
// web local:
//
//  1. Privacidad (ES y EN): el párrafo «Klendar en redes sociales» detrás del
//     de MET Norway e historias, con la corresponsabilidad y el correo, y su
//     línea en el historial.
//  2. El pie enlaza los dos perfiles (@klendar.app) con enlaces normales y la
//     página no carga nada de Instagram ni de TikTok (ni scripts, ni iframes,
//     ni peticiones): lo que dice el párrafo.
//  3. Sin desplazamiento horizontal.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_rs_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8871';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/privacidad/', [
    /la trata esa red como responsable independiente, con sus propias condiciones\.\s*Klendar en redes sociales\. Tenemos perfiles en Instagram, TikTok y LinkedIn\. En la web y en la app solo hay enlaces normales a ellos/,
    /\(Meta Platforms Ireland Limited para Instagram, TikTok Technology Limited para TikTok y LinkedIn Ireland Unlimited Company para LinkedIn\)/,
    /para las de Instagram somos corresponsables con Meta según su anexo de corresponsabilidad, y lo mismo con TikTok y con LinkedIn para las suyas\./,
    /aunque también puedes escribirnos a info@klendar\.app\. Lo que nos cuentes por mensaje privado lo usamos solo para contestarte \(interés legítimo, art\. 6\.1\.f RGPD\) y no lo unimos a tu cuenta de Klendar\./,
    /28 de octubre de 2026: Perfiles de Klendar en Instagram y TikTok/,
    /29 de octubre de 2026: Perfil de Klendar en LinkedIn: solo un enlace/,
  ]],
  ['/en/privacy/', [
    /under its own terms\.\s*Klendar on social media\. We have profiles on Instagram, TikTok and LinkedIn\. The website and the app only contain ordinary links to them/,
    /for Instagram's we are joint controllers with Meta under its joint controller addendum, and likewise with TikTok and LinkedIn for their own\./,
    /but you can also email us at info@klendar\.app\./,
    /28 October 2026: Klendar's profiles on Instagram and TikTok/,
    /29 October 2026: Klendar's page on LinkedIn: just a link/,
  ]],
];

const DE_REDES = /instagram\.com|cdninstagram|tiktok\.com|tiktokcdn|facebook\.(com|net)|fbcdn|linkedin\.com|licdn\.com/;

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  const pedidas = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('request', (r) => { if (DE_REDES.test(r.url())) pedidas.push(r.url()); });
  for (const [ruta, esperas] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`, { waitUntil: 'load' });
    const txt = `${await p.locator('body').innerText()}
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    ok(await p.locator('.pie-redes a[href="https://www.instagram.com/klendar.app/"]').count() === 1, `${nombre}/${t} ${ruta}: enlace a Instagram en el pie`);
    ok(await p.locator('.pie-redes a[href="https://www.tiktok.com/@klendar.app"]').count() === 1, `${nombre}/${t} ${ruta}: enlace a TikTok en el pie`);
    ok(await p.locator('.pie-redes a[href="https://www.linkedin.com/company/klendar-app/"]').count() === 1, `${nombre}/${t} ${ruta}: enlace a LinkedIn en el pie`);
    ok(await p.evaluate((re) => ![...document.querySelectorAll('script[src], iframe[src], img[src], link[href]')]
      .some((el) => new RegExp(re).test(el.getAttribute('src') || el.getAttribute('href') || '')), DE_REDES.source),
    `${nombre}/${t} ${ruta}: nada incrustado de las redes`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0),
      `${nombre}/${t} ${ruta}: sin desplazamiento horizontal`);
  }
  ok(pedidas.length === 0, `${nombre}/${t}: ninguna petición a Instagram, TikTok ni LinkedIn (${pedidas.join(' | ')})`);
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
