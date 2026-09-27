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
const INTERNO = /^\/(tools\/|README\.md$|build_[\w-]*\.py$|[\w-]+\.py$|__pycache__\/|node_modules\/|\.(?!well-known\/))/;

const SEGURIDAD = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

export async function onRequest(ctx) {
  const { pathname } = new URL(ctx.request.url);
  if (INTERNO.test(pathname)) {
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
    const ubicacion = /^\/(explorar|en\/explore|app|panel)\//.test(pathname) ? '(self)' : '()';
    cabeceras.set('permissions-policy', `geolocation=${ubicacion}, camera=${pathname.startsWith('/panel/') ? '(self)' : '()'}, microphone=()`);
  }
  return new Response(head ? null : res.body, { status: res.status, statusText: res.statusText, headers: cabeceras });
}
