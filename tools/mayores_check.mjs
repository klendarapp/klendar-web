// Contenido +18 sin cuenta y decisiones de la revisión de filtros (Iván,
// 2026-10-27), en la web local y solo leyendo:
//  1. Sin contestar, una línea «Hay N resultados solo para mayores de 18.
//     ¿Tienes 18 años o más?» solo donde hay algo +18 (Explorar: lista y
//     calendario, que es lo primero que se ve desde el 3-11; y Sitios).
//  2. «Tengo 18 años o más»: se guarda (cookie `klendar_18`), la página se
//     vuelve a pedir, salen los +18 y la pregunta no vuelve.
//  3. «Soy menor»: desaparece, no vuelve y no sale nada +18.
//  4. Ficha de una publicación +18: la pregunta en su lugar; con «18 o más»,
//     la ficha.
//  5. «Una ciudad» con «Más cerca»: ordena desde su centro, sin pedir nada;
//     «Más cerca» sin posición ni ciudad: lo dice y ofrece la ubicación.
//  6. Sin errores en la consola.
//
//
// Con sus propios datos (tools/_web_con_datos.mjs): en Madrid hay un sitio
// +18 (Sala Eco) con dos planes +18 (el concierto de esta noche y uno
// agotado). Como en la base, lo +18 solo sale con la cabecera
// `x-klendar-18: 1` (`viewer_sees_adults()`), que la web pone con la cookie
// `klendar_18=1`; el falso de serie no la mira, así que aquí `public_explore`,
// `public_places` y `offer_detail` la miran. Antes iba contra dev y, desde
// que las pruebas no llegan a Supabase (5-11), no había nada +18 que
// esconder y fallaba siempre.
//
//   PW=<ruta a playwright> OUT=<carpeta> node tools/mayores_check.mjs
import { playwright } from './_supabase_simulado.mjs';
import { DATOS, webConDatos } from './_web_con_datos.mjs';

const { chromium, webkit } = playwright();
const metros = (a, b, c, d) => {
  const r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2);
  const y = Math.sin(((d - b) * r) / 2);
  return 12742000 * Math.asin(Math.sqrt(x * x + Math.cos(a * r) * Math.cos(c * r) * y * y));
};
const plano = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** ¿La base enseña lo +18? Solo con la cabecera de «18 o más». */
const ve18 = (req) => req?.headers?.['x-klendar-18'] === '1';
/** En la zona pedida: un punto y su radio, una ciudad o, sin nada, todo. */
const enZona = (x, a) => (a.p_lat != null && a.p_lng != null
  ? metros(Number(a.p_lat), Number(a.p_lng), x.lat, x.lng) <= (Number(a.p_filters?.radius_m || a.p_radius_m) || 25000)
  : a.p_city ? plano(x.city) === plano(a.p_city) || plano(x.city_id) === plano(a.p_city) : true);
const pagina = (l, a) => {
  const d = Number(a.p_offset) || 0;
  return { items: l.slice(d, d + (Number(a.p_limit) || 24)), total: l.length };
};
const web = await webConDatos({
  puerto: Number(process.env.PORT || 9010),
  rpc: {
    public_explore: (a, req) => pagina(DATOS.PLANES.filter((o) => o.status !== 'deleted' && enZona(o, a)
      && (!a.p_kind || o.kind === a.p_kind) && (ve18(req) || !o.adults_only)), a),
    public_places: (a, req) => pagina(DATOS.NEGOCIOS.filter((b) => enZona(b, a) && (ve18(req) || !b.adults_only))
      .map((b) => ({ ...b, distance_m: a.p_lat != null ? Math.round(metros(Number(a.p_lat), Number(a.p_lng), b.lat, b.lng)) : null })), a),
    offer_detail: (a, req) => {
      const o = DATOS.PLANES.find((x) => x.id === a.p_id);
      return o && (ve18(req) || !o.adults_only) ? [{ ...o }] : [];
    },
  },
});
const BASE = web.BASE;
// Una publicación +18 (el concierto de esta noche en Sala Eco).
const OFERTA18 = DATOS.PLANES.find((o) => o.adults_only && o.status === 'active').id;
// Las capturas, en tools/out/ (git las ignora): en la raíz se publicaban
// en klendar.app (revisión del 3-11-2026, 5.4).
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };
// Cuántas salen: Explorar ya no pinta el recuento (como la app, 3-11-2026);
// se pregunta como la hoja de filtros (`?contar=1`), con la misma cookie.
const totalDe = (page) => page.evaluate(async () => {
  const u = new URL(location.href); u.searchParams.set('contar', '1');
  return Number((await (await fetch(u)).json()).total) || 0;
}).catch(() => 0);

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [forma, vp] of [['movil', { width: 375, height: 812 }], ['escritorio', { width: 1280, height: 900 }]]) {
    const t = `[${nombre} ${forma}]`;
    const nuevo = async () => {
      const ctx = await nav.newContext({ viewport: vp, locale: 'es-ES' });
      const page = await ctx.newPage();
      const errores = [];
      const deFuera = (x) => /mapbox|webgl|tile|Failed to load resource|^Error$|Load failed/i.test(x);
      page.on('console', (m) => { if (m.type() === 'error' && !deFuera(m.text())) errores.push(m.text()); });
      return { ctx, page, errores };
    };

    // 1–2. «Tengo 18 años o más».
    {
      const { ctx, page, errores } = await nuevo();
      await page.goto(`${BASE}/explorar?ciudad=Madrid&vista=lista`);
      const aviso = page.locator('[data-edad]');
      ok(await aviso.isVisible() && /solo para mayores de 18/.test(await aviso.innerText()), `${t} sin contestar: la línea de la edad`);
      const antes = await totalDe(page);
      await page.screenshot({ path: `${OUT}/mayores-aviso-${nombre}-${forma}.png` });
      await Promise.all([page.waitForLoadState('load'), page.waitForEvent('framenavigated'), page.locator('[data-edad-si]').click()]);
      await page.waitForLoadState('load');
      const despues = await totalDe(page);
      ok(!(await page.locator('[data-edad]').count()) && despues > antes, `${t} «18 o más»: sin pregunta y más resultados (${antes} → ${despues})`);
      await page.goto(`${BASE}/explorar?que=sitios&ciudad=Madrid`);
      ok(!(await page.locator('[data-edad]').count()), `${t} «18 o más»: tampoco en Sitios`);
      if (OFERTA18) {
        await page.goto(`${BASE}/o/${OFERTA18}`);
        ok(!(await page.locator('[data-edad]').count()) && (await page.locator('h1').first().innerText()) !== '¿Tienes 18 años o más?', `${t} «18 o más»: la ficha +18 se ve`);
      }
      ok(errores.length === 0, `${t} sin errores en la consola (${errores.slice(0, 3).join(' | ')})`);
      await ctx.close();
    }

    // 1b. El calendario de Explorar (lo primero que se ve): la misma línea,
    // con el mismo texto y la misma forma que en la lista (Iván, 2026-11-04).
    {
      const { ctx, page, errores } = await nuevo();
      await page.goto(`${BASE}/explorar?ciudad=Madrid&vista=lista`);
      const enLista = await page.locator('[data-edad]').evaluate((el) => [el.className, el.querySelector('strong')?.textContent]).catch(() => null);
      await page.goto(`${BASE}/explorar?ciudad=Madrid`);
      const cal = page.locator('[data-edad]');
      ok(await page.locator('.calendario').count() > 0 && await cal.isVisible() && /solo para mayores de 18/.test(await cal.innerText()), `${t} calendario sin contestar: la línea de la edad`);
      const enCal = await cal.evaluate((el) => [el.className, el.querySelector('strong')?.textContent]).catch(() => null);
      ok(JSON.stringify(enCal) === JSON.stringify(enLista), `${t} calendario: la misma forma y el mismo texto que la lista (${JSON.stringify(enCal)})`);
      await page.screenshot({ path: `${OUT}/mayores-calendario-${nombre}-${forma}.png` });
      await Promise.all([page.waitForLoadState('load'), page.waitForEvent('framenavigated'), page.locator('[data-edad-si]').click()]);
      await page.waitForLoadState('load');
      ok(!(await page.locator('[data-edad]').count()), `${t} calendario con «18 o más»: sin pregunta`);
      ok(errores.length === 0, `${t} calendario: sin errores en la consola (${errores.slice(0, 3).join(' | ')})`);
      await ctx.close();
    }

    // 3. «Soy menor».
    {
      const { ctx, page } = await nuevo();
      await page.goto(`${BASE}/explorar?ciudad=Madrid&vista=lista`);
      const antes = await totalDe(page);
      await page.locator('[data-edad-no]').click();
      ok(!(await page.locator('[data-edad]').count()), `${t} «Soy menor»: la línea se va`);
      await page.reload();
      ok(!(await page.locator('[data-edad]').count()) && (await totalDe(page)) === antes, `${t} «Soy menor»: no vuelve y nada +18`);
      if (OFERTA18) {
        await page.goto(`${BASE}/o/${OFERTA18}`);
        ok(/ya no está/.test(await page.locator('h1').first().innerText()), `${t} «Soy menor»: la ficha +18 no se ve`);
      }
      await ctx.close();
    }

    // 4. Ficha +18 sin contestar.
    if (OFERTA18) {
      const { ctx, page } = await nuevo();
      await page.goto(`${BASE}/o/${OFERTA18}`);
      ok((await page.locator('h1').first().innerText()) === '¿Tienes 18 años o más?', `${t} ficha +18 sin contestar: la pregunta`);
      await Promise.all([page.waitForEvent('framenavigated'), page.locator('[data-edad-si]').click()]);
      await page.waitForLoadState('load');
      ok((await page.locator('h1').first().innerText()) !== '¿Tienes 18 años o más?', `${t} ficha +18: con «18 o más», la ficha`);
      await ctx.close();
    }

    // 5. «Más cerca» (en la lista: el orden de ☰ es de la lista; el
    // calendario tiene el suyo, «Por hora» / «Más cerca»).
    {
      const { ctx, page } = await nuevo();
      await page.goto(`${BASE}/explorar?ciudad=Madrid&orden=cerca&vista=lista`);
      // El orden va en ☰ › «Ordenar por» (Iván, 2026-10-27), no en la fila.
      ok(!(await page.locator('[data-cerca-falta]').count()) && await page.locator('#filtros input[name=orden][value=cerca]').isChecked(), `${t} «Más cerca» con una ciudad: desde su centro, sin pedir nada`);
      await page.goto(`${BASE}/explorar?orden=cerca&vista=lista`);
      // Un solo aviso a la vez (Iván, 2026-10-28): sin contestar la edad, la
      // ubicación espera y sale al contestar «Soy menor».
      if (await page.locator('[data-edad]').isVisible()) {
        ok(!(await page.locator('[data-cerca-falta]').isVisible()), `${t} «Más cerca» sin dónde: espera a la pregunta de la edad`);
        await page.locator('[data-edad-no]').click();
      }
      ok(await page.locator('[data-cerca-falta]').isVisible(), `${t} «Más cerca» sin dónde: lo dice y ofrece la ubicación`);
      await page.screenshot({ path: `${OUT}/mayores-cerca-${nombre}-${forma}.png` });
      await ctx.close();
    }
  }
  await nav.close();
}
await web.cierra();
console.log(fallos ? `${fallos} FALLAN` : 'todo bien');
process.exit(fallos ? 1 : 0);
