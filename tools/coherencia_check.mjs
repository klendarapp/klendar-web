// Prueba de la coherencia de tamaños del panel (Iván, 24-11; RUNBOOK
// §4zzz-coherencia1): en cada pantalla, lo que va junto tiene el mismo ancho
// y los bordes alineados, y nada se sale de su tarjeta. Con la sesión de
// mentira de _panel_simulado (Supabase falso de _web_con_datos): no toca dev
// ni prod. En Chromium y WebKit.
//
//  1. Hoy, Validar, Publicar y Negocio en el ordenador (1280 y 1920) y la
//     tablet tumbada (1024): los bloques de cada pantalla llegan a los dos
//     bordes (tools/_bordes.mjs); Hoy con dos cifras y con tres.
//  2. Lo mismo en la tablet en vertical (768) y el móvil (390 y 360), y sin
//     desplazamiento de lado.
//  3. Nada se sale de su caja; en Publicar › Tarjetas, el recuadro del texto
//     queda dentro de la tarjeta.
//  4. Validar: el código con la misma letra que los demás campos; en el
//     ordenador, el campo y «Validar» en una fila, de borde a borde.
//  5. Las pantallas de lista y formulario, de lectura (820) y centradas;
//     Publicar y Negocio, anchas.
//  6. En el móvil, los botones pequeños de la cabecera («Cerrar por hoy»),
//     a su texto.
//
//   PW=<ruta a playwright> node tools/coherencia_check.mjs
//   (arranca su serve_dev en PORT, 9411, con Supabase cortado)
import { playwright } from './_supabase_simulado.mjs';
import { webConDatos } from './_web_con_datos.mjs';
import { rpcs, conSesion } from './_panel_simulado.mjs';
import { bordesPantalla } from './_bordes.mjs';

const pw = playwright();
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const web = await webConDatos({ puerto: Number(process.env.PORT || 9411) });
const TAMANOS = [[1920, 1080], [1280, 800], [1024, 768], [768, 1024], [390, 844], [360, 780]];
const RUTAS = ['hoy', 'validar', 'publicar', 'negocio'];
try {
  for (const tipo of ['chromium', 'webkit']) {
    const nav = await pw[tipo].launch();
    for (const [w, h] of TAMANOS) {
      if (tipo === 'webkit' && ![1280, 390].includes(w)) continue;
      for (const reservas of w === 1280 ? [true, false] : [true]) {
        const ctx = await nav.newContext({ viewport: { width: w, height: h }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: w < 1000,
          ...(tipo === 'chromium' ? { isMobile: w < 800 } : {}) });
        await web.conDatos(ctx);
        await conSesion(ctx, rpcs('owner', { reservas }));
        const p = await ctx.newPage();
        const errores = [];
        p.on('pageerror', (e) => errores.push(e.message));
        const t = `${tipo} ${w}${reservas ? '' : ' (dos cifras)'}`;
        for (const ruta of reservas ? RUTAS : ['hoy']) {
          await p.goto(`${web.BASE}/panel/${ruta}`);
          await p.waitForSelector('#view h1', { timeout: 15000 });
          await p.waitForTimeout(700);
          const b = await p.evaluate(bordesPantalla);
          ok(!b.cortos.length, `${t} ${ruta}: todo llega a los dos bordes (${b.ancho} px)${b.cortos.length ? ` — ${b.cortos.map((c) => `${c.que} (${c.ancho} px, faltan ${c.izq}/${c.der})`).join(' | ')}` : ''}`);
          ok(!b.salidos.length, `${t} ${ruta}: nada se sale de su caja${b.salidos.length ? ` — ${b.salidos.slice(0, 3).map((c) => `${c.que} de ${c.de || c.por}`).join(' | ')}` : ''}`);
          const sobra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          ok(sobra <= 1, `${t} ${ruta}: sin desplazamiento de lado (${sobra} px)`);
          if (ruta === 'hoy') {
            const c = await p.$$eval('.hoy-cifra', (es) => es.length);
            ok(c === (reservas ? 3 : 2), `${t} hoy: ${reservas ? 'tres' : 'dos'} cifras`);
            if (w <= 640) {
              const anchos = await p.$eval('#pausa', (e) => [e.getBoundingClientRect().width, e.closest('#view > div').getBoundingClientRect().width]).catch(() => null);
              ok(anchos && anchos[0] < anchos[1] * 0.6, `${t} hoy: «Cerrar por hoy», a su texto (${anchos?.map(Math.round).join(' de ')} px)`);
            }
          }
          if (ruta === 'validar') {
            const letra = await p.evaluate(() => [getComputedStyle(document.querySelector('#code')).fontFamily, getComputedStyle(document.querySelector('#view input:not(#code), body')).fontFamily,
              getComputedStyle(document.querySelector('#code')).letterSpacing]);
            ok(letra[0] === letra[1] && /normal|^0/.test(letra[2]), `${t} validar: el código, con la letra de los demás (${letra[0].slice(0, 30)})`);
            if (w > 640) {
              const fila = await p.evaluate(() => { const a = document.querySelector('#code').getBoundingClientRect(); const b = document.querySelector('#go').getBoundingClientRect(); return Math.abs(a.top - b.top) < 4 && b.left > a.right; });
              ok(fila, `${t} validar: el campo y «Validar», en una fila`);
            }
          }
          if (ruta === 'publicar') {
            const dentro = await p.$$eval('.pub-item .tj', (ts) => ts.every((tj) => {
              const r = tj.getBoundingClientRect(); const q = tj.querySelector('.tj-panel').getBoundingClientRect();
              return q.bottom <= r.bottom + 0.5 && q.left >= r.left && q.right <= r.right && parseFloat(getComputedStyle(tj).borderTopWidth) > 0;
            }));
            ok(dentro, `${t} publicar: el texto de cada tarjeta, dentro de la tarjeta`);
          }
          if (w >= 1280 && reservas) {
            const ancho = await p.$eval('#view > div', (e) => [e.getBoundingClientRect().width, e.parentElement.getBoundingClientRect().width]);
            const lectura = ['hoy', 'validar'].includes(ruta);
            ok(lectura ? Math.round(ancho[0]) === 820 : ancho[0] > 900, `${t} ${ruta}: ${lectura ? 'de lectura (820)' : 'ancha'} (${Math.round(ancho[0])} px)`);
          }
        }
        ok(!errores.length, `${t}: sin errores (${errores.join(' | ')})`);
        await ctx.close();
      }
    }
    await nav.close();
  }
} finally {
  await web.cierra();
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
