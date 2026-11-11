// Los tipos de negocio en la web (migración 20261275100000 de la app; GLOSARIO
// «Categorías» y «Qué ve cada tipo de negocio»), con datos de mentira
// (tools/_web_con_datos.mjs) y las 96 categorías de assets/categorias.js:
//  1. Los diez grupos y su nombre en los 8 idiomas; cada slug con su grupo y
//     su icono en la cuadrícula (functions/_lib/iconos-cat.js) y en el mapa
//     (assets/iconos-mapa.js).
//  2. ¿Qué? de Explorar: cada grupo con más de 7 enseña sus 6 primeras y
//     «N más» (un <details>) con el resto; una elegida que estaba en el resto
//     sale fuera; al abrir «N más» se ven todas.
//  3. Sin errores en la consola.
// Chromium, móvil (375) y escritorio. Capturas en OUT.
//
//   PW=<ruta a playwright> OUT=<carpeta> node tools/tipos_negocio_check.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { playwright } from './_supabase_simulado.mjs';
import { webConDatos, CATEGORIAS } from './_web_con_datos.mjs';

const KC = (await import('../assets/categorias.js')).default || globalThis.KlendarCategorias;
const OUT = process.env.OUT || 'tools/out';
mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

// ── 1. Lo que sale de tool/categorias.json ────────────────────────────────
const slugs = Object.keys(KC.POR_SLUG);
ok(KC.GRUPOS.length === 10, `diez grupos (${KC.GRUPOS.map((g) => g.id).join(', ')})`);
ok(KC.GRUPOS.every((g) => ['es', 'en', 'ca', 'gl', 'eu', 'fr', 'de', 'it'].every((l) => g[l])), 'cada grupo, en los 8 idiomas');
ok(KC.nombreGrupo('events', 'ca') === 'Esdeveniments i celebracions' && KC.nombreGrupo('stay', 'de') === 'Unterkünfte', 'el nombre del grupo en catalán y alemán');
ok(slugs.length >= 90, `${slugs.length} categorías`);
ok(KC.GRUPOS.every((g) => slugs.some((s) => KC.POR_SLUG[s] === g.id)), 'todos los grupos tienen alguna');
const iconosCat = readFileSync(new URL('../functions/_lib/iconos-cat.js', import.meta.url), 'utf8');
const sinIcono = slugs.filter((s) => !iconosCat.includes(`"${s}": '`));
ok(!sinIcono.length, `todas con icono en la cuadrícula ${sinIcono.join(', ')}`);
const mapa = readFileSync(new URL('../assets/iconos-mapa.js', import.meta.url), 'utf8');
const datosMapa = JSON.parse(mapa.slice(mapa.indexOf('{'), mapa.lastIndexOf('}') + 1));
const sinMapa = slugs.filter((s) => !datosMapa.cat[s]);
ok(!sinMapa.length, `todas con icono en el mapa ${sinMapa.join(', ')}`);
ok(KC.grupoDe({ slug: 'gym', category_group: 'futuro' }) === 'sports', 'un grupo que esta versión no conoce: el de su slug');
ok(KC.grupoDe({ slug: 'gym', category_group: 'leisure' }) === 'leisure', 'el de la base manda (prod sin la migración)');
ok(!slugs.some((s) => /apuesta|casino|bingo|estanco|vape|tabaco|cannabis|cbd|grow/.test(s)), 'ni apuestas, ni tabaco, ni cannabis');

// ── 2. ¿Qué? de Explorar ─────────────────────────────────────────────────
const cats = slugs.map((slug, i) => ({
  id: `c1000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, slug, names: { es: slug, en: slug }, name: slug,
  position: i + 1, category_group: KC.POR_SLUG[slug], icon: slug,
}));
// Las de los datos de mentira, con su id de siempre (los negocios las usan).
for (const c of CATEGORIAS) {
  const i = cats.findIndex((x) => x.slug === c.slug);
  if (i >= 0) cats[i] = { ...cats[i], id: c.id, names: c.names, name: c.name };
}
const web = await webConDatos({ puerto: Number(process.env.PORT || 8996), tablas: { categories: cats } });
const { chromium } = playwright();
const nav = await chromium.launch();
const comida = slugs.filter((s) => KC.POR_SLUG[s] === 'food');
const septima = comida[7];
for (const [forma, vp] of [['movil', { width: 375, height: 812 }], ['escritorio', { width: 1280, height: 900 }]]) {
  const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
  await web.conDatos(ctx);
  const page = await ctx.newPage();
  const errores = [];
  const deMapbox = (x) => /mapbox|webgl|tile|Failed to load resource|^Error$|Load failed/i.test(x);
  page.on('console', (m) => { if (m.type() === 'error' && !deMapbox(m.text())) errores.push(m.text()); });
  page.on('pageerror', (e) => { if (!deMapbox(`${e.message} ${e.stack || ''}`)) errores.push(String(e)); });
  const t = `[${forma}]`;
  await page.goto(`${web.BASE}/explorar?lat=40.417&lng=-3.704&categoria=${septima}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#que-hoja > summary').click();
  const grupos = await page.evaluate(() => [...document.querySelectorAll('#que-hoja .hoja-cats-grupo')].map((f) => ({
    nombre: f.querySelector('legend')?.textContent.trim(),
    fuera: f.querySelectorAll(':scope > .cat-rejilla .cat-celda').length,
    dentro: f.querySelectorAll('.hoja-cats-mas .cat-celda').length,
    mas: f.querySelector('.hoja-cats-mas > summary')?.textContent.trim() || '',
  })));
  ok(grupos.length === 10, `${t} los diez grupos en ¿Qué? (${grupos.map((g) => g.nombre).join(' · ')})`);
  const conMas = grupos.filter((g) => g.dentro);
  ok(conMas.length >= 5 && conMas.every((g) => g.mas === `${g.dentro} más`), `${t} los grupos largos, con «N más» (${conMas.map((g) => `${g.nombre}: ${g.fuera}+${g.dentro}`).join(', ')})`);
  const food = grupos.find((g) => g.nombre === 'Comer y beber');
  ok(food && food.fuera === 7 && food.fuera + food.dentro === comida.length, `${t} Comer y beber: 6 + la elegida fuera, el resto dentro (${food?.fuera}+${food?.dentro})`);
  ok(await page.locator(`#que-hoja .hoja-cats-grupo > .cat-rejilla input[value="${septima}"]:checked`).count() === 1, `${t} la elegida (${septima}) se ve sin abrir «N más»`);
  await page.screenshot({ path: `${OUT}/tipos-que-${forma}.png`, fullPage: false });
  await page.locator('#que-hoja .hoja-cats-mas > summary').first().click();
  ok(await page.locator('#que-hoja .hoja-cats-mas[open] .cat-celda').first().isVisible(), `${t} «N más» despliega el resto`);
  await page.screenshot({ path: `${OUT}/tipos-que-abierto-${forma}.png`, fullPage: false });
  ok(!errores.length, `${t} sin errores en la consola ${errores.join(' | ')}`);
  await ctx.close();
}
await nav.close();
await web.cierra();
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
