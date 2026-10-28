// Prueba de lo publicado el 2026-10-28 (RF18–RF22, aprobados por Iván ese
// día; lo legal que no cuadraba con el código en el repaso final), en la web
// local:
//
//  1. Cookies (ES y EN): `klendar.filtros` como lo hace la web (hasta que los
//     cambies o los quites; ¿Cuándo?, a las 6:00; la posición, 6 horas), las
//     filas nuevas `klendar.explorar` y `klendar.trazo`, la librería de los
//     mapas desde api.mapbox.com, `klendar_18` hasta cerrar sesión y la
//     vuelta de Google (sin Apple) en la fila PKCE (RF18, RF21, RF22).
//  2. Privacidad (ES y EN): la ubicación de «Avísame si…» y de los partidos,
//     de los últimos 7 días (no 30), y la librería de los mapas (RF18, RF19).
//  3. Condiciones para negocios (ES y EN), 4 bis / 4a: «no bloquea (hasta 14
//     días)», el aviso de arriba con el 28-10 desde el 12-11 y el historial
//     (RF20).
//  4. «Tu cuenta»: sin «Continuar con Apple» aunque el proyecto tenga Apple
//     activo (RF21), y la cookie `klendar_18` se borra al cerrar sesión en
//     «Tu cuenta» (y el panel y las páginas públicas lo hacen, RF22).
//  5. Fecha, historial y sin desplazamiento horizontal.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_rf_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8871';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/cookies/', 'Última actualización: 28 de octubre de 2026', [
    /klendar\.filtros\s+Descubre y Explorar \(almacenamiento local\)[\s\S]*?Hasta que los cambies o pulses «Quitar filtros»; ¿Cuándo\? se quita a las 6:00 y tu posición deja de usarse a las 6 horas\s+Preferencia elegida por ti/,
    /klendar\.explorar\s+Explorar \(almacenamiento local\)\s+La última vista que elegiste en Explorar \(Planes o Sitios; lista, mapa o calendario\), para abrirlo ahí la próxima vez\s+Hasta que la cambies\s+Preferencia elegida por ti/,
    /klendar\.trazo\s+Todo klendar\.app \(almacenamiento de sesión\)\s+Que la animación del logo \(el símbolo que se dibuja\) salga solo en la primera página que abres, no en cada una\s+Hasta cerrar la pestaña\s+Técnica/,
    /según tu fecha de nacimiento\s+1 año, o hasta que cierres sesión\s+Preferencia elegida por ti/,
    /comprueba que la vuelta de Google llega al mismo navegador/,
    /La única excepción es la librería de los mapas \(Mapbox GL JS\), que tu navegador descarga de api\.mapbox\.com solo cuando abres un mapa\./,
    /Mapbox: los mapas de Explorar, del panel y de «Pedir un local», y la librería que los dibuja\./,
    /Al cerrar sesión se borran la sesión, la copia de tus códigos, tus gustos, lo del panel y la cookie klendar_18\./,
    /28 de octubre de 2026: Tus filtros se recuerdan hasta que los cambies o los quites/,
  ], [/Se usa durante 6 horas/, /vuelta de Google o Apple/]],
  ['/en/cookies/', 'Last updated: 28 October 2026', [
    /klendar\.filtros\s+Discover and Explore \(local storage\)[\s\S]*?Until you change them or tap “Clear filters”; “When\?” is cleared at 6:00 and your position stops being used after 6 hours\s+Preference you chose/,
    /klendar\.explorar\s+Explore \(local storage\)\s+The last view you chose in Explore \(Plans or Places; list, map or calendar\), so it opens there next time\s+Until you change it\s+Preference you chose/,
    /klendar\.trazo\s+All of klendar\.app \(session storage\)\s+So the logo animation \(the symbol drawing itself\) only plays on the first page you open, not on every one\s+Until you close the tab\s+Technical/,
    /from your date of birth\s+1 year, or until you log out\s+Preference you chose/,
    /checks that the return from Google reaches the same browser/,
    /The only exception is the map library \(Mapbox GL JS\), which your browser downloads from api\.mapbox\.com only when you open a map\./,
    /When you log out, your session, the copy of your codes, your interests, the dashboard data and the klendar_18 cookie are deleted\./,
    /28 October 2026: Your filters are remembered until you change or clear them/,
  ], [/Used for 6 hours/, /return from Google or Apple/]],
  ['/privacidad/', 'Última actualización: 29 de octubre de 2026', [
    /tu ciudad o tu última ubicación conocida de los últimos 7 días; no guardamos ninguna otra/,
    /de tu última ubicación \(de los últimos 7 días\) o tu ciudad/,
    /salvo la librería de los mapas \(Mapbox GL JS\), que descarga de Mapbox \(api\.mapbox\.com\) al abrir un mapa/,
    /28 de octubre de 2026: La ubicación que se usa para «Avísame si…»/,
  ], [/últimos 30 días/]],
  ['/en/privacy/', 'Last updated: 29 October 2026', [
    /your city or your last known location from the past 7 days; we don’t keep any other/,
    /your last location \(from the last 7 days\) or your city/,
    /except the map library \(Mapbox GL JS\), which it downloads from Mapbox \(api\.mapbox\.com\) when you open a map/,
    /28 October 2026: The location used for “Tell me when…”/,
  ], [/(past|last) 30 days/]],
  ['/negocios/', 'Última actualización: 28 de octubre de 2026', [
    /Un cobro por domiciliación que aún se está procesando no bloquea \(hasta 14 días\)\./,
    /y los del 28 de octubre de 2026 \(apartados 2, 4 bis y 7\), desde el 12 de noviembre de 2026: 15 días/,
    /28 de octubre de 2026: Pagos pendientes y bloqueo \(apartado 4 bis\): un cobro por domiciliación que aún se está procesando no bloquea durante 14 días como mucho\. Se aplica desde el 12 de noviembre de 2026\./,
  ], [/se está procesando no bloquea\. /]],
  ['/en/business-terms/', 'Last updated: 28 October 2026', [
    /A direct debit payment still being processed doesn't block \(for up to 14 days\)\./,
    /and those of 28 October 2026 \(sections 2, 4a and 7\) from 12 November 2026: 15 days/,
    /28 October 2026: Outstanding payments and blocking \(section 4a\)[\s\S]*?It applies from 12 November 2026\./,
  ], [/being processed doesn't block\. /]],
];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas, nunca] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const txt = `${await p.locator('body').innerText()}
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    for (const re of nunca) ok(!re.test(txt), `${nombre}/${t} ${ruta}: sin ${re.source}`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0),
      `${nombre}/${t} ${ruta}: sin desplazamiento horizontal`);
  }
  ok(errores.length === 0, `${nombre}/${t}: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

const conEdad = (p) => p.evaluate(() => /(?:^|;\s*)klendar_18=[01]/.test(document.cookie));

/** «Tu cuenta» y el panel: sin Apple en la web y la cookie de la edad fuera
 * al cerrar sesión. El proyecto de dev no tiene Apple activo: se finge que sí
 * (la respuesta de /auth/v1/settings) para ver que el botón no sale igual. */
async function cuenta(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  await ctx.route('**/auth/v1/settings', async (route) => {
    const r = await route.fetch();
    const j = await r.json();
    j.external = { ...(j.external || {}), apple: true, google: true };
    await route.fulfill({ response: r, json: j });
  });
  const p = await ctx.newPage();
  const errores = [];
  // Ir al panel justo después de salir corta la transición de pantalla de
  // «Tu cuenta» (Chromium lo cuenta como error); no es de la página.
  p.on('pageerror', (e) => { if (!/Transition was aborted/.test(e.message)) errores.push(e.message); });
  await p.goto(`${BASE}/app/#/entrar`);
  await p.locator('#google [data-prov="google"]').waitFor({ timeout: 15000 });
  ok(await p.locator('#google [data-prov="google"]').count() === 1, `${nombre}/${t} entrar: «Continuar con Google» sigue`);
  ok(await p.locator('[data-prov="apple"]').count() === 0, `${nombre}/${t} entrar: sin «Continuar con Apple»`);
  ok(!/Continuar con Apple/.test(await p.locator('body').innerText()), `${nombre}/${t} entrar: sin el texto de Apple`);

  // Cerrar sesión en «Tu cuenta» (sin sesión, Supabase avisa igual de SIGNED_OUT).
  await ctx.addCookies([{ name: 'klendar_18', value: '1', url: BASE }]);
  ok(await conEdad(p), `${nombre}/${t} «Tu cuenta»: la cookie klendar_18 está antes de salir`);
  await p.evaluate(async () => { await sb.auth.signOut({ scope: 'local' }); });
  await p.waitForTimeout(300);
  ok(!(await conEdad(p)), `${nombre}/${t} «Tu cuenta»: klendar_18 borrada al cerrar sesión`);

  // Y en el panel y en las páginas públicas con sesión. Sin sesión, el panel
  // se va a «Tu cuenta» nada más abrirse (y en WebKit corta la prueba), así
  // que ahí se mira el código que se sirve.
  for (const [ruta, re] of [
    ['/panel/panel.js?v=159', /ev === 'SIGNED_OUT'\) \{\s*olvidaColas\(\);\s*try \{ document\.cookie = `klendar_18=; Max-Age=0; Path=\//],
    ['/assets/amigos.js?v=22', /ev === 'SIGNED_OUT'\) \{\s*document\.cookie = 'klendar_18=; Max-Age=0; Path=\//],
  ]) {
    const src = await (await ctx.request.get(`${BASE}${ruta}`)).text();
    ok(re.test(src), `${nombre}/${t} ${ruta}: borra klendar_18 al cerrar sesión`);
  }
  ok(errores.length === 0, `${nombre}/${t} cuenta y panel: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 800 }]]) {
    await legales(nav, nombre, t, vp);
    await cuenta(nav, nombre, t, vp);
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
