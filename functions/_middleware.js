// Pasa por aquí toda petición a la web.
//
// 1. Lo que vive en el repo pero no es de la web (los scripts que generan
//    las páginas, tools/, el README, ficheros ocultos como .gitignore o
//    .claude/) da 404: Cloudflare Pages publica la carpeta entera. Menos
//    /.well-known/, que lo necesitan los enlaces de la app (App Links).
// 2. Las páginas que se pintan al vuelo (fichas, Explorar, agenda) llevan las
//    mismas cabeceras de seguridad que las estáticas: `_headers` solo se
//    aplica a los ficheros, no a lo que devuelven las funciones.
// 3. HEAD responde como GET (sin cuerpo): las funciones solo tienen GET y los
//    comprobadores de enlaces y algunos buscadores preguntan con HEAD.
const INTERNO = /^\/(tools\/|README\.md$|build_[\w-]*\.py$|[\w-]+\.py$|__pycache__\/|node_modules\/|\.(?!well-known\/))/i;

const SEGURIDAD = {
  // Siempre HTTPS, aunque alguien escriba http:// (un año; también www).
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  // Lo mínimo que no rompe nada: sin <base> ajeno, sin plugins y sin iframes
  // de fuera (igual que X-Frame-Options). El widget trae la suya.
  'content-security-policy': "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
};

// La ruta tal y como la sirve Cloudflare: decodificada y sin barras dobles
// (`/%52EADME.md` o `//tools/…` se colaban por delante de INTERNO).
const rutaReal = (pathname) => {
  let ruta = pathname;
  try { ruta = decodeURIComponent(pathname); } catch { /* se queda como venía */ }
  return ruta.replace(/\/{2,}/g, '/');
};

export async function onRequest(ctx) {
  const { pathname, searchParams } = new URL(ctx.request.url);
  if (INTERNO.test(pathname) || INTERNO.test(rutaReal(pathname))) {
    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' },
    });
  }

  const head = ctx.request.method === 'HEAD';
  const res = head
    ? await ctx.next(new Request(ctx.request.url, { method: 'GET', headers: ctx.request.headers }))
    : await ctx.next();

  const cabeceras = new Headers(res.headers);
  for (const [k, v] of Object.entries(SEGURIDAD)) if (!cabeceras.has(k)) cabeceras.set(k, v);
  // El widget se incrusta en webs de negocios; el resto no se deja enmarcar.
  if (!pathname.startsWith('/widget/') && !cabeceras.has('x-frame-options')) cabeceras.set('x-frame-options', 'DENY');
  if (!cabeceras.has('permissions-policy')) {
    // La ficha abierta desde el QR del local (`?visita=`) mira si estás en
    // el local para darte el sello: solo entonces puede pedir la ubicación.
    const desdeQr = /^\/(en\/)?b\//.test(pathname) && searchParams.has('visita');
    const ubicacion = desdeQr || /^\/(explorar|en\/explore|app|panel)\//.test(pathname) ? '(self)' : '()';
    cabeceras.set('permissions-policy', `geolocation=${ubicacion}, camera=${pathname.startsWith('/panel/') ? '(self)' : '()'}, microphone=()`);
  }
  return new Response(head ? null : res.body, { status: res.status, statusText: res.statusText, headers: cabeceras });
}
