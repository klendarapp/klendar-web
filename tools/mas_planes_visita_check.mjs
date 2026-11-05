// «Más planes en Marbella» solo para esa visita (Iván, 2026-11-03, revisión
// 1.6; igual que la app, `test/features/business/ficha_municipio_test.dart`):
//
//  1. El enlace de la ficha lleva a `/descubre/?ciudad=<slug>&visita=1`
//     (`/en/discover/?city=<slug>&visit=1`).
//  2. «¿Dónde?» dice ese municipio, pero lo guardado (`klendar.filtros`)
//     sigue con la zona de siempre: «Todas las ciudades», «Cerca de mí» (con
//     su posición) o una ciudad.
//  3. El aviso de una línea: «Volver a todas las ciudades», «Volver a cerca
//     de mí», «Volver a Málaga» o «Volver a Alcañiz» (EN «Back to …»); lleva a la zona de
//     siempre. La × solo lo quita.
//  4. Cambiar otro filtro sigue en la visita (los enlaces llevan `visita=1`);
//     elegir una zona en «¿Dónde?», no (esa sí se guarda).
//  5. Al salir y volver (Descubre sin nada en la dirección), la de siempre.
//  6. Sin desplazamiento horizontal ni errores de JavaScript.
//
// Chromium y WebKit, móvil (390 × 844). Contra la base de dev:
//
//   SUPABASE_BLOQUEADO=1 PORT=8877 node tools/serve_dev.mjs &
//   BASE=http://localhost:8877 PW=<ruta a playwright> node tools/mas_planes_visita_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8877';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const guardado = (p, L = 'es') => p.evaluate((l) => {
  try { return (JSON.parse(localStorage.getItem('klendar.filtros') || 'null') || {})[l] || ''; } catch { return ''; }
}, L);
const donde = (p) => p.locator('.barra-preg .chip-t').first().innerText();
const aviso = (p) => p.locator('#visita:not([hidden]) .feed-aviso-t span:not([aria-hidden])').first();

async function visita(p, ficha, frase, destino) {
  await p.goto(`${BASE}${ficha}`, { waitUntil: 'domcontentloaded' });
  const a = p.locator('.mas-planes a.pill');
  ok((await a.getAttribute('href')) === destino, `${ficha}: «${frase}» lleva a ${destino}`);
  await Promise.all([p.waitForURL((u) => u.search.includes('isit')), a.click()]);
  await p.waitForLoadState('networkidle').catch(() => {});
}

async function caso(nav, nombre) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));

  // A. Lo de siempre, «Todas las ciudades».
  await p.goto(`${BASE}/descubre/?todas=1`, { waitUntil: 'domcontentloaded' });
  ok((await guardado(p)).includes('todas=1'), `${nombre}: guardado «Todas las ciudades»`);
  await visita(p, '/b/nails-co-madrid', 'Más planes en Madrid', '/descubre/?ciudad=madrid&visita=1');
  ok(new URL(p.url()).searchParams.get('ciudad') === 'madrid', `${nombre}: Descubre en Madrid`);
  ok((await donde(p)).includes('Madrid'), `${nombre}: «¿Dónde?» dice Madrid`);
  const g1 = await guardado(p);
  ok(g1.includes('todas=1') && !g1.includes('ciudad='), `${nombre}: lo guardado sigue en «Todas las ciudades» (${g1})`);
  await aviso(p).waitFor({ timeout: 8000 });
  ok((await aviso(p).innerText()) === 'Volver a todas las ciudades', `${nombre}: aviso «Volver a todas las ciudades»`);
  ok(/Viendo Madrid solo esta vez\. Volver a todas las ciudades/.test(await p.locator('#visita [data-visita-volver]').getAttribute('aria-label')),
    `${nombre}: el lector dice «Viendo Madrid solo esta vez»`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0),
    `${nombre}: sin desplazamiento horizontal`);
  // Otro filtro sigue en la visita; elegir zona, no.
  const hrefs = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
  const cuando = hrefs.filter((h) => /[?&]cuando=/.test(h) && h.startsWith('/descubre/'));
  ok(cuando.length > 0 && cuando.every((h) => h.includes('visita=1')), `${nombre}: los enlaces de ¿Cuándo? siguen en la visita (${cuando.length})`);
  const zonas = hrefs.filter((h) => h.startsWith('/descubre/?ciudad=') && !h.includes('cuando=')).filter((h) => !h.includes('ciudad=madrid&visita'));
  ok(zonas.length > 0 && zonas.every((h) => !h.includes('visita=1')), `${nombre}: elegir una zona acaba la visita (${zonas.length})`);
  // Con otro filtro, lo guardado coge el filtro, no la zona.
  await p.goto(`${BASE}${cuando.find((h) => h.includes('cuando=hoy')) || cuando[0]}`, { waitUntil: 'domcontentloaded' });
  const g2 = await guardado(p);
  ok(g2.includes('todas=1') && g2.includes('cuando=') && !g2.includes('ciudad='), `${nombre}: ¿Cuándo? se guarda, la zona no (${g2})`);
  // La ×: quita el aviso, la visita sigue.
  await aviso(p).waitFor({ timeout: 8000 });
  await p.locator('#visita [data-visita-x]').click();
  ok(await p.locator('#visita').isHidden(), `${nombre}: la × quita el aviso`);
  ok(new URL(p.url()).searchParams.get('ciudad') === 'madrid', `${nombre}: … y sigue en Madrid`);
  // Al salir y volver: la de siempre.
  await p.goto(`${BASE}/descubre/`, { waitUntil: 'domcontentloaded' });
  await p.waitForURL((u) => u.search.includes('todas=1'), { timeout: 8000 }).catch(() => {});
  ok(new URL(p.url()).searchParams.get('todas') === '1' && !new URL(p.url()).searchParams.get('ciudad'),
    `${nombre}: al volver a Descubre, «Todas las ciudades» (${new URL(p.url()).search})`);

  // B. Lo de siempre, una ciudad (Málaga): «Volver a Málaga» lleva allí.
  await p.goto(`${BASE}/descubre/?ciudad=malaga`, { waitUntil: 'domcontentloaded' });
  await visita(p, '/b/nails-co-madrid', 'Más planes en Madrid', '/descubre/?ciudad=madrid&visita=1');
  await aviso(p).waitFor({ timeout: 8000 });
  ok((await aviso(p).innerText()) === 'Volver a Málaga', `${nombre}: aviso «Volver a Málaga»`);
  await Promise.all([p.waitForURL((u) => u.searchParams.get('ciudad') === 'malaga', { timeout: 10000 }).catch(() => {}),
    p.locator('#visita [data-visita-volver]').click()]);
  ok(new URL(p.url()).searchParams.get('ciudad') === 'malaga' && !new URL(p.url()).searchParams.get('visita'),
    `${nombre}: «Volver a Málaga» vuelve a Málaga (${new URL(p.url()).search})`);
  ok((await donde(p)).includes('Málaga'), `${nombre}: «¿Dónde?» dice Málaga`);

  // B2. Un municipio que no es de las Populares: su nombre, de la base.
  await p.goto(`${BASE}/descubre/?ciudad=alcaniz`, { waitUntil: 'domcontentloaded' });
  await visita(p, '/b/nails-co-madrid', 'Más planes en Madrid', '/descubre/?ciudad=madrid&visita=1');
  await aviso(p).waitFor({ timeout: 8000 });
  ok((await aviso(p).innerText()) === 'Volver a Alcañiz', `${nombre}: aviso «Volver a Alcañiz» (resolve_municipality)`);

  // C. Lo de siempre, «Cerca de mí» (con su posición): «Volver a cerca de mí».
  await p.goto(`${BASE}/descubre/?lat=36.721&lng=-4.421`, { waitUntil: 'domcontentloaded' });
  await visita(p, '/b/nails-co-madrid', 'Más planes en Madrid', '/descubre/?ciudad=madrid&visita=1');
  await aviso(p).waitFor({ timeout: 8000 });
  ok((await aviso(p).innerText()) === 'Volver a cerca de mí', `${nombre}: aviso «Volver a cerca de mí»`);
  const g3 = await guardado(p);
  ok(g3.includes('lat=36.721') && !g3.includes('ciudad='), `${nombre}: lo guardado sigue con tu posición (${g3})`);
  await Promise.all([p.waitForURL((u) => u.search.includes('lat='), { timeout: 10000 }).catch(() => {}),
    p.locator('#visita [data-visita-volver]').click()]);
  ok(new URL(p.url()).searchParams.get('lat') === '36.721', `${nombre}: «Volver a cerca de mí» vuelve a tu posición`);

  // D. En inglés.
  await p.goto(`${BASE}/en/discover/?todas=1`, { waitUntil: 'domcontentloaded' });
  await visita(p, '/en/b/nails-co-madrid', 'More plans in Madrid', '/en/discover/?city=madrid&visit=1');
  await aviso(p).waitFor({ timeout: 8000 });
  ok((await aviso(p).innerText()) === 'Back to every city', `${nombre}: EN «Back to every city»`);
  ok((await guardado(p, 'en')).includes('todas=1'), `${nombre}: EN lo guardado sigue igual`);

  ok(errores.length === 0, `${nombre}: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  await caso(nav, nombre);
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
