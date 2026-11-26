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
// Y la web pública y «Tu cuenta» (parte 2, §4zzz-coherencia2), con los datos de
// mentira de _web_con_datos y la sesión de _cuenta_simulado:
//
//  7. Descubre, Explorar (Planes y Sitios), las fichas de oferta y negocio,
//     «Tu cuenta», Planes (lista y calendario), Ajustes y Tus gustos, de 360 a
//     1.920: sin desplazamiento de lado y nada salido de su caja; en «Tu
//     cuenta», los bloques llegan a los dos bordes de su columna.
//  8. La cabecera y el pie comparten los bordes (--ancho-sitio) y Explorar
//     llega a ellos.
//  9. Planes › Calendario: las tarjetas del día como las de la lista (la foto
//     a la izquierda), no apiladas.
// 10. Ajustes › Privacidad: cada apartado en su fila, a la altura de su texto.
// 11. Ficha: «Cómo llegar» a la izquierda, con el texto de «Dónde».
// 12. En el móvil, los botones del final de la página del municipio, del
//     mismo ancho.
//
// Y el admin (parte 3, §4zzz-coherencia3), con la administradora de mentira de
// _admin_simulado (en admin.localhost, como admin.klendar.app):
//
// 13. Resumen, listas, fichas y formularios de 360 a 1.920: los bloques llegan
//     a los dos bordes, nada se sale de su caja y sin desplazamiento de lado.
// 14. Los filtros (`.toolbar`) de borde a borde en cada renglón: los que llevan
//     buscador, siempre; en el móvil, todos.
// 15. Los campos con la misma letra (16 px) y el mismo alto.
// 16. En el móvil, «Anterior», «Siguiente» y cuántas por página, en un renglón
//     de borde a borde; y los botones de la cabecera, juntos.
// 17. En una ficha, los botones de la cabecera al borde derecho (ordenador).
// 18. Todas las pantallas con el mismo ancho (--admin-ancho, 1.400, a 1.920).
//
// Y lo aprobado por Iván el 24-11 (§4zzz-propuestas), en el panel y el admin:
//
// 19. Las cifras (`.kpis`) en casillas iguales: todas del mismo ancho, con
//     tres siempre en un renglón, y nada se sale de su casilla (panel ›
//     Cifras, con Bonos, Fidelizar y «Del momento» de tres; admin › Cifras y
//     «Últimos 14 días» de una publicación), de 360 a 1.920.
// 20. Sorteos con el confeti (`celebration`), no con el regalo del Cupón, y el
//     icono pintado (la fuente del panel lo lleva: no sale su nombre).
// 21. Carteles de mesa: «Imprimir carteles de mesa» en color.
//
// Y las píldoras y el botón de la tarjeta (§4zzz-pildoras de la app, Iván,
// 25-11), en Descubre y Explorar con su propia web de mentira (publicaciones
// «Foto grande» y «Cartel» sin foto y con foto, «Minimal» sin foto, y tus
// códigos con `my_offer_states` simulada), de 360 a 1.280, claro y oscuro:
//
// 22. El aviso de debajo de los filtros (ubicación, y la visita y el viaje con
//     su misma forma) a todo el ancho de su hueco; en el móvil, con los bordes
//     de la fila de filtros; el texto a la izquierda y la × al final. En el
//     ordenador va al lado de la tarjeta, a su texto.
// 23. Una tarjeta sin foto ni vídeo no es «Foto grande» ni «Cartel» (iría sin
//     marco): lleva su panel con borde y el botón principal a lo ancho.
// 24. El botón principal de cada tarjeta, del mismo color y ancho sin sesión
//     («Conseguir el código», «Ver evento») y con tu código («Ver tu código»,
//     «Ver tu entrada»).
// 25. Con foto también (P1 y P2, Iván, 26-11): el botón principal de
//     «Foto grande» y «Cartel», coral (el mismo que el de «Clásica») y a lo
//     ancho de su panel, sin sesión y con tu código. Solo «A todo color» lo
//     lleva del color de contraste de su panel.
//
//   PW=<ruta a playwright> node tools/coherencia_check.mjs
//   SOLO=web …    solo la parte 2;  SOLO=panel …   solo la parte 1;  SOLO=admin …   solo la parte 3
//   SOLO=propuestas …   solo 19–21;  SOLO=pildoras …   solo 22–25
//   (arranca su serve_dev en PORT, 9411, con Supabase cortado)
import { playwright, SUPA, REF } from './_supabase_simulado.mjs';
import { webConDatos, DATOS, PLANES } from './_web_con_datos.mjs';
import { rpcs, conSesion } from './_panel_simulado.mjs';
import { bordesPantalla } from './_bordes.mjs';
import { conSesionCuenta } from './_cuenta_simulado.mjs';
import { PANTALLAS, RPC_GUIA, raizDe } from './web_capturas.mjs';
import { adminDe } from './_supabase_simulado.mjs';
import { PANTALLAS_ADMIN, conSesionAdmin } from './_admin_simulado.mjs';

const pw = playwright();
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const web = await webConDatos({ puerto: Number(process.env.PORT || 9411), rpc: RPC_GUIA });
const SOLO = process.env.SOLO || '';
const TAMANOS = [[1920, 1080], [1280, 800], [1024, 768], [768, 1024], [390, 844], [360, 780]];
const RUTAS = ['hoy', 'validar', 'publicar', 'negocio'];
try {
  for (const tipo of SOLO && SOLO !== 'panel' ? [] : ['chromium', 'webkit']) {
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
  if (!SOLO || SOLO === 'web') await parteWeb();
  if (!SOLO || SOLO === 'admin') await parteAdmin();
  if (!SOLO || SOLO === 'propuestas') await partePropuestas();
  if (!SOLO || SOLO === 'pildoras') await partePildoras();
} finally {
  await web.cierra();
}

/** La parte 2: la web pública y «Tu cuenta». */
async function parteWeb() {
  const ruta = (n) => PANTALLAS.find((x) => x[0] === n);
  const LISTA = ['descubre', 'explorar', 'explorar-sitios', 'oferta', 'negocio', 'municipio',
    'cuenta', 'cuenta-planes', 'cuenta-planes-cal', 'cuenta-ajustes', 'cuenta-gustos'].map(ruta);
  const WTAM = [[1920, 1080], [1280, 800], [1024, 768], [768, 1024], [390, 844], [360, 780]];
  for (const tipo of ['chromium', 'webkit']) {
    const nav = await pw[tipo].launch();
    for (const [w, h] of WTAM) {
      if (tipo === 'webkit' && ![1280, 390].includes(w)) continue;
      for (const zona of ['pub', 'cuenta']) {
        const ctx = await nav.newContext({ viewport: { width: w, height: h }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: w < 1000,
          ...(tipo === 'chromium' ? { isMobile: w < 800 } : {}) });
        await web.conDatos(ctx);
        if (zona === 'cuenta') await conSesionCuenta(ctx);
        const p = await ctx.newPage();
        const errores = [];
        p.on('pageerror', (e) => errores.push(e.message));
        for (const [nombre, dir] of LISTA.filter((x) => x[2] === zona)) {
          const t = `${tipo} ${w} ${nombre}`;
          await p.goto(`${web.BASE}${dir}`, { waitUntil: 'networkidle' }).catch(() => {});
          if (zona === 'cuenta') await p.waitForSelector('#view h1', { timeout: 15000 }).catch(() => {});
          await p.waitForTimeout(500);
          const b = await p.evaluate(bordesPantalla, raizDe(zona));
          ok(!b.salidos.length, `${t}: nada se sale de su caja${b.salidos.length ? ` — ${b.salidos.slice(0, 3).map((c) => `${c.que} de ${c.de || c.por}`).join(' | ')}` : ''}`);
          if (zona === 'cuenta') ok(!b.cortos.length, `${t}: todo llega a los dos bordes (${b.ancho} px)${b.cortos.length ? ` — ${b.cortos.map((c) => `${c.que} (${c.ancho} px, faltan ${c.izq}/${c.der})`).join(' | ')}` : ''}`);
          const sobra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          ok(sobra <= 1, `${t}: sin desplazamiento de lado (${sobra} px)`);
          if (w >= 1280 && ['explorar', 'oferta', 'cuenta-ajustes'].includes(nombre)) {
            // La cabecera y el pie, con los mismos bordes; Explorar, también.
            const r = await p.evaluate(() => {
              const visible = (e) => e && e.getClientRects().length > 0;
              const caja = (e) => { if (!visible(e)) return null; const q = e.getBoundingClientRect(); const cs = getComputedStyle(e);
                return [Math.round(q.left + parseFloat(cs.paddingLeft)), Math.round(q.right - parseFloat(cs.paddingRight))]; };
              return { cab: caja(document.querySelector('header.top .wrap')), pie: caja([...document.querySelectorAll('footer > .wrap')].find(visible)),
                main: caja(document.querySelector('main.pub')) };
            });
            ok(r.cab && r.pie && Math.abs(r.cab[0] - r.pie[0]) <= 1 && Math.abs(r.cab[1] - r.pie[1]) <= 1, `${t}: la cabecera y el pie, con los mismos bordes (${r.cab} / ${r.pie})`);
            if (nombre === 'explorar') ok(r.main && Math.abs(r.main[0] - r.cab[0]) <= 1 && Math.abs(r.main[1] - r.cab[1]) <= 1, `${t}: Explorar llega a los bordes de la cabecera (${r.main} / ${r.cab})`);
          }
          if (nombre === 'cuenta-planes-cal') {
            const fila = await p.$$eval('#view .pl-lista .ocard', (cs) => cs.length > 0 && cs.every((c) => {
              const im = c.querySelector('img, .ph'); const tx = c.querySelector('.ocard-body');
              return getComputedStyle(c).display === 'flex' && im && tx && im.getBoundingClientRect().right <= tx.getBoundingClientRect().left;
            }));
            ok(fila, `${t}: las tarjetas del día, con la foto a la izquierda (como la lista)`);
          }
          if (nombre === 'cuenta-ajustes' && w > 560) {
            const filas = await p.$$eval('#view .consen > dt:not([hidden])', (dts) => dts.length > 0 && dts.every((dt) => {
              const dd = dt.nextElementSibling;
              return dd && Math.abs(dd.getBoundingClientRect().top - dt.getBoundingClientRect().top) < 4 && dd.getBoundingClientRect().left > dt.getBoundingClientRect().right;
            }));
            ok(filas, `${t}: Privacidad, cada apartado en su fila`);
          }
          if (nombre === 'cuenta-gustos') {
            const anchos = await p.evaluate(() => {
              const v = document.querySelector('#view'); const cs = getComputedStyle(v);
              return [document.querySelector('#fg').getBoundingClientRect().width, v.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)];
            });
            ok(Math.abs(anchos[0] - anchos[1]) <= 2, `${t}: el formulario, al ancho de la pantalla (${anchos.map(Math.round).join(' de ')})`);
          }
          if (nombre === 'oferta') {
            const izq = await p.evaluate(() => {
              const a = document.querySelector('.d-body .acciones.toques > *'); const d = document.querySelector('.d-body');
              return a && d ? Math.round(a.getBoundingClientRect().left - d.getBoundingClientRect().left) : null;
            });
            ok(izq !== null && izq <= 2, `${t}: «Cómo llegar», a la izquierda (${izq} px)`);
          }
          if (nombre === 'municipio' && w <= 560) {
            const ws = await p.$$eval('main.pub > p:has(> .pill + .pill) > .pill', (as) => as.map((a) => Math.round(a.getBoundingClientRect().width)));
            ok(ws.length >= 2 && new Set(ws).size === 1, `${t}: los botones del final, del mismo ancho (${ws.join(', ')})`);
          }
        }
        ok(!errores.length, `${tipo} ${w} ${zona}: sin errores (${errores.join(' | ')})`);
        await ctx.close();
      }
    }
    await nav.close();
  }
}
/** La parte 3: el admin (admin.localhost, como admin.klendar.app). */
async function parteAdmin() {
  const LISTA = ['resumen', 'negocios', 'negocio', 'publicacion', 'canjes', 'usuarios', 'duplicados', 'avisos', 'festivos', 'configuracion']
    .map((n) => PANTALLAS_ADMIN.find((x) => x[0] === n));
  const ADMIN = adminDe(web.BASE);
  const ATAM = [[1920, 1080], [1280, 800], [1024, 768], [768, 1024], [390, 844], [360, 780]];
  for (const tipo of ['chromium', 'webkit']) {
    const nav = await pw[tipo].launch();
    for (const [w, h] of ATAM) {
      if (tipo === 'webkit' && ![1280, 390].includes(w)) continue;
      const ctx = await nav.newContext({ viewport: { width: w, height: h }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: w < 1000,
        ...(tipo === 'chromium' ? { isMobile: w < 800 } : {}) });
      await web.conDatos(ctx);
      await conSesionAdmin(ctx);
      const p = await ctx.newPage();
      const errores = [];
      p.on('pageerror', (e) => errores.push(e.message));
      const anchos = new Set();
      for (const [nombre, ruta] of LISTA) {
        const t = `${tipo} ${w} admin ${nombre}`;
        await p.goto(ADMIN + ruta, { waitUntil: 'networkidle' }).catch(() => {});
        await p.waitForSelector('#view h1', { timeout: 15000 }).catch(() => {});
        await p.waitForFunction(() => !document.querySelector('#view .loading'), null, { timeout: 6000 }).catch(() => {});
        await p.waitForTimeout(400);
        const b = await p.evaluate(bordesPantalla, '#view > div');
        ok(!b.cortos.length, `${t}: todo llega a los dos bordes (${b.ancho} px)${b.cortos.length ? ` — ${b.cortos.map((c) => `${c.que} (${c.ancho} px, faltan ${c.izq}/${c.der})`).join(' | ')}` : ''}`);
        ok(!b.salidos.length, `${t}: nada se sale de su caja${b.salidos.length ? ` — ${b.salidos.slice(0, 3).map((c) => `${c.que} de ${c.de || c.por}`).join(' | ')}` : ''}`);
        const sobra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        ok(sobra <= 1, `${t}: sin desplazamiento de lado (${sobra} px)`);
        anchos.add(b.ancho);
        const r = await p.evaluate((movil) => {
          const visible = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
          const caja = (e) => { const q = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { l: q.left + parseFloat(cs.paddingLeft), r: q.right - parseFloat(cs.paddingRight) }; };
          // 14. Cada renglón de filtros, de borde a borde (los que llevan
          // buscador; en el móvil, todos los que llevan campos).
          const filtros = [];
          for (const tb of document.querySelectorAll('#view .toolbar')) {
            const hijos = [...tb.children].filter(visible);
            if (!visible(tb) || !hijos.some((x) => x.matches('input, select, label.f'))) continue;
            if (!movil && !tb.querySelector(':scope > .grow')) continue;
            const c = caja(tb);
            const filas = [];
            for (const x of hijos) {
              const q = x.getBoundingClientRect();
              const f = filas.find((y) => Math.abs(y.top - q.top) < 8);
              if (f) { f.l = Math.min(f.l, q.left); f.r = Math.max(f.r, q.right); } else filas.push({ top: q.top, l: q.left, r: q.right });
            }
            for (const f of filas) if (f.l - c.l > 2 || c.r - f.r > 2) filtros.push(`${tb.firstElementChild?.id || tb.firstElementChild?.tagName} (faltan ${Math.round(f.l - c.l)}/${Math.round(c.r - f.r)})`);
          }
          // 15. Los campos: la misma letra y el mismo alto (los de las tablas,
          // el pie de la lista y el estado de una sugerencia van en pequeño).
          const campos = [...document.querySelectorAll('#view input, #view select')].filter((e) => visible(e)
            && !/^(checkbox|radio|file|hidden|range|color)$/.test(e.type) && !e.closest('.pager, .estado-sel, table, .mfa-code'));
          const letras = [...new Set(campos.map((e) => getComputedStyle(e).fontSize))];
          const altos = campos.filter((e) => e.tagName === 'SELECT' || /^(text|search|email|date|number|url|tel|password)$/.test(e.type)).map((e) => Math.round(e.getBoundingClientRect().height));
          // 16. El pie de las listas y los botones de la cabecera.
          const pie = [...document.querySelectorAll('#view .pager')].filter(visible).map((pg) => {
            const xs = [...pg.querySelectorAll(':scope > .btn, :scope > select')].map((e) => e.getBoundingClientRect());
            const c = caja(pg);
            return xs.length === 3 && xs.every((q) => Math.abs(q.top - xs[0].top) < 8) && Math.abs(Math.min(...xs.map((q) => q.left)) - c.l) <= 2 && Math.abs(Math.max(...xs.map((q) => q.right)) - c.r) <= 2;
          });
          const cab = [...document.querySelectorAll('#view .page-head')].filter(visible).map((ph) => {
            const bs = [...ph.querySelectorAll(':scope > .btn, :scope > .menu')].filter(visible).map((e) => e.getBoundingClientRect().top);
            return bs.length < 2 || bs.every((y) => Math.abs(y - bs[0]) < 8);
          });
          // 17. Los botones de la cabecera de una ficha, al borde derecho.
          const ficha = document.querySelector('#view .detail-head');
          const acc = ficha?.querySelector(':scope > .actions');
          const derecha = acc ? Math.round(caja(ficha).r - acc.getBoundingClientRect().right) : null;
          return { filtros, letras, altos: [Math.min(...altos), Math.max(...altos)], pie, cab, derecha };
        }, w <= 560);
        ok(!r.filtros.length, `${t}: los filtros, de borde a borde en cada renglón${r.filtros.length ? ` — ${r.filtros.join(' | ')}` : ''}`);
        ok(r.letras.length <= 1 && (!r.letras.length || r.letras[0] === '16px'), `${t}: los campos, con la misma letra (${r.letras.join(', ')})`);
        ok(!Number.isFinite(r.altos[0]) || r.altos[1] - r.altos[0] <= 3, `${t}: los campos, del mismo alto (${r.altos.join('–')} px)`);
        if (w <= 560) {
          ok(r.pie.every(Boolean), `${t}: el pie de la lista, en un renglón de borde a borde`);
          ok(r.cab.every(Boolean), `${t}: los botones de la cabecera, juntos`);
        }
        if (w >= 1024 && r.derecha !== null) ok(Math.abs(r.derecha) <= 2, `${t}: los botones de la ficha, al borde derecho (faltan ${r.derecha} px)`);
      }
      ok(anchos.size === 1, `${tipo} ${w} admin: todas las pantallas con el mismo ancho (${[...anchos].join(', ')})`);
      if (w === 1920) ok([...anchos][0] === 1400 - 56, `${tipo} ${w} admin: al ancho del admin (1.400 menos el relleno: ${[...anchos].join(', ')})`);
      ok(!errores.length, `${tipo} ${w} admin: sin errores (${errores.join(' | ')})`);
      await ctx.close();
    }
    await nav.close();
  }
}
/** 19: cada `.kpis` visible, en casillas iguales (tres en un renglón) y sin
 * nada salido de su casilla. */
function cifrasIguales() {
  const mal = [];
  for (const k of document.querySelectorAll('#view .kpis')) {
    const hijos = [...k.children].filter((e) => e.getClientRects().length > 0);
    if (hijos.length < 2) continue;
    const rs = hijos.map((e) => e.getBoundingClientRect());
    const anchos = rs.map((r) => Math.round(r.width));
    const que = k.closest('.card')?.querySelector('h2, h3')?.textContent?.trim().slice(0, 30) || k.className;
    if (Math.max(...anchos) - Math.min(...anchos) > 1) mal.push(`${que}: anchos ${anchos.join('/')}`);
    if (hijos.length === 3 && rs.some((r) => Math.abs(r.top - rs[0].top) > 1)) mal.push(`${que}: tres cifras en dos renglones`);
    for (const e of hijos) if (e.scrollWidth > e.clientWidth + 1) mal.push(`${que}: «${e.textContent.trim().slice(0, 20)}» se sale de su casilla`);
  }
  return mal;
}

/** La parte de lo aprobado el 24-11 (§4zzz-propuestas). */
async function partePropuestas() {
  const INFORME = {
    from: null,
    totals: {
      views: 120, codes: 30, redeemed: 22, unused: 8, favorites: 9, brought_visits: 22, brought_priced: 20, brought_cents: 45000, currency: 'EUR',
      ratings: 12, rating: 4.6, passes: { sold: 6, uses: 23, active: 10, sold_cents: 54000 }, spot: { given: 3, gifts: 1, stamps: 1, pass_uses: 1 },
    },
    loyalty: { customers: 10, repeat_customers: 4, new_customers: 6, coupons_given: 5, coupons_redeemed: 2, thanks_redeemed: 1, birthday_redeemed: 0 },
    stamps: { given: 14, rewards_redeemed: 2, visit: 4, redemption: 10 }, daily: [], by_hour: [], offers: [], redemptions: [],
  };
  const SORTEOS_ON = { enabled: true, platforms: ['web', 'android', 'ios'] };
  const ADMIN = adminDe(web.BASE);
  const ATAM = [[1920, 1080], [1280, 800], [1024, 768], [768, 1024], [390, 844], [360, 780]];
  for (const tipo of ['chromium', 'webkit']) {
    const nav = await pw[tipo].launch();
    for (const [w, h] of ATAM) {
      if (tipo === 'webkit' && ![1280, 390].includes(w)) continue;
      const opc = { viewport: { width: w, height: h }, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: w < 1000, ...(tipo === 'chromium' ? { isMobile: w < 800 } : {}) };
      // El panel.
      const ctx = await nav.newContext(opc);
      await web.conDatos(ctx);
      await conSesion(ctx, { ...rpcs('owner'), business_report: INFORME,
        business_table_qr: { ok: true, token: 'tok123', ssid: 'Bar Sonda', password: 'cafe1234', scans_month: 142, can_change: true } });
      // Los sorteos encendidos (app_config.giveaways), para ver su icono.
      await ctx.route(`${SUPA}/rest/v1/app_config**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ value: SORTEOS_ON }]) }));
      const p = await ctx.newPage();
      const errores = [];
      p.on('pageerror', (e) => errores.push(e.message));
      const t = `${tipo} ${w}`;
      await p.goto(`${web.BASE}/panel/informe`);
      await p.waitForSelector('#view .kpis', { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(500);
      // Abiertos los plegables, para medir también sus cifras.
      await p.evaluate(() => document.querySelectorAll('#view details').forEach((d) => { d.open = true; }));
      const tres = await p.$$eval('#view .kpis', (ks) => ks.filter((k) => k.children.length === 3).length);
      ok(tres >= 3, `${t} panel cifras: con bloques de tres cifras para mirar (${tres})`);
      const mal = await p.evaluate(cifrasIguales);
      ok(!mal.length, `${t} panel cifras: en casillas iguales, tres en un renglón${mal.length ? ` — ${mal.join(' | ')}` : ''}`);
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(sobra <= 1, `${t} panel cifras: sin desplazamiento de lado (${sobra} px)`);
      if (w === 1280 || w === 390) {
        await p.goto(`${web.BASE}/panel/fidelizar`);
        await p.waitForSelector('#view .fiel-card', { timeout: 15000 }).catch(() => {});
        await p.evaluate(() => document.fonts.ready);
        await p.waitForTimeout(300);
        const ic = await p.evaluate(() => [...document.querySelectorAll('#view .fiel-card h2')].map((h) => {
          const s = h.querySelector('.ms');
          return [h.textContent.replace(s?.textContent || '', '').trim(), s?.textContent || '', Math.round(s?.getBoundingClientRect().width || 0)];
        }));
        const sorteo = ic.find(([n]) => n === 'Sorteos');
        const cupon = ic.find(([n]) => /^Cupón/.test(n));
        ok(sorteo && sorteo[1] === 'celebration' && sorteo[2] <= 32, `${t} panel fidelizar: Sorteos con el confeti, pintado (${sorteo})`);
        ok(cupon && cupon[1] === 'redeem', `${t} panel fidelizar: el Cupón con el regalo (${cupon})`);
        const repes = ic.map(([, i]) => i).filter((i, n, a) => i && a.indexOf(i) !== n);
        ok(!repes.length, `${t} panel fidelizar: ningún icono repetido (${repes})`);
        await p.goto(`${web.BASE}/panel/wifi-clientes`);
        await p.waitForSelector('#imprimir', { timeout: 15000 }).catch(() => {});
        ok(await p.$eval('#imprimir', (a) => a.classList.contains('primary')).catch(() => false), `${t} panel carteles de mesa: imprimir, en color`);
      }
      ok(!errores.length, `${t} panel propuestas: sin errores (${errores.join(' | ')})`);
      await ctx.close();
      // El admin.
      const cta = await nav.newContext(opc);
      await web.conDatos(cta);
      await conSesionAdmin(cta);
      const q = await cta.newPage();
      const errA = [];
      q.on('pageerror', (e) => errA.push(e.message));
      for (const n of ['cifras', 'publicacion']) {
        const ruta = PANTALLAS_ADMIN.find((x) => x[0] === n)[1];
        await q.goto(ADMIN + ruta, { waitUntil: 'networkidle' }).catch(() => {});
        await q.waitForSelector('#view h1', { timeout: 15000 }).catch(() => {});
        await q.waitForFunction(() => !document.querySelector('#view .loading'), null, { timeout: 6000 }).catch(() => {});
        await q.waitForTimeout(400);
        const tres = await q.$$eval('#view .kpis', (ks) => ks.filter((k) => k.children.length === 3).length);
        ok(n !== 'publicacion' || tres >= 1, `${t} admin ${n}: con «Últimos 14 días» de tres (${tres})`);
        const malA = await q.evaluate(cifrasIguales);
        ok(!malA.length, `${t} admin ${n}: cifras en casillas iguales, tres en un renglón${malA.length ? ` — ${malA.join(' | ')}` : ''}`);
      }
      if (w === 1280) {
        const icono = await q.$eval('a.nav[href="/sorteos"] .ms', (s) => s.textContent).catch(() => null);
        ok(icono === 'celebration', `${t} admin: Sorteos en el menú con el confeti (${icono})`);
      }
      ok(!errA.length, `${t} admin propuestas: sin errores (${errA.join(' | ')})`);
      await cta.close();
    }
    await nav.close();
  }
}

/** Las píldoras de la franja y el botón de la tarjeta (§4zzz-pildoras). */
async function partePildoras() {
  // «Foto grande» y «Cartel» sin foto (oferta y evento), «Foto grande» con
  // foto y «Minimal» sin foto; lo demás, como siempre.
  const flash = PLANES.filter((o) => o.kind === 'flash_offer');
  const eventos = PLANES.filter((o) => o.kind === 'future_event');
  const cambia = new Map([
    [flash[0].id, { style: { template: 'photo' }, images: [] }],
    [flash[1].id, { style: { template: 'poster' }, images: [] }],
    [flash[2].id, { style: { template: 'photo' } }],
    [flash[3].id, { style: { template: 'minimal' }, images: [] }],
    [eventos[0].id, { style: { template: 'poster' }, images: [] }],
    [eventos[1].id, { style: { template: 'photo' }, images: [] }],
    // Con foto (25).
    [eventos[2].id, { style: { template: 'poster' } }],
    [eventos[3].id, { style: { template: 'photo' } }],
  ]);
  const planes = PLANES.map((o) => (cambia.has(o.id) ? { ...o, ...cambia.get(o.id) } : o));
  const hora = (h) => new Date(Date.now() + h * 3600e3).toISOString();
  // Con sesión, de todo «tu código» (o «tu entrada»): el botón cambia de texto, no de forma.
  const mios = Object.fromEntries(planes.map((o) => [o.id, { offer_id: o.id, state: 'code', kind: o.kind, expires_at: hora(2), used: 0, max_per_user: 1 }]));
  const w2 = await webConDatos({ puerto: Number(process.env.PORT || 9411) + 30, datos: { ...DATOS, PLANES: planes },
    rpc: { my_offer_states: (a) => (a.p_offers || []).map((id) => mios[id]).filter(Boolean) } });
  const U = '0e7717e0-0000-4000-8000-0000000b1d0a';
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'pildoras@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const sesion = JSON.stringify({ access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })}.firma`,
    refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
  // Cada tarjeta: su plantilla, si va sin foto, su panel y su botón principal.
  const tarjetas = () => [...document.querySelectorAll('[data-o].tj:not(.tj-fila)')].filter((c) => c.getClientRects().length).map((c) => {
    const cta = [...c.querySelectorAll('.tj-cta')].find((b) => !b.hidden && b.getClientRects().length);
    const panel = c.querySelector('.tj-panel'); const cp = getComputedStyle(panel);
    const contenido = panel.getBoundingClientRect().width - parseFloat(cp.paddingLeft) - parseFloat(cp.paddingRight) - parseFloat(cp.borderLeftWidth) - parseFloat(cp.borderRightWidth);
    return { id: c.getAttribute('data-o'), clase: [...c.classList].filter((k) => /^tj--(glass|photo|poster|bold|minimal)$/.test(k)).join(''),
      pantalla: c.classList.contains('tj--pantalla'), sinFoto: !!c.querySelector('.tj-media :is(.sin-foto, .tj-ph)'),
      borde: parseFloat(cp.borderTopWidth), contenido: Math.round(contenido),
      cta: cta ? { fondo: getComputedStyle(cta).backgroundColor, ancho: Math.round(cta.getBoundingClientRect().width), mio: cta.classList.contains('tj-mio--codigo'),
        hecha: cta.classList.contains('tj-mio--hecha'), texto: cta.textContent.trim() } : null };
  });
  // Un aviso de la franja: dónde está, su hueco, los filtros, el texto y la ×.
  const mideAviso = (cual) => {
    const av = [...document.querySelectorAll(`.feed-aviso[data-aviso="${cual}"]`)].find((e) => e.getClientRects().length);
    if (!av) return null;
    const r = (e) => e.getBoundingClientRect();
    const caja = r(av.parentElement); const q = r(av);
    const txt = av.querySelector('.feed-aviso-t span:not([aria-hidden])'); const ic = av.querySelector('.feed-aviso-t .ic');
    const x = av.querySelector('.feed-aviso-x');
    const chip = document.querySelector('.feed-cab .barra-filtros summary.chip'); const fil = document.querySelector('.feed-cab .barra-filtros .chip-filtros');
    const rango = document.createRange(); rango.selectNodeContents(txt);
    return { izq: Math.round(q.left), der: Math.round(q.right), cajaIzq: Math.round(caja.left), cajaDer: Math.round(caja.right),
      filtrosIzq: chip && Math.round(r(chip).left), filtrosDer: fil && Math.round(r(fil).right),
      hueco: Math.round(rango.getBoundingClientRect().left - (ic ? r(ic).right : q.left)), xFinal: x ? Math.round(q.right - r(x).right) : 0,
      lado: getComputedStyle(av.parentElement).position === 'absolute' && innerWidth / innerHeight > 1.2 };
  };
  // La visita, con la forma que le da /assets/avisos.js (el viaje, de gustos.js, es igual).
  const ponVisita = () => {
    const caja = document.getElementById('feed-avisos'); if (!caja) return;
    caja.querySelectorAll('.feed-aviso').forEach((a) => { a.hidden = true; a.style.setProperty('display', 'none', 'important'); });
    const v = document.createElement('div'); v.className = 'feed-aviso'; v.setAttribute('data-aviso', 'visita');
    v.innerHTML = '<a class="feed-aviso-t" href="/"><svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"></svg><span>Volver a cerca de mí</span><span aria-hidden="true">›</span></a><button type="button" class="feed-aviso-x" aria-label="Cerrar">×</button>';
    caja.hidden = false; caja.appendChild(v);
  };
  const TAM = [[1280, 800], [1024, 768], [768, 1024], [412, 915], [390, 844], [360, 780]];
  for (const tipo of ['chromium', 'webkit']) {
    const nav = await pw[tipo].launch();
    for (const [w, h] of TAM) {
      if (tipo === 'webkit' && ![1280, 390].includes(w)) continue;
      for (const tema of ['dark', 'light']) {
        if (tipo === 'webkit' && tema === 'light') continue;
        const t = `${tipo} ${w} ${tema}`;
        const opc = { viewport: { width: w, height: h }, colorScheme: tema, locale: 'es-ES', timezoneId: 'Europe/Madrid', hasTouch: w < 1000,
          ...(tipo === 'chromium' ? { isMobile: w < 800 } : {}) };
        const antes = {};
        for (const conSesion of [false, true]) {
          const ctx = await nav.newContext(opc);
          await w2.conDatos(ctx);
          if (conSesion) {
            await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* */ } }, [`sb-${REF}-auth-token`, sesion]);
            await ctx.route(`${SUPA}/auth/v1/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json',
              body: JSON.stringify(new URL(route.request().url()).pathname.startsWith('/auth/v1/user') ? USER : {}) }));
          }
          const p = await ctx.newPage();
          const errores = [];
          p.on('pageerror', (e) => errores.push(e.message));
          for (const dir of ['/descubre', '/explorar?vista=lista']) {
            const d = `${t}${conSesion ? ' con tu código' : ''} ${dir}`;
            await p.goto(`${w2.BASE}${dir}`, { waitUntil: 'networkidle' }).catch(() => {});
            if (conSesion) await p.waitForSelector('.tj-mio--codigo', { timeout: 8000 }).catch(() => {});
            await p.waitForTimeout(400);
            const ts = await p.evaluate(tarjetas);
            const sinFoto = ts.filter((c) => c.sinFoto);
            ok(sinFoto.length >= 3, `${d}: hay tarjetas sin foto que mirar (${sinFoto.length})`);
            // 23. Sin foto: con marco y el botón a lo ancho, nunca «Foto grande» ni «Cartel».
            const malas = sinFoto.filter((c) => /photo|poster/.test(c.clase) || !(c.borde > 0) || !c.cta || c.cta.ancho < c.contenido - 2);
            ok(!malas.length, `${d}: sin foto, con marco y el botón principal a lo ancho${malas.length ? ` — ${malas.map((c) => `${c.clase} borde ${c.borde}, botón ${c.cta?.ancho} de ${c.contenido}`).join(' | ')}` : ''}`);
            // 24. El mismo botón en todos sus estados.
            if (!conSesion) {
              for (const c of ts) if (c.cta) antes[`${dir} ${c.id} ${c.pantalla}`] = c.cta;
            } else {
              const suyos = ts.filter((c) => c.cta?.mio);
              ok(suyos.length >= 3, `${d}: «Ver tu código» / «Ver tu entrada» en las tarjetas (${suyos.length})`);
              const distintos = suyos.filter((c) => { const a = antes[`${dir} ${c.id} ${c.pantalla}`];
                return a && (a.fondo !== c.cta.fondo || Math.abs(a.ancho - c.cta.ancho) > 1); });
              ok(!distintos.length, `${d}: el botón principal, del mismo color y ancho con tu código${distintos.length ? ` — ${distintos.map((c) => { const a = antes[`${dir} ${c.id} ${c.pantalla}`]; return `${c.clase} «${a.texto}» ${a.fondo} ${a.ancho} / «${c.cta.texto}» ${c.cta.fondo} ${c.cta.ancho}`; }).join(' | ')}` : ''}`);
            }
            // 25. Con foto, «Foto grande» y «Cartel»: coral como «Clásica» y a lo ancho.
            const coral = ts.find((c) => c.clase === 'tj--glass' && c.cta && !c.cta.hecha)?.cta.fondo;
            const conFoto = ts.filter((c) => !c.sinFoto && /photo|poster/.test(c.clase) && c.cta && !c.cta.hecha);
            ok(conFoto.length >= 1 && coral, `${d}: hay «Foto grande» o «Cartel» con foto que mirar (${conFoto.length})`);
            const feas = conFoto.filter((c) => c.cta.fondo !== coral || c.cta.ancho < c.contenido - 2);
            ok(!feas.length, `${d}: con foto, el botón principal coral y a lo ancho${feas.length ? ` — ${feas.map((c) => `${c.clase} ${c.cta.fondo} (coral ${coral}), botón ${c.cta.ancho} de ${c.contenido}`).join(' | ')}` : ''}`);
            // 22. El aviso de la franja (el de la ubicación sale sin zona elegida).
            if (dir === '/descubre' && !conSesion) {
              for (const cual of ['ubicacion', 'visita']) {
                if (cual === 'visita') await p.evaluate(ponVisita);
                const a = await p.evaluate(mideAviso, cual);
                // WebKit no tiene la consulta del permiso: ahí no sale el de la ubicación.
                if (!a) { ok(tipo === 'webkit' && cual === 'ubicacion', `${t} Descubre: sale el aviso de ${cual}`); continue; }
                if (a.lado) continue; // En el ordenador, al lado de la tarjeta y a su texto.
                ok(Math.abs(a.izq - a.cajaIzq) <= 1 && Math.abs(a.der - a.cajaDer) <= 1, `${t} Descubre: el aviso de ${cual}, a todo el ancho de su hueco (${a.izq}–${a.der} en ${a.cajaIzq}–${a.cajaDer})`);
                if (w <= 760) ok(Math.abs(a.izq - a.filtrosIzq) <= 1 && Math.abs(a.der - a.filtrosDer) <= 1, `${t} Descubre: el aviso de ${cual}, con los bordes de los filtros (${a.izq}–${a.der} y ${a.filtrosIzq}–${a.filtrosDer})`);
                ok(a.hueco <= 12 && a.xFinal <= 2, `${t} Descubre: el aviso de ${cual}, el texto a la izquierda (${a.hueco} px) y la × al final (${a.xFinal} px)`);
              }
            }
          }
          ok(!errores.length, `${t}${conSesion ? ' con sesión' : ''} píldoras: sin errores (${errores.join(' | ')})`);
          await ctx.close();
        }
      }
    }
    await nav.close();
  }
  await w2.cierra();
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
