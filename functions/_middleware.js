// Lo que vive en el repo pero no es de la web: los scripts que generan las
// páginas (build_*.py), las herramientas de pruebas (tools/) y el README.
// Cloudflare Pages publica la carpeta entera; esto hace que den 404 y que
// ningún buscador los guarde.
const INTERNO = /^\/(tools\/|README\.md$|build_[\w-]*\.py$|[\w-]+\.py$|__pycache__\/)/;

export async function onRequest(ctx) {
  const { pathname } = new URL(ctx.request.url);
  if (INTERNO.test(pathname)) {
    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' },
    });
  }
  return ctx.next();
}
