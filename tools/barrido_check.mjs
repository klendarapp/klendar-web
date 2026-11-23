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
import { mira } from './_mira.mjs';

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
