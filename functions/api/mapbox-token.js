// El token de Mapbox para buscar una dirección desde el panel.
//
// No vive en el repositorio: lo pone Cloudflare Pages en la variable
// `MAPBOX_TOKEN` (Settings → Environment variables). Si no está, el panel se
// entera y deja de ofrecer la búsqueda en vez de fallar por dentro.
//
// Conviene que sea un token **público y restringido a klendar.app** desde el
// panel de Mapbox: aunque lo sirvamos nosotros, acaba en el navegador.

export const onRequestGet = (ctx) => {
  const token = ctx.env?.MAPBOX_TOKEN || '';
  return new Response(JSON.stringify({ token }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Un rato en el navegador de quien lo pide, en ningún sitio más.
      'cache-control': 'private, max-age=600',
    },
  });
};
