// Direcciones sin barra al final (Iván, 2026-11-11): la oficial es
// `/privacidad`, `/en/privacy`, `/cuenta/entrar`; la portada sigue siendo `/`.
// Lo viejo (`/privacidad/`, `/privacidad/index.html`, `/privacidad.html`, las
// direcciones «en inglés» de antes) llega aquí porque `_routes.json` solo deja
// fuera de las Functions la dirección exacta de cada página estática, y se
// manda de un solo salto (301, con su `?…`; el `#…` lo conserva el navegador)
// a la buena. `/legal/<doc>` y `/.well-known/` se quedan como están: lo
// primero lo resuelve su Function (también con barra) y lo segundo lo leen
// Android e iOS tal cual.
const ALIAS = [
  [/^\/privacy$/, '/privacidad'],
  [/^\/terms$/, '/terminos'],
  // «Agenda» en inglés es el orden del día de una reunión; la cartelera es
  // «what's on». Lo de antes estuvo publicado un rato.
  [/^\/en\/agenda(\/.*)?$/, '/en/whats-on$1'],
  // Las que su Function ya mandaba a otra (functions/hoy/index.js…): directas,
  // para que `/hoy/` no dé dos saltos.
  [/^\/hoy$/, '/agenda'],
  [/^\/en\/today$/, '/en/whats-on'],
  [/^\/con-ninos$/, '/coleccion/con-ninos'],
  [/^\/en\/kids$/, '/en/collection/con-ninos'],
];

/** La dirección buena de `pathname` (la misma si ya lo es). */
export function direccionBuena(pathname) {
  // `/captcha/`: la app hasta la 0.1.7 solo deja cargar `/captcha/…` en su vista
  // web; se sirve tal cual (`_redirects`, regla 200).
  if (pathname === '/' || pathname === '/captcha/' || /^\/(\.well-known|legal|assets)\//.test(pathname)) return pathname;
  let ruta = pathname
    .replace(/\/index\.html$/i, '/')
    .replace(/^(\/.+)\.html$/i, '$1')
    .replace(/\/+$/, '') || '/';
  for (const [patron, destino] of ALIAS) if (patron.test(ruta)) { ruta = ruta.replace(patron, destino); break; }
  return ruta;
}
