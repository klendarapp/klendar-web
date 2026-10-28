// Las redes de Klendar en el pie de todas las páginas y en el kit de prensa
// (Iván, 2026-10-28), contra la web local y solo leyendo:
//  1. En páginas estáticas (portada, prensa, legales, «Tu cuenta») y dinámicas
//     (Descubre, Explorar, agenda), ES y EN: el pie lleva «Klendar en redes
//     sociales» con Instagram y TikTok (@klendar.app) y LinkedIn, cada uno con su nombre
//     accesible, en tinta y como enlace normal (sin target ni scripts de la red).
//  2. Nada de terceros incrustado: ni iframes ni scripts de instagram.com o
//     tiktok.com en ninguna de esas páginas.
//  3. La prensa (ES y EN) tiene su apartado «Redes» con los mismos enlaces.
//  4. La portada lleva `sameAs` con las dos en el JSON-LD de la organización.
//  5. En 360 px el pie no hace scroll horizontal y cada enlace mide 44 px de alto.
//
//   PORT=8793 node tools/serve_dev.mjs &
//   BASE=http://localhost:8793 PW=<ruta a playwright> node tools/redes_check.mjs
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8793';
const REDES = ['https://www.instagram.com/klendar.app/', 'https://www.tiktok.com/@klendar.app', 'https://www.linkedin.com/company/klendar-app/'];

let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK ' : 'MAL'} ${msg}`);
  if (!cond) fallos++;
};

const PAGINAS = [
  ['/', 'es'], ['/en/', 'en'], ['/prensa/', 'es'], ['/en/press/', 'en'],
  ['/privacidad/', 'es'], ['/en/terms/', 'en'], ['/precios/', 'es'],
  ['/app/', 'es'], ['/descubre/', 'es'], ['/en/explore/', 'en'], ['/agenda/', 'es'],
];

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const page = await ctx.newPage();
  for (const [ruta, lang] of PAGINAS) {
    const terceros = [];
    const escucha = (req) => {
      if (/instagram\.com|tiktok\.com|cdninstagram|tiktokcdn|linkedin\.com|licdn/.test(req.url())) terceros.push(req.url());
    };
    page.on('request', escucha);
    await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    page.off('request', escucha);
    const pie = await page.evaluate(() => {
      const nav = document.querySelector('footer nav.pie-redes');
      if (!nav) return null;
      const a = [...nav.querySelectorAll('a')];
      return {
        etiqueta: nav.getAttribute('aria-label'),
        enlaces: a.map((x) => ({
          href: x.getAttribute('href'),
          nombre: x.getAttribute('aria-label'),
          texto: x.textContent.trim(),
          target: x.getAttribute('target'),
          alto: x.getBoundingClientRect().height,
          color: getComputedStyle(x).color,
        })),
        iframes: document.querySelectorAll('iframe').length,
        scripts: [...document.scripts].map((s) => s.src).filter((s) => /instagram|tiktok/.test(s)),
        scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    ok(pie, `${ruta}: el pie lleva las redes`);
    if (!pie) continue;
    ok(pie.etiqueta === (lang === 'en' ? 'Klendar on social media' : 'Klendar en redes sociales'), `${ruta}: «${pie.etiqueta}»`);
    ok(JSON.stringify(pie.enlaces.map((e) => e.href)) === JSON.stringify(REDES), `${ruta}: Instagram, TikTok y LinkedIn`);
    for (const e of pie.enlaces) {
      ok(e.nombre.includes(e.texto) && (e.texto === 'LinkedIn' ? !e.nombre.includes('(') : e.nombre.includes('@klendar.app'))
        && e.nombre.startsWith(lang === 'en' ? 'Klendar on ' : 'Klendar en '), `${ruta}: nombre accesible «${e.nombre}»`);
      ok(!e.target, `${ruta}: ${e.texto} es un enlace normal`);
      ok(e.alto >= 44, `${ruta}: ${e.texto} mide ${e.alto} px de alto`);
      ok(!/255, 77, 109/.test(e.color), `${ruta}: ${e.texto} en tinta (${e.color})`);
    }
    ok(!pie.iframes && !pie.scripts.length && !terceros.length, `${ruta}: nada de Instagram ni TikTok incrustado ${terceros.slice(0, 2).join(' ')}`);
    ok(!pie.scroll, `${ruta}: sin scroll horizontal en 360 px`);
  }

  for (const [ruta, h] of [['/prensa/', 'Redes'], ['/en/press/', 'Social media']]) {
    await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' });
    const hrefs = await page.evaluate((titulo) => {
      const h2 = [...document.querySelectorAll('main h2')].find((x) => x.textContent.trim() === titulo);
      const p = h2 && h2.nextElementSibling && h2.nextElementSibling.nextElementSibling;
      return p ? [...p.querySelectorAll('a')].map((a) => a.getAttribute('href')) : null;
    }, h);
    ok(JSON.stringify(hrefs) === JSON.stringify(REDES), `${ruta}: apartado «${h}» con las dos redes`);
  }

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const sameAs = await page.evaluate(() => {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      const j = JSON.parse(s.textContent);
      const org = (j['@graph'] || [j]).find((x) => x['@type'] === 'Organization');
      if (org) return org.sameAs;
    }
    return null;
  });
  ok(JSON.stringify(sameAs) === JSON.stringify(REDES), 'portada: sameAs de la organización');
} finally {
  await browser.close();
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
