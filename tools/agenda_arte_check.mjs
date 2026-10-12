// La agenda pública sin foto (2026-10-12): lo importado de los ayuntamientos
// llega con la imagen genérica de su categoría y la web, en vez de enseñarla
// como foto, pinta el fondo del color de la categoría (`.tj-arte`), sin
// «Ver solo la foto». Mira la ficha `/o/`, Explorar con «Agenda pública» y
// Descubre, en Chromium y WebKit, móvil y escritorio. Guarda capturas en OUT.
//
//   PORT=8791 node tools/serve_dev.mjs &
//   OFFER=<id de un evento importado sin foto> OUT=<carpeta> node tools/agenda_arte_check.mjs
import { createRequire } from 'node:module';

// Playwright no es dependencia del repo: el de la caché de npx (PW=ruta) o el instalado.
const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8791';
const OFFER = process.env.OFFER;
const OUT = process.env.OUT || '.';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };
const GENERICA = 'img[src*="/business-images/agenda/"], video[poster*="/business-images/agenda/"]';

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    const p = await nav.newPage({ viewport: vp });
    const errores = [];
    p.on('pageerror', (e) => errores.push(e.message));

    await p.goto(`${BASE}/o/${OFFER}`, { waitUntil: 'networkidle' });
    ok(await p.locator('.ficha-arte .tj-arte svg').count() === 1, `${nombre}/${t} ficha: el color de la categoría`);
    ok(await p.locator(`.ficha ${GENERICA}`).count() === 0, `${nombre}/${t} ficha: la genérica no sale como foto`);
    ok(/business-images\/agenda\//.test(await p.locator('meta[property="og:image"]').getAttribute('content') || ''),
      `${nombre}/${t} ficha: la vista previa del enlace sigue teniendo imagen`);
    const fondo = await p.locator('.ficha-arte .tj-arte').evaluate((e) => getComputedStyle(e).backgroundImage);
    ok(/gradient/.test(fondo), `${nombre}/${t} ficha: fondo en degradado`);
    await p.screenshot({ path: `${OUT}/web-ficha-arte-${nombre}-${t}.png` });

    await p.goto(`${BASE}/explorar/?ciudad=madrid&agenda-publica=1`, { waitUntil: 'networkidle' });
    const n = await p.locator('.tj .tj-arte').count();
    ok(n > 0, `${nombre}/${t} explorar: ${n} tarjetas con el color de su categoría`);
    ok(await p.locator(`.tj ${GENERICA}`).count() === 0, `${nombre}/${t} explorar: ninguna genérica como foto`);
    await p.screenshot({ path: `${OUT}/web-explorar-arte-${nombre}-${t}.png` });

    // Descubre (una por pantalla): la tarjeta con el color, sin «Ver solo la foto».
    await p.goto(`${BASE}/descubre/?ciudad=madrid&agenda-publica=1`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    const pantalla = p.locator('.tj--pantalla').filter({ has: p.locator('.tj-arte') });
    const m = await pantalla.count();
    ok(m > 0, `${nombre}/${t} descubre: ${m} tarjetas con el color de su categoría`);
    if (m) {
      ok(await pantalla.first().locator('.tj-solo').count() === 0, `${nombre}/${t} descubre: sin «Ver solo la foto»`);
      await pantalla.first().scrollIntoViewIfNeeded();
      await p.waitForTimeout(300);
    }
    await p.screenshot({ path: `${OUT}/web-descubre-arte-${nombre}-${t}.png` });

    ok(errores.length === 0, `${nombre}/${t} sin errores JS ${errores.join(' | ')}`);
    await p.close();
  }
  await nav.close();
}
console.log(fallos ? `${fallos} fallo(s)` : 'Todo bien');
process.exit(fallos ? 1 : 0);
