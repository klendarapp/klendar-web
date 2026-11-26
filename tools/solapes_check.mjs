// Nada pegado ni pisado en la web, como en la app (Iván, 25-11; RUNBOOK de la
// app §4zzz-solape y §4zzz-solapes-web). Con los datos de mentira de
// _web_con_datos y las sesiones de mentira de «Tu cuenta», el panel y el
// admin: no toca dev ni prod. En cada pantalla (tools/_solapes.mjs):
//
//  1. Ningún bloque hermano pisa a otro ni queda a menos de 4 px de él (de
//     arriba abajo o de lado), salvo uno entero dentro de otro, un botón de
//     texto pegado a algo (pisarse sí cuenta) y las filas de una lista
//     agrupada.
//  2. Ningún texto ni icono se sale de su tarjeta (con lo de fuera a la vista)
//     ni de la pantalla.
//  3. Nada deja desplazar la página de lado.
//
// Pantallas: toda la web pública (con la franja «Mira lo que hay cerca de ti»
// y la pregunta de la edad donde salen solas, y los menús ¿Dónde?, ¿Cuándo?,
// ¿Qué?, ☰ y ⋮ abiertos de uno en uno), «Tu cuenta» (sin y con sesión), el
// panel con los cuatro papeles (dueña, encargado, camarero y entidad) y el
// admin (admin.localhost).
//
// Completa (a mano; unos 12 min con CONC=8, ~4.000 medidas): Chromium a 360, 390, 768, 1024 y
// 1280 en claro; en oscuro a 390 y 1280; WebKit a 390 y 1280; y la letra al
// 130 % y al 200 % a 390 y 1280 (tools/_solapes.mjs › letraGrande: cada
// tamaño de letra de la página ×1,3 o ×2 con las cajas como estén, como
// «Ampliar solo el texto» de Firefox, el tamaño de texto de Android o el
// `textScaler` de la app; la web pública va en px y no crecería con solo
// cambiar `html { font-size }`).
//
//   node tools/solapes_check.mjs                  la completa
//   SOLAPES_RAPIDO=1 node tools/solapes_check.mjs la del pre-push (~240 medidas, 1–2 min)
//
// Con variables:
//   ZONAS=pub,cuenta,owner,manager,staff,entidad,admin   (por defecto, todas)
//   SOLO=descubre,hoy,resumen                            solo esas pantallas (por su nombre)
//   PERFILES=chromium-390,webkit-1280,letra2-390,oscuro-1280  (por defecto, los de arriba)
//   CONC=6                                                 cuántas a la vez
//   CSS_EXTRA=<fichero.css>                                una propuesta: esa hoja encima (no toca la web)
//   OUT=<carpeta>                                          el informe (SOLAPES.json) y, con CAPTURAS=1, una captura
//                                                          de cada pantalla que falla con lo que falla en rojo
//   (PW=<ruta a playwright>, o el de la caché de npx)
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

let PW = process.env.PW;
if (!PW) {
  try {
    const base = `${process.env.LOCALAPPDATA || ''}\\npm-cache\\_npx`;
    for (const d of readdirSync(base)) { try { readdirSync(`${base}\\${d}\\node_modules\\playwright`); PW = `${base}\\${d}\\node_modules\\playwright`; break; } catch { /* otra */ } }
  } catch { /* sin caché de npx */ }
}
if (!PW) { console.log('(sin Playwright: me salto la prueba)'); process.exit(0); }
process.env.PW = PW;
const { playwright, adminDe, enSuHost } = await import('./_supabase_simulado.mjs');
const { webConDatos } = await import('./_web_con_datos.mjs');
const { rpcs, conSesion, PUBS } = await import('./_panel_simulado.mjs');
const { conSesionCuenta } = await import('./_cuenta_simulado.mjs');
const { PANTALLAS, RPC_GUIA } = await import('./web_capturas.mjs');
const { PANTALLAS_ADMIN, conSesionAdmin } = await import('./_admin_simulado.mjs');
const { SECCIONES_PANEL } = await import('../functions/_lib/panel.js');
const { solapesPantalla, letraGrande, sinAnimaciones, escalaCss } = await import('./_solapes.mjs');

const pw = playwright();
const RAPIDO = Boolean(process.env.SOLAPES_RAPIDO);
const lista = (v) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : null);
const OUT = process.env.OUT || 'tools/out/solapes';
mkdirSync(OUT, { recursive: true });

const ALTO = { 360: 780, 390: 844, 768: 1024, 1024: 768, 1280: 800 };
const p = (nav, w, tema = 'light', letra = 1) => ({ id: `${letra === 1 ? (tema === 'dark' ? 'oscuro' : nav) : `letra${String(letra).replace('.', '')}`}-${w}`, nav, w, h: ALTO[w], tema, letra });
const COMPLETO = [
  ...[360, 390, 768, 1024, 1280].map((w) => p('chromium', w)),
  p('chromium', 390, 'dark'), p('chromium', 1280, 'dark'),
  p('webkit', 390), p('webkit', 1280),
  p('chromium', 390, 'light', 1.3), p('chromium', 1280, 'light', 1.3), p('chromium', 390, 'light', 2), p('chromium', 1280, 'light', 2),
];
// La rápida: los tamaños y letras donde salía algo, en Chromium (WebKit, en la completa).
const RAPIDOS = ['chromium-360', 'chromium-1280', 'letra2-390', 'letra13-1280'];
const PERFILES = COMPLETO.filter((x) => (lista(process.env.PERFILES) || (RAPIDO ? RAPIDOS : COMPLETO.map((y) => y.id))).includes(x.id));

// Las pantallas de cada zona: [nombre, ruta].
const PUB = PANTALLAS.filter((x) => x[2] !== 'cuenta').map(([n, r]) => [n, r]);
PUB.push(['explorar-madrid', '/explorar?ciudad=madrid&vista=lista'], ['explorar-sitios-madrid', '/explorar?que=sitios&ciudad=madrid'], ['descubre-en', '/en/discover']);
const CUENTA = PANTALLAS.filter((x) => x[2] === 'cuenta').map(([n, r]) => [n, r]);
const PANEL = [...SECCIONES_PANEL.filter((s) => s !== 'publicaciones'), 'publicaciones', `publicaciones/${PUBS[0].id}`].map((s) => [s.replace(/\/.*/, '-id').replace(/^publicaciones-id$/, 'publicacion'), `/panel/${s}`]);
const ADMIN = PANTALLAS_ADMIN;
const ZONAS = {
  pub: PUB, cuenta: CUENTA, owner: PANEL, manager: PANEL, staff: PANEL, entidad: PANEL, admin: ADMIN,
};
// La rápida: una muestra de cada zona (las que tenían algo y las de más uso).
const MUESTRA = {
  pub: ['portada', 'descubre', 'explorar', 'explorar-madrid', 'explorar-sitios', 'oferta', 'evento', 'negocio', 'ciudad-hoy', 'municipio', 'para-negocios', 'precios', 'guia', 'cuenta-entrar'],
  cuenta: ['cuenta', 'cuenta-planes', 'cuenta-codigos', 'cuenta-ajustes', 'cuenta-sellos', 'cuenta-reservar'],
  owner: ['hoy', 'validar', 'publicar', 'negocio', 'fidelizar', 'informe', 'ficha', 'equipo', 'sellos', 'publicacion'],
  staff: ['hoy', 'validar'],
  entidad: ['hoy', 'negocio'],
  admin: ['resumen', 'negocios', 'negocio', 'publicacion', 'usuarios', 'configuracion'],
};
const zonas = lista(process.env.ZONAS) || (RAPIDO ? Object.keys(MUESTRA) : Object.keys(ZONAS));
const SOLO = lista(process.env.SOLO);
const CONC = Number(process.env.CONC || (RAPIDO ? 4 : 6));

// Lo que pide cambiar el aspecto y espera a Iván (PROPUESTA en «Klendar para
// Ivan/revision/solapes-web», con su hoja propuesta_solapes_web.css; RUNBOOK
// §4zzz-solapes-web): sale como «pendiente» y no falla; lo demás, sí. Al
// aprobarse y aplicarse, se quita de aquí. Solo con la letra al 200 %. (La barra
// de abajo y «Entrar» en el móvil también salían, pero era la página ensanchada
// por otra cosa: arreglado, ya no está aquí.)
// P1 (las marcas de distancia y precio) y P2 (la cabecera del ordenador),
// aprobadas por Iván y aplicadas el 25-11: ya no están aquí (la prueba las vigila).
const PENDIENTES = [];

const web = await webConDatos({ puerto: Number(process.env.PORT || 9431), rpc: RPC_GUIA });
const ADMIN_BASE = adminDe(web.BASE);
const navs = {};
const resultados = [];
let fallos = 0;
const t0 = Date.now();

/** Una tanda: un perfil y una zona, en su contexto. */
async function tanda(perfil, zona) {
  if (!navs[perfil.nav]) navs[perfil.nav] = pw[perfil.nav].launch();
  const nav = await navs[perfil.nav];
  const ctx = await nav.newContext({
    viewport: { width: perfil.w, height: perfil.h }, colorScheme: perfil.tema, reducedMotion: 'reduce', locale: 'es-ES', timezoneId: 'Europe/Madrid',
    hasTouch: perfil.w < 1000, ...(perfil.nav === 'chromium' ? { isMobile: perfil.w < 800 } : {}), bypassCSP: true,
  });
  await web.conDatos(ctx);
  if (zona === 'cuenta') await conSesionCuenta(ctx);
  if (['owner', 'manager', 'staff', 'entidad'].includes(zona)) await conSesion(ctx, rpcs(zona));
  // Las cifras del Resumen (sin ellas, la administradora de mentira enseña «undefined»).
  if (zona === 'admin') await conSesionAdmin(ctx, { extra: { admin_kpis: { users_total: 12480, wau: 3120, businesses_verified: 214, offers_active: 386, redemptions_7d: 1675,
    revenue_month_cents: 425870, users_7d: 412, users_30d: 1630, dau: 640, mau: 7020, businesses_total: 268, businesses_pending: 9, series: [] } } });
  // La franja «Mira lo que hay cerca de ti», siempre que el navegador la deje
  // salir (sus topes, a cero en cada página).
  if (zona === 'pub') await ctx.addInitScript(() => { try { localStorage.removeItem('klendar.aviso.ubicacion'); sessionStorage.removeItem('klendar.aviso.sesion'); } catch { /* */ } });
  await ctx.addInitScript(sinAnimaciones);
  if (perfil.letra !== 1) await letraGrande(ctx, perfil.letra);
  // Una propuesta (CSS_EXTRA=<fichero.css>): esa hoja encima de la página, con la misma letra.
  if (process.env.CSS_EXTRA) {
    const css = escalaCss(readFileSync(process.env.CSS_EXTRA, 'utf8'), perfil.letra);
    await ctx.route('**/__propuesta.css', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
    await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/__propuesta.css'; document.head.appendChild(l);
    }));
  }
  let pantallas = ZONAS[zona];
  if (RAPIDO && !SOLO) pantallas = pantallas.filter(([n]) => MUESTRA[zona].includes(n));
  if (SOLO) pantallas = pantallas.filter(([n]) => SOLO.includes(n));
  for (const [nombre, ruta] of pantallas) {
    // Una pestaña nueva para cada pantalla: en el móvil, lo que ensancha una
    // página se queda en la pestaña para las siguientes.
    const pg = await ctx.newPage();
    const url = zona === 'admin' ? ADMIN_BASE + ruta : enSuHost(web.BASE, ruta);
    try {
      await pg.goto(url, { waitUntil: 'load', timeout: 20000 });
      await pg.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      if (zona !== 'pub') await pg.waitForSelector('#view h1, #view h2', { timeout: 10000 }).catch(() => {});
      await pg.waitForFunction(() => !document.querySelector('#view .loading, #view .esq-p, .aguja-carga'), null, { timeout: 5000 }).catch(() => {});
      await pg.evaluate(() => document.fonts.ready);
      await pg.waitForTimeout(350);
      // En el móvil, la ventana que se ensanchó un momento al cargar (la
      // cabecera antes de encoger el logo con la fuente ya puesta) vuelve a su
      // ancho: se espera (2 s como mucho; si sigue ancha, es de verdad).
      await pg.waitForFunction(() => window.innerWidth <= document.documentElement.clientWidth + 1, null, { timeout: 2000 }).catch(() => {});
      await mide(pg, perfil, zona, nombre, '');
      // Los menús de la página, abiertos de uno en uno.
      if (zona === 'pub') {
        const menus = await pg.$$eval('#barra details > summary, details.mas-menu > summary, header details > summary', (ss) => ss
          .filter((s) => s.getClientRects().length && !s.parentElement.open).map((s) => {
            const d = s.parentElement;
            return d.id ? `#${d.id} > summary` : null;
          }).filter(Boolean));
        for (const sel of menus.slice(0, 6)) {
          await pg.click(sel, { timeout: 3000 }).catch(() => {});
          await pg.waitForTimeout(300);
          await mide(pg, perfil, zona, nombre, (await pg.$eval(sel, (s) => s.getAttribute('aria-label') || s.textContent.trim()).catch(() => sel)).slice(0, 30));
          await pg.evaluate((s) => { const d = document.querySelector(s)?.parentElement; if (d) d.open = false; }, sel).catch(() => {});
          await pg.waitForTimeout(100);
        }
        const mas = await pg.$('details.mas-menu:not([id]) > summary');
        if (mas && await mas.isVisible()) {
          await mas.click().catch(() => {});
          await pg.waitForTimeout(250);
          await mide(pg, perfil, zona, nombre, 'menú ⋮');
          await pg.evaluate(() => document.querySelectorAll('details.mas-menu[open]').forEach((d) => { d.open = false; }));
        }
      }
    } catch (e) {
      resultados.push({ perfil: perfil.id, zona, nombre, error: e.message.split('\n')[0] });
      console.log(`no pude: ${perfil.id} ${zona} ${nombre}: ${e.message.split('\n')[0]}`);
    }
    await pg.close();
  }
  await ctx.close();
}

async function mide(pg, perfil, zona, nombre, estado) {
  const r = await pg.evaluate(solapesPantalla, { max: 60 });
  const detalle = [
    ...r.pisados.map((x) => ({ como: x.como, firma: x.firma, texto: `${x.como} (${x.px}): ${x.a} y ${x.b}`, caja: x.caja })),
    ...r.salidos.map((x) => ({ como: 'se sale', firma: x.firma, texto: `se sale de ${x.de} (${x.px} px): ${x.que}`, caja: x.caja })),
    ...(r.lateral.px > 1 ? [{ como: 'desplazamiento de lado', firma: r.lateral.culpables.map((c) => c.replace(/ «.*$/, '')).join(' + '),
      texto: `desplazamiento de lado (${r.lateral.px} px): ${r.lateral.culpables.join(' | ')}` }] : []),
  ];
  // Lo que espera a Iván (PENDIENTES): se apunta, pero no falla.
  for (const d of detalle) d.pendiente = PENDIENTES.find((x) => x.perfil.test(perfil.id) && x.zona.test(zona) && x.como.test(d.como) && x.firma.test(d.firma))?.id;
  const reales = detalle.filter((d) => !d.pendiente);
  const fallosAqui = reales.map((d) => d.texto);
  const n = reales.length + Math.max(0, r.nPisados - r.pisados.length) + Math.max(0, r.nSalidos - r.salidos.length);
  resultados.push({ perfil: perfil.id, zona, nombre, estado, n, fallos: fallosAqui, detalle });
  if (n) {
    fallos += 1;
    const t = `${perfil.id} ${zona} ${nombre}${estado ? ` [${estado}]` : ''}`;
    if (process.env.VERBOSO) console.log(`FALLO: ${t}: ${n} — ${fallosAqui.slice(0, 4).join(' || ')}`);
    if (process.env.CAPTURAS) {
      const f = `${OUT}/${zona}_${nombre}${estado ? `_${estado.replace(/[^\w]+/g, '-')}` : ''}_${perfil.id}.png`.replace(/-+\./, '.');
      // Lo que falla, recuadrado en rojo.
      await pg.evaluate((cajas) => {
        for (const [x, y, w, h] of cajas) {
          const d = document.createElement('div');
          d.className = 'solape-marca';
          d.style.cssText = `position:absolute;left:${x - 2}px;top:${y - 2}px;width:${w + 4}px;height:${h + 4}px;outline:3px solid #e00;z-index:2147483647;pointer-events:none;background:rgba(255,0,0,.08)`;
          document.body.appendChild(d);
        }
      }, reales.flatMap((d) => d.caja || [])).catch(() => {});
      await pg.screenshot({ path: f, fullPage: true }).catch(() => {});
      await pg.evaluate(() => document.querySelectorAll('.solape-marca').forEach((d) => d.remove())).catch(() => {});
    }
  }
}

// Las tandas, de CONC en CONC.
const cola = [];
for (const perfil of PERFILES) for (const z of zonas) cola.push([perfil, z]);
await Promise.all(Array.from({ length: Math.min(CONC, cola.length) }, async () => {
  while (cola.length) { const [perfil, z] = cola.shift(); await tanda(perfil, z); }
}));
for (const n of Object.values(navs)) await (await n).close();
await web.cierra();

writeFileSync(`${OUT}/SOLAPES.json`, JSON.stringify(resultados, null, 1));
const medidas = resultados.filter((x) => !x.error).length;
const errores = resultados.filter((x) => x.error).length;
// Lo mismo en varios perfiles, pantallas o estados, una vez (por las clases,
// no por el texto: las tarjetas de una lista fallan juntas).
const juntos = new Map();
for (const x of resultados) for (const f of (x.detalle || []).filter((d) => !d.pendiente)) {
  const k = `${x.zona}: ${f.como} — ${f.firma}`;
  let j = juntos.get(k);
  if (!j) { j = { ej: `${x.nombre}${x.estado ? ` [${x.estado}]` : ''}: ${f.texto}`, perfiles: new Set(), pantallas: new Set(), n: 0 }; juntos.set(k, j); }
  j.perfiles.add(x.perfil); j.pantallas.add(x.nombre); j.n += 1;
}
if (juntos.size) {
  console.log(`\n${juntos.size} fallo(s) distinto(s):`);
  for (const [k, j] of juntos) console.log(` - ${k} (${j.n} veces)\n     p. ej. ${j.ej}\n     en ${[...j.pantallas].slice(0, 8).join(', ')}${j.pantallas.size > 8 ? '…' : ''} · ${[...j.perfiles].join(', ')}`);
}
// Lo pendiente, por propuesta.
const pend = new Map();
for (const x of resultados) for (const f of (x.detalle || []).filter((d) => d.pendiente)) {
  let j = pend.get(f.pendiente);
  if (!j) { j = { n: 0, pantallas: new Set(), perfiles: new Set() }; pend.set(f.pendiente, j); }
  j.n += 1; j.pantallas.add(`${x.zona} ${x.nombre}`); j.perfiles.add(x.perfil);
}
if (pend.size) {
  console.log(`
Pendiente de Iván (no falla; ver PENDIENTES):`);
  for (const [id, j] of pend) console.log(` - ${id}: ${j.n} veces en ${j.pantallas.size} pantallas · ${[...j.perfiles].join(', ')}`);
}
writeFileSync(`${OUT}/RESUMEN.json`, JSON.stringify([...juntos].map(([k, j]) => ({ fallo: k, ej: j.ej, n: j.n, pantallas: [...j.pantallas], perfiles: [...j.perfiles] })), null, 1));
console.log(`\n${medidas} medidas (${PERFILES.length} perfiles × ${zonas.length} zonas) en ${Math.round((Date.now() - t0) / 1000)} s; ${errores} sin cargar.`);
console.log(fallos || errores ? `${fallos} pantalla(s) con solapes${errores ? `, ${errores} sin cargar` : ''}` : 'Todo bien.');
process.exit(fallos || errores ? 1 : 0);
