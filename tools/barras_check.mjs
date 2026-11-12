// Las barras de filtro (Iván, 11–12-11-2026; como la app, `FilterSlider`):
//  1. «¿Dónde?» › «¿Hasta dónde?»: una barra de 1 a 100 km con marcas en 5,
//     10, 25, 50 y 100, «A menos de 63 km» encima y una casilla. `?km=` vale
//     de 1 a 100 (los 1, 3, 5, 10 y 25 de antes también); fuera, al extremo.
//     «Ampliar a N km» va a la marca siguiente.
//  2. ☰ › «Precio del plan»: «Precio máximo» de Gratis a «Sin límite» (de
//     serie, no filtra), con su casilla. `?precio=gratis|0|N` (1–100); los
//     de antes (gratis, 10, 25, 50) valen; más de 100, sin límite.
//  3. En el navegador (con PW=…): arrastrar/teclado de paso en paso (25 → 30,
//     100 € → «Sin límite»), tocar una marca, la casilla con su error (0, 101)
//     que se quita al corregirla, 16 px, sin salirse en 360 px, y capturas.
// Con datos de mentira (tools/_web_con_datos.mjs): no sale nada.
//
//   node tools/barras_check.mjs                 (sin navegador)
//   PW=<ruta a playwright> node tools/barras_check.mjs   (también en el navegador)
//   CAPTURAS=<carpeta> …                        (guarda las capturas allí)
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { webConDatos } from './_web_con_datos.mjs';
import { ESCALA_KM, ESCALA_PRECIO, kmDeUrl, leeEscrito, precioDeUrl, slotDe, valorEnSlot } from '../functions/_lib/barra.js';

let fallos = 0;
const ok = (c, m, extra = '') => { if (c) console.log(`ok: ${m}`); else { fallos += 1; console.log(`FALLO: ${m} ${extra}`); } };

// ── Los pasos (los mismos números que la app) ───────────────────────────────
ok(ESCALA_KM.stops[0] === 1 && ESCALA_KM.stops.at(-1) === 100 && ESCALA_KM.stops.includes(25) && !ESCALA_KM.stops.includes(26)
  && ESCALA_KM.stops.includes(30), 'distancia: 1–25 de 1 en 1 y 30–100 de 5 en 5');
ok(JSON.stringify(ESCALA_KM.marcas) === '[5,10,25,50,100]', 'distancia: marcas 5, 10, 25, 50 y 100');
ok(ESCALA_KM.slots.at(-1) === 54 && ESCALA_PRECIO.slots.at(-1) === 71, 'el mismo reparto que la app (54 y 71 huecos)', `${ESCALA_KM.slots.at(-1)} ${ESCALA_PRECIO.slots.at(-1)}`);
for (const v of [1, 25, 100]) ok(valorEnSlot(ESCALA_KM, slotDe(ESCALA_KM, v), 0) === v, `frontera ${v} km`);
ok(valorEnSlot(ESCALA_KM, slotDe(ESCALA_KM, 25) + 1, slotDe(ESCALA_KM, 25)) === 30, 'un paso desde 25 km: 30');
ok(valorEnSlot(ESCALA_KM, slotDe(ESCALA_KM, 30) - 1, slotDe(ESCALA_KM, 30)) === 25, 'un paso atrás desde 30 km: 25');
ok(valorEnSlot(ESCALA_PRECIO, slotDe(ESCALA_PRECIO, 100) + 1, slotDe(ESCALA_PRECIO, 100)) === null, 'de 100 € se salta a «Sin límite»');
ok(valorEnSlot(ESCALA_PRECIO, slotDe(ESCALA_PRECIO, null) - 1, slotDe(ESCALA_PRECIO, null)) === 100, 'de «Sin límite» se vuelve a 100 €');
ok(leeEscrito(ESCALA_KM, '63').valor === 63 && !leeEscrito(ESCALA_KM, '0').ok && !leeEscrito(ESCALA_KM, '101').ok
  && leeEscrito(ESCALA_KM, '').vacio, 'casilla de km: 63 sí; 0 y 101 no; vacía no es error');
ok(leeEscrito(ESCALA_PRECIO, '').ok && leeEscrito(ESCALA_PRECIO, '').valor === null && leeEscrito(ESCALA_PRECIO, '0').valor === 0
  && !leeEscrito(ESCALA_PRECIO, '120').ok, 'casilla de precio: vacía es «Sin límite», 0 es gratis, 120 no');
ok([kmDeUrl('3', 5), kmDeUrl('63', 5), kmDeUrl('250', 5), kmDeUrl('0', 5), kmDeUrl('', 5)].join() === '3,63,100,1,5', '?km= de antes y nuevos');
ok([precioDeUrl('free'), precioDeUrl('0'), precioDeUrl('10'), precioDeUrl('50'), precioDeUrl('80'), precioDeUrl('150'), precioDeUrl('')].join()
  === 'free,free,10,50,80,,', '?precio= de antes y nuevos');

// ── Las páginas ──────────────────────────────────────────────────────────────
const web = await webConDatos({ puerto: Number(process.env.PORT || 8997) });
const pide = async (ruta) => (await fetch(`${web.BASE}${ruta}`)).text();
const ultima = (fn) => [...web.llamadas].reverse().find((l) => l.fn === fn)?.args;
const POS = 'lat=40.417&lng=-3.704';
let nav = null;
try {
  web.llamadas.length = 0;
  let h = await pide(`/explorar?vista=lista&${POS}&km=63`);
  ok(/class="barra-valor"[^>]*>A menos de 63 km</.test(h), '«A menos de 63 km» encima');
  ok(ultima('public_explore')?.p_filters?.radius_m === 63000, 'pide 63 km a la base', JSON.stringify(ultima('public_explore')?.p_filters));
  const marcas = [...h.matchAll(/<a class="barra-m[^"]*"[^>]*data-v="(\d+)"[^>]*href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
  ok(marcas.map((m) => m[0]).join() === '5,10,25,50,100', 'las cinco marcas son enlaces', JSON.stringify(marcas));
  ok(marcas.find((m) => m[0] === '100')?.[1].includes('km=100') && !marcas.find((m) => m[0] === '5')?.[1].includes('km='), 'cada marca lleva su km (5, el de serie, sin km)');
  ok(/<form class="barra-form" method="get"[\s\S]*?name="km" value="63"/.test(h), 'sin JavaScript, la casilla va en un formulario con km=63');
  ok(/inputmode="numeric"/.test(h) && /aria-describedby="barraKm-err"/.test(h), 'casilla numérica con su error enlazado');
  ok(!/op-km/.test(h), 'sin los chips de antes');

  web.llamadas.length = 0;
  await pide(`/explorar?vista=lista&${POS}&km=3`);
  ok(ultima('public_explore')?.p_filters?.radius_m === 3000, 'un enlace de antes (km=3) sigue valiendo');
  web.llamadas.length = 0;
  await pide(`/explorar?vista=lista&${POS}&km=250`);
  ok(ultima('public_explore')?.p_filters?.radius_m === 100000, 'km=250 → 100 km (nada más lejos de lo que se puede)');

  // Sin nada a la vista con 63 km: «Ampliar a 100 km».
  const vacia = await webConDatos({ puerto: Number(process.env.PORT || 8997) + 2, rpc: { public_explore: () => ({ total: 0, items: [] }) } });
  try {
    const hv = await (await fetch(`${vacia.BASE}/explorar?vista=lista&${POS}&km=63`)).text();
    ok(/Ampliar a 100 km/.test(hv), '«Ampliar a 100 km» desde 63');
    const h100 = await (await fetch(`${vacia.BASE}/explorar?vista=lista&${POS}&km=100`)).text();
    ok(!/Ampliar a \d+ km/.test(h100), 'en 100 km ya no hay a qué ampliar');
  } finally { await vacia.cierra(); }

  // Sin ubicación: las marcas piden la ubicación (botones, con JavaScript).
  h = await pide('/explorar?vista=lista&ciudad=madrid');
  ok(/<button type="button" class="barra-m[^"]*"[^>]*hidden>/.test(h) && /id="kmCerca"[^>]*data-cerca/.test(h), 'con una ciudad, las marcas piden la ubicación');

  // El precio.
  h = await pide('/explorar?vista=lista');
  ok(/id="barraPrecio"/.test(h) && /class="barra-valor"[^>]*>Cualquier precio</.test(h), 'precio: de serie «Cualquier precio»');
  ok(/name="precio" value=""[^>]*placeholder="Sin límite"/.test(h), 'precio: la casilla vacía dice «Sin límite»');
  ok(/Precio del local/.test(h) && /name="precios-local"/.test(h), '«Precio del local» sigue aparte');
  for (const [q, filtro, txt] of [
    ['precio=80', { max_price_cents: 8000 }, 'Hasta 80 €'],
    ['precio=10', { max_price_cents: 1000 }, 'Hasta 10 €'],
    ['precio=gratis', { free: true }, 'Solo gratis'],
    ['precio=0', { free: true }, 'Solo gratis'],
    ['precio=150', {}, 'Cualquier precio'],
  ]) {
    web.llamadas.length = 0;
    const hp = await pide(`/explorar?vista=lista&${q}`);
    const f = ultima('public_explore')?.p_filters || {};
    const bien = Object.entries(filtro).every(([k, v]) => f[k] === v) && (Object.keys(filtro).length || (f.max_price_cents == null && !f.free));
    ok(bien, `?${q} → ${JSON.stringify(filtro)}`, JSON.stringify(f));
    ok(hp.includes(`class="barra-valor" aria-live="polite">${txt}<`), `?${q}: «${txt}» encima`);
  }
  const hp = await pide('/en/explore?view=list&price=25');
  ok(hp.includes('>Up to €25<') && hp.includes('placeholder="No limit"'), 'en inglés: «Up to €25» y «No limit»');

  // ── En el navegador ──────────────────────────────────────────────────────
  if (!process.env.PW) {
    console.log('(sin PW=…: me salto lo del navegador)');
  } else {
    const { playwright } = await import('./_supabase_simulado.mjs');
    nav = await playwright().chromium.launch();
    const capturas = process.env.CAPTURAS || '';
    if (capturas && !existsSync(capturas)) mkdirSync(capturas, { recursive: true });
    const ctx = await nav.newContext({ viewport: { width: 360, height: 780 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: true });
    await web.conDatos(ctx);
    const p = await ctx.newPage();
    await p.goto(`${web.BASE}/explorar?vista=lista&${POS}&km=25`, { waitUntil: 'networkidle' });
    await p.locator('#zona > summary').click();
    const r = p.locator('#barraKm .barra-r');
    await r.waitFor({ state: 'visible' });
    ok(await p.locator('#barraKm .barra-valor').textContent() === 'A menos de 25 km', 'navegador: 25 km');
    await r.focus();
    await p.keyboard.press('ArrowRight');
    ok(await p.locator('#barraKm .barra-valor').textContent() === 'A menos de 30 km', 'teclado: de 25 a 30 km');
    ok((await r.getAttribute('aria-valuetext')) === 'Distancia: A menos de 30 km', 'el lector: «Distancia: A menos de 30 km»');
    await p.waitForURL(/km=30/, { timeout: 5000 }).then(() => ok(true, 'al soltar (cambio), va a km=30'), () => ok(false, 'al soltar, va a km=30', p.url()));
    await p.locator('#zona > summary').click();
    const campo = p.locator('#barraKm .barra-in input');
    const fs = await campo.evaluate((el) => getComputedStyle(el).fontSize);
    ok(fs === '16px', 'la casilla a 16 px (iOS no agranda)', fs);
    for (const malo of ['0', '101']) {
      await campo.fill(malo);
      ok(await p.locator('#barraKm-err').isVisible() && (await campo.getAttribute('aria-invalid')) === 'true', `«${malo}»: error claro`);
    }
    if (capturas) await p.screenshot({ path: join(capturas, 'web-distancia-error.png') });
    await campo.fill('63');
    ok(!(await p.locator('#barraKm-err').isVisible()) && await p.locator('#barraKm .barra-valor').textContent() === 'A menos de 63 km', '«63»: se quita el error y la barra se coloca');
    const marcas360 = await p.locator('#barraKm .barra-m').evaluateAll((l) => l.map((m) => m.getBoundingClientRect()).map((b) => [b.left, b.right]));
    ok(marcas360.every((m, i) => i === 0 || m[0] >= marcas360[i - 1][1] - 0.5), 'en 360 px las marcas no se pisan', JSON.stringify(marcas360));
    const alto = await p.locator('#barraKm .barra-r').evaluate((el) => el.getBoundingClientRect().height);
    ok(alto >= 44, 'la barra mide 44 px de alto (dedo)', String(alto));
    if (capturas) await p.screenshot({ path: join(capturas, 'web-distancia.png') });
    await p.waitForURL(/km=63/, { timeout: 5000 }).then(() => ok(true, 'la casilla aplica sola: km=63'), () => ok(false, 'la casilla aplica sola', p.url()));
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(ancho <= 360, 'sin scroll de lado en 360 px', String(ancho));

    // El precio, en ☰.
    await p.locator('#filtros > summary').click();
    const rp = p.locator('#barraPrecio .barra-r');
    await rp.waitFor({ state: 'visible' });
    await p.locator('#barraPrecio .barra-m[data-v="100"]').click();
    ok(await p.locator('#barraPrecio .barra-valor').textContent() === 'Hasta 100 €', 'marca 100: «Hasta 100 €»');
    ok(await p.locator('#barraPrecio .barra-in input').inputValue() === '100', 'la casilla dice 100');
    await rp.focus();
    await p.keyboard.press('ArrowRight');
    ok(await p.locator('#barraPrecio .barra-valor').textContent() === 'Cualquier precio', 'teclado: de 100 € a «Sin límite»');
    ok(await p.locator('#barraPrecio .barra-in input').inputValue() === '', '«Sin límite»: la casilla vacía');
    await p.keyboard.press('ArrowLeft');
    ok(await p.locator('#barraPrecio .barra-valor').textContent() === 'Hasta 100 €', 'teclado: de «Sin límite» a 100 €');
    const cp = p.locator('#barraPrecio .barra-in input');
    await cp.fill('120');
    ok(await p.locator('#barraPrecio-err').isVisible(), '120 €: error');
    await cp.fill('80');
    ok(!(await p.locator('#barraPrecio-err').isVisible()) && await p.locator('#barraPrecio .barra-valor').textContent() === 'Hasta 80 €', '80 €: «Hasta 80 €» sin error');
    await p.waitForTimeout(900);
    const n = await p.locator('details.hoja-bloque[data-bloque="precio"] [data-bloque-n]').textContent();
    ok(/1/.test(n || ''), '«Precio del plan · 1»', n);
    if (capturas) await p.locator('#barraPrecio').screenshot({ path: join(capturas, 'web-precio.png') });
    await p.locator('#filtros [data-ver-n]').click();
    await p.waitForLoadState('networkidle');
    ok(/precio=80/.test(p.url()), '«Ver N resultados» lleva precio=80', p.url());
    await ctx.close();
  }
} finally {
  if (nav) await nav.close();
  await web.cierra();
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
