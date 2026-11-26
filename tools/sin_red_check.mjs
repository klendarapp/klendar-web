// «Sin conexión a internet» en la web (§4zzz-revweb, P1; Iván, 26-11): la
// franja de abajo mientras el navegador no tiene red, en la web pública, «Tu
// cuenta» y el panel. Con datos de mentira (Chromium; unos 30 s):
//
//  · Sin red sale con el texto de la app (es/en en la web pública; los 8 de
//    la app en «Tu cuenta» y el panel, también al cambiar de idioma); con red
//    se va sola. La región `role=status` está desde el principio.
//  · A todo el ancho (16 y 16 en el móvil; 560 como mucho y centrada en
//    pantallas anchas), de una línea (sin saltos), encima de lo fijo de abajo
//    (pestañas, la barra del botón de una ficha, la del panel) sin pisarlo.
//  · No tapa nada: lo que se desliza pasa por debajo (como bajo la
//    cabecera), pero abajo del todo nada que se toque (enlaces, botones,
//    campos) queda debajo; en Descubre, el panel de la tarjeta sube. La regla de solapes (tools/_solapes.mjs) sigue a
//    cero con la franja a la vista, y no hay desplazamiento de lado.
//
//   PW=<ruta a playwright> node tools/sin_red_check.mjs
import { webConDatos, PLANES } from './_web_con_datos.mjs';
import { playwright } from './_supabase_simulado.mjs';
import { conSesionCuenta } from './_cuenta_simulado.mjs';
import { conSesion, rpcs } from './_panel_simulado.mjs';
import { solapesPantalla, sinAnimaciones } from './_solapes.mjs';

const web = await webConDatos({ puerto: 8998 });
const { chromium } = playwright();
const nav = await chromium.launch();
let fallos = 0;
const ok = (nombre, cond, extra = '') => { console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}${cond || !extra ? '' : ` (${extra})`}`); if (!cond) fallos++; };

const TEXTO = {
  es: 'Sin conexión a internet', en: 'No internet connection', ca: 'Sense connexió a internet', gl: 'Sen conexión a internet',
  eu: 'Ez dago interneteko konexiorik', fr: 'Pas de connexion internet', de: 'Keine Internetverbindung', it: 'Nessuna connessione a internet',
};
const MOVIL = { width: 360, height: 740 };
const ANCHA = { width: 1280, height: 800 };
const flash = PLANES.find((o) => o.kind === 'flash_offer' && o.redeem_end_at);

/** Cómo está la franja y qué tiene alrededor (en la página). */
function mide() {
  const zona = document.querySelector('.sin-red-zona');
  const caja = zona?.querySelector('.sin-red');
  if (!caja || caja.hidden) return { visible: false, region: zona?.getAttribute('role') || null };
  const r = caja.getBoundingClientRect();
  // El ancho de lo fijo (sin la barra de desplazamiento, si la hay): como la de pestañas.
  const sonda = document.body.appendChild(Object.assign(document.createElement('div'), { style: 'position:fixed;left:0;right:0;top:0;height:0' }));
  const W = sonda.getBoundingClientRect().width;
  sonda.remove();
  const H = window.innerHeight;
  const span = caja.querySelector('span');
  // Lo fijo de abajo que se ve (pestañas, la barra de una ficha, la del panel).
  const barras = [...document.querySelectorAll('.tabbar, #tabbar, .barra-accion')]
    .filter((b) => { const cs = getComputedStyle(b); const q = b.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && q.height > 0 && q.bottom >= H - 2; })
    .map((b) => b.getBoundingClientRect());
  const pisaBarra = barras.some((q) => r.bottom > q.top + 0.5 && r.top < q.bottom);
  // Descubre: el panel de la tarjeta que se ve (título, botón) queda por encima.
  const H2 = H / 2;
  const tarjeta = [...document.querySelectorAll('.tj')].find((t) => { const q = t.getBoundingClientRect(); return q.top <= H2 && q.bottom >= H2; });
  const panel = tarjeta?.querySelector('.tj-panel, .tj-cuerpo')?.getBoundingClientRect();
  const pisaPanel = panel ? r.top < panel.bottom - 0.5 && r.bottom > panel.top && r.left < panel.right && r.right > panel.left : null;
  // Lo que se toca debajo de la franja (la franja no recibe toques: se ve lo de debajo).
  const tocable = 'a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
  const tapa = new Set();
  for (const fx of [0.05, 0.25, 0.5, 0.75, 0.95]) {
    for (const fy of [0.2, 0.5, 0.8]) {
      const x = r.left + r.width * fx;
      const y = r.top + r.height * fy;
      const el = document.elementsFromPoint(x, y).find((e) => !zona.contains(e));
      const t = el?.closest(tocable);
      if (t && !zona.contains(t)) tapa.add(`${t.tagName.toLowerCase()}${t.className && typeof t.className === 'string' ? `.${t.className.trim().split(/\s+/)[0]}` : ''} «${(t.innerText || t.getAttribute('aria-label') || '').trim().slice(0, 24)}»`);
    }
  }
  return {
    visible: true, texto: span?.textContent, region: zona.getAttribute('role'), vivo: zona.getAttribute('aria-live'),
    izq: Math.round(r.left), der: Math.round(W - r.right), ancho: Math.round(r.width), alto: Math.round(r.height),
    unaLinea: span.scrollWidth <= span.clientWidth + 1 && Math.round(r.height) <= 44, abajo: Math.round(H - r.bottom),
    pisaBarra, barras: barras.length, tapa: [...tapa], pisaPanel,
  };
}

async function sinRed(p, fuera) {
  await p.context().setOffline(fuera);
  // Chromium manda `offline`/`online` al cambiarlo; se espera a la franja.
  await p.waitForFunction((f) => {
    const c = document.querySelector('.sin-red');
    return f ? c && !c.hidden : !c || c.hidden;
  }, fuera, { timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(150);
}

async function caso(nombre, { url, viewport, lang = 'es', preparar, listo, bajar = false, solapes = true, feed = false }) {
  const ctx = await nav.newContext({ viewport });
  await web.conDatos(ctx);
  if (preparar) await preparar(ctx);
  await ctx.addInitScript(sinAnimaciones);
  const p = await ctx.newPage();
  await p.goto(`${web.BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector(listo, { timeout: 30000 });
  await p.waitForLoadState('networkidle').catch(() => {});
  const antes = await p.evaluate(mide);
  ok(`${nombre}: con red, sin franja y con la región ya puesta`, !antes.visible && antes.region === 'status', JSON.stringify(antes));
  await sinRed(p, true);
  let m = await p.evaluate(mide);
  const movil = viewport.width < 761;
  ok(`${nombre}: sin red, «${TEXTO[lang]}»`, m.visible && m.texto === TEXTO[lang] && m.region === 'status' && m.vivo === 'polite', JSON.stringify(m));
  if (m.visible) {
    ok(`${nombre}: a todo el ancho`, movil ? m.izq === 16 && m.der === 16 : m.ancho === 560 && Math.abs(m.izq - m.der) <= 1, `${m.izq} · ${m.ancho} · ${m.der}`);
    ok(`${nombre}: en una línea`, m.unaLinea, `${m.alto} px`);
    ok(`${nombre}: encima de lo fijo de abajo, sin pisarlo`, !m.pisaBarra && m.abajo >= 8, `${m.barras} barra(s), ${m.abajo} px del borde`);
    // Lo que se desliza pasa por debajo (como bajo la cabecera): lo que
    // cuenta es que se pueda ver todo, también lo último de la página.
    if (feed) ok(`${nombre}: el panel de la tarjeta, por encima de la franja`, m.pisaPanel === false, JSON.stringify(m.pisaPanel));
    if (bajar) {
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await p.waitForTimeout(250);
      m = await p.evaluate(mide);
      ok(`${nombre}: abajo del todo tampoco tapa nada`, m.visible && !m.tapa.length, m.tapa?.join(', '));
    }
    if (solapes) {
      const s = await p.evaluate(solapesPantalla);
      ok(`${nombre}: solapes a cero con la franja`, !s.pisados.length && !s.salidos.length && !s.lateral.px, JSON.stringify({ p: s.pisados.slice(0, 3), s: s.salidos.slice(0, 3), l: s.lateral }));
    }
  }
  await sinRed(p, false);
  m = await p.evaluate(mide);
  ok(`${nombre}: al volver la red se va sola`, !m.visible && !(await p.evaluate(() => document.documentElement.hasAttribute('data-sin-red'))), JSON.stringify(m));
  await ctx.close();
}

// La web pública (es y en), con y sin barras abajo.
await caso('portada, móvil', { url: '/', viewport: MOVIL, listo: 'header.top', bajar: true });
await caso('portada en inglés, ancha', { url: '/en', viewport: ANCHA, lang: 'en', listo: 'header.top', bajar: true });
await caso('Descubre, móvil', { url: '/descubre', viewport: MOVIL, listo: '.tj', solapes: false, feed: true });
await caso('Descubre, ancha', { url: '/descubre', viewport: ANCHA, listo: '.tj', solapes: false, feed: true });
await caso('ficha de una oferta, móvil', { url: `/o/${flash.id}`, viewport: MOVIL, listo: 'h1', bajar: true });
await caso('Explorar en inglés, móvil', { url: '/en/explore', viewport: MOVIL, lang: 'en', listo: 'header.top', bajar: true });
await caso('condiciones, móvil', { url: '/terminos', viewport: MOVIL, listo: 'h1', bajar: true });

// «Tu cuenta», en español y en los otros idiomas de la app.
await caso('Tu cuenta, móvil', { url: '/cuenta', viewport: MOVIL, listo: '#view h1', preparar: (ctx) => conSesionCuenta(ctx), bajar: true });
// Los otros idiomas, sin sesión (con ella, manda el idioma del perfil).
const conIdioma = (lang) => (ctx) => ctx.addInitScript((l) => { try { localStorage.setItem('klendar_lang', l); } catch { /* */ } }, lang);
for (const lang of ['de', 'eu']) {
  await caso(`Tu cuenta en ${lang}, móvil`, { url: '/cuenta', viewport: MOVIL, lang, listo: '#view h1', solapes: false, preparar: conIdioma(lang) });
}
await caso('Tu cuenta, ancha', { url: '/cuenta', viewport: ANCHA, listo: '#view h1', preparar: (ctx) => conSesionCuenta(ctx) });

// El panel (con su barra de abajo en el móvil).
await caso('panel, móvil', { url: '/panel', viewport: MOVIL, listo: '#tabbar a', preparar: (ctx) => conSesion(ctx, rpcs('owner', { reservas: false })), bajar: true });
await caso('panel, ancha', { url: '/panel', viewport: ANCHA, listo: '#nav a', preparar: (ctx) => conSesion(ctx, rpcs('owner', { reservas: false })) });
for (const lang of ['fr', 'it', 'ca', 'gl']) {
  await caso(`panel en ${lang}, móvil`, { url: '/panel', viewport: MOVIL, lang, listo: 'header.top', solapes: false, preparar: conIdioma(lang) });
}

// Cambiar de idioma con la franja a la vista: cambia con él.
{
  const ctx = await nav.newContext({ viewport: MOVIL });
  await web.conDatos(ctx);
  await conSesionCuenta(ctx);
  const p = await ctx.newPage();
  await p.goto(`${web.BASE}/cuenta`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#view h1', { timeout: 30000 });
  await sinRed(p, true);
  await p.evaluate(() => { document.documentElement.lang = 'it'; });
  await p.waitForTimeout(100);
  ok('al cambiar de idioma sin red, la franja también', (await p.evaluate(mide)).texto === TEXTO.it);
  await ctx.close();
}

await nav.close();
await web.cierra();
console.log(fallos ? `\n${fallos} fallos` : '\ntodo bien');
process.exit(fallos ? 1 : 0);
