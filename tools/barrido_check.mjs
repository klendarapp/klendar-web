// Barrido de fallos visuales de lo público y lo que se ve sin sesión (13-11):
// la portada, Descubre, Explorar, las fichas de un sitio, una oferta y un
// evento, «Tu cuenta» y el panel sin sesión, precios y las páginas de
// información. En claro y en oscuro: a 360 px con la letra normal, al 130 % y
// al 200 % (toda la letra, también la que va en px, como el escalado de texto
// de Chrome en Android); a 1280, y 1280 con el zoom al 200 % (lo mismo que
// 640 de ancho: en el ordenador la letra grande es el zoom). En cada una se
// mira:
//
//   · que la página no tenga scroll horizontal ni nada se salga por la
//     derecha (lo de las filas que se deslizan de lado no cuenta);
//   · que ningún texto quede cortado sin «…» (caja que recorta y texto más
//     ancho o más alto que ella, sin line-clamp);
//   · que dos textos que se ven no se pinten uno encima del otro.
//
// Con datos de mentira (tools/_web_con_datos.mjs): no sale nada a Supabase.
//
//   node tools/barrido_check.mjs              (BARRIDO_SOLO=/precios,/b/… para unas pocas)
import { mkdirSync } from 'node:fs';
import { webConDatos, NEGOCIOS, PLANES } from './_web_con_datos.mjs';
import { playwright } from './_supabase_simulado.mjs';

const { chromium } = playwright();
const OUT = process.env.OUT || 'tools/out/barrido';
mkdirSync(OUT, { recursive: true });

const oferta = PLANES.find((p) => p.kind === 'flash_offer');
const evento = PLANES.find((p) => p.kind === 'future_event');
const RUTAS = [
  '/', '/descubre', '/explorar', '/explorar?que=sitios', `/b/${NEGOCIOS[0].slug}`, `/o/${oferta.id}`, `/o/${evento.id}`,
  '/cuenta', '/panel', '/alta', '/precios', '/para-negocios', '/como-funciona', '/preguntas', '/soporte', '/novedades',
  '/en', '/privacidad',
];
const solo = (process.env.BARRIDO_SOLO || '').split(',').filter(Boolean);

/** Lo visto que no se arregla sin decidir un diseño: [ruta, letra, aviso]. */
const PERMITIDOS = [
  // La tarjeta de Descubre ocupa la pantalla entera (medidas en --u): con
  // toda la letra al doble no cabe; lo mismo que en la app (FittedBox de
  // offer_card.dart), anotado para decidir.
  ['/descubre', 2, /p\.tj-desc/],
];
const permitido = (ruta, letra, aviso) => PERMITIDOS.some(([r, l, re]) => r === ruta && l === letra && re.test(aviso));

/** Lo que se mira dentro de la página (devuelve los avisos). */
const mira = () => {
  const ancho = document.documentElement.clientWidth;
  const avisos = [];
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    }
    return !el.closest('[hidden], dialog:not([open]), [aria-hidden="true"], .sr-only, .visually-hidden')
      && !(el.closest('details:not([open])') && !el.closest('summary'));
  };
  const carril = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(p).overflowX)) return p;
    }
    return null;
  };
  const nombre = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''} «${(el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}»`;
  if (document.documentElement.scrollWidth > ancho + 1) avisos.push(`scroll horizontal (${document.documentElement.scrollWidth} > ${ancho})`);
  // Los elementos con texto propio.
  const conTexto = [...document.body.querySelectorAll('*')].filter((el) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'svg'].includes(el.tagName)
    && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && visible(el));
  const renglones = (n) => { const rg = document.createRange(); rg.selectNodeContents(n); return [...rg.getClientRects()].filter((r) => r.width > 2 && r.height > 2); };
  /** Lo que se ve de cada renglón: recortado por las cajas que recortan (lo
   *  que queda tras «…» no se pinta). */
  const vistos = (el, n) => {
    let rs = renglones(n);
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (!/hidden|clip/.test(cs.overflowX + cs.overflowY)) continue;
      const c = p.getBoundingClientRect();
      rs = rs.map((r) => {
        const l = /hidden|clip/.test(cs.overflowX) ? Math.max(r.left, c.left) : r.left;
        const d = /hidden|clip/.test(cs.overflowX) ? Math.min(r.right, c.right) : r.right;
        const t = /hidden|clip/.test(cs.overflowY) ? Math.max(r.top, c.top) : r.top;
        const b = /hidden|clip/.test(cs.overflowY) ? Math.min(r.bottom, c.bottom) : r.bottom;
        return new DOMRect(l, t, d - l, b - t);
      }).filter((r) => r.width > 2 && r.height > 2);
    }
    return rs;
  };
  for (const el of conTexto) {
    if (carril(el) || el.clientWidth <= 2) continue;
    // El texto, no la caja: una palabra más ancha que su caja se sale de ella.
    const der = Math.max(el.getBoundingClientRect().right, ...[...el.childNodes].filter((n) => n.nodeType === 3).flatMap((n) => vistos(el, n)).map((r) => r.right));
    if (der > ancho + 1) avisos.push(`se sale por la derecha (${Math.round(der - ancho)} px): ${nombre(el)}`);
  }
  // Cajas que recortan el texto sin «…»: un renglón de texto que se sale de
  // la caja que lo recorta (lo decorativo que se sale, como el fondo de la
  // portada, no cuenta).
  const fija = (e) => { for (let p = e; p; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return true; return false; };
  for (const el of conTexto) {
    if (el.clientWidth <= 2 || el.clientHeight <= 2) continue; // .sr: solo para lectores de pantalla
    for (let c = el; c && c !== document.body; c = c.parentElement) {
      const cs = getComputedStyle(c);
      const x = /hidden|clip/.test(cs.overflowX);
      const y = /hidden|clip/.test(cs.overflowY);
      if (!x && !y) continue;
      if (c.clientWidth <= 2 || c.clientHeight <= 2) break;
      const caja = c.getBoundingClientRect();
      const ces = getComputedStyle(el);
      const puntos = ces.textOverflow === 'ellipsis' || (ces.webkitLineClamp && ces.webkitLineClamp !== 'none')
        || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') || cs.textOverflow === 'ellipsis';
      if (puntos) break;
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        for (const r of renglones(n)) {
          if (x && (r.right > caja.right + 2 || r.left < caja.left - 2)) avisos.push(`texto cortado a lo ancho: ${nombre(el)} en ${nombre(c)}`);
          else if (y && (r.bottom > caja.bottom + 2 || r.top < caja.top - 2)) avisos.push(`texto cortado a lo alto: ${nombre(el)} en ${nombre(c)}`);
        }
      }
      break;
    }
  }
  // Textos que se pisan (por renglón de texto, como se pintan).
  const cajas = [];
  for (const el of conTexto) {
    // Lo fijo (la barra de abajo) va encima a propósito; .sr no se ve.
    if (fija(el) || el.clientWidth <= 2) continue;
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      for (const r of vistos(el, n)) cajas.push([el, r]);
    }
  }
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      const [ea, a] = cajas[i];
      const [eb, b] = cajas[j];
      if (ea === eb || ea.contains(eb) || eb.contains(ea)) continue;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 3 && h > Math.min(a.height, b.height) * 0.4) {
        avisos.push(`se pisan: ${nombre(ea)} ↔ ${nombre(eb)}`);
      }
    }
  }
  return [...new Set(avisos)];
};

/** La letra [l] veces más grande en toda la página, también la que va en px
 *  (como «Escalado de texto» de Chrome en Android): se lee todo y luego se
 *  pone, para no multiplicar dos veces lo heredado. */
const agranda = (l) => {
  const todo = [...document.querySelectorAll('body, body *')].map((el) => {
    const cs = getComputedStyle(el);
    return [el, parseFloat(cs.fontSize), cs.lineHeight.endsWith('px') ? parseFloat(cs.lineHeight) : null];
  });
  for (const [el, fs, lh] of todo) {
    el.style.setProperty('font-size', `${fs * l}px`, 'important');
    if (lh) el.style.setProperty('line-height', `${lh * l}px`, 'important');
  }
};

const web = await webConDatos({ puerto: Number(process.env.PORT || 8961) });
const nav = await chromium.launch();
let total = 0;
try {
  for (const [w, h] of [[360, 640], [1280, 800], [640, 400]]) {
    for (const tema of ['light', 'dark']) {
      const ctx = await nav.newContext({ viewport: { width: w, height: h }, colorScheme: tema, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
      await web.conDatos(ctx);
      const p = await ctx.newPage();
      for (const ruta of RUTAS) {
        if (solo.length && !solo.includes(ruta)) continue;
        for (const letra of w < 500 ? [1, 1.3, 2] : [1]) {
          await p.goto(web.BASE + ruta, { waitUntil: 'networkidle' }).catch(() => {});
          if (letra !== 1) await p.evaluate(agranda, letra);
          await p.waitForTimeout(250);
          const avisos = (await p.evaluate(mira)).filter((a) => !permitido(ruta, letra, a));
          if (avisos.length) {
            total += avisos.length;
            const donde = `${ruta} · ${w} · ${tema} · x${letra}`;
            console.log(`\n${donde}`);
            for (const a of avisos) console.log(`  ${a}`);
            await p.screenshot({ path: `${OUT}/${ruta.replace(/[^a-z0-9]+/gi, '_') || 'portada'}-${w}-${tema}-x${letra}.png`, fullPage: true }).catch(() => {});
          }
        }
      }
      await ctx.close();
    }
  }
} finally {
  await nav.close();
  await web.cierra();
}
console.log(total ? `\n${total} avisos.` : 'barrido: todo bien.');
process.exit(total ? 1 : 0);
