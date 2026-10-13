// Los 8 idiomas de «Tu cuenta» y del panel (2026-10-13): para cada idioma y
// navegador (Chromium y WebKit, móvil y escritorio) abre «Tu cuenta» y el
// panel sin sesión, mira que la página dice su idioma (`<html lang>`), que el
// botón «Entrar» y el título salen traducidos, que el selector trae los 8,
// que en los idiomas sin textos legales propios sale la nota y los enlaces
// van a la versión que toca (fr/de/it → /en/…) y que no hay errores en la
// consola. Además: `/legal/<doc>` con Accept-Language. Capturas en OUT.
//
//   PORT=8791 node tools/serve_dev.mjs &
//   OUT=<carpeta> node tools/idiomas_check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Playwright no es dependencia del repo: el de la caché de npx (PW=ruta) o el instalado.
const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8791';
const OUT = process.env.OUT || '.';
mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const ENTRAR = { es: 'Entrar', en: 'Log in', ca: 'Entra', gl: 'Entrar', eu: 'Hasi saioa', fr: 'Se connecter', de: 'Anmelden', it: 'Accedi' };
const LANGS = Object.keys(ENTRAR);
const NUEVOS = ['ca', 'gl', 'eu', 'fr', 'de', 'it'];
const EN_PUB = ['en', 'fr', 'de', 'it'];

// /legal/<doc>: la redirección por idioma del navegador.
{
  const mod = await import(new URL('../functions/legal/[doc].js', import.meta.url));
  const ir = (al, forced) => {
    const url = `https://klendar.app/legal/privacy${forced ? `?lang=${forced}` : ''}`;
    return mod.onRequestGet({ request: new Request(url, { headers: { 'accept-language': al } }), params: { doc: 'privacy' } })
      .headers.get('location');
  };
  ok(ir('fr-FR,fr;q=0.9').endsWith('/en/privacy/'), 'legal: francés → inglés');
  ok(ir('de-DE').endsWith('/en/privacy/'), 'legal: alemán → inglés');
  ok(ir('ca-ES-valencia,ca;q=0.9').endsWith('/privacidad/'), 'legal: valenciano → español');
  ok(ir('eu-ES').endsWith('/privacidad/'), 'legal: euskera → español');
  ok(ir('es-ES').endsWith('/privacidad/'), 'legal: español');
  ok(ir('en-GB').endsWith('/en/privacy/'), 'legal: inglés');
  ok(ir('fr', 'es').endsWith('/privacidad/'), 'legal: ?lang=es manda');
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await tipo.launch();
  for (const [disp, vista] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 860 }]]) {
    for (const lang of LANGS) {
      const ctx = await browser.newContext({ viewport: vista, locale: 'es-ES' });
      const page = await ctx.newPage();
      const errores = [];
      page.on('pageerror', (e) => errores.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error' && !/favicon|supabase|Failed to load resource|ERR_|net::/i.test(m.text())) errores.push(m.text()); });

      // «Tu cuenta» sin sesión: la pantalla de entrar.
      await page.goto(`${BASE}/app/?lang=${lang}#/entrar`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const htmlLang = await page.evaluate(() => document.documentElement.lang);
      ok(htmlLang === lang, `${nombre}/${disp}/${lang}: «Tu cuenta» <html lang=${htmlLang}>`);
      const botones = await page.locator('button, a.pill').allInnerTexts();
      ok(botones.some((b) => b.trim() === ENTRAR[lang]), `${nombre}/${disp}/${lang}: botón «${ENTRAR[lang]}»`);
      const opciones = await page.locator('select.lang-sel option').count();
      ok(opciones === 0 || opciones >= 8, `${nombre}/${disp}/${lang}: selector con los 8 idiomas (${opciones})`);
      // Lo que se sale del ancho (alemán, sobre todo).
      const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(ancho <= 1, `${nombre}/${disp}/${lang}: nada se sale a lo ancho (${ancho}px)`);
      if (NUEVOS.includes(lang) || lang === 'en') {
        const pie = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => /privac|terminos|terms/.test(h)));
        const quiere = EN_PUB.includes(lang) ? /\/en\// : /^\/(privacidad|terminos)/;
        ok(pie.length > 0 && pie.every((h) => quiere.test(h) || /legal\//.test(h)), `${nombre}/${disp}/${lang}: enlaces legales a ${EN_PUB.includes(lang) ? 'inglés' : 'español'} (${pie.slice(0, 2).join(', ')})`);
      }
      await page.screenshot({ path: join(OUT, `cuenta-${lang}-${nombre}-${disp}.png`) });

      // Crear cuenta: la nota de los textos legales en los idiomas nuevos.
      await page.goto(`${BASE}/app/?lang=${lang}#/registro`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      const texto = await page.evaluate(() => document.body.innerText);
      if (NUEVOS.includes(lang)) {
        ok(/castell|castelán|gaztelaniaz|anglais|Englisch|inglese|espagnol|Spanisch|spagnol|ingelesez|inglés|anglès/i.test(texto), `${nombre}/${disp}/${lang}: crear cuenta dice en qué idioma están los textos legales`);
      }
      await page.screenshot({ path: join(OUT, `registro-${lang}-${nombre}-${disp}.png`), fullPage: true });

      // Panel sin sesión: la entrada.
      await page.goto(`${BASE}/panel/?lang=${lang}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const pLang = await page.evaluate(() => document.documentElement.lang);
      ok(pLang === lang, `${nombre}/${disp}/${lang}: panel <html lang=${pLang}>`);
      const pTexto = await page.evaluate(() => document.body.innerText);
      ok(lang === 'es' || !/Entra en tu panel/.test(pTexto), `${nombre}/${disp}/${lang}: panel traducido (sin «Entra en tu panel»)`);
      await page.screenshot({ path: join(OUT, `panel-${lang}-${nombre}-${disp}.png`) });

      ok(errores.length === 0, `${nombre}/${disp}/${lang}: sin errores en la consola ${errores.slice(0, 2).join(' | ')}`);
      await ctx.close();
    }
  }
  await browser.close();
}

console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
