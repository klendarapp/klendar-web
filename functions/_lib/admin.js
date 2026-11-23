// El admin en su propio subdominio, `admin.klendar.app` (Iván, 23-11; RUNBOOK
// §4zzz-admindom). Otro origen: su sesión (`localStorage`) ya no la comparte
// con las páginas públicas, «Tu cuenta» ni el panel.
//
// - En admin.klendar.app: `/admin…` se sirve; `/` va a `/admin`; lo demás,
//   a la misma dirección en klendar.app (301). Lo estático que no pasa por las
//   Functions (`/assets/…`, `/config.js`, `/admin/*.js`, iconos) se sirve
//   igual en los dos (es lo que carga la página del admin).
// - En klendar.app (y www, y *.pages.dev): `/admin` exacto da la página
//   puente (`admin/puente.html`): borra lo que dejó aquí la sesión vieja del
//   admin y salta a admin.klendar.app con la misma ruta, `?…` y `#…` (el `#`
//   no llega al servidor). Lo de dentro (`/admin/…`), 301 directo (el
//   navegador conserva el `#` en un 301 si el destino no trae uno).
// - En local (tools/serve_dev.mjs): `localhost:<puerto>` hace de klendar.app y
//   `admin.localhost:<puerto>` de admin.klendar.app (Chromium y WebKit
//   resuelven `*.localhost` solos y lo tratan como contexto seguro).
//
// El host del admin no está en config.js (no se toca): se deriva de aquí y,
// en el navegador, de `location` (admin/admin.js, admin/puente.js).

export const HOST_ADMIN = 'admin.klendar.app';
export const WEB_ADMIN = `https://${HOST_ADMIN}`;
export const WEB_PUBLICA = 'https://klendar.app';

const LOCAL = /^(localhost|127\.0\.0\.1)$/i;

/** ¿Es el host del admin? (`admin.klendar.app` o, en local, `admin.localhost`). */
export const esHostAdmin = (hostname) => /^admin\.(klendar\.app|localhost)$/i.test(hostname || '');

/** ¿Es una dirección del admin? (`/admin` y lo de dentro). */
export const esRutaAdmin = (ruta) => /^\/admin(\/|$)/.test(ruta || '');

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
 * - `{ puente: true }`: la página puente (`/admin` en la web pública);
 * - `null`: seguir como siempre.
 * `buena` es la dirección sin barra al final (`direccionBuena`), para que
 * `/admin/` vaya de un solo salto.
 */
export function decideHost(url, buena = url.pathname) {
  if (esHostAdmin(url.hostname)) {
    // La página puente no pinta nada en el admin (y no debe borrar su sesión).
    if (buena === '/admin/puente') return { salto: `${url.origin}/admin${url.search}` };
    if (esRutaAdmin(buena)) return buena === url.pathname ? null : { salto: url.origin + buena + url.search };
    if (buena === '/') return { salto: `${url.origin}/admin${url.search}` };
    return { salto: origenPublico(url) + buena + url.search };
  }
  if (!esRutaAdmin(buena)) return null;
  if (url.pathname === '/admin') return { puente: true };
  return { salto: origenAdmin(url) + (buena === '/admin/puente' ? '/admin' : buena) + url.search };
}
