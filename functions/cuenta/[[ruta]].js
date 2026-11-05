// «Tu cuenta» es una sola página con direcciones normales (/cuenta/favoritos,
// /cuenta/entrar?siguiente=planes…): aquí se sirve esa misma página en
// cualquiera de ellas, también al recargar o al abrir un enlace directo, y
// assets/cuenta/app.js pinta la pantalla según la dirección.
//
// Por qué una Function y no `/cuenta/* /cuenta/index.html 200` en `_redirects`:
// Cloudflare rechaza esa regla («Infinite loop detected»), y una regla así
// también se llevaría por delante cualquier fichero de la carpeta. Por eso los
// scripts y el CSS viven en /assets/cuenta/, que no pasa por las Functions.
//
// Las cabeceras (CSP, Permissions-Policy, noindex) son las de `/cuenta/*` en
// `_headers`: las pone Cloudflare al pedirle la página a ASSETS. Lo que tenga
// pinta de fichero (`/cuenta/algo.js`) no es una pantalla: sigue su camino y da
// la 404 normal. (Las rutas pueden llevar puntos: /cuenta/momento/<clave>.<ventana>.<firma>.)
export async function onRequestGet({ request, env, next }) {
  const url = new URL(request.url);
  if (url.pathname === '/cuenta') return Response.redirect(`${url.origin}/cuenta/${url.search}`, 308);
  if (url.pathname === '/cuenta/' || /\.(js|mjs|css|map|html|json|txt|xml|png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(url.pathname)) return next();
  return env.ASSETS.fetch(new Request(new URL('/cuenta/', url), request));
}

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
