// Prueba de la tanda B (entidades y agenda pública) en la web local:
// la ficha de un evento importado (sello, «Fuente», todo el día, noindex),
// Explorar con el filtro «Agenda pública», «Fuentes y licencias» y la ficha
// de la cuenta «Agenda pública de Madrid», en Chromium y WebKit, móvil y
// escritorio. Guarda capturas en OUT.
//
//   PORT=8791 node tools/serve_dev.mjs &
//   OFFER=<id de un evento importado> OUT=<carpeta> node tools/entidades_check.mjs
import { createRequire } from 'node:module';

// Playwright no es dependencia del repo: el de la caché de npx (PW=ruta) o el instalado.
const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8791';
const OFFER = process.env.OFFER;
const OUT = process.env.OUT || '.';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    const p = await nav.newPage({ viewport: vp });
    const errores = [];
    p.on('pageerror', (e) => errores.push(e.message));

    await p.goto(`${BASE}/o/${OFFER}`, { waitUntil: 'networkidle' });
    const html = await p.content();
    ok(html.includes('Agenda pública'), `${nombre}/${t} ficha: sello «Agenda pública»`);
    ok(html.includes('Fuente: Ayuntamiento de Madrid, datos.madrid.es'), `${nombre}/${t} ficha: atribución`);
    ok(html.includes('CC BY 4.0'), `${nombre}/${t} ficha: licencia`);
    ok(/name="robots" content="noindex/.test(html), `${nombre}/${t} ficha: noindex`);
    ok(!/00:00/.test(await p.locator('.ficha-datos').innerText()), `${nombre}/${t} ficha: sin «00:00»`);
    await p.screenshot({ path: `${OUT}/web-ficha-${nombre}-${t}.png`, fullPage: true });

    await p.goto(`${BASE}/explorar/?ciudad=madrid&agenda-publica=1`, { waitUntil: 'networkidle' });
    const n = await p.locator('.tj').count();
    ok(n > 0, `${nombre}/${t} explorar con «Agenda pública»: ${n} tarjetas`);
    await p.screenshot({ path: `${OUT}/web-explorar-agenda-${nombre}-${t}.png` });

    await p.goto(`${BASE}/fuentes/`, { waitUntil: 'networkidle' });
    ok((await p.locator('table tbody tr').count()) >= 2, `${nombre}/${t} fuentes: tabla`);
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    ok(ancho, `${nombre}/${t} fuentes: sin scroll horizontal`);
    await p.screenshot({ path: `${OUT}/web-fuentes-${nombre}-${t}.png`, fullPage: true });

    await p.goto(`${BASE}/en/sources/`, { waitUntil: 'networkidle' });
    ok((await p.content()).includes('Sources and licences'), `${nombre}/${t} sources (en)`);

    ok(errores.length === 0, `${nombre}/${t} sin errores JS ${errores.join(' | ')}`);
    await p.close();
  }
  await nav.close();
}
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
