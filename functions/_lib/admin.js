// El admin en su propio subdominio, en la raíz: `https://admin.klendar.app/`
// (Iván, 23-11; RUNBOOK §4zzz-admindom). Otro origen: su sesión
// (`localStorage`) ya no la comparte con las páginas públicas, «Tu cuenta» ni
// el panel. Y sin `/admin` a la vista en ningún sitio.
//
// - En admin.klendar.app: `/` es el admin (por dentro, el fichero `admin.html`,
//   `/admin`) y `/carta` la carta imprimible (`admin/carta.html`): se
//   reescriben sin cambiar la dirección. Sus JS y su CSS (`/admin/<x>.js|css`)
//   se sirven tal cual. `/admin…` da la 404 normal. Lo demás, a la misma
//   dirección en klendar.app (301).
// - En klendar.app (y www, y *.pages.dev): `/admin…` (también `/admin.html` y
//   los JS del admin; menos `/admin/admin.css`, que usa el panel) da la 404 normal de la web, sin pistas de que exista ni
//   de dónde está (Iván, 23-11: las direcciones viejas no redirigen). La
//   sesión vieja del admin que quedara en klendar.app la borra en silencio
//   `assets/errores.js`, que cargan todas sus páginas.
// - En local (tools/serve_dev.mjs): `localhost:<puerto>` hace de klendar.app y
//   `admin.localhost:<puerto>` de admin.klendar.app (Chromium y WebKit
//   resuelven `*.localhost` solos y lo tratan como contexto seguro).
//
// El host del admin no está en config.js (no se toca): se deriva de aquí y,
// en el navegador, de `location` (admin/admin.js, assets/cuenta/app.js).

export const HOST_ADMIN = 'admin.klendar.app';
export const WEB_ADMIN = `https://${HOST_ADMIN}`;
export const WEB_PUBLICA = 'https://klendar.app';

const LOCAL = /^(localhost|127\.0\.0\.1)$/i;

/** ¿Es el host del admin? (`admin.klendar.app` o, en local, `admin.localhost`). */
export const esHostAdmin = (hostname) => /^admin\.(klendar\.app|localhost)$/i.test(hostname || '');

/** ¿Es una dirección vieja del admin? (`/admin` y lo de dentro). */
export const esRutaAdmin = (ruta) => /^\/admin(\/|$)/.test(ruta || '');

/** Las páginas del admin en su host → el fichero que las sirve por dentro. */
export const PAGINAS_ADMIN = { '/': '/admin', '/carta': '/admin/carta' };

/** La hoja de estilos del admin la usa también el panel (`panel.html`): se
 * sirve en los dos hosts (y va fuera de las Functions, `_routes.json`). */
export const CSS_COMUN = '/admin/admin.css';

/** Sus JS y su CSS (los pide admin.html): se sirven tal cual en su host. */
const FICHERO_ADMIN = /^\/admin\/[\w.-]+\.(js|css)$/;

const puerto = (url) => (url.port ? `:${url.port}` : '');

/** El origen del admin visto desde `url` (en local, admin.localhost con el mismo puerto). */
export function origenAdmin(url) {
  if (esHostAdmin(url.hostname)) return url.origin;
  return LOCAL.test(url.hostname) ? `${url.protocol}//admin.localhost${puerto(url)}` : WEB_ADMIN;
}

/** El origen de la web pública visto desde `url` (en local, localhost con el mismo puerto). */
export function origenPublico(url) {
  if (/^admin\.localhost$/i.test(url.hostname)) return `${url.protocol}//localhost${puerto(url)}`;
  if (LOCAL.test(url.hostname)) return url.origin;
  return WEB_PUBLICA;
}

/**
 * Qué hacer con una petición según el host:
 * - `{ salto: <dirección> }`: un 301;
 * - `{ reescribe: <ruta> }`: servir ese fichero sin cambiar la dirección (el admin);
 * - `{ noExiste: true }`: la 404 normal de la web;
 * - `null`: seguir como siempre.
 * `buena` es la dirección sin barra al final (`direccionBuena`).
 */
export function decideHost(url, buena = url.pathname) {
  const ruta = url.pathname;
  if (esHostAdmin(url.hostname)) {
    if (FICHERO_ADMIN.test(ruta)) return null;
    if (esRutaAdmin(buena)) return { noExiste: true };
    const fichero = PAGINAS_ADMIN[buena];
    if (fichero) return buena === ruta ? { reescribe: fichero } : { salto: url.origin + buena + url.search };
    return { salto: origenPublico(url) + buena + url.search };
  }
  return esRutaAdmin(buena) && ruta !== CSS_COMUN ? { noExiste: true } : null;
}
