// El panel de negocios con direcciones limpias, sin `#` (Iván, 24-11:
// «lo quiero dejar todo limpio y claro»; RUNBOOK §4zzz-panellimpio). El mismo
// patrón que el admin (_lib/admin.js, §4zzz-adminlimpio):
//
// - `klendar.app/panel` abre Hoy; cada pantalla va en su ruta, con el mismo
//   nombre que iba tras el `#`: `/panel/hoy`, `/panel/validar`,
//   `/panel/publicar`, `/panel/negocio/en-el-local`,
//   `/panel/publicaciones/<id>`, `/panel/alta/entidad/1`… Los parámetros
//   (`?biz=`, `?estado=`, `?extend=`…) van en el `?…` de la dirección.
// - El servidor sirve la misma página (`panel.html`) en todas ellas, sin
//   cambiar la dirección (el middleware y tools/serve_dev.mjs, con
//   `decidePanel`), con `CABECERAS_PANEL` (_lib/csp.js): las de `/panel` en
//   `_headers`, igual de estrictas.
// - Sus JS, su CSS y sus diccionarios (`/panel/<x>.js|css`,
//   `/panel/i18n/<x>.js`) se sirven tal cual (y van fuera de las Functions:
//   `_routes.json` los nombra uno a uno; tools/panel_rutas_check.mjs lo mira).
// - Con barra final (`/panel/hoy/`), `/panel.html` o `/panel/index.html`: 301 a
//   la buena, con su `?…`. Lo que no es una pantalla (`/panel/loquesea`): la
//   404 normal de la web.
// - Los enlaces con `#` ya no llevan a ningún sitio (decisión de Iván): el
//   navegador no manda el `#`, así que `klendar.app/panel#/validar` abre
//   `/panel` (Hoy) y la página lo quita de la barra (panel/panel.js).
//
// En el navegador (panel/panel.js, «Direcciones»): `currentRoute()` lee
// `location.pathname`, `go()` cambia la dirección con `history.pushState` y
// «Atrás» y «Adelante» vuelven a pintar (`popstate`).

/** Las pantallas del panel: los `PAGES.x` de panel/*.js (lo comprueba
 * tools/panel_rutas_check.mjs). `/panel/<pantalla>` y lo que cuelga de ella
 * (`/panel/sellos/<id>/editar`) sirven el panel. **Al añadir una pantalla al
 * panel, añadirla también aquí**: si no, recargarla daría 404. */
export const SECCIONES_PANEL = [
  'aforo', 'alta', 'antes-de-cerrar', 'asistentes', 'ayuda', 'baja', 'bonos', 'calendario', 'carta', 'cartel',
  'cartel-local', 'cerrados', 'cola', 'cumpleanos', 'cupon', 'encargos', 'encargos-cosas', 'equipo',
  'estaba-cerrado', 'festivo', 'ficha', 'fidelizar', 'grupos', 'habituales', 'hoy', 'informe', 'mensajes',
  'menu-del-dia', 'momento', 'negocio', 'novedades', 'partidos', 'pedidos', 'plan', 'preguntas',
  'publicaciones', 'publicar', 'resenas', 'rrpp', 'sellos', 'series', 'sorteos', 'tele', 'validar',
  'wifi-clientes',
];
const SECCION = new RegExp(`^/panel/(${SECCIONES_PANEL.join('|')})(/[^/]+)*$`);

/** ¿Es `ruta` (sin `?`) una pantalla del panel? (`/panel`, `/panel/hoy`, `/panel/sellos/<id>`…). */
export const esPantallaPanel = (ruta) => ruta === '/panel' || SECCION.test(ruta || '');

/** ¿Es del panel? (`/panel`, `/panel.html`, `/panel/…`). */
const esRutaPanel = (ruta) => /^\/panel(\.html)?(\/|$)/.test(ruta || '');

/** Sus ficheros: los JS y el CSS (`/panel/panel.js`) y los diccionarios
 * (`/panel/i18n/ca.js`). Se sirven tal cual. */
export const FICHERO_PANEL = /^\/panel\/(i18n\/)?[\w-]+\.(js|css)$/;

/** El fichero que sirve el panel por dentro (Cloudflare: `panel.html`). */
export const PAGINA_PANEL = '/panel';

/**
 * Qué hacer con una petición al panel (`buena`: la dirección sin barra al
 * final, `direccionBuena`):
 * - `{ reescribe: '/panel', zona: 'panel' }`: servir `panel.html` sin cambiar la dirección;
 * - `{ salto: <dirección> }`: un 301 a la buena (barra final, `.html`);
 * - `{ noExiste: true }`: la 404 normal (`/panel/loquesea`);
 * - `null`: no es del panel (o es uno de sus ficheros): seguir como siempre.
 * En www no decide: el middleware la manda antes a klendar.app.
 */
export function decidePanel(url, buena = url.pathname) {
  const ruta = url.pathname;
  if (/^www\./i.test(url.hostname) || (!esRutaPanel(ruta) && !esRutaPanel(buena))) return null;
  if (FICHERO_PANEL.test(ruta)) return null;
  if (!esPantallaPanel(buena)) return { noExiste: true };
  return buena === ruta ? { reescribe: PAGINA_PANEL, zona: 'panel' } : { salto: url.origin + buena + url.search };
}
