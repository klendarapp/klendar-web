// Capturas de la web pública y de «Tu cuenta», pantalla por pantalla, para
// revisarlas a ojo (revisión de coherencia, parte 2; RUNBOOK §4zzz-coherencia2).
// Con los datos de mentira de _web_con_datos (lo público) y la sesión de
// mentira de _cuenta_simulado («Tu cuenta»): no toca dev ni prod. No es una
// prueba: solo hace PNG (página entera, hasta 6.000 px).
//
//   PW=<ruta a playwright> OUT=<carpeta> node tools/web_capturas.mjs
//
// Con variables (separadas por comas; sin ellas, lo de por defecto):
//   SOLO=descubre,cuenta-planes        (por defecto, todas las de PANTALLAS)
//   TAMANOS=390x844,1280x800           (por defecto, 360, 390, 768, 1024 en las dos, 1280, 1920)
//   TEMAS=light,dark                   (por defecto, light)
//   NAV=chromium|webkit                (por defecto, chromium)
//   MIDE=1                             además, los bordes (tools/_bordes.mjs) en MIDE.json
//   MIDE=solo                          solo los bordes, sin capturas
//   CSS_EXTRA=<fichero.css>            una propuesta: esa hoja encima de la página (no toca la web)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { enSuHost, playwright } from './_supabase_simulado.mjs';
import { webConDatos, NEGOCIOS, PLANES } from './_web_con_datos.mjs';
import { conSesionCuenta } from './_cuenta_simulado.mjs';
import { bordesPantalla } from './_bordes.mjs';

const oferta = PLANES.find((p) => p.kind === 'flash_offer');
const evento = PLANES.find((p) => p.kind === 'future_event' && !p.adults_only);
const sinFoto = PLANES.find((p) => p.imported);
/** [nombre, ruta, zona]: `pub` sin sesión; `cuenta` con la sesión de mentira; `sin` «Tu cuenta» sin sesión. */
export const PANTALLAS = [
  ['portada', '/', 'pub'], ['portada-en', '/en', 'pub'], ['descubre', '/descubre', 'pub'],
  ['explorar', '/explorar', 'pub'], ['explorar-sitios', '/explorar?que=sitios', 'pub'], ['explorar-mapa', '/explorar?vista=mapa', 'pub'],
  ['explorar-calendario', '/explorar?vista=calendario', 'pub'],
  ['oferta', `/o/${oferta.id}`, 'pub'], ['evento', `/o/${evento.id}`, 'pub'], ['evento-sin-foto', `/o/${sinFoto.id}`, 'pub'], ['negocio', `/b/${NEGOCIOS[0].slug}`, 'pub'],
  ['ciudad-hoy', '/hoy/madrid', 'pub'], ['ciudad-agenda', '/agenda/madrid', 'pub'], ['municipio', '/hoy/alcobendas', 'pub'], ['provincia', '/provincia/madrid', 'pub'],
  ['para-negocios', '/para-negocios', 'pub'], ['para-entidades', '/para-entidades', 'pub'], ['precios', '/precios', 'pub'],
  ['ayuda-preguntas', '/preguntas', 'pub'], ['ayuda-soporte', '/soporte', 'pub'], ['como-funciona', '/como-funciona', 'pub'], ['guia', '/guia/navidad', 'pub'],
  ['legal-privacidad', '/privacidad', 'pub'], ['legal-terminos', '/terminos', 'pub'], ['404', '/no-existe-esta', 'pub'],
  ['cuenta-sin', '/cuenta', 'sin'], ['cuenta-entrar', '/cuenta/entrar', 'sin'], ['cuenta-registro', '/cuenta/registro', 'sin'], ['cuenta-recuperar', '/cuenta/recuperar', 'sin'],
  ['eliminar-cuenta', '/eliminar-cuenta', 'pub'],
  ['cuenta', '/cuenta', 'cuenta'], ['cuenta-planes', '/cuenta/planes', 'cuenta'], ['cuenta-planes-cal', '/cuenta/planes?vista=calendario', 'cuenta'],
  ['cuenta-codigos', '/cuenta/codigos', 'cuenta'], ['cuenta-codigo', `/cuenta/codigo/${oferta.id}`, 'cuenta'], ['cuenta-favoritos', '/cuenta/favoritos', 'cuenta'],
  ['cuenta-sellos', '/cuenta/sellos', 'cuenta'], ['cuenta-ajustes', '/cuenta/ajustes', 'cuenta'], ['cuenta-ajustes-notif', '/cuenta/ajustes/notificaciones', 'cuenta'],
  ['cuenta-notificaciones', '/cuenta/notificaciones', 'cuenta'], ['cuenta-alertas', '/cuenta/alertas', 'cuenta'], ['cuenta-avisame', '/cuenta/avisame-palabra', 'cuenta'],
  ['cuenta-pedidos', '/cuenta/pedidos', 'cuenta'], ['cuenta-perfil', '/cuenta/perfil', 'cuenta'], ['cuenta-datos', '/cuenta/tus-datos', 'cuenta'],
  ['cuenta-gustos', '/cuenta/gustos', 'cuenta'], ['cuenta-reservar', `/cuenta/reservar/${evento.id}`, 'cuenta'], ['cuenta-ahorro', '/cuenta/ahorro', 'cuenta'],
];
/** Una guía («Navidad», como guias_check) para /guia/navidad: el Supabase falso no trae ninguna. */
export const RPC_GUIA = {
  guide_info: (a) => (a.p_slug === 'navidad' ? { id: 'g1', slug: 'navidad', title: { es: 'Navidad', en: 'Christmas' }, title_place: true,
    text: { es: 'Luces, belenes y mercadillos.' }, cover_url: null, place_name: a.p_lat != null ? 'Madrid' : null, scope_name: null,
    starts_on: '2026-12-01', ends_on: '2027-01-06', status: 'live', count: 5 } : null),
  guide_places: (a) => (a.p_slug === 'navidad' ? [{ code: '28079', slug: 'madrid', name: 'Madrid', province: 'Madrid', count: 4 }, { code: '29067', slug: 'malaga', name: 'Málaga', province: 'Málaga', count: 2 }] : []),
  guide_offers: () => { const items = PLANES.filter((o) => o.kind === 'future_event').slice(0, 6); return { total: items.length, items }; },
};
/** Dónde está «la pantalla» para medir sus bordes. */
export const raizDe = (zona) => (zona === 'pub' ? 'main' : '#view');

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const pw = playwright();
  const OUT = process.env.OUT || 'tools/out/web-capturas';
  mkdirSync(OUT, { recursive: true });
  const lista = (v, d) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : d);
  const SOLO = lista(process.env.SOLO, []);
  const pantallas = PANTALLAS.filter(([n]) => !SOLO.length || SOLO.includes(n));
  const TAMANOS = lista(process.env.TAMANOS, ['360x780', '390x844', '768x1024', '1024x768', '1024x1366', '1366x1024', '1280x800', '1920x1080']).map((t) => t.split('x').map(Number));
  const TEMAS = lista(process.env.TEMAS, ['light']);
  const NAV = process.env.NAV || 'chromium';
  const web = await webConDatos({ puerto: Number(process.env.PORT || 9421), rpc: RPC_GUIA });
  const nav = await pw[NAV].launch();
  let n = 0;
  const medidas = [];
  try {
    for (const [w, h] of TAMANOS) {
      for (const tema of TEMAS) {
        for (const zona of ['pub', 'sin', 'cuenta']) {
          const mias = pantallas.filter((x) => x[2] === zona);
          if (!mias.length) continue;
          const ctx = await nav.newContext({ viewport: { width: w, height: h }, colorScheme: tema, locale: 'es-ES', timezoneId: 'Europe/Madrid',
            ...(NAV === 'chromium' ? { isMobile: w < 800 } : {}), hasTouch: w < 1000 });
          await web.conDatos(ctx);
          if (zona === 'cuenta') await conSesionCuenta(ctx);
          const p = await ctx.newPage();
          for (const [nombre, ruta] of mias) {
            try {
              await p.goto(enSuHost(web.BASE, ruta), { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
              if (zona !== 'pub') await p.waitForSelector('#view h1, #view h2', { timeout: 10000 }).catch(() => {});
              if (process.env.CSS_EXTRA) await p.addStyleTag({ content: readFileSync(process.env.CSS_EXTRA, 'utf8') });
              await p.waitForTimeout(zona === 'pub' ? 500 : 800);
              const fichero = `${nombre}_${w}x${h}_${tema}${NAV === 'chromium' ? '' : `_${NAV}`}.png`;
              if (process.env.MIDE) medidas.push({ nombre, ruta, w, h, tema, nav: NAV, ...(await p.evaluate(bordesPantalla, raizDe(zona))),
                sobra: await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) });
              if (process.env.MIDE === 'solo') { n += 1; continue; }
              const alto = Math.min(6000, await p.evaluate(() => document.documentElement.scrollHeight));
              if (alto > h) { await p.setViewportSize({ width: w, height: alto }); await p.waitForTimeout(250); }
              await p.screenshot({ path: `${OUT}/${fichero}` });
              if (alto > h) await p.setViewportSize({ width: w, height: h });
              n += 1;
            } catch (e) { console.log('no pude:', nombre, w, h, tema, e.message.split('\n')[0]); }
          }
          await ctx.close();
        }
      }
    }
  } finally {
    await nav.close();
    await web.cierra();
  }
  if (process.env.MIDE) writeFileSync(`${OUT}/MIDE.json`, JSON.stringify(medidas, null, 1));
  console.log(`${n} capturas en ${OUT}`);
  process.exit(0);
}
